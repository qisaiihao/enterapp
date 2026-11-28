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
  const context = { AppMotion: {}, AppActionSheet: {}, ...globals, module: { exports: {} } };
  vm.runInNewContext(source, context, { filename: file });
  return context.module.exports;
}

const fileID = 'cloud://fixture/folder_covers/cover.jpg';
const imageData = Buffer.from('favorite-cover-fixture').toString('base64');
function runtime(platform) {
  const state = { calls: [], reads: [], loading: false, toasts: [], navigations: [], refreshes: 0 };
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
      navigateTo(opts) { state.navigations.push(opts); },
      showModal({ success }) { success({ confirm: Boolean(state.confirmDelete) }); },
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
  globals.favoriteRefresh = {};
  globals.createFavoriteFolder = async (folderName, coverUrl, context) => {
    const response = await globals.cloudCall('createFavoriteFolder', { folderName, coverUrl }, { context, requireAuth: true });
    if (!response.result.success) throw new Error(response.result.message);
    return response.result;
  };
  globals.updateFavoriteFolder = async (folderId, folderName, coverUrl, context) => {
    const response = await globals.cloudCall('updateFavoriteFolder', { folderId, folderName, coverUrl }, { context, requireAuth: true });
    return response.result;
  };
  globals.deleteFavoriteFolder = async (folderId, context) => {
    const response = await globals.cloudCall('deleteFavoriteFolder', { folderId }, { context, requireAuth: true });
    return response.result;
  };
  globals.updateFavoriteFolderOrder = async (folderIds, context, extra) => {
    const response = await globals.cloudCall('getMyProfileData', { action: 'updateFavoriteFolderOrder', folderIds, source: extra?.source }, { context, requireAuth: true });
    return response.result;
  };
  Object.assign(globals, load('utils/fileReader.js', globals));
  const definition = load('pages-content/favorite-folders/favorite-folders.vue', globals);
  const page = definition.data();
  for (const [name, getter] of Object.entries(definition.computed || {})) {
    Object.defineProperty(page, name, { get: () => getter.call(page), enumerable: true });
  }
  for (const [name, method] of Object.entries(definition.methods)) page[name] = method.bind(page);
  page.loadFolders = async () => { state.refreshes++; };
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

    const edit = runtime(platform);
    const originalCover = 'cloud://fixture/folder_covers/original.jpg';
    edit.page.editingFolder = { _id: 'folder-1', coverUrl: originalCover };
    edit.page.editingFolderName = ' 新名字 ';
    edit.page.editingFolderCover = originalCover;
    await edit.page.saveFolderName();
    assert.deepEqual(edit.state.calls.map(c => c.name), ['updateFavoriteFolder']);
    assert.equal(edit.state.calls[0].data.coverUrl, originalCover);
    assert.deepEqual(edit.state.reads, [], 'renaming must not read a cloud cover as a local file');

    const replacement = runtime(platform);
    replacement.page.editingFolder = { _id: 'folder-1', coverUrl: originalCover };
    replacement.page.editingFolderName = '新名字';
    replacement.page.editingFolderCover = replacement.page.newFolderCover;
    await replacement.page.saveFolderName();
    assert.deepEqual(replacement.state.calls.map(c => c.name), ['upload', 'updateFavoriteFolder']);
    assert.equal(replacement.state.calls[0].data.fileContent, imageData);
    assert.equal(replacement.state.calls[1].data.coverUrl, fileID);
    assert.equal(replacement.state.loading, false);
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

  const template = fs.readFileSync(path.join(__dirname, '..', 'pages-content/favorite-folders/favorite-folders.vue'), 'utf8');
  assert.ok(template.includes('class="folder-more-btn"'), 'favorite folder row renders right-side three-dots button');
  assert.ok(template.includes('class="more-menu-dots-small"'), 'favorite folder row reuses profile three-dots style');
  assert.ok(template.includes('<AppActionSheet'), 'favorite folders page renders bottom action sheet');
  assert.ok(template.includes('class="swipe-actions"'), 'favorite folders page keeps original left-swipe actions');
  assert.ok(
    template.indexOf('class="folder-sort-actions"') > -1 &&
    template.indexOf('class="folder-sort-actions"') < template.indexOf('class="folder-more-btn"'),
    'favorite folder sort up/down buttons appear to the left of the three-dots button'
  );

  const menuRuntime = runtime('app');
  menuRuntime.page.folders = [
    { _id: 'default-fav', name: '默认收藏夹', isDefault: true, isSwipeOpen: true, coverUrl: '' },
    { _id: 'custom-fav', name: '春日诗选', isDefault: false, isSwipeOpen: false, coverUrl: 'cloud://fixture/spring.jpg' },
    { _id: 'night-fav', name: '夜读集', isDefault: false, isSwipeOpen: false, coverUrl: '' }
  ];
  assert.deepEqual(Array.from(menuRuntime.page.actionMenuItems), ['编辑', '排序', '删除']);
  menuRuntime.page.isSwipeMode = true;
  menuRuntime.page.openFolderActionMenu(menuRuntime.page.folders[1]);
  assert.equal(menuRuntime.page.actionMenuFolder, null, 'swipe gesture must not open bottom sheet');
  assert.equal(menuRuntime.page.isSwipeMode, false);

  menuRuntime.page.openFolderActionMenu(menuRuntime.page.folders[1]);
  assert.ok(menuRuntime.page.folders.every(item => item.isSwipeOpen === false), 'opening menu closes open swipe rows');
  assert.equal(menuRuntime.page.actionMenuFolder._id, 'custom-fav');
  menuRuntime.page.closeFolderActionMenu();
  assert.equal(menuRuntime.page.actionMenuFolder, null);

  menuRuntime.page.openFolderActionMenu(menuRuntime.page.folders[1]);
  menuRuntime.page.handleFolderActionSelect(0);
  assert.equal(menuRuntime.page.actionMenuFolder, null);
  assert.equal(menuRuntime.page.showEditModal, true);
  assert.equal(menuRuntime.page.editingFolderName, '春日诗选');
  assert.equal(menuRuntime.page.editingFolderCover, 'cloud://fixture/spring.jpg');

  // 测试点击“排序”进入排序模式及上下移动
  menuRuntime.page.openFolderActionMenu(menuRuntime.page.folders[1]);
  menuRuntime.page.handleFolderActionSelect(1);
  assert.equal(menuRuntime.page.actionMenuFolder, null);
  assert.equal(menuRuntime.page.isSorting, true);
  assert.deepEqual(Array.from(menuRuntime.page.actionMenuItems), ['编辑', '完成排序', '删除']);

  await menuRuntime.page.moveFolder(0, -1);
  await menuRuntime.page.moveFolder(2, 1);
  assert.equal(menuRuntime.state.calls.length, 0, 'boundary moves are safe no-ops');

  await menuRuntime.page.moveFolder(0, 1);
  assert.deepEqual(Array.from(menuRuntime.page.folders).map(f => f._id), ['custom-fav', 'default-fav', 'night-fav']);
  assert.ok(
    menuRuntime.state.calls.some(c =>
      c.name === 'getMyProfileData' &&
      c.data.action === 'updateFavoriteFolderOrder' &&
      JSON.stringify(c.data.folderIds) === JSON.stringify(['custom-fav', 'default-fav', 'night-fav'])
    )
  );
  assert.equal(menuRuntime.page.acceptFavoriteChange({ source: 'favorite-folders:reorder' }), false);

  // 排序模式下点击条目收起排序而不误跳转
  menuRuntime.page.enterFolder(menuRuntime.page.folders[0]);
  assert.equal(menuRuntime.page.isSorting, false);
  assert.equal(menuRuntime.state.navigations.length, 0);

  menuRuntime.state.calls = [];
  menuRuntime.page.openFolderActionMenu(menuRuntime.page.folders[1]);
  menuRuntime.page.handleFolderActionSelect(2);
  assert.equal(menuRuntime.page.actionMenuFolder, null);
  assert.ok(menuRuntime.state.toasts.some(t => t.title === '默认收藏夹不能删除'));
  assert.equal(menuRuntime.state.calls.length, 0);

  menuRuntime.state.confirmDelete = true;
  menuRuntime.page.openFolderActionMenu(menuRuntime.page.folders[0]);
  menuRuntime.page.handleFolderActionSelect(2);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(menuRuntime.page.actionMenuFolder, null);
  assert.ok(menuRuntime.state.calls.some(c => c.name === 'deleteFavoriteFolder' && c.data.folderId === 'custom-fav'));

  console.log('[test-favorite-folder-cover] PASS: App/WeChat/H5 upload-before-create, file ID, no cover, failures/retry, duplicate submission, picker cancellation, form reset, three-dots action sheet and sorting');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
