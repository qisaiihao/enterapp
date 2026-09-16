const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parse } = require('@babel/parser');
const root = path.join(__dirname, '..');
const quiet = { log() {}, warn() {}, error() {} };
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

function runtime() {
  let tables = {
    feedback: [{ _id: 'feedback-1', userOpenid: 'reporter', content: '作品集无法上传封面', isProcessed: false }],
    users: [
      { _id: 'admin-doc', _openid: 'admin', nickName: '张三', avatarUrl: '/static/admin.png' },
      { _id: 'admin-two-doc', _openid: 'admin-two', nickName: '李四', avatarUrl: '/static/admin-two.png' }
    ],
    messages: [], feedbackReplies: []
  };
  let version = 0, nextId = 0;
  const state = { failWrite: '', forceConflict: false, conflicts: 0 };
  const matches = (row, filter) => Object.entries(filter).every(([key, value]) =>
    value && value.in ? value.in.includes(row[key]) : value && Object.hasOwn(value, 'neq') ? row[key] !== value.neq : row[key] === value);

  function collection(name, transaction) {
    const data = transaction ? transaction.tables : tables;
    const write = () => {
      if (state.failWrite === name) throw new Error('injected write failure');
      if (transaction) transaction.dirty = true;
      else version++;
    };
    return {
      doc(id) {
        return {
          async get() {
            const row = data[name].find(row => row._id === id);
            if (!row) throw new Error(`document with _id ${id} does not exist`);
            return { data: structuredClone(row) };
          },
          async set({ data: row }) {
            write();
            const index = data[name].findIndex(row => row._id === id);
            if (index >= 0) data[name][index] = structuredClone({ ...row, _id: id });
            else data[name].push(structuredClone({ ...row, _id: id }));
          },
          async update({ data: updates }) {
            write();
            const row = data[name].find(row => row._id === id);
            assert.ok(row);
            Object.assign(row, structuredClone(updates));
            return { stats: { updated: 1 } };
          }
        };
      },
      async add({ data: row }) {
        write();
        const _id = `message-${++nextId}`;
        data[name].push(structuredClone({ ...row, _id }));
        return { _id };
      },
      where(filter) {
        assert.ok(!transaction, 'transactions must use document operations');
        let skip = 0, limit = Infinity, orderKey, orderDirection;
        const selected = () => {
          const rows = data[name].filter(row => matches(row, filter));
          return orderKey ? rows.sort((a, b) => (a[orderKey] > b[orderKey] ? 1 : a[orderKey] < b[orderKey] ? -1 : 0) * (orderDirection === 'desc' ? -1 : 1)) : rows;
        };
        const query = {
          skip(value) { skip = value; return query; }, limit(value) { limit = value; return query; },
          field() { return query; }, orderBy(key, direction) { orderKey = key; orderDirection = direction; return query; },
          async get() { return { data: structuredClone(selected().slice(skip, skip + limit)) }; },
          async count() { return { total: selected().length }; },
          async update({ data: updates }) {
            write();
            const rows = selected();
            for (const row of rows) Object.assign(row, structuredClone(updates));
            return { stats: { updated: rows.length } };
          }
        };
        return query;
      }
    };
  }
  const db = {
    command: { in: values => ({ in: values }), neq: value => ({ neq: value }) },
    collection: name => collection(name),
    // Overlapping snapshots conflict and retry; a failed callback discards all writes.
    async runTransaction(callback) {
      for (let attempt = 0; attempt < 4; attempt++) {
        const snapshotVersion = version;
        const transaction = { tables: structuredClone(tables), dirty: false };
        const result = await callback({ collection: name => collection(name, transaction) });
        if (snapshotVersion !== version || state.forceConflict) {
          state.forceConflict = false;
          state.conflicts++;
          continue;
        }
        if (transaction.dirty) { tables = transaction.tables; version++; }
        return result;
      }
      throw new Error('transaction retry limit');
    }
  };
  return {
    state, get tables() { return tables; },
    load(name, caller = '') {
      const globals = { exports: {}, console: quiet, require(moduleName) {
        if (moduleName === 'wx-server-sdk') return { init() {}, database: () => db, getWXContext: () => ({ OPENID: caller }) };
        if (moduleName === './_lib/admin-auth') return {
          isAdminByPoemId: async ({ openid }) => ['admin', 'admin-two'].includes(openid),
          listAdminUsersByPoemId: async () => tables.users.filter(user => ['admin', 'admin-two'].includes(user._openid))
        };
        if (moduleName === 'crypto') return require('node:crypto');
        throw new Error(moduleName);
      } };
      vm.runInNewContext(read(`functions/${name}/index.js`), globals);
      return event => globals.exports.main(event, {});
    }
  };
}

function loadMessagePage() {
  let source = read('pages-tools/messages/messages.vue').match(/<script>([\s\S]*?)<\/script>/)[1];
  for (const node of parse(source, { sourceType: 'module' }).program.body.reverse()) {
    if (node.type === 'ImportDeclaration') source = source.slice(0, node.start) + source.slice(node.end);
  }
  const dialogs = [], readIds = [], navigations = [];
  const globals = {
    module: { exports: {} }, console: quiet, getApp: () => ({}), formatTimeAgo: () => '刚刚',
    feedbackDetailUrl: id => `/pages-tools/feedback-detail/feedback-detail?id=${encodeURIComponent(id)}`,
    uni: { navigateTo: options => navigations.push(options.url), showModal: options => dialogs.push(options), showToast: () => assert.fail('feedback notification must open its content') }
  };
  vm.runInNewContext(source.replace('export default', 'module.exports ='), globals);
  const component = globals.module.exports;
  const page = component.data();
  for (const [key, method] of Object.entries(component.methods)) page[key] = method.bind(page);
  Object.assign(page, {
    setData(updates) { Object.assign(this, updates); }, normalizeMessageAvatar() {}, checkFollowStatus() {},
    markMessagesAsRead(ids) { readIds.push(...ids); }
  });
  return { page, dialogs, readIds, navigations };
}

const request = { action: 'markAsProcessed', feedbackId: 'feedback-1', openid: 'admin' };

async function main() {
  await testConversation();
  await testReplyComposer();
  for (const caller of ['', 'admin']) {
    const app = runtime();
    const mark = app.load('feedbackManager', caller);
    assert.equal((await mark({ ...request, fromUserName: '伪造名字', toUserId: 'other' })).success, true);
    assert.equal(app.tables.feedback[0].isProcessed, true);
    assert.equal(app.tables.feedback[0].processedBy, 'admin');
    assert.equal(app.tables.messages.length, 1);
    const message = app.tables.messages[0];
    assert.equal(message.toUserId, 'reporter');
    assert.equal(message.fromUserName, '张三');
    assert.equal(message.fromUserAvatar, '/static/admin.png');
    assert.equal(message.content, '张三解决了您反馈的问题');
    assert.equal(message.feedbackContent, '作品集无法上传封面');
    assert.equal(message.feedbackId, 'feedback-1');
    assert.equal(message.type, 'feedback_processed');
    assert.equal(message.isRead, false);
    assert.equal(+message.createTime, +app.tables.feedback[0].processedTime);
    const processedTime = +app.tables.feedback[0].processedTime;
    assert.equal((await mark(request)).success, true);
    assert.equal(app.tables.messages.length, 1);
    assert.equal(+app.tables.feedback[0].processedTime, processedTime);

    const inbox = await app.load('getMessages')({ openid: 'reporter' });
    assert.equal(inbox.success, true);
    assert.equal(inbox.messages[0].content, message.content);
    assert.equal(inbox.unreadCount, 1);
    assert.equal((await app.load('getMessages')({ openid: 'other' })).messages.length, 0);
    assert.equal((await app.load('getUnreadMessageCount')({ openid: 'reporter' })).count, 1);
    await app.load('markMessagesAsRead')({ openid: 'other', messageIds: [message._id] });
    assert.equal(app.tables.messages[0].isRead, false);
    await app.load('markMessagesAsRead')({ openid: 'reporter', messageIds: [message._id] });
    assert.equal((await app.load('getUnreadMessageCount')({ openid: 'reporter' })).count, 0);

    // Retain the sender snapshot even if their profile later disappears.
    app.tables.users = [];
    const archived = await app.load('getMessages')({ openid: 'reporter' });
    assert.equal(archived.messages[0].fromUserName, '张三');
    assert.equal(archived.messages[0].fromUserAvatar, '/static/admin.png');

    const { page, dialogs, readIds, navigations } = loadMessagePage();
    page.processMessagesAfterAvatarConversion(inbox.messages, 0, 10, 1);
    assert.equal(page.getActionText(page.messages[0]), '解决了您反馈的问题');
    assert.equal(page.messages[0].content, '张三解决了您反馈的问题');
    assert.equal(page.messages[0].feedbackContent, message.feedbackContent);
    assert.ok(readIds.includes(message._id));
    page.handleMessageTap({ currentTarget: { dataset: { index: 0 } } });
    assert.equal(navigations[0], '/pages-tools/feedback-detail/feedback-detail?id=feedback-1');
    // Old notifications without a link still display their original content.
    delete page.messages[0].feedbackId;
    page.handleMessageTap({ currentTarget: { dataset: { index: 0 } } });
    assert.equal(dialogs[0].title, '反馈已解决');
    assert.equal(dialogs[0].content, message.feedbackContent);
    assert.equal(dialogs[0].showCancel, false);
  }

  const concurrent = runtime();
  const results = await Promise.all(['admin', 'admin-two'].map(openid => concurrent.load('feedbackManager')({ ...request, openid })));
  assert.ok(results.every(result => result.success));
  assert.ok(concurrent.state.conflicts > 0, 'exercise an actual overlapping transaction');
  assert.equal(concurrent.tables.messages.length, 1);
  assert.equal(concurrent.tables.messages[0].fromUserId, concurrent.tables.feedback[0].processedBy);

  for (const failWrite of ['feedback', 'messages']) {
    const app = runtime();
    app.state.failWrite = failWrite;
    assert.equal((await app.load('feedbackManager')(request)).success, false);
    assert.equal(app.tables.feedback[0].isProcessed, false, 'failure must roll back the resolved status');
    assert.equal(app.tables.messages.length, 0, 'failure must not leave a notification');
    app.state.failWrite = '';
    app.state.forceConflict = true;
    assert.equal((await app.load('feedbackManager')(request)).success, true);
    assert.equal(app.tables.messages.length, 1, 'transaction retry commits one notification');
  }

  for (const invalidRequest of [
    { ...request, openid: 'reporter' }, { ...request, openid: '' },
    { ...request, feedbackId: '' }, { ...request, feedbackId: 'missing' }
  ]) {
    const app = runtime();
    assert.equal((await app.load('feedbackManager')(invalidRequest)).success, false);
    assert.equal(app.tables.feedback[0].isProcessed, false);
    assert.equal(app.tables.messages.length, 0);
  }
  const missingRecipient = runtime();
  delete missingRecipient.tables.feedback[0].userOpenid;
  assert.equal((await missingRecipient.load('feedbackManager')(request)).success, false);
  assert.equal(missingRecipient.tables.feedback[0].isProcessed, false);

  const legacy = runtime();
  legacy.tables.feedback[0].isProcessed = true;
  assert.equal((await legacy.load('feedbackManager')(request)).success, true);
  assert.equal(legacy.tables.messages.length, 0, 'already resolved history is not notified again');
  console.log('[test-feedback-notifications] PASS: App/WeChat resolution, sender, recipient, inbox, unread/read, UI, concurrency, rollback and retry');
}

async function testReplyComposer() {
  let source = read('pages-tools/feedback-detail/feedback-detail.vue').match(/<script>([\s\S]*?)<\/script>/)[1];
  for (const node of parse(source, { sourceType: 'module' }).program.body.reverse()) {
    if (node.type === 'ImportDeclaration') source = source.slice(0, node.start) + source.slice(node.end);
  }
  const sent = [], uploads = [], toasts = [];
  let fail = true, refreshes = 0;
  const globals = {
    module: { exports: {} }, console: quiet, feedbackStatusLabel() {}, formatRelativeTime() {},
    uploadFileCompat: async options => { uploads.push(options); return { fileID: 'cloud://uploaded-screenshot' }; },
    replyFeedback: async payload => { sent.push(structuredClone(payload)); if (fail) throw new Error('network response lost'); return { success: true }; },
    invalidateMessages() {}, invalidateUnread() {},
    uni: { showToast: options => toasts.push(options), stopPullDownRefresh() {} }
  };
  vm.runInNewContext(source.replace('export default', 'module.exports ='), globals);
  const component = globals.module.exports;
  const page = component.data();
  for (const [name, method] of Object.entries(component.methods)) page[name] = method.bind(page);
  Object.assign(page, { feedbackId: 'feedback-1', content: '补充截图', images: [{ path: '/local/screenshot.jpg', fileID: '' }], isClosed: false, refresh: async () => { refreshes++; } });
  await page.send();
  assert.equal(page.content, '补充截图', 'failed send retains user text');
  assert.equal(page.images.length, 1);
  assert.equal(page.sending, false);
  fail = false;
  await page.send();
  assert.equal(uploads.length, 1, 'retry reuses successfully uploaded file');
  assert.equal(sent[0].requestId, sent[1].requestId, 'retry reuses idempotency key');
  assert.deepEqual(sent[0].imageUrls, ['cloud://uploaded-screenshot']);
  assert.equal(sent[0].status, undefined, 'users cannot submit an admin status');
  assert.equal(page.content, '');
  assert.equal(page.images.length, 0);
  assert.equal(refreshes, 1);
  assert.equal(toasts.at(-1).title, '发送成功');
  page.content = '已修复'; page.isAdmin = true; page.selectedStatus = 'closed';
  await page.send();
  assert.equal(sent.at(-1).status, 'closed');
  const count = sent.length;
  page.content = '重复操作'; page.isClosed = true;
  await page.send();
  assert.equal(sent.length, count);
  console.log('[test-feedback-composer] PASS: failed send preserves input, uploads and request identity; successful reply refreshes history; closed feedback cannot send');
}

async function testConversation() {
  const app = runtime();
  app.tables.feedback.push({ _id: 'other-feedback', userOpenid: 'other', content: '其他用户的反馈', isProcessed: true });
  const admin = app.load('feedbackManager', 'admin');
  const user = app.load('feedbackManager', 'reporter');
  const other = app.load('feedbackManager', 'other');
  const detail = { action: 'getFeedbackDetail', feedbackId: 'feedback-1' };
  assert.equal((await other({ ...detail, openid: 'reporter' })).success, false, 'platform identity overrides supplied identity');
  assert.equal((await user(detail)).feedback.status, 'pending', 'legacy status is normalized');
  assert.equal((await other({ ...detail, feedbackId: 'other-feedback' })).feedback.status, 'closed');
  assert.equal((await user({ action: 'getFeedbackList' })).success, false);
  const mine = await user({ action: 'getMyFeedbackList', userOpenid: 'other' });
  assert.deepEqual(Array.from(mine.feedbackList, row => row._id), ['feedback-1']);
  assert.equal((await admin({ action: 'getFeedbackList' })).feedbackList.length, 2);

  const base = { action: 'replyFeedback', feedbackId: 'feedback-1', content: '请提供操作步骤和截图', imageUrls: [], requestId: 'request_0001', status: 'waiting_user' };
  for (const call of [
    () => other({ ...base, status: undefined }),
    () => user(base),
    () => admin({ ...base, status: 'invalid' }),
    () => admin({ ...base, content: ' ' }),
    () => admin({ ...base, content: '字'.repeat(501) }),
    () => admin({ ...base, imageUrls: ['file:///private'] }),
    () => admin({ ...base, imageUrls: Array(4).fill('cloud://image') }),
    () => admin({ ...base, requestId: '' })
  ]) assert.equal((await call()).success, false);
  assert.equal(app.tables.feedbackReplies.length, 0);
  assert.equal(app.tables.messages.length, 0);

  assert.equal((await admin({ ...base, fromUserName: '假管理员', toUserId: 'other' })).success, true);
  assert.equal(app.tables.feedback[0].status, 'waiting_user');
  assert.equal(app.tables.feedbackReplies[0].senderName, '张三');
  assert.equal(app.tables.messages[0].toUserId, 'reporter');
  assert.equal(app.tables.messages[0].type, 'feedback_detail_requested');
  assert.equal((await admin(base)).alreadySent, true);
  assert.equal((await admin({ ...base, content: '篡改同一请求' })).success, false);
  assert.equal(app.tables.feedbackReplies.length, 1);

  const supplement = { ...base, requestId: 'request_0002', content: '点击封面后没有反应', imageUrls: ['cloud://feedback/screenshot.jpg'], status: undefined };
  assert.equal((await user(supplement)).success, true);
  assert.equal(app.tables.feedback[0].status, 'processing');
  assert.equal(app.tables.feedbackReplies[1].role, 'user');
  assert.equal(app.tables.messages.length, 3, 'supplement notifies both configured administrators');
  assert.deepEqual(app.tables.messages.slice(1).map(row => row.toUserId).sort(), ['admin', 'admin-two']);
  const inbox = await app.load('getMessages', 'reporter')({ type: 'feedback_all' });
  assert.equal(inbox.messages.length, 1);
  assert.equal(inbox.unreadCount, 1);
  const ui = loadMessagePage();
  for (const msg of app.tables.messages) {
    ui.page.messages = [msg];
    ui.page.handleMessageTap({ currentTarget: { dataset: { index: 0 } } });
  }
  assert.ok(ui.navigations.every(url => url.endsWith('id=feedback-1')));
  assert.equal(ui.page.getActionText(app.tables.messages[0]), '请您补充反馈细节');
  assert.equal(ui.page.getActionText(app.tables.messages[1]), '补充了反馈信息');

  // Clearing the inbox does not remove conversation history; page order and offset are stable.
  app.tables.messages = [];
  const firstPage = await user({ ...detail, limit: 1 });
  assert.equal(firstPage.replies[0].content, supplement.content);
  assert.equal(firstPage.hasMore, true);
  assert.equal((await user({ ...detail, skip: 1, limit: 1 })).replies[0].content, base.content);
  assert.equal((await user({ ...detail, skip: 2, limit: 1 })).replies.length, 0);
  assert.equal((await user(detail)).isAdmin, false);
  assert.equal((await admin(detail)).isAdmin, true);

  const close = { ...base, status: 'closed', requestId: 'request_0003', content: '已修复，请更新后重试' };
  assert.equal((await admin(close)).success, true);
  assert.equal(app.tables.feedback[0].isProcessed, true);
  assert.equal(app.tables.messages[0].type, 'feedback_processed');
  assert.equal(app.tables.messages[0].replyContent, close.content);
  assert.equal((await admin(close)).alreadySent, true, 'lost response can be retried after closure');
  assert.equal((await user({ ...supplement, requestId: 'request_0004' })).success, false);
  assert.equal((await admin({ ...close, requestId: 'request_0004' })).success, false);
  assert.equal(app.tables.feedbackReplies.length, 3);
  assert.equal((await other({ action: 'deleteFeedback', feedbackId: 'feedback-1' })).success, false);
  assert.equal((await admin({ action: 'deleteFeedback', feedbackId: 'feedback-1' })).success, true);
  assert.equal((await user(detail)).success, false);
  assert.equal((await user({ action: 'getMyFeedbackList' })).feedbackList.length, 0);
  assert.equal((await admin({ action: 'getFeedbackList' })).feedbackList.length, 1);
  assert.equal((await admin(base)).success, false);
  assert.equal((await admin(request)).success, false);

  for (const failWrite of ['feedback', 'feedbackReplies', 'messages']) {
    const failing = runtime();
    const send = failing.load('feedbackManager', 'admin');
    failing.state.failWrite = failWrite;
    assert.equal((await send(base)).success, false);
    assert.equal(failing.tables.feedback[0].isProcessed, false);
    assert.equal(failing.tables.feedback[0].status, undefined);
    assert.equal(failing.tables.feedbackReplies.length, 0);
    assert.equal(failing.tables.messages.length, 0);
    failing.state.failWrite = '';
    failing.state.forceConflict = true;
    assert.equal((await send(base)).success, true);
    assert.equal(failing.tables.feedbackReplies.length, 1);
    assert.equal(failing.tables.messages.length, 1);
  }
  const concurrent = runtime();
  const send = concurrent.load('feedbackManager', 'admin');
  const results = await Promise.all([send(base), send(base)]);
  assert.ok(results.every(result => result.success));
  assert.ok(concurrent.state.conflicts > 0);
  assert.equal(concurrent.tables.feedbackReplies.length, 1);
  assert.equal(concurrent.tables.messages.length, 1);
  const racing = runtime();
  const race = await Promise.all([
    racing.load('feedbackManager', 'admin')(close),
    racing.load('feedbackManager', 'reporter')(supplement)
  ]);
  assert.ok(race.some(result => result.success));
  const row = racing.tables.feedback[0];
  assert.equal(row.status, 'closed');
  assert.equal(row.replyCount, racing.tables.feedbackReplies.length);
  assert.equal(racing.tables.feedbackReplies.at(-1).status, 'closed', 'a racing supplement cannot reopen a closed feedback');
  console.log('[test-feedback-conversation] PASS: ownership, state transitions, history, pagination, inbox, idempotency, rollback, concurrent reply/closure and deletion');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
