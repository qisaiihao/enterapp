const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parse } = require('@babel/parser');

// The regression only occurs when Vue stops exposing data as instance own keys.
process.env.NODE_ENV = 'production';
const { createRenderer } = require('vue');
const renderer = createRenderer({
  createElement: () => ({}), createText: () => ({}), createComment: () => ({}),
  insert() {}, remove() {}, setText() {}, setElementText() {}, patchProp() {},
  parentNode() {}, nextSibling() {}
});
const quietConsole = { log() {}, warn() {}, error(...args) { throw new Error(args.join(' ')); } };

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
  const sandbox = { ...bindings, ...globals, module: { exports: {} }, console: quietConsole };
  vm.runInNewContext(source.replace('export default', 'module.exports ='), sandbox, { filename: file });
  return sandbox.module.exports;
}

const storage = new Map();
const requests = [];
let addVm;
let eventPost;
const uni = {
  showToast() {},
  getStorageSync: key => key === 'userInfo' ? { nickName: '测试作者' } : storage.get(key),
  setStorageSync: (key, value) => storage.set(key, JSON.parse(JSON.stringify(value))),
  navigateTo({ success }) {
    success({ eventChannel: { emit(name, { post }) {
      assert.equal(name, 'preview-data');
      eventPost = post;
    } } });
  }
};
const add = loadPage('pages-publish/add/add.vue', {
  uni, colorPalettes: [], poemLines: [], tagCategories: [],
  normalizeSeriesBlocks: () => ({ highlightLines: [] })
});
const preview = loadPage('pages-publish/preview/preview.vue', {
  uni,
  getCurrentPages: () => [{ $vm: addVm }, {}],
  attachPoemDisplayFields: post => post,
  async contentAudit(payload) {
    requests.push({ type: 'create', payload });
    return { code: 0, postId: 'created-poem' };
  },
  async updatePostContent(postId, { data: payload }) {
    requests.push({ type: 'update', postId, payload });
    return { success: true };
  }
});

const plain = value => JSON.parse(JSON.stringify(value));
const navy = { backgroundColor: '#28374D', textColor: '#DDE6ED' };
const warm = { backgroundColor: '#E9A752', textColor: '#78614D' };
const defaults = { backgroundColor: '#a4c4bd', textColor: '#333333' };

async function checkPublish(colors, edit = false, withImage = false) {
  storage.clear();
  eventPost = null;
  const app = renderer.createApp({
    data: add.data,
    methods: {
      onColorSelect: add.methods.onColorSelect,
      goToPreview: add.methods.goToPreview,
      setData(data) { Object.assign(this.$data, data); },
      scheduleWorkingDraftSave() {}, flushWorkingDraft() {}
    },
    render: () => null
  });
  addVm = app.mount({});
  Object.assign(addVm.$data, {
    title: '测试诗歌', content: '第一行\n第二行', author: '测试作者',
    publishMode: 'poem', isOriginal: true,
    selectedTags: ['诗歌'], highlightLines: ['第二行'], highlightSelectedLineIndices: [1],
    isEditMode: edit, editingPostId: edit ? 'existing-poem' : '',
    imageList: withImage ? [{ previewUrl: '/test.jpg' }] : []
  });
  if (colors) addVm.onColorSelect(colors);
  const expected = colors || defaults;
  assert.equal(addVm.selectedBackgroundColor, expected.backgroundColor);
  assert.equal(({ ...addVm }).selectedBackgroundColor, undefined,
    'The test must use the production Vue instance that reproduces missing own keys');
  addVm.goToPreview();

  // Both App event-channel and storage fallback must preview the selected colors.
  for (const rawPost of [eventPost, storage.get('preview_post')]) {
    const post = preview.methods.preparePreviewPost(rawPost);
    assert.equal(post.backgroundColor, expected.backgroundColor);
    assert.equal(post.textColor, expected.textColor);
  }
  const state = {
    post: preview.methods.preparePreviewPost(eventPost),
    joinedActivityId: '', joinedActivityTitle: '',
    executePublish(data) { this.publishData = data; },
    publishSuccess() {},
    publishFail(error) { throw error; }
  };
  preview.methods.publishFromAddPage.call(state);
  assert.ok(state.publishData, 'Publish must reach the submit flow');
  assert.equal(state.publishData.selectedBackgroundColor, expected.backgroundColor);
  assert.equal(state.publishData.selectedTextColor, expected.textColor);
  assert.deepEqual(plain(state.publishData.selectedTags), ['诗歌']);
  assert.deepEqual(plain(state.publishData.highlightLines), ['第二行']);
  assert.equal(state.publishData.$, undefined, 'Vue internals must not enter the publish snapshot');

  const uploadResults = withImage
    ? [{ compressedUrl: 'cloud://test/compressed.jpg', originalUrl: 'cloud://test/original.jpg' }]
    : [];
  await preview.methods.submitToDatabase.call(state, state.publishData, uploadResults);
  const request = requests.at(-1);
  assert.equal(request.type, edit ? 'update' : 'create');
  if (edit) assert.equal(request.postId, 'existing-poem');
  assert.equal(request.payload.backgroundColor, expected.backgroundColor);
  assert.equal(request.payload.textColor, expected.textColor);
  assert.deepEqual(plain(request.payload.tags), ['诗歌']);
  assert.deepEqual(plain(request.payload.highlightLines), ['第二行']);
  assert.deepEqual(plain(request.payload.fileIDs), withImage ? ['cloud://test/compressed.jpg'] : []);
  app.unmount();
}

(async () => {
  await checkPublish(navy);
  await checkPublish(warm, false, true);
  await checkPublish(navy, true, true);
  await checkPublish(warm, true);
  await checkPublish(null);
  console.log('[test-publish-colors] PASS (production Vue: selection, preview, create/edit requests, images, tags and highlights)');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
