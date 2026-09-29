const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const cloud = require('wx-server-sdk');
const { memoryDb } = require('./helpers/posts-memory-db.cjs');
cloud.init({ env: 'posts-runtime-test' });
const command = cloud.database().command;
const root = path.resolve(__dirname, '..');

// 隔离旧运行时能力，不能删除宿主 Object.fromEntries 来影响测试数据库或 SDK。
function runtimeLoader(db) {
  const context = vm.createContext({ Date, process: { env: {} }, console: { log() {}, warn() {}, error() {} } });
  vm.runInContext('Object.fromEntries = undefined', context);
  const cache = new Map();
  function load(filename) {
    filename = require.resolve(filename);
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} };
    cache.set(filename, module);
    const localRequire = id => {
      if (id === 'wx-server-sdk') return { init() {}, database: () => db, getWXContext: () => ({ OPENID: 'viewer' }) };
      if (id.includes('get-blocked-user-ids')) return async () => [];
      if (id.startsWith('.')) return load(path.resolve(path.dirname(filename), id));
      throw Error('Unexpected dependency: ' + id);
    };
    vm.runInContext('(function(require,module,exports){\n' + fs.readFileSync(filename, 'utf8') + '\n})', context, { filename })(localRequire, module, module.exports);
    return module.exports;
  }
  return load;
}

(async () => {
  const rows = [
    { _id: 'old-poem', isPoem: true, isOriginal: true, createTime: new Date(1000) },
    { _id: 'new-poem', schemaVersion: 2, publishMode: 'poem', isOriginal: true, createTime: new Date(2000) },
    { _id: 'normal', createTime: new Date(500) }
  ];
  const mem = memoryDb({ posts: rows, users: [], votes_log: [] }, command);
  const load = runtimeLoader(mem.db);
  const query = load(path.join(root, 'functions/_shared/posts/query.js'));
  const filter = query.compatibleWhere({ isPoem: true, isHidden: command.neq(true), _id: command.nin(['hidden']) });
  assert.ok(JSON.stringify(filter).includes('publishMode'));
  const special = { isPoem: true, metadata: JSON.parse('{"__proto__":{"marker":"own-property"}}') };
  const encoded = JSON.stringify(query.compatibleWhere(special));
  assert.ok(encoded.includes('"__proto__"'), '转换保留自有字段，不能触发原型赋值');
  const main = load(path.join(root, 'functions/getPostList/index.js')).main;
  for (const [params, expected] of [
    [{ isPoem: true, isOriginal: true }, ['new-poem', 'old-poem']],
    [{ homeRanking: true }, ['normal', 'new-poem', 'old-poem']],
    [{ isPoem: false, isDiscussion: false }, ['normal']]
  ]) {
    const result = await main({ limit: 10, ...params });
    assert.equal(result.success, true, JSON.stringify(result));
    assert.deepEqual(Array.from(result.posts, post => post._id), expected);
  }
  console.log('PASS posts runtime: no Object.fromEntries, SDK predicates, V1/V2 lists and home ranking');
})().catch(error => { console.error(error); process.exitCode = 1; });
