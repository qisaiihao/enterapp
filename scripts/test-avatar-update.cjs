const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parse } = require('@babel/parser');
const root = path.join(__dirname, '..');
const quiet = { log() {}, warn() {}, error() {} };
function load(file, globals = {}, names = []) {
  let source = fs.readFileSync(path.join(root, file), 'utf8');
  if (file.endsWith('.vue')) source = source.match(/<script>([\s\S]*?)<\/script>/)[1];
  const imports = {};
  for (const node of parse(source, { sourceType: 'module' }).program.body.reverse()) {
    if (node.type === 'ImportDeclaration') {
      node.specifiers.forEach(spec => { imports[spec.local.name] = {}; });
      source = source.slice(0, node.start) + source.slice(node.end);
    } else if (node.type === 'ExportNamedDeclaration') {
      source = source.slice(0, node.start) + source.slice(node.declaration ? node.declaration.start : node.end);
    } else if (node.type === 'ExportDefaultDeclaration') {
      source = source.slice(0, node.start) + 'module.exports = ' + source.slice(node.declaration.start);
    }
  }
  if (names.length) source += `\nmodule.exports = { ${names.join(', ')} };`;
  const scope = { ...imports, console: quiet, module: { exports: {} }, setTimeout: () => 0, clearTimeout() {}, ...globals };
  vm.runInNewContext(source, scope, { filename: file });
  return scope.module.exports;
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const drain = async () => { for (let i = 0; i < 40; i++) await Promise.resolve(); };
function runtime() {
  const clock = { now: 10000 };
  const storage = new Map(), listeners = new Map(), reads = [];
  const app = { globalData: { openid: 'me', userInfo: { _openid: 'me', avatarUrl: 'cloud://old', nickName: '诗人' } } };
  const uni = {
    getStorageSync: key => storage.get(key), setStorageSync: (key, value) => storage.set(key, value), removeStorageSync: key => storage.delete(key),
    $on: (name, callback) => { listeners.set(name, [...(listeners.get(name) || []), callback]); },
    $emit: (name, value) => { (listeners.get(name) || []).forEach(fn => fn(value)); },
    showLoading() {}, hideLoading() {}, showToast() {}, navigateBack() {}
  };
  const base = { uni, Date: { now: () => clock.now }, getApp: () => app, normalizeAppBackgroundMode: () => '' };
  const state = load('utils/app-state.js', base, ['getOpenid', 'getAppState', 'patchAppState']);
  const cacheManager = load('cache/core/manager.js', base);
  const fileUrlCache = { getTempUrl: async id => `https://cdn/${id.slice(8)}`, getTempUrls: async ids => Object.fromEntries(ids.map(id => [id, `https://cdn/${id.slice(8)}`])) };
  const api = load('api-cache/my.js', { ...base, ...state, cacheManager, fileUrlCache,
    avatarCache: { getSavedAvatar: userId => avatarCache.getSavedAvatar(userId) }, callCloudAndUnwrap: () => {
    const request = deferred(); reads.push(request); return request.promise;
  } }, ['getMyInfo', 'invalidateMyInfo']);
  const { invalidateMyProfile } = load('api-cache/profile.js', { ...base, cacheManager }, ['invalidateMyProfile']);
  const { invalidateUserInfo } = load('api-cache/user-profile.js', { ...base, cacheManager }, ['invalidateUserInfo']);
  const { createCachedBatchReader } = load('cache/core/batch-reader.js', {}, ['createCachedBatchReader']);
  const avatarCache = load('cache/stores/avatar.js', { ...base, cacheManager, fileUrlCache, createCachedBatchReader,
    cloudCall: () => { throw new Error('Saved avatar should not need a profile lookup'); } });
  const { syncSavedProfileAvatar } = load('utils/profileAvatarUpdate.js', { ...base, ...state, ...api, avatarCache, invalidateMyProfile, invalidateUserInfo }, ['syncSavedProfileAvatar']);
  const { emitAvatarUpdated } = load('utils/events.js', base, ['emitAvatarUpdated']);
  const globals = { ...base, ...state, ...api, syncSavedProfileAvatar, emitAvatarUpdated };
  const definition = load('pages/profile/profile.vue', globals);
  const page = { ...definition.methods, userInfo: { ...app.globalData.userInfo }, pendingRefreshToken: 0,
    setData(value) { Object.assign(this, value); }, normalizeProfileUserInfo: value => value, updateGrowthStats() {} };
  page.ensureGlobalEventBindings();
  function editor({ success = true, sticker = false } = {}) {
    const options = load('pages-user/profile-edit/profile-edit.vue', { ...globals,
      STICKER_AVATAR_PATHS: [], getCurrentPlatform: () => 'app', getCurrentPages: () => [],
      normalizeStickerAvatarPath: value => value, isStickerAvatar: value => String(value).startsWith('/static/'),
      uploadFile: async () => 'cloud://new', writeLocalGrowthStatsVisibility() {}
    });
    const edit = { ...options.data(), ...options.methods, hasChanges: true,
      setData(value) { Object.assign(this, value); }, moderateProfileContent: async () => ({ passed: true }),
      callCloudFunction: async () => ({ result: { success } }) };
    edit.originalData.avatarUrl = 'cloud://old';
    edit.avatarUrl = sticker ? '/static/new-avatar.png' : '/temp/new.jpg';
    edit.tempAvatarPath = sticker ? null : '/temp/new.jpg';
    return edit;
  }
  return { storage, app, cacheManager, avatarCache, api, reads, page, editor, syncSavedProfileAvatar, clock };
}

(async () => {
  const app = runtime();
  for (const [ns, key] of [['profiles', 'me'], ['profiles:user', 'me']]) app.cacheManager.namespace(ns).set(key, { avatarUrl: 'old' });
  const oldRequest = app.page.fetchUserProfileFast();
  await drain();
  await app.editor().onSaveChanges();
  assert.equal(app.page.userInfo.avatarUrl, '/temp/new.jpg', '确认保存后无需等待重新获取资料就显示新头像');
  assert.equal(app.app.globalData.userInfo.avatarUrl, 'cloud://new');
  assert.equal(app.storage.get('userInfo').avatarUrl, 'cloud://new', '持久层不保存临时选图路径');
  assert.equal((await app.avatarCache.getUserAvatar('me')).avatarUrl, 'https://cdn/new');
  assert.equal(app.cacheManager.namespace('profiles').get('me'), undefined);
  assert.equal(app.cacheManager.namespace('profiles:user').get('me'), undefined);
  assert.equal(app.reads.length, 2);
  app.reads[0].resolve({ userInfo: { avatarUrl: 'cloud://old' } });
  await oldRequest;
  assert.equal(app.page.userInfo.avatarUrl, '/temp/new.jpg', '保存前发起的慢请求不能覆盖新头像');
  app.reads[1].resolve({ userInfo: { _openid: 'me', avatarUrl: 'cloud://new' } });
  await drain();
  assert.equal(app.page.userInfo.avatarUrl, 'https://cdn/new');
  assert.equal((await app.api.getMyInfo()).avatarUrl, 'https://cdn/new');

  app.api.invalidateMyInfo();
  const returning = app.page.fetchUserProfileFast();
  await drain();
  app.reads[2].resolve({ userInfo: { _openid: 'me', avatarUrl: 'cloud://old', bio: '最新简介' } });
  await returning;
  assert.equal(app.page.userInfo.avatarUrl, 'https://cdn/new', '保存后重新发起的强刷也不能覆盖已确认的新头像');
  assert.equal(app.page.userInfo.bio, '最新简介', '其他资料仍正常刷新');
  assert.equal((await app.api.getMyInfo()).avatarUrl, 'https://cdn/new', '命中旧资料缓存仍保留新头像');
  app.clock.now += 5 * 60 * 1000 + 1;
  assert.equal(app.avatarCache.getSavedAvatar('me'), undefined, '近期保存保护不会永久屏蔽远端头像更新');
  assert.equal((await app.api.getMyInfo()).avatarUrl, 'https://cdn/new', '保护过期后已修正的缓存不能退回旧头像');

  const failed = runtime();
  failed.avatarCache.updateUserAvatar('me', failed.app.globalData.userInfo);
  await failed.editor({ success: false }).onSaveChanges();
  assert.equal(failed.page.userInfo.avatarUrl, 'cloud://old', '服务端保存失败不更新头像');
  assert.equal((await failed.avatarCache.getUserAvatar('me')).avatarUrl, 'https://cdn/old');
  assert.equal(failed.reads.length, 0);

  const sticker = runtime();
  await sticker.editor({ sticker: true }).onSaveChanges();
  assert.equal(sticker.page.userInfo.avatarUrl, '/static/new-avatar.png');
  assert.equal(sticker.storage.get('userInfo').avatarFileID, '', '默认头像不能继续引用旧云文件 ID');
  assert.equal((await sticker.avatarCache.getUserAvatar('me')).avatarUrl, '/static/new-avatar.png');
  sticker.reads[0].reject(new Error('offline'));
  await drain();
  assert.equal(sticker.page.userInfo.avatarUrl, '/static/new-avatar.png', '后台刷新失败仍显示已保存的新头像');
  sticker.app.globalData.openid = 'another';
  assert.equal(sticker.syncSavedProfileAvatar('me', 'cloud://late'), false, '切换账号后不污染新会话');
  console.log('PASS avatar save: immediate preview, cache/session synchronization, stale responses, defaults, failures and account isolation');
})().catch(error => { console.error(error); process.exitCode = 1; });
