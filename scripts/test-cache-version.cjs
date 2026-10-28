const assert = require('node:assert/strict');
const { load, fakeTime, deferred, drain } = require('./test-splash-startup.cjs');

function runtime() {
  const time = fakeTime(), storage = new Map();
  const uni = {
    getStorageSync: key => storage.get(key),
    setStorageSync: (key, value) => storage.set(key, value),
    removeStorageSync: key => storage.delete(key)
  };
  const base = { ...time.globals, uni };
  return { time, base, storage, manager: load('cache/core/manager.js', base) };
}

async function testVersionReadsAndExpiry() {
  const { time, manager, storage } = runtime();
  const ns = manager.namespace('versions', { persistent: true, maxItems: 1 });
  ns.set('first', 'one', { ttlMs: 100 });
  const version = ns.getVersion('first');
  assert.equal(ns.getVersion('first'), version);
  assert.equal(ns.get('first'), 'one');
  assert.equal(ns.getVersion('first'), version, '读取不改变版本');
  await time.tick(100);
  assert.equal(ns.get('first'), undefined);
  assert.equal(storage.has('__cm__:versions:first'), false, '过期缓存仍正常清理');
  assert.equal(ns.getVersion('first'), version, '自然到期不撤销独立快照');
  assert.equal(ns.keys().includes('first'), true, '保留版本的过期key仍参与显式失效枚举');

  ns.set('first', 'new');
  const freshVersion = ns.getVersion('first');
  assert.notEqual(freshVersion, version);
  await time.tick(1);
  ns.set('second', 'two');
  assert.equal(ns.mem.has('first'), false, '触发LRU内存淘汰');
  assert.equal(ns.getVersion('first'), freshVersion, 'LRU淘汰不更换版本');
  assert.equal(ns.get('first'), 'new', '持久化缓存仍可重新读取');
  assert.equal(ns.getVersion('first'), freshVersion);
  for (const value of storage.values()) {
    assert.equal(String(value).includes('_versions'), false, '版本不持久化');
  }
}

async function testExplicitChanges() {
  const { manager, time } = runtime();
  const ns = manager.namespace('versions');
  let version = ns.getVersion('absent');
  ns.set('absent', 1);
  assert.notEqual(ns.getVersion('absent'), version, '无值key首次写入也换版');
  for (const mutate of [
    () => ns.set('absent', 2),
    () => assert.equal(ns.update('absent', value => value + 1), true),
    () => ns.delete('absent'),
    () => ns.delete('absent'),
    () => ns.clear()
  ]) {
    version = ns.getVersion('absent');
    mutate();
    assert.notEqual(ns.getVersion('absent'), version, '显式操作撤销此前token');
  }
  version = ns.getVersion('absent');
  assert.equal(ns.update('absent', () => 1), false);
  assert.equal(ns.getVersion('absent'), version, '未命中的update不改变版本');
  ns.set('expires', 1, { ttlMs: 10 });
  version = ns.getVersion('expires');
  await time.tick(10);
  assert.equal(ns.update('expires', value => value + 1), false);
  assert.equal(ns.getVersion('expires'), version, '过期update不写入，不撤销快照');
  ns.set('unchanged', 1);
  version = ns.getVersion('unchanged');
  assert.equal(ns.update('unchanged', () => undefined), false);
  assert.equal(ns.getVersion('unchanged'), version, '未提交的update不改变版本');
}

async function testLazyVersionStorage() {
  const { manager } = runtime();
  const ns = manager.namespace('versions');
  for (let index = 0; index < 300; index++) {
    const key = 'ordinary-' + index;
    ns.set(key, index);
    ns.get(key);
    ns.update(key, value => value + 1);
    ns.delete(key);
  }
  assert.equal(ns._versions.size, 0, '常规缓存操作不分配版本token');
  const token = ns.getVersion('watched');
  assert.equal(ns._versions.size, 1);
  ns.set('ordinary', 1);
  assert.equal(ns.getVersion('watched'), token);
  assert.equal(ns._versions.size, 1, '其他key写入不增加版本记录');
  ns.delete('watched');
  assert.equal(ns._versions.size, 0, '显式失效释放版本记录');
  ns.getVersion('watched');
  ns.clear();
  assert.equal(ns._versions.size, 0, '命名空间清空释放全部版本');
}

async function testPendingCompletion() {
  const { manager } = runtime();
  const ns = manager.namespace('versions');
  const response = deferred();
  const token = ns.getVersion('pending');
  const request = ns.getOrFetch('pending', () => response.promise, { ttlMs: 100 });
  await drain();
  assert.equal(ns.getVersion('pending'), token, '请求尚未完成不换版');
  response.resolve('ready');
  assert.equal(await request, 'ready');
  assert.notEqual(ns.getVersion('pending'), token, '请求成功写入后更换版本');

  const late = deferred();
  const staleRequest = ns.getOrFetch('late', () => late.promise);
  await drain();
  ns.delete('late');
  const invalidatedToken = ns.getVersion('late');
  late.resolve('stale');
  await staleRequest;
  assert.equal(ns.getVersion('late'), invalidatedToken, '已失效的迟到响应不改变版本');
  assert.equal(ns.get('late'), undefined);
}

async function testOriginalPoemsInvalidationAfterExpiry() {
  const { manager, time, base } = runtime();
  const { buildCacheKey } = load('cache/core/key-builder.js', base, ['buildCacheKey']);
  const { withTimeout } = load('utils/asyncTimeout.js', base, ['withTimeout']);
  const postList = load('api-cache/post-list.js', {
    ...base, cacheManager: manager, buildCacheKey, withTimeout,
    callCloudAndUnwrap: async () => ({ posts: [{ _id: 'first' }] })
  }, ['getPostList', 'invalidatePostList']);
  const poems = load('api-cache/poems.js', {
    ...base, cacheManager: manager, buildCacheKey, getPostList: postList.getPostList
  }, ['getOriginalPoems', 'peekOriginalPoems', 'getOriginalPoemsVersion']);
  await poems.getOriginalPoems();
  const token = poems.getOriginalPoemsVersion();
  await time.tick(90000);
  assert.equal(poems.peekOriginalPoems(), undefined);
  assert.equal(poems.getOriginalPoemsVersion(), token, '原创列表自然到期保留版本');
  postList.invalidatePostList({ isPoem: true, isOriginal: true });
  assert.notEqual(poems.getOriginalPoemsVersion(), token,
    '自然到期且缓存已回收后，原创列表显式失效仍撤销保留快照');
}

(async () => {
  for (const test of [testVersionReadsAndExpiry, testExplicitChanges, testLazyVersionStorage,
    testPendingCompletion, testOriginalPoemsInvalidationAfterExpiry]) {
    await test();
    console.log('PASS ' + test.name);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
