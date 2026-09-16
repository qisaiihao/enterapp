const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parse } = require('@babel/parser');

const plain = value => JSON.parse(JSON.stringify(value));
const requests = [];
const api = {
  uni: { getStorageSync: () => ({ nickName: '测试作者' }) },
  async contentAudit(payload) {
    requests.push({ type: 'create', payload: plain(payload) });
    return { code: 0, postId: 'new-post' };
  },
  async updatePostContent(postId, { data }) {
    requests.push({ type: 'update', postId, payload: plain(data) });
    return { success: true };
  },
  async cloudCall(name, payload) {
    requests.push({ type: name, payload: plain(payload) });
    return { code: 0, postId: 'merged-post' };
  }
};

function loadPage(file) {
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
    ...bindings, ...api, module: { exports: {} },
    console: { log() {}, warn() {}, error(...args) { throw new Error(args.join(' ')); } }
  };
  vm.runInNewContext(source.replace('export default', 'module.exports ='), sandbox, { filename: file });
  return sandbox.module.exports;
}

const pages = {
  add: loadPage('pages-publish/add/add.vue'),
  preview: loadPage('pages-publish/preview/preview.vue')
};
const first = { id: 'first', subtitle: '单首标题', content: '第一行\n第二行', highlightSentence: '第二行' };
const second = { id: 'second', subtitle: '另一首', content: '第三行' };
const blank = { subtitle: ' \t ', content: ' \n ' };
const scenarios = [
  { name: 'one poem', blocks: [first], expectedSeries: false, expectedBlocks: [], expectedContent: first.content },
  { name: 'one poem and empty blocks', blocks: [blank, first, blank], expectedSeries: false, expectedBlocks: [], expectedContent: first.content },
  { name: 'two poems', blocks: [first, second], expectedSeries: true, expectedBlocks: [first, second], expectedContent: `${first.content}\n\n${second.content}` },
  { name: 'two poems and empty blocks', blocks: [blank, first, blank, second], expectedSeries: true, expectedBlocks: [first, second], expectedContent: `${first.content}\n\n${second.content}` },
  { name: 'ordinary poem with leftover blocks', isSeries: false, blocks: [first, second], expectedSeries: false, expectedBlocks: [], expectedContent: '普通单首正文' },
  { name: 'single block title fallback', title: '', blocks: [first], expectedTitle: first.subtitle, expectedSeries: false, expectedBlocks: [], expectedContent: first.content }
];

async function checkSubmit(entry, scenario, edit, original) {
  requests.length = 0;
  const data = {
    title: scenario.title ?? '发布标题', content: '普通单首正文', author: '测试作者',
    publishMode: 'poem', isOriginal: original, isSeries: scenario.isSeries ?? true,
    seriesBlocks: plain(scenario.blocks), selectedTags: ['诗歌'],
    highlightLines: ['第二行'], selectedBackgroundColor: '#28374D', selectedTextColor: '#DDE6ED',
    isEditMode: edit, editingPostId: edit ? 'existing-post' : ''
  };
  const before = plain(data);
  const state = {
    ...data, post: {}, buildDiscussionSentenceGroups: () => [],
    publishSuccess(result) { this.result = result; },
    publishFail(error) { throw error; }
  };
  const images = [{ compressedUrl: 'cloud://compressed.jpg', originalUrl: 'cloud://original.jpg' }];
  if (entry === 'add') await pages.add.methods.submitToDatabase.call(state, images);
  else await pages.preview.methods.submitToDatabase.call(state, data, images);
  const label = `${entry}: ${scenario.name}, edit=${edit}, original=${original}`;
  assert.equal(requests.length, 1, label);
  const { type, payload } = requests[0];
  assert.equal(type, edit ? 'update' : 'create', label);
  assert.equal(payload.isSeries, scenario.expectedSeries, label);
  assert.equal(payload.isPoem, true, label);
  assert.equal(payload.isOriginal, original, label);
  assert.equal(payload.publishMode, 'poem', label);
  assert.equal(payload.isDiscussion, false, label);
  assert.equal(payload.title, scenario.expectedTitle ?? '发布标题', label);
  assert.equal(payload.content, scenario.expectedContent, label);
  assert.deepEqual(payload.seriesBlocks, scenario.expectedBlocks, label);
  if (edit) assert.equal(payload.seriesBlockCount, scenario.expectedBlocks.length, label);
  assert.deepEqual(payload.highlightLines, ['第二行'], label);
  assert.deepEqual(payload.tags, ['诗歌'], label);
  assert.deepEqual(payload.fileIDs, ['cloud://compressed.jpg'], label);
  assert.equal(payload.backgroundColor, '#28374D', label);
  assert.equal(payload.textColor, '#DDE6ED', label);
  assert.equal(state.isSeries, before.isSeries, 'Submitting must preserve the editor mode');
  assert.deepEqual(plain(data), before, 'Submitting must preserve editable source data');
}

(async () => {
  let count = 0;
  for (const entry of Object.keys(pages)) {
    for (const scenario of scenarios) {
      for (const edit of [false, true]) {
        for (const original of [false, true]) {
          await checkSubmit(entry, scenario, edit, original);
          count++;
        }
      }
    }
  }
  requests.length = 0;
  const state = { post: {}, publishSuccess(result) { this.result = result; } };
  await pages.preview.methods.submitToDatabase.call(state, {
    isSeries: true, seriesSourceMode: 'existing-posts', seriesBlocks: [{ ...first, postId: 'source-post' }]
  }, []);
  assert.equal(requests.length, 0, 'One existing poem must not create a series or duplicate post');
  assert.equal(state.result._id, 'source-post');
  assert.equal(state.result.redirectToPostDetail, true);
  console.log(`[test-single-poem-publish] PASS (${count} create/edit cases, plus one existing poem)`);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
