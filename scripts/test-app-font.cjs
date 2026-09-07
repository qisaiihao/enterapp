const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function createRuntime(platform = 'app') {
  let source = fs.readFileSync(path.join(__dirname, '../utils/fontManager.js'), 'utf8');
  const active = [true];
  source = source.split('\n').filter(line => {
    const match = line.match(/\/\/ #ifdef (.+)/);
    if (match) {
      active.push(active[active.length - 1] && match[1].trim() === 'APP-PLUS');
      return false;
    }
    if (line.includes('// #endif')) { active.pop(); return false; }
    return active[active.length - 1];
  }).join('\n').replace(/import[\s\S]*?from\s+['"][^'"]+['"];?/g, '')
    .replace('export default fontManager;', 'globalThis.manager = fontManager;');
  const state = { platform, page: {}, calls: [], fail: false, converted: '/data/user/0/app/www/static/fonts/font.woff2' };
  const sandbox = {
    console: { log() {}, warn() {}, error() {} }, setTimeout, clearTimeout, setInterval, clearInterval,
    getCurrentPlatform: () => state.platform,
    getCurrentPages: () => state.page ? [state.page] : [],
    BUILTIN_HUIWEN_FONT_FAMILY: '汇文明朝', markBuiltinHuiwenFontReady() {},
    fileUrlCache: { getTempUrl() { throw new Error('App builtin must never request cloud'); } },
    uni: {
      getStorageSync() { return null; }, setStorageSync() {},
      loadFontFace(options) {
        state.calls.push(options);
        queueMicrotask(() => state.fail ? options.fail({ errMsg: 'test failure' }) : options.success());
      }
    },
    plus: { io: { convertLocalFileSystemURL: () => state.converted } }
  };
  vm.runInNewContext(source, sandbox);
  return { manager: sandbox.manager, state };
}

(async () => {
  // Even if configuration was initialized before App detection, use only bundled data.
  const { manager, state } = createRuntime('mp-weixin');
  state.platform = 'app';
  manager.cacheInfo.fonts['汇文明朝'] = { cloudUrl: 'https://old.example/font.ttf', version: 'old' };
  await Promise.all([manager.ensureFontAvailable('汇文明朝'), manager.ensureFontAvailable('Huiwen-mincho')]);
  assert.equal(state.calls.length, 1, 'Concurrent requests on one page should coalesce');
  assert.equal(state.calls[0].family, 'Huiwen-mincho');
  assert.equal(state.calls[0].source, `url("file://${state.converted}")`);
  assert.equal(manager.isFontLoaded('汇文明朝'), true);
  const firstPage = state.page;
  state.page = {};
  assert.equal(manager.isFontLoaded('汇文明朝'), false, 'New page must register its own font');
  await manager.ensureFontAvailable('汇文明朝');
  assert.equal(state.calls.length, 2);
  state.page = firstPage;
  await manager.ensureFontAvailable('汇文明朝');
  assert.equal(state.calls.length, 2, 'Existing page may reuse registration');
  for (const [converted, expected] of [
    ['apps/id/www/font.woff2', 'file:///android_asset/apps/id/www/font.woff2'],
    ['/android_asset/apps/id/www/font.woff2', 'file:///android_asset/apps/id/www/font.woff2'],
    ['/var/mobile/Containers/Data/Application/id/font.woff2', 'file:///var/mobile/Containers/Data/Application/id/font.woff2']
  ]) {
    state.converted = converted;
    assert.equal(manager._resolveAppFontSourcePath('/static/fonts/font.woff2'), expected);
  }
  assert.equal(manager._resolveAppFontSourcePath('file:///existing/font.woff2'), 'file:///existing/font.woff2');
  state.page = null;
  await assert.rejects(manager.ensureFontAvailable('汇文明朝'), /页面尚未就绪/);
  state.page = {};
  state.fail = true;
  await assert.rejects(manager.ensureFontAvailable('汇文明朝'), /本地字体注册失败/);
  assert.equal(manager.isFontLoaded('汇文明朝'), false);
  state.fail = false;
  await manager.ensureFontAvailable('汇文明朝');
  assert.equal(manager.isFontLoaded('汇文明朝'), true, 'Failed tasks must allow another attempt');
  console.log('App font tests passed: local paths, aliases, no cloud, page scope, deduplication, retry');
})().catch(error => { console.error(error); process.exitCode = 1; });
