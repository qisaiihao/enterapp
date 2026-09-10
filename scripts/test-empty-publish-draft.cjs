const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parse } = require('@babel/parser');
process.env.NODE_ENV = 'production';
const { createRenderer } = require('vue');
const renderer = createRenderer({
  createElement: () => ({}), createText: () => ({}), createComment: () => ({}),
  insert() {}, remove() {}, setText() {}, setElementText() {}, patchProp() {},
  parentNode() {}, nextSibling() {}
});
const root = path.join(__dirname, '..');
const pureSource = fs.readFileSync(path.join(root, 'pages-publish/add/addPure.js'), 'utf8');
const exportsList = parse(pureSource, { sourceType: 'module' }).program.body
  .filter(node => node.type === 'ExportNamedDeclaration').map(node => node.declaration.id.name);
const pureSandbox = { module: { exports: {} } };
vm.runInNewContext(pureSource.replace(/export function /g, 'function ') +
  `\nmodule.exports = { ${exportsList.join(',')} };`, pureSandbox);
let source = fs.readFileSync(path.join(root, 'pages-publish/add/add.vue'), 'utf8')
  .match(/<script>([\s\S]*?)<\/script>/)[1];
const imports = parse(source, { sourceType: 'module' }).program.body
  .filter(node => node.type === 'ImportDeclaration');
const bindings = {};
for (const node of imports) {
  for (const specifier of node.specifiers) {
    bindings[specifier.local.name] = pureSandbox.module.exports[specifier.imported?.name] || (() => {});
  }
}
for (const node of imports.reverse()) source = source.slice(0, node.start) + source.slice(node.end);
const storage = new Map();
let prompts = 0;
let navigations = 0;
const sandbox = {
  ...bindings, module: { exports: {} }, colorPalettes: [], poemLines: [], tagCategories: [],
  console: { log() {}, warn() {}, error(...args) { throw new Error(args.join(' ')); } },
  getCurrentPages: () => [{}, {}],
  uni: {
    showModal() { prompts += 1; }, navigateBack() { navigations += 1; },
    getStorageSync: key => storage.get(key),
    setStorageSync: (key, value) => storage.set(key, value),
    removeStorageSync: key => storage.delete(key)
  }
};
vm.runInNewContext(source.replace('export default', 'module.exports ='), sandbox);
const page = sandbox.module.exports;

function check(label, state, expected) {
  prompts = 0;
  navigations = 0;
  storage.clear();
  const app = renderer.createApp({
    data: page.data, computed: page.computed,
    methods: {
      ...page.methods,
      setData(data) { Object.assign(this.$data, data); },
      checkCanPublish() {}, scheduleWorkingDraftSave() {}
    },
    render: () => null
  });
  const instance = app.mount({});
  Object.assign(instance.$data, state);
  assert.equal(instance.hasContent(), expected, `${label}: content detection`);
  instance.goBack();
  assert.equal(prompts, expected ? 1 : 0, `${label}: toolbar return`);
  assert.equal(navigations, expected ? 0 : 1);
  instance.isNavigating = false;
  prompts = 0;
  assert.equal(page.onBackPress.call(instance), expected, `${label}: native return`);
  assert.equal(prompts, expected ? 1 : 0);
  assert.equal(instance.saveWorkingDraft(), expected, `${label}: autosave`);
  assert.equal(storage.has('publish_working_draft_v1'), expected);
  app.unmount();
}

check('fresh page', {}, false);
check('activity defaults only', {
  publishMode: 'poem', isOriginal: true, joinActivityEnabled: true,
  joinedActivityId: 'activity', joinedActivityTitle: '活动'
}, false);
check('options and whitespace only', {
  content: ' \n\t　', title: ' ', author: '\n', selectedTags: ['诗歌'],
  selectedBackgroundColor: '#123456'
}, false);
check('hidden old blocks', {
  publishMode: 'poem', content: '',
  blocks: [{ type: 'quote', text: '隐藏引用' }], seriesBlocks: [{ content: '隐藏组诗' }]
}, false);
check('cleared series with stale main content', {
  publishMode: 'poem', isSeries: true, content: '旧正文',
  seriesBlocks: [{ content: ' ', subtitle: '' }]
}, false);
check('cleared discussion with stale main content', {
  publishMode: 'discussion', content: '旧正文', blocks: [{ type: 'content', text: '' }]
}, false);
check('poem text', { publishMode: 'poem', content: '诗歌正文' }, true);
check('title only', { title: '已有标题' }, true);
check('image only', { imageList: [{ previewUrl: '/photo.jpg' }] }, true);
check('discussion quote', { publishMode: 'discussion', blocks: [{ type: 'quote', text: '引用' }] }, true);
check('series subtitle', {
  publishMode: 'poem', isSeries: true, seriesBlocks: [{ content: ' ', subtitle: '小标题' }]
}, true);
console.log('[test-empty-publish-draft] PASS: production Vue exit prompts and autosave across modes');
