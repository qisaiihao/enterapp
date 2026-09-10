const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parse } = require('@babel/parser');

function loadPage(file, globals) {
  let source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
    .match(/<script>([\s\S]*?)<\/script>/)[1];
  const imports = parse(source, { sourceType: 'module' }).program.body
    .filter(node => node.type === 'ImportDeclaration');
  const bindings = {};
  for (const node of imports) {
    for (const specifier of node.specifiers) bindings[specifier.local.name] = () => {};
  }
  for (const node of imports.reverse()) source = source.slice(0, node.start) + source.slice(node.end);
  const sandbox = {
    ...bindings, ...globals, module: { exports: {} },
    console: { log() {}, warn() {}, error(...args) { throw new Error(args.join(' ')); } }
  };
  vm.runInNewContext(source.replace('export default', 'module.exports ='), sandbox, { filename: file });
  return sandbox.module.exports;
}

let lastUrl;
let previewPost;
let addPage;
const storage = new Map();
const uni = {
  showToast() {},
  getStorageSync: key => storage.get(key),
  setStorageSync: (key, value) => storage.set(key, value),
  navigateTo({ url, success }) {
    lastUrl = url;
    success?.({ eventChannel: { emit(name, data) { previewPost = data.post; } } });
  }
};
const globals = {
  uni, colorPalettes: [], poemLines: [], tagCategories: [],
  decodeParamSafe(value) {
    if (typeof value !== 'string') return '';
    try { return decodeURIComponent(value); } catch (_) { return value; }
  },
  checkLoginOrPrompt: async () => true,
  isActivityOngoing: (start, end) => new Date(start).getTime() <= Date.now() && new Date(end).getTime() >= Date.now(),
  normalizeSeriesBlocks: () => ({ highlightLines: [] }),
  getCurrentPages: () => [{ $vm: addPage }, {}]
};
const detail = loadPage('pages-content/activity-detail/activity-detail.vue', globals);
const add = loadPage('pages-publish/add/add.vue', globals);
const preview = loadPage('pages-publish/preview/preview.vue', globals);
function createPage(options, overrides = {}) {
  const page = options.data();
  for (const [name, method] of Object.entries(options.methods)) page[name] = method.bind(page);
  Object.assign(page, {
    setData(data) { Object.assign(this, data); },
    loadAllExistingTags() {}, updatePlaceholder() {}, checkCanPublish() {},
    preventPageScroll() {}, scheduleWorkingDraftSave() {}, flushWorkingDraft() {}
  }, overrides);
  return page;
}

async function main() {
  const activity = createPage(detail, {
    activityId: 'activity-123', activityTitle: '秋日 & 诗 / 100%',
    activityDetailLoaded: true, allowUserSubmission: true,
    activityStartTime: new Date(Date.now() - 60000).toISOString(),
    activityEndTime: new Date(Date.now() + 60000).toISOString()
  });
  activity.handleSubmitPoem();
  assert.ok(lastUrl.startsWith('/pages-publish/add/add?'));
  const params = Object.fromEntries(lastUrl.split('?')[1].split('&').map(pair => pair.split('=')));
  assert.equal(params.activityId, undefined, 'User submissions must not activate official activity mode');

  for (const withDraft of [false, true]) {
    addPage = createPage(add, {
      loadDraft() {
        if (!withDraft) return false;
        Object.assign(this, {
          content: '已有诗稿', publishMode: 'normal', joinedActivityId: 'previous-activity',
          joinedActivityTitle: '旧活动', isOriginal: false
        });
        return true;
      }
    });
    await add.onLoad.call(addPage, params);
    assert.equal(addPage.publishMode, 'poem');
    assert.equal(addPage.isOriginal, true);
    assert.equal(addPage.maxImageCount, 1);
    assert.equal(addPage.joinActivityEnabled, true);
    assert.equal(addPage.joinedActivityId, activity.activityId);
    assert.equal(addPage.joinedActivityTitle, activity.activityTitle);
    assert.equal(addPage.isActivityMode, false);
    assert.equal(addPage.fromAdminActivity, false);
    if (withDraft) assert.equal(addPage.content, '已有诗稿');

    addPage.content = addPage.content || '新诗正文';
    addPage.goToPreview();
    assert.equal(previewPost.editData.joinedActivityId, activity.activityId);
    assert.equal(storage.get('preview_post').editData.joinActivityEnabled, true);
    const previewPage = createPage(preview, {
      post: previewPost, isLockedAdminActivityMode: false,
      ensureJoinableActivitiesLoaded() {},
      executePublish(data) { this.publishData = data; }
    });
    previewPage.initJoinActivityState();
    assert.equal(previewPage.joinedActivityId, activity.activityId);
    previewPage.publishFromAddPage();
    assert.equal(previewPage.publishData.publishMode, 'poem');
    assert.equal(previewPage.publishData.joinActivityId, activity.activityId);
    assert.equal(previewPage.publishData.joinActivityTitleSnapshot, activity.activityTitle);
    assert.equal(previewPage.publishData.activityId, '');
    assert.equal(previewPage.publishData.fromAdminActivity, false);
  }

  // 普通入口、管理员活动发帖和编辑入口继续使用原有默认设置。
  const regular = createPage(add, { loadDraft: () => false });
  await add.onLoad.call(regular, {});
  assert.equal(regular.publishMode, 'normal');
  assert.equal(regular.joinActivityEnabled, false);
  const admin = createPage(add, { loadDraft: () => false });
  await add.onLoad.call(admin, { ...params, activityId: 'official', fromAdminActivity: '1' });
  assert.equal(admin.isActivityMode, true);
  assert.equal(admin.publishMode, 'normal');
  assert.equal(admin.joinActivityEnabled, false);
  const editing = createPage(add, { loadEditingDraft: () => true });
  await add.onLoad.call(editing, { ...params, mode: 'edit' });
  assert.equal(editing.joinActivityEnabled, false);

  for (const blockedState of [
    { activityDetailLoaded: false }, { allowUserSubmission: false },
    { activityEndTime: new Date(Date.now() - 1).toISOString() }
  ]) {
    lastUrl = '';
    detail.methods.handleSubmitPoem.call({ ...activity, ...blockedState });
    assert.equal(lastUrl, '');
  }
  console.log('[test-activity-submission] PASS: entry, poem defaults, drafts, preview, publish data and entry isolation');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
