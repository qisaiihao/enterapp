const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parse } = require('@babel/parser');
const root = path.resolve(__dirname, '..');

function loadModule(file, globals, names) {
  let source = fs.readFileSync(path.join(root, file), 'utf8');
  for (const node of parse(source, { sourceType: 'module' }).program.body.reverse()) {
    if (node.type === 'ImportDeclaration') source = source.slice(0, node.start) + source.slice(node.end);
    else if (node.type === 'ExportNamedDeclaration') source = source.slice(0, node.start) + source.slice(node.declaration.start);
  }
  source += '\nmodule.exports = {' + names.join(',') + '};';
  const context = { module: { exports: {} }, console, ...globals };
  vm.runInNewContext(source, context, { filename: file });
  return context.module.exports;
}
async function main() {
  let actor = 'alice';
  const calls = [];
  let transportFailure = null;
  let loginPrompts = 0;
  let respond = async () => ({ result: { success: true } });
  const api = loadModule('api-cache/societies.js', {
    uni: { getStorageSync: () => null, setStorageSync() {}, removeStorageSync() {} },
    getCurrentUserId: () => actor,
    requireLogin: async () => { loginPrompts++; return true; },
    cloudCall: async (name, payload, options) => { calls.push({ name, payload, options }); if (transportFailure) { const failure = transportFailure; transportFailure = null; throw failure; } return respond(); },
    unwrapResult(response) { if (!response.result.success) throw Object.assign(new Error(response.result.message), { result: response.result }); return response.result; },
    fileUrlCache: { getTempUrls: async () => ({}) }, hydrateTempUrls: async () => {}
  }, ['societyRequest']);

  await api.societyRequest('myApplication');
  assert.equal(calls.at(-1).payload.societyToken, undefined, 'no secondary credential is sent');
  assert.equal(calls.at(-1).payload.openid, undefined, 'the shared cloudCall injects the logged-in account');
  await api.societyRequest('updateSociety');
  assert.equal(calls.at(-1).options.timeoutMs, 310000, 'profile moderation gets the same wait budget as content publishing');

  let resolve;
  respond = () => new Promise(done => { resolve = done; });
  const oldRequest = api.societyRequest('myApplication');
  actor = 'bob';
  resolve({ result: { success: true, application: { phone: 'private' } } });
  await assert.rejects(oldRequest, /账号已切换/, 'late private response is discarded');

  actor = 'alice';
  respond = async () => ({ result: { success: false, code: 'AUTH_REQUIRED', message: '请先登录' } });
  await assert.rejects(api.societyRequest('myApplication'), error => error.code === 'AUTH_REQUIRED');
  assert.equal(loginPrompts, 1, 'a request without a logged-in account prompts login');
  await Promise.all([api.societyRequest('myApplication').catch(() => {}), api.societyRequest('mine').catch(() => {})]);
  assert.equal(loginPrompts, 2, 'parallel failures share one login prompt');

  let reviews = 0;
  respond = async () => ++reviews === 1
    ? { result: { success: false, code: 'SERVICE_ERROR', message: 'temporary failure' } }
    : { result: { success: true } };
  await api.societyRequest('reviewJoin', { requestId: 'request-a', revision: 1, decision: 'approved' });
  assert.equal(reviews, 2, 'a transient review failure is retried once');

  reviews = 0;
  respond = async () => ++reviews === 1
    ? { result: { success: false, code: 'SERVICE_ERROR' } }
    : { result: { success: true, alreadyReviewed: true } };
  assert.equal((await api.societyRequest('reviewJoin', { requestId: 'request-a', revision: 1, decision: 'approved' })).alreadyReviewed, true,
    'a retry accepts the idempotent result when the first review may have committed');
  assert.equal(reviews, 2);

  transportFailure = Object.assign(new Error('response lost after commit'), { code: 'CLOUD_CALL_FAILED' });
  const originalCloudCall = calls.length;
  respond = async () => ({ result: { success: true, alreadyReviewed: true } });
  assert.equal((await api.societyRequest('reviewJoin', { requestId: 'request-a', revision: 1, decision: 'approved' })).alreadyReviewed, true);
  assert.equal(calls.length - originalCloudCall, 2, 'an uncertain transport result is retried only once');

  reviews = 0;
  respond = async () => { reviews++; return { result: { success: false, code: 'FORBIDDEN', message: 'not allowed' } }; };
  await assert.rejects(api.societyRequest('reviewJoin', { requestId: 'request-a', revision: 1, decision: 'approved' }), error => error.code === 'FORBIDDEN');
  assert.equal(reviews, 1, 'authorization failures are not retried');

  transportFailure = Object.assign(new Error('SDK details must remain private'), { code: 'TCB_AUTH_FAILED' });
  await assert.rejects(api.societyRequest('saveContent'), error =>
    error.code === 'TCB_AUTH_FAILED' && /TCB_AUTH_FAILED/.test(error.message) && !/SDK details/.test(error.message));
  transportFailure = null;
  respond = async () => ({ result: { success: false, code: 'SERVICE_ERROR', message: '诗社服务暂时不可用，请稍后重试' } });
  await assert.rejects(api.societyRequest('saveContent'), error =>
    error.code === 'SERVICE_ERROR' && /SERVICE_ERROR/.test(error.message));
  console.log('societies client: PASS — login-only requests, login prompts, account isolation, stale responses and idempotent review retry');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
