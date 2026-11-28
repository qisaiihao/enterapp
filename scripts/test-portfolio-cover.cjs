const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parse } = require('@babel/parser');

const root = path.join(__dirname, '..');
const imageData = Buffer.from('portfolio-cover-fixture').toString('base64');
const fileID = 'cloud://test/portfolio_covers/cover.jpg';

function loadModule(relativePath, globals) {
  let source = fs.readFileSync(path.join(root, relativePath), 'utf8');
  if (relativePath.endsWith('.vue')) source = source.match(/<script>([\s\S]*?)<\/script>/)[1];
  // Also allow this test to reproduce the old per-platform page implementation.
  const active = [true];
  source = source.split('\n').filter(line => {
    const directive = line.match(/\/\/ #if(n?)def (\S+)/);
    if (directive) {
      const enabled = globals.platform === 'h5' ? directive[2] === 'H5' : directive[2] !== 'H5';
      active.push(active[active.length - 1] && (directive[1] ? !enabled : enabled));
      return false;
    }
    if (line.includes('// #endif')) { active.pop(); return false; }
    return active[active.length - 1];
  }).join('\n');
  const nodes = parse(source, { sourceType: 'module' }).program.body;
  for (const node of nodes.reverse()) {
    if (node.type === 'ImportDeclaration' || node.type === 'ExportNamedDeclaration') {
      source = source.slice(0, node.start) + source.slice(node.end);
    } else if (node.type === 'ExportDefaultDeclaration') {
      source = source.slice(0, node.start) + 'module.exports = ' + source.slice(node.declaration.start);
    }
  }
  const sandbox = { AppMotion: {}, AppActionSheet: {}, ...globals, module: { exports: {} } };
  vm.runInNewContext(source, sandbox, { filename: relativePath });
  return sandbox.module.exports;
}

function runtime(platform) {
  const storage = new Map();
  const state = { calls: [], reads: [], toasts: [], events: [], navigations: [], loading: false, readFailure: false, uploadFailure: false, missingFileID: false };
  const readImage = filePath => {
    state.reads.push(filePath);
    if (state.readFailure) throw new Error('fixture read failed');
    return `data:image/jpeg;base64,${imageData}`;
  };
  const globals = {
    platform, console: { log() {}, warn() {}, error() {} }, dualActionTopBar: {},
    uni: {
      showLoading() { state.loading = true; }, hideLoading() { state.loading = false; },
      showToast(value) { state.toasts.push(value); },
      $emit(name, payload) { state.events.push({ name, payload }); },
      navigateTo(opts) { state.navigations.push(opts); },
      getStorageSync(key) { return storage.get(key); },
      setStorageSync(key, val) { storage.set(key, val); },
      showModal({ success }) { success({ confirm: Boolean(state.confirmDelete) }); }
    },
    cacheManager: { namespace: () => ({}) },
    async cloudCall(name, payload) {
      state.calls.push({ name, payload });
      if (name === 'upload' && state.uploadFailure) return { result: { success: false, message: 'fixture upload failed' } };
      if (name === 'updatePortfolioFolder' && payload && payload.action === 'updateOrder') {
        return { result: { success: true, updatedOrder: true, updatedCount: (payload.folderIds || []).length } };
      }
      return { result: { success: true, ...(name === 'upload' && !state.missingFileID ? { fileID } : {}) } };
    }
  };
  if (platform === 'app') {
    // App deliberately has no uni.getFileSystemManager; the shared reader must use plus.io.
    globals.plus = { io: {
      resolveLocalFileSystemURL(filePath, success) { success({ file: success => success({ filePath }) }); },
      FileReader: class {
        readAsDataURL(file) {
          try { this.onload({ target: { result: readImage(file.filePath) } }); }
          catch (error) { this.onerror(error); }
        }
      }
    } };
  } else if (platform === 'mp-weixin') {
    globals.uni.getFileSystemManager = () => ({ readFile(options) {
      assert.equal(options.encoding, 'base64');
      try { options.success({ data: readImage(options.filePath).split(',')[1] }); }
      catch (error) { options.fail({ errMsg: error.message }); }
    } });
  } else {
    globals.window = {};
    globals.document = {};
    globals.fetch = async filePath => ({ ok: true, blob: async () => ({ filePath }) });
    globals.FileReader = class {
      readAsDataURL(file) {
        try { this.result = readImage(file.filePath); this.onload(); }
        catch (error) { this.onerror(error); }
      }
    };
  }
  Object.assign(globals, loadModule('utils/fileReader.js', globals));
  Object.assign(globals, loadModule('api-cache/_shared/cloud-wrapper.js', globals));
  Object.assign(globals, loadModule('api-cache/portfolio.js', globals));
  globals.deletePortfolioApi = globals.deletePortfolio;
  const definition = loadModule('pages-content/portfolio/portfolio.vue', globals);
  const page = definition.data();
  for (const [name, getter] of Object.entries(definition.computed || {})) {
    Object.defineProperty(page, name, { get: () => getter.call(page), enumerable: true });
  }
  for (const [name, method] of Object.entries(definition.methods)) page[name] = method.bind(page);
  page.loadFolders = () => {};
  return { page, state };
}

async function main() {
  for (const platform of ['app', 'mp-weixin', 'h5']) {
    const localPath = { app: '_doc/uniapp_temp/cover.jpg', 'mp-weixin': 'wxfile://tmp/cover.jpg', h5: 'blob:http://localhost/cover' }[platform];
    for (const action of ['create', 'edit']) {
      const { page, state } = runtime(platform);
      if (action === 'create') {
        page.newFolderName = '测试集';
        page.newFolderCover = localPath;
        await page.createFolder();
      } else {
        page.folders = [{ _id: 'folder', name: '测试集', coverUrl: 'cloud://test/old.jpg' }];
        page.editFolderName(page.folders[0]);
        page.editingFolderCover = localPath;
        await page.saveFolderName();
        assert.equal(page.folders[0].coverUrl, fileID);
      }
      assert.deepEqual(state.calls.map(call => call.name), ['upload', action === 'create' ? 'createPortfolioFolder' : 'updatePortfolioFolder'], `${platform}: ${action} must upload then save`);
      assert.equal(state.calls[0].payload.fileContent, imageData, 'send base64 without a data URL prefix');
      assert.equal(state.calls[1].payload.coverUrl, fileID, 'persist the returned file ID');
      assert.deepEqual(state.reads, [localPath]);
      assert.equal(state.loading, false);
    }

    for (const coverUrl of ['cloud://test/existing.jpg', 'https://example.com/existing.jpg', '']) {
      const { page, state } = runtime(platform);
      page.folders = [{ _id: 'folder', name: '原名字', coverUrl }];
      page.editFolderName(page.folders[0]);
      page.editingFolderName = '新名字';
      await page.saveFolderName();
      assert.deepEqual(state.calls.map(call => call.name), ['updatePortfolioFolder']);
      assert.equal(state.calls[0].payload.coverUrl, coverUrl);
      assert.deepEqual(state.reads, [], 'renaming must not read or upload the saved cover');
    }

    const empty = runtime(platform);
    empty.page.newFolderName = '无封面';
    await empty.page.createFolder();
    assert.deepEqual(empty.state.calls.map(call => call.name), ['createPortfolioFolder']);
    assert.equal(empty.state.calls[0].payload.coverUrl, '');

    for (const failure of ['readFailure', 'uploadFailure', 'missingFileID']) {
      const { page, state } = runtime(platform);
      page.folders = [{ _id: 'folder', name: '测试集', coverUrl: 'cloud://test/old.jpg' }];
      page.editFolderName(page.folders[0]);
      page.editingFolderCover = localPath;
      state[failure] = true;
      await page.saveFolderName();
      assert.ok(!state.calls.some(call => call.name === 'updatePortfolioFolder'), 'failed uploads must not overwrite the saved cover');
      assert.equal(page.folders[0].coverUrl, 'cloud://test/old.jpg');
      assert.equal(page.showEditModal, true, 'keep the selection available for retry');
      assert.equal(state.loading, false);
      assert.ok(state.toasts.some(toast => toast.icon === 'none'));
      state[failure] = false;
      await page.saveFolderName();
      assert.equal(page.folders[0].coverUrl, fileID, 'retry must recover');
    }
  }

  const template = fs.readFileSync(path.join(root, 'pages-content/portfolio/portfolio.vue'), 'utf8');
  assert.ok(template.includes('class="folder-more-btn"'), 'portfolio row renders right-side three-dots button');
  assert.ok(template.includes('class="more-menu-dots-small"'), 'portfolio row reuses profile three-dots style');
  assert.ok(template.includes('<AppActionSheet'), 'portfolio page renders bottom action sheet');
  assert.ok(template.includes('class="swipe-actions"'), 'portfolio page keeps original left-swipe actions');
  assert.ok(
    template.indexOf('class="folder-sort-actions"') > -1 &&
    template.indexOf('class="folder-sort-actions"') < template.indexOf('class="folder-more-btn"'),
    'portfolio sort up/down buttons appear to the left of the three-dots button'
  );

  const menuRuntime = runtime('app');
  menuRuntime.page.folders = [
    { _id: 'default-id', name: '我的作品集', isDefault: true, isSwipeOpen: true, coverUrl: '' },
    { _id: 'custom-id', name: '秋日集', isDefault: false, isSwipeOpen: false, coverUrl: 'cloud://test/autumn.jpg' },
    { _id: 'winter-id', name: '冬日集', isDefault: false, isSwipeOpen: false, coverUrl: '' }
  ];
  assert.deepEqual(Array.from(menuRuntime.page.actionMenuItems), ['编辑', '排序', '删除']);
  menuRuntime.page.isSwipeMode = true;
  menuRuntime.page.openFolderActionMenu(menuRuntime.page.folders[1]);
  assert.equal(menuRuntime.page.actionMenuFolder, null, 'swipe gesture must not open bottom sheet');
  assert.equal(menuRuntime.page.isSwipeMode, false);

  menuRuntime.page.openFolderActionMenu(menuRuntime.page.folders[1]);
  assert.ok(menuRuntime.page.folders.every(item => item.isSwipeOpen === false), 'opening menu closes open swipe rows');
  assert.equal(menuRuntime.page.actionMenuFolder._id, 'custom-id');
  menuRuntime.page.closeFolderActionMenu();
  assert.equal(menuRuntime.page.actionMenuFolder, null);

  menuRuntime.page.openFolderActionMenu(menuRuntime.page.folders[1]);
  menuRuntime.page.handleFolderActionSelect(0);
  assert.equal(menuRuntime.page.actionMenuFolder, null);
  assert.equal(menuRuntime.page.showEditModal, true);
  assert.equal(menuRuntime.page.editingFolderName, '秋日集');
  assert.equal(menuRuntime.page.editingFolderCover, 'cloud://test/autumn.jpg');
  menuRuntime.page.hideEditModal();

  // 测试点击“排序”进入排序模式、上下移动并同步个人主页书架
  menuRuntime.page.openFolderActionMenu(menuRuntime.page.folders[1]);
  menuRuntime.page.handleFolderActionSelect(1);
  assert.equal(menuRuntime.page.actionMenuFolder, null, 'selecting sort closes bottom sheet');
  assert.equal(menuRuntime.page.isSorting, true);
  assert.deepEqual(Array.from(menuRuntime.page.actionMenuItems), ['编辑', '完成排序', '删除']);

  await menuRuntime.page.moveFolder(0, -1);
  await menuRuntime.page.moveFolder(2, 1);
  assert.equal(menuRuntime.state.calls.length, 0, 'boundary moves are safe no-ops');

  await menuRuntime.page.moveFolder(2, -1);
  assert.deepEqual(Array.from(menuRuntime.page.folders).map(f => f._id), ['default-id', 'winter-id', 'custom-id']);
  await menuRuntime.page.moveFolder(1, -1);
  assert.deepEqual(Array.from(menuRuntime.page.folders).map(f => f._id), ['winter-id', 'default-id', 'custom-id']);
  assert.ok(
    menuRuntime.state.calls.some(call =>
      call.name === 'updatePortfolioFolder' &&
      call.payload.action === 'updateOrder' &&
      JSON.stringify(call.payload.folderIds) === JSON.stringify(['winter-id', 'default-id', 'custom-id'])
    ),
    'reordering persists custom order via updatePortfolioFolder'
  );
  const reorderEvent = menuRuntime.state.events.filter(e => e.name === 'portfolio-updated').at(-1);
  assert.ok(reorderEvent && reorderEvent.payload.source === 'portfolio:reorder');
  assert.deepEqual(Array.from(reorderEvent.payload.folders).map(f => f._id), ['winter-id', 'default-id', 'custom-id']);

  // 验证个人主页接收 portfolio-updated 后书架列表立即同步更新
  const profileSource = fs.readFileSync(path.join(root, 'pages/profile/profile.vue'), 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
  const profileOptions = parse(profileSource, { sourceType: 'module' }).program.body.find(node => node.type === 'ExportDefaultDeclaration').declaration;
  const profileMethodsNode = profileOptions.properties.find(node => node.key.name === 'methods').value;
  const listeners = {};
  const profileMethods = vm.runInNewContext(`(${profileSource.slice(profileMethodsNode.start, profileMethodsNode.end)})`, {
    uni: { $on(name, fn) { listeners[name] = fn; } },
    invalidatePortfolioCache() {},
    getOpenid: () => 'me'
  });
  const profileVm = {
    ...profileMethods,
    currentTab: 'portfolio',
    hasInitialSnapshot: true,
    portfolioList: [{ _id: 'default-id', name: '我的作品集' }, { _id: 'custom-id', name: '秋日集' }],
    setData(patch) { Object.assign(this, patch); }
  };
  profileVm.ensureGlobalEventBindings();
  listeners['portfolio-updated'](reorderEvent.payload);
  assert.deepEqual(Array.from(profileVm.portfolioList).map(f => f._id), ['winter-id', 'default-id', 'custom-id'], 'profile bookshelf immediately reflects reordered portfolios');

  // 排序模式下点击卡片空白处退出排序而不误跳详情页
  menuRuntime.page.openFolder(menuRuntime.page.folders[0]);
  assert.equal(menuRuntime.page.isSorting, false);
  assert.equal(menuRuntime.state.navigations.length, 0);

  menuRuntime.state.calls = [];
  menuRuntime.page.openFolderActionMenu(menuRuntime.page.folders[1]);
  menuRuntime.page.handleFolderActionSelect(2);
  assert.equal(menuRuntime.page.actionMenuFolder, null);
  assert.ok(menuRuntime.state.toasts.some(t => t.title === '默认作品集不能删除'));
  assert.equal(menuRuntime.state.calls.length, 0);

  menuRuntime.state.confirmDelete = true;
  menuRuntime.page.openFolderActionMenu(menuRuntime.page.folders[2]);
  menuRuntime.page.handleFolderActionSelect(2);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(menuRuntime.page.actionMenuFolder, null);
  assert.ok(menuRuntime.state.calls.some(call => call.name === 'deletePortfolio' && call.payload.portfolioId === 'custom-id'));

  console.log('[test-portfolio-cover] PASS: App/WeChat/H5 create, replace, rename, empty covers, failure preservation, retry, three-dots action sheet, sorting and profile bookshelf sync');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
