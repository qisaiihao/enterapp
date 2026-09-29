const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parse } = require('@babel/parser');
const root = path.join(__dirname, '..');
const quiet = { log() {}, warn() {}, error() {} };
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

function moduleFrom(source, imports = {}) {
  for (const node of parse(source, { sourceType: 'module' }).program.body.reverse()) {
    if (node.type === 'ImportDeclaration' || (node.type === 'ExportNamedDeclaration' && !node.declaration)) {
      source = source.slice(0, node.start) + source.slice(node.end);
    } else if (node.type === 'ExportDefaultDeclaration') {
      source = source.slice(0, node.start) + 'module.exports = ' + source.slice(node.declaration.start);
    } else if (node.type === 'ExportNamedDeclaration') {
      source = source.slice(0, node.start) + source.slice(node.declaration.start);
    }
  }
  const globals = { module: { exports: {} }, console: quiet, ...imports };
  vm.runInNewContext(source, globals);
  return globals.module.exports;
}

function backend() {
  const rows = Array.from({ length: 13 }, (_, i) => ({
    _id: `fav-${i}`, _openid: 'me', folderId: 'folder-a', postId: `post-${i}`, createTime: 100 - i
  }));
  rows.push({ _id: 'fav-b', _openid: 'me', folderId: 'folder-b', postId: 'post-b', createTime: 200 });
  rows.push({ _id: 'fav-other', _openid: 'other', folderId: 'folder-a', postId: 'post-other', createTime: 300 });
  const tables = {
    favorites: rows,
    posts: rows.map(row => ({ _id: row.postId, _openid: 'author', title: row.postId, content: '诗歌', createTime: 1, imageUrls: [] })),
    users: [{ _openid: 'author', nickName: '作者', avatarUrl: '' }]
  };
  const db = {
    command: { aggregate: {}, in: values => ({ in: values }) },
    collection(name) {
      let filters = {}, skip = 0, limit = 100, sortKey, direction;
      const query = {
        where(value) { filters = value; return query; },
        orderBy(key, dir) { sortKey = key; direction = dir; return query; },
        skip(value) { skip = value; return query; }, limit(value) { limit = value; return query; },
        async get() {
          let selected = tables[name].filter(row => Object.entries(filters).every(([key, value]) =>
            value && value.in ? value.in.includes(row[key]) : row[key] === value));
          if (sortKey) selected.sort((a, b) => (a[sortKey] - b[sortKey]) * (direction === 'desc' ? -1 : 1));
          return { data: structuredClone(selected.slice(skip, skip + limit)) };
        }
      };
      return query;
    }
  };
  const cloud = { init() {}, database: () => db, getWXContext: () => ({ OPENID: 'me' }) };
  const favorites = moduleFrom(read('functions/getMyProfileData/handlers/favorites.js'));
  const globals = { exports: {}, console: quiet, require(name) {
    if (name === './_lib/posts') return require('../functions/_shared/posts');
    if (name === 'wx-server-sdk') return cloud;
    if (name.includes('handlers/favorites')) return favorites;
    if (name.includes('handlers/drafts')) return { createDraftHandlers: () => ({}) };
    if (name.includes('request-context')) return { resolveOpenId: () => 'me' };
    if (name.includes('default-avatar')) return { ensureUserDefaultAvatar: async () => '' };
    throw new Error(name);
  } };
  vm.runInNewContext(read('functions/getMyProfileData/index.js'), globals);
  return globals.exports.main;
}

async function main() {
  const run = backend();
  const requests = [];
  let failure, direct = false;
  const cloudCall = async (name, payload, options) => {
    assert.equal(name, 'getMyProfileData');
    requests.push({ payload, options });
    if (failure instanceof Error) throw failure;
    const result = failure || await run(payload, {});
    return direct ? result : { result };
  };
  const wrapper = moduleFrom(read('api-cache/_shared/cloud-wrapper.js'), { cloudCall });
  const api = moduleFrom(read('api-cache/favorites.js'), { cloudCall, callCloudAndUnwrap: wrapper.callCloudAndUnwrap, captureFavoriteRead: () => () => true });
  const context = { $tcb: { app: true } };
  const query = { folderId: 'folder-a', pageSize: 10, context };
  const first = await api.getMyFavorites(query);
  assert.equal(first.length, 10);
  assert.equal(first[0].postId, 'post-0');
  assert.ok(first.every(row => row.folderId === 'folder-a' && row.favoriteId !== 'fav-other'));
  assert.equal(requests[0].options.context, context, 'App cloud instance is forwarded');
  assert.equal(requests[0].options.requireAuth, true);
  assert.equal(requests[0].payload.action, 'getFavoritesByFolder');
  assert.equal(requests[0].payload.folderId, 'folder-a');
  const second = await api.getMyFavorites({ ...query, page: 1 });
  assert.equal(second.length, 3);
  assert.equal(second[0].postId, 'post-10');
  assert.equal(requests.at(-1).payload.skip, 10);
  assert.equal(requests.at(-1).payload.limit, 10);
  assert.equal((await api.getMyFavorites({ ...query, page: 2 })).length, 0);
  assert.equal((await api.getMyFavorites({ ...query, folderId: 'folder-b' }))[0].postId, 'post-b');
  assert.equal((await api.getMyFavorites({ ...query, folderId: 'empty' })).length, 0);
  assert.equal((await api.getMyFavorites({ pageSize: 20, context })).length, 14, 'unscoped favorites still use the supported getAllFavorites action');
  direct = true;
  assert.equal((await api.getMyFavorites(query)).length, 10, 'direct cloud result is unwrapped too');

  const component = moduleFrom(read('pages-content/favorite-content/favorite-content.vue').match(/<script>([\s\S]*?)<\/script>/)[1], {
    captureFavoriteRead: () => () => true, favoriteRefresh: {}, getMyFavorites: api.getMyFavorites, paginationMixin: {}, postGalleryMixin: {}, FavoriteActionMenu: {},
    uni: { showToast() {} }
  });
  const page = { ...component.data(), folderId: 'folder-a', pageSize: 10, setData(data) { Object.assign(this, data); }, formatTime() { return '刚刚'; } };
  page.loadFavorites = component.methods.loadFavorites.bind(page);
  assert.equal((await page.loadFavorites({ page: 0, isRefresh: true })).hasMore, true);
  assert.equal(page.favorites.length, 10);
  assert.equal((await page.loadFavorites({ page: 1, isRefresh: false })).hasMore, false);
  assert.equal(page.favorites.length, 13);
  await page.loadFavorites({ page: 1, isRefresh: false });
  assert.equal(page.favorites.length, 13, 'repeated pages are deduplicated');
  page.folderId = 'folder-b';
  await page.loadFavorites({ page: 0, isRefresh: true });
  assert.equal(page.favorites.length, 1);
  assert.equal(page.favorites[0].postId, 'post-b');

  failure = { success: false, message: '获取收藏失败', error: '数据库查询失败' };
  await assert.rejects(api.getMyFavorites(query), /数据库查询失败/);
  failure = { success: true, userInfo: {} };
  await assert.rejects(api.getMyFavorites(query), /返回格式异常/);
  failure = new Error('连接失败');
  await assert.rejects(api.getMyFavorites(query), /连接失败/);
  failure = null;
  assert.equal((await api.getMyFavorites(query)).length, 10, 'failed request can be retried');

  const writes = [], events = [], notices = [];
  let completeWrite, rejectWrite;
  const mutationApi = moduleFrom(read('api-cache/favorite-actions.js') + '\nexport default { removeFavoriteRecord };', {
    captureFavoriteSession: () => ({ userId: 'me', isCurrent: () => true }),
    emitFavoriteChanged: value => events.push(value),
    callCloudAndUnwrap(name, data, options) {
      writes.push({ name, data, options });
      return new Promise((resolve, reject) => { completeWrite = resolve; rejectWrite = reject; });
    }, invalidateMyFavorites() {}
  });
  const actionsApi = moduleFrom(read('api-cache/profile-actions.js') + '\nexport default { removeFavorite };', { removeFavoriteRecord: mutationApi.removeFavoriteRecord });
  const menuComponent = moduleFrom(read('components/FavoriteActionMenu.vue').match(/<script>([\s\S]*?)<\/script>/)[1], {
    AppActionSheet: {}, FolderSelector: {}, removeFavorite: actionsApi.removeFavorite,
    getOpenid: () => 'me', emitFavoriteChanged: value => events.push(value),
    uni: { showLoading() {}, hideLoading() {}, showToast: value => notices.push(value) }
  });
  const profileSource = read('pages/profile/profile.vue').match(/<script>([\s\S]*?)<\/script>/)[1];
  const profileOptions = parse(profileSource, { sourceType: 'module' }).program.body.find(node => node.type === 'ExportDefaultDeclaration').declaration;
  const profileMethodsNode = profileOptions.properties.find(node => node.key.name === 'methods').value;
  const profileMethods = vm.runInNewContext(`(${profileSource.slice(profileMethodsNode.start, profileMethodsNode.end)})`, {});
  for (const [listName, methods, open] of [
    ['favoriteList', profileMethods, page => page.handleFavoriteActionMenu({ index: 0 })],
    ['favorites', component.methods, page => page.showFavoriteActions(page.favorites[0])]
  ]) {
    const owner = { ...methods, [listName]: [
      { _id: 'post-target', favoriteId: 'favorite-target' },
      { _id: 'post-other', favoriteId: 'favorite-other' },
      { _id: 'post-target', favoriteId: 'same-post-another-folder' }
    ] };
    open(owner);
    const menu = { ...menuComponent.data(), ...menuComponent.methods, target: owner.favoriteActionTarget,
      $emit(name, value) {
        if (name === 'close') this.target = owner.favoriteActionTarget = null;
        if (name === 'removed') owner.handleFavoriteRemoved(value);
      }
    };
    const pending = menu.onSelect(1);
    assert.equal(writes.at(-1).data.action, 'removeFromFavorite', 'use the supported singular backend action');
    assert.equal(writes.at(-1).data.favoriteId, 'favorite-target', 'send the collection record ID, not the post ID');
    assert.equal(writes.at(-1).options.context, menu, 'forward the App component context');
    const count = writes.length;
    menu.target = { favoriteId: 'favorite-other', postId: 'post-other' };
    await menu.onSelect(1);
    assert.equal(writes.length, count, 'repeated clicks cannot submit a second request');
    owner[listName].reverse();
    completeWrite({ success: true });
    await pending;
    assert.equal(owner[listName].length, 2);
    assert.ok(owner[listName].some(item => item.favoriteId === 'same-post-another-folder'), 'other folder records remain');
    assert.ok(owner[listName].every(item => item.favoriteId !== 'favorite-target'), 'remove by ID even after a list reorder');
    assert.equal(events.at(-1).postId, 'post-target', 'notify the original post, never the next row');

    open(owner);
    menu.target = owner.favoriteActionTarget;
    const beforeFailure = owner[listName].slice();
    const failed = menu.onSelect(1);
    rejectWrite(new Error('网络错误'));
    await failed;
    assert.deepEqual(owner[listName], beforeFailure, 'failed removal keeps the row available for retry');
    assert.equal(menu.isRemoving, false);
    assert.equal(notices.at(-1).title, '网络错误');

    open(owner);
    menu.target = owner.favoriteActionTarget;
    const expectedPostId = menu.target.postId;
    const beforeAdd = writes.length;
    await menu.onSelect(0);
    assert.equal(menu.folderPostId, expectedPostId, 'folder selector receives the post ID snapshot');
    assert.equal(writes.length, beforeAdd, 'opening the folder selector never removes the original favorite');
  }
  console.log('[test-favorite-loading] PASS: real handler/API/page integration, folder isolation, App context, response shapes, pagination, empty folders, errors and retry');
  console.log('[test-favorite-actions] PASS: both pages, record/post IDs, reordering, duplicate clicks, failure preservation and folder selection');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
