const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parse } = require('@babel/parser');

function load(file, globals) {
  let source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  if (file.endsWith('.vue')) source = source.match(/<script>([\s\S]*?)<\/script>/)[1];
  for (const node of parse(source, { sourceType: 'module' }).program.body.reverse()) {
    if (node.type === 'ImportDeclaration' || node.type === 'ExportNamedDeclaration') source = source.slice(0, node.start) + source.slice(node.end);
    else if (node.type === 'ExportDefaultDeclaration') source = source.slice(0, node.start) + 'module.exports = ' + source.slice(node.declaration.start);
  }
  const context = { AppMotion: {}, ...globals, module: { exports: {} } };
  vm.runInNewContext(source, context, { filename: file });
  return context.module.exports;
}

const fileID = 'cloud://fixture/folder_covers/cover.jpg';
const imageData = Buffer.from('favorite-cover-fixture').toString('base64');
function runtime(platform) {
  const state = { calls: [], reads: [], loading: false, toasts: [], refreshes: 0 };
  const read = file => {
    state.reads.push(file);
    if (state.failure === 'read') throw new Error('fixture read failure');
    return `data:image/jpeg;base64,${imageData}`;
  };
  const globals = {
    console: { log() {}, error() {} }, dualActionTopBar: {},
    uni: {
      showLoading() { state.loading = true; }, hideLoading() { state.loading = false; },
      showToast(value) { state.toasts.push(value); },
      chooseImage(options) { state.picker = options; }
    },
    async cloudCall(name, data, options) {
      state.calls.push({ name, data, options });
      if (state.gate) await state.gate;
      if (state.failure === 'network') throw new Error('fixture network failure');
      if ((name === 'upload' && state.failure === 'upload') || (name === 'createFavoriteFolder' && state.failure === 'create')) {
        return { result: { success: false, message: 'fixture business failure' } };
      }
      return { result: { success: true, ...(name === 'upload' && state.failure !== 'missingID' ? { fileID } : {}) } };
    }
  };
  if (platform === 'app') globals.plus = { io: {
    resolveLocalFileSystemURL(file, success) { success({ file: success => success(file) }); },
    FileReader: class {
      readAsDataURL(file) { try { this.onload({ target: { result: read(file) } }); } catch (error) { this.onerror(error); } }
    }
  } };
  else if (platform === 'mp-weixin') globals.uni.getFileSystemManager = () => ({ readFile(options) {
    assert.equal(options.encoding, 'base64');
    try { options.success({ data: read(options.filePath).split(',')[1] }); } catch (error) { options.fail({ errMsg: error.message }); }
  } });
  else {
    globals.window = {}; globals.document = {};
    globals.fetch = async file => ({ ok: true, blob: async () => file });
    globals.FileReader = class {
      readAsDataURL(file) { try { this.result = read(file); this.onload(); } catch (error) { this.onerror(error); } }
    };
  }
  Object.assign(globals, load('utils/fileReader.js', globals));
  const definition = load('pages-content/favorite-folders/favorite-folders.vue', globals);
  const page = definition.data();
  for (const [name, method] of Object.entries(definition.methods)) page[name] = method.bind(page);
  page.loadFolders = () => state.refreshes++;
  page.showCreateFolder(); page.newFolderName = ' 春日 ';
  page.newFolderCover = { app: '_doc/uniapp_temp/cover.jpg', 'mp-weixin': 'wxfile://tmp/cover.jpg', h5: 'blob:http://localhost/cover' }[platform];
  return { page, state };
}

async function main() {
  for (const platform of ['app', 'mp-weixin', 'h5']) {
    const { page, state } = runtime(platform);
    await Promise.all([page.createFolder(), page.createFolder()]);
    assert.deepEqual(state.calls.map(c => c.name), ['upload', 'createFavoriteFolder']);
    assert.equal(state.calls[0].data.fileContent, imageData);
    assert.match(state.calls[0].data.cloudPath, /^folder_covers\/\d+_new_cover\.jpg$/);
    assert.equal(state.calls[1].data.folderName, '春日');
    assert.equal(state.calls[1].data.coverUrl, fileID);
    assert.equal(state.calls[0].options.context, page);
    assert.equal(state.calls[0].options.requireAuth, true);
    assert.equal(page.showCreateModal, false); assert.equal(page.newFolderCover, '');
    assert.equal(state.loading, false); assert.equal(state.refreshes, 1);

    for (const failure of ['read', 'upload', 'missingID', 'create', 'network']) {
      const { page, state } = runtime(platform);
      const selection = page.newFolderCover;
      state.failure = failure;
      await page.createFolder();
      if (failure !== 'create') assert.ok(!state.calls.some(c => c.name === 'createFavoriteFolder'));
      assert.equal(page.showCreateModal, true); assert.equal(page.newFolderName, ' 春日 ');
      assert.equal(page.newFolderCover, selection); assert.equal(page.isCreatingFolder, false);
      assert.equal(state.loading, false); assert.equal(state.refreshes, 0);
      assert.ok(state.toasts.some(t => t.icon === 'none'));
      state.failure = null; state.calls = [];
      await page.createFolder();
      assert.equal(state.calls.at(-1).data.coverUrl, fileID);
      assert.equal(page.showCreateModal, false);
    }

    const empty = runtime(platform);
    empty.page.newFolderCover = '';
    await empty.page.createFolder();
    assert.deepEqual(empty.state.calls.map(c => c.name), ['createFavoriteFolder']);
    assert.equal(empty.state.calls[0].data.coverUrl, null);
    assert.deepEqual(empty.state.reads, []);
  }
  const { page, state } = runtime('app');
  page.chooseNewCoverImage();
  state.picker.fail({ errMsg: 'chooseImage:fail cancel' });
  assert.equal(state.toasts.length, 0);
  state.picker.success({ tempFilePaths: ['_doc/replacement.jpg'] });
  assert.equal(page.newFolderCover, '_doc/replacement.jpg');
  let release;
  state.gate = new Promise(resolve => { release = resolve; });
  const pending = page.createFolder();
  page.hideCreateModal(); page.showCreateFolder();
  assert.equal(page.showCreateModal, true); assert.equal(page.newFolderCover, '_doc/replacement.jpg');
  release(); await pending;
  page.showCreateFolder();
  assert.equal(page.newFolderName, ''); assert.equal(page.newFolderCover, '');
  page.newFolderCover = '_doc/cancelled.jpg'; page.hideCreateModal();
  assert.equal(page.newFolderCover, '');
  console.log('[test-favorite-folder-cover] PASS: App/WeChat/H5 upload-before-create, file ID, no cover, failures/retry, duplicate submission, picker cancellation and form reset');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
