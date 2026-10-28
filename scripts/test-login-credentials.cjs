const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parse } = require('@babel/parser');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const quiet = { log() {}, warn() {}, error() {} };

function loginRuntime(users, failQuery = false) {
  const cloud = {
    init() {},
    getWXContext: () => ({ OPENID: 'current-wechat' }),
    database: () => ({
      collection(name) {
        if (name === 'wechat_binding_grants') return { doc: () => ({ async set() {} }) };
        if (name === 'login_logs') return { async add() { return { _id: 'audit-record' }; } };
        assert.equal(name, 'users');
        return {
          where(filter) {
            let limit = 20;
            const query = {
              limit(value) { limit = value; return query; },
              async get() {
                if (failQuery) throw new Error('database unavailable');
                return { data: users.filter(user => Object.entries(filter).every(([key, value]) => user[key] === value)).slice(0, limit) };
              }
            };
            return query;
          }
        };
      }
    })
  };
  const context = { exports: {}, console: quiet, require(name) {
    if (name === './_lib/wechat-auth') return require('../functions/_shared/wechat-auth');
    if (name === './_lib/login-audit') return require('../functions/loginWithCredentials/_lib/login-audit');
    assert.equal(name, 'wx-server-sdk'); return cloud;
  } };
  vm.runInNewContext(read('functions/loginWithCredentials/index.js'), context);
  return context.exports.main;
}

async function main() {
  const user = { _id: 'user-1', _openid: 'owner', poemId: 'poet-1', nickName: '小诗人', phoneNumber: '13800138000', password: 'secret' };
  const login = loginRuntime([user]);
  for (const account of [user.poemId, user.nickName, user.phoneNumber, ' 小诗人 ']) {
    const result = await login({ account, password: 'secret' });
    assert.equal(result.success, true, account);
    assert.equal(result.openid, 'owner');
    assert.equal(result.userInfo._id, 'user-1');
    assert.equal(result.userInfo.password, undefined);
    assert.equal(result.needBindWechat, true);
    assert.equal(result.currentOpenid, 'current-wechat');
    assert.equal(result.isPhoneVerified, true);
    assert.equal((await login({ account, password: 'wrong' })).code, 'INVALID_CREDENTIALS');
  }
  assert.equal((await login({ account: 'missing', password: 'secret' })).code, 'INVALID_CREDENTIALS');
  for (const input of [undefined, {}, { account: '', password: 'secret' }, { account: '   ', password: 'secret' },
    { account: { $ne: null }, password: 'secret' }, { account: user.poemId, password: { $ne: null } },
    { account: user.poemId, password: ' ' }]) {
    assert.equal((await login(input)).code, 'MISSING_CREDENTIALS');
  }
  // Existing clients and account-binding requests retain strict Poem ID semantics.
  assert.equal((await login({ poemId: user.poemId, password: 'secret' })).success, true);
  for (const poemId of [user.nickName, user.phoneNumber]) {
    assert.equal((await login({ poemId, password: 'secret' })).code, 'INVALID_CREDENTIALS');
  }
  const duplicate = { _id: 'user-2', _openid: 'other', poemId: 'poet-2', nickName: user.nickName, phoneNumber: '13900139000', password: 'different' };
  const duplicateLogin = loginRuntime([user, duplicate]);
  assert.equal((await duplicateLogin({ account: user.nickName, password: 'secret' })).code, 'AMBIGUOUS_ACCOUNT');
  assert.equal((await duplicateLogin({ account: duplicate.poemId, password: 'different' })).openid, 'other');
  assert.equal((await duplicateLogin({ account: duplicate.phoneNumber, password: 'different' })).openid, 'other');
  // A nickname cannot shadow another user's Poem ID or bound phone, even with a different password.
  for (const alias of [user.poemId, user.phoneNumber]) {
    const collisionLogin = loginRuntime([user, { ...duplicate, nickName: alias }]);
    assert.equal((await collisionLogin({ account: alias, password: 'secret' })).openid, 'owner');
    assert.equal((await collisionLogin({ account: alias, password: 'different' })).code, 'INVALID_CREDENTIALS');
  }
  const phoneCollision = loginRuntime([user, { ...duplicate, poemId: user.phoneNumber }]);
  assert.equal((await phoneCollision({ account: user.phoneNumber, password: 'different' })).openid, 'other');
  assert.equal((await phoneCollision({ account: user.phoneNumber, password: 'secret' })).code, 'INVALID_CREDENTIALS');
  for (const field of ['poemId', 'phoneNumber']) {
    const ambiguous = loginRuntime([user, { ...duplicate, [field]: user[field] }]);
    assert.equal((await ambiguous({ account: user[field], password: 'secret' })).code, 'AMBIGUOUS_ACCOUNT');
  }
  assert.equal((await loginRuntime([{ ...user, password: undefined }])({ account: user.nickName, password: 'secret' })).code, 'INVALID_CREDENTIALS');
  const sameWechat = await loginRuntime([{ ...user, _openid: 'current-wechat', phoneNumber: '' }])({ account: user.poemId, password: 'secret' });
  assert.equal(sameWechat.needBindWechat, false);
  assert.equal(sameWechat.isPhoneVerified, false);
  assert.equal((await loginRuntime([], true)({ account: 'poet', password: 'secret' })).code, 'LOGIN_ERROR');

  // Exercise the actual form handler against the cloud function for each identifier.
  let source = read('pages/login/login.vue').match(/<script>([\s\S]*?)<\/script>/)[1];
  const context = { module: { exports: {} }, console: quiet, uni: { showLoading() {}, hideLoading() {}, showToast() {} } };
  for (const node of parse(source, { sourceType: 'module' }).program.body.reverse()) {
    if (node.type === 'ImportDeclaration') {
      for (const specifier of node.specifiers) context[specifier.local.name] = {};
      source = source.slice(0, node.start) + source.slice(node.end);
    } else if (node.type === 'ExportDefaultDeclaration') {
      source = source.slice(0, node.start) + 'module.exports = ' + source.slice(node.declaration.start);
    }
  }
  vm.runInNewContext(source, context);
  const page = context.module.exports;
  for (const identifier of [user.poemId, user.nickName, user.phoneNumber]) {
    let handled = false;
    const state = {
      ...page.data(), account: ` ${identifier} `, password: 'secret',
      async callCloudFunction(name, data) { assert.equal(name, 'loginWithCredentials'); return { result: await login(data) }; },
      async handleLoginResult(response) { assert.equal(response.result.success, true); handled = true; }
    };
    state.canLogin = page.computed.canLogin.call(state);
    await page.methods.onLogin.call(state);
    assert.equal(handled, true);
    assert.equal(state.isLogging, false);
  }
  assert.equal(Boolean(page.computed.canLogin.call({ showPasswordLogin: true, account: ' ', password: 'secret' })), false);
  console.log('Login credential tests passed: identifier types, password checks, ambiguity, compatibility and form submission.');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
