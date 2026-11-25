const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const cloud = require('wx-server-sdk');
const { memoryDb } = require('./helpers/posts-memory-db.cjs');
const { load, fakeTime, deferred, drain } = require('./test-splash-startup.cjs');
cloud.init({ env: 'home-ranking-test' });
const quiet = { log() {}, warn() {}, error() {} };

function createHomeFeed(posts, options) {
  const mem = memoryDb({ posts, users: [], votes_log: [] }, cloud.database().command, options);
  const filename = path.resolve(__dirname, '../functions/getPostList/index.js');
  const localRequire = createRequire(filename);
  const scope = { exports: {}, Date, console: quiet, require(id) {
    if (id === 'wx-server-sdk') return { init() {}, database: () => mem.db, getWXContext: () => ({ OPENID: 'viewer' }) };
    if (id.includes('get-blocked-user-ids')) return async () => ['blocked-user'];
    return localRequire(id);
  } };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), scope, { filename });
  const run = async options => {
    const result = await scope.exports.main(options);
    assert.equal(result.success, true, JSON.stringify(result));
    assert.ok(result.posts.every(row => !('homeSortTime' in row)), '内部排序字段不泄漏到响应');
    return Array.from(result.posts, row => row._id);
  };
  return { mem, run };
}

async function testRankingAndPagination() {
  const hour = 3600000, now = Date.UTC(2026, 8, 29);
  const post = (_id, age, fields = {}) => ({ _id, createTime: new Date(now - age * hour), ...fields });
  const posts = [
    post('poem-new', 0, { isPoem: true }),
    post('normal-recent', 12, { isPoem: false, isDiscussion: false }),
    post('normal-old', 48),
    post('discussion', 1, { isDiscussion: true }),
    post('v2-poem', 2, { schemaVersion: 2, publishMode: 'poem' }),
    post('v2-discussion', 3, { schemaVersion: 2, publishMode: 'discussion' }),
    post('v2-normal', 13, { schemaVersion: 2, publishMode: 'normal' }),
    post('normal-legacy', 14),
    post('normal-null', 15, { isPoem: null, isDiscussion: null }),
    post('tie-a', 16), post('tie-z', 16),
    post('hidden', 0, { isHidden: true }),
    post('activity', 0, { isActivityPost: true }),
    post('blocked', 0, { _openid: 'blocked-user' })
  ];
  const { mem, run } = createHomeFeed(posts);
  const expected = ['normal-recent', 'v2-normal', 'normal-legacy', 'normal-null', 'tie-z', 'tie-a',
    'poem-new', 'discussion', 'v2-poem', 'v2-discussion', 'normal-old'];
  assert.deepEqual(await run({ homeRanking: true, limit: 50 }), expected);
  const paged = [];
  for (let skip = 0; skip < 15; skip += 3) paged.push(...await run({ homeRanking: true, skip, limit: 3 }));
  assert.deepEqual(paged, expected, '跨页顺序稳定、无重复遗漏，并遵守自定义页大小');
  assert.deepEqual(await run({ homeRanking: true, limit: 50 }), expected, '刷新不再随机打乱');
  assert.deepEqual(await run({ homeRanking: true, isPoem: true, limit: 50 }), ['poem-new', 'v2-poem'], '筛选诗歌仍按时间');
  assert.deepEqual(await run({ homeRanking: true, isPoem: false, isDiscussion: false, limit: 50 }),
    ['normal-recent', 'v2-normal', 'normal-legacy', 'normal-null', 'tie-a', 'tie-z', 'normal-old']);
  const countBefore = mem.calls.length;
  await run({ limit: 10 });
  assert.ok(mem.calls.slice(countBefore).some(call => call.stages?.some(([op]) => op === 'count')),
    '未指定首页排序的调用继续使用原有随机混排');
  assert.ok(mem.tables.posts.every(row => !('homeSortTime' in row)), '排序不改写数据库');
}

async function testMixedRankingAndRefresh() {
  const latest = Array.from({ length: 6 }, (_, i) => ({ _id: `latest-${i}`, createTime: new Date(Date.UTC(2026, 10, 25, -i)), votes: 1000 }));
  const older = Array.from({ length: 25 }, (_, i) => ({ _id: `older-${i}`, createTime: new Date(Date.UTC(2026, 10, 22, -i)), votes: 100 - i }));
  const excluded = [
    { isHidden: true }, { schemaVersion: 2, activityId: 'activity' }, { isDeleted: true },
    { auditStatus: 'pending' }, { auditStatus: 'rejected' }, { visibility: 'self' },
    { visibility: 'society' }, { visibility: 'scheduled', hideAt: 1 },
    { _openid: 'blocked-user' }, { isAnonymous: true, realAuthorOpenid: 'blocked-user' }
  ].map((post, i) => ({ ...post, _id: `excluded-${i}`, createTime: new Date(Date.UTC(2026, 10, 26)), votes: 9999 }));
  const posts = [...latest, ...older, ...excluded];
  const mix = { homeRanking: true, homeMix: true };
  const { mem, run } = createHomeFeed(posts, { random: () => 0.999 });
  const first = await run(mix);
  assert.deepEqual([0, 1, 3, 5, 7, 9].map(index => first[index]), latest.map(post => post._id));
  assert.equal(first[4], 'older-0', '高赞位使用剩余候选中点赞数最高的帖子');
  assert.deepEqual([2, 6, 8].map(index => first[index]), ['older-1', 'older-2', 'older-3']);
  assert.equal(new Set(first).size, 10);
  assert.equal(mem.calls.filter(call => call.name === 'posts' && call.op === 'aggregate').length, 3);

  const refreshed = await run({ ...mix, previousPostIds: first });
  assert.deepEqual([0, 1, 3, 5, 7, 9].map(index => refreshed[index]), older.slice(4, 10).map(post => post._id));
  assert.deepEqual([2, 4, 6, 8].map(index => refreshed[index]), ['older-11', 'older-10', 'older-12', 'older-13']);
  assert.equal(new Set(refreshed).size, 10);
  assert.ok(refreshed.every(id => !first.includes(id)), '手动刷新换掉整个首批');
  const refreshedAgain = await run({ ...mix, previousPostIds: refreshed });
  assert.equal(refreshedAgain.length, 10);
  assert.ok(refreshedAgain.every(id => !refreshed.includes(id)), '连续刷新也与紧邻的上一批完全不同');

  const loaded = [...refreshed];
  for (const skip of [10, 20, 30, 40]) {
    const next = await run({ ...mix, skip, excludePostIds: loaded });
    assert.ok(next.every(id => !loaded.includes(id)), '后续批次跳过本轮列表已经加载的帖子');
    loaded.push(...next);
  }
  assert.deepEqual([...loaded].sort(), [...latest, ...older].map(post => post._id).sort(), '翻页可完整遍历公开候选');
  assert.ok(mem.calls.every(call => !['view_log', 'view_events'].includes(call.name)), '选帖不查询或写入浏览历史');

  const failure = createHomeFeed(posts, { beforeAggregate({ stages }) {
    if (stages.some(([op, value]) => op === 'sample' || (op === 'sort' && value.votes))) throw Error('推荐查询不可用');
  } });
  assert.deepEqual(await failure.run(mix), [...latest, ...older.slice(0, 4)].map(post => post._id));
  const scarce = createHomeFeed([...latest, ...older.slice(0, 2)]);
  assert.equal((await scarce.run(mix)).length, 8);
  for (const available of [0, 4, 8, 10]) {
    const limited = createHomeFeed([...latest, ...older.slice(0, 4 + available)], { random: () => 0.999 });
    const previous = await limited.run(mix);
    const replacement = await limited.run({ ...mix, previousPostIds: previous });
    assert.equal(new Set(replacement).size, 10, '旧帖补位时保持整批去重');
    assert.ok(replacement.slice(0, available).every(id => !previous.includes(id)), '可换的帖子排在旧帖补位之前');
    assert.ok(replacement.slice(available).every(id => previous.includes(id)), '只在候选不足时补回必要数量的旧帖');
  }
  const noLikes = createHomeFeed(posts.map(post => ({ ...post, votes: 0 })), { random: () => 0.999 });
  assert.equal((await noLikes.run(mix)).length, 10, '没有高赞候选时仍可用其他帖子补齐');

  const randomMode = { ...mix, homeRandom: true };
  const randomFeed = createHomeFeed(posts, { random: () => 0 });
  const sampled = await randomFeed.run(randomMode);
  const [sampleQuery] = randomFeed.mem.calls.filter(call => call.name === 'posts' && call.op === 'aggregate');
  assert.equal(randomFeed.mem.calls.filter(call => call.name === 'posts' && call.op === 'aggregate').length, 1);
  assert.equal(sampleQuery.stages.find(([op]) => op === 'sample')[1].size, 10);
  assert.ok(!sampleQuery.stages.some(([op]) => op === 'sort'), '随机模式不分配时间或高赞位置');
  assert.equal(new Set(sampled).size, 10);
  assert.ok(sampled.every(id => !id.startsWith('excluded-')));

  const resampled = await randomFeed.run({ ...randomMode, previousPostIds: sampled });
  assert.equal(resampled.length, 10);
  assert.ok(resampled.every(id => !sampled.includes(id)));
  const randomNext = await randomFeed.run({ ...randomMode, skip: 10, excludePostIds: resampled });
  assert.equal(randomNext.length, 10);
  assert.ok(randomNext.every(id => !resampled.includes(id)));
  const smallRandomFeed = createHomeFeed([...latest, ...older.slice(0, 7)], { random: () => 0 });
  const firstRandom = await smallRandomFeed.run(randomMode);
  const secondRandom = await smallRandomFeed.run({ ...randomMode, previousPostIds: firstRandom });
  assert.equal(new Set(secondRandom).size, 10);
  assert.equal(secondRandom.filter(id => !firstRandom.includes(id)).length, 3);
}

async function testDefaultsAndCache() {
  for (const saved of [undefined, true, false, 'invalid']) {
    const page = load('pages/index/index.vue', { uni: { getStorageSync: () => saved } });
    assert.equal(page.data().showNormalPostsOnly, saved === true, '默认全部，保留明确保存的筛选偏好');
  }
  const failingStorage = load('pages/index/index.vue', { uni: { getStorageSync() { throw Error('unavailable'); } } });
  assert.equal(failingStorage.data().showNormalPostsOnly, false);
  const time = fakeTime(), storage = new Map(), calls = [];
  const base = { ...time.globals, uni: { getStorageSync: key => storage.get(key),
    setStorageSync: (key, value) => storage.set(key, value), removeStorageSync: key => storage.delete(key) } };
  const cacheManager = load('cache/core/manager.js', base);
  const keys = load('cache/core/key-builder.js', base, ['buildCacheKey', 'parseCacheKey']);
  const { withTimeout } = load('utils/asyncTimeout.js', base, ['withTimeout']);
  const home = load('api-cache/home-posts.js', { ...base, cacheManager, ...keys, withTimeout,
    cloudCall: async (name, payload) => {
      calls.push(payload);
      return { result: { success: true, posts: [{ _id: `response-${calls.length}` }] } };
    }
  }, ['getHomePosts', 'peekHomePosts', 'invalidateHomePosts']);
  const ns = cacheManager.namespace('posts:list');
  const oldKey = keys.buildCacheKey({ page: 0, pageSize: 10 });
  ns.set(oldKey, [{ _id: 'old-random' }], { ttlMs: 90000 });
  const rankedKey = keys.buildCacheKey({ page: 0, pageSize: 10, homeRanking: true });
  ns.set(rankedKey, [{ _id: 'ranked-only' }], { ttlMs: 90000 });
  assert.equal(home.peekHomePosts(), undefined, '新排序不读取旧版或其他页面的全部列表缓存');
  await home.getHomePosts();
  assert.equal(calls[0].homeRanking, true);
  assert.equal(calls[0].homeMix, true);
  assert.equal(home.peekHomePosts()[0]._id, 'response-1');
  await home.getHomePosts();
  assert.equal(calls.length, 1);
  await home.getHomePosts({ page: 1, excludePostIds: ['response-1'] });
  assert.equal(calls[1].skip, 10);
  assert.deepEqual(calls[1].excludePostIds, ['response-1']);
  assert.equal(home.peekHomePosts({ page: 1 }), undefined, '后续批次不缓存');
  const normal = { isPoem: false, isDiscussion: false };
  await home.getHomePosts(normal);
  assert.equal(calls[2].homeRanking, false);
  assert.equal(calls[2].homeMix, false);
  home.invalidateHomePosts();
  assert.equal(home.peekHomePosts(), undefined);
  assert.equal(home.peekHomePosts({ page: 1 }), undefined);
  assert.equal(home.peekHomePosts(normal)[0]._id, 'response-3');
  assert.equal(ns.get(oldKey)[0]._id, 'old-random', '失效仅针对首页排序缓存');
  await home.getHomePosts();
  await home.getHomePosts({ forceRefresh: true, previousPostIds: ['response-4'] });
  assert.deepEqual(calls[4].previousPostIds, ['response-4']);
  assert.equal(home.peekHomePosts()[0]._id, 'response-5');
  home.invalidateHomePosts({ page: 0 });
  assert.equal(home.peekHomePosts(), undefined);
  const parsed = keys.parseCacheKey(keys.buildCacheKey({ page: 2, pageSize: 10, homeRanking: true }));
  assert.equal(parsed.homeRanking, true);
  assert.equal(keys.parseCacheKey(keys.buildCacheKey({ page: 0, pageSize: 10, homeMix: true })).homeMix, true);

  const mixed = await home.getHomePosts();
  const random = await home.getHomePosts({ homeRandom: true, forceRefresh: true, previousPostIds: [mixed[0]._id] });
  const randomAgain = await home.getHomePosts({ homeRandom: true, previousPostIds: [random[0]._id] });
  assert.notEqual(random[0]._id, randomAgain[0]._id, '连续随机请求直接访问云端');
  assert.equal(calls.at(-1).homeRandom, true);
  assert.deepEqual(calls.at(-1).previousPostIds, [random[0]._id]);
  assert.equal(home.peekHomePosts()[0]._id, mixed[0]._id, '随机模式不读取、清除或覆盖混排首屏缓存');
  await home.getHomePosts({ homeRandom: true, page: 1, excludePostIds: [randomAgain[0]._id] });
  assert.equal(calls.at(-1).homeRandom, true);
  assert.deepEqual(calls.at(-1).excludePostIds, [randomAgain[0]._id]);
}

async function testPageRefreshWhileLoadingMore() {
  const firstPage = Array.from({ length: 10 }, (_, index) => ({ _id: `first-${index}` }));
  const refreshedPage = firstPage.map((_, index) => ({ _id: `new-${index}` }));
  const pendingMore = deferred();
  const pendingRefresh = deferred();
  const failedRefresh = deferred();
  const responses = [pendingMore, pendingRefresh, failedRefresh];
  const calls = [];
  const toasts = [];
  const { methods } = load('pages/index/index.vue', {
    ...fakeTime().globals,
    uni: { showToast: toast => toasts.push(toast.title) },
    invalidateHomePosts() {},
    processPostList: async posts => posts,
    getHomePosts: options => {
      calls.push(options);
      return responses.shift().promise;
    }
  });
  const page = {
    postList: firstPage, page: 1, hasMore: true,
    setData(data) { Object.assign(this, data); },
    preloadImages() {},
    getPostList: methods.getPostList
  };

  const loadingMore = page.getPostList();
  assert.deepEqual(calls[0].excludePostIds, firstPage.map(post => post._id));
  const refreshing = methods.onHomeRefresh.call(page);
  assert.equal(calls[1].page, 0);
  assert.equal(calls[1].forceRefresh, true);
  assert.equal(calls[1].excludePostIds, undefined);
  assert.deepEqual(calls[1].previousPostIds, firstPage.map(post => post._id));
  assert.equal(page.postList, firstPage, '下拉请求过程中继续显示当前列表');
  pendingRefresh.resolve(refreshedPage);
  await refreshing;
  pendingMore.resolve([{ _id: 'obsolete' }]);
  await loadingMore;
  assert.equal(page.postList, refreshedPage, '迟到的旧分页响应不能覆盖刷新结果');
  assert.equal(page.page, 1);
  assert.equal(page.isRefreshing, false);
  assert.equal(page.isLoadingMore, false);

  const retry = methods.onHomeRefresh.call(page);
  failedRefresh.reject(Error('offline'));
  await retry;
  assert.equal(page.postList, refreshedPage, '刷新失败不清空已显示的帖子');
  assert.equal(page.page, 1);
  assert.equal(page.isRefreshing, false);
  assert.deepEqual(toasts, ['网络错误']);
}

async function testRandomFilterOnHomePage() {
  const batch = name => Array.from({ length: 10 }, (_, index) => ({ _id: `${name}-${index}` }));
  const calls = [];
  const savedFilters = [];
  const source = load('pages/index/index.vue', {
    ...fakeTime().globals,
    uni: { getStorageSync() {}, setStorageSync: (key, value) => savedFilters.push([key, value]) },
    invalidateHomePosts() {},
    processPostList: async posts => posts,
    getHomePosts: async options => {
      calls.push(options);
      return batch(`request-${calls.length}`);
    }
  });
  const page = {
    ...source.data(), ...source.methods,
    postList: batch('first'), page: 1, isLoading: false,
    setData(data, callback) { Object.assign(this, data); callback?.(); },
    preloadImages() {}
  };

  page.setHomeFeedMode('random');
  await drain();
  assert.ok(page.isRandomHomeOrder);
  assert.equal(page.showNormalPostsOnly, false);
  assert.equal(calls[0].homeRandom, true);
  assert.equal(calls[0].page, 0);
  assert.deepEqual(calls[0].previousPostIds, batch('first').map(post => post._id));
  assert.deepEqual(savedFilters, [], '随机模式不会保存成启动偏好');

  await page.getPostList();
  assert.equal(calls[1].homeRandom, true);
  assert.deepEqual(calls[1].excludePostIds, batch('request-1').map(post => post._id));

  await page.onHomeRefresh();
  assert.equal(calls[2].homeRandom, true);
  assert.deepEqual(calls[2].previousPostIds, batch('request-1').map(post => post._id));
  assert.equal(page.postList.length, 10);

  await page.setHomeFeedMode('random');
  assert.equal(calls[3].homeRandom, true);
  assert.deepEqual(calls[3].previousPostIds, batch('request-3').map(post => post._id));

  page.setNormalPostsFilter(true);
  await drain();
  assert.equal(page.isRandomHomeOrder, false);
  assert.equal(calls[4].isPoem, false);
  assert.equal(calls[4].isDiscussion, false);

  page.setHomeFeedMode('random');
  await drain();
  page.setNormalPostsFilter(false);
  await drain();
  assert.equal(page.isRandomHomeOrder, false);
  assert.equal(page.showNormalPostsOnly, false);
  assert.equal(calls[6].homeRandom, false);
  assert.equal(calls[6].isPoem, undefined);
}

(async () => {
  for (const test of [testRankingAndPagination, testMixedRankingAndRefresh, testDefaultsAndCache, testPageRefreshWhileLoadingMore, testRandomFilterOnHomePage]) {
    await test(); console.log('PASS ' + test.name);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
