const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parse } = require('@babel/parser');

const root = path.resolve(__dirname, '..');
const storage = new Map();
let actor = 'alice';
let failSubmission = false;
const submitted = [];
const navigation = [];
const uni = {
  getStorageSync: key => storage.get(key),
  setStorageSync: (key, value) => storage.set(key, value),
  removeStorageSync: key => storage.delete(key),
  hideLoading() {}, showToast() {},
  showModal({ success }) { success?.({ confirm: true }); },
  navigateBack(options) { navigation.push(options.delta); }
};
function load(file, globals, names) {
  let source = fs.readFileSync(path.join(root, file), 'utf8');
  if (file.endsWith('.vue')) source = source.match(/<script>([\s\S]*?)<\/script>/)[1];
  const bindings = {};
  for (const node of parse(source, { sourceType: 'module' }).program.body.reverse()) {
    if (node.type === 'ImportDeclaration') {
      for (const specifier of node.specifiers) bindings[specifier.local.name] = () => {};
      source = source.slice(0, node.start) + source.slice(node.end);
    }
    else if (node.type === 'ExportNamedDeclaration') source = source.slice(0, node.start) + source.slice(node.declaration.start);
  }
  const module = { exports: {} };
  source = names ? source + `\nmodule.exports = { ${names.join(',')} };` : source.replace('export default', 'module.exports =');
  vm.runInNewContext(source, { ...bindings, ...globals, module, console: { log() {}, warn() {}, error() {} }, Date, setTimeout, clearTimeout }, { filename: file });
  return module.exports;
}
const submission = load('utils/societySubmission.js', {
  uni, getCurrentUserId: () => actor,
  async societyRequest(action, payload) {
    assert.equal(action, 'submitWork');
    submitted.push(payload);
    if (failSubmission) throw new Error('网络不可用');
    return { success: true };
  }
}, ['submitPublishedPoemToSociety', 'retryPendingSocietySubmission']);
const globals = {
  uni, getApp: () => ({ globalData: { openid: actor } }), getCurrentPages: () => [],
  decodeParamSafe: value => decodeURIComponent(value || ''),
  checkLoginOrPrompt: async () => true,
  getAllTags: async () => [],
  emitPostCreated() {}, emitPostUpdated() {},
  clearPublishDraftStorage() {},
  submitPublishedPoemToSociety: submission.submitPublishedPoemToSociety,
  colorPalettes: [], poemLines: [], tagCategories: [],
  computePlaceholder: () => '',
  hasDraftContent: () => false
};
const add = load('pages-publish/add/add.vue', globals);
const preview = load('pages-publish/preview/preview.vue', globals);
function page(component, extra = {}) {
  const instance = { ...component.data(), ...extra };
  for (const [name, method] of Object.entries(component.methods)) instance[name] = method.bind(instance);
  instance.setData = data => Object.assign(instance, data);
  return instance;
}
const settle = () => new Promise(resolve => setImmediate(resolve));

async function main() {
  const editor = page(add, {
    loadDraft: () => false,
    loadAllExistingTags() {}, preventPageScroll() {},
    checkCanPublish() {}, scheduleWorkingDraftSave() {},
    clearDraft() {},
    goToPreview: add.methods.goToPreview
  });
  await add.onLoad.call(editor, { societyCallId: 'call%2Fone' });
  assert.equal(editor.societyCallId, 'call/one');
  assert.equal(editor.publishMode, 'poem');
  assert.equal(editor.isOriginal, true);
  editor.onModeSelect({ mode: 'normal', isOriginal: false });
  assert.equal(editor.publishMode, 'poem', 'contribution composer stays in original poem mode');

  const direct = page(add, { societyCallId: 'call-one', clearDraft() {} });
  add.methods.publishSuccess.call(direct, { _id: 'post-direct' });
  await settle();
  assert.equal(submitted.at(-1).postId, 'post-direct');
  assert.equal(submitted.at(-1).id, 'call-one');
  assert.equal(navigation.at(-1), 1);

  failSubmission = true;
  const fromPreview = page(preview, {
    post: { editData: { societyCallId: 'call-two' } },
    getAddPageVm: () => null
  });
  preview.methods.publishSuccess.call(fromPreview, { _id: 'post-preview' });
  await settle();
  assert.equal(submitted.at(-1).postId, 'post-preview');
  assert.equal(navigation.at(-1), 2);
  assert.equal(storage.get('society:pending-submission:v1:alice').postId, 'post-preview');

  actor = 'bob';
  assert.equal((await submission.retryPendingSocietySubmission('call-two')).attempted, false, 'pending work is account scoped');
  actor = 'alice';
  failSubmission = false;
  const retried = await submission.retryPendingSocietySubmission('call-two');
  assert.equal(retried.submitted, true);
  assert.equal(submitted.at(-1).postId, 'post-preview', 'retry uses the published post');
  assert.equal(storage.has('society:pending-submission:v1:alice'), false);
  console.log('society compose: PASS — original poem entry, direct and preview auto submission, account scoped retry');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
