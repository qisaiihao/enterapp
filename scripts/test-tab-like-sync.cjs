const assert = require('node:assert/strict');
const { load, fakeTime } = require('./test-splash-startup.cjs');

const LIST_NAMESPACES = ['posts:list', 'posts:discover', 'posts:tag:poem', 'me:posts', 'userPosts:reader', 'myLikes'];
const CACHE_PAGES = 40;
const PAGE_FILES = ['pages/index/index.vue', 'pages/poem-square/poem-square.vue', 'pages/mountain/mountain.vue'];
const HOME_LISTS = ['postList', 'discoverPostList', 'discussionPostList', 'followingPostList'];

function posts(suffix = '') {
  return [
    { _id: 'liked', votes: 2, isVoted: false },
    { _id: 'unliked', votes: 1, isVoted: true },
    { _id: 'unchanged', votes: 2, isVoted: false },
    { _id: `uncached${suffix}`, votes: 9, isVoted: false },
    ...Array.from({ length: 8 }, (_, index) => ({ _id: `other-${suffix}-${index}`, votes: index, isVoted: false }))
  ];
}

function runtime() {
  const time = fakeTime(), storage = new Map(), listeners = new Map(), emitted = [];
  let writes = 0;
  const uni = {
    getStorageSync: key => storage.get(key),
    setStorageSync(key, value) { writes++; storage.set(key, value); },
    removeStorageSync(key) { writes++; storage.delete(key); },
    $on(name, listener) {
      if (!listeners.has(name)) listeners.set(name, []);
      listeners.get(name).push(listener);
    },
    $emit(name, payload) {
      emitted.push({ name, payload });
      for (const listener of listeners.get(name) || []) listener(payload);
    }
  };
  const base = { ...time.globals, uni };
  const likeIcon = load('utils/likeIcon.js');
  const seedManager = load('cache/core/manager.js', base);
  for (const name of LIST_NAMESPACES) {
    const ns = seedManager.namespace(name, { persistent: true, maxItems: 256 });
    for (let page = 0; page < CACHE_PAGES; page++) {
      ns.set(`page:${page}`, posts(`${name}-${page}`), { ttlMs: 90000 });
    }
  }
  const seedLikes = load('cache/stores/like-status.js', { ...base, cacheManager: seedManager, likeIcon });
  seedLikes.updateLikeStatus('liked', 12, true);
  seedLikes.updateLikeStatus('unliked', 0, false);
  seedLikes.updateLikeStatus('unchanged', 2, false);

  // Recreate handles so UI reconciliation must also work with cold memory and persisted likes.
  const cacheManager = load('cache/core/manager.js', base);
  for (const name of LIST_NAMESPACES) cacheManager.namespace(name, { persistent: true, maxItems: 256 });
  const likeStatusCache = load('cache/stores/like-status.js', { ...base, cacheManager, likeIcon });
  const compatibility = load('utils/likeStatusSync.js', { likeStatusCache });
  writes = 0;
  return { base, storage, cacheManager, likeStatusCache, likeIcon, compatibility, emitted,
    writeCount: () => writes, resetWrites: () => { writes = 0; } };
}

function assertVisibleLikes(list) {
  assert.equal(list[0].votes, 12, 'latest cached like count reaches the visible page');
  assert.equal(list[0].isVoted, true);
  assert.equal(list[0].likeIcon, '/static/images/flowerplus.png');
  assert.equal(list[1].votes, 0, 'unlike count zero must not be ignored');
  assert.equal(list[1].isVoted, false);
  assert.equal(list[1].likeIcon, '/static/images/seed.png');
  assert.equal(list[2].votes, 2);
  assert.equal(list[2].isVoted, false);
  assert.equal(list[3].votes, 9, 'posts without a like record preserve their state');
  assert.equal(list[3].isVoted, false);
}

function testPageReconciliationDoesNotPersist() {
  for (const file of PAGE_FILES) {
    const app = runtime();
    const component = load(file, { ...app.base, ...app.compatibility, likeIcon: app.likeIcon });
    const keys = file === PAGE_FILES[0] ? HOME_LISTS : ['postList'];
    let renderUpdates = 0;
    const page = {
      ...Object.fromEntries(keys.map(key => [key, posts(key)])),
      setData(partial) { renderUpdates++; Object.assign(this, partial); },
      applyLocalState(partial) {
        renderUpdates++;
        return component.methods.applyLocalState.call(this, partial);
      }
    };
    const beforeStorage = Array.from(app.storage);
    component.methods.syncLikeStatusFromCache.call(page);
    for (const key of keys) assertVisibleLikes(page[key]);
    assert.equal(renderUpdates, 1, `${file} batches changed visible lists`);
    assert.equal(app.writeCount(), 0, `${file} must not persist ${LIST_NAMESPACES.length * CACHE_PAGES} cached lists during UI sync`);
    assert.deepEqual(Array.from(app.storage), beforeStorage, 'UI sync leaves persisted list data unchanged');

    component.methods.syncLikeStatusFromCache.call(page);
    assert.equal(renderUpdates, 1, 'returning without like changes avoids another render update');
    assert.equal(app.writeCount(), 0, 'repeated tab visits remain read-only');
  }
}

async function testActualLikeStillUpdatesCaches() {
  const app = runtime();
  const events = load('utils/events.js', app.base);
  const bridge = load('cache/events.js', { ...app.base, EVENTS: events.EVENTS,
    cacheManager: app.cacheManager, likeStatusCache: app.likeStatusCache });
  bridge.setupCacheEventBridges();
  const service = load('utils/likeService.js', { ...app.base, likeIcon: app.likeIcon,
    cacheManager: app.cacheManager, likeStatusCache: app.likeStatusCache,
    emitLikeChanged: events.emitLikeChanged,
    async cloudCall(name, params) {
      assert.equal(name, 'vote'); assert.equal(params.postId, 'liked');
      return { result: { success: true, votes: 13, isLiked: true } };
    }
  });
  const result = await service.togglePostLike('liked');
  assert.equal(result.success, true);
  assert.ok(app.writeCount() > 0, 'actual like success still persists changed data');
  assert.equal(app.likeStatusCache.getLikeStatus('liked').votes, 13);
  assert.equal(app.likeStatusCache.getLikeStatus('liked').isVoted, true);
  for (const name of LIST_NAMESPACES) {
    const ns = app.cacheManager.namespace(name);
    for (let page = 0; page < CACHE_PAGES; page++) {
      const key = `page:${page}`;
      const cached = ns.get(key)[0];
      const persisted = JSON.parse(app.storage.get(`__cm__:${name}:${key}`)).v[0];
      for (const post of [cached, persisted]) {
        assert.equal(post.votes, 13, `${name}:${key} receives the real like result`);
        assert.equal(post.isVoted, true);
        assert.equal(post.likeIcon, '/static/images/flowerplus.png');
      }
    }
  }
  assert.equal(app.emitted.length, 1);
  assert.equal(app.emitted[0].name, events.EVENTS.LIKE_CHANGED);
  assert.equal(app.emitted[0].payload.postId, 'liked');
}

(async () => {
  testPageReconciliationDoesNotPersist();
  console.log('PASS tab UI like sync: three real pages, 240 cached lists, zero storage writes');
  await testActualLikeStillUpdatesCaches();
  console.log('PASS actual like: service and event bridge update memory, persisted lists and like status');
})().catch(error => { console.error(error); process.exitCode = 1; });
