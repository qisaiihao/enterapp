const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const auth = require('../functions/_shared/wechat-auth');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const quiet = { log() {}, warn() {}, error() {} };
const account = (id, extra = {}) => ({ _id: id, _openid: `owner-${id}`, poemId: `poet-${id}`, password: `secret-${id}`, ...extra });

// Snapshot transactions retry on conflicts and discard every write on failure.
// Queries are deliberately unavailable in transactions, matching CloudBase's doc-only API.
function runtime(users = []) {
  let tables = { users: Object.fromEntries(users.map(user => [user._id, structuredClone(user)])), wechat_bindings: {}, wechat_binding_grants: {} };
  let version = 0;
  const state = { failUserWrite: '', retries: 0 };
  function collection(name, transaction) {
    const rows = () => (transaction ? transaction.tables : tables)[name];
    const write = () => { if (transaction) transaction.dirty = true; else version++; };
    const result = {
      doc(id) {
        return {
          async get() {
            assert.ok(!transaction || !transaction.dirty, 'all transactional reads must precede writes');
            return { data: structuredClone(rows()[id] || null) };
          },
          async set({ data }) { write(); rows()[id] = { ...structuredClone(data), _id: id }; },
          async update({ data }) {
            if (name === 'users' && id === state.failUserWrite) throw Error('injected user write failure');
            assert.ok(rows()[id]); write();
            for (const [key, value] of Object.entries(data)) {
              if (value && value.removeField) delete rows()[id][key]; else rows()[id][key] = structuredClone(value);
            }
          }
        };
      }
    };
    if (!transaction) result.where = filter => {
      let count = Infinity;
      const query = {
        limit(value) { count = value; return query; },
        async get() { return { data: structuredClone(Object.values(rows()).filter(row => Object.entries(filter).every(([key, value]) => row[key] === value)).slice(0, count)) }; }
      };
      return query;
    };
    return result;
  }
  const db = {
    command: { remove: () => ({ removeField: true }) },
    collection: name => collection(name),
    async runTransaction(callback) {
      for (let retry = 0; retry < 25; retry++) {
        const start = version;
        const transaction = { tables: structuredClone(tables), dirty: false };
        const result = await callback({ collection: name => collection(name, transaction) });
        if (start !== version) { state.retries++; continue; }
        if (transaction.dirty) { tables = transaction.tables; version++; }
        return result;
      }
      throw Error('too many conflicts');
    }
  };
  function call(name, wxid, event = {}) {
    const module = { exports: {} };
    const cloud = { init() {}, database: options => { assert.equal(options.throwOnNotFound, false); return db; }, getWXContext: () => ({ OPENID: wxid }) };
    vm.runInNewContext(read(`functions/${name}/index.js`), {
      module, exports: module.exports, console: quiet,
      require(id) {
        if (id === 'wx-server-sdk') return cloud;
        if (id === './_lib/wechat-auth') return require(path.join(root, `functions/${name}/_lib/wechat-auth.js`));
        throw Error(`unexpected dependency ${id}`);
      }
    });
    return module.exports.main(event);
  }
  return {
    state, db, get tables() { return tables; },
    password: (wx, id, password = `secret-${id}`) => call('loginWithCredentials', wx, { poemId: `poet-${id}`, password }),
    bind: (wx, id, forceRebind = false, extra = {}) => call('bindWechatToAccount', wx, { poemId: `poet-${id}`, forceRebind, ...extra }),
    login: (wx, extra) => call('loginWithWechat', wx, extra),
    grant: (wx, id) => tables.wechat_binding_grants[auth.grantId(wx, id)],
    owner: wx => tables.wechat_bindings[auth.bindingId(wx)]?.userId
  };
}

async function backendTests() {
  const r = runtime([account('a')]);
  assert.equal((await r.login('', { openid: 'forged', wxOpenid: 'forged' })).code, 'NO_WECHAT_IDENTITY');
  assert.equal((await r.bind('', 'a', true, { openid: 'forged' })).success, false);
  assert.equal((await r.bind('wx', 'a', true)).code, 'BIND_AUTH_REQUIRED', 'public Poem ID and force flag are not a credential');
  assert.equal((await r.password('wx', 'a', 'wrong')).success, false);
  assert.equal(Object.keys(r.tables.wechat_binding_grants).length, 0);
  const login = await r.password('wx', 'a');
  assert.equal(login.needBindWechat, true);
  assert.equal(login.userInfo.password, undefined);
  assert.ok(r.grant('wx', 'a'));
  assert.equal((await r.bind('another-wx', 'a', true)).code, 'BIND_AUTH_REQUIRED');
  assert.equal((await r.bind('wx', 'a')).success, true, '1.7.0 request needs no new client token field');
  assert.equal(r.tables.users.a._openid, 'owner-a', 'binding never migrates content ownership');
  assert.equal(r.grant('wx', 'a').used, true);
  assert.equal((await r.bind('wx', 'a', true)).alreadyBound, true);
  assert.equal((await r.password('wx', 'a')).needBindWechat, false, 'already linked account is not prompted again');
  const direct = await r.login('wx');
  assert.equal(direct.openid, 'owner-a');
  assert.equal(direct.userInfo.password, undefined);
  assert.equal(direct.isBoundAccount, true);
  assert.equal((await r.password(undefined, 'a')).needBindWechat, false, 'App login requires no WeChat binding');

  for (const mutate of [
    (app) => { app.grant('wx', 'a').expiresAt = new Date(Date.now() - 1); },
    (app) => { app.grant('wx', 'a').used = true; },
    (app) => { app.tables.users.a.password = 'changed'; },
    (app) => { app.tables.users.a.phoneNumber = '13900139000'; },
    (app) => { app.grant('wx', 'a').userId = 'other'; }
  ]) {
    const app = runtime([account('a')]); await app.password('wx', 'a'); mutate(app);
    const before = structuredClone(app.tables);
    assert.equal((await app.bind('wx', 'a', true)).code, 'BIND_AUTH_REQUIRED');
    assert.deepEqual(app.tables, before, 'invalid grant cannot cause any write');
  }

  const conflicts = runtime([account('native', { _openid: 'wx' }), account('a', { wechatOpenId: 'old-wx' })]);
  await conflicts.password('wx', 'a');
  const before = structuredClone(conflicts.tables);
  const conflict = await conflicts.bind('wx', 'a');
  assert.equal(conflict.code, 'OPENID_CONFLICT'); assert.equal(conflict.targetWechatBound, true);
  assert.equal(conflict.conflictAccount.password, undefined);
  assert.deepEqual(conflicts.tables, before, 'confirmation response neither detaches owner nor consumes grant');
  conflicts.state.failUserWrite = 'a';
  assert.equal((await conflicts.bind('wx', 'a', true)).code, 'WECHAT_OPERATION_FAILED');
  assert.deepEqual(conflicts.tables, before, 'failed target update rolls back displaced owner and grant');
  conflicts.state.failUserWrite = '';
  assert.equal((await conflicts.bind('wx', 'a', true)).success, true);
  assert.equal(conflicts.tables.users.native._openid, 'wx');
  assert.equal(conflicts.tables.users.native.wechatLoginDisabled, true);
  assert.equal(conflicts.tables.users.a._openid, 'owner-a');
  assert.equal(conflicts.owner('old-wx'), '');
  assert.equal((await conflicts.login('wx')).openid, 'owner-a');
  assert.notEqual((await conflicts.login('old-wx')).openid, 'owner-a');

  const target = runtime([account('a', { wechatOpenId: 'old-wx' })]);
  await target.password('new-wx', 'a');
  const targetWarning = await target.bind('new-wx', 'a');
  assert.equal(targetWarning.code, 'WECHAT_ALREADY_BOUND');
  assert.equal(targetWarning.conflictType, 'targetWechat');
  assert.equal((await target.bind('new-wx', 'a', 'true')).success, false, 'force must be explicit boolean');
  assert.equal((await target.bind('new-wx', 'a', true)).success, true);

  const bound = runtime([account('a', { wechatOpenId: 'wx' }), account('b')]);
  await bound.password('wx', 'b');
  assert.equal((await bound.bind('wx', 'b')).conflictType, 'wechatOpenId');
  assert.equal((await bound.bind('wx', 'b', true)).success, true);
  assert.equal(bound.tables.users.a.wechatOpenId, undefined);
  assert.equal((await bound.login('wx')).openid, 'owner-b');

  const native = runtime([account('a', { _openid: 'native-wx' })]);
  assert.equal((await native.password('native-wx', 'a')).needBindWechat, false);
  await native.login('native-wx'); // Lazily establishes the legacy mapping.
  await native.password('new-wx', 'a');
  assert.equal((await native.bind('new-wx', 'a')).targetWechatBound, true);
  await native.bind('new-wx', 'a', true);
  assert.equal((await native.login('native-wx')).code, 'WECHAT_UNBOUND', 'a replaced native identity cannot regain access');

  const fresh = runtime();
  const registered = await Promise.all(Array.from({ length: 6 }, () => fresh.login('brand-new')));
  assert.ok(registered.every(result => result.success));
  assert.equal(Object.keys(fresh.tables.users).length, 1);
  assert.equal(new Set(registered.map(result => result.userInfo._id)).size, 1);
  assert.ok(fresh.state.retries > 0, 'test must actually exercise conflict retries');

  const racing = runtime([account('a'), account('b')]);
  await Promise.all([racing.password('wx', 'a'), racing.password('wx', 'b')]);
  const rebinds = await Promise.all([racing.bind('wx', 'a', true), racing.bind('wx', 'b', true)]);
  assert.ok(rebinds.every(result => result.success));
  assert.equal(Object.values(racing.tables.users).filter(user => user.wechatOpenId === 'wx').length, 1);
  assert.equal((await racing.login('wx')).userInfo._id, racing.owner('wx'));
  const oneTarget = runtime([account('a')]);
  await Promise.all([oneTarget.password('wx1', 'a'), oneTarget.password('wx2', 'a')]);
  assert.ok((await Promise.all([oneTarget.bind('wx1', 'a', true), oneTarget.bind('wx2', 'a', true)])).every(result => result.success));
  const winningWx = oneTarget.tables.users.a.wechatOpenId;
  assert.equal(oneTarget.owner(winningWx), 'a');
  const losingWx = winningWx === 'wx1' ? 'wx2' : 'wx1';
  assert.equal(oneTarget.owner(losingWx), '');
  assert.notEqual((await oneTarget.login(losingWx)).openid, 'owner-a');

  for (const field of ['wechatOpenId', '_openid']) {
    const duplicate = runtime([account('a', { [field]: 'wx' }), account('b', { [field]: 'wx' })]);
    assert.equal((await duplicate.login('wx')).code, 'AMBIGUOUS_WECHAT');
    assert.equal((await duplicate.bind('wx', 'a', true)).code, 'AMBIGUOUS_WECHAT');
    assert.equal(Object.keys(duplicate.tables.wechat_bindings).length, 0);
  }
  const sanitized = auth.safeUser(account('safe', { passwordHash: 'hash', passwordSalt: 'salt', resetToken: 'reset', accessToken: 'access', refreshToken: 'refresh' }));
  for (const key of ['password', 'passwordHash', 'passwordSalt', 'resetToken', 'accessToken', 'refreshToken']) assert.equal(sanitized[key], undefined);
}

async function frontendTests() {
  let calls = [], reply = { success: true }, resolve, applied = [], navigations = 0;
  const timers = new Map(); let nextTimer = 0;
  const context = {
    module: { exports: {} },
    uni: { showLoading() {}, hideLoading() {}, showToast() {}, switchTab() { navigations++; } },
    setTimeout(fn) { const id = ++nextTimer; timers.set(id, fn); return id; }, clearTimeout(id) { timers.delete(id); },
    async bindWechatAccount(id, force) { calls.push({ id, force }); return reply === 'pending' ? new Promise(done => { resolve = done; }) : reply; }
  };
  vm.runInNewContext(read('mixins/wechatBinding.js').replace(/^import .*;\s*/m, '').replace('export default', 'module.exports ='), context);
  const mixin = context.module.exports;
  const login = () => ({ userInfo: { poemId: 'poet-a', _openid: 'owner-a' }, openid: 'owner-a', currentOpenid: 'wx' });
  const page = () => {
    const result = { ...mixin.data(), pendingLoginResult: login(), isBindingWechat: false, loginPageUnloaded: false,
      password: 'secret', loginSmsCode: '123456', applyUserSession(user, openid) { applied.push({ user, openid }); } };
    for (const [key, method] of Object.entries(mixin.methods)) result[key] = method.bind(result);
    return result;
  };
  const p = page(); reply = 'pending';
  const binding = p.handleBindWechat();
  await p.confirmRebind(); p.skipBindWechat(); p.cancelOpenidConflict();
  assert.equal(calls.length, 1); assert.equal(applied.length, 0);
  resolve({ success: false, code: 'OPENID_CONFLICT', conflictType: '_openid', conflictAccount: { poemId: 'native' }, targetWechatBound: true });
  await binding;
  assert.equal(p.showOpenidConflictModal, true); assert.equal(p.isBindingWechat, false);
  p.cancelOpenidConflict(); assert.equal(p.showBindWechatModal, true); assert.ok(p.pendingLoginResult);
  reply = { success: false, code: 'WECHAT_ALREADY_BOUND', conflictType: 'targetWechat', boundAccount: { poemId: 'old' } };
  await p.handleBindWechat(); assert.equal(p.showRebindConfirmModal, true); assert.equal(p.wechatConflictType, 'targetWechat');
  p.cancelRebind(); assert.equal(p.showBindWechatModal, true);
  reply = { success: true }; await p.confirmRebind();
  assert.equal(calls.at(-1).force, true); assert.equal(applied.length, 1);
  assert.equal(applied[0].openid, 'owner-a'); assert.equal(applied[0].user.wechatOpenId, 'wx');
  assert.equal(p.pendingLoginResult, null); assert.equal(p.password, ''); assert.equal(p.loginSmsCode, '');
  assert.equal(p.showRebindConfirmModal, false);
  for (const fn of timers.values()) fn(); assert.equal(navigations, 1); timers.clear();

  const skip = page(); const before = calls.length; skip.skipBindWechat();
  assert.equal(calls.length, before); assert.equal(applied.at(-1).user.wechatOpenId, undefined);
  mixin.onUnload.call(skip); assert.equal(timers.size, 0);
  const expired = page(); reply = { success: false, code: 'BIND_AUTH_REQUIRED' }; await expired.handleBindWechat();
  assert.equal(expired.pendingLoginResult, null); assert.equal(expired.password, ''); assert.equal(expired.isBindingWechat, false);
  for (const mode of ['unload', 'new-login']) {
    const stale = page(); reply = 'pending'; const pending = stale.handleBindWechat(); const count = applied.length;
    if (mode === 'unload') { stale.loginPageUnloaded = true; mixin.onUnload.call(stale); } else stale.pendingLoginResult = login();
    resolve({ success: true }); await pending;
    assert.equal(applied.length, count, `${mode} must discard an old binding response`);
  }
  const retry = page(); reply = { success: false, code: 'WECHAT_OPERATION_FAILED' };
  await retry.handleBindWechat(); assert.ok(retry.pendingLoginResult); assert.equal(retry.isBindingWechat, false);
  reply = { success: true }; await retry.confirmOpenidConflict(); assert.equal(calls.at(-1).force, true);
}

async function pageIntegrationTests() {
  const { parse } = require('@babel/parser');
  function load(file, globals) {
    let source = read(file);
    if (file.endsWith('.vue')) source = source.match(/<script>([\s\S]*?)<\/script>/)[1];
    const context = { module: { exports: {} }, console: quiet };
    for (const node of parse(source, { sourceType: 'module' }).program.body.reverse()) {
      if (node.type === 'ImportDeclaration') {
        for (const specifier of node.specifiers) context[specifier.local.name] = {};
        source = source.slice(0, node.start) + source.slice(node.end);
      } else if (node.type === 'ExportDefaultDeclaration') source = source.slice(0, node.start) + 'module.exports = ' + source.slice(node.declaration.start);
      else if (node.type === 'ExportNamedDeclaration') source = source.slice(0, node.start) + source.slice(node.declaration.start);
    }
    vm.runInNewContext(source, { ...context, ...globals });
    return context.module.exports;
  }
  let openid = 'previous', resets = [], sessions = [], timers = [], switched = 0;
  const uni = { setStorageSync() {}, showToast() {}, switchTab() { switched++; } };
  const page = load('pages/login/login.vue', {
    uni, getOpenid: () => openid,
    setUserSession(user, id) { sessions.push({ user, id }); openid = id; }, patchAppState() {},
    resetAllCachesOnAccountChange({ newOpenId }) { resets.push(newOpenId); return Promise.resolve(); },
    setTimeout(fn) { timers.push(fn); return timers.length; }, clearTimeout() {}
  });
  const p = { ...page.data() };
  for (const [key, fn] of Object.entries(page.methods)) p[key] = fn.bind(p);
  p.applyUserSession({ _openid: 'owner-a' }, 'owner-a');
  assert.deepEqual(resets, ['owner-a']);
  p.applyUserSession({ _openid: 'owner-a' }, 'owner-a');
  assert.equal(resets.length, 1, 'same-account session refresh must preserve caches');
  const before = sessions.length;
  await p.handleLoginResult({ result: { success: true, needBindWechat: true, userInfo: { poemId: 'poet-b' }, openid: 'owner-b' } });
  assert.equal(sessions.length, before, 'confirmation must keep the verified login pending');
  assert.equal(p.showBindWechatModal, true);
  await p.handleLoginResult({ result: { success: true, needBindWechat: false, isPhoneVerified: true, userInfo: { poemId: 'poet-a' }, openid: 'owner-a' } });
  assert.equal(p.password, ''); assert.equal(timers.length, 1);
  p.loginPageUnloaded = true; timers[0](); assert.equal(switched, 0, 'unloaded login page cannot redirect the next page');
  const count = sessions.length;
  await p.handleLoginResult({ success: true, userInfo: {}, openid: 'late' });
  assert.equal(sessions.length, count);

  // The semantic adapter preserves business conflict codes and never injects a cached owner ID.
  let request;
  const source = read('api-cache/wechat-auth.js').replace(/^import .*;\s*/m, '').replace('export function', 'function') + '\nmodule.exports = bindWechatAccount;';
  const module = { exports: {} };
  vm.runInNewContext(source, { module, async callCloudAndGetResult(name, payload, options) {
    request = { name, payload, options }; return { success: false, code: 'OPENID_CONFLICT' };
  } });
  assert.equal((await module.exports('poet-a', true, p)).code, 'OPENID_CONFLICT');
  assert.equal(request.name, 'bindWechatToAccount'); assert.equal(request.payload.forceRebind, true);
  assert.equal(request.options.injectOpenId, false); assert.equal(request.options.context, p);
}

(async () => {
  await backendTests(); await frontendTests(); await pageIntegrationTests();
  console.log('WeChat binding tests passed: trusted identity, 1.7.0 requests, proof expiry, conflicts, atomic rollback, concurrency, owner preservation, sanitization and UI transitions.');
})().catch(error => { console.error(error); process.exitCode = 1; });
