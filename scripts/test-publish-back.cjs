const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parse } = require('@babel/parser');
process.env.NODE_ENV = 'production';
const { createRenderer, h, nextTick } = require('vue');

const root = path.join(__dirname, '..');
const storage = new Map();
let stack = [];
let instance;
let navigations = 0;
let intercepted = 0;
let saveRequests = 0;
let finishSave;
let failSave;
let savedDraft;
let previewInstance;
const previewApps = [];
const lifecycleEvents = [];
const navigationEvents = [];
const callbackErrors = [];
const copy = value => JSON.parse(JSON.stringify(value));
const draftKeys = ['publish_working_draft_v1', 'publish_draft', 'editing_draft', 'preview_post'];
const uni = {
  showModal() { throw new Error('Expected the page overlay host'); },
  showActionSheet() {}, showLoading() {}, hideLoading() {}, showToast() {},
  getStorageSync: key => storage.get(key),
  // Real uni-app storage serializes the value rather than retaining Vue proxies.
  setStorageSync: (key, value) => storage.set(key, copy(value)),
  removeStorageSync: key => storage.delete(key),
  navigateBack(options = {}) {
    // App/H5 call onBackPress synchronously, including navigation from modal callbacks.
    // Like uni-app, an intercepted navigateBack still reports success.
    if (stack.at(-1)?.route === 'pages-publish/add/add' && backPress('navigateBack')) intercepted += 1;
    else {
      navigations += 1;
      navigationEvents.push({ type: 'navigateBack', delta: options.delta || 1 });
      exitPages(options.delta || 1);
      if (stack.at(-1)?.route === 'pages-publish/add/add') page.onShow.call(instance);
    }
    options.success?.({ errMsg: 'navigateBack:ok' });
  },
  navigateTo(options) {
    assert.equal(options.url, '/pages-publish/preview/preview');
    hideEditor();
    const app = renderer.createApp({
      data: preview.data, computed: preview.computed, methods: preview.methods,
      render: () => null
    });
    previewInstance = app.mount({});
    previewApps.push(app);
    stack.push({ route: 'pages-publish/preview/preview', $vm: previewInstance });
    preview.onLoad.call(previewInstance);
    options.success?.({ eventChannel: { emit() {} } });
  },
  switchTab(options) {
    navigations += 1;
    navigationEvents.push({ type: 'switchTab', url: options.url });
    exitPages(stack.length - 1);
  },
  redirectTo(options) {
    navigations += 1;
    navigationEvents.push({ type: 'redirectTo', url: options.url });
    exitPages(1);
    stack.push({ route: options.url });
  }
};
const globals = {
  uni, getCurrentPages: () => stack, getApp: () => ({ globalData: { openid: 'test-user' } }),
  setTimeout, clearTimeout,
  console: { log() {}, warn() {}, error: (...args) => callbackErrors.push(args) }
};

function namedModule(file) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const names = parse(source, { sourceType: 'module' }).program.body
    .filter(node => node.type === 'ExportNamedDeclaration')
    .flatMap(node => node.declaration.id ? [node.declaration.id.name]
      : node.declaration.declarations.map(item => item.id.name));
  const context = { ...globals, module: { exports: {} } };
  vm.runInNewContext(source.replace(/^export /gm, '') +
    `\nmodule.exports = { ${names.join(',')} };`, context, { filename: file });
  return context.module.exports;
}

const overlays = namedModule('utils/appOverlay.js');
const pure = namedModule('pages-publish/add/addPure.js');
function component(file) {
  let source = fs.readFileSync(path.join(root, file), 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
  const imports = parse(source, { sourceType: 'module' }).program.body
    .filter(node => node.type === 'ImportDeclaration');
  const bindings = {};
  for (const node of imports) {
    for (const specifier of node.specifiers) {
      bindings[specifier.local.name] = () => {};
    }
  }
  for (const node of imports.reverse()) source = source.slice(0, node.start) + source.slice(node.end);
  const context = {
    ...globals, ...bindings, ...pure, ...overlays,
    colorPalettes: [], poemLines: [], tagCategories: [], module: { exports: {} },
    attachPoemDisplayFields: post => post,
    getRecentActivities: () => Promise.resolve({ activities: [] }),
    saveDraftApi(data) {
      saveRequests += 1;
      savedDraft = copy(data);
      return new Promise((resolve, reject) => { finishSave = resolve; failSave = reject; });
    }
  };
  vm.runInNewContext(source.replace('export default', 'module.exports ='), context, { filename: file });
  return context.module.exports;
}

const page = component('pages-publish/add/add.vue');
const preview = component('pages-publish/preview/preview.vue');
const dialog = { ...component('components/overlay/AppDialog.vue'), render: () => null };
const host = {
  ...component('components/app-overlay-host/app-overlay-host.vue'),
  render() {
    if (!this.request) return null;
    return h(dialog, {
      key: this.requestId, visible: true,
      showCancel: this.request.options.showCancel !== false,
      onCancel: this.cancel, onConfirm: this.confirm
    });
  }
};
const renderer = createRenderer({
  createElement: () => ({}), createText: () => ({}), createComment: () => ({}),
  insert() {}, remove() {}, setText() {}, setElementText() {}, patchProp() {},
  parentNode() {}, nextSibling() {}
});
function backPress(from) {
  const event = { from };
  overlays.appOverlayPageMixin.onBackPress.call(instance, event);
  return page.onBackPress.call(instance, event);
}
function hideEditor() {
  lifecycleEvents.push({ phase: 'hide', isPublished: instance.isPublished });
  overlays.appOverlayPageMixin.onHide.call(instance);
  page.onHide.call(instance);
}
function exitPages(count) {
  while (count-- > 0 && stack.length > 1) {
    const entry = stack.at(-1);
    if (entry.route === 'pages-publish/add/add') {
      hideEditor();
      lifecycleEvents.push({ phase: 'unload', isPublished: instance.isPublished });
      overlays.appOverlayPageMixin.onUnload.call(instance);
      page.onUnload.call(instance);
    }
    stack.pop();
  }
}
function mount(state = {}, { preserveStorage = false } = {}) {
  if (!preserveStorage) {
    navigations = intercepted = saveRequests = 0;
    callbackErrors.length = 0;
    lifecycleEvents.length = 0;
    navigationEvents.length = 0;
    savedDraft = null;
    storage.clear();
  }
  const app = renderer.createApp({
    data: page.data, computed: page.computed,
    methods: {
      ...page.methods,
      setData(data) { Object.assign(this.$data, data); },
      checkCanPublish() {}
    },
    render() { return h(host, { ref: 'overlayHost' }); }
  });
  instance = app.mount({});
  Object.assign(instance.$data, state);
  stack = [{ route: 'pages/index/index' }, { route: 'pages-publish/add/add', $vm: instance }];
  overlays.appOverlayPageMixin.onLoad.call(instance);
  // The minimal renderer has no uni-app page metadata at mount time.
  const overlayHost = instance.$refs.overlayHost;
  overlayHost.releaseHost();
  overlayHost.overlayOwner = instance;
  overlayHost.releaseHost = overlays.registerOverlayHost(instance, request => {
    overlayHost.activeRequest = request;
    overlayHost.request = request ? { kind: request.kind, options: request.options } : null;
    overlayHost.requestId += 1;
  });
  return { app, overlayHost };
}

async function settle() {
  for (let i = 0; i < 8; i += 1) await nextTick();
}
function editableState(editor) {
  return copy(Object.fromEntries([
    'content', 'title', 'author', 'customTag', 'imageList', 'selectedTags', 'blocks',
    'seriesBlocks', 'highlightLines', 'highlightSentence', 'highlightSelectedLineIndices'
  ].map(key => [key, editor[key]])));
}
function assertEditorEmpty(label) {
  assert.equal(instance.hasContent(), false, `${label}: no unfinished content`);
  for (const field of ['content', 'title', 'author', 'customTag', 'highlightSentence']) {
    assert.equal(instance[field], '', `${label}: ${field} input cleared`);
  }
  for (const field of ['imageList', 'selectedTags', 'highlightLines', 'highlightSelectedLineIndices']) {
    assert.equal(instance[field].length, 0, `${label}: ${field} cleared`);
  }
  assert.equal(instance.blocks.some(block => !!block.text?.trim()), false, `${label}: discussion inputs cleared`);
  assert.equal(instance.seriesBlocks.some(block => !!(block.content?.trim() || block.subtitle?.trim())), false,
    `${label}: series inputs cleared`);
  assert.equal(instance.workingDraftSaveTimer, null, `${label}: pending autosave canceled`);
}
function assertDraftsCleared(label) {
  for (const key of draftKeys) assert.equal(storage.has(key), false, `${label}: ${key} stays cleared`);
}
function closeApps(app) {
  for (const previewApp of previewApps.splice(0)) previewApp.unmount();
  app.unmount();
}
function assertReopensEmpty(app, label, loadOptions = {}) {
  closeApps(app);
  const reopened = mount({}, { preserveStorage: true });
  assert.equal(instance.loadDraft(loadOptions), false, `${label}: reopening cannot restore previous input`);
  assert.equal(instance.loadEditingDraft(), false, `${label}: no stale editing draft`);
  assertEditorEmpty(`${label}: reopened editor`);
  reopened.app.unmount();
}
function richState(overrides = {}) {
  return {
    content: '上次输入的正文', title: '上次标题', author: '上次作者', customTag: '待添加标签',
    imageList: [{ previewUrl: '/tmp/previous-image.png', tempFilePath: '/tmp/previous-image.png' }],
    selectedTags: ['旧标签'], blocks: [{ type: 'content', text: '讨论正文' }, { type: 'quote', text: '引用诗句' }],
    seriesBlocks: [{ id: 'old-series', subtitle: '第一首', content: '第一首诗', highlightSentence: '第一首诗', highlightLines: ['第一首诗'] }],
    highlightLines: ['上次高光'], highlightSentence: '上次高光', highlightSelectedLineIndices: [0],
    ...overrides
  };
}

async function checkExit(label, trigger, action, state = { content: '未完成的诗歌' }) {
  const { app, overlayHost } = mount(state);
  instance.saveWorkingDraft();
  instance.scheduleWorkingDraftSave();
  trigger();
  await nextTick();
  assert.equal(overlayHost.request.options.title, '保存草稿', `${label}: draft prompt`);
  if (action === 'back') {
    assert.equal(backPress('backbutton'), true, 'physical back handles the draft dialog once');
  } else {
    // Emit from the real dialog before Vue has unmounted its back-key listener.
    overlayHost.$.subTree.component.proxy.answer(action);
  }
  if (action === 'confirm') {
    assert.equal(saveRequests, 1);
    assert.equal(navigations, 0, 'wait for the draft to finish saving');
    finishSave({});
  }
  await settle();
  assert.equal(navigations, 1, `${label}: returns to the previous page once`);
  assert.equal(intercepted, 0, `${label}: completed dialog cannot swallow navigateBack`);
  assert.equal(stack.at(-1).route, 'pages/index/index');
  assert.equal(overlayHost.request, null, `${label}: no repeated draft prompt`);
  if (action !== 'confirm') {
    assert.equal(saveRequests, 0);
  }
  assertEditorEmpty(label);
  assertDraftsCleared(label);
  assert.deepEqual(callbackErrors, []);
  assertReopensEmpty(app, label);
}

async function checkPublished(label, state, { fromPreview = true, redirectToPostDetail = false } = {}) {
  const { app } = mount(state);
  assert.equal(instance.saveWorkingDraft(), true, `${label}: initial draft exists`);
  storage.set('publish_draft', copy(instance.buildWorkingDraftData()));
  storage.set('editing_draft', copy(instance.buildWorkingDraftData()));
  instance.scheduleWorkingDraftSave();
  if (fromPreview) {
    instance.goToPreview();
    assert.equal(stack.at(-1).route, 'pages-publish/preview/preview');
    assert.equal(previewInstance.getAddPageVm(), instance, `${label}: real editor found from page stack`);
    // The preview navigation hides add once while editing. Only inspect the
    // lifecycle calls made after the successful publication below.
    lifecycleEvents.length = 0;
    instance.scheduleWorkingDraftSave();
    previewInstance.publishSuccess({ _id: 'published-post', redirectToPostDetail });
    if (redirectToPostDetail) {
      assert.equal(navigationEvents[0].type, 'redirectTo');
      // redirectTo removes preview first; leaving the detail later unloads add.
      uni.switchTab({ url: '/pages/index/index' });
    }
  } else {
    storage.set('preview_post', { content: state.content });
    instance.publishSuccess({ _id: 'published-post' });
  }
  await settle();
  assert.equal(instance.isPublished, true, `${label}: editor knows publication succeeded`);
  assert.deepEqual(lifecycleEvents.map(event => event.phase), ['hide', 'unload'], `${label}: navigation runs both lifecycles`);
  assert.equal(lifecycleEvents.every(event => event.isPublished), true, `${label}: publish flag precedes page lifecycle`);
  assertEditorEmpty(label);
  assertDraftsCleared(label);
  assert.equal(intercepted, 0, `${label}: publication does not reopen the save dialog`);
  if (state.isActivityMode && state.fromAdminActivity) {
    assert.deepEqual(navigationEvents[0], { type: 'navigateBack', delta: 2 }, `${label}: returns to activity administration`);
  } else if (fromPreview && !redirectToPostDetail) {
    assert.deepEqual(navigationEvents[0], { type: 'switchTab', url: '/pages/index/index' });
  }
  assert.deepEqual(callbackErrors, []);
  assertReopensEmpty(app, label, { isActivityMode: !!state.isActivityMode, activityId: state.activityId || '' });
}

async function checkPreviewReturn(label, state, { manualSave = false } = {}) {
  const { app } = mount(state);
  const expected = editableState(instance);
  instance.goToPreview();
  assert.equal(instance.isPublished, false, `${label}: entering preview does not publish`);
  assert.equal(storage.has('publish_working_draft_v1'), true, `${label}: preview keeps recovery draft`);
  if (manualSave) {
    previewInstance.saveDraft();
    assert.equal(saveRequests, 1, `${label}: preview delegates cloud save to editor`);
    assert.equal(savedDraft.content, expected.content, `${label}: actual input sent to cloud`);
    finishSave({});
    await settle();
    assert.equal(storage.has('publish_working_draft_v1'), false, `${label}: cloud save clears local snapshot`);
    assert.deepEqual(editableState(instance), expected, `${label}: manual save retains inputs for continued editing`);
  }
  previewInstance.goBack();
  await settle();
  assert.equal(stack.at(-1).$vm, instance, `${label}: back returns to original editor`);
  assert.deepEqual(editableState(instance), expected, `${label}: preview return preserves form`);
  assert.equal(instance.isPublished, false);
  assert.equal(instance.saveWorkingDraft(), true, `${label}: continued editing can still autosave`);
  hideEditor();
  page.onUnload.call(instance);
  closeApps(app);
  const reopened = mount({}, { preserveStorage: true });
  assert.equal(instance.loadDraft(), true, `${label}: unfinished content remains recoverable`);
  assert.deepEqual(editableState(instance), expected, `${label}: recovery restores inputs`);
  assert.deepEqual(callbackErrors, []);
  reopened.app.unmount();
}

async function checkFailedSaveExit() {
  const label = 'failed exit save';
  const { app, overlayHost } = mount(richState());
  const expected = editableState(instance);
  instance.goBack();
  await nextTick();
  overlayHost.$.subTree.component.proxy.answer('confirm');
  assert.equal(saveRequests, 1);
  assert.equal(navigations, 0, `${label}: waits for cloud response`);
  failSave(new Error('offline'));
  await settle();
  assert.equal(navigations, 1);
  assert.deepEqual(editableState(instance), expected, `${label}: failed cloud save retains inputs`);
  assert.equal(storage.has('publish_working_draft_v1'), true, `${label}: hide/unload retain recovery draft`);
  assert.equal(callbackErrors.length, 1, `${label}: reports expected network failure`);
  assert.match(String(callbackErrors[0][0]), /保存草稿失败/);
  closeApps(app);
  const reopened = mount({}, { preserveStorage: true });
  assert.equal(instance.loadDraft(), true, `${label}: reopening restores failed save`);
  assert.deepEqual(editableState(instance), expected);
  reopened.app.unmount();
}

async function main() {
  overlays.installAppOverlays();
  await checkExit('toolbar discard', () => instance.goBack(), 'cancel');
  await checkExit('toolbar save', () => instance.goBack(), 'confirm');
  await checkExit('native back then discard', () => assert.equal(backPress('backbutton'), true), 'cancel');
  await checkExit('native back twice', () => assert.equal(backPress('backbutton'), true), 'back');
  await checkExit('discard rich normal form', () => instance.goBack(), 'cancel', richState());
  await checkExit('discard discussion form', () => instance.goBack(), 'cancel', richState({ publishMode: 'discussion', isDiscussion: true }));
  await checkExit('discard series form', () => instance.goBack(), 'cancel', richState({ publishMode: 'poem', isSeries: true }));
  await checkExit('save rich form and exit', () => instance.goBack(), 'confirm', richState());
  await checkFailedSaveExit();

  for (const [label, state] of [
    ['normal', richState()],
    ['poem', richState({ publishMode: 'poem' })],
    ['discussion', richState({ publishMode: 'discussion', isDiscussion: true })],
    ['series', richState({ publishMode: 'poem', isSeries: true })],
    ['edit', richState({ isEditMode: true, editingPostId: 'existing-post' })],
    ['activity', richState({ isActivityMode: true, activityId: 'activity-1', fromAdminActivity: true })]
  ]) {
    await checkPublished(`preview publish ${label}`, state);
  }
  await checkPublished('preview publish then detail redirect', richState(), { redirectToPostDetail: true });
  await checkPublished('direct publish', richState(), { fromPreview: false });
  await checkPublished('direct edit publish', richState({ isEditMode: true, editingPostId: 'existing-post' }), { fromPreview: false });
  await checkPreviewReturn('preview return', richState());
  await checkPreviewReturn('discussion preview return', richState({ publishMode: 'discussion', isDiscussion: true }));
  await checkPreviewReturn('series preview return', richState({ publishMode: 'poem', isSeries: true }));
  await checkPreviewReturn('manual preview draft save', richState(), { manualSave: true });

  const { app, overlayHost } = mount();
  instance.goBack();
  assert.equal(navigations, 1, 'empty editor returns immediately');
  assert.equal(overlayHost.request, null, 'empty editor does not prompt');
  app.unmount();
  console.log('[test-publish-back] PASS: toolbar/native back, discard, cloud save success/failure, direct/preview publication, all compose modes and draft recovery');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
