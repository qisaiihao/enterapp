const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../functions/getWeeklyContent/index.js'), 'utf8');
const context = {
  exports: {}, console,
  require: () => ({ init() {}, database: () => ({ command: { aggregate: {} } }) })
};
vm.createContext(context);
vm.runInContext(source, context);
const latest = { _id: 'latest', title: '新一期', heroItems: [] };
const older = { _id: 'older', title: '往期精选' };
Object.assign(context, {
  listPublishedIssues: async () => [latest],
  listPublishedTopics: async () => [],
  getConfiguredFeaturedIssueIds: async () => ['deleted'],
  fetchPublishedIssuesByIds: async () => [],
  getIssueViewCountMap: async () => new Map(),
  applyFreshIssueStats: async issue => issue,
  computeRecentWeeklyRanking: async () => [],
  getCallerOpenid: () => '',
  attachLikedStateToDetail: async () => {},
  attachLikedToSnapshotList: async items => items
});

(async () => {
  let result = await context.exports.main({ mode: 'home' });
  assert.equal(result.success, true);
  assert.equal(result.issues[0].id, 'latest', '精选配置全部失效时回退到最新已发布周刊');
  assert.equal(result.currentIssue.id, 'latest');

  context.fetchPublishedIssuesByIds = async () => [older];
  result = await context.exports.main({ mode: 'home' });
  assert.equal(result.issues[0].id, 'older', '有效精选配置继续生效');
  assert.equal(result.currentIssue.id, 'latest', '当前周刊不能被精选列表中的旧期替代');

  context.listPublishedIssues = async () => [];
  context.fetchPublishedIssuesByIds = async () => [];
  result = await context.exports.main({ mode: 'home' });
  assert.equal(result.success, true);
  assert.equal(result.currentIssue, null);
  assert.equal(result.issues.length, 0);
  console.log('周刊首页回归检查通过');
})().catch(error => { console.error(error); process.exitCode = 1; });
