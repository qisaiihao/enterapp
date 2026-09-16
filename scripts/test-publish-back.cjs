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
const callbackErrors = [];
const uni = {
  showModal() { throw new Error('Expected the page overlay host'); },
  showActionSheet() {}, showLoading() {}, hideLoading() {}, showToast() {},
  getStorageSync: key => storage.get(key),
  setStorageSync: (key, value) => storage.set(key, value),
  removeStorageSync: key => storage.delete(key),
  navigateBack(options = {}) {
    // App/H5 call onBackPress synchronously, including navigation from modal callbacks.
    // Like uni-app, an intercepted navigateBack still reports success.
    if (backPress('navigateBack')) intercepted += 1;
    else {
      navigations += 1;
      overlays.appOverlayPageMixin.onHide.call(instance);
      page.onHide.call(instance);
      overlays.appOverlayPageMixin.onUnload.call(instance);
      page.onUnload.call(instance);
      stack.pop();
    }
    options.success?.({ errMsg: 'navigateBack:ok' });
  }
};
const globals = {
  uni, getCurrentPages: () => stack, setTimeout, clearTimeout,
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
    saveDraftApi() {
      saveRequests += 1;
      return new Promise(resolve => { finishSave = resolve; });
    }
  };
  vm.runInNewContext(source.replace('export default', 'module.exports ='), context, { filename: file });
  return context.module.exports;
}

const page = component('pages-publish/add/add.vue');
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
function mount(state = {}) {
  navigations = intercepted = saveRequests = 0;
  callbackErrors.length = 0;
  storage.clear();
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

async function checkExit(label, trigger, action) {
  const { app, overlayHost } = mount({ content: '未完成的诗歌' });
  instance.saveWorkingDraft();
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
  for (let i = 0; i < 6; i += 1) await nextTick();
  assert.equal(navigations, 1, `${label}: returns to the previous page once`);
  assert.equal(intercepted, 0, `${label}: completed dialog cannot swallow navigateBack`);
  assert.equal(stack.at(-1).route, 'pages/index/index');
  assert.equal(overlayHost.request, null, `${label}: no repeated draft prompt`);
  if (action !== 'confirm') {
    assert.equal(saveRequests, 0);
    assert.equal(storage.has('publish_working_draft_v1'), false, 'discard stays cleared after hide/unload');
  }
  assert.deepEqual(callbackErrors, []);
  app.unmount();
}

async function main() {
  overlays.installAppOverlays();
  await checkExit('toolbar discard', () => instance.goBack(), 'cancel');
  await checkExit('toolbar save', () => instance.goBack(), 'confirm');
  await checkExit('native back then discard', () => assert.equal(backPress('backbutton'), true), 'cancel');
  await checkExit('native back twice', () => assert.equal(backPress('backbutton'), true), 'back');

  const { app, overlayHost } = mount();
  instance.goBack();
  assert.equal(navigations, 1, 'empty editor returns immediately');
  assert.equal(overlayHost.request, null, 'empty editor does not prompt');
  app.unmount();
  console.log('[test-publish-back] PASS: toolbar/native back, discard/save, empty editor and draft cleanup');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
