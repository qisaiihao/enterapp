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
  const sandbox = { ...globals, module: { exports: {} } };
  vm.runInNewContext(source, sandbox, { filename: relativePath });
  return sandbox.module.exports;
}

function runtime(platform) {
  const state = { calls: [], reads: [], toasts: [], loading: false, readFailure: false, uploadFailure: false, missingFileID: false };
  const readImage = filePath => {
    state.reads.push(filePath);
    if (state.readFailure) throw new Error('fixture read failed');
    return `data:image/jpeg;base64,${imageData}`;
  };
  const globals = {
    platform, console: { log() {}, warn() {}, error() {} }, dualActionTopBar: {},
    uni: {
      showLoading() { state.loading = true; }, hideLoading() { state.loading = false; },
      showToast(value) { state.toasts.push(value); }, $emit() {},
      showModal({ success }) { success({ confirm: false }); }
    },
    cacheManager: { namespace: () => ({}) },
    async cloudCall(name, payload) {
      state.calls.push({ name, payload });
      if (name === 'upload' && state.uploadFailure) return { result: { success: false, message: 'fixture upload failed' } };
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
  const definition = loadModule('pages-content/portfolio/portfolio.vue', globals);
  const page = definition.data();
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
  console.log('[test-portfolio-cover] PASS: App/WeChat/H5 create, replace, rename, empty covers, failure preservation and retry');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
