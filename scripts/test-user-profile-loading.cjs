const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parse } = require('@babel/parser');

const source = fs.readFileSync(path.join(__dirname, '../pages-user/user-profile/user-profile.vue'), 'utf8')
  .match(/<script>([\s\S]*?)<\/script>/)[1];
const options = parse(source, { sourceType: 'module' }).program.body
  .find(node => node.type === 'ExportDefaultDeclaration').declaration;
const quiet = { log() {}, warn() {}, error() {} };
const user = () => ({ nickName: '作者', avatarUrl: '/avatar.png' });
const post = id => ({ _id: id, title: id, content: '诗歌', createTime: 1, isPoem: true, isOriginal: true });
const tab = value => ({ currentTarget: { dataset: { tab: value } } });
const tick = () => new Promise(resolve => setImmediate(resolve));

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function runtime(overrides = {}) {
  const calls = { info: [], posts: [], portfolios: [], urls: [], invalidations: [], writes: [], stopped: 0 };
  const services = {
    info: async () => user(), posts: async () => [post('first')],
    portfolios: async () => [], urls: async () => ({}),
    ...overrides
  };
  const invalidate = key => userId => calls.invalidations.push([key, userId]);
  const component = vm.runInNewContext(`(${source.slice(options.start, options.end)})`, {
    console: quiet, PAGE_SIZE: 5,
    skeleton: {}, TimelineView: {}, PortfolioBook: {}, PostItem: {}, postGalleryMixin: {}, favoriteRefresh: {},
    getUserInfo(userId, context) { calls.info.push({ userId, context }); return services.info(); },
    getUserPosts(query) { calls.posts.push(query); return services.posts(query); },
    getUserPortfolios(userId, context) { calls.portfolios.push({ userId, context }); return services.portfolios(); },
    getUserFavorites: async () => [], captureFavoriteRead: () => () => true,
    fileUrlCache: { getTempUrls(ids) { calls.urls.push(ids); return services.urls(ids); } },
    hydrateTempUrls: async posts => posts, warmTempUrlsFromPosts() {},
    normalizeAppBackgroundMode: value => value || '',
    extractGrowthStats: () => ({ seed: 0, leaf: 0, flower: 0, peach: 0 }),
    resolvePostAuthorAvatar: () => '/avatar.png', formatRelativeTime: () => '刚刚',
    processPostsForTimeline: posts => posts, groupPostsByMonth: posts => ({ month: posts }),
    avatarCache: { updateUserAvatar() {} },
    invalidateUserInfo: invalidate('info'), invalidateUserPosts: invalidate('posts'),
    invalidateUserPortfolios: invalidate('portfolios'), invalidateUserFavorites: invalidate('favorites'),
    uni: { showToast() {}, setNavigationBarTitle() {}, stopPullDownRefresh() { calls.stopped++; } }
  });
  const page = {
    ...component.data(), ...component.methods, targetUserId: 'author',
    setData(value) { calls.writes.push(value); Object.assign(this, value); },
    prepareFollowStateWithCache() {}, prepareBlockState() {}, fetchFollowCounts() {},
    clearH5PageShellRecoveryTimers() {}
  };
  return { page, calls, component, services };
}

async function main() {
  {
    const info = deferred(), posts = deferred(), portfolios = deferred(), urls = deferred(), timeline = deferred();
    const { page, calls } = runtime({
      info: () => info.promise, posts: query => query.pageSize === 1000 ? timeline.promise : posts.promise,
      portfolios: () => portfolios.promise, urls: () => urls.promise
    });
    const initial = page.loadUserProfile();
    assert.equal(page.isLoading, true);
    assert.equal(calls.portfolios.length, 0, 'opening posts must not request hidden portfolios');
    info.resolve(user()); posts.resolve([post('first')]);
    await initial;
    assert.equal(page.isLoading, false, 'profile and posts can finish while portfolio services remain deferred');
    assert.equal(page.userPosts[0]._id, 'first');
    assert.equal(calls.urls.length, 0, 'hidden portfolio covers must not consume first-screen URL work');

    const visiblePortfolio = page.switchTab(tab('portfolio'));
    assert.equal(calls.portfolios.length, 1);
    assert.equal(calls.portfolios[0].context, page, 'preserve the App request context');
    assert.equal(page.portfolioLoading, true);
    assert.equal(page.isLoading, false, 'a slow visible portfolio never restores the full-page skeleton');
    await page.switchTab(tab('posts'));
    await page.switchTab(tab('portfolio'));
    assert.equal(calls.portfolios.length, 1, 'switching back during a request must not submit it twice');
    portfolios.resolve([{ _id: 'book', cover: 'cloud://cover', postsCount: 3 }]);
    await tick();
    assert.equal(calls.urls.length, 1);
    assert.equal(page.portfolioLoading, true, 'cover hydration is tracked by the portfolio spinner');
    assert.equal(page.userPosts[0]._id, 'first');
    urls.resolve({ 'cloud://cover': 'https://images.example/cover' });
    timeline.resolve([post('timeline')]);
    await visiblePortfolio;
    assert.equal(page.portfolioList[0].coverImage, 'https://images.example/cover');
    assert.equal(page.portfolioList[0].postCount, 3);
    assert.equal(page.portfolioHasEverLoaded, true);
    await page.switchTab(tab('posts'));
    await page.switchTab(tab('portfolio'));
    assert.equal(calls.portfolios.length, 1, 'successfully loaded portfolios are reused on tab switches');
  }

  {
    const failed = deferred();
    const { page, calls, services } = runtime({ portfolios: () => failed.promise });
    await page.loadUserProfile();
    const pending = page.switchTab(tab('portfolio'));
    failed.reject(new Error('offline'));
    await pending;
    assert.equal(page.portfolioLoading, false);
    assert.equal(page.portfolioError, true);
    assert.equal(page.portfolioHasEverLoaded, false, 'a failed request cannot be cached as an empty success');
    services.portfolios = async () => [];
    await page.loadUserPortfolios();
    assert.equal(calls.portfolios.length, 2, 'the visible retry action issues a fresh request');
    assert.equal(page.portfolioError, false);
    assert.equal(page.portfolioHasEverLoaded, true, 'an empty successful portfolio is a completed load');
    await page.switchTab(tab('posts'));
    await page.switchTab(tab('portfolio'));
    assert.equal(calls.portfolios.length, 2, 'an empty successful portfolio is reused too');
  }

  {
    const oldPortfolio = deferred();
    const { page, calls, component } = runtime({ portfolios: () => oldPortfolio.promise });
    await page.loadUserProfile();
    const previous = page.switchTab(tab('portfolio'));
    await page.switchTab(tab('posts'));
    await component.onPullDownRefresh.call(page);
    assert.equal(calls.portfolios.length, 1, 'refreshing posts keeps hidden portfolios lazy');
    assert.equal(calls.stopped, 1);
    assert.equal(calls.invalidations.length, 4);
    const writes = calls.writes.length;
    oldPortfolio.resolve([{ _id: 'stale', coverImage: 'cloud://stale' }]);
    await previous;
    assert.equal(calls.writes.length, writes, 'a pre-refresh portfolio cannot write into the refreshed page');
    assert.equal(calls.urls.length, 0, 'cancelled portfolio data must not start cover requests');
    assert.equal(page.portfolioHasEverLoaded, false);
  }

  {
    const freshPortfolio = deferred(), timeline = deferred();
    const { page, calls, component } = runtime({
      portfolios: () => freshPortfolio.promise,
      posts: async query => query.pageSize === 1000 ? timeline.promise : [post('refreshed')]
    });
    Object.assign(page, {
      currentTab: 'portfolio', portfolioHasEverLoaded: true, portfolioList: [{ _id: 'old' }],
      timelinePosts: [post('old-timeline')], timelineGroups: { old: [] }, collapsedMonths: { old: true }
    });
    const refresh = component.onPullDownRefresh.call(page);
    await tick();
    assert.equal(page.isLoading, false, 'the refreshed header and posts are rendered before portfolio work finishes');
    assert.equal(page.userPosts[0]._id, 'refreshed');
    assert.equal(calls.portfolios.length, 1, 'refresh reloads the current portfolio tab');
    assert.equal(page.timelinePosts.length, 0, 'refresh discards the stale timeline');
    assert.equal(Object.keys(page.collapsedMonths).length, 0);
    assert.equal(calls.stopped, 0, 'pull refresh stays pending until visible tab data settles');
    freshPortfolio.resolve([{ _id: 'fresh-book' }]); timeline.resolve([post('fresh-timeline')]);
    await refresh;
    assert.equal(page.portfolioList[0]._id, 'fresh-book');
    assert.equal(page.timelinePosts[0]._id, 'fresh-timeline');
    assert.equal(calls.stopped, 1);
  }

  {
    const firstInfo = deferred(), firstPosts = deferred(), nextInfo = deferred(), nextPosts = deferred();
    const { page, calls, component, services } = runtime({
      info: () => firstInfo.promise, posts: () => firstPosts.promise
    });
    const firstRefresh = component.onPullDownRefresh.call(page);
    services.info = () => nextInfo.promise;
    services.posts = () => nextPosts.promise;
    const nextRefresh = component.onPullDownRefresh.call(page);
    firstInfo.resolve(user()); firstPosts.resolve([post('stale-first-screen')]);
    await firstRefresh;
    assert.equal(calls.stopped, 0, 'a superseded first-screen request cannot stop the newer refresh');
    nextInfo.resolve(user()); nextPosts.resolve([post('latest-first-screen')]);
    await nextRefresh;
    assert.equal(page.userPosts[0]._id, 'latest-first-screen');
    assert.equal(calls.stopped, 1, 'only the current completed request stops pull refresh');
  }

  {
    const firstPortfolio = deferred(), firstTimeline = deferred(), nextPortfolio = deferred(), nextTimeline = deferred();
    const { page, calls, component, services } = runtime({
      portfolios: () => firstPortfolio.promise,
      posts: async query => query.pageSize === 1000 ? firstTimeline.promise : [post('first')]
    });
    page.currentTab = 'portfolio';
    const firstRefresh = component.onPullDownRefresh.call(page);
    await tick();
    assert.equal(calls.portfolios.length, 1);
    services.portfolios = () => nextPortfolio.promise;
    services.posts = async query => query.pageSize === 1000 ? nextTimeline.promise : [post('latest')];
    const nextRefresh = component.onPullDownRefresh.call(page);
    await tick();
    assert.equal(calls.portfolios.length, 2);
    firstPortfolio.resolve([{ _id: 'stale-book' }]); firstTimeline.resolve([post('stale-timeline')]);
    await firstRefresh;
    assert.equal(calls.stopped, 0, 'a superseded refresh waiting for child requests cannot stop the newer refresh');
    assert.equal(page.portfolioLoading, true);
    nextPortfolio.resolve([{ _id: 'latest-book' }]); nextTimeline.resolve([post('latest-timeline')]);
    await nextRefresh;
    assert.equal(page.portfolioList[0]._id, 'latest-book');
    assert.equal(page.timelinePosts[0]._id, 'latest-timeline');
    assert.equal(calls.stopped, 1, 'the latest refresh stops normally after its visible children complete');
  }

  {
    const info = deferred(), posts = deferred();
    const { page, calls, component } = runtime({ info: () => info.promise, posts: () => posts.promise });
    const initial = component.onPullDownRefresh.call(page);
    component.onUnload.call(page);
    const writes = calls.writes.length;
    info.resolve(user()); posts.resolve([post('late')]);
    await initial;
    assert.equal(calls.writes.length, writes, 'unloading rejects late first-screen results and finally-state writes');
    assert.equal(calls.portfolios.length, 0, 'an unloaded page cannot start hidden child requests');
    assert.equal(calls.stopped, 0, 'an unloaded first-screen request cannot stop another page\'s pull refresh');
  }

  {
    const portfolios = deferred(), timeline = deferred();
    const { page, calls, component } = runtime({
      portfolios: () => portfolios.promise,
      posts: async query => query.pageSize === 1000 ? timeline.promise : [post('first')]
    });
    page.currentTab = 'portfolio';
    const refresh = component.onPullDownRefresh.call(page);
    await tick();
    assert.equal(calls.portfolios.length, 1, 'unload occurs while the refresh awaits visible child requests');
    component.onUnload.call(page);
    const writes = calls.writes.length;
    portfolios.resolve([{ _id: 'late-book' }]); timeline.resolve([post('late-timeline')]);
    await refresh;
    assert.equal(calls.writes.length, writes);
    assert.equal(calls.stopped, 0, 'unloading while waiting for children must not stop another page\'s pull refresh');
  }

  {
    const urls = deferred();
    const { page, calls, component } = runtime({
      portfolios: async () => [{ _id: 'late', coverImage: 'cloud://late' }], urls: () => urls.promise
    });
    await page.loadUserProfile();
    const pending = page.switchTab(tab('portfolio'));
    await tick();
    assert.equal(calls.urls.length, 1);
    component.onUnload.call(page);
    const writes = calls.writes.length;
    urls.resolve({ 'cloud://late': 'https://images.example/late' });
    await pending;
    assert.equal(calls.writes.length, writes, 'unloading during cover hydration rejects the data and spinner writes');
    assert.equal(page.portfolioList.length, 0);
  }

  console.log('[test-user-profile-loading] PASS: lazy first screen, deferred covers, tab deduplication, empty reuse, retry, active-tab refresh and stale/unloaded data and callback protection');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
