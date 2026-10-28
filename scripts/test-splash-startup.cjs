const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parse } = require('@babel/parser');
const root = path.join(__dirname, '..');
const quiet = { log() {}, info() {}, warn() {}, error() {} };

function load(file, globals = {}, exports = []) {
  let source = fs.readFileSync(path.join(root, file), 'utf8');
  if (file.endsWith('.vue')) source = source.match(/<script>([\s\S]*?)<\/script>/)[1];
  const imports = {};
  for (const node of parse(source, { sourceType: 'module' }).program.body.reverse()) {
    if (node.type === 'ImportDeclaration') {
      node.specifiers.forEach(spec => { imports[spec.local.name] = {}; });
      source = source.slice(0, node.start) + source.slice(node.end);
    } else if (node.type === 'ExportNamedDeclaration') {
      source = source.slice(0, node.start) + source.slice(node.declaration ? node.declaration.start : node.end);
    } else if (node.type === 'ExportDefaultDeclaration') {
      source = source.slice(0, node.start) + 'module.exports = ' + source.slice(node.declaration.start);
    }
  }
  if (exports.length) source += `\nmodule.exports = { ${exports.join(', ')} };`;
  const scope = { ...imports, console: quiet, ...globals, module: { exports: {} } };
  vm.runInNewContext(source, scope, { filename: file });
  return scope.module.exports;
}
const drain = async () => { for (let i = 0; i < 40; i++) await Promise.resolve(); };
function fakeTime() {
  let now = 10000, seq = 0;
  const timers = new Map();
  return {
    globals: {
      Date: { now: () => now },
      setTimeout: (fn, ms = 0) => { const id = ++seq; timers.set(id, { fn, at: now + ms }); return id; },
      clearTimeout: id => timers.delete(id)
    },
    now: () => now,
    async tick(ms) {
      await drain();
      const end = now + ms;
      for (;;) {
        const next = [...timers].filter(([, task]) => task.at <= end).sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
        if (!next) break;
        now = next[1].at;
        timers.delete(next[0]);
        next[1].fn();
        await drain();
      }
      now = end;
      await drain();
    },
    pending: () => timers.size
  };
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

async function testGate() {
  for (const [readyAt, expectedAt, reason] of [[0, 1700, 'ready'], [3000, 3200, 'ready'], [5800, 6000, 'timeout'], [Infinity, 6000, 'timeout']]) {
    const time = fakeTime(), events = [];
    const { createSplashGate } = load('utils/splashGate.js', time.globals, ['createSplashGate']);
    const gate = createSplashGate({ onLeaving: e => events.push(['leave', e]), onNavigate: e => events.push(['navigate', e]) });
    if (readyAt !== Infinity) {
      await time.tick(readyAt);
      gate.settle(); gate.settle();
    }
    await time.tick(10000);
    assert.equal(events.length, 2);
    assert.equal(events[1][1].elapsedMs, expectedAt);
    assert.equal(events[1][1].reason, reason);
    assert.equal(time.pending(), 0);
  }
  const time = fakeTime();
  const { createSplashGate } = load('utils/splashGate.js', time.globals, ['createSplashGate']);
  let navigations = 0;
  const gate = createSplashGate({ onLeaving() {}, onNavigate: () => navigations++ });
  gate.settle(); gate.dispose(); gate.skip();
  await time.tick(10000);
  assert.equal(navigations, 0, '卸载后不跳转');
  const manual = createSplashGate({ onLeaving() {}, onNavigate: () => navigations++ });
  manual.skip(); manual.skip(); manual.settle();
  assert.equal(navigations, 1, '手动跳过同步导航，不再等待淡出');
  await time.tick(10000);
  assert.equal(navigations, 1, '连点和迟到响应只能跳转一次');
}

function runtime({ count = 10, signature = true } = {}) {
  const time = fakeTime(), storage = new Map(), calls = [], images = [], backgroundStarts = [], toasts = [];
  let account = 'viewer';
  const control = { cloud: null, auth: null, image: null };
  const uni = {
    getStorageSync: key => storage.get(key), setStorageSync: (key, value) => storage.set(key, value),
    removeStorageSync: key => storage.delete(key),
    getImageInfo: ({ src, success }) => {
      images.push(src);
      if (control.image) control.image.then(() => success({ path: '/local/signature.png' }));
      else success({ path: '/local/signature.png' });
    },
    $on() {}, $off() {}, hideTabBar() {}, showToast: options => toasts.push(options.title)
  };
  const base = { ...time.globals, uni, getAppState: () => ({ _loginProcessCompleted: true }) };
  const cacheManager = load('cache/core/manager.js', base);
  const { withTimeout } = load('utils/asyncTimeout.js', base, ['withTimeout']);
  const { buildCacheKey } = load('cache/core/key-builder.js', base, ['buildCacheKey']);
  const refreshFlags = load('utils/refresh-flags.js', base);
  const api = load('api-cache/post-list.js', {
    ...base, cacheManager, buildCacheKey, withTimeout,
    callCloudAndUnwrap: async (name, payload, options) => {
      calls.push({ name, payload, options });
      if (control.cloud) return control.cloud;
      return { posts: Array.from({ length: count }, (_, i) => ({
        _id: `p${i}`, content: '测试诗歌', authorSignature: signature && i < 2 ? `cloud://signature-${i}` : '', votes: 0
      })) };
    }
  }, ['getPostList', 'invalidatePostList', 'invalidateAllPostList']);
  const poems = load('api-cache/poems.js', { ...base, cacheManager, buildCacheKey, getPostList: api.getPostList },
    ['getOriginalPoems', 'peekOriginalPoems', 'getOriginalPoemsVersion', 'invalidateFollowingPoems', 'ORIGINAL_POEMS_PAGE_SIZE']);
  const service = load('utils/splashPreload.js', {
    ...base, ...api, ...poems, ...refreshFlags, withTimeout, getOpenid: () => account,
    ensureRuntimeOpenid: async () => { if (control.auth) await control.auth; account = 'viewer'; return account; },
    fileUrlCache: { getTempUrls: async ids => Object.fromEntries(ids.map(id => [id, 'https://img/' + id])) }
  }, ['preloadPoemSquare', 'takePoemSquarePreload', 'hasPoemSquarePreload', 'retainPoemSquarePreload', 'consumePoemSquareRefresh']);
  function square() {
    const options = load('pages/poem-square/poem-square.vue', {
      ...base, ...api, ...poems, ...service, cacheManager, formatErrorForLog: String,
      updateTabBarStatus() {}, getSquareBubbleConfig: async () => ({ enabled: false, text: '', target: 'weekly' }),
      scheduleTabPreload: () => backgroundStarts.push(time.now()),
      activityBadge: { getHasNewActivity: () => false, subscribe: () => () => {}, refreshActivityBadge() {} },
      replayBuiltinHuiwenFontReady() {}, getLatestLikeStatus: () => null,
      attachPoemDisplayFields: post => ({ displayContent: post.content, displayHighlightLines: [], displaySeriesPoems: [] }),
      generateRandomBackgroundColor: () => ({ index: 0, color: '#fff' }), likeIcon: { getLikeIcon: () => '/like.png' }
    });
    const page = options.data();
    for (const [name, fn] of Object.entries(options.methods)) page[name] = fn.bind(page);
    page.applyLocalState = partial => Object.assign(page, partial);
    page.debugSafeArea = () => {};
    page.syncLikeStatusFromCache = () => {};
    return { page, options };
  }
  function splash() {
    const navigations = [];
    const { createSplashGate, SPLASH_MIN_MS } = load('utils/splashGate.js', base, ['createSplashGate', 'SPLASH_MIN_MS']);
    const options = load('pages/splash/splash.vue', {
      ...base, ...service, createSplashGate, SPLASH_MIN_MS, lightImpact() {}, formatErrorForLog: String,
      hasAcceptedPrivacyConsent: () => true, acceptPrivacyConsent() {},
      uni: { ...uni, reLaunch: options => navigations.push({ at: time.now(), url: options.url }) }
    });
    const page = options.data();
    for (const [name, fn] of Object.entries(options.methods)) page[name] = fn.bind(page);
    return { page, options, navigations };
  }
  return { time, base, calls, images, api, poems, service, square, splash, control, backgroundStarts,
    cacheManager, refreshFlags, toasts, setAccount: value => { account = value; } };
}

async function testHandoff() {
  const app = runtime();
  const preload = app.service.preloadPoemSquare({});
  assert.equal(app.service.preloadPoemSquare({}), preload, '重复启动复用同一预加载任务');
  await preload;
  assert.equal(app.calls.length, 1);
  assert.equal(app.calls[0].payload.limit, 10);
  assert.equal(app.calls[0].payload.isOriginal, true);
  assert.equal(app.calls[0].options.silent, true);
  assert.equal(app.images.length, 2, '仅预热首屏可见签名，不请求山页/背景/头像');
  assert.equal(app.backgroundStarts.length, 0, '开屏预加载本身不启动后台 Tab 请求');
  const { page, options } = app.square();
  page.getIndexData = () => { throw new Error('首屏不应重新获取'); };
  options.onLoad.call(page, {});
  options.onShow.call(page);
  assert.equal(app.backgroundStarts.length, 1, '进入广场并交接首屏后才调度后台预热');
  assert.equal(page.isLoading, false, 'onLoad 同步交接，首帧无骨架');
  assert.equal(page.postList.length, 10);
  assert.equal(page.postList[0].authorSignature, '/local/signature.png');
  assert.equal(page.page, 1);
  assert.equal(page.hasMore, true);
  assert.equal(app.poems.peekOriginalPoems()[0].authorSignature, 'cloud://signature-0', '不将临时本地路径写入持久列表');
  assert.equal(app.service.takePoemSquarePreload(), null, '交接仅一次');
  await app.time.tick(1000);
  assert.equal(app.calls.length, 1, '交接后不再延迟强刷第一页');

  const again = app.square();
  again.page.getPostList = () => { throw new Error('有效缓存不应强刷'); };
  again.page.getIndexData();
  assert.equal(again.page.isLoading, false);
  await app.time.tick(1000);
  assert.equal(app.calls.length, 1);
}

async function testEmptyAndShortPages() {
  for (const count of [0, 3]) {
    const app = runtime({ count, signature: false });
    await app.service.preloadPoemSquare({});
    const { page, options } = app.square();
    options.onLoad.call(page, {});
    assert.equal(page.isLoading, false);
    assert.equal(page.postList.length, count);
    assert.equal(page.hasMore, false, '不足一页或真实空列表不再误判有下一页');
  }
}

async function testTimeoutAndRetry() {
  const app = runtime(), network = deferred();
  app.control.cloud = network.promise;
  let failed = false;
  const pending = app.service.preloadPoemSquare({}).catch(error => { failed = error.code === 'TIMEOUT'; });
  await app.time.tick(5000);
  await pending;
  assert.equal(failed, true);
  assert.equal(app.poems.peekOriginalPoems(), undefined);
  app.control.cloud = null;
  await app.service.preloadPoemSquare({});
  network.resolve({ posts: [{ _id: 'late' }] });
  await drain();
  assert.equal(app.poems.peekOriginalPoems().length, 10, '超时响应不能污染重试缓存');
  assert.equal(app.calls.length, 2);

  const auth = runtime();
  auth.setAccount('');
  auth.control.auth = new Promise(() => {});
  const stopped = auth.service.preloadPoemSquare({}).catch(error => error.code);
  await auth.time.tick(5000);
  assert.equal(await stopped, 'TIMEOUT');
  assert.equal(auth.calls.length, 0);
}

async function testImageAndInvalidation() {
  const app = runtime(), image = deferred();
  app.control.image = image.promise;
  const loading = app.service.preloadPoemSquare({});
  await app.time.tick(800);
  await loading;
  const posts = app.service.takePoemSquarePreload();
  assert.equal(posts.length, 10, '图片超时仍交接文字');
  image.resolve();
  await drain();
  assert.equal(posts[0].authorSignature, 'https://img/cloud://signature-0', '图片超时保留可显示 URL，迟到下载不改已交接对象');

  for (const invalidate of [app => app.setAccount('another'), app => app.api.invalidateAllPostList()]) {
    const current = runtime();
    await current.service.preloadPoemSquare({});
    invalidate(current);
    assert.equal(current.service.takePoemSquarePreload(), null, '换账号/缓存失效不交接旧内容');
  }
  const refresh = runtime();
  await refresh.service.preloadPoemSquare({});
  refresh.base.uni.setStorageSync('shouldRefreshPoem', true);
  const { page, options } = refresh.square();
  let refreshes = 0;
  let finishLoading;
  page.getIndexData = callback => { refreshes++; finishLoading = callback; };
  options.onLoad.call(page, {});
  options.onShow.call(page);
  assert.equal(refreshes, 1, '发布/编辑留下刷新标记时不使用启动快照');
  assert.equal(page.postList.length, 0);
  assert.equal(refresh.backgroundStarts.length, 0, '常规加载期间不抢先预热其他 Tab');
  finishLoading();
  assert.equal(refresh.backgroundStarts.length, 1, '常规加载结束后也会启动后台预热');
}

async function testPendingRefreshBeforePreload() {
  const app = runtime({ signature: false });
  app.control.cloud = Promise.resolve({ posts: [{ _id: 'old', content: '旧列表' }] });
  await app.poems.getOriginalPoems();
  const following = app.cacheManager.namespace('poems:following');
  following.set('old-following', [{ _id: 'old-following' }], { ttlMs: 75000 });
  app.refreshFlags.setFeedRefreshFlags();
  const network = deferred();
  app.control.cloud = network.promise;
  const pending = app.service.preloadPoemSquare({});
  await drain();
  assert.equal(app.poems.peekOriginalPoems(), undefined, '先失效遗留标记对应的旧原创缓存');
  assert.equal(following.get('old-following'), undefined, '同时失效旧关注列表');
  assert.equal(app.service.hasPoemSquarePreload(), false, '新首批尚未返回不能宣告就绪');
  assert.ok(app.refreshFlags.FEED_REFRESH_KEYS.every(key => !app.base.uni.getStorageSync(key)), '请求前消费已有标记');
  network.resolve({ posts: [{ _id: 'fresh', content: '新列表' }] });
  await pending;
  assert.equal(app.service.hasPoemSquarePreload(), true);
  assert.equal(app.service.hasPoemSquarePreload(), true, '导航检查不会消耗交接对象');
  const { page, options } = app.square();
  options.onLoad.call(page, {});
  options.onShow.call(page);
  await drain();
  assert.equal(page.postList[0]._id, 'fresh');
  assert.equal(page.isLoading, false);
  assert.equal(app.calls.length, 2, '含旧缓存准备共两次请求，onLoad/onShow 不重复重拉成功首批');
  assert.deepEqual(app.toasts, []);
}

async function testRefreshArrivingDuringPreload() {
  const app = runtime({ signature: false }), network = deferred();
  app.base.uni.setStorageSync('shouldRefreshPoem', true);
  app.control.cloud = network.promise;
  const pending = app.service.preloadPoemSquare({}).catch(error => error.code);
  await drain();
  assert.equal(app.base.uni.getStorageSync('shouldRefreshPoem'), undefined);
  app.base.uni.setStorageSync('shouldRefreshPoem', true);
  network.resolve({ posts: [{ _id: 'superseded', content: '发布前内容' }] });
  assert.equal(await pending, 'SPLASH_PRELOAD_INVALIDATED');
  assert.equal(app.base.uni.getStorageSync('shouldRefreshPoem'), true, '预加载中再次设置同名标记不能被旧响应消费');
  assert.equal(app.service.hasPoemSquarePreload(), false);
  assert.equal(app.service.takePoemSquarePreload(), null, '带新刷新要求的快照不能交接');
  app.control.cloud = Promise.resolve({ posts: [{ _id: 'latest', content: '发布后内容' }] });
  await app.service.preloadPoemSquare({});
  const { page, options } = app.square();
  options.onLoad.call(page, {});
  options.onShow.call(page);
  await drain();
  assert.equal(page.postList[0]._id, 'latest');
  assert.equal(app.calls.length, 2, '新标记只增加一次重取');
}

async function testAccountChangeReloadsStartupData() {
  for (const duringRequest of [false, true]) {
    const app = runtime({ signature: false }), network = deferred();
    if (duringRequest) app.control.cloud = network.promise;
    const pending = app.service.preloadPoemSquare({}).catch(error => error.code);
    await drain();
    if (!duringRequest) {
      await pending;
      assert.equal(app.service.hasPoemSquarePreload(), true);
    }
    app.setAccount('another-viewer');
    assert.equal(app.service.hasPoemSquarePreload(), false, '账号变化后旧首批不能作为导航就绪条件');
    if (duringRequest) {
      network.resolve({ posts: [{ _id: 'old-account', content: '旧账号请求' }] });
      assert.equal(await pending, 'SPLASH_PRELOAD_INVALIDATED');
      assert.equal(app.poems.peekOriginalPoems(), undefined, '旧账号迟到响应不得成为新账号缓存');
    }
    app.control.cloud = Promise.resolve({ posts: [{ _id: 'new-account', content: '新账号请求' }] });
    await app.service.preloadPoemSquare({});
    assert.equal(app.calls.length, 2, '重新准备必须为新账号发请求，不能复用旧快照源缓存');
    assert.equal(app.service.hasPoemSquarePreload(), true);
    assert.equal(app.service.takePoemSquarePreload()[0]._id, 'new-account');
  }
}

async function testSplashRetriesInvalidatedPreload() {
  const app = runtime({ signature: false }), network = deferred();
  app.control.cloud = network.promise;
  const splash = app.splash();
  splash.options.onLoad.call(splash.page);
  await drain();
  app.base.uni.setStorageSync('shouldRefreshPoem', true);
  app.control.cloud = Promise.resolve({ posts: [{ _id: 'after-refresh', content: '自动重取的新首批' }] });
  network.resolve({ posts: [{ _id: 'before-refresh', content: '应被丢弃的首批' }] });
  await app.time.tick(49);
  assert.equal(app.calls.length, 1, '失效后先让出事件循环，不立即递归重试');
  await app.time.tick(1);
  assert.equal(app.calls.length, 2, '预加载失效后开屏主动重试，不被一次 reject 卡到强制进入');
  await app.time.tick(1650);
  assert.equal(splash.navigations.length, 1);
  assert.equal(splash.navigations[0].at, 11700, '重试成功沿用正常打字和淡出时序');
  const { page, options } = app.square();
  options.onLoad.call(page, {});
  options.onShow.call(page);
  assert.equal(page.postList[0]._id, 'after-refresh');
  assert.equal(page.isLoading, false);
}

async function testRepeatedInvalidationYieldsToLifecycle() {
  for (const mode of ['deadline', 'manual', 'unload']) {
    const time = fakeTime(), navigations = [];
    let attempts = 0;
    const { createSplashGate, SPLASH_MIN_MS } = load('utils/splashGate.js', time.globals, ['createSplashGate', 'SPLASH_MIN_MS']);
    const options = load('pages/splash/splash.vue', {
      ...time.globals, createSplashGate, SPLASH_MIN_MS,
      preloadPoemSquare: () => {
        attempts++;
        // 限制错误实现的递归次数，断言失败时测试本身也能退出。
        const error = new Error(attempts > 200 ? 'retry loop exceeded' : 'invalidated');
        if (attempts <= 200) error.code = 'SPLASH_PRELOAD_INVALIDATED';
        return Promise.reject(error);
      },
      hasPoemSquarePreload: () => false, retainPoemSquarePreload: () => false, lightImpact() {}, formatErrorForLog: String,
      getAppState: () => ({ _loginProcessCompleted: true }),
      hasAcceptedPrivacyConsent: () => true, acceptPrivacyConsent() {},
      uni: { reLaunch: () => navigations.push(time.now() - 10000), showToast() {} }
    });
    const page = options.data();
    for (const [name, fn] of Object.entries(options.methods)) page[name] = fn.bind(page);
    options.onLoad.call(page);
    await drain();
    assert.equal(attempts, 1, '持续失效不能在微任务中连续递归并阻塞计时器');
    await time.tick(49);
    assert.equal(attempts, 1);
    await time.tick(1);
    assert.equal(attempts, 2, '重试按 50ms 间隔推进');
    await time.tick(1450);
    assert.equal(page.typedText, 'poementer', '持续失效不阻塞正常打字动画');
    assert.equal(page.showEnterButton, true, '持续失效时手动进入按钮仍可用');
    assert.equal(navigations.length, 0);
    if (mode === 'manual') {
      page.handleEnterButtonClick();
      assert.deepEqual(navigations, [1500], '持续重试期间点击仍立即进入');
    } else if (mode === 'unload') {
      options.onUnload.call(page);
      assert.equal(time.pending(), 0, '卸载清除重试、动画和截止计时器');
    } else {
      await time.tick(4300);
      assert.equal(page.fadeOut, true, '原 5.8 秒时开始截止淡出');
      const attemptsAtLeaving = attempts;
      await time.tick(199);
      assert.equal(navigations.length, 0);
      assert.equal(attempts, attemptsAtLeaving, '开始离开后取消下一次预加载重试');
      await time.tick(1);
      assert.deepEqual(navigations, [6000], '持续失效也在原 6 秒截止进入');
    }
    const attemptsAtStop = attempts;
    await time.tick(10000);
    assert.equal(attempts, attemptsAtStop, '进入或卸载后不再继续重试');
    assert.ok(attempts < 121, '持续失效重试次数受时间间隔约束');
    assert.equal(navigations.length, mode === 'unload' ? 0 : 1);
    assert.equal(time.pending(), 0);
  }
}

async function testFailedRefreshDoesNotReuseOldCache() {
  const app = runtime({ signature: false });
  await app.poems.getOriginalPoems();
  app.base.uni.setStorageSync('shouldRefreshPoem', true);
  const network = deferred();
  app.control.cloud = network.promise;
  const pending = app.service.preloadPoemSquare({});
  network.reject(new Error('offline'));
  await assert.rejects(pending, /offline/);
  assert.equal(app.service.hasPoemSquarePreload(), false);
  assert.equal(app.poems.peekOriginalPoems(), undefined, '标记已消费也不能因失败恢复旧首批');
  app.control.cloud = Promise.resolve({ posts: [{ _id: 'recovered', content: '重试成功' }] });
  const { page, options } = app.square();
  options.onLoad.call(page, {});
  options.onShow.call(page);
  await drain();
  assert.equal(page.postList[0]._id, 'recovered');
  assert.equal(page.isLoading, false);
  assert.equal(app.calls.length, 3, '旧缓存准备、开屏失败、页面恢复各请求一次');
}

async function testReadyCacheExpiresBeforeNavigation() {
  for (const remainingMs of [500, 1600]) {
    const app = runtime({ signature: false });
    await app.poems.getOriginalPoems();
    await app.time.tick(90000 - remainingMs);
    const startedAt = app.time.now();
    const splash = app.splash();
    splash.options.onLoad.call(splash.page);
    await drain();
    assert.equal(splash.page.preloadCompleted, true, '缓存有效时可先完成预加载');
    const network = deferred();
    app.control.cloud = network.promise;
    await app.time.tick(1700);
    assert.equal(splash.navigations.length, 0, '打字期间或淡出期间缓存过期，都不能按旧 ready 进入空页');
    assert.equal(splash.page.fadeOut, false, '失效后恢复开屏可见状态');
    assert.equal(app.calls.length, 2, '导航前重新请求已过期的首批');
    network.resolve({ posts: [{ _id: 'renewed', content: '导航前重取内容' }] });
    await app.time.tick(200);
    assert.equal(splash.navigations.length, 1);
    assert.ok(splash.navigations[0].at - startedAt < 6000, '修复路径仍在正常就绪出口完成');
    const { page, options } = app.square();
    options.onLoad.call(page, {});
    options.onShow.call(page);
    assert.equal(page.postList[0]._id, 'renewed');
    assert.equal(page.isLoading, false);
    await app.time.tick(6000);
    assert.equal(splash.navigations.length, 1, '重试后原截止定时器不再次导航');
  }
}

async function testInvalidatedReadyKeepsOriginalDeadline() {
  const app = runtime({ signature: false });
  const splash = app.splash(), startedAt = app.time.now();
  splash.options.onLoad.call(splash.page);
  await app.time.tick(1600);
  app.api.invalidateAllPostList();
  app.control.cloud = new Promise(() => {});
  await app.time.tick(100);
  assert.equal(splash.navigations.length, 0);
  await app.time.tick(4299);
  assert.equal(splash.navigations.length, 0);
  await app.time.tick(1);
  assert.equal(splash.navigations.length, 1);
  assert.equal(splash.navigations[0].at - startedAt, 6000, 'ready 失效后的重新预加载不重置 6 秒截止');
  await app.time.tick(10000);
  assert.equal(splash.navigations.length, 1);
}

async function testNativeRouteDelayRetainsFirstBatch() {
  const app = runtime({ signature: false });
  await app.poems.getOriginalPoems();
  await app.time.tick(88200);
  const startedAt = app.time.now(), version = app.poems.getOriginalPoemsVersion();
  const splash = app.splash();
  splash.options.onLoad.call(splash.page);
  await app.time.tick(1700);
  assert.equal(splash.navigations.length, 1);
  assert.equal(splash.navigations[0].at - startedAt, 1700, '缓存还有 100ms 时正常发起导航');
  // App 原生路由异步创建目标页面，onLoad 不与 reLaunch 同步发生。
  await app.time.tick(200);
  assert.equal(app.poems.peekOriginalPoems(), undefined, '路由期间普通缓存自然过期并被 get 清理');
  assert.equal(app.poems.getOriginalPoemsVersion(), version, '自然到期不等同于显式内容失效');
  assert.equal(app.service.hasPoemSquarePreload(), true, '已经发起导航的短期交接仍可领取');
  const { page, options } = app.square();
  page.getIndexData = () => { throw new Error('原生路由延迟不应丢弃已准备好的首批'); };
  options.onLoad.call(page, {});
  options.onShow.call(page);
  assert.equal(page.postList.length, 10);
  assert.equal(page.isLoading, false);
  assert.equal(app.calls.length, 1, 'onLoad/onShow 仍同步显示同一首批，不再发请求');
  assert.equal(app.service.takePoemSquarePreload(), null, '保留的交接仍只能领取一次');
  assert.deepEqual(app.toasts, []);
}

async function testRetainedPreloadRejectsExplicitChanges() {
  for (const mode of ['invalidate', 'set', 'update', 'clear', 'account', 'refresh', 'expired-invalidation', 'handoff-timeout']) {
    const app = runtime({ signature: false });
    await app.poems.getOriginalPoems();
    await app.time.tick(88200);
    await app.service.preloadPoemSquare({});
    assert.equal(app.service.retainPoemSquarePreload(), true);
    assert.equal(app.service.hasPoemSquarePreload(), true, 'retain 不会消耗交接对象');
    const ns = app.cacheManager.namespace('posts:list');
    const key = 'page:0:size:10:poem:true:orig:true';
    if (mode === 'invalidate') app.api.invalidatePostList({ isPoem: true, isOriginal: true });
    if (mode === 'set') ns.set(key, ns.get(key), { ttlMs: 90000 });
    if (mode === 'update') assert.equal(ns.update(key, posts => posts), true);
    if (mode === 'clear') app.api.invalidateAllPostList();
    if (mode === 'account') app.setAccount('new-viewer');
    if (mode === 'refresh') app.base.uni.setStorageSync('shouldRefreshPoem', true);
    if (mode === 'expired-invalidation') {
      await app.time.tick(2000);
      assert.equal(app.poems.peekOriginalPoems(), undefined);
      assert.equal(app.service.hasPoemSquarePreload(), true, '自然过期后保留交接仍有效');
      app.api.invalidatePostList({ isPoem: true, isOriginal: true });
    }
    if (mode === 'handoff-timeout') await app.time.tick(30000);
    assert.equal(app.service.hasPoemSquarePreload(), false, `${mode} 后保留对象不得继续宣告就绪`);
    assert.equal(app.service.retainPoemSquarePreload(), false, `${mode} 后不能通过重复保留恢复旧对象`);
    assert.equal(app.service.takePoemSquarePreload(), null, `${mode} 后不能交付旧首批`);
  }
}

async function testManualSkipRetriesPreloadTimeout() {
  const app = runtime({ signature: false }), network = deferred();
  app.control.cloud = network.promise;
  const splash = app.splash();
  splash.options.onLoad.call(splash.page);
  await app.time.tick(1500);
  splash.page.handleEnterButtonClick();
  assert.equal(splash.navigations.length, 1, '手动跳过即时进入');
  splash.options.onUnload.call(splash.page);
  const { page, options } = app.square();
  options.onLoad.call(page, {});
  options.onShow.call(page);
  await drain();
  assert.equal(app.calls.length, 1, '页面先复用尚在进行的开屏首批请求');
  assert.equal(page.isLoading, true);
  app.control.cloud = Promise.resolve({ posts: [{ _id: 'page-retry', content: '页面正常重试结果' }] });
  await app.time.tick(3500);
  assert.equal(app.calls.length, 2, '开屏 5 秒短预算超时后页面独立重试一次');
  assert.equal(app.calls[1].options.timeoutMs, undefined, '页面重试不继承开屏短预算');
  assert.equal(page.postList[0]._id, 'page-retry');
  assert.equal(page.isLoading, false);
  assert.deepEqual(app.toasts, [], '短预算交接超时恢复时不闪加载失败提示');
  network.resolve({ posts: [{ _id: 'late', content: '迟到的开屏响应' }] });
  await drain();
  assert.equal(page.postList[0]._id, 'page-retry');
  assert.equal(app.poems.peekOriginalPoems()[0]._id, 'page-retry', '迟到的开屏响应不能覆盖页面恢复结果');
}

async function testBackgroundTabs() {
  for (const savedFilter of [undefined, true, false]) {
    const time = fakeTime(), calls = [], storage = new Map(), images = [], hydrated = [];
    let account = 'viewer';
    const uni = {
      getStorageSync: key => key === 'homeShowNormalPostsOnly' ? savedFilter : storage.get(key),
      setStorageSync: (key, value) => storage.set(key, value), removeStorageSync: key => storage.delete(key),
      getImageInfo: request => images.push(request)
    };
    const base = { ...time.globals, uni };
    const cacheManager = load('cache/core/manager.js', base);
    const { withTimeout } = load('utils/asyncTimeout.js', base, ['withTimeout']);
    const { buildCacheKey } = load('cache/core/key-builder.js', base, ['buildCacheKey']);
    const cloud = async (name, payload, options) => {
      calls.push({ name, payload, options });
      return { success: true, posts: [{ _id: 'post', authorAvatar: 'cloud://avatar' }],
        poets: [{ _id: 'poet', name: '诗人', avatar: 'https://img/poet' }] };
    };
    const shared = { ...base, cacheManager, buildCacheKey, withTimeout, callCloudAndUnwrap: cloud,
      cloudCall: async (...args) => ({ result: await cloud(...args) }) };
    const { getPostList } = load('api-cache/post-list.js', shared, ['getPostList']);
    const poems = load('api-cache/poems.js', { ...shared, getPostList }, ['getMountainPoems']);
    const poets = load('api-cache/poet.js', shared, ['getPoetList', 'peekPoetList']);
    const home = load('api-cache/home-posts.js', shared, ['getHomePosts']);
    const avatars = load('utils/poetAvatarPreload.js', { ...base, withTimeout }, ['warmPoetAvatars', 'preparePoetAvatars', 'forgetPoetAvatar']);
    const { scheduleTabPreload } = load('utils/tabPreload.js', {
      ...base, ...poems, ...poets, ...home, ...avatars, withTimeout, getOpenid: () => account,
      hydrateTempUrls: async posts => { hydrated.push(posts); posts[0].authorAvatar = 'https://converted'; }
    }, ['scheduleTabPreload']);
    assert.equal(scheduleTabPreload(), undefined, '页面不等待后台 Promise');
    scheduleTabPreload();
    await time.tick(799);
    assert.equal(calls.length, 0, '首帧前不开始后台请求');
    await time.tick(1);
    assert.deepEqual(calls.map(call => call.name), ['getPoetList', 'getPostList', 'getPostList']);
    assert.equal(calls[0].payload.limit, 50);
    assert.equal(calls[1].payload.isOriginal, false);
    assert.equal(calls[1].payload.excludeAnonymous, true);
    assert.equal(calls[1].payload.limit, 10);
    assert.equal(calls[2].payload.isPoem, savedFilter === true ? false : undefined);
    assert.equal(calls[2].payload.isDiscussion, savedFilter === true ? false : undefined);
    assert.equal(calls[2].payload.homeRanking, savedFilter !== true);
    assert.ok(calls.every(call => call.options.silent && call.options.timeoutMs === 8000));
    assert.equal(images.length, 1, '图片未完成也继续预取两个列表');
    assert.equal(hydrated.length, 2);
    assert.equal(poets.peekPoetList()[0].name, '诗人');
    const mountain = await poems.getMountainPoems({ page: 0, pageSize: 10 });
    assert.equal(mountain[0].authorAvatar, 'cloud://avatar', '地址预热不修改持久列表');
    await home.getHomePosts({ page: 0, pageSize: 10, ...(savedFilter === true ? { isPoem: false, isDiscussion: false } : {}) });
    await poets.getPoetList({ limit: 50 });
    assert.equal(calls.length, 3, '切换页面和组件挂载复用相同缓存，不再请求');
    images[0].success({ path: '/local/poet.png' });
    await drain();
    const component = load('components/poet-avatar-bar/poet-avatar-bar.vue', { ...poets, ...avatars });
    const bar = component.data();
    assert.equal(bar.poets[0].avatar, '/local/poet.png', '头像栏首帧直接读取预热本地图片');
    assert.equal(poets.peekPoetList()[0].avatar, 'https://img/poet', '本地路径不写入持久列表');
    component.methods.onAvatarError.call(bar, bar.poets[0]);
    assert.equal(bar.poets[0].avatar, 'https://img/poet', '临时文件失效后回退原地址');
    component.methods.onAvatarError.call(bar, bar.poets[0]);
    assert.equal(bar.poets[0].avatar, bar.defaultAvatar);
    scheduleTabPreload(); await time.tick(1000);
    assert.equal(calls.length, 3, '重复进入广场不重复预热');
  }
}

async function testBackgroundFailures() {
  for (const mode of ['poet-timeout', 'mountain-error', 'account-switch', 'no-account']) {
    const time = fakeTime(), calls = [];
    let account = mode === 'no-account' ? '' : 'viewer';
    const { withTimeout } = load('utils/asyncTimeout.js', time.globals, ['withTimeout']);
    const { scheduleTabPreload } = load('utils/tabPreload.js', {
      ...time.globals, withTimeout, getOpenid: () => account,
      uni: { getStorageSync: () => false },
      getPoetList: async () => {
        calls.push('poets');
        if (mode === 'poet-timeout') return new Promise(() => {});
        if (mode === 'account-switch') account = 'another';
        return [];
      },
      warmPoetAvatars: async () => {}, hydrateTempUrls: async () => {},
      getMountainPoems: async () => { calls.push('mountain'); if (mode === 'mountain-error') throw Error('offline'); return []; },
      getHomePosts: async () => { calls.push('home'); return []; }
    }, ['scheduleTabPreload']);
    scheduleTabPreload();
    await time.tick(9000);
    assert.deepEqual(calls, mode === 'no-account' ? [] : mode === 'account-switch' ? ['poets'] : ['poets', 'mountain', 'home']);
  }
  // 超时必须释放真实缓存里的 pending，页面可以重试，迟到响应不覆盖重试。
  for (const kind of ['poet', 'home']) {
    const time = fakeTime(), storage = new Map(), late = deferred();
    const base = { ...time.globals, uni: { getStorageSync: key => storage.get(key),
      setStorageSync: (key, value) => storage.set(key, value), removeStorageSync: key => storage.delete(key) } };
    const cacheManager = load('cache/core/manager.js', base);
    const { withTimeout } = load('utils/asyncTimeout.js', base, ['withTimeout']);
    const { buildCacheKey } = load('cache/core/key-builder.js', base, ['buildCacheKey']);
    let hanging = true;
    const response = () => hanging ? late.promise : Promise.resolve({ success: true, poets: [{ name: 'fresh' }], posts: [{ name: 'fresh' }] });
    const shared = { ...base, cacheManager, withTimeout, buildCacheKey, callCloudAndUnwrap: response,
      cloudCall: async () => ({ result: await response() }) };
    const request = kind === 'poet' ? load('api-cache/poet.js', shared, ['getPoetList']).getPoetList
      : load('api-cache/home-posts.js', shared, ['getHomePosts']).getHomePosts;
    const pending = request({ timeoutMs: 8000, silent: true }).catch(error => error.code);
    await time.tick(8000);
    assert.equal(await pending, 'TIMEOUT');
    hanging = false;
    assert.equal((await request())[0].name, 'fresh');
    late.resolve({ success: true, posts: [{ name: 'late' }], poets: [{ name: 'late' }] });
    await drain();
    assert.equal((await request())[0].name, 'fresh');
  }
}

async function testPoetImageQueue() {
  const time = fakeTime(), images = [];
  let current = true;
  const { withTimeout } = load('utils/asyncTimeout.js', time.globals, ['withTimeout']);
  const avatars = load('utils/poetAvatarPreload.js', {
    ...time.globals, withTimeout, uni: { getImageInfo: request => images.push(request) },
    fileUrlCache: { getTempUrls: async ids => Object.fromEntries(ids.map(id => [id, 'https://img/' + id])) }
  }, ['warmPoetAvatars', 'preparePoetAvatars']);
  const poets = Array.from({ length: 6 }, (_, i) => ({ avatar: 'cloud://poet-' + i }));
  const task = avatars.warmPoetAvatars(poets, () => current);
  await drain();
  assert.equal(images.length, 2, '头像最多同时预热两张');
  images[0].success({ path: '/local/first' });
  await drain();
  assert.equal(images.length, 3, '按头像栏顺序继续下一张');
  assert.equal(avatars.preparePoetAvatars(poets)[0].avatar, '/local/first');
  current = false;
  images[1].success({ path: '/local/stale' });
  images[2].success({ path: '/local/stale' });
  await task;
  assert.equal(images.length, 3, '账号变化后停止剩余图片');
  assert.equal(avatars.preparePoetAvatars(poets)[1].avatar, 'cloud://poet-1');
  current = true;
  const timed = avatars.warmPoetAvatars(poets);
  await time.tick(5000);
  await timed;
  assert.equal(images.length, 5, '图片挂起后停止对应 worker，不累积底层并发');
}

async function testReadyNavigationRequiresRetention() {
  const time = fakeTime(), navigations = [];
  let canRetain = false, preloads = 0;
  const { createSplashGate, SPLASH_MIN_MS } = load('utils/splashGate.js', time.globals, ['createSplashGate', 'SPLASH_MIN_MS']);
  const options = load('pages/splash/splash.vue', {
    ...time.globals, createSplashGate, SPLASH_MIN_MS,
    preloadPoemSquare: async () => { preloads++; },
    hasPoemSquarePreload: () => true,
    retainPoemSquarePreload: () => canRetain,
    getAppState: () => ({ _loginProcessCompleted: true }),
    hasAcceptedPrivacyConsent: () => true, lightImpact() {}, formatErrorForLog: String,
    uni: { reLaunch: () => navigations.push(time.now() - 10000) }
  });
  const page = options.data();
  for (const [name, method] of Object.entries(options.methods)) page[name] = method.bind(page);
  options.onLoad.call(page);
  await time.tick(1700);
  assert.equal(navigations.length, 0, '先前检查通过但最终交接保留失败，不能自动导航');
  assert.equal(preloads, 2, '保留失败回到同一开屏流程重新准备');
  canRetain = true;
  await time.tick(200);
  assert.deepEqual(navigations, [1900], '只有保留交接成功才能发起 ready 导航');
  await time.tick(10000);
  assert.equal(navigations.length, 1);
}

async function testSplashLifecycle() {
  for (const mode of ['fast', 'slow', 'never', 'error', 'unload', 'double-click', 'error-click', 'navigation-fail']) {
    const time = fakeTime(), network = deferred(), navigations = [], toasts = [];
    const { createSplashGate, SPLASH_MIN_MS } = load('utils/splashGate.js', time.globals, ['createSplashGate', 'SPLASH_MIN_MS']);
    const options = load('pages/splash/splash.vue', {
      ...time.globals, createSplashGate, SPLASH_MIN_MS, preloadPoemSquare: () => network.promise,
      hasPoemSquarePreload: () => true, retainPoemSquarePreload: () => true, lightImpact() {}, formatErrorForLog: String,
      getAppState: () => ({ _loginProcessCompleted: true }),
      hasAcceptedPrivacyConsent: () => true, acceptPrivacyConsent() {},
      uni: { reLaunch: opt => { navigations.push(time.now() - 10000); if (mode === 'navigation-fail') opt.fail(); },
        showToast: opt => toasts.push(opt.title) }
    });
    const page = options.data();
    for (const [name, method] of Object.entries(options.methods)) page[name] = method.bind(page);
    options.onLoad.call(page);
    if (mode === 'fast' || mode === 'navigation-fail') network.resolve();
    if (mode === 'error' || mode === 'error-click') network.reject(new Error('offline'));
    if (mode === 'unload') options.onUnload.call(page);
    if (mode !== 'unload') {
      page.handleEnterButtonClick();
      assert.equal(navigations.length, 0, '打字完成前没有可用按钮，不能提前跳过');
      for (let step = 0; step < 14; step++) {
        await time.tick(100);
        assert.equal(page.showEnterButton, false, '打字期间不闪现按钮');
        assert.equal(page.fadeOut, false, '快速加载也不提前截断打字');
        assert.equal(navigations.length, 0);
      }
      assert.ok(page.typedText.length > 0 && page.typedText.length < page.fullText.length);
      await time.tick(100);
      assert.equal(page.typedText, page.fullText, '约 1.5 秒完整显示打字内容');
      assert.equal(page.typingCompleted, true);
      assert.equal(navigations.length, 0);
      assert.equal(page.showEnterButton, !['fast', 'navigation-fail'].includes(mode), '只在打字完且尚未就绪时显示按钮');
      if (mode === 'slow') {
        await time.tick(1500);
        network.resolve(); await drain();
        assert.equal(page.showEnterButton, false, '慢加载就绪后自动收起按钮并进入');
      }
      if (mode === 'double-click' || mode === 'error-click') {
        page.handleEnterButtonClick();
        assert.deepEqual(navigations, [1500], '加载未完成或失败时按下按钮当场导航');
        page.handleEnterButtonClick();
        if (mode === 'double-click') network.resolve();
      }
    }
    await time.tick(10000);
    if (mode === 'unload') {
      network.resolve(); await drain();
      assert.equal(navigations.length, 0);
      assert.equal(time.pending(), 0);
    } else {
      assert.equal(navigations.length, 1);
      assert.ok(navigations[0] <= 6000);
      if (mode === 'fast') assert.equal(navigations[0], 1700);
      if (mode === 'slow') assert.equal(navigations[0], 3200);
      if (mode === 'never' || mode === 'error') assert.equal(navigations[0], 6000);
      if (mode === 'navigation-fail') {
        assert.equal(page.showEnterButton, true);
        assert.equal(page.fadeOut, false);
        assert.equal(toasts.length, 1);
        page.handleEnterButtonClick();
        assert.equal(navigations.length, 2, '导航失败后提供手动重试');
      }
    }
  }
}

async function testPrivacyConsent() {
  function consentRuntime(storage, navigations = []) {
    return load('utils/privacyConsent.js', {
      uni: {
        getStorageSync: key => storage.get(key),
        setStorageSync: (key, value) => storage.set(key, value),
        navigateTo: options => navigations.push(options.url)
      }
    }, ['hasAcceptedPrivacyConsent', 'acceptPrivacyConsent', 'openPrivacyPolicy', 'PRIVACY_POLICY_VERSION', 'PRIVACY_CONSENT_STORAGE_KEY']);
  }
  function splashRuntime(consent, network, navigations, toasts, preloads) {
    const time = fakeTime();
    const { createSplashGate, SPLASH_MIN_MS } = load('utils/splashGate.js', time.globals, ['createSplashGate', 'SPLASH_MIN_MS']);
    const options = load('pages/splash/splash.vue', {
      ...time.globals, createSplashGate, SPLASH_MIN_MS,
      preloadPoemSquare: () => { preloads.count += 1; return network.promise; },
      hasPoemSquarePreload: () => true, retainPoemSquarePreload: () => true,
      getAppState: () => ({ _loginProcessCompleted: true }),
      lightImpact() {}, formatErrorForLog: String,
      hasAcceptedPrivacyConsent: consent.hasAcceptedPrivacyConsent,
      acceptPrivacyConsent: consent.acceptPrivacyConsent,
      uni: {
        reLaunch: opt => navigations.push(opt.url),
        showToast: opt => toasts.push(opt.title)
      }
    });
    const page = options.data();
    for (const [name, method] of Object.entries(options.methods)) page[name] = method.bind(page);
    return { time, page, options };
  }

  {
    const storage = new Map(), navigations = [], toasts = [], preloads = { count: 0 };
    const consent = consentRuntime(storage, navigations);
    storage.set(consent.PRIVACY_CONSENT_STORAGE_KEY, consent.PRIVACY_POLICY_VERSION);
    const network = deferred();
    const { time, page, options } = splashRuntime(consent, network, navigations, toasts, preloads);
    options.onLoad.call(page);
    assert.equal(page.showPrivacyConsent, false, '已同意不弹窗');
    assert.equal(preloads.count, 1, '已同意直接预加载');
    network.resolve(); await drain();
    await time.tick(10000);
    assert.deepEqual(navigations, ['/pages/poem-square/poem-square']);
  }

  {
    const storage = new Map(), navigations = [], toasts = [], preloads = { count: 0 };
    const consent = consentRuntime(storage, navigations);
    const network = deferred();
    const { time, page, options } = splashRuntime(consent, network, navigations, toasts, preloads);
    options.onLoad.call(page);
    assert.equal(page.showPrivacyConsent, true, '首次启动展示隐私弹窗');
    assert.equal(preloads.count, 0, '未同意不预加载');
    await time.tick(1500);
    assert.equal(page.typedText, 'poementer', '弹窗期间打字继续');
    await time.tick(10000);
    assert.equal(navigations.length, 0, '未同意不进入且不受 6 秒放行影响');
    assert.equal(preloads.count, 0, '等待确认期间不发起数据请求');
    page.handlePrivacyConsentAgree();
    assert.equal(page.showPrivacyConsent, false);
    assert.equal(storage.get(consent.PRIVACY_CONSENT_STORAGE_KEY), consent.PRIVACY_POLICY_VERSION, '同意后记录政策版本');
    assert.equal(consent.hasAcceptedPrivacyConsent(), true);
    assert.equal(preloads.count, 1, '同意后才开始预加载');
    network.resolve(); await drain();
    await time.tick(10000);
    assert.deepEqual(navigations, ['/pages/poem-square/poem-square'], '同意后正常进入');
  }

  {
    const storage = new Map(), navigations = [], toasts = [], preloads = { count: 0 };
    const consent = consentRuntime(storage, navigations);
    const network = deferred();
    const { time, page, options } = splashRuntime(consent, network, navigations, toasts, preloads);
    options.onLoad.call(page);
    page.handlePrivacyConsentDecline();
    assert.equal(page.showPrivacyConsent, false);
    assert.equal(toasts.length, 1, '不同意且无法退出时提示');
    assert.equal(navigations.length, 0);
    await time.tick(300);
    assert.equal(page.showPrivacyConsent, true, '提示后重新展示弹窗');
    await time.tick(10000);
    assert.equal(navigations.length, 0, '不同意时不进入');
    assert.equal(preloads.count, 0);
    assert.equal(consent.hasAcceptedPrivacyConsent(), false);
    page.handlePrivacyConsentAgree();
    network.resolve(); await drain();
    await time.tick(10000);
    assert.equal(navigations.length, 1, '重新展示后同意仍可进入');
  }

  {
    const storage = new Map();
    const first = consentRuntime(storage);
    assert.equal(first.hasAcceptedPrivacyConsent(), false);
    first.acceptPrivacyConsent();
    const nextLaunch = consentRuntime(storage);
    assert.equal(nextLaunch.hasAcceptedPrivacyConsent(), true, '同意后下次启动不再弹窗');
  }

  {
    const brokenUni = {
      getStorageSync() { throw new Error('storage unavailable'); },
      setStorageSync() { throw new Error('storage unavailable'); }
    };
    const consent = load('utils/privacyConsent.js', { uni: brokenUni },
      ['hasAcceptedPrivacyConsent', 'acceptPrivacyConsent']);
    assert.equal(consent.hasAcceptedPrivacyConsent(), false);
    consent.acceptPrivacyConsent();
    assert.equal(consent.hasAcceptedPrivacyConsent(), true, '存储异常时本次会话不重复弹窗');
  }

  {
    const policyNavigations = [];
    const consent = load('utils/privacyConsent.js', {
      uni: { navigateTo: options => policyNavigations.push(options.url) }
    }, ['openPrivacyPolicy']);
    const dialog = load('components/PrivacyConsentDialog.vue', { openPrivacyPolicy: consent.openPrivacyPolicy, AppDialog: {} });
    const events = [];
    dialog.methods.handleConfirm.call({ $emit: event => events.push(event) });
    dialog.methods.handleCancel.call({ $emit: event => events.push(event) });
    dialog.methods.openPolicy.call({});
    assert.deepEqual(events, ['agree', 'decline']);
    assert.deepEqual(policyNavigations, ['/pages/privacy/privacy'], '弹窗内可打开隐私政策页');
  }
}

async function testAppPrivacyGate() {
  const listeners = new Map();
  const storage = new Map();
  const uni = {
    getStorageSync: key => storage.get(key),
    setStorageSync: (key, value) => storage.set(key, value),
    removeStorageSync: key => storage.delete(key),
    $on(event, handler) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(handler);
    },
    $off(event, handler) { listeners.get(event)?.delete(handler); },
    $emit(event, payload) { listeners.get(event)?.forEach(handler => handler(payload)); }
  };
  const consent = load('utils/privacyConsent.js', { uni },
    ['hasAcceptedPrivacyConsent', 'acceptPrivacyConsent', 'runAfterPrivacyConsent', 'PRIVACY_POLICY_VERSION']);
  const app = load('App.vue', {
    uni,
    hasAcceptedPrivacyConsent: consent.hasAcceptedPrivacyConsent,
    runAfterPrivacyConsent: consent.runAfterPrivacyConsent,
    installRuntimeBindings() {}, markLoginProcessStarted() {}, markLoginProcessCompleted() {},
    getAppState: () => ({}), patchAppState() {}, setUserSession() {},
    ensureRuntimeOpenid: async () => null, ensureTcbAuthenticated: async () => {},
    formatErrorForLog: String, unreadBadge: { startPolling() {}, stopPolling() {} },
    refreshAdminStatus: async () => {}, cancelTabTransition() {}, checkAndUpdate: async () => ({})
  });
  function createApp() {
    const instance = {
      appState: {}, started: 0,
      runWhenPlusReady() {}, syncGlobalDataFromAppState() {}, applyAppState() {},
      $nextTick(callback) { callback(); },
      startConsentedStartup() { this.started += 1; }
    };
    instance.runPrivacyGatedStartup = app.methods.runPrivacyGatedStartup.bind(instance);
    return instance;
  }

  const pending = createApp();
  app.onLaunch.call(pending);
  assert.equal(pending.started, 0, '未同意前不登录、不检查更新');
  consent.acceptPrivacyConsent();
  assert.equal(pending.started, 1, '同意事件放行启动引导');
  consent.acceptPrivacyConsent();
  assert.equal(pending.started, 1, '重复同意不重复启动');

  storage.set(consent.PRIVACY_CONSENT_STORAGE_KEY, consent.PRIVACY_POLICY_VERSION);
  const accepted = createApp();
  app.onLaunch.call(accepted);
  assert.equal(accepted.started, 1, '已同意时直接启动引导');
}

async function testRuntimeOpenidPrivacyGate() {
  const blocked = load('utils/runtime-bootstrap.js', {
    getAppState: () => ({}), getOpenid: () => null,
    hasAcceptedPrivacyConsent: () => false, formatErrorForLog: String
  }, ['ensureRuntimeOpenid']);
  assert.equal(await blocked.ensureRuntimeOpenid(), null, '未同意前不获取 openid');
  const cached = load('utils/runtime-bootstrap.js', {
    getAppState: () => ({}), getOpenid: () => 'cached-openid',
    hasAcceptedPrivacyConsent: () => false, formatErrorForLog: String
  }, ['ensureRuntimeOpenid']);
  assert.equal(await cached.ensureRuntimeOpenid(), 'cached-openid', '已有 openid 直接复用');
}

module.exports = { load, fakeTime, deferred, drain };

if (require.main === module) (async () => {
  for (const test of [testGate, testHandoff, testEmptyAndShortPages, testTimeoutAndRetry, testImageAndInvalidation, testSplashLifecycle,
    testPendingRefreshBeforePreload, testRefreshArrivingDuringPreload, testAccountChangeReloadsStartupData,
    testSplashRetriesInvalidatedPreload, testRepeatedInvalidationYieldsToLifecycle, testFailedRefreshDoesNotReuseOldCache,
    testReadyCacheExpiresBeforeNavigation, testInvalidatedReadyKeepsOriginalDeadline, testManualSkipRetriesPreloadTimeout,
    testNativeRouteDelayRetainsFirstBatch, testRetainedPreloadRejectsExplicitChanges, testReadyNavigationRequiresRetention,
    testPrivacyConsent, testAppPrivacyGate, testRuntimeOpenidPrivacyGate, testBackgroundTabs, testBackgroundFailures, testPoetImageQueue]) {
    await test(); console.log('PASS ' + test.name);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
