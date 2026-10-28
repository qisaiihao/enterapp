const assert = require('node:assert/strict');
const { load, fakeTime, deferred, drain } = require('./test-splash-startup.cjs');

function runtime({ cachedUser = null, consentAccepted = true } = {}) {
  const time = fakeTime(), storage = new Map(), listeners = new Map();
  const calls = [], navigations = [], profileNavigations = [], loginPrompts = [], toasts = [];
  const control = { profile: null, users: null, auth: null, content: null };
  const app = { globalData: {} };
  if (cachedUser) storage.set('userInfo', cachedUser);
  let state, loginTask, preloadCalls = 0, loginWatchCalls = 0, contentReady = false;
  const uni = {
    getStorageSync: key => storage.get(key),
    setStorageSync: (key, value) => storage.set(key, value),
    removeStorageSync: key => storage.delete(key),
    $on(event, callback) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(callback);
    },
    $off(event, callback) { listeners.get(event)?.delete(callback); },
    $emit(event) { listeners.get(event)?.forEach(callback => callback()); },
    showToast: options => toasts.push(options.title),
    reLaunch: options => navigations.push({
      url: options.url, elapsedMs: time.now() - 10000, state: { ...state.getAppState() }
    })
  };
  const base = { ...time.globals, uni, getApp: () => app, formatErrorForLog: String };
  state = load('utils/app-state.js', base, ['getAppState', 'getOpenid', 'patchAppState',
    'setUserSession', 'markLoginProcessStarted', 'markLoginProcessCompleted']);
  const privacy = load('utils/privacyConsent.js', base, ['hasAcceptedPrivacyConsent',
    'acceptPrivacyConsent', 'runAfterPrivacyConsent', 'PRIVACY_CONSENT_STORAGE_KEY', 'PRIVACY_POLICY_VERSION']);
  if (consentAccepted) storage.set(privacy.PRIVACY_CONSENT_STORAGE_KEY, privacy.PRIVACY_POLICY_VERSION);
  const tcb = {
    async callFunction(options) {
      calls.push(options.name);
      if (options.name === 'getUserProfile') {
        return control.profile || { result: { success: true, userInfo: cachedUser } };
      }
      return { result: { openid: 'viewer' } };
    },
    database() {
      return { collection: () => ({ where: () => ({ get: async () => {
        calls.push('users');
        return control.users || { data: [] };
      } }) }) };
    }
  };
  const appOptions = load('App.vue', {
    ...base, ...state, ...privacy,
    installRuntimeBindings: instance => { instance.$tcb = tcb; },
    ensureTcbAuthenticated: async () => { if (control.auth) await control.auth; },
    ensureRuntimeOpenid: async () => {
      calls.push('ensureRuntimeOpenid');
      state.patchAppState({ openid: 'viewer' });
      return 'viewer';
    },
    refreshAdminStatus: async () => {}
  });
  Object.assign(app, appOptions.data());
  for (const [name, method] of Object.entries(appOptions.methods)) app[name] = method.bind(app);
  app.runWhenPlusReady = () => {};
  app.$nextTick = callback => callback();
  const originalLogin = app.loginAndCheckUser;
  app.loginAndCheckUser = () => { loginTask = originalLogin(); return loginTask; };
  const gate = load('utils/splashGate.js', base, ['createSplashGate', 'SPLASH_MIN_MS']);
  const splashOptions = load('pages/splash/splash.vue', {
    ...base, ...state, ...privacy, ...gate,
    lightImpact() {},
    preloadPoemSquare: async () => {
      preloadCalls++;
      if (control.content) await control.content;
      contentReady = true;
      return { count: 10 };
    },
    hasPoemSquarePreload: () => contentReady,
    retainPoemSquarePreload: () => contentReady
  });
  const page = splashOptions.data();
  for (const [name, method] of Object.entries(splashOptions.methods)) page[name] = method.bind(page);
  const originalWatch = page.watchStartupLoginState;
  page.watchStartupLoginState = () => { loginWatchCalls++; return originalWatch(); };
  const tabOptions = load('custom-tab-bar/index.vue', {
    ...base, lightImpact() {}, requireLogin: options => loginPrompts.push(options.content),
    switchTabSmooth: options => { profileNavigations.push(options.url); options.success(); return true; }
  });
  const tab = tabOptions.data();
  for (const [name, method] of Object.entries(tabOptions.methods)) tab[name] = method.bind(tab);
  tab.selected = 1;
  return { time, app, state, page, storage, calls, navigations, profileNavigations, loginPrompts,
    toasts, control, privacy,
    get preloadCalls() { return preloadCalls; },
    get loginWatchCalls() { return loginWatchCalls; },
    get loginTask() { return loginTask; },
    start() { appOptions.onLaunch.call(app); splashOptions.onLoad.call(page); },
    unload() { splashOptions.onUnload.call(page); },
    clickProfile() { tab.switchTab({ currentTarget: { dataset: { index: 3, path: '/pages/profile/profile' } } }); }
  };
}

async function testSlowProfileBlocksNormalEntry() {
  const user = { _openid: 'viewer', nickName: 'saved' }, profile = deferred();
  const run = runtime({ cachedUser: user });
  run.control.profile = profile.promise;
  run.time.globals.setTimeout(() => profile.resolve({ result: {
    success: true, userInfo: { ...user, nickName: 'latest' }
  } }), 3000);
  run.start();
  await drain();
  assert.equal(run.state.getOpenid(), 'viewer');
  assert.equal(run.page.preloadCompleted, true, '首批内容已准备好');
  assert.equal(run.state.getAppState().isLoggedIn, false);
  await run.time.tick(2999);
  assert.equal(run.navigations.length, 0, '正常进入必须等待完整登录状态，不能只凭openid和首批放行');
  assert.equal(run.page.showEnterButton, true);
  assert.equal(run.page.fadeOut, false);
  await run.time.tick(201);
  assert.equal(run.navigations.length, 1);
  assert.equal(run.navigations[0].elapsedMs, 3200);
  const navigatedState = run.navigations[0].state;
  assert.equal(navigatedState._loginProcessCompleted, true);
  assert.equal(navigatedState._loginProcessFailed, false);
  assert.equal(navigatedState.isLoggedIn, true);
  assert.equal(navigatedState.userInfo.nickName, 'latest', '完整会话先写入再发起导航');
  run.clickProfile();
  assert.deepEqual(run.profileNavigations, ['/pages/profile/profile']);
  assert.equal(run.loginPrompts.length, 0, '进入后立即点真实个人Tab入口不误弹登录');
  assert.deepEqual(run.calls, ['ensureRuntimeOpenid', 'getUserProfile'], '等待不会额外发起登录或资料请求');
  assert.equal(run.preloadCalls, 1);
  assert.equal(run.time.pending(), 0, '完成导航后清理登录等待定时器');
}

async function testUnfinishedLoginUsesHardTimeout() {
  for (const mode of ['late-profile', 'never-profile', 'never-auth']) {
    const user = { _openid: 'viewer', nickName: 'saved' }, pending = deferred();
    const run = runtime({ cachedUser: user });
    if (mode === 'never-auth') run.control.auth = pending.promise;
    else run.control.profile = pending.promise;
    run.start();
    await run.time.tick(5799);
    assert.equal(run.page.preloadCompleted, true);
    assert.equal(run.state.getAppState()._loginProcessCompleted, false);
    assert.equal(run.navigations.length, 0, '未达到兜底时间前不能绕过登录等待');
    assert.equal(run.page.showEnterButton, true);
    await run.time.tick(1);
    assert.equal(run.page.fadeOut, true, '5.8秒开始强制进入淡出');
    assert.equal(run.page.showEnterButton, false);
    const watchCalls = run.loginWatchCalls;
    await run.time.tick(199);
    assert.equal(run.navigations.length, 0);
    assert.equal(run.page.showEnterButton, false, '强制淡出期间等待轮询不能重新显示按钮');
    await run.time.tick(1);
    assert.equal(run.navigations.length, 1);
    assert.equal(run.navigations[0].elapsedMs, 6000, `${mode} 必须保留6秒强制进入`);
    assert.equal(run.navigations[0].state._loginProcessCompleted, false, '超时放行不伪造登录已完成');
    assert.equal(run.loginWatchCalls, watchCalls, '强制离场后停止登录状态轮询');
    assert.equal(run.time.pending(), 0);
    if (mode === 'late-profile') {
      await run.time.tick(1000);
      pending.resolve({ result: { success: true, userInfo: { ...user, nickName: 'late' } } });
      await run.loginTask;
      assert.equal(run.state.getAppState().isLoggedIn, true, '7秒迟到的结果仍正常更新App会话');
      assert.equal(run.state.getAppState().userInfo.nickName, 'late');
      run.clickProfile();
      assert.equal(run.loginPrompts.length, 0);
      assert.deepEqual(run.profileNavigations, ['/pages/profile/profile']);
    }
    await run.time.tick(10000);
    assert.equal(run.navigations.length, 1, '迟到登录结果不重复导航');
    assert.equal(run.loginWatchCalls, watchCalls);
  }
}

async function testReadyLoginStillWaitsForFirstBatch() {
  for (const mode of ['normal', 'late', 'never']) {
    const run = runtime({ cachedUser: { _openid: 'viewer' } }), content = deferred();
    run.control.content = content.promise;
    if (mode === 'normal') run.time.globals.setTimeout(() => content.resolve(), 3000);
    run.start();
    await run.time.tick(2999);
    assert.equal(run.state.getAppState()._loginProcessCompleted, true);
    assert.equal(run.state.getAppState().isLoggedIn, true);
    assert.equal(run.page.preloadCompleted, false);
    assert.equal(run.navigations.length, 0, '登录已好也不能在首批未好时正常自动进入');
    if (mode === 'normal') {
      await run.time.tick(201);
      assert.equal(run.page.preloadCompleted, true);
      assert.equal(run.navigations[0].elapsedMs, 3200, '两项都就绪后正常进入');
    } else {
      await run.time.tick(3000);
      assert.equal(run.navigations.length, 0);
      await run.time.tick(1);
      assert.equal(run.navigations[0].elapsedMs, 6000, '首批挂起仍须6秒强制进入');
      assert.equal(run.page.preloadCompleted, false);
      if (mode === 'late') {
        await run.time.tick(1000);
        content.resolve();
        await drain();
      }
    }
    await run.time.tick(10000);
    assert.equal(run.navigations.length, 1, '首批迟到不会让开屏再次导航');
    assert.equal(run.preloadCalls, 1);
    assert.equal(run.time.pending(), 0);
  }
}

async function testConfirmedGuestCanEnter() {
  const run = runtime(), users = deferred();
  run.control.users = users.promise;
  run.time.globals.setTimeout(() => users.resolve({ data: [] }), 2200);
  run.start();
  await run.time.tick(2199);
  assert.equal(run.navigations.length, 0, '访客也须先完成身份查询');
  await run.time.tick(201);
  assert.equal(run.navigations.length, 1, '明确访客不必isLoggedIn为true也能自动进入');
  assert.equal(run.navigations[0].elapsedMs, 2400);
  assert.equal(run.navigations[0].state._loginProcessFailed, false);
  assert.equal(run.navigations[0].state.isLoggedIn, false);
  assert.equal(run.navigations[0].state.userInfo, null);
  assert.equal(run.loginPrompts.length, 0);
}

async function testFailedRestorationUsesTimeout() {
  const run = runtime(), users = deferred();
  run.control.users = users.promise;
  run.time.globals.setTimeout(() => users.reject(new Error('offline')), 2500);
  run.start();
  await run.time.tick(5799);
  assert.equal(run.state.getAppState()._loginProcessCompleted, true);
  assert.equal(run.state.getAppState()._loginProcessFailed, true);
  assert.equal(run.navigations.length, 0, '失败不冒充确认访客走正常自动进入');
  assert.equal(run.page.loginStateFailed, true);
  assert.equal(run.page.loginStateReady, false);
  assert.equal(run.page.showEnterButton, true, '失败后仍提供显式手动入口');
  await run.time.tick(201);
  assert.equal(run.navigations.length, 1, '失败也不能阻止6秒兜底');
  assert.equal(run.navigations[0].elapsedMs, 6000);
  assert.equal(run.navigations[0].state._loginProcessFailed, true, '强制进入保留真实失败状态');
  assert.equal(run.navigations[0].state.isLoggedIn, false);
  const watchCalls = run.loginWatchCalls;
  await run.time.tick(10000);
  assert.equal(run.navigations.length, 1);
  assert.equal(run.loginWatchCalls, watchCalls);
  assert.equal(run.time.pending(), 0);
}

async function testSavedSessionSurvivesTransientFailure() {
  const user = { _openid: 'viewer', nickName: 'saved' }, profile = deferred();
  const run = runtime({ cachedUser: user });
  run.control.profile = profile.promise;
  run.time.globals.setTimeout(() => profile.reject(new Error('temporary network failure')), 2500);
  run.start();
  await run.time.tick(2700);
  assert.equal(run.navigations.length, 1);
  assert.equal(run.navigations[0].state.isLoggedIn, true);
  assert.equal(run.storage.get('userInfo'), user, '资料验证网络失败不删除保存的会话');
  run.clickProfile();
  assert.equal(run.loginPrompts.length, 0);
  assert.deepEqual(run.profileNavigations, ['/pages/profile/profile']);
}

async function testPrivacyConsentStartsLoginAndWatchTogether() {
  const run = runtime({ consentAccepted: false });
  run.start();
  await run.time.tick(10000);
  assert.equal(run.page.showPrivacyConsent, true);
  assert.equal(run.calls.length, 0, '隐私同意前不启动登录网络请求');
  assert.equal(run.preloadCalls, 0);
  assert.equal(run.loginWatchCalls, 0, '隐私同意前不开启登录等待循环');
  assert.equal(run.time.pending(), 0, '打字完成后没有后台等待定时器');
  assert.equal(run.navigations.length, 0);
  run.page.handlePrivacyConsentAgree();
  await run.time.tick(300);
  assert.deepEqual(run.calls, ['ensureRuntimeOpenid', 'users']);
  assert.equal(run.preloadCalls, 1);
  assert.ok(run.loginWatchCalls > 0);
  assert.equal(run.navigations.length, 1);
}

async function testExplicitExitStopsWaiting() {
  for (const manual of [false, true]) {
    const user = { _openid: 'viewer' }, profile = deferred();
    const run = runtime({ cachedUser: user });
    run.control.profile = profile.promise;
    run.start();
    await run.time.tick(1500);
    assert.equal(run.page.loginStateReady, false);
    if (manual) run.page.handleEnterButtonClick();
    else run.unload();
    assert.equal(run.time.pending(), 0, '手动进入或卸载都停止登录等待');
    const watchCalls = run.loginWatchCalls;
    profile.resolve({ result: { success: true, userInfo: user } });
    await run.loginTask;
    await run.time.tick(10000);
    assert.equal(run.loginWatchCalls, watchCalls, '迟到登录结果不再唤起已离开的开屏');
    assert.equal(run.navigations.length, manual ? 1 : 0);
    if (manual) assert.equal(run.navigations[0].elapsedMs, 1500);
  }
}

async function testLoginResetDuringFadeRestartsWaiting() {
  const run = runtime({ cachedUser: { _openid: 'viewer' } });
  run.start();
  await run.time.tick(1600);
  assert.equal(run.page.fadeOut, true);
  run.state.markLoginProcessStarted();
  await run.time.tick(100);
  assert.equal(run.navigations.length, 0, '淡出期间重新恢复登录不能继续自动进入');
  assert.equal(run.page.fadeOut, false);
  assert.equal(run.page.loginStateReady, false);
  assert.equal(run.page.showEnterButton, true);
  run.app.finishLoginProcess();
  await run.time.tick(300);
  assert.equal(run.navigations.length, 1);
  assert.equal(run.navigations[0].elapsedMs, 2000);
  assert.equal(run.time.pending(), 0);
}

(async () => {
  for (const test of [testSlowProfileBlocksNormalEntry, testUnfinishedLoginUsesHardTimeout,
    testReadyLoginStillWaitsForFirstBatch, testConfirmedGuestCanEnter,
    testFailedRestorationUsesTimeout, testSavedSessionSurvivesTransientFailure,
    testPrivacyConsentStartsLoginAndWatchTogether, testExplicitExitStopsWaiting,
    testLoginResetDuringFadeRestartsWaiting]) {
    await test();
    console.log('PASS ' + test.name);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
