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
  const time = fakeTime(), storage = new Map(), calls = [], images = [], backgroundStarts = [];
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
    $on() {}, $off() {}, hideTabBar() {}, showToast() {}
  };
  const base = { ...time.globals, uni };
  const cacheManager = load('cache/core/manager.js', base);
  const { withTimeout } = load('utils/asyncTimeout.js', base, ['withTimeout']);
  const { buildCacheKey } = load('cache/core/key-builder.js', base, ['buildCacheKey']);
  const api = load('api-cache/post-list.js', {
    ...base, cacheManager, buildCacheKey, withTimeout,
    callCloudAndUnwrap: async (name, payload, options) => {
      calls.push({ name, payload, options });
      if (control.cloud) return control.cloud;
      return { posts: Array.from({ length: count }, (_, i) => ({
        _id: `p${i}`, content: '测试诗歌', authorSignature: signature && i < 2 ? `cloud://signature-${i}` : '', votes: 0
      })) };
    }
  }, ['getPostList', 'invalidateAllPostList']);
  const poems = load('api-cache/poems.js', { ...base, cacheManager, buildCacheKey, getPostList: api.getPostList }, ['getOriginalPoems', 'peekOriginalPoems', 'ORIGINAL_POEMS_PAGE_SIZE']);
  const service = load('utils/splashPreload.js', {
    ...base, ...poems, withTimeout, getOpenid: () => account,
    ensureRuntimeOpenid: async () => { if (control.auth) await control.auth; account = 'viewer'; return account; },
    fileUrlCache: { getTempUrls: async ids => Object.fromEntries(ids.map(id => [id, 'https://img/' + id])) }
  }, ['preloadPoemSquare', 'takePoemSquarePreload']);
  function square() {
    const options = load('pages/poem-square/poem-square.vue', {
      ...base, ...poems, ...service, cacheManager, formatErrorForLog: String,
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
  return { time, base, calls, images, api, poems, service, square, control, backgroundStarts, setAccount: value => { account = value; } };
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
  assert.equal(refreshes, 1, '发布/编辑留下刷新标记时不使用启动快照');
  assert.equal(page.postList.length, 0);
  assert.equal(refresh.backgroundStarts.length, 0, '常规加载期间不抢先预热其他 Tab');
  finishLoading();
  assert.equal(refresh.backgroundStarts.length, 1, '常规加载结束后也会启动后台预热');
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

async function testSplashLifecycle() {
  for (const mode of ['fast', 'slow', 'never', 'error', 'unload', 'double-click', 'error-click', 'navigation-fail']) {
    const time = fakeTime(), network = deferred(), navigations = [], toasts = [];
    const { createSplashGate, SPLASH_MIN_MS } = load('utils/splashGate.js', time.globals, ['createSplashGate', 'SPLASH_MIN_MS']);
    const options = load('pages/splash/splash.vue', {
      ...time.globals, createSplashGate, SPLASH_MIN_MS, preloadPoemSquare: () => network.promise, lightImpact() {}, formatErrorForLog: String,
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

module.exports = { load, fakeTime, deferred, drain };

if (require.main === module) (async () => {
  for (const test of [testGate, testHandoff, testEmptyAndShortPages, testTimeoutAndRetry, testImageAndInvalidation, testSplashLifecycle,
    testBackgroundTabs, testBackgroundFailures, testPoetImageQueue]) {
    await test(); console.log('PASS ' + test.name);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
