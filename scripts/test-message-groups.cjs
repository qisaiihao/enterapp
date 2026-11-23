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
  const cache = new Map();
  const calls = [];
  const namespace = {
    getOrFetch: async (key, fetcher) => {
      if (!cache.has(key)) cache.set(key, await fetcher());
      return cache.get(key);
    }, keys: () => [...cache.keys()], delete: key => cache.delete(key), clear: () => cache.clear()
  };
  const api = loadModule('api-cache/messages.js', {
    cacheManager: { namespace: () => namespace },
    async callCloudAndUnwrap(name, payload) {
      if (name === 'markMessagesAsRead') {
        assert.equal(payload.markAll, true, 'Bulk mark must be requested as markAll');
        return inbox.markMain(payload);
      }
      assert.equal(name, 'getMessages');
      calls.push(plain(payload));
      return inbox.main(payload);
    }
  }, ['getMessages', 'invalidateMessages', 'markAllMessagesAsRead']);
  const bulkResult = await api.markAllMessagesAsRead();
  assert.equal(bulkResult.success, true);
  assert.equal(inbox.messages.filter(row => row.toUserId === 'viewer' && !row.isRead).length, 0,
    'Client helper marks the whole inbox read');
  for (const type of ['like', 'like_all', 'feedback_all', 'post_report_all', 'feedback_report_all']) {
    await api.getMessages({ type });
    await api.getMessages({ type });
  }
  assert.equal(calls.length, 5, 'Each merged group has its own cache and reuses repeated requests');
  assert.equal(cache.size, 5);
  api.invalidateMessages({ type: 'like_all' });
  assert.ok(cache.has('type:like:page:0:size:10'), 'Merged-group invalidation must not alias the legacy like cache');
  assert.ok(!cache.has('type:like_all:page:0:size:10'));
  api.invalidateMessages({ type: 'feedback_report_all' });
  assert.ok(cache.has('type:feedback_all:page:0:size:10'));
  assert.ok(!cache.has('type:feedback_report_all:page:0:size:10'));

  let markAllCalls = 0;
  let clearBadgeCalls = 0;
  const pageDefinition = loadModule('pages-tools/messages/messages.vue', {
    getMessagesWithCache: api.getMessages, invalidateMessages: api.invalidateMessages,
    formatTimeAgo: () => '刚刚',
    markAllMessagesAsReadApi: async () => { markAllCalls++; return inbox.markMain({ markAll: true }); },
    unreadBadge: { clearUnread() { clearBadgeCalls++; }, acknowledgeAllRead() { clearBadgeCalls++; } },
    updateUnreadCache() {}, invalidateUnread() {},
    uni: { showToast() { assert.fail('Message loading must succeed'); } }
  });
  const page = pageDefinition.data();
  for (const [name, method] of Object.entries(pageDefinition.methods)) page[name] = method.bind(page);
  page.onShow = pageDefinition.onShow.bind(page);
  Object.assign(page, { setData(updates) { Object.assign(this, updates); },
    normalizeMessageAvatar() {}, checkFollowStatus() {}, markMessagesAsRead() {} });
  const settle = async () => { for (let index = 0; index < 20; index++) await Promise.resolve(); };
  for (const type of Object.keys(groups)) {
    page.switchTab({ currentTarget: { dataset: { tab: type } } });
    await settle();
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
  page.onShow();
  await settle();
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

(async () => {
  const inbox = createInbox();
  await checkServer(inbox);
  await checkMarkAll(inbox);
  await checkClient(inbox);
  console.log('[test-message-groups] PASS: merged filtering/pagination, ownership, global unread, mark-all read, legacy queries, page/API keys and cache isolation');
})().catch(error => { console.error(error); process.exitCode = 1; });
