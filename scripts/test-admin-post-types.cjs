const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parse } = require('@babel/parser');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const quiet = { log() {}, warn() {}, error() {} };

function loadModule(source, imports = {}) {
  for (const node of parse(source, { sourceType: 'module' }).program.body.reverse()) {
    if (node.type === 'ImportDeclaration' || (node.type === 'ExportNamedDeclaration' && !node.declaration)) source = source.slice(0, node.start) + source.slice(node.end);
    else if (node.type === 'ExportDefaultDeclaration') source = source.slice(0, node.start) + 'module.exports = ' + source.slice(node.declaration.start);
    else if (node.type === 'ExportNamedDeclaration') source = source.slice(0, node.start) + source.slice(node.declaration.start);
  }
  const globals = { module: { exports: {} }, console: quiet, ...imports };
  vm.runInNewContext(source, globals);
  return globals.module.exports;
}

async function main() {
  const rows = [
    ...Array.from({ length: 25 }, (_, i) => ({ _id: `normal-${i}`, createTime: 200 - i })),
    ...Array.from({ length: 23 }, (_, i) => ({ _id: `original-${i}`, createTime: 100 - i, isPoem: true, isOriginal: true })),
    { _id: 'non-original-legacy', createTime: 60, isPoem: true },
    { _id: 'non-original-false', createTime: 59, isPoem: true, isOriginal: false, isDiscussion: false },
    { _id: 'non-original-null', createTime: 58, isPoem: true, isOriginal: null },
    { _id: 'normal-null', createTime: 57, isPoem: null, isDiscussion: null },
    { _id: 'discussion', createTime: 56, isDiscussion: true },
    { _id: 'discussion-priority', createTime: 55, isDiscussion: true, isPoem: true, isOriginal: true }
  ];
  const db = {
    command: { aggregate: {}, neq: value => ({ neq: value }) },
    collection(name) {
      assert.equal(name, 'posts');
      let filter = {}, skip = 0, limit = 100;
      const query = {
        where(value) { filter = value; return query; }, orderBy() { return query; },
        skip(value) { skip = value; return query; }, limit(value) { limit = value; return query; },
        async get() {
          const selected = rows.filter(row => Object.entries(filter).every(([key, value]) =>
            value && typeof value === 'object' && 'neq' in value ? row[key] !== value.neq : row[key] === value));
          return { data: structuredClone(selected.sort((a, b) => b.createTime - a.createTime).slice(skip, skip + limit)) };
        }
      };
      return query;
    }
  };
  const globals = { exports: {}, console: quiet, require(name) {
    if (name === 'wx-server-sdk') return { init() {}, database: () => db };
    if (name.includes('admin-auth')) return { isAdminByPoemId: async ({ openid }) => openid === 'admin' };
    if (name === './_lib/activity') return require(path.join(root, 'functions/_lib/activity.js'));
    return {};
  } };
  vm.runInNewContext(read('functions/adminManager/index.js'), globals);
  const run = payload => globals.exports.main({ action: 'getAllPosts', openid: 'admin', ...payload });
  assert.equal((await run({ openid: 'user', postType: 'original' })).success, false);
  assert.equal((await run({ postType: 'invalid' })).success, false);
  const expected = {
    normal: rows.filter(row => row._id.startsWith('normal')).map(row => row._id),
    original: rows.filter(row => row._id.startsWith('original')).map(row => row._id),
    'non-original': ['non-original-legacy', 'non-original-false', 'non-original-null'],
    discussion: ['discussion', 'discussion-priority']
  };
  for (const [postType, ids] of Object.entries(expected)) {
    const found = [];
    for (let page = 0; ; page++) {
      const result = await run({ postType, page, pageSize: 10 });
      assert.equal(result.success, true);
      assert.ok(result.posts.every(post => post.postType === postType));
      found.push(...result.posts.map(post => post._id));
      if (!result.hasMore) break;
      assert.ok(page < 10);
    }
    assert.deepEqual(found, ids);
  }
  const all = await run({ pageSize: 50 });
  assert.equal(all.posts.length, 50);
  assert.equal(all.hasMore, true);
  assert.equal((await run({ postType: 'discussion', pageSize: 2 })).hasMore, false, 'exact final page has no more');
  assert.equal((await run({ postType: 'original', page: 3, pageSize: 10 })).posts.length, 0);

  const calls = [];
  const api = loadModule(read('api-cache/admin-manager.js'), {
    callActionAndUnwrap: async options => {
      calls.push(options);
      const result = await run(options.payload);
      if (!result.success) throw new Error(result.error);
      return result;
    }
  });
  const component = loadModule(read('pages-admin/admin-posts/admin-posts.vue').match(/<script>([\s\S]*?)<\/script>/)[1], {
    listAdminPosts: api.listAdminPosts,
    updateAdminPostType: async ({ postId, postType }) => {
      const row = rows.find(row => row._id === postId);
      row.isDiscussion = postType === 'discussion'; row.isPoem = ['original', 'non-original'].includes(postType); row.isOriginal = postType === 'original';
    },
    deleteAdminPost: async ({ postId }) => rows.splice(rows.findIndex(row => row._id === postId), 1),
    uni: { showToast() {}, showLoading() {}, hideLoading() {}, stopPullDownRefresh() {} }
  });
  const instance = () => {
    const page = component.data();
    for (const [name, method] of Object.entries(component.methods)) page[name] = method.bind(page);
    return page;
  };
  const page = instance();
  await page.loadPosts();
  assert.equal(page.posts[0]._id, 'normal-0');
  await page.selectPostType('original');
  assert.equal(page.posts.length, 20);
  assert.equal(calls.at(-1).payload.postType, 'original');
  assert.equal(calls.at(-1).context, page);
  await page.loadPosts();
  assert.equal(page.posts.length, 23);
  assert.equal(page.hasMore, false);
  await component.onPullDownRefresh.call(page);
  assert.equal(page.posts.length, 20);
  assert.equal(page.activePostType, 'original');
  page.selectedPostIndex = 0;
  await page.changePostType({ currentTarget: { dataset: { type: 'discussion' } } });
  assert.ok(page.posts.every(post => post.postType === 'original'));
  assert.equal(page.posts[0]._id, 'original-1');
  await page.deletePost('original-1', 0);
  assert.equal(page.posts[0]._id, 'original-2');

  const pending = [];
  const raceComponent = loadModule(read('pages-admin/admin-posts/admin-posts.vue').match(/<script>([\s\S]*?)<\/script>/)[1], {
    listAdminPosts: options => new Promise((resolve, reject) => pending.push({ options, resolve, reject })),
    uni: { showToast() {}, stopPullDownRefresh() {} }
  });
  const race = raceComponent.data();
  for (const [name, method] of Object.entries(raceComponent.methods)) race[name] = method.bind(race);
  const old = race.loadPosts();
  const latest = race.selectPostType('discussion');
  pending[1].resolve({ posts: [{ _id: 'latest', postType: 'discussion' }], hasMore: false });
  await latest;
  pending[0].resolve({ posts: [{ _id: 'stale' }], hasMore: true });
  await old;
  assert.equal(race.posts[0]._id, 'latest');
  assert.equal(race.hasMore, false);
  const failed = race.selectPostType('normal');
  pending[2].reject(new Error('网络异常'));
  await failed;
  assert.equal(race.page, 0);
  assert.equal(race.loading, false);
  assert.equal(race.loadError, '网络异常');
  const retry = race.loadPosts();
  assert.equal(pending[3].options.postType, 'normal');
  assert.equal(pending[3].options.page, 0);
  pending[3].resolve({ posts: [], hasMore: false });
  await retry;
  assert.equal(race.loadError, '');
  assert.equal(race.posts.length, 0);
  assert.equal(race.hasMore, false);
  console.log('[test-admin-post-types] PASS: server filtering before pagination, legacy fields, admin permission, API/page wiring, refresh, type changes, deletion, stale responses and retry');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
