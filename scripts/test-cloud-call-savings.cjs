const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parse } = require('@babel/parser');
const root = path.join(__dirname, '..');

function load(file, globals = {}, names = []) {
  let source = fs.readFileSync(path.join(root, file), 'utf8');
  const nodes = parse(source, { sourceType: 'module' }).program.body;
  for (const node of nodes.reverse()) {
    if (node.type === 'ImportDeclaration' || (node.type === 'ExportNamedDeclaration' && !node.declaration)) {
      source = source.slice(0, node.start) + source.slice(node.end);
    } else if (node.type === 'ExportNamedDeclaration') {
      source = source.slice(0, node.start) + source.slice(node.declaration.start);
    } else if (node.type === 'ExportDefaultDeclaration') {
      source = source.slice(0, node.start) + 'module.exports = ' + source.slice(node.declaration.start);
    }
  }
  if (names.length) source += `\nmodule.exports = { ${names.join(', ')} };`;
  const scope = { module: { exports: {} }, console, ...globals };
  vm.runInNewContext(source, scope, { filename: file });
  return scope.module.exports;
}

function runtime() {
  const clock = { now: 1000 };
  const storage = new Map();
  const globals = {
    Date: { now: () => clock.now },
    uni: {
      getStorageSync: key => storage.get(key),
      setStorageSync: (key, value) => storage.set(key, value),
      removeStorageSync: key => storage.delete(key)
    }
  };
  return { clock, globals, cacheManager: load('cache/core/manager.js', globals) };
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const settle = () => new Promise(resolve => setImmediate(resolve));

async function testCache() {
  const { clock, cacheManager } = runtime();
  const ns = cacheManager.namespace('test', { persistent: true });
  let calls = 0;
  let gate = deferred();
  const loader = () => { calls++; return gate.promise; };
  const options = { ttlMs: 1000, swrMs: 1000 };
  const cold = [1, 2, 3].map(() => ns.getOrFetch('key', loader, options));
  await settle();
  assert.equal(calls, 1, '冷缓存三个并发消费者只发一次请求');
  gate.resolve('first');
  assert.deepEqual(await Promise.all(cold), ['first', 'first', 'first']);
  assert.equal(await ns.getOrFetch('key', loader, options), 'first');
  assert.equal(calls, 1, '新鲜缓存不请求');

  clock.now += 1001;
  gate = deferred();
  const seen = [];
  const stale = [1, 2, 3].map(id => ns.getOrFetch('key', loader, {
    ...options, onBackgroundUpdate: value => seen.push([id, value])
  }));
  assert.deepEqual(await Promise.all(stale), ['first', 'first', 'first']);
  assert.equal(calls, 2, 'SWR 三个消费者只发一次后台请求');
  gate.resolve('second');
  await settle();
  assert.deepEqual(seen, [[1, 'second'], [2, 'second'], [3, 'second']], '每个消费者均收到后台更新');

  for (const operation of ['delete', 'clear', 'set', 'update']) {
    ns.set('key', 'seed', { ttlMs: 1 });
    clock.now += 2;
    gate = deferred();
    let callbacks = 0;
    await ns.getOrFetch('key', loader, { ...options, onBackgroundUpdate: () => callbacks++ });
    if (operation === 'set') ns.set('key', 'manual', { ttlMs: 1000 });
    else if (operation === 'update') {
      // 无 SWR 过期检查的显式 update 路径，用有效记录验证进行中的刷新被取消。
      ns.mem.get('key').e = clock.now + 1000;
      ns.update('key', () => 'manual');
    } else ns[operation]('key');
    gate.resolve('obsolete');
    await settle();
    assert.equal(callbacks, 0, `${operation} 后不通知旧结果`);
    assert.equal(ns.get('key'), ['set', 'update'].includes(operation) ? 'manual' : undefined);
  }

  gate = deferred();
  const old = ns.getOrFetch('race', loader, options);
  await settle();
  const oldGate = gate;
  ns.delete('race');
  gate = deferred();
  const fresh = ns.getOrFetch('race', loader, options);
  await settle();
  oldGate.resolve('old');
  await old;
  const joined = ns.getOrFetch('race', loader, options);
  const before = calls;
  await settle();
  assert.equal(calls, before, '旧请求结束不能删除新请求的去重记录');
  gate.resolve('new');
  assert.deepEqual(await Promise.all([fresh, joined]), ['new', 'new']);
  assert.equal(ns.get('race'), 'new');

  const failure = new Error('offline');
  let failures = 0;
  const failed = await Promise.allSettled([1, 2].map(() => ns.getOrFetch('fail', () => {
    failures++; throw failure;
  }, options)));
  assert.equal(failures, 1);
  assert.ok(failed.every(item => item.status === 'rejected' && item.reason === failure));
  assert.equal(await ns.getOrFetch('fail', async () => 'recovered', options), 'recovered');
  assert.equal(ns._pending.size, 0, '成功和失败后均释放进行中的请求');
}

async function testBubble() {
  const { clock, globals, cacheManager } = runtime();
  let calls = 0, fail = false, pending = null;
  let config = { enabled: true, text: 'old', target: 'weekly' };
  const api = load('api-cache/square-bubble.js', {
    cacheManager,
    async callCloudAndUnwrap(name, payload) {
      assert.equal(name, 'squareBubbleConfig');
      calls++;
      if (fail) throw new Error('offline');
      if (payload.action === 'save') return { config: { ...payload } };
      return pending || { config };
    }
  }, ['getSquareBubbleConfig', 'saveSquareBubbleConfig']);
  await Promise.all([api.getSquareBubbleConfig(), api.getSquareBubbleConfig()]);
  await api.getSquareBubbleConfig();
  assert.equal(calls, 1, '返回广场和并发加载复用配置');
  const restored = load('cache/core/manager.js', globals).namespace('square:bubble', { persistent: true });
  assert.equal(restored.get('config').text, 'old', '新会话可复用持久缓存');
  clock.now += 300000;
  const gate = deferred();
  pending = gate.promise;
  const oldRead = api.getSquareBubbleConfig();
  await settle();
  await api.saveSquareBubbleConfig({ enabled: false, text: 'new', target: 'activities' });
  gate.resolve({ config });
  await oldRead;
  assert.equal((await api.getSquareBubbleConfig()).text, 'new', '迟到的读取不能覆盖管理员保存');
  pending = null;
  clock.now += 300000;
  fail = true;
  await assert.rejects(api.getSquareBubbleConfig(), /offline/);
  fail = false;
  config = { ...config, text: 'retry' };
  assert.equal((await api.getSquareBubbleConfig()).text, 'retry', '失败不缓存，下次可重试');
}

async function testMyPosts() {
  const { clock, cacheManager } = runtime();
  let user = 'a', calls = 0;
  const api = load('api-cache/my.js', {
    cacheManager, getOpenid: () => user,
    async callCloudAndUnwrap(name, payload) {
      calls++;
      return { posts: [{ _id: `${payload.openid}-${payload.skip}-${payload.originalOnly}`, version: calls }] };
    }
  }, ['getMyPosts', 'invalidateMyPosts']);
  await Promise.all([api.getMyPosts({}), api.getMyPosts({})]);
  await api.getMyPosts({});
  assert.equal(calls, 1, '普通返回个人页复用一分钟缓存');
  await api.getMyPosts({ originalOnly: true });
  await api.getMyPosts({ page: 1 });
  user = 'b';
  assert.equal((await api.getMyPosts({}))[0]._id, 'b-0-false');
  assert.equal(calls, 4, '原创筛选、分页、账号互不串缓存');
  await api.getMyPosts({ forceRefresh: true });
  assert.equal(calls, 5, '手动刷新立即请求');
  clock.now += 60000;
  await api.getMyPosts({});
  assert.equal(calls, 6, '过期后重新请求');
  user = 'a';
  await api.getMyPosts({});
  await api.getMyPosts({ originalOnly: true });
  api.invalidateMyPosts(0);
  const before = calls;
  await api.getMyPosts({});
  await api.getMyPosts({ originalOnly: true });
  assert.equal(calls, before + 2, '按页失效覆盖不同筛选');

  for (const bridge of ['api-cache/events.js', 'cache/events.js']) {
    const handlers = new Map();
    const EVENTS = { POST_CREATED: 'created', POST_UPDATED: 'updated', POST_VISIBILITY_CHANGED: 'visibility' };
    load(bridge, {
      cacheManager, EVENTS, uni: { $on: (name, callback) => handlers.set(name, callback) },
      invalidateHomePosts() {}, invalidatePostList() {}, clearDiscoverCache() {}
    }).setupCacheEventBridges();
    for (const event of ['created', 'updated', 'visibility']) {
      const count = calls;
      handlers.get(event)({ postId: 'post', isHidden: true });
      await api.getMyPosts({});
      assert.equal(calls, count + 1, `${event} 操作后失效个人帖子缓存`);
    }
  }
  api.invalidateMyPosts();
  assert.equal(cacheManager.namespace('me:posts').keys().length, 0);
}

(async () => {
  await testCache();
  await testBubble();
  await testMyPosts();
  console.log('[test-cloud-call-savings] PASS: deduplication, SWR, invalidation races, retries, config and account-scoped post caching');
})().catch(error => { console.error(error); process.exitCode = 1; });
