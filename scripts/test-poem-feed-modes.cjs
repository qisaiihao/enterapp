const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { load } = require('./test-splash-startup.cjs');

const drain = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

function runtime() {
  const requests = [], scrolls = [], invalidations = [], storage = new Map(), toasts = [];
  const control = { original: null, reading: null, following: null, hydrate: null };
  const fetch = mode => options => {
    requests.push({ mode, options });
    return control[mode]?.promise || Promise.resolve([{ _id: mode, content: mode }]);
  };
  const component = load('pages/poem-square/poem-square.vue', {
    clearTimeout, setTimeout, ORIGINAL_POEMS_PAGE_SIZE: 10,
    uni: {
      getStorageSync: key => storage.get(key),
      removeStorageSync: key => storage.delete(key),
      pageScrollTo: value => scrolls.push(value.scrollTop),
      stopPullDownRefresh() {}, showToast: options => toasts.push(options.title)
    },
    cacheManager: { namespace: () => ({ get: () => undefined }) },
    peekMountainPoems: () => undefined,
    getOriginalPoems: fetch('original'), getMountainPoems: fetch('reading'), getFollowingPoems: fetch('following'),
    invalidatePostList: options => invalidations.push(options), invalidateFollowingPoems() {},
    getLatestLikeStatus: () => null,
    isUserLoggedIn: () => true,
    togglePostLike: () => control.vote.promise,
    likeIcon: { getLikeIcon: () => 'like' },
    generateRandomBackgroundColor: () => ({ index: 0, color: '#fff' }),
    attachPoemDisplayFields: post => ({ displayContent: post.content, displayHighlightLines: [], displaySeriesPoems: [] }),
    formatErrorForLog: String
  });
  const page = component.data();
  page.$refs = {};
  page.$nextTick = callback => callback();
  for (const [key, method] of Object.entries(component.methods)) page[key] = method.bind(page);
  for (const [key, getter] of Object.entries(component.computed)) Object.defineProperty(page, key, { get: () => getter.call(page) });
  page.convertCloudUrls = async () => { if (control.hydrate) await control.hydrate.promise; };
  return { page, component, control, requests, scrolls, invalidations, storage, toasts };
}

async function testModesAndFilters() {
  const app = runtime(), { page } = app;
  page.getIndexData(); await drain();
  assert.equal(page.postList[0]._id, 'original');
  page.showFollowingOnly = true;
  page.followingSelectedUserId = 'poet-user';
  page.getIndexData(); await drain();
  assert.equal(app.requests.at(-1).mode, 'following');
  assert.equal(app.requests.at(-1).options.filterByUserId, 'poet-user');
  page._poemScrollTop = 480;
  page.togglePoemMode(); await drain();
  assert.equal(page.isReadingMode, true);
  assert.equal(app.requests.at(-1).mode, 'reading', '读诗不使用原创关注筛选');
  assert.equal(page.postList[0]._id, 'reading');
  page.onPoetSelect('海子'); await drain();
  assert.equal(app.requests.at(-1).options.filterByPoet, '海子');
  page._poemScrollTop = 760;
  const requestCount = app.requests.length;
  page.togglePoemMode(); await drain();
  assert.equal(page.postList[0]._id, 'following');
  assert.equal(page.followingSelectedUserId, 'poet-user');
  assert.equal(app.scrolls.at(-1), 480);
  page.togglePoemMode(); await drain();
  assert.equal(page.selectedPoetName, '海子');
  assert.equal(app.scrolls.at(-1), 760);
  assert.equal(app.requests.length, requestCount, '已加载模式恢复列表和分页，不重复请求');
  app.control.reading = deferred();
  page.getPostList(); await drain();
  assert.equal(page.isLoadingMore, true);
  page.togglePoemMode(); await drain();
  app.control.reading.resolve([{ _id: 'late-pagination' }]); await drain();
  app.control.reading = null;
  page.togglePoemMode(); await drain();
  assert.equal(page.postList[0]._id, 'reading', '加载更多期间切换仍保留已读列表');
  assert.equal(page.page, 1);
  assert.equal(page.isLoadingMore, false);
  let poetRefreshes = 0;
  page.$refs.poetAvatarBar = { refresh() { poetRefreshes++; } };
  app.component.onPullDownRefresh.call(page); await drain();
  assert.equal(app.invalidations[0].isOriginal, false);
  assert.equal(app.invalidations[0].excludeAnonymous, true);
  assert.equal(poetRefreshes, 1);
}

async function testLateResponses() {
  for (const delayAt of ['request', 'hydrate']) {
    const app = runtime(), { page, control } = app;
    const pending = deferred();
    if (delayAt === 'request') control.original = pending;
    else control.hydrate = pending;
    page.getIndexData(); await drain();
    control.hydrate = null;
    page.togglePoemMode(); await drain();
    assert.equal(page.postList[0]._id, 'reading');
    pending.resolve([{ _id: 'late-original' }]); await drain();
    assert.equal(page.postList[0]._id, 'reading', `${delayAt}: 原创迟到结果不能覆盖读诗`);
    assert.equal(page.page, 1);
    assert.equal(page.isLoading, false);
  }
  const app = runtime(), { page, control } = app;
  page.poemMode = 'reading';
  control.reading = deferred();
  page.onPoetSelect('海子'); await drain();
  const old = control.reading;
  control.reading = null;
  page.onPoetSelect('顾城'); await drain();
  old.resolve([{ _id: 'old-poet' }]); await drain();
  assert.equal(page.postList[0]._id, 'reading', '上一位诗人的结果不能覆盖新筛选');
  const staleUpdate = app.requests[0].options.onBackgroundUpdate;
  staleUpdate([{ _id: 'stale-swr' }]); await drain();
  assert.equal(page.postList[0]._id, 'reading', '旧筛选的后台更新保持隔离');
}

async function testNavigation() {
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, '../pages.json'), 'utf8'));
  assert.deepEqual(config.tabBar.list.map(item => item.text), ['广场', '诗歌', '活动', '我']);
  assert.equal(config.tabBar.list[2].pagePath, 'pages/activity/activity');
  const calls = [], saved = new Map();
  const uni = { switchTab: options => calls.push(options.url), setStorageSync: (key, value) => saved.set(key, value) };
  load('pages/mountain/mountain.vue', { uni }).onLoad();
  assert.equal(saved.get('poemFeed:openMode'), 'reading');
  assert.equal(calls.pop(), '/pages/poem-square/poem-square');
  load('pages-content/activity-list/activity-list.vue', { uni }).onLoad();
  assert.equal(calls.pop(), '/pages/activity/activity');
  let selected, seen = 0;
  const activity = load('pages/activity/activity.vue', {
    uni: { hideTabBar() {} }, updateTabBarStatus: (_, value) => { selected = value; },
    activityBadge: { markActivitySeen() { seen++; } }
  });
  activity.onShow.call({ fetchNotices() {} });
  assert.equal(selected, 2);
  assert.equal(seen, 1);
  for (const mode of ['original', 'reading']) {
    const publisher = load('pages-publish/add/add.vue', {
      getCurrentPages: () => [{ route: 'pages/poem-square/poem-square', $vm: { poemMode: mode } }, {}]
    });
    const composer = { imageList: ['cover', 'extra'], setData(value) { Object.assign(this, value); } };
    publisher.methods.setDefaultPublishMode.call(composer);
    assert.equal(composer.publishMode, 'poem');
    assert.equal(composer.isOriginal, mode === 'original', '发布入口沿用当前诗歌模式');
    assert.equal(composer.imageList.length, 1);
  }
}

async function testLikeDuringModeSwitch() {
  for (const success of [true, false]) {
    const { page, control } = runtime();
    page.getIndexData(); await drain();
    control.vote = deferred();
    page.onVote({ postId: 'original', index: 0 });
    assert.equal(page.postList[0].votes, 1);
    page.togglePoemMode(); await drain();
    control.vote.resolve({ success, votes: 1, isLiked: true, likeIcon: 'like' }); await drain();
    assert.equal(page.postList[0]._id, 'reading');
    page.togglePoemMode(); await drain();
    assert.equal(page.postList[0].votes, success ? 1 : 0, '切换期间点赞结果仍更新对应模式');
    assert.equal(page.postList[0].isVoted, success);
  }
}

(async () => {
  for (const test of [testModesAndFilters, testLateResponses, testNavigation, testLikeDuringModeSwitch]) {
    await test(); console.log('PASS ' + test.name);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
