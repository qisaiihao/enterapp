const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../dist/build/mp-weixin');
const modules = new Map();
const requests = [];
function load(file) {
  const full = path.resolve(root, file);
  if (modules.has(full)) return modules.get(full).exports;
  const module = { exports: {} };
  modules.set(full, module);
  vm.runInNewContext(fs.readFileSync(full, 'utf8'), {
    module, exports: module.exports, console,
    require(name) {
      if (name.endsWith('/core/manager.js')) return { singleton: { namespace: () => new Map() } };
      if (name.endsWith('/cloud-wrapper.js')) return { callCloudAndUnwrap: async (name, payload) => {
        requests.push({ name, payload });
        return { success: true, posts: [{ title: '春天' }], hotSearches: ['春天'] };
      } };
      return load(path.relative(root, path.resolve(path.dirname(full), name)));
    }
  }, { filename: file });
  return module.exports;
}

(async () => {
  const cache = load('utils/searchCache.js').searchCache;
  assert.ok(cache && typeof cache.get === 'function');
  cache.set('春天', 'all', 'relevance', 1, { posts: ['春天'] });
  assert.equal(cache.get('春天', 'all', 'relevance', 1).posts[0], '春天');
  const history = load('cache/stores/search-history.js').searchHistoryStore;
  history.addSearchHistory('春天');
  assert.equal(history.getDisplayHistory()[0], '春天');
  const highlighter = load('utils/searchHighlighter.js').SearchHighlighter;
  assert.ok(highlighter.highlightTitle('春天来了', highlighter.extractKeywords('春天')).includes('<mark'));
  const api = load('api-cache/search.js');
  assert.equal((await api.getHotSearches()).hotSearches[0], '春天');
  assert.equal((await api.searchPosts(' 春天 ')).posts[0].title, '春天');
  assert.equal(requests[1].payload.keyword, '春天');
  console.log('小程序搜索编译产物：模块加载、缓存、历史、高亮和接口调用通过');
})().catch(error => { console.error(error); process.exitCode = 1; });
