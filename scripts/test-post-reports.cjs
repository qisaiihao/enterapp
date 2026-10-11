const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {
  REASONS, validateSubmission, submitPostReport, listPostReports, getPostReport, resolvePostReport
} = require('../functions/adminManager/_lib/post-report');

function makeDb() {
  const collections = new Map();
  const table = name => {
    if (!collections.has(name)) collections.set(name, new Map());
    return collections.get(name);
  };
  const command = { aggregate: {}, in: values => ({ includes: value => values.includes(value) }) };
  function query(rows, filters = {}, sortField = '', direction = 'asc', offset = 0, count = Infinity) {
    const matched = () => [...rows.values()].filter(row => Object.entries(filters).every(([key, value]) =>
      value && typeof value.includes === 'function' ? value.includes(row[key]) : row[key] === value));
    return {
      where(next) { return query(rows, next, sortField, direction, offset, count); },
      orderBy(field, order) { return query(rows, filters, field, order, offset, count); },
      skip(value) { return query(rows, filters, sortField, direction, value, count); },
      limit(value) { return query(rows, filters, sortField, direction, offset, value); },
      field() { return this; },
      async count() { return { total: matched().length }; },
      async get() {
        const selected = matched();
        if (sortField) selected.sort((a, b) => direction === 'desc'
          ? new Date(b[sortField]) - new Date(a[sortField])
          : new Date(a[sortField]) - new Date(b[sortField]));
        return { data: selected.slice(offset, offset + count) };
      },
      async update({ data }) {
        const found = matched();
        for (const row of found) rows.set(row._id, { ...row, ...data });
        return { stats: { updated: found.length } };
      }
    };
  }
  function collection(name) {
    const rows = table(name);
    return {
      doc(id) {
        return {
          async get() {
            if (!rows.has(id)) throw new Error(`document with _id ${id} does not exist`);
            return { data: rows.get(id) };
          },
          async set({ data }) { rows.set(id, { _id: id, ...data }); },
          async update({ data }) { rows.set(id, { ...rows.get(id), ...data }); }
        };
      },
      where(filters) { return query(rows, filters); },
      orderBy(field, direction) { return query(rows).orderBy(field, direction); }
    };
  }
  return { command, collection, table, runTransaction: callback => callback({ collection }) };
}

async function main() {
  const reasonSource = fs.readFileSync(path.join(__dirname, '../utils/postReportReasons.js'), 'utf8')
    .replace('export const postReportCategories =', 'const postReportCategories =');
  const reasonContext = { module: { exports: [] } };
  vm.runInNewContext(`${reasonSource}\nmodule.exports = postReportCategories;`, reasonContext);
  for (const category of reasonContext.module.exports) {
    assert.deepEqual([...category.reasons], REASONS[category.key], 'client choices must match server validation');
  }
  const db = makeDb();
  db.table('posts').set('post-1', {
    _id: 'post-1', title: '原帖', content: '需要核查的内容', authorName: '作者', imageUrls: []
  });
  db.table('users').set('user-1', { _id: 'user-1', _openid: 'user-1', nickName: '举报人' });
  db.table('users').set('admin-1', { _id: 'admin-1', _openid: 'admin-1', nickName: '值班管理员' });
  db.table('users').set('admin-2', { _id: 'admin-2', _openid: 'admin-2', nickName: '审核员' });
  const admins = async () => [{ _openid: 'admin-1' }, { _openid: 'admin-2' }];
  const request = {
    postId: 'post-1', category: 'rights', reason: '侵犯著作权',
    description: '这是我的原创作品', requestId: 'request_001',
    evidenceImages: ['cloud://env/post-reports/user-1/evidence.jpg']
  };
  assert.equal(validateSubmission(request).reason, '侵犯著作权');
  assert.throws(() => validateSubmission({ ...request, reason: '任意伪造的分类' }), /有效的举报原因/);
  assert.throws(() => validateSubmission({ ...request, category: 'harm', reason: '涉嫌诈骗' }), /证据图片无效/);
  assert.throws(() => validateSubmission({ ...request, reason: '其他侵权', description: '' }), /补充说明/);
  await assert.rejects(submitPostReport(db, {
    ...request, evidenceImages: ['cloud://env/post-reports/other/evidence.jpg']
  }, 'user-1'), /当前用户不匹配/);

  const submitted = await submitPostReport(db, request, 'user-1', admins);
  assert.equal(submitted.success, true);
  assert.equal(db.table('messages').size, 2, 'each administrator receives one notification');
  assert.deepEqual([...db.table('messages').values()].map(item => item.toUserId).sort(), ['admin-1', 'admin-2']);
  assert.ok([...db.table('messages').values()].every(item => item.type === 'post_report_new' && item.reportId === submitted.reportId));
  const repeated = await submitPostReport(db, request, 'user-1', admins);
  assert.equal(repeated.alreadySubmitted, true);
  assert.equal(db.table('messages').size, 2, 'retry does not duplicate notifications');
  await assert.rejects(submitPostReport(db, { ...request, requestId: 'request_002' }, 'user-1'), /已举报过/);
  const pending = await listPostReports(db, { status: 'pending' });
  assert.equal(pending.reports.length, 1);
  assert.equal(pending.reports[0].postSnapshot.content, '需要核查的内容');
  assert.equal(pending.reports[0].reporterName, '举报人');
  assert.equal((await getPostReport(db, { reportId: submitted.reportId })).report._id, submitted.reportId);

  const failedDelete = () => Promise.resolve({ success: false, error: '删帖失败' });
  await assert.rejects(resolvePostReport(db, { reportId: submitted.reportId, decision: 'delete' }, 'admin-1', failedDelete), /删帖失败/);
  assert.equal(db.table('post_reports').get(submitted.reportId).status, 'pending');
  assert.equal(db.table('messages').size, 2, 'failed handling does not notify the reporter');
  let deletedPostId = '';
  const removed = await resolvePostReport(db, { reportId: submitted.reportId, decision: 'delete' }, 'admin-1', async ({ postId }) => {
    deletedPostId = postId;
    return { success: true };
  });
  assert.equal(deletedPostId, 'post-1');
  assert.equal(removed.status, 'handled');
  const handledMessage = [...db.table('messages').values()].find(item => item.toUserId === 'user-1');
  assert.equal(handledMessage.type, 'post_report_handled');
  assert.equal(handledMessage.fromUserName, '值班管理员');
  assert.equal(handledMessage.reportId, submitted.reportId);
  await assert.rejects(resolvePostReport(db, { reportId: submitted.reportId, decision: 'dismiss' }, 'admin-2', failedDelete), /已处理/);

  const second = await submitPostReport(db, { ...request, requestId: 'request_003' }, 'user-1');
  const dismissed = await resolvePostReport(db, { reportId: second.reportId, decision: 'dismiss' }, 'admin-2', failedDelete);
  assert.equal(dismissed.status, 'dismissed');
  assert.equal(db.table('post_reports').get(second.reportId).handledBy, 'admin-2');
  assert.ok([...db.table('messages').values()].some(item => item.reportId === second.reportId && item.type === 'post_report_dismissed' && item.toUserId === 'user-1'));
  const third = await submitPostReport(db, { ...request, requestId: 'request_004' }, 'user-1');
  db.table('post_reports').set(third.reportId, {
    ...db.table('post_reports').get(third.reportId),
    status: 'processing', processingDecision: 'delete',
    processingAt: new Date(Date.now() - 3 * 60 * 1000)
  });
  await assert.rejects(resolvePostReport(db, { reportId: third.reportId, decision: 'dismiss' }, 'admin-2', failedDelete), /只能重试原操作/);
  assert.equal((await resolvePostReport(db, { reportId: third.reportId, decision: 'delete' }, 'admin-2', async () => ({ success: true }))).status, 'handled');
  const entrySource = fs.readFileSync(path.join(__dirname, '../functions/adminManager/index.js'), 'utf8');
  const entryContext = {
    exports: {}, console: { log() {}, error() {} },
    require(name) {
      if (name === 'wx-server-sdk') return { DYNAMIC_CURRENT_ENV: 'test', init() {}, database: () => db, getWXContext: () => ({}) };
      if (name === './_lib/posts') return { createPostsDatabase: value => value, withPostResponse: value => value };
      if (name === './_lib/admin-auth') return { isAdminByPoemId: async ({ openid }) => openid === 'admin-1', listAdminUsersByPoemId: admins };
      if (name === './_lib/post-report') return require('../functions/adminManager/_lib/post-report');
      return {};
    }
  };
  vm.runInNewContext(entrySource, entryContext);
  assert.equal((await entryContext.exports.main({ action: 'listPostReports', openid: 'user-1' })).success, false);
  assert.equal((await entryContext.exports.main({ action: 'resolvePostReport', openid: 'user-1', reportId: submitted.reportId, decision: 'dismiss' })).success, false);
  const adminList = await entryContext.exports.main({ action: 'listPostReports', openid: 'admin-1', status: 'all' });
  assert.equal(adminList.success, true, adminList.error);
  assert.equal((await entryContext.exports.main({ action: 'getPostReport', openid: 'user-1', reportId: submitted.reportId })).success, false);
  assert.equal((await entryContext.exports.main({ action: 'getPostReport', openid: 'admin-1', reportId: submitted.reportId })).report._id, submitted.reportId);
  db.table('messages').set('other-type', { _id: 'other-type', toUserId: 'admin-1', fromUserId: 'user-1', type: 'like', isRead: false, createTime: new Date() });
  let currentOpenid = 'admin-1';
  const messageContext = {
    exports: {}, console: { error() {} },
    require(name) {
      if (name === 'wx-server-sdk') return {
        DYNAMIC_CURRENT_ENV: 'test', init() {}, database: () => db,
        getWXContext: () => ({ OPENID: currentOpenid })
      };
      throw new Error(`Unexpected import ${name}`);
    }
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../functions/getMessages/index.js'), 'utf8'), messageContext);
  const adminInbox = await messageContext.exports.main({ type: 'post_report_all' });
  assert.equal(adminInbox.success, true);
  assert.equal(adminInbox.messages.length, 1);
  assert.equal(adminInbox.messages[0].type, 'post_report_new');
  currentOpenid = 'user-1';
  const reporterInbox = await messageContext.exports.main({ type: 'post_report_all' });
  assert.deepEqual([...reporterInbox.messages].map(item => item.type).sort(), ['post_report_dismissed', 'post_report_handled', 'post_report_handled']);
  console.log('[test-post-reports] PASS: validation, evidence ownership, idempotency, notifications, admin authorization, listing, delete, dismiss and retry');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
