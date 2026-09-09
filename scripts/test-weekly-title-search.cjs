const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../pages-admin/weekly-management/weekly-management.vue'), 'utf8');
const script = source.match(/<script>([\s\S]*?)<\/script>/)[1]
  .replace(/import[\s\S]*?from\s+['"][^'"]+['"];?/g, '')
  .replace('export default', 'module.exports =');
let query;
const sandbox = {
  module: { exports: {} }, console, setTimeout, clearTimeout,
  uni: { showToast() {} },
  listAdminWeeklyCandidatePosts: args => query(args)
};
vm.runInNewContext(script, sandbox);
const component = sandbox.module.exports;
function page() {
  const state = component.data();
  Object.assign(state, component.methods);
  state.issueForm.periodStart = '2026-09-01';
  state.issueForm.periodEnd = '2026-09-09';
  return state;
}

(async () => {
  const state = page();
  const calls = [];
  query = async args => {
    calls.push(args);
    return { posts: Array.from({ length: 100 }, (_, i) => ({ postId: String(i), title: '诗歌' })), hasMore: true };
  };
  await state.loadPeriodPosts();
  assert.equal(calls.length, 1, '默认列表仍只加载一页');

  calls.length = 0;
  state.periodKeyword = '诗歌 (春天)+';
  state.issueForm.featuredPostIds = ['selected'];
  query = async args => {
    calls.push(args);
    assert.equal(args.periodStart, '2026-09-01');
    assert.equal(args.periodEnd, '2026-09-09');
    assert.equal(args.keyword, '诗歌 \\(春天\\)\\+');
    return {
      posts: Array.from({ length: args.skip < 200 ? 100 : 5 }, (_, i) => ({ postId: String(args.skip + i), title: state.periodKeyword })),
      hasMore: args.skip < 200
    };
  };
  await state.loadPeriodPosts();
  assert.deepEqual(calls.map(item => item.skip), [0, 100, 200]);
  assert.equal(state.periodPosts.length, 205, '搜索结果不受 100 首上限影响');
  assert.equal(state.issueForm.featuredPostIds[0], 'selected');

  let resolveOld;
  query = () => new Promise(resolve => { resolveOld = resolve; });
  const oldRequest = state.loadPeriodPosts();
  state.periodKeyword = '新标题';
  query = async () => ({ posts: [{ postId: 'new', title: '新标题' }], hasMore: false });
  await state.loadPeriodPosts();
  resolveOld({ posts: [{ postId: 'old' }], hasMore: true });
  await oldRequest;
  assert.equal(state.periodPosts[0].postId, 'new', '旧请求不能覆盖新搜索');
  assert.equal(state.periodPostsLoading, false);

  state.periodKeyword = '';
  await state.loadPeriodPosts();
  assert.equal(state.periodPosts.length, 1, '清空关键词可恢复默认查询');
  state.issueForm.periodStart = '2026-09-31';
  query = () => { throw new Error('无效日期不应查询'); };
  await state.loadPeriodPosts();
  assert.equal(state.periodPosts.length, 0);
  console.log('周刊标题搜索回归检查通过');
})().catch(error => { console.error(error); process.exitCode = 1; });
