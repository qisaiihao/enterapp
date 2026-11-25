const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parse } = require('@babel/parser');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
const quiet = { log() {}, warn() {}, error() {} };
const groups = {
  like_all: ['like', 'favorite'],
  feedback_report_all: ['feedback', 'feedback_reply', 'feedback_detail_requested', 'feedback_processed',
    'post_report_new', 'post_report_handled', 'post_report_dismissed']
};

function loadModule(file, globals = {}, named = []) {
  let source = read(file);
  if (file.endsWith('.vue')) source = source.match(/<script>([\s\S]*?)<\/script>/)[1];
  const bindings = {};
  for (const node of parse(source, { sourceType: 'module' }).program.body.slice().reverse()) {
    if (node.type === 'ImportDeclaration') {
      for (const binding of node.specifiers) bindings[binding.local.name] = () => {};
      source = source.slice(0, node.start) + source.slice(node.end);
    } else if (node.type === 'ExportNamedDeclaration') {
      source = source.slice(0, node.start) + source.slice(node.declaration ? node.declaration.start : node.end);
    } else if (node.type === 'ExportDefaultDeclaration') {
      source = source.slice(0, node.start) + 'module.exports = ' + source.slice(node.declaration.start);
    }
  }
  if (named.length) source += `\nmodule.exports = { ${named.join(', ')} };`;
  const sandbox = { ...bindings, ...globals, module: { exports: {} }, getApp: () => ({}), console: quiet };
  vm.runInNewContext(source, sandbox, { filename: file });
  return sandbox.module.exports;
}

function createPage(definition) {
  const page = definition.data();
  for (const [name, method] of Object.entries(definition.methods)) page[name] = method.bind(page);
  for (const name of ['onShow', 'onPullDownRefresh']) page[name] = definition[name].bind(page);
  return Object.assign(page, {
    setData(updates) { Object.assign(this, updates); },
    checkFollowStatus() {},
    markMessagesAsRead() {}
  });
}

function createInbox() {
  const messages = [];
  const types = [...groups.like_all, ...groups.feedback_report_all, 'comment', 'follow', 'content_review_new'];
  for (let index = 0; index < 52; index++) {
    messages.push({ _id: `message-${index}`, type: types[index % types.length], toUserId: 'viewer',
      fromUserId: 'sender', isRead: index % 3 === 0, createTime: index + 1 });
  }
  messages.push({ _id: 'foreign', type: 'favorite', toUserId: 'other', fromUserId: 'sender',
    isRead: false, createTime: 999 });
  messages.push({ _id: 'legacy-unread', type: 'like', toUserId: 'viewer', fromUserId: 'sender',
    createTime: 998 });
  const matches = (row, filter) => Object.entries(filter).every(([key, value]) => {
    if (value && value.in) return value.in.includes(row[key]);
    if (value && Object.prototype.hasOwnProperty.call(value, 'neq')) return row[key] !== value.neq;
    return row[key] === value;
  });
  const db = {
    command: { in: values => ({ in: values }), neq: value => ({ neq: value }) },
    collection(name) {
      const rows = name === 'messages' ? messages : [{ _openid: 'sender', nickName: '发送者', avatarUrl: '/avatar.png' }];
      let filter = {}, skip = 0, limit = Infinity, sortField, descending;
      const selected = () => {
        const result = rows.filter(row => matches(row, filter));
        return sortField ? result.sort((a, b) => (a[sortField] - b[sortField]) * (descending ? -1 : 1)) : result;
      };
      const query = {
        where(value) { filter = value; return query; },
        orderBy(field, order) { sortField = field; descending = order === 'desc'; return query; },
        skip(value) { skip = value; return query; }, limit(value) { limit = value; return query; },
        field() { return query; },
        async get() { return { data: structuredClone(selected().slice(skip, skip + limit)) }; },
        async count() { return { total: selected().length }; },
        async update({ data }) {
          const rows = selected();
          rows.forEach(row => Object.assign(row, data));
          return { stats: { updated: rows.length } };
        }
      };
      return query;
    }
  };
  const runFunction = (file) => {
    const sandbox = {
      exports: {},
      console: quiet,
      require(name) {
        assert.equal(name, 'wx-server-sdk');
        return {
          init() {},
          DYNAMIC_CURRENT_ENV: 'test-env',
          database: () => db,
          getWXContext: () => ({ OPENID: 'viewer' })
        };
      }
    };
    vm.runInNewContext(read(file), sandbox);
    return sandbox.exports.main;
  };
  const main = runFunction('functions/getMessages/index.js');
  const markMain = runFunction('functions/markMessagesAsRead/index.js');
  return { messages, main, markMain };
}

async function checkServer(inbox) {
  const owned = inbox.messages.filter(row => row.toUserId === 'viewer');
  const unread = owned.filter(row => row.isRead === false).length;
  for (const [type, memberTypes] of Object.entries(groups)) {
    const expected = owned.filter(row => memberTypes.includes(row.type)).sort((a, b) => b.createTime - a.createTime);
    const received = [];
    for (let skip = 0; skip < expected.length + 4; skip += 4) {
      const response = await inbox.main({ type, skip, limit: 4 });
      assert.equal(response.success, true);
      assert.deepEqual(plain(response.messages.map(row => row._id)), expected.slice(skip, skip + 4).map(row => row._id),
        `${type} must filter both categories before applying a single ordered page`);
      assert.equal(response.unreadCount, unread, 'Unread badge remains the global inbox count');
      received.push(...response.messages);
    }
    assert.deepEqual(received.map(row => row._id), expected.map(row => row._id));
  }
  for (const [type, members] of Object.entries({
    like: ['like'], favorite: ['favorite'], feedback_all: groups.feedback_report_all.slice(0, 4),
    post_report_all: groups.feedback_report_all.slice(4)
  })) {
    const response = await inbox.main({ type, limit: 100 });
    assert.deepEqual(plain(response.messages.map(row => row._id)), owned.filter(row => members.includes(row.type))
      .sort((a, b) => b.createTime - a.createTime).map(row => row._id), 'Preserve existing exact-type and group queries');
  }
}

async function checkMarkAll(inbox) {
  const ownedUnread = () => inbox.messages.filter(row => row.toUserId === 'viewer' && row.isRead !== true);
  const before = ownedUnread().length;
  assert.ok(before > 0, 'Fixture must start with unread messages');
  assert.ok(ownedUnread().some(row => row._id === 'legacy-unread'), 'Legacy message without isRead is pending');
  const response = await inbox.markMain({ markAll: true });
  assert.equal(response.success, true);
  assert.equal(response.updated, before, 'markAll reports every updated message, including legacy rows');
  assert.equal(ownedUnread().length, 0, 'markAll clears every unread message of the viewer');
  assert.equal(inbox.messages.find(row => row._id === 'foreign').isRead, false, 'markAll must not touch other users');
  const again = await inbox.markMain({ markAll: true });
  assert.equal(again.updated, 0, 'markAll is idempotent');
  const scoped = await inbox.markMain({ messageIds: ['message-0', 'foreign'] });
  assert.equal(scoped.updated, 0, 'Regular id-based marking still works');
}

async function checkClient(inbox) {
  const cacheManager = loadModule('cache/core/manager.js');
  const getAppState = () => ({ isLoggedIn: true, openid: 'viewer' });
  const calls = [];
  const api = loadModule('api-cache/messages.js', {
    cacheManager, getAppState,
    async callCloudAndUnwrap(name, payload) {
      if (name === 'markMessagesAsRead') {
        assert.equal(payload.markAll, true, 'Bulk mark must be requested as markAll');
        return inbox.markMain(payload);
      }
      assert.equal(name, 'getMessages');
      calls.push(plain(payload));
      return inbox.main(payload);
    }
  }, ['getMessages', 'getMessageViewer', 'getCachedMessages', 'invalidateMessages', 'markAllMessagesAsRead']);
  const bulkResult = await api.markAllMessagesAsRead();
  assert.equal(bulkResult.success, true);
  assert.equal(inbox.messages.filter(row => row.toUserId === 'viewer' && !row.isRead).length, 0,
    'Client helper marks the whole inbox read');
  for (const type of ['like', 'like_all', 'feedback_all', 'post_report_all', 'feedback_report_all']) {
    await api.getMessages({ type });
    await api.getMessages({ type });
  }
  assert.equal(calls.length, 5, 'Each merged group has its own cache and reuses repeated requests');
  assert.equal(cacheManager.namespace('messages').keys().length, 5);
  api.invalidateMessages({ type: 'like_all' });
  assert.ok(api.getCachedMessages({ type: 'like' }), 'Merged-group invalidation must not alias the legacy like cache');
  assert.equal(api.getCachedMessages({ type: 'like_all' }), undefined);
  api.invalidateMessages({ type: 'feedback_report_all' });
  assert.ok(api.getCachedMessages({ type: 'feedback_all' }));
  assert.equal(api.getCachedMessages({ type: 'feedback_report_all' }), undefined);

  let markAllCalls = 0;
  let clearBadgeCalls = 0;
  const pageDefinition = loadModule('pages-tools/messages/messages.vue', {
    getMessagesWithCache: api.getMessages, getMessageViewer: api.getMessageViewer, getCachedMessages: api.getCachedMessages,
    formatTimeAgo: () => '刚刚',
    markAllMessagesAsReadApi: async () => { markAllCalls++; return inbox.markMain({ markAll: true }); },
    unreadBadge: { clearUnread() { clearBadgeCalls++; }, acknowledgeAllRead() { clearBadgeCalls++; } },
    updateUnreadCache() {}, invalidateUnread() {},
    uni: { showToast() { assert.fail('Message loading must succeed'); } }
  });
  const page = createPage(pageDefinition);
  await page.onShow();
  for (const type of Object.keys(groups)) {
    await page.switchTab({ currentTarget: { dataset: { tab: type } } });
    assert.equal(calls.at(-1).type, type, 'The page must send the selected merged group to the API');
    assert.equal(page.activeTab, type);
    assert.equal(page.page, 1);
    assert.ok(page.messages.length > 0);
    assert.ok(page.messages.every(row => groups[type].includes(row.type)));
  }
  markAllCalls = 0;
  clearBadgeCalls = 0;
  page.unreadCount = 2;
  page.messages = page.messages.map(row => Object.assign({}, row, { isRead: false }));
  await page.onShow();
  assert.equal(markAllCalls, 1, 'Entering the page marks the whole inbox read');
  assert.equal(page.unreadCount, 0, 'Unread badge clears immediately');
  assert.ok(clearBadgeCalls > 0, 'Global unread badge is cleared');
  assert.ok(page.messages.every(row => row.isRead), 'Loaded messages render as read');
  assert.equal(page.getActionText({ type: 'like' }), '点赞了你的帖子');
  assert.equal(page.getActionText({ type: 'favorite' }), '收藏了你的帖子');
  assert.equal(page.getActionText({ type: 'post_report_handled' }), '处理了您的举报');
  assert.equal(page.getActionText({ type: 'feedback_processed' }), '解决了您反馈的问题');

  const template = read('pages-tools/messages/messages.vue').split('<script>')[0];
  const tabs = [...template.matchAll(/data-tab="([^"]+)"[^>]*>\s*<text>([^<]+)<\/text>/g)]
    .map(([, key, label]) => [key, label]);
  assert.deepEqual(tabs, [['all', '全部'], ['like_all', '点赞'], ['comment', '评论'], ['follow', '关注'],
    ['feedback_report_all', '反馈'], ['content_review_all', '复核']], 'Expose the two merged notification tabs');
}

async function checkFastOpen() {
  const state = { isLoggedIn: true, openid: 'viewer' };
  let now = 1000;
  const clock = { now: () => now };
  const cacheManager = loadModule('cache/core/manager.js', { Date: clock });
  const requests = [];
  const api = loadModule('api-cache/messages.js', {
    Date: clock, cacheManager, getAppState: () => state,
    callCloudAndUnwrap(name, payload) {
      if (name === 'deleteMessage' || name === 'clearAllMessages') return Promise.resolve({ success: true });
      assert.equal(name, 'getMessages');
      return new Promise((resolve, reject) => requests.push({ payload, resolve, reject }));
    }
  }, ['getMessages', 'getMessageViewer', 'getCachedMessages', 'prefetchMessages', 'deleteMessageById', 'clearMessages']);

  let completeMarkAll, completeAvatars;
  const markAll = new Promise(resolve => { completeMarkAll = resolve; });
  const avatars = new Promise(resolve => { completeAvatars = resolve; });
  let markCalls = 0;
  let pullDownStops = 0;
  const pageDefinition = loadModule('pages-tools/messages/messages.vue', {
    getMessagesWithCache: api.getMessages, getMessageViewer: api.getMessageViewer, getCachedMessages: api.getCachedMessages,
    markAllMessagesAsReadApi() { markCalls++; return markAll; },
    fileUrlCache: { getTempUrls: () => avatars },
    formatTimeAgo: () => '刚刚', resolveUserAvatar: url => url || '/default.png',
    unreadBadge: { acknowledgeAllRead() {} },
    uni: { stopPullDownRefresh() { pullDownStops++; }, showToast() { assert.fail('Background refresh should be silent'); } }
  });
  const select = tab => ({ currentTarget: { dataset: { tab } } });
  const row = (id, extra = {}) => ({ _id: id, isRead: true, ...extra });
  const response = (...messages) => ({ messages, unreadCount: 1 });
  const initial = row('recent', { fromUserAvatar: 'cloud://sender', isRead: false });
  const prefetch = api.prefetchMessages();
  const page = createPage(pageDefinition);
  const coldOpen = page.onShow();
  assert.equal(markCalls, 1);
  assert.equal(requests.length, 1, 'Prefetch and first open share one list request while mark-all is pending');
  requests[0].resolve(response(initial));
  await coldOpen;
  await prefetch;
  assert.ok(page.hasLoaded, 'List finishes while mark-all and avatars are still pending');
  assert.equal(page.messages[0]._id, 'recent');
  assert.equal(page.messages[0].isRead, true, 'Pending mark-all does not put unread dots back');
  assert.equal(page.getMessageAvatar(page.messages[0]), '/default.png');
  assert.equal(api.getCachedMessages().messages[0].fromUserAvatar, 'cloud://sender');
  assert.equal(api.getCachedMessages().messages[0].isRead, false, 'Optimistic view state does not mutate the cached response');
  completeAvatars({ 'cloud://sender': 'https://avatar.test/image' });
  await avatars;
  assert.equal(page.getMessageAvatar(page.messages[0]), 'https://avatar.test/image');
  completeMarkAll({ success: true });
  await page._markAllReadTask;
  assert.ok(api.getCachedMessages(), 'Marking all read leaves the list snapshot available');

  const warmPage = createPage(pageDefinition);
  await warmPage.onShow();
  assert.equal(requests.length, 1, 'Recent prefetch/open results are reused without another request');
  now += 16000;
  const stalePage = createPage(pageDefinition);
  const staleOpen = stalePage.onShow();
  assert.equal(stalePage.messages[0]._id, 'recent', 'Cached message appears synchronously before refresh completes');
  assert.equal(requests.length, 2);
  requests[1].reject(new Error('offline'));
  await staleOpen;
  assert.equal(stalePage.messages[0]._id, 'recent', 'Offline refresh leaves the cached list visible');

  const pullDown = stalePage.onPullDownRefresh();
  assert.equal(stalePage.messages[0]._id, 'recent', 'Manual refresh keeps the existing list visible');
  requests.at(-1).resolve(response(row('updated')));
  await pullDown;
  assert.equal(stalePage.messages[0]._id, 'updated');
  assert.equal(pullDownStops, 1);
  assert.equal(api.getCachedMessages().messages[0]._id, 'updated');
  await warmPage.onShow();
  assert.equal(warmPage.messages[0]._id, 'updated', 'An existing page can pick up a newer cached snapshot');
  assert.equal(requests.length, 3, 'Picking up a fresh snapshot needs no additional request');

  const likes = stalePage.switchTab(select('like_all'));
  const comments = stalePage.switchTab(select('comment'));
  requests.at(-1).resolve(response(row('comment')));
  await comments;
  requests.at(-2).resolve(response(row('like')));
  await likes;
  assert.equal(stalePage.messages[0]._id, 'comment', 'Late responses cannot overwrite a different tab');
  await stalePage.switchTab(select('like_all'));
  assert.equal(stalePage.messages[0]._id, 'like', 'Switching back reuses that tab’s first page');

  const staleRequest = api.getMessages({ type: 'like_all', forceRefresh: true });
  await api.deleteMessageById('like');
  requests.at(-1).resolve(response(row('like')));
  await staleRequest;
  assert.equal(api.getCachedMessages({ type: 'like_all' }), undefined, 'An older response cannot restore a deleted message in cache');
  assert.equal(api.getCachedMessages(), undefined, 'Deleting also invalidates the all-messages snapshot');

  const otherAccount = api.getMessages();
  state.openid = 'other';
  assert.equal(api.getCachedMessages(), undefined);
  const newAccount = api.getMessages();
  assert.equal(requests.at(-1).payload.openid, 'other');
  requests.at(-2).resolve(response(row('old-account')));
  requests.at(-1).resolve(response(row('new-account')));
  await Promise.all([otherAccount, newAccount]);
  assert.equal(api.getCachedMessages().messages[0]._id, 'new-account');
  state.openid = 'viewer';
  assert.equal(api.getCachedMessages(), undefined, 'Changing account prevents the old in-flight response from filling the cache');
  state.openid = 'other';
  now += 301000;
  assert.equal(api.getCachedMessages(), undefined, 'Expired snapshots are no longer used');
  const beforeClear = api.getMessages();
  requests.at(-1).resolve(response(row('before-clear')));
  await beforeClear;
  await api.clearMessages();
  assert.equal(api.getCachedMessages(), undefined, 'Clearing messages invalidates the current account cache');
  state.isLoggedIn = false;
  const calls = requests.length;
  await api.prefetchMessages();
  assert.equal(requests.length, calls, 'Prefetch requires a signed-in user');
}

(async () => {
  const inbox = createInbox();
  await checkServer(inbox);
  await checkMarkAll(inbox);
  await checkClient(inbox);
  await checkFastOpen();
  console.log('[test-message-groups] PASS: grouping, pagination, mark-all, cache-first open, prefetch, avatars, refresh and account isolation');
})().catch(error => { console.error(error); process.exitCode = 1; });
