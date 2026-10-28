const assert = require('node:assert/strict');
const { load, fakeTime, deferred, drain } = require('./test-splash-startup.cjs');

function nativeRuntime({ theme = 'light', sourceStyle = { top: '0px', height: '100%' }, coverVisible = true } = {}) {
  const time = fakeTime(), captures = [], probes = [], calls = [], covers = [], bitmaps = [], events = [];
  const control = { coverVisible };
  const sourceWebview = {
    draw: (bitmap, success, fail, options) => captures.push({ bitmap, success, fail, options }),
    getStyle: () => sourceStyle
  };
  const targetWebview = {
    draw: (bitmap, success, fail, options) => probes.push({ bitmap, success, fail, options }),
    getStyle: () => ({ top: '0px', height: '100%' })
  };
  const source = { route: 'pages/poem-square/poem-square', appThemeMode: theme, $getAppWebview: () => sourceWebview };
  let current = source;
  const plus = { nativeObj: {
    Bitmap: class { constructor(id) { this.id = id; this.recycled = 0; bitmaps.push(this); } recycle() { this.recycled++; } },
    View: class {
      constructor(id, style) { this.id = id; this.style = style; this.closed = 0; this.shown = false; this.texts = []; covers.push(this); }
      drawBitmap(bitmap) { this.bitmap = bitmap; }
      drawText(text, position, style) { this.texts.push({ text, position, style }); }
      show() { this.shown = true; events.push('cover'); }
      isVisible() { return this.shown && control.coverVisible; }
      close() { this.closed++; }
    }
  } };
  const api = load('utils/appTabTransition.js', { ...time.globals, plus,
    getThemeMode: () => theme,
    getThemeVars: () => ({ '--app-page-bg': theme === 'dark' ? '#0f1115' : '#ffffff' }),
    getCurrentPages: () => [current], uni: { switchTab: options => { events.push('navigate'); calls.push(options); } }
  }, ['switchTabSmooth', 'cancelTabTransition', 'appTabTransitionMixin']);
  const target = { route: 'pages/mountain/mountain', $getAppWebview: () => targetWebview, $nextTick: fn => Promise.resolve().then(fn) };
  return { ...api, time, captures, probes, calls, covers, bitmaps, events, source, target, control, setPage: page => { current = page; } };
}

function assertNativeReleased(app) {
  for (const cover of app.covers) assert.equal(cover.closed, 1, '覆盖层只能关闭一次');
  for (const bitmap of app.bitmaps) assert.equal(bitmap.recycled, 1, '源截图与目标检测图都只回收一次');
  assert.equal(app.time.pending(), 0, '释放截图、显示确认、探测、绘制及总预算定时器');
}

async function startColdNavigation(app, options = {}) {
  app.switchTabSmooth({ url: '/pages/mountain/mountain', ...options });
  app.captures.at(-1).success();
  await app.time.tick(16);
  app.setPage(app.target);
}

async function readyColdTarget(app) {
  app.appTabTransitionMixin.onReady.call(app.target);
  app.calls.at(-1).success({});
  await drain();
  assert.equal(app.probes.at(-1).options.check, true, '检测目标原生首帧时必须启用空白检查');
}

async function testNativeTransition() {
  for (const readyFirst of [true, false]) {
    const app = nativeRuntime();
    app.switchTabSmooth({ url: '/pages/mountain/mountain' });
    assert.equal(app.calls.length, 0, '截图期间保留原页');
    assert.equal(app.captures[0].options.check, true, '空白截图不可用作过渡');
    app.captures[0].success();
    assert.deepEqual(app.events, ['cover'], '显示覆盖层后先让出原生绘制调度，不在同一栈中导航');
    await app.time.tick(15);
    assert.equal(app.calls.length, 0);
    await app.time.tick(1);
    assert.deepEqual(app.events, ['cover', 'navigate'], '原生覆盖层确认显示后才能切换窗口');
    assert.equal(app.switchTabSmooth({ url: '/pages/index/index' }), false, '切换期间忽略连点');
    app.setPage(app.target);
    if (readyFirst) app.appTabTransitionMixin.onReady.call(app.target);
    else app.calls[0].success({});
    await app.time.tick(150);
    assert.equal(app.covers[0].closed, 0, '必须同时等到导航成功及页面生命周期就绪');
    assert.equal(app.probes.length, 0, '缺少任一信号时不可开始首帧探测');
    if (readyFirst) app.calls[0].success({});
    else app.appTabTransitionMixin.onReady.call(app.target);
    await app.time.tick(150);
    assert.equal(app.probes.length, 1);
    assert.equal(app.probes[0].options.check, true);
    assert.equal(app.covers[0].closed, 0, 'onReady、nextTick 和固定等待都不能代替原生首帧确认');
    app.probes[0].success();
    await app.time.tick(31);
    assert.equal(app.covers[0].closed, 0, '原生截图完成后保留一次短绘制交接');
    await app.time.tick(1);
    assertNativeReleased(app);
    app.setPage(app.source);
    app.switchTabSmooth({ url: '/pages/mountain/mountain' });
    assert.equal(app.captures.length, 1, '首帧已确认的目标再次进入直接使用 warm 路径');
    assert.equal(app.calls.length, 2);
    app.cancelTabTransition();
  }
  const reused = nativeRuntime();
  reused.appTabTransitionMixin.onReady.call(reused.target);
  reused.switchTabSmooth({ url: '/pages/mountain/mountain' });
  assert.equal(reused.captures.length, 0, '已就绪 Tab 不截图，不冻结按压动画');
  assert.equal(reused.calls.length, 1, '已就绪 Tab 同步发起导航');
  assert.equal(reused.covers.length, 0);
  assert.equal(reused.bitmaps.length, 0);
  assert.equal(reused.probes.length, 0, 'warm 路径也不对目标做截图检查');
  assert.equal(reused.switchTabSmooth({ url: '/pages/index/index' }), false, '直接切换同样防止并发导航');
  reused.setPage(reused.target);
  reused.appTabTransitionMixin.onShow.call(reused.target);
  reused.calls[0].success({});
  await drain();
  assert.equal(reused.time.pending(), 0, 'onShow + nextTick 后立即结束，不增加绘制等待');
  reused.setPage(reused.source);
  reused.switchTabSmooth({ url: '/pages/mountain/mountain' });
  assert.equal(reused.calls.length, 2, '已释放直接切换的导航锁');
  reused.cancelTabTransition();
}

async function testReadyPageLifetime() {
  const unloaded = nativeRuntime();
  unloaded.appTabTransitionMixin.onReady.call(unloaded.target);
  unloaded.appTabTransitionMixin.onUnload.call(unloaded.target);
  unloaded.switchTabSmooth({ url: '/pages/mountain/mountain' });
  assert.equal(unloaded.captures.length, 1, '卸载后必须恢复首次打开的防白屏保护');
  unloaded.cancelTabTransition();

  const replaced = nativeRuntime();
  replaced.appTabTransitionMixin.onReady.call(replaced.target);
  const newPage = { ...replaced.target };
  replaced.appTabTransitionMixin.onReady.call(newPage);
  replaced.appTabTransitionMixin.onUnload.call(replaced.target);
  replaced.switchTabSmooth({ url: '/pages/mountain/mountain' });
  assert.equal(replaced.captures.length, 0, '旧实例迟到卸载不能移除同路由新实例的就绪记录');
  replaced.cancelTabTransition();

  const nativeVm = nativeRuntime();
  const vm = { $nextTick: fn => Promise.resolve().then(fn) };
  nativeVm.setPage({ route: 'pages/mountain/mountain', $vm: vm });
  nativeVm.appTabTransitionMixin.onReady.call(vm);
  nativeVm.setPage(nativeVm.source);
  nativeVm.switchTabSmooth({ url: '/pages/mountain/mountain' });
  assert.equal(nativeVm.captures.length, 0, '页面 VM 没有 route 时读取对应原生页面的路由');
  nativeVm.cancelTabTransition();

  for (const phase of ['before-ready', 'before-nextTick']) {
    const app = nativeRuntime();
    await startColdNavigation(app);
    app.calls[0].success({});
    if (phase === 'before-nextTick') app.appTabTransitionMixin.onReady.call(app.target);
    app.appTabTransitionMixin.onUnload.call(app.target);
    await drain();
    assertNativeReleased(app);
    assert.equal(app.probes.length, 0, '首帧就绪之前卸载的目标，迟到 nextTick 不得启动探测');
    app.setPage(app.source);
    app.switchTabSmooth({ url: '/pages/mountain/mountain' });
    assert.equal(app.captures.length, 2, '未完成首帧的已卸载页面保持 cold 状态');
    app.cancelTabTransition();
    assertNativeReleased(app);
  }
}

async function testWarmCallbackOrderAndTimeout() {
  const app = nativeRuntime();
  app.appTabTransitionMixin.onReady.call(app.target);
  app.switchTabSmooth({ url: '/pages/mountain/mountain' });
  app.calls[0].success({});
  await drain();
  assert.equal(app.switchTabSmooth({ url: '/pages/index/index' }), false, '路由成功仍需目标 onShow 完成后再释放导航锁');
  app.setPage(app.target);
  app.appTabTransitionMixin.onShow.call(app.target);
  await drain();
  assert.equal(app.time.pending(), 0, '成功先于 onShow 时同样无额外绘制延迟');

  app.setPage(app.source);
  let failures = 0;
  app.switchTabSmooth({ url: '/pages/mountain/mountain', fail: () => failures++ });
  await app.time.tick(1200);
  assert.equal(failures, 1, '直接切换也有超时兜底');
  assert.equal(app.captures.length, 0);
  app.switchTabSmooth({ url: '/pages/mountain/mountain' });
  assert.equal(app.calls.length, 3, '超时后可重新导航');
  app.cancelTabTransition();
  assert.equal(app.time.pending(), 0);
}

async function testColdCaptureFallback() {
  for (const theme of ['light', 'dark']) {
    for (const mode of ['capture-fail', 'capture-timeout']) {
      const app = nativeRuntime({ theme });
      app.switchTabSmooth({ url: '/pages/mountain/mountain' });
      if (mode === 'capture-fail') app.captures[0].fail();
      else {
        await app.time.tick(349);
        assert.equal(app.covers.length, 0, '冷截图拥有完整预算，不在 100ms 时提前放弃');
        assert.equal(app.calls.length, 0);
        await app.time.tick(1);
      }
      assert.equal(app.covers.length, 1, '截图失败或超时仍有原生兜底覆盖层');
      assert.equal(app.covers[0].style.backgroundColor.toLowerCase(), theme === 'dark' ? '#0f1115' : '#ffffff');
      assert.equal(app.covers[0].texts[0].text, '正在打开…', '兜底罩提供原生加载文案');
      assert.equal(app.calls.length, 0, '兜底罩也需要先显示再切页');
      app.captures[0].success();
      app.captures[0].fail();
      assert.equal(app.covers.length, 1, '迟到源截图不得重建或替换正在显示的兜底罩');
      await app.time.tick(16);
      assert.equal(app.calls.length, 1);
      app.setPage(app.target);
      await readyColdTarget(app);
      app.probes[0].success();
      await app.time.tick(32);
      assertNativeReleased(app);
    }
  }
  const slow = nativeRuntime();
  slow.switchTabSmooth({ url: '/pages/mountain/mountain' });
  await slow.time.tick(340);
  slow.captures[0].success();
  assert.equal(slow.covers[0].bitmap, slow.bitmaps[0], '预算内慢截图仍可作为过渡帧');
  assert.equal(slow.covers[0].texts.length, 0);
  await slow.time.tick(16);
  assert.equal(slow.calls.length, 1);
  slow.cancelTabTransition();
  assertNativeReleased(slow);
}

async function testCoverVisibilityAndGeometry() {
  const app = nativeRuntime({ theme: 'dark', sourceStyle: { top: '24px', left: '0px', bottom: '12px', width: '100%' }, coverVisible: false });
  app.switchTabSmooth({ url: '/pages/mountain/mountain' });
  app.captures[0].success();
  assert.equal(app.covers[0].style.top, '24px');
  assert.equal(app.covers[0].style.bottom, '12px', '保留源 WebView 的底部安全区域约束');
  assert.equal(app.covers[0].style.height, undefined, 'top/bottom 布局不能被默认 100% 高度覆盖');
  assert.equal(app.covers[0].style.backgroundColor, '#0f1115', '快照罩也使用主题底色，避免默认白背景');
  await app.time.tick(48);
  assert.equal(app.calls.length, 0, '原生覆盖层仍不可见时保留源页面');
  app.control.coverVisible = true;
  await app.time.tick(16);
  assert.equal(app.calls.length, 1);
  app.cancelTabTransition();
  assertNativeReleased(app);

  const invisible = nativeRuntime({ coverVisible: false });
  invisible.switchTabSmooth({ url: '/pages/mountain/mountain' });
  invisible.captures[0].success();
  await invisible.time.tick(159);
  assert.equal(invisible.calls.length, 0);
  await invisible.time.tick(1);
  assert.equal(invisible.calls.length, 1, '覆盖层持续无法显示时按预算降级，不能锁死导航');
  invisible.cancelTabTransition();
  assertNativeReleased(invisible);
}

async function testNativeFrameProbe() {
  const retry = nativeRuntime();
  await startColdNavigation(retry);
  await readyColdTarget(retry);
  retry.probes[0].fail({ message: 'blank frame' });
  await retry.time.tick(63);
  assert.equal(retry.probes.length, 1);
  assert.equal(retry.covers[0].closed, 0, '目标帧为空时继续遮住原生白屏');
  await retry.time.tick(1);
  assert.equal(retry.probes.length, 2, '空帧后按间隔重试，不能退化成定时撤罩');
  retry.probes[1].success();
  await retry.time.tick(32);
  assertNativeReleased(retry);
  const probeCount = retry.probes.length;
  retry.probes[0].fail({}); retry.probes[0].success(); retry.probes[1].success();
  await retry.time.tick(3000);
  assert.equal(retry.probes.length, probeCount, '已结束的迟到探测回调不能重启检测');
  assertNativeReleased(retry);

  const pending = nativeRuntime();
  await startColdNavigation(pending);
  await readyColdTarget(pending);
  await pending.time.tick(1200);
  assert.equal(pending.covers[0].closed, 0, '冷转场不沿用 warm 的 1200ms 提前撤罩');
  await pending.time.tick(1200);
  assertNativeReleased(pending);
  pending.probes[0].success(); pending.probes[0].fail({});
  pending.setPage(pending.source);
  pending.switchTabSmooth({ url: '/pages/mountain/mountain' });
  assert.equal(pending.captures.length, 2, 'onReady 后探测一直挂起的页面不得被误记为已绘制');
  assert.equal(pending.calls.length, 1);
  pending.cancelTabTransition();
  assertNativeReleased(pending);

  const lateReady = nativeRuntime();
  await startColdNavigation(lateReady);
  lateReady.calls[0].success({});
  await lateReady.time.tick(2400);
  assertNativeReleased(lateReady);
  lateReady.appTabTransitionMixin.onReady.call(lateReady.target);
  await drain();
  lateReady.setPage(lateReady.source);
  lateReady.switchTabSmooth({ url: '/pages/mountain/mountain' });
  assert.equal(lateReady.captures.length, 2, '超时之后迟到的 onReady 也不能把未验证的冷页面登记为 warm');
  lateReady.cancelTabTransition();
  assertNativeReleased(lateReady);
}

async function testNativeFallbackAndCleanup() {
  for (const mode of ['navigation-fail', 'ready-timeout', 'app-hide', 'source-changed']) {
    const app = nativeRuntime();
    let failures = 0;
    app.switchTabSmooth({ url: '/pages/mountain/mountain', fail: () => failures++ });
    if (mode === 'source-changed') {
      app.setPage({ route: 'pages/login/login' });
      app.captures[0].success();
    } else {
      app.captures[0].success();
      await app.time.tick(16);
      if (mode === 'navigation-fail') app.calls[0].fail({});
      if (mode === 'app-hide') app.cancelTabTransition();
    }
    await app.time.tick(2600);
    app.captures[0].success(); app.captures[0].fail();
    assert.equal(app.calls.length, mode === 'source-changed' ? 0 : 1);
    assert.equal(app.covers.length, mode === 'source-changed' ? 0 : 1);
    assert.equal(failures, 1, '取消、导航失败和超时均通知调用方释放按钮导航锁');
    assertNativeReleased(app);
  }
  for (const mode of ['app-hide', 'target-unload', 'route-replaced']) {
    const app = nativeRuntime();
    await startColdNavigation(app);
    await readyColdTarget(app);
    if (mode === 'app-hide') app.cancelTabTransition();
    if (mode === 'target-unload') app.appTabTransitionMixin.onUnload.call(app.target);
    if (mode === 'route-replaced') {
      const other = { route: 'pages/login/login' };
      app.setPage(other);
      app.appTabTransitionMixin.onShow.call(other);
      assert.equal(app.covers[0].closed, 1, '其它页面已显示时立即撤罩，不依赖挂起探测返回');
    }
    app.probes[0].success(); app.probes[0].fail({});
    await app.time.tick(32);
    assertNativeReleased(app);
    app.setPage(app.source);
    app.switchTabSmooth({ url: '/pages/mountain/mountain' });
    assert.equal(app.captures.length, 2, '取消、卸载或路由替换后迟到检测不能登记 warm 页面');
    app.cancelTabTransition();
    assertNativeReleased(app);
  }
  let calls = 0;
  const api = load('utils/appTabTransition.js', { uni: { switchTab() { calls++; } } }, ['switchTabSmooth']);
  api.switchTabSmooth({ url: '/pages/index/index' });
  assert.equal(calls, 1, '无原生能力时直接使用平台路由，不增加等待');

  for (const warm of [true, false]) {
    const app = nativeRuntime();
    let successes = 0, failures = 0;
    if (warm) app.appTabTransitionMixin.onReady.call(app.target);
    app.switchTabSmooth({ url: '/pages/mountain/mountain', success: () => successes++, fail: () => failures++ });
    if (!warm) { app.captures[0].success(); await app.time.tick(16); }
    app.calls[0].success({});
    app.cancelTabTransition();
    app.calls[0].fail({});
    await app.time.tick(2600);
    assert.equal(successes, 1);
    assert.equal(failures, 0, '成功后的清理与迟到失败不应回滚已完成的选中项');
    assert.equal(app.time.pending(), 0);
  }

  const cancelled = nativeRuntime();
  let callbacks = 0;
  cancelled.switchTabSmooth({ url: '/pages/mountain/mountain', success: () => callbacks++, fail: () => callbacks++ });
  cancelled.captures[0].success();
  await cancelled.time.tick(16);
  cancelled.cancelTabTransition(); cancelled.cancelTabTransition();
  cancelled.calls[0].success({}); cancelled.calls[0].fail({});
  assert.equal(callbacks, 1, '取消和迟到路由回调只完成一次');
  assertNativeReleased(cancelled);
}

async function testTabBarActions() {
  for (const native of [false, true]) {
    const time = fakeTime(), calls = [], storage = new Map();
    let component, loggedIn = true, prompts = 0, refreshes = 0, mode = 'normal';
    const navigate = options => {
      if (mode === 'throw') throw Error('navigation unavailable');
      if (mode === 'reject') return false;
      calls.push(options);
    };
    const platform = {
      setStorageSync: (key, value) => storage.set(key, value),
      switchTab: navigate, vibrateShort() {}, showModal: () => prompts++
    };
    const globals = { ...time.globals, uni: platform, wx: platform,
      getApp: () => ({ globalData: { isLoggedIn: loggedIn } }),
      lightImpact() {}, requireLogin: () => prompts++, switchTabSmooth: navigate,
      Component: options => { component = options; } };
    if (native) load('custom-tab-bar/index.js', globals);
    else component = load('custom-tab-bar/index.vue', globals);
    const values = native ? { ...component.data } : component.data();
    const instance = native ? { data: values } : values;
    instance.setData = partial => Object.assign(values, partial);
    for (const [name, method] of Object.entries(component.methods)) instance[name] = method.bind(instance);
    instance.refreshCurrentPage = () => refreshes++;
    const tap = index => instance.switchTab({ currentTarget: { dataset: { index, path: values.list[index].pagePath } } });
    tap(0);
    assert.equal(calls.length, 0, '当前页单击不重复导航');
    await time.tick(100); tap(0);
    assert.equal(refreshes, 1, '当前页双击仍可刷新');
    tap(1); tap(1); tap(2);
    assert.equal(calls.length, 1, '切换期间重复或其他 tab 点击不并发导航');
    assert.equal(refreshes, 1, '切换期间连点不误刷新源页');
    calls[0].fail({});
    assert.equal(values.selected, 0);
    assert.equal(storage.get('currentTabIndex'), 0, '导航失败恢复缓存选中项');
    assert.equal(instance._switchingTab, false);
    mode = 'throw'; tap(1);
    assert.equal(values.selected, 0, '同步异常恢复选中项');
    assert.equal(instance._switchingTab, false);
    if (!native) {
      mode = 'reject'; tap(1);
      assert.equal(values.selected, 0, '过渡控制器拒绝并发导航时恢复选中项');
      assert.equal(instance._switchingTab, false);
    }
    mode = 'normal'; tap(1); calls[1].success({});
    tap(1);
    assert.equal(refreshes, 1, '切入页面后的第一次点击不与导航动作组成双击');
    await time.tick(100); tap(1);
    assert.equal(refreshes, 2);
    loggedIn = false; tap(3);
    assert.equal(prompts, 1, '未登录的个人页仍拦截并提示');
    assert.equal(calls.length, 2);
    assert.equal(values.selected, 1, '登录提示不改变选中页');
  }
}

async function testCachedFirstFrame() {
  const time = fakeTime(), storage = new Map();
  const base = { ...time.globals, uni: { getStorageSync: key => storage.get(key),
    setStorageSync: (key, value) => storage.set(key, value), removeStorageSync: key => storage.delete(key),
    hideTabBar() {}, showToast() { throw Error('unexpected toast'); } } };
  const cacheManager = load('cache/core/manager.js', base);
  const { buildCacheKey } = load('cache/core/key-builder.js', base, ['buildCacheKey']);
  const { withTimeout } = load('utils/asyncTimeout.js', base, ['withTimeout']);
  const poems = load('api-cache/poems.js', { ...base, cacheManager, buildCacheKey }, ['peekMountainPoems']);
  const home = load('api-cache/home-posts.js', { ...base, cacheManager, buildCacheKey, withTimeout }, ['peekHomePosts', 'getHomePosts']);
  const posts = [{ _id: 'one', content: '已缓存' }];
  const ns = cacheManager.namespace('posts:list');
  const mountainKey = buildCacheKey({ page: 0, pageSize: 10, isPoem: true, isOriginal: false, excludeAnonymous: true });
  const homeKey = buildCacheKey({ page: 0, pageSize: 10, isPoem: false, isDiscussion: false });
  ns.set(mountainKey, posts, { ttlMs: 90000 });
  ns.set(homeKey, posts, { ttlMs: 90000 });
  const mountain = load('pages/mountain/mountain.vue', { ...base, ...poems });
  const page = { selectedPoetName: null, setData(value) { Object.assign(this, value); },
    normalizePoemCardPost(post) { post.isExpanded = false; return post; }, syncLikeStatusFromCache() {},
    getPostList() { throw Error('cached mountain must not fetch'); } };
  let callback = 0;
  mountain.methods.getIndexData.call(page, () => callback++);
  assert.equal(page.isLoading, false, '缓存命中同步显示山诗，不先清空内容');
  assert.equal(page.postList.length, 1);
  assert.equal(page.page, 1); assert.equal(page.hasMore, false); assert.equal(callback, 1);
  assert.equal(posts[0].isExpanded, undefined, '页面格式化不改写源缓存');
  assert.equal(poems.peekMountainPoems({ filterByPoet: '其他诗人' }), undefined, '筛选诗人不使用全部山诗缓存');
  ns.set(mountainKey, [], { ttlMs: 90000 });
  mountain.methods.getIndexData.call(page);
  assert.equal(page.postList.length, 0); assert.equal(page.isLoading, false);

  const processing = deferred();
  const index = load('pages/index/index.vue', { ...base, ...home, cacheManager,
    processPostListSync: list => list.map(post => ({ ...post })), processPostList: () => processing.promise });
  const indexPage = { showNormalPostsOnly: true, setData(value) { Object.assign(this, value); } };
  index.methods.getIndexData.call(indexPage);
  assert.equal(indexPage.isLoading, false, '首页首帧不等待异步图片地址转换');
  assert.equal(indexPage.homeHasEverLoaded, true);
  assert.equal(indexPage.postList[0]._id, 'one');
  await drain();
  assert.equal(indexPage.postList.length, 1, '异步处理未完成时保留缓存内容');
  processing.resolve(posts); await drain();
  assert.equal(indexPage.page, 1);
  assert.equal(home.peekHomePosts(), undefined, '只看普通帖与全部帖子缓存隔离');
  await time.tick(90001);
  assert.equal(home.peekHomePosts({ isPoem: false, isDiscussion: false }), undefined, '首帧只接受新鲜缓存');
}

(async () => {
  for (const test of [testNativeTransition, testReadyPageLifetime, testWarmCallbackOrderAndTimeout, testColdCaptureFallback, testCoverVisibilityAndGeometry, testNativeFrameProbe, testNativeFallbackAndCleanup, testTabBarActions, testCachedFirstFrame]) {
    await test(); console.log('PASS ' + test.name);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
