const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const stripImports = source => source.replace(/import[\s\S]*?from\s+['"][^'"]+['"];?/g, '');
const cloudMock = { init() {}, database: () => ({ command: { aggregate: {} } }) };
function cloudContext(file) {
  const context = {
    exports: {}, console,
    require: name => name === 'wx-server-sdk' ? cloudMock : require(path.resolve(__dirname, '..', path.dirname(file), name))
  };
  vm.createContext(context);
  vm.runInContext(read(file), context);
  return context;
}

(async () => {
  const cover = 'cloud://test/weekly-covers/topic.jpg';
  const admin = cloudContext('functions/adminManager/index.js');
  const publicApi = cloudContext('functions/getWeeklyContent/index.js');
  const saved = await admin.buildWeeklyTopicPayload({
    title: '春天', coverImage: ` ${cover} `,
    periodStart: '2026-09-01', periodEnd: '2026-09-22'
  }, { requireTitle: true });
  assert.equal(saved.data.coverImage, cover, '新建主题保存云文件 ID');
  assert.equal(admin.buildWeeklyTopicView(saved.data).coverImage, cover, '管理端编辑回填封面');
  assert.equal(publicApi.buildTopicView(saved.data).coverImage, cover, '公共接口返回主题封面');
  const cleared = await admin.buildWeeklyTopicPayload({ coverImage: '' }, { current: saved.data });
  assert.equal(cleared.data.coverImage, '', '支持移除封面');
  const untouched = await admin.buildWeeklyTopicPayload({ summary: '更新说明' }, { current: saved.data });
  assert.equal(Object.hasOwn(untouched.data, 'coverImage'), false, '旧客户端更新其他字段不能清除封面');
  assert.equal(publicApi.buildTopicView({}).coverImage, '', '兼容无封面的旧主题');

  // 使用真实的地址转换逻辑验证主题列表中的 cloud:// 封面可以显示。
  const hydration = { fileUrlCache: { getTempUrls: async ids => Object.fromEntries(ids.map(id => [id, 'https://cdn.test/topic.jpg'])) } };
  vm.createContext(hydration);
  vm.runInContext(stripImports(read('cache/core/hydrate.js')).replace(/export /g, ''), hydration);
  const api = { cacheManager: { namespace: () => ({}) }, hydrateTempUrls: hydration.hydrateTempUrls };
  vm.createContext(api);
  vm.runInContext(stripImports(read('api-cache/weekly.js')).replace(/export \{[\s\S]*?\};/, '').replace(/export default weeklyApi;/, ''), api);
  const payload = await api.hydrateWeeklyPayload({ topics: [publicApi.buildTopicView(saved.data)] });
  assert.equal(payload.topics[0].coverImage, 'https://cdn.test/topic.jpg');

  let uploadFails = false;
  let creates = 0;
  const updates = [];
  let loading = false;
  const sandbox = {
    module: { exports: {} }, console,
    uni: { showToast() {}, showLoading() { loading = true; }, hideLoading() { loading = false; } },
    fileUrlCache: { getTempUrl: async () => 'https://cdn.test/topic.jpg' },
    uploadFile: async () => { if (uploadFails) throw new Error('上传失败'); return cover; },
    createAdminWeeklyTopic: async data => { creates++; assert.equal(data.coverImage, cover); return { topicId: 'topic-1' }; },
    updateAdminWeeklyTopic: async data => updates.push(data),
    invalidateWeeklyContent() {}
  };
  vm.runInNewContext(stripImports(read('pages-admin/weekly-management/weekly-management.vue').match(/<script>([\s\S]*?)<\/script>/)[1]).replace('export default', 'module.exports ='), sandbox);
  const component = sandbox.module.exports;
  const state = Object.assign(component.data(), component.methods, { loadTopics: async () => {}, loadTopicPeriodPosts() {} });
  state.issueCoverPreview = 'issue.jpg';
  state.onTopicCoverCropped({ path: 'local-topic.jpg' });
  assert.equal(state.issueCoverPreview, 'issue.jpg', '主题裁剪不能修改周刊封面');
  await state.saveTopic();
  assert.equal(state.topicForm.topicId, 'topic-1', '新建后可直接发布或继续编辑');
  assert.equal(state.topicCoverPendingPath, '');
  assert.equal(state.topicCoverPreview, 'https://cdn.test/topic.jpg');
  assert.equal(loading, false);
  await state.saveTopic();
  assert.equal(creates, 1, '再次保存更新已有主题');
  assert.equal(updates[0].coverImage, cover);
  state.clearTopicCoverImage();
  await state.saveTopic();
  assert.equal(updates[1].coverImage, '');

  uploadFails = true;
  state.onTopicCoverCropped({ path: 'retry.jpg' });
  await state.saveTopic();
  assert.equal(updates.length, 2, '上传失败时不能提交主题');
  assert.equal(state.topicCoverPendingPath, 'retry.jpg', '失败后保留图片供重试');
  assert.equal(state.topicSaving, false);
  assert.equal(loading, false);

  let resolvePreview;
  sandbox.fileUrlCache.getTempUrl = () => new Promise(resolve => { resolvePreview = resolve; });
  state.topicForm.coverImage = cover;
  state.topicCoverPendingPath = '';
  const pending = state.loadCoverPreview(cover, 'topic');
  state.clearTopicCoverImage();
  resolvePreview('https://cdn.test/old.jpg');
  await pending;
  assert.equal(state.topicCoverPreview, '', '延迟返回的预览不能恢复已移除的封面');
  state.openTopicForm();
  assert.equal(state.topicForm.coverImage, '');
  assert.equal(state.topicCoverPendingPath, '');
  console.log('主题封面保存、移除、上传重试与展示地址检查通过');
})().catch(error => { console.error(error); process.exitCode = 1; });
