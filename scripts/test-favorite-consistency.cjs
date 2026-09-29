const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parse } = require('@babel/parser');
const root = path.join(__dirname, '..');
const tick = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };

function runtime() {
  let userId = 'a';
  const events = [], requests = [], storage = new Map(), listeners = new Map(), modules = new Map();
  let respond = async () => ({ success: true });
  const uni = {
    getStorageSync: key => storage.get(key), setStorageSync: (key, value) => storage.set(key, value),
    removeStorageSync: key => storage.delete(key), showToast() {},
    $on(name, fn) { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(fn); },
    $off(name, fn) { listeners.get(name)?.delete(fn); },
    $emit(name, value) { events.push({ name, value }); listeners.get(name)?.forEach(fn => fn(value)); }
  };
  const stubs = {
    'utils/app-state.js': { getOpenid: () => userId },
    'utils/cloudCall.js': { async cloudCall(name, data, options) { requests.push({ name, data, options }); return { result: await respond(name, data) }; } },
    '_utils/file-url-cache.js': { default: {} },
    'utils/appBackground.js': { normalizeAppBackgroundMode() {} },
    'cache/stores/avatar.js': { default: {} }
  };
  function load(file) {
    if (stubs[file]) return stubs[file];
    if (modules.has(file)) return modules.get(file);
    let source = fs.readFileSync(path.join(root, file), 'utf8');
    if (file.endsWith('.vue')) source = source.match(/<script>([\s\S]*?)<\/script>/)[1];
    const exports = {}, suffix = [];
    modules.set(file, exports);
    for (const node of parse(source, { sourceType: 'module' }).program.body.reverse()) {
      let replacement;
      if (node.type === 'ImportDeclaration') {
        const dependency = node.source.value;
        replacement = node.specifiers.map(spec => {
          const key = spec.type === 'ImportDefaultSpecifier' ? 'default' : spec.imported.name;
          return `const ${spec.local.name} = require(${JSON.stringify(dependency)})[${JSON.stringify(key)}];`;
        }).join('\n');
      } else if (node.type === 'ExportDefaultDeclaration') replacement = 'exports.default = ' + source.slice(node.declaration.start, node.declaration.end);
      else if (node.type === 'ExportNamedDeclaration') {
        if (node.declaration) {
          replacement = source.slice(node.declaration.start, node.declaration.end);
          const names = node.declaration.id ? [node.declaration.id.name] : node.declaration.declarations.map(d => d.id.name);
          names.forEach(name => suffix.push(`exports.${name} = ${name};`));
        } else { replacement = ''; node.specifiers.forEach(spec => suffix.push(`exports.${spec.exported.name} = ${spec.local.name};`)); }
      }
      if (replacement !== undefined) source = source.slice(0, node.start) + replacement + source.slice(node.end);
    }
    vm.runInNewContext(source + '\n' + suffix.join('\n'), {
      exports, uni, console: { log() {}, warn() {}, error() {} }, Promise, setTimeout, clearTimeout,
      require(dependency) {
        let target = dependency.startsWith('@/') ? dependency.slice(2) : path.posix.normalize(path.posix.join(path.posix.dirname(file), dependency));
        if (!path.posix.extname(target)) target += '.js';
        return load(target);
      }
    }, { filename: file });
    return exports;
  }
  return { load, uni, events, requests, setUser: value => { userId = value; }, respond: fn => { respond = fn; } };
}

async function main() {
  const r = runtime();
  const manager = r.load('cache/core/manager.js').default;
  const actions = r.load('api-cache/favorite-actions.js');
  const state = r.load('cache/favorites.js');
  const mine = r.load('api-cache/my.js');
  const other = r.load('api-cache/user-profile.js');
  const cached = manager.namespace('me:favorites', { persistent: true });
  const publicA = manager.namespace('userFavorites:a', { persistent: true });
  const publicB = manager.namespace('userFavorites:b', { persistent: true });
  const details = manager.namespace('posts:detail', { persistent: true });
  const home = manager.namespace('posts:home', { persistent: true });
  function seed() {
    cached.set('user:a:page:0:size:10', [{ favoriteId: 'one' }]);
    cached.set('user:a:page:1:size:10', [{ favoriteId: 'two' }]);
    cached.set('user:b:page:0:size:10', [{ favoriteId: 'b' }]);
    publicA.set('page:0', [{}]); publicB.set('page:0', [{}]);
    details.set(JSON.stringify(['post', 'a']), { post: { _id: 'post', isFavorited: true } });
    home.set('page:0', [{ _id: 'post', title: 'unchanged' }]);
  }
  seed();
  const before = state.captureFavoriteRead();
  const context = { app: 'context' };
  await actions.removeFavoriteRecord('one', context, { postId: 'post', folderId: 'folder' });
  assert.equal(before(), false);
  assert.equal(cached.get('user:a:page:0:size:10'), undefined);
  assert.equal(cached.get('user:a:page:1:size:10'), undefined, 'deletion shifts later page boundaries');
  assert.ok(cached.get('user:b:page:0:size:10'));
  assert.equal(publicA.get('page:0'), undefined); assert.ok(publicB.get('page:0'));
  assert.equal(details.get(JSON.stringify(['post', 'a'])), undefined);
  assert.ok(home.get('page:0'), 'unrelated home content does not refetch');
  assert.equal(r.requests.at(-1).options.context, context);
  assert.equal(r.events.at(-1).value.favoriteId, 'one');
  assert.equal(r.events.at(-1).value.favored, undefined, 'one record removed does not imply no other folder contains the post');

  seed(); const eventCount = r.events.length;
  r.respond(async () => ({ success: false, message: 'rejected' }));
  await assert.rejects(actions.addFavorite('post', 'folder', context), /rejected/);
  assert.equal(r.events.length, eventCount); assert.ok(cached.get('user:a:page:0:size:10'));
  r.respond(async () => { throw new Error('offline'); });
  await assert.rejects(actions.deleteFavoriteFolder('folder', context), /offline/);
  assert.equal(r.events.length, eventCount);
  r.respond(async () => ({ success: true, favoriteId: 'added' }));
  await actions.addFavorite('post', 'folder', context);
  assert.equal(r.events.length, eventCount + 1); assert.equal(r.events.at(-1).value.favored, true);

  seed(); await actions.deleteFavoriteFolder('folder', context);
  assert.equal(publicA.get('page:0'), undefined);
  assert.equal(details.keys().length, 0, 'deleting a folder invalidates potentially affected details');
  const itemsCurrent = state.captureFavoriteRead();
  const foldersCurrent = state.captureFavoriteRead(undefined, 'folders');
  await actions.createFavoriteFolder('new', '', context);
  assert.equal(itemsCurrent(), true); assert.equal(foldersCurrent(), false);

  // Old reads can settle, but cannot repopulate cache or be displayed by the caller.
  manager.clearAll();
  const oldRead = deferred(); let calls = 0;
  r.respond(async (name, data) => data.action === 'getAllFavorites'
    ? (++calls === 1 ? oldRead.promise : { success: true, favorites: [{ favoriteId: 'fresh' }] })
    : { success: true });
  const old = mine.getMyFavorites({ page: 0, context });
  const rejectedOld = assert.rejects(old, error => error.code === 'FAVORITE_STALE');
  await tick(); await actions.removeFavoriteRecord('one', context, { postId: 'post' });
  const fresh = await mine.getMyFavorites({ page: 0, context });
  oldRead.resolve({ success: true, favorites: [{ favoriteId: 'deleted' }] });
  await rejectedOld;
  assert.equal(fresh[0].favoriteId, 'fresh');
  assert.equal((await mine.getMyFavorites({ page: 0, context }))[0].favoriteId, 'fresh');
  assert.equal(calls, 2, 'fresh read reused without a third request');

  const pendingWrite = deferred(); r.respond(() => pendingWrite.promise);
  const count = r.events.length;
  const writing = actions.addFavorite('post', 'folder', context);
  const rejectedWrite = assert.rejects(writing, error => error.code === 'FAVORITE_STALE');
  r.setUser('b'); manager.clearAll(); r.setUser('a');
  pendingWrite.resolve({ success: true }); await rejectedWrite;
  assert.equal(r.events.length, count, 'A -> B -> A cannot report old write to the new session');
  r.respond(async () => ({ success: true, favorites: [] }));
  r.setUser(''); assert.deepEqual(Array.from(await other.getUserFavorites({ userId: 'a', context })), [], 'guest public reads remain supported');
  r.setUser('a');

  // Real refresh mixin: hidden pages defer, events coalesce, loading pages retry after settle.
  const mixin = r.load('mixins/favoriteRefresh.js').default;
  let refreshes = 0;
  const page = { ...mixin.data(), ...mixin.methods, isLoading: false, isLoadingMore: false,
    async refreshFavoritesAfterChange() { refreshes++; } };
  mixin.onLoad.call(page);
  r.uni.$emit('favorite-changed', { userId: 'a' }); await tick(); assert.equal(refreshes, 0);
  mixin.onShow.call(page); await tick(); assert.equal(refreshes, 1);
  r.uni.$emit('favorite-changed', { userId: 'a' }); r.uni.$emit('favorite-changed', { userId: 'a' });
  await tick(); assert.equal(refreshes, 2);
  page.isLoading = true; r.uni.$emit('favorite-changed', { userId: 'a' }); await tick(); assert.equal(refreshes, 2);
  page.isLoading = false; mixin.watch.isLoading.call(page, false); await tick(); assert.equal(refreshes, 3);
  r.uni.$emit('favorite-changed', { userId: 'b' }); await tick(); assert.equal(refreshes, 3);
  mixin.onUnload.call(page); r.uni.$emit('favorite-changed', { userId: 'a' }); await tick(); assert.equal(refreshes, 3);

  // Exercise the real folder page loader + pagination controller with Vue watchers.
  const { reactive, watch, nextTick } = require('vue');
  const source = fs.readFileSync(path.join(root, 'pages-content/favorite-content/favorite-content.vue'), 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
  const definition = parse(source, { sourceType: 'module' }).program.body.find(node => node.type === 'ExportDefaultDeclaration').declaration;
  const methodsNode = definition.properties.find(node => node.key.name === 'methods').value;
  const methods = vm.runInNewContext(`(${source.slice(methodsNode.start, methodsNode.end)})`, {
    getMyFavorites: r.load('api-cache/favorites.js').getMyFavorites,
    captureFavoriteRead: state.captureFavoriteRead, staleFavoriteError: state.staleFavoriteError,
    uni: r.uni, console: { log() {}, error() {} }
  });
  const pagination = r.load('mixins/pagination.js').default;
  const folderPage = reactive({ ...mixin.data(), ...pagination.data(), ...mixin.methods, ...pagination.methods, ...methods,
    folderId: 'folder', favorites: [], pageSize: 10,
    setData(values) { Object.assign(this, values); }, formatTime() { return ''; }
  });
  const stop = Object.entries(mixin.watch).map(([key, fn]) => watch(() => folderPage[key], value => fn.call(folderPage, value)));
  mixin.onLoad.call(folderPage); mixin.onShow.call(folderPage);
  const slow = deferred(); let folderCalls = 0;
  r.respond(async (name, data) => data.action === 'getFavoritesByFolder'
    ? (++folderCalls === 1 ? slow.promise : { success: true, favorites: [{ _id: 'remaining', favoriteId: 'other-folder-record' }] })
    : { success: true });
  const first = folderPage.initPagination(folderPage.loadFavorites, { pageSize: 10 });
  const cancelled = assert.rejects(first, error => error.code === 'FAVORITE_STALE');
  await tick(); await actions.removeFavoriteRecord('one', context, { postId: 'post', folderId: 'folder' });
  slow.resolve({ success: true, favorites: [{ _id: 'deleted', favoriteId: 'one' }] });
  await cancelled; await tick(); await nextTick(); await tick(); await nextTick();
  assert.equal(folderCalls, 2, 'mutation during initial load queues exactly one refresh');
  assert.equal(folderPage.favorites[0]._id, 'remaining');
  assert.equal(folderPage.page, 1, 'restart from first page after deletion, rather than skipping shifted rows');
  assert.equal(folderPage.hasMore, false);
  mixin.onUnload.call(folderPage); stop.forEach(fn => fn());

  console.log('[test-favorite-consistency] PASS: successful writes only, multi-folder semantics, scoped invalidation, page boundaries, stale reads, account switches, guest reads, hidden-page refresh and event coalescing');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
