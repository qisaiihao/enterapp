'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const cloud = require('wx-server-sdk');
const { memoryDb } = require('./helpers/posts-memory-db.cjs');
const { load, fakeTime, deferred, drain } = require('./test-splash-startup.cjs');
cloud.init({ env: 'original-mix-test' });
const quiet = { log() {}, warn() {}, error() {} };

function service(posts, random = () => 0.37, options = {}) {
  const mem = memoryDb({ posts, users: [], votes_log: [] }, cloud.database().command, { ...options, random });
  const filename = path.resolve(__dirname, '../functions/getPostList/index.js');
  const localRequire = createRequire(filename);
  const scope = { exports: {}, Date, console: quiet, require(id) {
    if (id === 'wx-server-sdk') return { init() {}, database: () => mem.db, getWXContext: () => ({ OPENID: 'viewer' }) };
    if (id.includes('get-blocked-user-ids')) return async () => ['blocked'];
    return localRequire(id);
  } };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), scope, { filename });
  return { ...mem, async run(options = {}) {
    const result = await scope.exports.main({ isPoem: true, isOriginal: true, originalMix: true, limit: 10, rawImages: true, ...options });
    assert.equal(result.success, true, JSON.stringify(result));
    return Array.from(result.posts);
  } };
}
const post = (_id, age, fields = {}) => ({ _id, _openid: 'author', title: _id, content: '诗行', isPoem: true, isOriginal: true, votes: 0, createTime: new Date(2000000000000 - age * 3600000), ...fields });

async function testServer() {
  const eligible = [
    ...Array.from({ length: 20 }, (_, i) => post(`new-${i}`, i)),
    post('hot-a', 100, { votes: 100 }), post('hot-b', 101, { votes: 80 }),
    ...Array.from({ length: 10 }, (_, i) => post(`old-${i}`, 200 + i))
  ];
  eligible[1] = post('new-1', 1, { schemaVersion: 2, publishMode: 'poem', isPoem: undefined });
  const excluded = [
    post('non-original', -1, { isOriginal: false, votes: 999 }),
    post('normal', -1, { isPoem: false, votes: 999 }),
    post('v2-normal', -1, { schemaVersion: 2, publishMode: 'normal', votes: 999 }),
    post('hidden', -1, { isHidden: true, votes: 999 }), post('deleted', -1, { isDeleted: true, votes: 999 }),
    post('pending', -1, { auditStatus: 'pending', votes: 999 }), post('rejected', -1, { auditStatus: 'rejected' }),
    post('activity', -1, { isActivityPost: true }),
    post('blocked', -1, { _openid: 'blocked', votes: 999 }),
    post('blocked-anonymous', -1, { _openid: '123456', isAnonymous: true, realAuthorOpenid: 'blocked', votes: 999 })
  ];
  const app = service([...eligible, ...excluded]);
  const first = await app.run();
  assert.deepEqual([0, 1, 2, 5, 6, 7].map(i => first[i]._id), ['new-0', 'new-1', 'new-2', 'new-3', 'new-4', 'new-5'], 'six newest poems retain their order around insertions');
  assert.deepEqual([first[3]._id, first[8]._id], ['hot-a', 'hot-b'], 'two older high-vote poems are inserted between new poems');
  assert.ok(app.calls.some(call => call.stages?.some(([op, value]) => op === 'sample' && value.size === 2)), 'random poems are sampled by the database');
  assert.equal(new Set(first.map(row => row._id)).size, 10);
  assert.ok(first.every(row => row.isPoem && row.isOriginal));
  const seen = first.map(row => row._id);
  for (let page = 1; page < 10; page++) {
    const rows = await app.run({ skip: page * 10, excludePostIds: seen });
    assert.ok(rows.every(row => !seen.includes(row._id)), 'later pages exclude every previously displayed poem');
    seen.push(...rows.map(row => row._id));
    if (rows.length < 10) break;
  }
  assert.deepEqual([...seen].sort(), eligible.map(row => row._id).sort(), 'pagination reaches every eligible poem without skipping or repeating');
  assert.equal((await app.run({ excludePostIds: seen })).length, 0);
  assert.equal((await service(eligible).run({ originalMix: false }))[3]._id, 'new-3', 'ordinary chronological queries keep their existing ordering');

  const few = service(Array.from({ length: 7 }, (_, i) => post(`few-${i}`, i)));
  const short = await few.run();
  assert.equal(short.length, 7, 'a short library returns its actual size');
  assert.equal(new Set(short.map(row => row._id)).size, 7);
  assert.equal((await service([]).run()).length, 0);
  assert.equal((await service(eligible).run({ limit: 5 })).length, 5, 'custom page sizes are respected');
  const alternate = await service(eligible, () => 0.91).run();
  assert.notDeepEqual([first[4]._id, first[9]._id], [alternate[4]._id, alternate[9]._id], 'sampling can change recommendations while preserving recent and high-vote slots');
  for (const failingQuery of ['hot', 'random']) {
    const degraded = service(eligible, undefined, { beforeAggregate({ stages }) {
      if (stages.some(([op, value]) => failingQuery === 'hot' ? op === 'sort' && value.votes : op === 'sample')) throw Error('recommendations unavailable');
    } });
    const rows = await degraded.run();
    assert.equal(rows.length, 10, `${failingQuery} failures are filled with recent poems`);
    assert.equal(new Set(rows.map(row => row._id)).size, 10);
  }
  const manySeen = [...Array.from({ length: 120 }, (_, i) => `seen-${i}`), ...first.map(row => row._id)];
  const afterMany = await app.run({ excludePostIds: manySeen });
  assert.ok(afterMany.every(row => !manySeen.includes(row._id)), 'long reading sessions preserve exclusions across query chunks');
}

async function testCache() {
  const time = fakeTime(), storage = new Map(), calls = [];
  const base = { ...time.globals, uni: { getStorageSync: key => storage.get(key), setStorageSync: (key, value) => storage.set(key, value), removeStorageSync: key => storage.delete(key) } };
  const cacheManager = load('cache/core/manager.js', base);
  const keys = load('cache/core/key-builder.js', base, ['buildCacheKey', 'parseCacheKey']);
  const { withTimeout } = load('utils/asyncTimeout.js', base, ['withTimeout']);
  const api = load('api-cache/post-list.js', { ...base, cacheManager, ...keys, withTimeout,
    callCloudAndUnwrap: async (_name, payload) => { calls.push(payload); return { posts: [{ _id: `response-${calls.length}` }] }; }
  }, ['getPostList', 'invalidatePostList']);
  const poems = load('api-cache/poems.js', { ...base, cacheManager, ...keys, getPostList: api.getPostList }, ['getOriginalPoems', 'peekOriginalPoems', 'getMountainPoems']);
  const ns = cacheManager.namespace('posts:list');
  ns.set(keys.buildCacheKey({ page: 0, pageSize: 10, isPoem: true, isOriginal: true }), [{ _id: 'old-chronological' }], { ttlMs: 90000 });
  assert.equal(poems.peekOriginalPoems(), undefined, 'mixed feed never reads the old chronological cache');
  await poems.getOriginalPoems(); await poems.getOriginalPoems();
  assert.equal(calls.length, 1, 'preload and page share the same first-page cache');
  assert.equal(calls[0].originalMix, true);
  await poems.getOriginalPoems({ page: 1, excludePostIds: ['first-session'] });
  await poems.getOriginalPoems({ page: 1, excludePostIds: ['second-session'] });
  assert.equal(calls.length, 3, 'later pages are not reused across refresh sessions');
  assert.deepEqual(Array.from(calls[2].excludePostIds), ['second-session']);
  await poems.getOriginalPoems({ forceRefresh: true });
  assert.equal(poems.peekOriginalPoems()[0]._id, 'response-4');
  api.invalidatePostList({ page: 0, isPoem: true, isOriginal: true });
  assert.equal(poems.peekOriginalPoems(), undefined, 'explicit first-page invalidation clears mixed recommendations too');
  await poems.getMountainPoems();
  assert.equal(calls.at(-1).originalMix, undefined, 'non-original mountain feed keeps its existing query');
  assert.equal(keys.parseCacheKey(keys.buildCacheKey({ page: 0, pageSize: 10, originalMix: true })).originalMix, true);
}

async function testPage() {
  const calls = [], toasts = [];
  const batch = prefix => Array.from({ length: 10 }, (_, i) => ({ _id: `${prefix}-${i}` }));
  let response = batch('first'), cached, urlWait;
  const options = load('pages/poem-square/poem-square.vue', {
    ORIGINAL_POEMS_PAGE_SIZE: 10,
    getOriginalPoems: async params => { calls.push(params); return response; },
    cacheManager: { namespace: () => ({ get: () => cached }) },
    uni: { showToast: options => toasts.push(options.title) },
    formatErrorForLog: String
  });
  const page = options.data();
  for (const [name, fn] of Object.entries(options.methods)) page[name] = fn.bind(page);
  page.applyLocalState = patch => Object.assign(page, patch);
  page.normalizePoemCardPost = value => value;
  page.syncLikeStatusFromCache = () => {};
  page.convertCloudUrls = async () => { if (urlWait) await urlWait; };

  await page.getPostList();
  assert.deepEqual(Array.from(calls[0].excludePostIds), []);
  response = batch('second');
  await page.getPostList();
  assert.deepEqual(Array.from(calls[1].excludePostIds), batch('first').map(row => row._id), 'page forwards every displayed ID when loading more');
  assert.equal(page.postList.length, 20);

  const pending = deferred();
  response = pending.promise;
  let staleCallback = false;
  const oldRequest = page.getPostList(() => { staleCallback = true; });
  assert.equal(calls[2].excludePostIds.length, 20);
  cached = batch('cached-refresh');
  page.getIndexData();
  pending.resolve(batch('old-page'));
  await oldRequest;
  assert.deepEqual(Array.from(page.postList, row => row._id), cached.map(row => row._id), 'refreshing from cache discards an in-flight old page');
  assert.equal(staleCallback, false);
  assert.equal(page._loadingLock, false);

  page.page = 0;
  response = batch('network-refresh');
  await page.getPostList(undefined, { forceRefresh: true });
  assert.deepEqual(Array.from(calls.at(-1).excludePostIds), [], 'refresh clears seen IDs even while old cards remain visible');
  assert.equal(page.postList[0]._id, 'network-refresh-0');

  const images = deferred();
  urlWait = images.promise;
  page.page = 0;
  response = batch('stale-images');
  const oldImages = page.getPostList();
  await drain();
  urlWait = null;
  cached = batch('new-session');
  page.getIndexData();
  images.resolve();
  await oldImages;
  assert.equal(page.postList[0]._id, 'new-session-0', 'slow image conversion cannot overwrite a newer reading session');
  assert.deepEqual(toasts, []);
}

async function main() {
  await testServer(); await testCache(); await testPage();
  console.log('original poem mix: PASS — 6 recent / 2 high-vote / 2 random, visibility, V1/V2, complete pagination, fallbacks, cache isolation and refresh races');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
