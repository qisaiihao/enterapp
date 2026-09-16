const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parse } = require('@babel/parser');
process.env.NODE_ENV = 'production';
const { createRenderer, nextTick } = require('vue');
const root = path.join(__dirname, '..');
const calls = [];
let failSave = false;
let failHide = false;
const globals = {
  console: { log() {}, error() {} },
  uni: { showLoading() {}, hideLoading() {}, showToast() {}, setStorageSync() {} },
  togglePostVisibility: async postId => {
    calls.push(['hide', postId]);
    if (failHide) throw new Error('offline');
    return { isHidden: true };
  },
  emitPostVisibilityChanged() {}, notifyPortfolioUpdated() {},
  getPostDetail: async postId => ({ post: { _id: postId, content: '待转存的诗歌' } }),
  saveDraft: async draft => {
    calls.push(['draft', draft.content]);
    if (failSave) throw new Error('offline');
  },
  deletePostApi: async postId => { calls.push(['delete', postId]); }
};
function script(file) {
  return fs.readFileSync(path.join(root, file), 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
}
const profileSource = script('pages/profile/profile.vue');
const options = parse(profileSource, { sourceType: 'module' }).program.body
  .find(node => node.type === 'ExportDefaultDeclaration').declaration;
const methodsNode = options.properties.find(node => node.key.name === 'methods').value;
const methods = vm.runInNewContext(`(${profileSource.slice(methodsNode.start, methodsNode.end)})`, globals);
function profile(hidden = false) {
  const instance = {
    myPosts: [{ _id: 'target', isHidden: hidden }, { _id: 'other', isHidden: false }],
    showDeleteModal: true, deletePostId: 'target', deletePostIndex: 0,
    actionMenuData: { postId: 'other', index: 1, isHidden: false },
    setData(values) {
      for (const [key, value] of Object.entries(values)) {
        const match = key.match(/^myPosts\[(\d+)\]\.isHidden$/);
        if (match) this.myPosts[Number(match[1])].isHidden = value;
        else this[key] = value;
      }
    }
  };
  for (const [name, method] of Object.entries(methods)) instance[name] = method.bind(instance);
  calls.length = 0;
  return instance;
}
async function settle() {
  for (let i = 0; i < 12; i += 1) await Promise.resolve();
}

async function main() {
  let instance = profile();
  await instance.hidePostFromDelete();
  assert.deepEqual(calls, [['hide', 'target']], 'hide uses the delete target, not the previous action-menu target');
  assert.equal(instance.myPosts[0].isHidden, true);
  assert.equal(instance.myPosts[1].isHidden, false);
  assert.equal(instance.showDeleteModal, false);

  instance = profile(true);
  await instance.hidePostFromDelete();
  assert.deepEqual(calls, [], 'already hidden posts cannot be made public from the delete panel');

  failHide = true;
  instance = profile();
  await instance.hidePostFromDelete();
  assert.equal(instance.myPosts[0].isHidden, false, 'failed hide leaves the post state unchanged');
  failHide = false;

  instance = profile();
  instance.saveToDraft();
  await settle();
  assert.deepEqual(calls, [['draft', '待转存的诗歌'], ['delete', 'target']], 'save completes before removing the original');

  failSave = true;
  instance = profile();
  instance.saveToDraft();
  await settle();
  assert.deepEqual(calls, [['draft', '待转存的诗歌']], 'failed draft save cannot delete the original');
  assert.equal(instance.myPosts.length, 2);
  failSave = false;

  instance = profile();
  instance.confirmDelete();
  await settle();
  assert.deepEqual(calls, [['delete', 'target']], 'permanent delete does not save or hide');
  assert.equal(instance.myPosts[0]._id, 'other');

  const modal = vm.runInNewContext(script('components/DeleteModal.vue')
    .replace(/^import .*;\r?$/gm, '').replace('export default', 'module.exports ='),
  { AppActionSheet: {}, module: { exports: {} } });
  const renderer = createRenderer({
    createElement: () => ({}), createText: () => ({}), createComment: () => ({}),
    insert() {}, remove() {}, setText() {}, setElementText() {}, patchProp() {},
    parentNode() {}, nextSibling() {}
  });
  const events = [];
  const app = renderer.createApp({ ...modal, render: () => null, props: undefined,
    data: () => ({ visible: true, showDraft: true, isHidden: false })
  }, {
    onSaveDraft: () => events.push('draft'), onHide: () => events.push('hide'), onConfirm: () => events.push('delete')
  });
  const dialog = app.mount({});
  dialog.onSelect(0);
  dialog.onSelect(1);
  dialog.onSelect(2);
  assert.deepEqual(events, ['draft', 'hide', 'delete']);
  dialog.isHidden = true;
  await nextTick();
  dialog.onSelect(1);
  assert.equal(events.length, 3, 'hidden option cannot emit an action');
  dialog.showDraft = false;
  await nextTick();
  dialog.onSelect(1);
  assert.equal(events.at(-1), 'delete', 'omitting draft keeps the remaining actions mapped correctly');
  app.unmount();
  console.log('[test-delete-modal] PASS: action mapping, correct hide target, hidden guard, save-before-delete and failure recovery');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
