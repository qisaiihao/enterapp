const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parse } = require('@babel/parser');
const { parse: parseJson } = require('jsonc-parser');
const { createRenderer, nextTick } = require('vue');
const root = path.join(__dirname, '..');
let stack = [];
let nativeCalls = 0;
const uni = {
  showModal() { nativeCalls += 1; },
  showActionSheet() { nativeCalls += 1; }
};
const source = fs.readFileSync(path.join(root, 'utils/appOverlay.js'), 'utf8');
const exported = parse(source, { sourceType: 'module' }).program.body
  .filter(node => node.type === 'ExportNamedDeclaration')
  .flatMap(node => node.declaration.id ? [node.declaration.id.name] : node.declaration.declarations.map(item => item.id.name));
const sandbox = { uni, getCurrentPages: () => stack, console, module: { exports: {} } };
vm.runInNewContext(source.replace(/^export /gm, '') + `\nmodule.exports = {${exported.join(',')}};`, sandbox);
const api = sandbox.module.exports;
const renderer = createRenderer({
  createElement: () => ({}), createText: () => ({}), createComment: () => ({}),
  insert() {}, remove() {}, setText() {}, setElementText() {}, patchProp() {},
  parentNode() {}, nextSibling() {}
});

function component(file) {
  let text = fs.readFileSync(path.join(root, file), 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
  text = text.replace(/^import .*;\r?$/gm, '').replace('export default', 'module.exports =');
  const context = { ...api, setTimeout, clearTimeout, module: { exports: {} } };
  vm.runInNewContext(text, context);
  return context.module.exports;
}

function walk(node, visit) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) return node.forEach(item => walk(item, visit));
  if (node.type) visit(node);
  for (const [key, value] of Object.entries(node)) {
    if (!['loc', 'start', 'end'].includes(key)) walk(value, visit);
  }
}

function pageDialogs(file, titles) {
  const source = fs.readFileSync(path.join(root, file), 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
  const ast = parse(source, { sourceType: 'module' });
  const context = { uni, console, pageContext: {} };
  const dialogs = [];
  walk(ast, node => {
    if (node.type === 'ObjectMethod' && node.key?.name === 'goToLogin') {
      context.pageContext.goToLogin = vm.runInNewContext(`({${source.slice(node.start, node.end)}}).goToLogin`, context);
    }
  });
  walk(ast, node => {
    if (node.type !== 'CallExpression' || node.callee?.object?.name !== 'uni' || node.callee.property?.name !== 'showModal') return;
    const options = node.arguments[0];
    const title = options?.properties?.find(item => item.key?.name === 'title')?.value?.value;
    if (!titles.includes(title)) return;
    dialogs.push(vm.runInNewContext(`(function () { return (${source.slice(options.start, options.end)}); }).call(pageContext)`, context));
  });
  assert.equal(dialogs.length, titles.length, `${file}: expected page dialogs found`);
  return dialogs;
}

async function main() {
  api.installAppOverlays();
  api.installAppOverlays();
  uni.showModal({ title: 'startup' });
  assert.equal(nativeCalls, 1);
  const owner = {};
  stack = [{ route: 'pages/login/login', $vm: owner }];
  let displayed;
  const events = [];
  uni.showModal({ title: 'first', success: result => events.push(result), complete: () => events.push('complete') });
  const releaseHost = api.registerOverlayHost(owner, request => { displayed = request; });
  assert.equal(displayed.options.title, 'first', 'onLoad requests wait for the page host');
  const first = displayed;
  const secondResult = uni.showModal({ title: 'second' });
  assert.equal(displayed, first, 'requests queue without replacing an unanswered dialog');
  api.answerOverlay(owner, first, 'confirm');
  assert.equal(events[0].confirm, true);
  assert.equal(events[1], 'complete');
  assert.equal(displayed.options.title, 'second');
  api.answerOverlay(owner, first, 'confirm');
  assert.equal(events.length, 2, 'double completion cannot invoke callbacks again');
  api.answerOverlay(owner, displayed, 'cancel');
  assert.equal((await secondResult).cancel, true);

  const sheetResult = uni.showActionSheet({ itemList: ['编辑', '删除'] });
  api.answerOverlay(owner, displayed, 1);
  assert.equal((await sheetResult).tapIndex, 1);
  const cancelled = uni.showActionSheet({ itemList: ['编辑'] });
  const rejection = assert.rejects(cancelled, error => error.errMsg === 'showActionSheet:fail cancel');
  api.answerOverlay(owner, displayed, 'cancel');
  await rejection;
  let failCount = 0;
  uni.showActionSheet({ itemList: ['编辑'], fail: () => { failCount += 1; }, complete: () => { failCount += 1; } });
  api.answerOverlay(owner, displayed, 'cancel');
  assert.equal(failCount, 2);

  const removedPageResult = uni.showModal({ title: 'leave page' });
  const removal = assert.rejects(removedPageResult, error => error.errMsg === 'showModal:fail page closed');
  api.closePageOverlays(owner);
  await removal;
  assert.equal(displayed, null);

  let dismissals = 0;
  const releaseFirst = api.registerOverlayDismiss(owner, () => { dismissals += 1; });
  const releaseSecond = api.registerOverlayDismiss(owner, () => { dismissals += 10; });
  const navigationEvent = { from: 'navigateBack' };
  assert.equal(api.appOverlayPageMixin.onBackPress(navigationEvent), undefined);
  assert.equal(navigationEvent.appOverlayHandled, undefined);
  assert.equal(dismissals, 0, 'programmatic navigation does not dismiss or get intercepted by overlays');
  const backEvent = {};
  assert.equal(api.appOverlayPageMixin.onBackPress(backEvent), true);
  assert.equal(backEvent.appOverlayHandled, true);
  assert.equal(dismissals, 10, 'back dismisses only the top layer');
  releaseSecond();
  api.dismissCurrentOverlay();
  assert.equal(dismissals, 11);
  stack.push({ route: 'pages/register/register', $vm: {} });
  assert.equal(api.dismissCurrentOverlay(), false, 'hidden page overlays cannot consume current page back');
  stack.pop();
  releaseFirst();

  const incomingPage = { $mpType: 'page', route: 'pages/register/register' };
  assert.equal(api.resolveOverlayOwner({ $parent: incomingPage }), incomingPage);
  api.appOverlayPageMixin.onLoad.call(incomingPage);
  uni.showModal({ title: 'before stack update', success() {} });
  let incomingRequest;
  const releaseIncoming = api.registerOverlayHost(incomingPage, value => { incomingRequest = value; });
  assert.equal(incomingRequest.options.title, 'before stack update');
  api.answerOverlay(incomingPage, incomingRequest, 'confirm');
  api.appOverlayPageMixin.onUnload.call(incomingPage);
  releaseIncoming();

  const dialog = component('components/overlay/AppDialog.vue');
  const dialogEvents = [];
  const app = renderer.createApp({
    ...dialog, render: () => null,
    props: undefined,
    data() { return { ...dialog.data(), visible: true, showCancel: false, busy: false }; },
    methods: { ...dialog.methods },
    emits: dialog.emits
  }, {
    onConfirm: value => dialogEvents.push(['confirm', value]),
    onCancel: value => dialogEvents.push(['cancel', value])
  });
  const instance = app.mount({});
  assert.equal(api.dismissCurrentOverlay(), true);
  assert.equal(dialogEvents.length, 0, 'mandatory information cannot be dismissed by back');
  instance.answer('confirm');
  instance.answer('confirm');
  assert.equal(dialogEvents.length, 1);
  instance.busy = true;
  await nextTick();
  instance.answer('confirm');
  assert.equal(dialogEvents.length, 1);
  instance.busy = false;
  await nextTick();
  instance.answer('confirm');
  assert.equal(dialogEvents.length, 2, 'a failed async action can be retried after busy ends');
  app.unmount();
  await nextTick();
  assert.equal(api.dismissCurrentOverlay(), false);

  let navigationResults = [];
  uni.navigateBack = () => navigationResults.push(api.appOverlayPageMixin.onBackPress({ from: 'navigateBack' }));
  uni.removeStorageSync = () => {};
  uni.showToast = () => {};
  const sheet = component('components/overlay/AppActionSheet.vue');
  async function checkCallbackNavigation(label, options, action, expectedNavigations, kind = 'dialog') {
    navigationResults = [];
    if (kind === 'dialog') uni.showModal(options);
    else uni.showActionSheet(options);
    const request = displayed;
    const callbackApp = renderer.createApp({ ...(kind === 'dialog' ? dialog : sheet), render: () => null }, {
      visible: true, showCancel: options.showCancel !== false, items: options.itemList || [],
      onConfirm: () => api.answerOverlay(owner, request, 'confirm'),
      onCancel: () => api.answerOverlay(owner, request, 'cancel'),
      onSelect: index => api.answerOverlay(owner, request, index)
    });
    const callbackInstance = callbackApp.mount({});
    if (options.showCancel === false) {
      assert.equal(api.appOverlayPageMixin.onBackPress({ from: 'backbutton' }), true, `${label}: physical back is consumed`);
      assert.equal(displayed, request, `${label}: physical back cannot confirm a mandatory notice`);
      assert.equal(navigationResults.length, 0);
    }
    // Dialogs answer immediately; sheets release their dismissal listener after sliding out.
    callbackInstance.answer(action, 0);
    if (kind === 'sheet') {
      assert.equal(displayed, request, `${label}: keep request active during the close animation`);
      assert.equal(navigationResults.length, 0, `${label}: navigation waits for the close animation`);
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    assert.equal(displayed, null, `${label}: answer completes the request`);
    assert.equal(navigationResults.length, expectedNavigations, `${label}: expected navigation count`);
    assert.ok(navigationResults.every(result => !result), `${label}: callback navigation is allowed before unmount`);
    callbackApp.unmount();
    assert.equal(api.dismissCurrentOverlay(), false, `${label}: listener is cleaned up`);
  }

  const affectedPages = [
    ['pages-publish/preview/preview.vue', ['确认删除']],
    ['pages/register/register.vue', ['提示']],
    ['pages-tools/image-manager/image-manager.vue', ['权限不足', '错误']],
    ['pages-debug/test-menu/test-menu.vue', ['无权限']]
  ];
  assert.equal(fs.existsSync(path.join(root, 'pages-tools/feedback-admin/feedback-admin.vue')), false, 'retired feedback management page is removed');
  for (const [file, titles] of affectedPages) {
    for (const options of pageDialogs(file, titles)) {
      await checkCallbackNavigation(`${file}: ${options.title}`, options, 'confirm', 1);
      if (options.showCancel !== false) {
        await checkCallbackNavigation(`${file}: cancel ${options.title}`, options, 'cancel', 0);
      }
    }
  }
  await checkCallbackNavigation('modal cancel callback', { success: result => { if (result.cancel) uni.navigateBack(); } }, 'cancel', 1);
  await checkCallbackNavigation('modal complete callback', { complete: () => uni.navigateBack() }, 'confirm', 1);
  await checkCallbackNavigation('sheet selection', { itemList: ['返回'], success: () => uni.navigateBack() }, 'select', 1, 'sheet');
  await checkCallbackNavigation('sheet cancel callback', { itemList: ['返回'], fail: () => uni.navigateBack() }, 'cancel', 1, 'sheet');
  await checkCallbackNavigation('sheet complete callback', { itemList: ['返回'], complete: () => uni.navigateBack() }, 'select', 1, 'sheet');

  releaseHost();
  api.closePageOverlays(owner, true);
  stack = [{ route: 'uni_modules/uni-upgrade-center-app/pages/upgrade-popup', $vm: {} }];
  uni.showModal({ title: 'external upgrade page' });
  assert.equal(nativeCalls, 2);

  const config = parseJson(fs.readFileSync(path.join(root, 'pages.json'), 'utf8'));
  const routes = [...config.pages.map(page => page.path), ...config.subPackages.flatMap(group => group.pages.map(page => `${group.root}/${page.path}`))];
  for (const route of routes.filter(route => !route.startsWith('uni_modules/'))) {
    const page = fs.readFileSync(path.join(root, `${route}.vue`), 'utf8');
    assert.equal((page.match(/<app-overlay-host\s*\/>/g) || []).length, 1, `${route}: one page host`);
  }
  console.log('[test-app-overlays] PASS: callbacks, promises, queue, page isolation, back, duplicate actions, hosts, seven page dialogs and sheet navigation');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
