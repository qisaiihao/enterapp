const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parse } = require('@babel/parser');

const root = path.join(__dirname, '..');
const quiet = { log() {}, warn() {}, error() {} };
const posts = Array.from({ length: 37 }, (_, index) => ({
  _id: `post-${index}`, _openid: 'me', createTime: 100 - index,
  ...(index >= 13 ? { isOriginal: true } : index % 2 ? { isOriginal: false } : {}),
  ...(index === 20 ? { _openid: 'anonymous', realAuthorOpenid: 'me', isAnonymous: true } : {}),
  ...(index === 21 ? { isHidden: true } : {}),
  ...(index === 22 ? { isSeries: true } : {})
}));
const foreignPost = { _id: 'foreign', _openid: 'other', isOriginal: true, createTime: 200 };

function loadBackend() {
  const evaluate = (value, row) => {
    if (typeof value === 'string' && value.startsWith('$$')) return 'me';
    if (typeof value === 'string' && value.startsWith('$')) return row[value.slice(1)];
    if (value && value.$or) return value.$or.some(part => evaluate(part, row));
    if (value && value.$eq) return evaluate(value.$eq[0], row) === evaluate(value.$eq[1], row);
    return value;
  };
  const db = {
    command: { aggregate: {} },
    collection(name) {
      assert.equal(name, 'users');
      let pipeline;
      const query = {
        aggregate() { return query; }, match() { return query; }, limit() { return query; },
        lookup(spec) { pipeline = spec.pipeline; return query; }, project() { return query; },
        async end() {
          let list = structuredClone([...posts, foreignPost]);
          for (const stage of pipeline) {
            if (stage.$match) list = list.filter(row => Object.entries(stage.$match).every(([key, value]) =>
              key === '$expr' ? evaluate(value, row) : row[key] === value));
            if (stage.$sort) list.sort((a, b) => b.createTime - a.createTime);
            if (stage.$skip !== undefined) list = list.slice(stage.$skip);
            if (stage.$limit !== undefined) list = list.slice(0, stage.$limit);
          }
          return { list: [{ nickName: '我', avatarUrl: '/static/avatar.png', posts: list }] };
        }
      };
      return query;
    }
  };
  const globals = {
    exports: {}, console: quiet,
    require(name) {
      if (name === 'wx-server-sdk') return { init() {}, database: () => db, getWXContext: () => ({ OPENID: 'me' }) };
      if (name.includes('request-context')) return { resolveOpenId: () => 'me' };
      if (name.includes('handlers/drafts')) return { createDraftHandlers: () => ({}) };
      if (name.includes('handlers/favorites')) return { createFavoriteHandlers: () => ({}) };
      if (name.includes('default-avatar')) return { ensureUserDefaultAvatar: async () => '/static/avatar.png' };
      throw new Error(name);
    }
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'functions/getMyProfileData/index.js'), 'utf8'), globals);
  return globals.exports.main;
}

function stripImports(source, globals) {
  const imports = parse(source, { sourceType: 'module' }).program.body.filter(node => node.type === 'ImportDeclaration');
  for (const node of imports.reverse()) {
    for (const specifier of node.specifiers) globals[specifier.local.name] = {};
    source = source.slice(0, node.start) + source.slice(node.end);
  }
  return source;
}

function loadApi(read) {
  const globals = {};
  const source = stripImports(fs.readFileSync(path.join(root, 'api-cache/my.js'), 'utf8'), globals);
  globals.cacheManager = { namespace: () => ({}) };
  globals.callCloudAndUnwrap = async (name, payload) => {
    assert.equal(name, 'getMyProfileData');
    return read(payload);
  };
  vm.runInNewContext(source.replace(/export /g, '') + '\nglobalThis.getPosts = getMyPosts;', globals);
  return globals.getPosts;
}

function loadPage(getPosts) {
  const globals = { module: { exports: {} }, console: quiet };
  const file = fs.readFileSync(path.join(root, 'pages/profile/profile.vue'), 'utf8');
  const source = stripImports(file.match(/<script>([\s\S]*?)<\/script>/)[1], globals);
  Object.assign(globals, {
    getMyPosts: getPosts, getOpenid: () => 'me', getThemeMode: () => 'light',
    resolveUserAvatar: value => value || '/static/avatar.png',
    extractGrowthStats: user => user.growthCounts,
    uni: { showToast() {}, getStorageSync() {} }
  });
  vm.runInNewContext(source.replace('export default', 'module.exports ='), globals);
  const page = globals.module.exports;
  const instance = Object.assign(page.data(), {
    hasInitialSnapshot: true, isLoading: false,
    userInfo: { nickName: '我', avatarUrl: '/static/avatar.png', growthCounts: { seed: 37 } }
  });
  for (const [key, method] of Object.entries(page.methods)) instance[key] = method.bind(instance);
  Object.assign(instance, {
    setData(updates) { Object.assign(this, updates); },
    formatTime: String,
    fetchProfileHeaderSnapshot: async () => ({ userInfo: instance.userInfo, growthStats: instance.userInfo.growthCounts }),
    syncAtomicUserSession: async () => {},
    loadPortfolios() {}, loadTimelineData() {}, loadFavorites() {}
  });
  return { instance, globals };
}

const clickPosts = instance => instance.switchTab({ currentTarget: { dataset: { tab: 'posts' } } });
const ids = list => Array.from(list, post => post._id);

async function main() {
  const read = loadBackend();
  const getPosts = loadApi(read);
  assert.deepEqual(ids(await getPosts({ pageSize: 50 })), ids(posts), 'default includes originals, reposts and legacy posts');
  const originals = posts.filter(post => post.isOriginal === true);
  const pages = await Promise.all([0, 1, 2].map(page => getPosts({ page, pageSize: 10, originalOnly: true })));
  assert.deepEqual(pages.map(list => list.length), [10, 10, 4], 'filter before pagination even with 13 leading reposts');
  assert.deepEqual(ids(pages.flat()), ids(originals), 'all originals remain reachable, including anonymous, hidden and series posts');
  assert.equal((await getPosts({ page: 3, pageSize: 10, originalOnly: true })).length, 0);
  assert.equal((await read({ originalOnly: 'true', limit: 50 })).posts.length, posts.length, 'only a boolean true enables filtering');

  const { instance, globals } = loadPage(getPosts);
  const pageSize = instance.PAGE_SIZE;
  await instance.refreshProfileAtomically();
  assert.equal(instance.postsOriginalOnly, false);
  assert.deepEqual(ids(instance.myPosts), ids(posts.slice(0, pageSize)));
  await clickPosts(instance);
  assert.equal(instance.postsOriginalOnly, true);
  assert.deepEqual(ids(instance.myPosts), ids(originals.slice(0, pageSize)));
  for (let page = 1; page < Math.ceil(originals.length / pageSize); page++) await instance.loadMyPosts();
  assert.deepEqual(ids(instance.myPosts), ids(originals));
  assert.equal(instance.hasMore, false);
  await instance.refreshProfileAtomically({ reason: 'pull-down' });
  assert.equal(instance.postsOriginalOnly, true, 'refresh keeps the selected filter');
  assert.deepEqual(ids(instance.myPosts), ids(originals.slice(0, pageSize)));

  instance.switchTab({ currentTarget: { dataset: { tab: 'portfolio' } } });
  await clickPosts(instance);
  assert.equal(instance.postsOriginalOnly, true, 'entering the posts tab does not toggle the filter');
  await clickPosts(instance);
  assert.equal(instance.postsOriginalOnly, false);
  assert.deepEqual(ids(instance.myPosts), ids(posts.slice(0, pageSize)));

  const pending = [];
  globals.getMyPosts = args => new Promise((resolve, reject) => pending.push({ args, resolve, reject }));
  const olderPage = instance.loadMyPosts();
  await instance.loadMyPosts();
  assert.equal(pending.length, 1, 'repeated reach-bottom events share the active pagination request');
  const toggle = clickPosts(instance);
  assert.equal(pending[1].args.originalOnly, true);
  assert.equal(instance.myPosts.length, 0, 'old posts are cleared while the new filter loads');
  pending[1].resolve(await getPosts(pending[1].args));
  await toggle;
  pending[0].resolve(await getPosts(pending[0].args));
  await olderPage;
  assert.deepEqual(ids(instance.myPosts), ids(originals.slice(0, pageSize)), 'old all-posts pagination cannot enter originals');
  assert.equal(instance.page, 1);

  const allToggle = clickPosts(instance);
  const originalToggle = clickPosts(instance);
  pending[3].resolve(await getPosts(pending[3].args));
  await originalToggle;
  pending[2].resolve(await getPosts(pending[2].args));
  await allToggle;
  assert.equal(instance.postsOriginalOnly, true);
  assert.deepEqual(ids(instance.myPosts), ids(originals.slice(0, pageSize)), 'latest toggle wins even with responses out of order');
  assert.equal(instance.isAtomicRefreshing, false);
  assert.equal(instance.isLoading, false);

  globals.getMyPosts = async () => [];
  await instance.refreshProfileAtomically();
  assert.equal(instance.myPosts.length, 0);
  assert.equal(instance.hasMore, false);
  assert.equal(instance.postsLoadError, false);
  globals.getMyPosts = async () => { throw new Error('offline'); };
  await instance.refreshProfileAtomically();
  assert.equal(instance.postsLoadError, true, 'load failure is distinct from no originals');
  globals.getMyPosts = getPosts;
  await instance.refreshProfileAtomically();
  assert.equal(instance.postsLoadError, false);
  assert.deepEqual(ids(instance.myPosts), ids(originals.slice(0, pageSize)));
  console.log('[test-profile-original-filter] PASS: backend/API pagination, anonymous and hidden originals, tab toggle, refresh, stale requests, empty state and retry');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
