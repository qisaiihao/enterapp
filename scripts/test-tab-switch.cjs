const assert = require('node:assert/strict');
const { load, fakeTime, deferred, drain } = require('./test-splash-startup.cjs');

function nativeRuntime() {
  const time = fakeTime(), captures = [], calls = [], covers = [], bitmaps = [], events = [];
  const source = { route: 'pages/poem-square/poem-square', $getAppWebview: () => ({
    draw: (bitmap, success, fail, options) => captures.push({ success, fail, options }),
    getStyle: () => ({ top: '0px', height: '100%' })
  }) };
  let current = source;
  const plus = { nativeObj: {
    Bitmap: class { constructor() { this.recycled = 0; bitmaps.push(this); } recycle() { this.recycled++; } },
    View: class {
      constructor() { this.closed = 0; this.shown = false; covers.push(this); }
      drawBitmap(bitmap) { this.bitmap = bitmap; }
      show() { this.shown = true; events.push('cover'); }
      close() { this.closed++; }
    }
  } };
  const api = load('utils/appTabTransition.js', { ...time.globals, plus,
    getCurrentPages: () => [current], uni: { switchTab: options => { events.push('navigate'); calls.push(options); } }
  }, ['switchTabSmooth', 'cancelTabTransition', 'appTabTransitionMixin']);
  const target = { route: 'pages/mountain/mountain', $nextTick: fn => Promise.resolve().then(fn) };
  return { ...api, time, captures, calls, covers, bitmaps, events, source, target, setPage: page => { current = page; } };
}

async function testNativeTransition() {
  for (const readyFirst of [true, false]) {
    const app = nativeRuntime();
    app.switchTabSmooth({ url: '/pages/mountain/mountain' });
    assert.equal(app.calls.length, 0, '截图期间保留原页');
    assert.equal(app.captures[0].options.check, true, '空白截图不可用作过渡');
    app.captures[0].success();
    assert.deepEqual(app.events, ['cover', 'navigate'], '原生覆盖层先于窗口切换显示');
    assert.equal(app.switchTabSmooth({ url: '/pages/index/index' }), false, '切换期间忽略连点');
    app.setPage(app.target);
    if (readyFirst) app.appTabTransitionMixin.onReady.call(app.target);
    else app.calls[0].success({});
    await app.time.tick(150);
    assert.equal(app.covers[0].closed, 0, '必须同时等到导航成功及页面首帧就绪');
    if (readyFirst) app.calls[0].success({});
    else app.appTabTransitionMixin.onReady.call(app.target);
    await app.time.tick(79);
    assert.equal(app.covers[0].closed, 0);
    await app.time.tick(1);
    assert.equal(app.covers[0].closed, 1);
    assert.equal(app.bitmaps[0].recycled, 1);
    assert.equal(app.time.pending(), 0);
  }
  const reused = nativeRuntime();
  reused.appTabTransitionMixin.onReady.call(reused.target);
  reused.switchTabSmooth({ url: '/pages/mountain/mountain' });
  reused.captures[0].success(); reused.setPage(reused.target);
  reused.appTabTransitionMixin.onShow.call(reused.target);
  reused.calls[0].success({});
  await reused.time.tick(80);
  assert.equal(reused.covers[0].closed, 1, '再次进入已挂载 Tab 使用 onShow，不等待第二次 onReady');
}

async function testNativeFallbackAndCleanup() {
  for (const mode of ['capture-fail', 'capture-timeout', 'navigation-fail', 'ready-timeout', 'app-hide', 'source-changed']) {
    const app = nativeRuntime();
    let failures = 0;
    app.switchTabSmooth({ url: '/pages/mountain/mountain', fail: () => failures++ });
    if (mode === 'capture-fail') app.captures[0].fail();
    else if (mode === 'capture-timeout') await app.time.tick(100);
    else if (mode === 'source-changed') { app.setPage({ route: 'pages/login/login' }); app.captures[0].success(); }
    else {
      app.captures[0].success();
      if (mode === 'navigation-fail') app.calls[0].fail({});
      if (mode === 'app-hide') app.cancelTabTransition();
    }
    await app.time.tick(1500);
    app.captures[0].success(); // 迟到截图不能重新盖住页面或二次导航。
    assert.equal(app.calls.length, mode === 'source-changed' ? 0 : 1);
    assert.equal(app.covers.length, ['capture-fail', 'capture-timeout', 'source-changed'].includes(mode) ? 0 : 1);
    assert.equal(app.bitmaps[0].recycled, 1);
    if (app.covers.length) assert.equal(app.covers[0].closed, 1);
    assert.equal(failures, mode === 'navigation-fail' ? 1 : 0);
    assert.equal(app.time.pending(), 0, '异常路径释放图片、原生视图和所有定时器');
  }
  let calls = 0;
  const api = load('utils/appTabTransition.js', { uni: { switchTab() { calls++; } } }, ['switchTabSmooth']);
  api.switchTabSmooth({ url: '/pages/index/index' });
  assert.equal(calls, 1, '无原生能力时直接使用平台路由，不增加等待');
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
  for (const test of [testNativeTransition, testNativeFallbackAndCleanup, testCachedFirstFrame]) {
    await test(); console.log('PASS ' + test.name);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
