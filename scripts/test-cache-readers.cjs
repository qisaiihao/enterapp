const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parse } = require('@babel/parser');
const root = path.join(__dirname, '..');

function load(file, globals = {}, names = []) {
  let source = fs.readFileSync(path.join(root, file), 'utf8');
  for (const node of parse(source, { sourceType: 'module' }).program.body.reverse()) {
    if (node.type === 'ImportDeclaration' || (node.type === 'ExportNamedDeclaration' && !node.declaration)) {
      source = source.slice(0, node.start) + source.slice(node.end);
    } else if (node.type === 'ExportNamedDeclaration') {
      source = source.slice(0, node.start) + source.slice(node.declaration.start);
    } else if (node.type === 'ExportDefaultDeclaration') {
      source = source.slice(0, node.start) + 'module.exports = ' + source.slice(node.declaration.start);
    }
  }
  if (names.length) source += `\nmodule.exports = { ${names.join(', ')} };`;
  const scope = { module: { exports: {} }, console, setTimeout, clearTimeout, ...globals };
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
      removeStorageSync: key => storage.delete(key),
      getStorageInfoSync: () => ({ keys: [...storage.keys()] })
    }
  };
  const cacheManager = load('cache/core/manager.js', globals);
  const { createCachedBatchReader } = load('cache/core/batch-reader.js', {}, ['createCachedBatchReader']);
  return { clock, storage, globals: { ...globals, cacheManager, createCachedBatchReader }, cacheManager };
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const settle = () => new Promise(setImmediate);

async function testFollow() {
  const { globals, cacheManager } = runtime();
  let gate = null, fail = false;
  const calls = [];
  const follow = load('cache/stores/follow.js', {
    ...globals,
    cloudCall: async (name, data) => {
      calls.push({ name, data });
      if (fail) throw new Error('offline');
      if (gate) return gate.promise;
      return { result: name === 'follow'
        ? { success: true, isFollowing: true, isFollower: false, isMutual: false }
        : { success: true, followStatuses: data.targetUserIds.map(targetUserId => ({ targetUserId, isFollowing: true })) } };
    }
  });
  const ids = Array.from({ length: 45 }, (_, i) => `u${i}`);
  const [single, all, overlapping] = await Promise.all([
    follow.getFollowStatus('viewer', 'u0'),
    follow.getBatchFollowStatus('viewer', [...ids, 'u0', '', null, 'viewer']),
    follow.getBatchFollowStatus('viewer', ids.slice(5, 30))
  ]);
  assert.equal(calls.length, 3, '45 distinct entities use three bounded batches despite overlapping consumers');
  assert.ok(single.isFollowing);
  assert.equal(Object.keys(all).length, 45);
  assert.equal(Object.keys(overlapping).length, 25);
  assert.ok(calls.every(call => call.data.openid === 'viewer' && call.data.targetUserIds.length <= 20));
  await follow.getFollowStatus('viewer', 'u0');
  assert.equal(calls.length, 3);
  await follow.getFollowStatus('other', 'u0');
  assert.equal(calls.length, 4, 'different account does not reuse follow status');

  gate = deferred();
  const old = follow.getFollowStatus('viewer', 'race');
  const joined = follow.getFollowStatus('viewer', 'race');
  await settle();
  assert.equal(calls.length, 5, 'single requests share pending promise without timer polling');
  follow.updateFollowStatus('viewer', 'race', { isFollowing: false });
  gate.resolve({ result: { success: true, isFollowing: true } });
  await Promise.all([old, joined]);
  assert.equal((await follow.getFollowStatus('viewer', 'race')).isFollowing, false, 'old query cannot undo follow mutation');

  gate = deferred();
  const pending = follow.getFollowStatus('new-account', 'late');
  await settle();
  follow.clearAllFollowCache();
  gate.resolve({ result: { success: true, isFollowing: true } });
  await pending;
  assert.equal(cacheManager.namespace('follow:new-account').get('late'), undefined, 'clear includes cold namespaces with no storage index');
  gate = null;
  fail = true;
  assert.equal(await follow.getFollowStatus('viewer', 'retry'), null);
  fail = false;
  assert.equal((await follow.getFollowStatus('viewer', 'retry')).isFollowing, true, 'failure must not become negative cached status');
}

async function testAvatar() {
  const { globals, clock, cacheManager } = runtime();
  const fileUrlCache = load('cache/core/file-url.js', globals);
  fileUrlCache.setBatchDelay(0);
  let urlCalls = 0, profileCalls = 0, gate = null;
  fileUrlCache.setResolver(async ids => {
    urlCalls++;
    return Object.fromEntries(ids.map(id => [id, { url: `https://img/${urlCalls}/${id}`, maxAgeSec: 120 }]));
  });
  const avatar = load('cache/stores/avatar.js', {
    ...globals, fileUrlCache,
    cloudCall: async (name, data) => {
      profileCalls++;
      assert.equal(name, 'getBatchUserProfiles');
      assert.equal(data.rawAvatar, true);
      if (gate) return gate.promise;
      return { result: { success: true, userProfiles: data.userIds.filter(id => id !== 'missing').map(_openid => ({
        _openid, avatarUrl: `cloud://${_openid}`, nickName: _openid
      })) } };
    }
  });
  const [one, many] = await Promise.all([avatar.getUserAvatar('a'), avatar.getBatchUserAvatars(['a', 'b', 'a'])]);
  assert.equal(profileCalls, 1);
  assert.equal(urlCalls, 1, 'all avatars share one URL conversion');
  assert.equal(one.avatarUrl, many.a.avatarUrl);
  clock.now += 61000;
  const refreshed = await avatar.getUserAvatar('a');
  assert.notEqual(refreshed.avatarUrl, one.avatarUrl, 'refresh URL before expiry without refetching profile');
  assert.equal(profileCalls, 1);
  assert.equal(urlCalls, 2);
  assert.equal(cacheManager.namespace('avatars:v2').get('a').avatarUrl, 'cloud://a', 'display hydration does not overwrite file ID');
  assert.equal(await avatar.getUserAvatar('missing'), null);
  const before = profileCalls;
  await avatar.getUserAvatar('missing');
  assert.equal(profileCalls, before + 1, 'omitted entity can retry');
  gate = deferred();
  const pending = avatar.getUserAvatar('race');
  await settle();
  avatar.updateUserAvatar('race', { avatarUrl: 'https://new', nickName: 'new' });
  gate.resolve({ result: { success: true, userProfiles: [{ _openid: 'race', avatarUrl: 'https://old' }] } });
  await pending;
  assert.equal((await avatar.getUserAvatar('race')).avatarUrl, 'https://new');
}

async function testFileUrls() {
  const { globals, clock } = runtime();
  const cache = load('cache/core/file-url.js', globals);
  cache.setBatchDelay(60000);
  let calls = 0;
  let gate = deferred();
  cache.setResolver(() => { calls++; return gate.promise; });
  const first = cache.getTempUrl('cloud://a');
  const flush = cache._flush();
  cache.warm(['cloud://a']);
  const second = cache.getTempUrl('cloud://a');
  await cache._flush();
  assert.equal(calls, 1, 'read/warm during network request reuse the same request');
  gate.resolve({ 'cloud://a': { url: 'https://first', maxAgeSec: 120 } });
  await flush;
  assert.deepEqual(await Promise.all([first, second]), ['https://first', 'https://first']);
  cache.warm(['cloud://a']);
  await cache._flush();
  assert.equal(calls, 1, 'warm fresh entry does not hit SDK');

  clock.now += 61000;
  gate = deferred();
  const old = cache.getTempUrl('cloud://a');
  const oldFlush = cache._flush();
  const oldGate = gate;
  cache.invalidate('cloud://a');
  gate = deferred();
  const fresh = cache.getTempUrl('cloud://a');
  const newFlush = cache._flush();
  gate.resolve({ 'cloud://a': { url: 'https://new' } });
  await newFlush;
  oldGate.resolve({ 'cloud://a': { url: 'https://obsolete' } });
  await oldFlush;
  await Promise.all([old, fresh]);
  assert.equal(await cache.getTempUrl('cloud://a'), 'https://new', 'old resolution cannot overwrite new entry');

  cache.invalidate();
  gate = deferred();
  const beforeReset = cache.getTempUrl('cloud://a');
  const resetFlush = cache._flush();
  cache.invalidate();
  gate.resolve({ 'cloud://a': { url: 'https://before-reset' } });
  await resetFlush;
  await beforeReset;
  assert.equal(cache._getEntry('cloud://a'), undefined, 'account reset prevents in-flight cache refill');
}

async function testClearAll() {
  const { cacheManager } = runtime();
  const oldHandle = cacheManager.namespace('module', { persistent: true });
  cacheManager.clearAll();
  assert.equal(cacheManager.namespace('module'), oldHandle, 'import-time handles remain registered');
  oldHandle.set('key', 'private');
  const gate = deferred();
  const pending = oldHandle.getOrFetch('pending', () => gate.promise, { ttlMs: 1000 });
  await settle();
  cacheManager.clearAll();
  gate.resolve('late');
  await pending;
  assert.equal(oldHandle.keys().length, 0, 'second clear removes both imported-handle cache and in-flight writes');
}

async function testProfileOnly() {
  const { globals } = runtime();
  const api = load('api-cache/user-profile.js', {
    ...globals, normalizeAppBackgroundMode: () => '',
    callCloudAndUnwrap: async (name, data) => {
      assert.equal(data.onlyProfile, true);
      return { userInfo: { nickName: 'reader' } };
    }
  }, ['getUserInfo']);
  assert.equal((await api.getUserInfo('a')).nickName, 'reader');
}

async function testHomePreload() {
  const source = fs.readFileSync(path.join(root, 'pages/index/index.vue'), 'utf8').match(/<script[^>]*>([\s\S]*?)<\/script>/)[1];
  const component = parse(source, { sourceType: 'module' }).program.body.find(node => node.type === 'ExportDefaultDeclaration').declaration;
  const methods = component.properties.find(node => node.key?.name === 'methods').value;
  const method = methods.properties.find(node => node.key?.name === 'preloadUserData').value;
  let followCalls = 0, avatarCalls = 0;
  const preload = vm.runInNewContext(`(${source.slice(method.start, method.end)})`, {
    followCache: { preloadFollowStatusFromPosts: () => followCalls++ },
    avatarCache: { preloadAvatarsFromPosts: () => avatarCalls++ }
  });
  preload.call({ getCurrentUserId: () => 'viewer' }, [{ _openid: 'author' }]);
  assert.equal(followCalls, 1, '首页继续预取详情页实际消费的关注状态');
  assert.equal(avatarCalls, 0, '首页不再查询没有消费者的头像缓存');
  preload.call({ getCurrentUserId: () => '' }, [{ _openid: 'author' }]);
  assert.equal(followCalls, 1, '未登录不预取');
}

async function testManySingleReads() {
  const { globals, cacheManager } = runtime();
  let calls = 0;
  const reader = globals.createCachedBatchReader({
    namespace: () => cacheManager.namespace('concurrent'), ttlMs: 1000,
    fetchBatch: async ids => {
      calls++;
      return Object.fromEntries(ids.map(id => [id, { id }]));
    }
  });
  const result = await Promise.all(Array.from({ length: 20 }, (_, i) => reader.read(`u${i}`)));
  assert.equal(result.length, 20);
  assert.equal(calls, 1, '20 concurrent entity reads use one cloud batch');
}

(async () => {
  for (const test of [testFollow, testAvatar, testFileUrls, testClearAll, testProfileOnly, testHomePreload, testManySingleReads]) {
    await test();
    console.log(`PASS ${test.name}`);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
