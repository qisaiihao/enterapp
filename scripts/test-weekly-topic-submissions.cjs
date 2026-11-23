const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const cloud = require('wx-server-sdk');
const { memoryDb } = require('./helpers/posts-memory-db.cjs');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const stripImports = source => source.replace(/import[\s\S]*?from\s+['"][^'"]+['"];?/g, '');
cloud.init({ env: 'weekly-topic-test' });

const inPeriod = new Date('2026-11-12T12:00:00+08:00');
const older = new Date('2026-06-01T12:00:00+08:00');
const recentSubmissions = Array.from({ length: 31 }, (_, index) => ({
  _id: `submission-${index}`,
  schemaVersion: 2,
  publishMode: 'poem',
  isOriginal: true,
  joinedActivityId: 'activity',
  joinedActivityTitleSnapshot: '「风」主题诗歌创作',
  title: index === 30 ? '风声 (A)+' : `第 ${index + 1} 首`,
  createTime: new Date(+inPeriod - index * 1000)
}));
const activities = [
  ...Array.from({ length: 50 }, (_, index) => ({ _id: `other-${index}`, title: '其他活动', sortWeight: 100 - index, startTime: inPeriod })),
  { _id: 'activity', title: '「风」主题诗歌创作', sortWeight: 1, startTime: inPeriod, status: 'archived' },
  { _id: 'spring', title: '春季征稿', sortWeight: 0, startTime: older }
];
const { db } = memoryDb({ activities, posts: [
  ...recentSubmissions,
  { _id: 'early-submission', joinedActivityId: 'spring', authorNameSnapshot: '春雨 (A)+', content: '第一行', createTime: older },
  { _id: 'ordinary-poem', isPoem: true, isOriginal: true, joinedActivityId: '', createTime: inPeriod },
  { _id: 'notice', activityId: 'activity', isActivityPost: true, createTime: inPeriod },
  { _id: 'hidden-submission', joinedActivityId: 'activity', isHidden: true, createTime: inPeriod }
] }, cloud.database().command);

const adminFile = 'functions/adminManager/index.js';
const admin = {
  exports: {}, console, Date,
  require(name) {
    if (name === 'wx-server-sdk') return { init() {}, database: () => db, getWXContext: () => ({ OPENID: 'admin' }) };
    if (name === './_lib/admin-auth') return { isAdminByPoemId: async () => true };
    return require(path.resolve(root, path.dirname(adminFile), name));
  }
};
vm.runInNewContext(read(adminFile), admin);

const requests = [];
const api = {
  async callActionAndUnwrap({ action, payload }) {
    requests.push({ action, payload });
    const result = await admin.exports.main({ action, ...payload });
    assert.equal(result.success, true, JSON.stringify(result));
    return result;
  }
};
vm.runInNewContext(stripImports(read('api-cache/admin-weekly.js')).split('export {')[0], api);
vm.runInNewContext(stripImports(read('api-cache/admin-activities.js')).split('export {')[0], api);

const page = {
  module: { exports: {} }, Date, console, setTimeout, clearTimeout,
  uni: { showToast({ title }) { throw new Error(title); } },
  listAdminActivities: api.listAdminActivities,
  listAdminWeeklySubmissionPosts: api.listAdminWeeklySubmissionPosts,
  listAdminWeeklyCandidatePosts: api.listAdminWeeklyCandidatePosts
};
const script = read('pages-admin/weekly-management/weekly-management.vue').match(/<script>([\s\S]*?)<\/script>/)[1];
vm.runInNewContext(stripImports(script).replace('export default', 'module.exports ='), page);
const component = page.module.exports;
const state = Object.assign(component.data(), component.methods, { loadCoverPreview() {} });
for (const [name, compute] of Object.entries(component.computed)) {
  Object.defineProperty(state, name, { get: compute.bind(state) });
}
const postIds = posts => Array.from(posts, post => post.postId);

(async () => {
  await state.openTopicForm({
    periodStart: inPeriod, periodEnd: inPeriod,
    selectedPostIds: ['ordinary-poem'], selectedSnapshots: [{ postId: 'ordinary-poem', title: '往期已选' }]
  });
  const initialRequest = requests.find(request => request.action === 'listWeeklySubmissionPosts');
  assert.equal(Object.hasOwn(initialRequest.payload, 'periodStart'), false);
  assert.deepEqual(postIds(state.topicSubmissions), recentSubmissions.slice(0, 30).map(post => post._id));
  assert.equal(state.topicSubmissions[0].activityTitle, '「风」主题诗歌创作');
  assert.equal(state.topicSubmissionsHasMore, true);
  assert.equal(state.getPostTitle('ordinary-poem'), '往期已选');
  assert.equal(state.topicSubmissionActivityOptions[0].title, '全部活动');
  const windIndex = state.topicSubmissionActivityOptions.findIndex(option => option._id === 'activity');
  assert.equal(windIndex, 51, '可选取第二页中的往期活动');

  const initialRequestCount = requests.length;
  state.onTopicPeriodEndChange({ detail: { value: '2026-12-01' } });
  assert.equal(requests.length, initialRequestCount);
  await state.loadTopicSubmissions(true);
  assert.equal(state.topicSubmissions.length, 32);
  assert.equal(state.topicSubmissions[31].postId, 'early-submission');
  state.toggleTopicPostSelection(state.topicSubmissions[31]);

  await state.onTopicSubmissionActivityChange({ detail: { value: String(windIndex) } });
  assert.equal(requests.at(-1).payload.activityId, 'activity');
  await state.loadTopicSubmissions(true);
  assert.equal(state.topicSubmissions.length, 31);
  assert.equal(state.topicSubmissions[30].postId, 'submission-30');
  assert.equal(state.topicSubmissionsHasMore, false);

  let resolveOld;
  page.listAdminWeeklySubmissionPosts = () => new Promise(resolve => { resolveOld = resolve; });
  const pending = state.loadTopicSubmissions();
  page.listAdminWeeklySubmissionPosts = api.listAdminWeeklySubmissionPosts;
  state.searchTopicSubmissions('(a)+');
  await state.loadTopicSubmissions();
  resolveOld({ posts: [{ postId: 'old-result' }] });
  await pending;
  assert.deepEqual(postIds(state.topicSubmissions), ['submission-30']);
  await state.onTopicSubmissionActivityChange({ detail: { value: '0' } });
  assert.deepEqual(postIds(state.topicSubmissions), ['submission-30', 'early-submission']);
  assert.deepEqual(Array.from(state.buildTopicPayload().selectedPostIds), ['ordinary-poem', 'early-submission']);

  state.issueForm.periodStart = '2026-11-12';
  state.issueForm.periodEnd = '2026-11-12';
  await state.loadPeriodPosts();
  assert.ok(postIds(state.periodPosts).includes('ordinary-poem'));
  assert.equal(postIds(state.periodPosts).includes('early-submission'), false);
  console.log('主题投稿筛选、分页、搜索与周刊日期选诗回归检查通过');
})().catch(error => { console.error(error); process.exitCode = 1; });
