const assert = require('node:assert/strict');
const { load, deferred, drain } = require('./test-splash-startup.cjs');

function runtime({ cachedUser = null, available = true, openid = 'viewer' } = {}) {
  const storage = new Map(), removed = [], toasts = [], calls = [], completions = [];
  const control = { auth: null, profile: null, users: null };
  if (cachedUser) storage.set('userInfo', cachedUser);
  const globalData = new Proxy({}, {
    set(target, key, value) {
      target[key] = value;
      if (key === '_loginProcessCompleted' && value) completions.push({ ...target });
      return true;
    }
  });
  const app = { globalData };
  const uni = {
    getStorageSync: key => storage.get(key),
    setStorageSync: (key, value) => storage.set(key, value),
    removeStorageSync: key => { removed.push(key); storage.delete(key); },
    showToast: options => toasts.push(options.title)
  };
  const state = load('utils/app-state.js', { uni, getApp: () => app }, [
    'getAppState', 'getOpenid', 'patchAppState', 'setUserSession', 'clearUserSession',
    'markLoginProcessStarted', 'markLoginProcessCompleted'
  ]);
  const tcb = {
    async callFunction(options) {
      calls.push(options.name);
      if (options.name === 'getUserProfile') {
        if (control.profile) return control.profile;
        return { result: { success: true, userInfo: { ...cachedUser, nickName: 'fresh' } } };
      }
      return { result: { openid } };
    },
    database() {
      return { collection: () => ({ where: () => ({
        async get() {
          calls.push('users');
          return control.users || { data: [] };
        }
      }) }) };
    }
  };
  const options = load('App.vue', {
    uni, ...state, formatErrorForLog: String,
    installRuntimeBindings: instance => { instance.$tcb = available ? tcb : null; },
    ensureTcbAuthenticated: async () => { if (control.auth) await control.auth; },
    ensureRuntimeOpenid: async () => {
      calls.push('ensureRuntimeOpenid');
      if (openid) state.patchAppState({ openid });
      return openid;
    },
    refreshAdminStatus: async () => {}
  });
  Object.assign(app, options.data());
  for (const [name, method] of Object.entries(options.methods)) app[name] = method.bind(app);
  function start() {
    state.markLoginProcessStarted();
    app.syncGlobalDataFromAppState();
    return app.loginAndCheckUser();
  }
  return { app, state, storage, removed, toasts, calls, completions, control, start };
}

async function testWaitsForAuthenticationAndProfile() {
  const user = { _openid: 'viewer', nickName: 'saved' };
  const auth = deferred(), profile = deferred();
  const run = runtime({ cachedUser: user });
  run.control.auth = auth.promise;
  run.control.profile = profile.promise;
  const pending = run.start();
  await drain();
  assert.equal(run.state.getAppState()._loginProcessCompleted, false, '认证等待期间不能发布完成');
  assert.equal(run.calls.length, 0);
  auth.resolve();
  await drain();
  assert.equal(run.state.getOpenid(), 'viewer');
  assert.equal(run.state.getAppState().isLoggedIn, false);
  assert.equal(run.state.getAppState()._loginProcessCompleted, false, '只有openid不代表完整会话就绪');
  assert.deepEqual(run.calls, ['ensureRuntimeOpenid', 'getUserProfile']);
  profile.resolve({ result: { success: true, userInfo: { ...user, nickName: 'latest' } } });
  await pending;
  const state = run.state.getAppState();
  assert.equal(state.isLoggedIn, true);
  assert.equal(state.userInfo.nickName, 'latest');
  assert.equal(state._loginProcessCompleted, true);
  assert.equal(state._loginProcessFailed, false);
  assert.equal(run.completions.length, 1, '只发布一次完整会话完成');
  assert.equal(run.completions[0].isLoggedIn, true);
  assert.equal(run.completions[0].userInfo.nickName, 'latest');
  assert.deepEqual(run.calls, ['ensureRuntimeOpenid', 'getUserProfile'], '等待恢复不额外触发登录或资料查询');
}

async function testPreservesSavedSessionOnNetworkFailure() {
  const user = { _openid: 'saved-account', nickName: 'saved' };
  const run = runtime({ cachedUser: user, openid: 'runtime-identity' });
  const profile = deferred();
  run.control.profile = profile.promise;
  const pending = run.start();
  await drain();
  profile.reject(new Error('temporary network failure'));
  await pending;
  const state = run.state.getAppState();
  assert.equal(run.storage.get('userInfo'), user, '暂时失败不能删除保存的登录资料');
  assert.equal(run.removed.includes('userInfo'), false);
  assert.equal(state.userInfo, user);
  assert.equal(state.openid, user._openid);
  assert.equal(state.isLoggedIn, true);
  assert.equal(state._loginProcessCompleted, true);
  assert.equal(state._loginProcessFailed, false, '已恢复保存会话可以完成启动');
  assert.equal(run.calls.includes('users'), false, '不会在保留会话后再走访客查询');
  assert.equal(run.toasts.length, 0, '资料暂时失败不误报退出登录');
}

async function testConfirmedGuestAndMissingSavedUser() {
  for (const cachedUser of [null, { _openid: 'viewer', nickName: 'obsolete' }]) {
    const run = runtime({ cachedUser });
    const users = deferred();
    if (cachedUser) run.control.profile = Promise.resolve({ result: { success: true, userInfo: null } });
    run.control.users = users.promise;
    const pending = run.start();
    await drain();
    assert.equal(run.state.getAppState()._loginProcessCompleted, false, '访客身份也须等待资料查询结束');
    users.resolve({ data: [] });
    await pending;
    const state = run.state.getAppState();
    assert.equal(state._loginProcessCompleted, true);
    assert.equal(state._loginProcessFailed, false);
    assert.equal(state.isLoggedIn, false);
    assert.equal(state.userInfo, null);
    assert.equal(state.openid, 'viewer');
    if (cachedUser) assert.equal(run.storage.has('userInfo'), false, '明确不存在的用户资料仍按原逻辑清理');
    assert.equal(run.completions.length, 1);
    assert.equal(run.completions[0].isLoggedIn, false);
    assert.equal(run.completions[0].userInfo, null);
  }
}

async function testDatabaseSessionCommittedBeforeCompletion() {
  const run = runtime();
  const user = { _openid: 'viewer', nickName: 'from-database' };
  run.control.users = Promise.resolve({ data: [user] });
  await run.start();
  assert.equal(run.state.getAppState().userInfo, user);
  assert.equal(run.state.getAppState().isLoggedIn, true);
  assert.equal(run.completions[0].userInfo, user);
  assert.equal(run.completions[0].isLoggedIn, true, '数据库恢复必须在完成信号前写入isLoggedIn');
  assert.equal(run.completions[0]._loginProcessFailed, false);
}

async function testFailuresAreNotConfirmedGuests() {
  const missingRuntime = runtime({ available: false });
  await missingRuntime.start();
  assert.equal(missingRuntime.state.getAppState()._loginProcessCompleted, true);
  assert.equal(missingRuntime.state.getAppState()._loginProcessFailed, true, '运行时不可用明确标记恢复失败');
  assert.equal(missingRuntime.completions[0]._loginProcessFailed, true);
  assert.equal(missingRuntime.calls.length, 0);

  const run = runtime(), users = deferred();
  run.control.users = users.promise;
  const pending = run.start();
  await drain();
  users.reject(new Error('offline'));
  await pending;
  const state = run.state.getAppState();
  assert.equal(state._loginProcessCompleted, true);
  assert.equal(state._loginProcessFailed, true, '查询失败不等同于确认用户不存在');
  assert.equal(run.completions[0]._loginProcessFailed, true, '失败状态也先于完成信号可见');
  assert.equal(run.toasts.length, 1);
}

async function testRestartAndLogoutResetCompletion() {
  const run = runtime();
  const initial = run.state.getAppState();
  assert.equal(initial._loginProcessFailed, false);
  run.state.patchAppState({ _loginProcessCompleted: true, _loginProcessFailed: true });
  run.state.markLoginProcessStarted();
  assert.equal(initial._loginProcessStarted, true);
  assert.equal(initial._loginProcessCompleted, false, '新一轮不能复用旧完成状态');
  assert.equal(initial._loginProcessFailed, false);
  run.state.patchAppState({ _loginProcessCompleted: true, _loginProcessFailed: true });
  run.state.setUserSession({ _openid: 'signed-in' }, 'signed-in');
  assert.equal(initial._loginProcessFailed, false, '后续明确登录成功不能留下启动失败标记');
  assert.equal(initial.isLoggedIn, true);
  run.state.patchAppState({ _loginProcessCompleted: true, _loginProcessFailed: true });
  run.state.clearUserSession();
  assert.equal(initial._loginProcessCompleted, false);
  assert.equal(initial._loginProcessFailed, false, '登出不会留下上一轮失败状态');
}

(async () => {
  for (const test of [testWaitsForAuthenticationAndProfile, testPreservesSavedSessionOnNetworkFailure,
    testConfirmedGuestAndMissingSavedUser, testDatabaseSessionCommittedBeforeCompletion,
    testFailuresAreNotConfirmedGuests, testRestartAndLogoutResetCompletion]) {
    await test();
    console.log('PASS ' + test.name);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
