const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');

const root = path.join(__dirname, '..');
const helperUsers = ['registerUser', 'createUser', 'getPortfolioFolders', 'ensureDefaultPortfolio'];

// 刻意不提供旧表：只要任何调用仍访问 portfolios，整条业务链就会失败。
function runtime(seed = {}, caller = '') {
  const tables = Object.fromEntries([
    'users', 'posts', 'portfolio_folders', 'portfolio_items', 'comments', 'favorites',
    'messages', 'images', 'votes_log', 'follows', 'blocks'
  ].map(name => [name, structuredClone(seed[name] || [])]));
  let nextId = 0;
  let failedFolderWrites = 0;
  let legacyAccesses = 0;
  const matches = (row, filter) => Object.entries(filter).every(([key, value]) => {
    if (value && value.op === 'in') return value.values.includes(row[key]);
    if (value && value.op === 'neq') return row[key] !== value.value;
    return row[key] === value;
  });
  const db = {
    command: { in: values => ({ op: 'in', values }), neq: value => ({ op: 'neq', value }) },
    serverDate: () => new Date(),
    collection(name) {
      if (name === 'portfolios') legacyAccesses++;
      if (!tables[name]) throw new Error(`Collection does not exist: ${name}`);
      let filter = {}, offset = 0, size = Infinity, sorting, projection, documentId;
      const allRows = () => tables[name].filter(row => matches(row, filter));
      const query = {
        where(value) { filter = value; return query; },
        limit(value) { size = value; return query; },
        skip(value) { offset = value; return query; },
        orderBy(key, direction) { sorting = [key, direction]; return query; },
        field(value) { projection = value; return query; },
        doc(id) { documentId = id; filter = { _id: id }; return query; },
        async get() {
          let rows = allRows();
          if (sorting) rows.sort((a, b) => {
            const [key, direction] = sorting;
            return (a[key] > b[key] ? 1 : a[key] < b[key] ? -1 : 0) * (direction === 'desc' ? -1 : 1);
          });
          rows = rows.slice(offset, offset + size);
          if (projection) rows = rows.map(row => Object.fromEntries(
            Object.entries(row).filter(([key]) => key === '_id' || projection[key])
          ));
          return { data: structuredClone(documentId ? rows[0] : rows) };
        },
        async count() { return { total: allRows().length }; },
        async add({ data }) {
          if (name === 'portfolio_folders' && failedFolderWrites > 0) {
            failedFolderWrites--;
            throw new Error('injected write failure');
          }
          const id = data._id || `generated-${++nextId}`;
          if (tables[name].some(row => row._id === id)) throw new Error('duplicate _id');
          tables[name].push(structuredClone({ ...data, _id: id }));
          return { _id: id };
        },
        async update({ data }) {
          const rows = allRows();
          for (const row of rows) Object.assign(row, structuredClone(data));
          return { stats: { updated: rows.length } };
        },
        async remove() {
          const rows = allRows();
          tables[name] = tables[name].filter(row => !rows.includes(row));
          return { stats: { removed: rows.length } };
        }
      };
      return query;
    }
  };
  return {
    tables,
    get legacyAccesses() { return legacyAccesses; },
    failNextFolderWrite() { failedFolderWrites++; },
    load(name) {
      const filename = path.join(root, 'functions', name, 'index.js');
      const localRequire = createRequire(filename);
      const sandbox = {
        exports: {}, console: { log() {}, warn() {}, error() {} },
        require(moduleName) {
          if (moduleName === 'wx-server-sdk') return {
            init() {}, database: () => db, getWXContext: () => ({ OPENID: caller })
          };
          return localRequire(moduleName);
        }
      };
      vm.runInNewContext(fs.readFileSync(filename, 'utf8'), sandbox, { filename });
      return event => sandbox.exports.main(event, {});
    }
  };
}

const userEvent = openid => ({ openid, poemId: `poem-${openid}`, password: 'test-only', nickName: '测试用户', avatarFileID: '/static/avatar.png' });
const poem = { _id: 'poem', _openid: 'reader', isPoem: true, isOriginal: true, createTime: new Date() };

async function main() {
  const helper = fs.readFileSync(path.join(root, 'functions/_lib/ensure-default-portfolio.js'), 'utf8');
  for (const name of helperUsers) {
    assert.equal(fs.readFileSync(path.join(root, 'functions', name, '_lib/ensure-default-portfolio.js'), 'utf8'), helper,
      `${name} must include the same helper in its independent deployment package`);
  }

  for (const entry of ['registerUser', 'createUser']) {
    for (const caller of ['', 'reader']) {
      const app = runtime({ posts: [poem] }, caller);
      const registered = await app.load(entry)(userEvent('reader'));
      assert.equal(registered.success, true);
      assert.equal(app.tables.portfolio_folders.length, 1, `${entry} must initialize the table used by the UI`);
      if (registered.userInfo) assert.equal(registered.userInfo.password, undefined);
      const folder = app.tables.portfolio_folders[0];
      assert.equal(folder.isDefault, true);
      assert.equal(folder.isPublic, true, 'registration keeps the effective visibility of UI-created defaults');
      assert.equal(folder.itemCount, 0);
      assert.equal(folder.postCount, 0);
      const list = await app.load('getPortfolioFolders')({ openid: 'reader' });
      assert.equal(list.success, true);
      assert.equal(list.folders[0]._id, folder._id);
      assert.equal(app.tables.portfolio_folders.length, 1);
      assert.equal((await app.load('addToPortfolio')({ openid: 'reader', folderId: folder._id, postId: 'poem' })).success, true);
      const items = await app.load('getPortfolioItems')({ openid: 'reader', folderId: folder._id, idsOnly: true });
      assert.equal(items.success, true);
      assert.deepEqual(Array.from(items.postIds), ['poem']);
      assert.equal(folder.itemCount, 1);
      assert.equal((await app.load('getPortfolios')({ openid: 'reader' })).portfolios[0].itemCount, 1);
      assert.equal(app.legacyAccesses, 0);
    }

    const savedFolder = { _id: 'custom', _openid: 'reader', name: '自己的名字', isPublic: false, itemCount: 7, postCount: 7 };
    for (const users of [[], [{ _id: 'user', _openid: 'reader' }]]) {
      const app = runtime({ users, portfolio_folders: [savedFolder] });
      assert.equal((await app.load(entry)(userEvent('reader'))).success, true);
      assert.deepEqual(app.tables.portfolio_folders, [savedFolder], 'existing folder and its contents/visibility must survive registration');
      assert.equal(app.legacyAccesses, 0);
    }

    const existing = runtime({ users: [{ _id: 'user', _openid: 'reader' }] });
    assert.equal((await existing.load(entry)(userEvent('reader'))).success, true);
    assert.equal(existing.tables.portfolio_folders.length, 1, 'completing an existing account also repairs a missing default');

    const recovering = runtime();
    recovering.failNextFolderWrite();
    assert.equal((await recovering.load(entry)(userEvent('reader'))).success, true, 'folder failure must not discard a saved account');
    assert.equal(recovering.tables.portfolio_folders.length, 0);
    assert.equal((await recovering.load('getPortfolioFolders')({ openid: 'reader' })).success, true);
    assert.equal(recovering.tables.portfolio_folders.length, 1, 'opening the list repairs a previous initialization failure');

    const concurrent = runtime();
    const results = await Promise.all([
      concurrent.load(entry)(userEvent('reader')),
      ...Array.from({ length: 8 }, () => concurrent.load('getPortfolioFolders')({ openid: 'reader' })),
      concurrent.load('ensureDefaultPortfolio')({ openid: 'reader' })
    ]);
    assert.ok(results.every(result => result.success));
    assert.equal(concurrent.tables.portfolio_folders.length, 1, 'concurrent initialization must insert one default');
    assert.equal(concurrent.legacyAccesses, 0);
  }

  for (const caller of ['', 'reader']) {
    const covers = runtime({ portfolio_folders: [
      { _id: 'default', _openid: 'reader', name: '我的作品集', isDefault: true, coverUrl: 'cloud://old' },
      { _id: 'custom', _openid: 'reader', name: '自建集', coverUrl: 'cloud://custom' },
      { _id: 'foreign', _openid: 'other', name: '别人的集', coverUrl: 'cloud://foreign' }
    ] }, caller);
    const update = covers.load('updatePortfolioFolder');
    assert.equal((await update({ openid: 'reader', folderId: 'default', name: '我的作品集', coverUrl: 'cloud://new' })).success, true,
      'the default folder can replace its cover without renaming');
    assert.equal(covers.tables.portfolio_folders[0].coverUrl, 'cloud://new');
    assert.equal(covers.tables.portfolio_folders[0].isDefault, true);
    const beforeRejectedEdits = structuredClone(covers.tables.portfolio_folders);
    assert.equal((await update({ openid: 'reader', folderId: 'custom', name: '我的作品集', coverUrl: 'cloud://blocked' })).success, false);
    assert.equal((await update({ openid: 'reader', folderId: 'default', name: '自建集', coverUrl: 'cloud://blocked' })).success, false);
    assert.equal((await update({ openid: 'reader', folderId: 'foreign', name: '别人的集', coverUrl: 'cloud://blocked' })).success, false);
    assert.deepEqual(covers.tables.portfolio_folders, beforeRejectedEdits, 'reserved names, duplicates and ownership must still be enforced');
  }

  const batch = runtime({ users: [{ _id: 'u1', _openid: 'one' }, { _id: 'u2', _openid: 'two' }] });
  const ensure = batch.load('ensureDefaultPortfolio');
  assert.equal((await ensure({ mode: 'batch' })).created, 2);
  assert.equal((await ensure({ mode: 'batch' })).alreadyHas, 2);
  assert.equal((await ensure({ openid: 'one' })).hasPortfolios, true);
  assert.equal(batch.tables.portfolio_folders[0].isPublic, false, 'explicit private backfill keeps its existing visibility');

  const legacy = runtime();
  const manual = await legacy.load('createPortfolio')({ openid: 'reader', name: ' 自建集 ' });
  assert.equal(manual.success, true);
  assert.equal((await legacy.load('getPortfolioFolders')({ openid: 'reader' })).folders[0]._id, manual.portfolio._id);
  assert.equal((await legacy.load('createPortfolioFolder')({ openid: 'reader', folderName: '自建集' })).success, false);
  assert.equal((await legacy.load('createPortfolio')({ openid: 'reader', name: '自建集' })).code, 'DUPLICATE_NAME');
  const current = await legacy.load('createPortfolioFolder')({ openid: 'reader', folderName: '新接口创建' });
  assert.equal(current.success, true);
  assert.equal((await legacy.load('createPortfolio')({ openid: 'reader', name: '新接口创建' })).code, 'DUPLICATE_NAME');
  await legacy.load('addToPortfolio')({ openid: 'reader', postId: 'poem', folderId: current.folderId });
  const page = await legacy.load('getPortfolios')({ openid: 'reader', limit: 1 });
  assert.equal(page.total, 2);
  assert.equal(page.portfolios.length, 1);
  assert.equal(page.hasMore, true);
  const list = await legacy.load('getPortfolios')({ openid: 'reader' });
  assert.equal(list.portfolios.find(folder => folder._id === current.folderId).itemCount, 1);
  assert.equal(legacy.legacyAccesses, 0);

  const binding = runtime({
    users: [{ _id: 'user', _openid: 'old', poemId: 'bind-me' }],
    portfolio_folders: [{ _id: 'keep-folder-id', _openid: 'old', name: '已保存', isPublic: false }],
    // 超过批次大小，验证循环不会遗漏关联记录。
    portfolio_items: Array.from({ length: 1001 }, (_, index) => ({ _id: `item-${index}`, _openid: 'old', folderId: 'keep-folder-id', postId: `p-${index}` }))
      .concat({ _id: 'unrelated', _openid: 'other', folderId: 'other-folder', postId: 'other-poem' })
  }, 'wechat');
  const bound = await binding.load('bindWechatOpenid')({ oldOpenid: 'old', poemId: 'bind-me' });
  assert.equal(bound.success, true);
  assert.equal(bound.updateResults.portfolios, 1);
  assert.equal(bound.updateResults.portfolio_items, 1001);
  assert.equal(binding.tables.portfolio_folders[0]._id, 'keep-folder-id');
  assert.equal(binding.tables.portfolio_folders[0].isPublic, false);
  assert.equal(binding.tables.portfolio_items.find(item => item._id === 'unrelated')._openid, 'other');
  const first = await binding.load('getPortfolioItems')({ folderId: 'keep-folder-id', idsOnly: true, limit: 1000 });
  const last = await binding.load('getPortfolioItems')({ folderId: 'keep-folder-id', idsOnly: true, skip: 1000, limit: 1000 });
  assert.equal(first.postIds.length + last.postIds.length, 1001, 'all saved poems remain reachable after account binding');
  assert.equal(binding.legacyAccesses, 0);

  console.log('[test-portfolio-tables] PASS: registration, App/WeChat add/read, default covers, existing folders, failure recovery, concurrent defaults, batch ensure, compatible endpoints and account binding');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
