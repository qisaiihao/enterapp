const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const cloud = require('wx-server-sdk');
const { memoryDb } = require('./helpers/posts-memory-db.cjs');
const { load, fakeTime } = require('./test-splash-startup.cjs');
cloud.init({ env: 'home-ranking-test' });
const quiet = { log() {}, warn() {}, error() {} };

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
  const mem = memoryDb({ posts, users: [], votes_log: [] }, cloud.database().command);
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
  assert.equal(home.peekHomePosts(), undefined, '新排序不读取旧版或其他页面的全部列表缓存');
  await home.getHomePosts();
  assert.equal(calls[0].homeRanking, true);
  assert.equal(home.peekHomePosts()[0]._id, 'response-1');
  await home.getHomePosts();
  assert.equal(calls.length, 1);
  await home.getHomePosts({ page: 1 });
  assert.equal(calls[1].skip, 10);
  const normal = { isPoem: false, isDiscussion: false };
  await home.getHomePosts(normal);
  assert.equal(calls[2].homeRanking, false);
  home.invalidateHomePosts();
  assert.equal(home.peekHomePosts(), undefined);
  assert.equal(home.peekHomePosts({ page: 1 }), undefined);
  assert.equal(home.peekHomePosts(normal)[0]._id, 'response-3');
  assert.equal(ns.get(oldKey)[0]._id, 'old-random', '失效仅针对首页排序缓存');
  await home.getHomePosts();
  await home.getHomePosts({ forceRefresh: true });
  assert.equal(home.peekHomePosts()[0]._id, 'response-5');
  home.invalidateHomePosts({ page: 0 });
  assert.equal(home.peekHomePosts(), undefined);
  const parsed = keys.parseCacheKey(keys.buildCacheKey({ page: 2, pageSize: 10, homeRanking: true }));
  assert.equal(parsed.homeRanking, true);
}

(async () => {
  for (const test of [testRankingAndPagination, testDefaultsAndCache]) {
    await test(); console.log('PASS ' + test.name);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
