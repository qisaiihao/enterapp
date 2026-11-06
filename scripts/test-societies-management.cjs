'use strict';
const assert = require('node:assert/strict');
const { runtime, ok } = require('./test-societies.cjs');
const { membershipId, hash } = require('../functions/societyManager/lib/common');
async function main() {
  const app = runtime();
  const societyId = 'society-a';
  const avatarUrl = 'cloud://test/societies/original/avatar.jpg';
  app.seed('societies', [{ _id: societyId, name: '旧诗社', school: '回车键大学', region: '上海', description: '大家一起读诗写诗。', avatarUrl, status: 'active', ownerId: 'alice', memberCount: 3 }]);
  app.seed('society_members', ['alice', 'bob', 'other'].map((userId, index) => ({ _id: membershipId(societyId, userId), societyId, userId, userDocId: `${userId}-doc`, role: index === 0 ? 'owner' : 'member', status: 'active', joinedAt: new Date() })));
  app.seed('society_names', [{ _id: hash('name', '回车键大学', '旧诗社'), societyId }]);
  assert.equal((await app.call({ action: 'changeMember', societyId, userId: 'other', operation: 'promote' }, 'bob')).code, 'FORBIDDEN');
  await ok(app.call({ action: 'changeMember', societyId, userId: 'bob', operation: 'promote' }, 'alice'));
  assert.equal(app.tables.society_members.find(row => row.userId === 'bob').role, 'admin');
  await ok(app.call({ action: 'changeMember', societyId, userId: 'bob', operation: 'transfer' }, 'alice'));
  assert.equal(app.tables.societies[0].ownerId, 'bob');
  assert.equal((await app.call({ action: 'changeMember', societyId, operation: 'leave' }, 'bob')).success, false, 'owner must transfer first');
  await ok(app.call({ action: 'changeMember', societyId, operation: 'leave' }, 'alice'));
  assert.equal(app.tables.societies[0].memberCount, 2);
  assert.equal((await app.call({ action: 'memberList', societyId }, 'alice')).code, 'FORBIDDEN');
  assert.equal((await ok(app.call({ action: 'publicMembers', societyId, limit: 1 }))).members.length, 1);
  const notice = await ok(app.call({ action: 'notifications', category: 'membership' }, 'alice'));
  assert.equal(notice.notifications.length, 1);
  assert.equal(notice.notifications[0].societyAvatar, avatarUrl);
  assert.equal((await app.call({ action: 'readNotification', id: notice.notifications[0]._id }, 'other')).code, 'NOT_FOUND');
  await ok(app.call({ action: 'readNotification', id: notice.notifications[0]._id }, 'alice'));
  assert.equal((await ok(app.call({ action: 'unreadNotifications' }, 'alice'))).count, 0);
  app.seed('society_notifications', [
    ...Array.from({ length: 25 }, (_, index) => ({ _id: `alice-${index}`, userId: 'alice', category: index % 2 ? 'membership' : 'activity', read: index % 2 === 0 })),
    { _id: 'bob-unread', userId: 'bob', read: false }
  ]);
  assert.equal((await app.call({ action: 'clearNotifications' })).code, 'AUTH_REQUIRED');
  assert.equal((await app.call({ action: 'clearNotifications', openid: 'alice' }, 'bob')).code, 'AUTH_REQUIRED');
  assert.equal((await ok(app.call({ action: 'clearNotifications' }, 'alice'))).deleted, 25, 'clear includes every category and pages beyond the first 20');
  assert.equal((await ok(app.call({ action: 'unreadNotifications' }, 'alice'))).count, 0);
  assert.equal((await ok(app.call({ action: 'unreadNotifications' }, 'bob'))).count, 1);
  assert.deepEqual(app.tables.society_notifications.map(row => row._id), ['bob-unread'], 'clearing only removes the current account notices');
  const form = { name: '新诗社', region: '上海', motto: '一起写诗', description: '大家一起读诗写诗，记录校园生活。', avatarUrl, recruitment: 'school' };
  assert.equal((await app.call({ action: 'updateSociety', societyId, form }, 'other')).code, 'FORBIDDEN');
  await ok(app.call({ action: 'updateSociety', societyId, form }, 'bob'));
  assert.equal(app.tables.societies[0].name, '新诗社');
  assert.equal(app.tables.societies[0].recruitment, 'school');
  assert.equal(app.tables.society_names.length, 1);
  console.log('societies management: PASS — roles, transfer, exit, pagination, notification clearing/isolation and profile changes');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
