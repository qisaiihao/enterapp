const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parse } = require('@babel/parser');

const root = path.join(__dirname, '..');
const pageFile = 'pages-user/profile-edit/profile-edit.vue';
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const quiet = { log() {}, warn() {}, error() {} };

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function runtime() {
  const identity = { openid: 'phone-owner' };
  const app = { globalData: { openid: identity.openid } };
  const calls = [], toasts = [];
  const imports = {};
  let source = read(pageFile).match(/<script>([\s\S]*?)<\/script>/)[1];
  for (const node of parse(source, { sourceType: 'module' }).program.body.reverse()) {
    if (node.type === 'ImportDeclaration') {
      for (const spec of node.specifiers) imports[spec.local.name] = {};
      source = source.slice(0, node.start) + source.slice(node.end);
    } else if (node.type === 'ExportDefaultDeclaration') {
      source = source.slice(0, node.start) + 'module.exports = ' + source.slice(node.declaration.start);
    }
  }
  const scope = {
    ...imports, module: { exports: {} }, console: quiet,
    getApp: () => app, getOpenid: () => identity.openid,
    STICKER_AVATAR_PATHS: [], getCurrentPlatform: () => 'app',
    uni: { showToast: options => toasts.push(options), hideLoading() {} }
  };
  vm.runInNewContext(source, scope, { filename: pageFile });
  const definition = scope.module.exports;
  const page = {
    ...definition.data(), ...definition.methods, $refs: {},
    setData(value) { Object.assign(this, value); },
    callCloudFunction(name, payload, options) {
      const pending = deferred();
      calls.push({ name, payload: structuredClone(payload), options, ...pending });
      return pending.promise;
    }
  };
  const result = (call, data) => call.resolve({ result: data });
  async function open(hasPassword) {
    const request = page.onEditPassword();
    assert.equal(page.showEditPasswordModal, true);
    assert.equal(page.isCheckingPassword, true);
    assert.equal(calls.at(-1).name, 'updateUserProfile');
    assert.equal(calls.at(-1).payload.action, 'getPasswordStatus');
    result(calls.at(-1), { success: true, hasPassword });
    await request;
    assert.equal(page.isCheckingPassword, false);
    assert.equal(page.hasPassword, hasPassword);
  }
  return { page, calls, toasts, identity, result, open, unload: () => definition.onUnload.call(page) };
}

function fill(page, newPassword = 'new-secret', oldPassword = '') {
  Object.assign(page, { oldPassword, newPassword, confirmPassword: newPassword });
}

function assertEmptyFields(page) {
  for (const key of ['oldPassword', 'newPassword', 'confirmPassword']) assert.equal(page[key], '', key);
}

async function forms() {
  const setting = runtime();
  await setting.open(false);
  fill(setting.page, 'first-secret', 'stale-hidden-value');
  const pending = setting.page.submitPasswordChange();
  assert.deepEqual(setting.calls.at(-1).payload, {
    action: 'updatePassword', mode: 'set', newPassword: 'first-secret'
  }, 'first-time setup does not send an old password');
  // Child props retain busy=true until Vue's next render. A successful write
  // must close the controlled form even while AppMotion.dismiss is still busy.
  setting.page.$refs.passwordMotion = {
    rendered: true, busy: true,
    dismiss(callback) { if (!this.busy) callback?.(); }
  };
  setting.result(setting.calls.at(-1), { success: true });
  await pending;
  assert.equal(setting.page.showEditPasswordModal, false, 'success closes a rendered modal before its child busy prop catches up');
  assertEmptyFields(setting.page);
  assert.match(setting.toasts.at(-1).title, /设置成功/);

  const changing = runtime();
  await changing.open(true);
  fill(changing.page);
  const before = changing.calls.length;
  await changing.page.submitPasswordChange();
  assert.equal(changing.calls.length, before);
  assert.match(changing.page.passwordError, /原密码/);
  fill(changing.page, 'second-secret', ' old-secret ');
  const change = changing.page.submitPasswordChange();
  assert.deepEqual(changing.calls.at(-1).payload, {
    action: 'updatePassword', mode: 'change', oldPassword: ' old-secret ', newPassword: 'second-secret'
  }, 'existing credentials are sent exactly as entered');
  changing.result(changing.calls.at(-1), { success: true });
  await change;
  assert.equal(changing.page.showEditPasswordModal, false);
  assertEmptyFields(changing.page);
  assert.match(changing.toasts.at(-1).title, /修改成功/);

  const validation = runtime();
  await validation.open(false);
  const initialCalls = validation.calls.length;
  for (const password of ['', 'short', 'a'.repeat(33), ' padded', 'padded ', 'secret\n']) {
    fill(validation.page, password);
    await validation.page.submitPasswordChange();
    assert.equal(validation.calls.length, initialCalls, `reject invalid new password ${JSON.stringify(password)}`);
    assert.ok(validation.page.passwordError);
  }
  fill(validation.page);
  validation.page.confirmPassword = 'different';
  await validation.page.submitPasswordChange();
  assert.equal(validation.calls.length, initialCalls);
  assert.match(validation.page.passwordError, /不一致/);
  for (const password of ['a'.repeat(6), 'b'.repeat(32)]) {
    fill(validation.page, password);
    const save = validation.page.submitPasswordChange();
    assert.equal(validation.calls.at(-1).payload.newPassword, password);
    validation.result(validation.calls.at(-1), { success: false, message: '可重试' });
    await save;
  }
}

async function retriesAndConflicts() {
  const r = runtime();
  await r.open(true);
  fill(r.page, 'new-secret', 'wrong-secret');
  const save = r.page.submitPasswordChange();
  const submissionCount = r.calls.length;
  await r.page.submitPasswordChange();
  r.page.closeEditPasswordModal();
  assert.equal(r.calls.length, submissionCount, 'double submission sends only one write');
  assert.equal(r.page.showEditPasswordModal, true, 'saving cannot be dismissed');
  r.result(r.calls.at(-1), { success: false, code: 'INVALID_OLD_PASSWORD', message: '原密码错误' });
  await save;
  assert.equal(r.page.isUpdatingPassword, false);
  assert.equal(r.page.oldPassword, 'wrong-secret');
  assert.equal(r.page.newPassword, 'new-secret');
  assert.match(r.page.passwordError, /原密码错误/);
  r.page.oldPassword = 'correct-secret';
  const retry = r.page.submitPasswordChange();
  r.calls.at(-1).reject(new Error('offline'));
  await retry;
  assert.equal(r.page.isUpdatingPassword, false);
  assert.equal(r.page.newPassword, 'new-secret');
  assert.ok(r.page.passwordError);
  r.page.closeEditPasswordModal();
  assertEmptyFields(r.page);

  for (const [initial, code, current] of [[false, 'PASSWORD_ALREADY_SET', true], [true, 'PASSWORD_NOT_SET', false]]) {
    const conflict = runtime();
    await conflict.open(initial);
    fill(conflict.page, 'new-secret', 'old-secret');
    const write = conflict.page.submitPasswordChange();
    const count = conflict.calls.length;
    conflict.result(conflict.calls.at(-1), { success: false, code, hasPassword: current, message: '状态已变化，请重新输入' });
    await write;
    assert.equal(conflict.page.hasPassword, current);
    assertEmptyFields(conflict.page);
    assert.ok(conflict.page.passwordError);
    assert.equal(conflict.page.showEditPasswordModal, true);
    assert.equal(conflict.calls.length, count, 'a state conflict never automatically resubmits a password');
  }
}

async function statusAndLifetime() {
  const failed = runtime();
  const opening = failed.page.onEditPassword();
  fill(failed.page);
  await failed.page.submitPasswordChange();
  assert.equal(failed.calls.length, 1, 'a pending status check blocks writes');
  await failed.page.onEditPassword();
  assert.equal(failed.calls.length, 1, 'repeated entry clicks do not duplicate status requests');
  failed.calls[0].reject(new Error('offline'));
  await opening;
  assert.equal(failed.page.hasPassword, null);
  assert.equal(failed.page.isCheckingPassword, false);
  assert.ok(failed.page.passwordError);
  await failed.page.submitPasswordChange();
  assert.equal(failed.calls.length, 1, 'an unavailable password status blocks writes');
  const reload = failed.page.loadPasswordStatus();
  failed.result(failed.calls.at(-1), { success: true, hasPassword: false });
  await reload;
  assert.equal(failed.page.hasPassword, false);
  assert.equal(failed.page.passwordError, '');

  const malformed = runtime();
  const badStatus = malformed.page.onEditPassword();
  malformed.result(malformed.calls[0], { success: true });
  await badStatus;
  assert.equal(malformed.page.hasPassword, null, 'missing status must never be treated as no password');
  assert.ok(malformed.page.passwordError);

  const closed = runtime();
  const firstOpen = closed.page.onEditPassword();
  const first = closed.calls[0];
  closed.page.closeEditPasswordModal();
  const secondOpen = closed.page.onEditPassword();
  closed.result(closed.calls[1], { success: true, hasPassword: true });
  await secondOpen;
  closed.result(first, { success: true, hasPassword: false });
  await firstOpen;
  assert.equal(closed.page.hasPassword, true, 'a closed session cannot overwrite the newly opened form');

  for (const hasPassword of [false, true]) {
    const changed = runtime();
    await changed.open(hasPassword);
    fill(changed.page, 'new-secret', 'old-secret');
    const count = changed.calls.length;
    changed.identity.openid = 'other-owner';
    await changed.page.submitPasswordChange();
    assert.equal(changed.calls.length, count, 'switching accounts after status loading must not submit the previous account form');
    assert.equal(changed.page.showEditPasswordModal, false);
    assertEmptyFields(changed.page);
    await changed.open(!hasPassword);
    assert.equal(changed.calls.length, count + 1, 'opening for the new account fetches its own password status');
  }

  for (const action of ['unload', 'switchAccount']) {
    const status = runtime();
    const lateStatus = status.page.onEditPassword();
    if (action === 'unload') status.unload();
    else status.identity.openid = 'other-owner';
    status.result(status.calls[0], { success: true, hasPassword: false });
    await lateStatus;
    assert.equal(status.page.hasPassword, null, `${action}: ignore late status`);
    if (action === 'switchAccount') {
      assert.equal(status.page.showEditPasswordModal, false, 'switching accounts while checking closes the stale form');
      assert.equal(status.page.isCheckingPassword, false, 'switching accounts cannot leave the status spinner running');
    }

    const write = runtime();
    await write.open(false);
    fill(write.page);
    const lateWrite = write.page.submitPasswordChange();
    if (action === 'unload') write.unload();
    else write.identity.openid = 'other-owner';
    write.result(write.calls.at(-1), { success: true });
    await lateWrite;
    assert.equal(write.toasts.length, 0, `${action}: ignore late save success`);
    assertEmptyFields(write.page);
    if (action === 'switchAccount') assert.equal(write.page.showEditPasswordModal, false, 'switching accounts while saving closes the stale form');
  }
}

async function redactionAndMarkup() {
  const source = read(pageFile);
  const poemIdRow = source.slice(source.indexOf('<!-- POEM ID -->'), source.indexOf('<!-- 手机号'));
  assert.match(poemIdRow, /class="password-edit-link"[^>]*@tap\.stop="onEditPassword"[^>]*>修改密码<\/text>/);
  assert.match(source, /\.password-edit-link\s*\{[^}]*text-decoration:\s*underline/);
  assert.match(source, /<AppMotion[^>]*mask-class="edit-password-modal"[^>]*:busy="isUpdatingPassword"/);

  const logs = [];
  let submitted;
  const cloudSource = read('utils/cloudCall.js')
    .replace(/^import .*;\r?$/gm, '')
    .replace('export async function cloudCall', 'async function cloudCall')
    .replace('export default', 'const exportedHelpers =');
  const scope = {
    module: { exports: {} }, console: { log: (...args) => logs.push(args), warn() {}, error() {} },
    getCloudFunctionMethod: () => 'tcb', isLoginAuditRequest: () => false,
    prepareCloudPostImages() {}, resolveCloudPostImages: async (_, response) => response
  };
  vm.runInNewContext(cloudSource + '\nmodule.exports = cloudCall;', scope);
  const payload = { action: 'updatePassword', oldPassword: 'private-old-value', newPassword: 'private-new-value' };
  await scope.module.exports('updateUserProfile', payload, {
    injectOpenId: false, context: { $tcb: { __skipAuth: true, async callFunction(options) {
      submitted = options.data;
      return { result: { success: true } };
    } } }
  });
  for (const key of ['oldPassword', 'newPassword']) {
    assert.equal(submitted[key], payload[key], 'redaction must not change submitted credentials');
    assert.ok(!JSON.stringify(logs).includes(payload[key]), `${key} must not appear in client logs`);
  }
}

Promise.resolve().then(forms).then(retriesAndConflicts).then(statusAndLifetime).then(redactionAndMarkup).then(() => {
  console.log('[test-profile-password] PASS: setup/change, validation, retries, conflicts, duplicate writes, request lifetime, status failures, entry layout and log redaction');
}).catch(error => { console.error(error); process.exitCode = 1; });
