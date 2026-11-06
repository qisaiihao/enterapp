'use strict';
const { hash, error, id, page, list, read } = require('./common');
const CATEGORIES = ['application', 'membership', 'activity', 'submission', 'invitation'];
async function send(db, { userId, societyId = '', category, title, body = '', targetId = '', targetKind = '' }, eventKey) {
  if (!userId) return;
  await db.collection('society_notifications').doc(hash('society-notice', eventKey, userId)).set({ data: {
    userId, societyId, category, title, body, targetId, targetKind, read: false, createdAt: new Date()
  } });
}
async function notifications(db, user, event) {
  const pagination = page(event);
  const category = event.category || 'all';
  if (category !== 'all' && !CATEGORIES.includes(category)) throw error('通知分类无效');
  const rows = await list(db, 'society_notifications', { userId: user._openid, ...(category === 'all' ? {} : { category }) }, pagination);
  const societyIds = [...new Set(rows.map(row => row.societyId).filter(Boolean))];
  const societies = new Map((await Promise.all(societyIds.map(async societyId => [societyId, await read(db, 'societies', societyId)])))
    .filter(([, society]) => society));
  return { notifications: rows.map(row => {
    const society = societies.get(row.societyId);
    return { ...row, societyName: society?.name || '', societyAvatar: society?.avatarUrl || '' };
  }), hasMore: rows.length === pagination.limit };
}
async function unreadCount(db, user) {
  const result = await db.collection('society_notifications').where({ userId: user._openid, read: false }).count();
  return { count: result.total || 0 };
}
async function readNotification(db, user, event) {
  const noticeId = id(event.id);
  const row = await read(db, 'society_notifications', noticeId);
  if (!row || row.userId !== user._openid) throw error('通知不存在', 'NOT_FOUND');
  if (!row.read) await db.collection('society_notifications').doc(noticeId).update({ data: { read: true } });
  return { notification: { ...row, read: true } };
}
async function clearNotifications(db, user) {
  const result = await db.collection('society_notifications').where({ userId: user._openid }).remove();
  return { deleted: result?.stats?.removed || 0 };
}
module.exports = { send, notifications, unreadCount, readNotification, clearNotifications };
