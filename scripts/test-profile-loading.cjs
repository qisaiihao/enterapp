const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parse } = require('@babel/parser');

const root = path.join(__dirname, '..');
const quiet = { log() {}, warn() {}, error() {} };
const drain = async () => { for (let i = 0; i < 70; i++) await Promise.resolve(); };
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function load(file, globals = {}, names = []) {
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
  if (names.length) source += `\nmodule.exports = { ${names.join(', ')} };`;
  const scope = { ...imports, console: quiet, module: { exports: {} }, ...globals };
  vm.runInNewContext(source, scope, { filename: file });
  return scope.module.exports;
}

function runtime() {
  const clock = { now: 100000 };
  class FakeDate extends Date { static now() { return clock.now; } }
  const storage = new Map(), calls = [], writes = [];
  const app = { globalData: { openid: 'me', _loginProcessCompleted: true,
    userInfo: { _openid: 'me', nickName: '本地名字', avatarUrl: '/local.png' } } };
  const uni = {
    getStorageSync: key => storage.get(key),
    setStorageSync: (key, value) => storage.set(key, value),
    removeStorageSync: key => storage.delete(key),
    showToast() {}, hideTabBar() {}, stopPullDownRefresh() {}
  };
  const base = { uni, Date: FakeDate, getApp: () => app,
    setTimeout: () => 1, clearTimeout() {}, clearInterval() {},
    normalizeAppBackgroundMode: () => '', captureFavoriteRead: () => () => true };
  const state = load('utils/app-state.js', base, ['getOpenid', 'getAppState', 'patchAppState']);
  const cacheManager = load('cache/core/manager.js', base);
  const api = load('api-cache/my.js', { ...base, ...state, cacheManager,
    avatarCache: { getSavedAvatar() {} }, fileUrlCache: { getTempUrl: async value => value },
    callCloudAndUnwrap: (name, payload) => {
      const request = deferred(); calls.push({ name, payload, ...request }); return request.promise;
    }
  }, ['getMyInfo', 'getMyPosts', 'getMyFavorites', 'getMyFollowerCount', 'getCachedMyProfile',
    'invalidateMyInfo', 'invalidateMyPosts', 'invalidateMyFavorites']);
  const definition = load('pages/profile/profile.vue', {
    ...base, ...state, ...api, getThemeMode: () => 'light', applyThemeMode() {}, updateTabBarStatus() {},
    invalidateMyProfile() {}, resolveUserAvatar: value => value || '/avatar.png',
    getUserAvatarSeed: user => user._openid,
    extractGrowthStats: user => user.growthCounts || { seed: 0 },
    applyUserInfoWithAppBackground: async user => {
      writes.push(user); app.globalData.userInfo = user; storage.set('userInfo', user); return user;
    }
  });
  function page() {
    return Object.assign(definition.data(), definition.methods, {
      onShow: definition.onShow, onUnload: definition.onUnload,
      setData(updates) { Object.assign(this, updates); }, formatTime: String,
      ensureGlobalEventBindings() {}, releaseGlobalEventBindings() {}, clearLoginWaitTimers() {},
      finishBackgroundActionSheet() {}
    });
  }
  function pending(kind, from = 0) {
    return calls.slice(from).filter(call => kind === 'followers' ? call.name === 'follow'
      : call.name === 'getMyProfileData' && (kind === 'header' ? call.payload.limit === undefined : call.payload.limit !== undefined));
  }
  function settleContent(from = 0, suffix = 'new') {
    for (const request of pending('header', from)) request.resolve({ userInfo: { nickName: suffix, avatarUrl: '/avatar.png' } });
    for (const request of pending('posts', from)) request.resolve({ posts: makePosts(suffix) });
  }
  async function seed() {
    const tasks = [api.getMyInfo(), api.getMyPosts({ pageSize: 5 }), api.getMyFollowerCount()];
    await drain(); settleContent(0, 'cached');
    pending('followers')[0].resolve({ total: 7 });
    await Promise.all(tasks);
    calls.length = 0;
  }
  return { clock, storage, calls, app, api, page, pending, settleContent, seed, writes };
}
const makePosts = prefix => Array.from({ length: 5 }, (_, i) => ({ _id: `${prefix}-${i}`, _openid: 'me', title: prefix }));
const ids = posts => Array.from(posts, post => post._id);

async function testCachedFirstAndIndependentFollowers() {
  const app = runtime();
  await app.seed(); app.clock.now += 61000;
  const page = app.page();
  const loading = page.checkLoginAndFetchData();
  assert.equal(page.hasInitialSnapshot, true, '缓存在网络请求完成前同步展示');
  assert.equal(page.userInfo.nickName, 'cached');
  assert.equal(page.followerCount, 7);
  assert.deepEqual(ids(page.myPosts), ids(makePosts('cached')));
  await drain();
  assert.equal(app.calls.length, 3, '过期后资料、帖子和计数各刷新一次');
  app.settleContent();
  await loading;
  assert.equal(page.userInfo.nickName, 'new');
  assert.deepEqual(ids(page.myPosts), ids(makePosts('new')));
  assert.equal(page.isAtomicRefreshing, false, '粉丝请求仍未返回时列表已可交互');
  assert.equal(page.followerCount, 7);
  app.pending('followers')[0].resolve({ total: 19 }); await drain();
  assert.equal(page.followerCount, 19, '后台新计数单独更新');

  const pagination = page.loadMyPosts(); await drain();
  app.pending('posts').at(-1).resolve({ posts: makePosts('older') }); await pagination;
  assert.equal(page.page, 2);
  const posts = page.myPosts, calls = app.calls.length;
  page.onShow(); await drain();
  assert.equal(page.myPosts, posts, '短时返回保留已加载的多页列表及引用');
  assert.equal(page.page, 2);
  assert.equal(app.calls.length, calls, '60 秒内返回命中缓存，不重复云请求');
  app.clock.now += 61000;
  page.swiperHeights = { 0: 123 };
  const heights = page.swiperHeights, agedStart = app.calls.length;
  page.onShow(); await drain();
  assert.equal(app.pending('posts', agedStart).length, 0, '翻页后长时返回只后台刷新头部，不改变 offset 分页边界');
  assert.equal(app.calls.length - agedStart, 2, '资料和粉丝独立刷新');
  app.pending('header', agedStart)[0].resolve({ userInfo: { nickName: 'new profile' } });
  app.pending('followers', agedStart)[0].resolve({ total: 21 }); await drain();
  assert.equal(page.userInfo.nickName, 'new profile');
  assert.equal(page.followerCount, 21);
  assert.equal(page.myPosts, posts);
  assert.equal(page.swiperHeights, heights, '回页保留已测量的图片布局');
  assert.equal(page.page, 2);
  const start = app.calls.length;
  const refresh = page.refreshProfileAtomically({ reason: 'pull-down', forceRefresh: true });
  await drain();
  assert.equal(app.calls.length - start, 3, '主动刷新绕过所有新鲜网络缓存');
  assert.equal(page.myPosts, posts, '主动刷新期间仍显示已有内容');
  app.pending('followers', start)[0].resolve({ total: 23 }); await drain();
  assert.equal(page.followerCount, 23);
  app.settleContent(start, 'latest');
  await refresh;
  assert.equal(page.followerCount, 23, '头部快照迟到不会覆盖已更新的计数');
}

async function testSessionAndFailure() {
  const app = runtime(), page = app.page();
  const loading = page.checkLoginAndFetchData();
  assert.equal(page.hasInitialSnapshot, true, '没有帖子缓存也先显示当前账号头部');
  assert.equal(page.userInfo.nickName, '本地名字');
  assert.equal(page.isAtomicRefreshing, true, '空列表继续显示加载提示');
  await drain();
  app.pending('header')[0].reject(new Error('offline'));
  app.pending('posts')[0].reject(new Error('offline'));
  app.pending('followers')[0].reject(new Error('offline'));
  await loading; await drain();
  assert.equal(page.userInfo.nickName, '本地名字');
  assert.equal(page.postsLoadError, true, '失败与成功的空列表区分');

  const cached = runtime(); await cached.seed(); cached.clock.now += 61000;
  const cachedPage = cached.page(); const refresh = cachedPage.checkLoginAndFetchData(); await drain();
  cached.pending('header')[0].reject(new Error('offline'));
  cached.pending('posts')[0].reject(new Error('offline'));
  cached.pending('followers')[0].reject(new Error('offline'));
  await refresh; await drain();
  assert.equal(cachedPage.myPosts.length, 5, '刷新失败不清空已显示的帖子');
  assert.equal(cachedPage.followerCount, 7);
  const reopened = cached.page();
  const reopening = reopened.checkLoginAndFetchData();
  assert.deepEqual(ids(reopened.myPosts), ids(makePosts('cached')),
    '网络强刷失败后重新进入页面仍可立即读取成功快照');
  await drain();
  for (const request of cached.calls) request.reject(new Error('still offline'));
  await reopening; await drain();
  assert.equal(reopened.myPosts.length, 5);
}

async function testLatestResponseAndUnload() {
  const app = runtime(), page = app.page();
  const older = page.refreshProfileAtomically({ forceRefresh: true }); await drain();
  const from = app.calls.length;
  const newer = page.refreshProfileAtomically({ forceRefresh: true }); await drain();
  app.settleContent(from, 'newest');
  app.pending('followers', from)[0].resolve({ total: 40 });
  await newer; await drain();
  app.pending('header')[0].resolve({ userInfo: { nickName: 'obsolete' } });
  app.pending('posts')[0].resolve({ posts: makePosts('obsolete') });
  app.pending('followers')[0].resolve({ total: 1 });
  await older; await drain();
  assert.equal(page.userInfo.nickName, 'newest');
  assert.equal(page.followerCount, 40);
  assert.deepEqual(ids(app.api.getCachedMyProfile({ pageSize: 5 }).posts), ids(makePosts('newest')),
    '迟到请求也不能污染下次进页面的展示缓存');

  const start = app.calls.length;
  const leaving = page.refreshProfileAtomically({ forceRefresh: true }); await drain();
  page.onUnload(); const writes = app.writes.length;
  app.settleContent(start, 'after-unload');
  app.pending('followers', start)[0].resolve({ total: 99 }); await leaving; await drain();
  assert.equal(page.userInfo.nickName, 'newest');
  assert.equal(page.followerCount, 40);
  assert.equal(app.writes.length, writes, '卸载后的响应不再同步用户会话');
}

async function testAccountIsolationAndInvalidation() {
  const app = runtime(); await app.seed();
  const page = app.page(); await page.checkLoginAndFetchData();
  const pending = page.refreshProfileAtomically({ forceRefresh: true }); await drain();
  app.app.globalData.openid = 'other';
  app.app.globalData.userInfo = { _openid: 'other', nickName: '另一个账号' };
  const from = app.calls.length;
  const next = page.checkLoginAndFetchData();
  assert.equal(page.userInfo.nickName, '另一个账号');
  assert.equal(page.myPosts.length, 0);
  assert.equal(page.followerCount, 0, '账号切换不显示前一人的粉丝数');
  assert.equal(app.api.getCachedMyProfile({ pageSize: 5 }).posts, undefined);
  await drain();
  for (const request of app.calls.slice(0, from)) {
    request.resolve(request.name === 'follow' ? { total: 99 }
      : request.payload.limit === undefined ? { userInfo: { nickName: '旧账号' } } : { posts: makePosts('private') });
  }
  await pending; await drain();
  assert.equal(page.userInfo.nickName, '另一个账号');
  assert.equal(page.myPosts.length, 0);
  app.settleContent(from, 'other-fresh'); app.pending('followers', from)[0].resolve({ total: 2 });
  await next; await drain();
  assert.equal(page.userInfo._openid, 'other');
  assert.equal(page.followerCount, 2);
  app.api.invalidateMyInfo(); app.api.invalidateMyPosts();
  const cached = app.api.getCachedMyProfile({ pageSize: 5 });
  assert.equal(cached.userInfo, undefined, '资料失效同步清除展示快照');
  assert.equal(cached.posts, undefined, '删帖等失效操作不会从展示快照复活旧帖子');
}

async function testLogoutClearsVisibleData() {
  for (const nextId of ['anonymous', null]) {
    const app = runtime(); await app.seed();
    const page = app.page(); await page.checkLoginAndFetchData();
    const old = page.refreshProfileAtomically({ forceRefresh: true }); await drain();
    app.app.globalData.openid = nextId;
    app.app.globalData.userInfo = null;
    page.onShow();
    assert.equal(Object.keys(page.userInfo).length, 0, '没有新 session 的登出也立即清除头部');
    assert.equal(page.myPosts.length, 0);
    assert.equal(page.followerCount, 0);
    const writes = app.writes.length;
    app.settleContent(0, 'late-private');
    app.pending('followers')[0].resolve({ total: 88 });
    await old; await drain();
    assert.equal(page.myPosts.length, 0, '登出前的迟到响应不得恢复前账号数据');
    assert.equal(Object.keys(page.userInfo).length, 0);
    assert.equal(page.followerCount, 0);
    assert.equal(app.writes.length, writes);
  }
}

(async () => {
  for (const test of [testCachedFirstAndIndependentFollowers, testSessionAndFailure,
    testLatestResponseAndUnload, testAccountIsolationAndInvalidation, testLogoutClearsVisibleData]) {
    await test(); console.log(`PASS ${test.name}`);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
