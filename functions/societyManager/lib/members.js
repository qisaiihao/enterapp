'use strict';
const { hash, error, text, id, page, read, list, activeSociety, membership, membershipId, manager, publicSociety, profileTextMatches } = require('./common');
const { publicMemberPage, publicOpportunities } = require('./public');
const { send } = require('./notifications');

async function follow(db, user, event) {
  await activeSociety(db, event.societyId);
  if (typeof event.following !== 'boolean') throw error('关注状态无效');
  await db.collection('society_follows').doc(hash('follow', event.societyId, user._openid)).set({ data: {
    societyId: event.societyId, userId: user._openid, following: event.following, createdAt: new Date()
  } });
  return { following: event.following };
}
async function applyJoin(db, user, event) {
  await activeSociety(db, event.societyId);
  const reason = text(event.reason, 300, 1, '申请理由');
  const requestId = hash('join', event.societyId, user._openid);
  return db.runTransaction(async tx => {
    const society = await activeSociety(tx, event.societyId);
    if (society.recruitment === 'school' && !profileTextMatches(society.school, user.school)) throw error('仅限本校学生申请加入', 'FORBIDDEN');
    const [old, member] = await Promise.all([read(tx, 'society_join_requests', requestId), membership(tx, event.societyId, user._openid)]);
    if (member) throw error('你已经是诗社成员');
    if (old?.status === 'pending') return { alreadySubmitted: true };
    const managers = (await Promise.all(['owner', 'admin'].map(role => list(tx, 'society_members', { societyId: event.societyId, status: 'active', role }, { limit: 20 })))).flat();
    const revision = (old?.revision || 0) + 1;
    await tx.collection('society_join_requests').doc(requestId).set({ data: {
      societyId: event.societyId, userId: user._openid, userDocId: user._id, reason,
      status: 'pending', revision, createdAt: new Date(), reviewNote: ''
    } });
    for (const recipient of managers) await send(tx, { userId: recipient.userId, societyId: society._id, category: 'membership', title: '收到入社申请', body: society.name, targetId: society._id, targetKind: 'manage' }, `join-request:${requestId}:${revision}`);
    return { requestId };
  });
}
async function cancelJoin(db, user, event) {
  const requestId = hash('join', id(event.societyId), user._openid);
  return db.runTransaction(async tx => {
    const request = await read(tx, 'society_join_requests', requestId);
    if (!request || request.status !== 'pending') throw error('该申请已处理，请刷新页面');
    await tx.collection('society_join_requests').doc(requestId).update({ data: { status: 'cancelled', updatedAt: new Date() } });
    return {};
  });
}
async function manage(db, user, event) {
  const society = await manager(db, event.societyId, user);
  const self = await membership(db, society._id, user._openid);
  const [members, requests, events, calls, news] = await Promise.all([
    publicMemberPage(db, society._id, { limit: 20 }), list(db, 'society_join_requests', { societyId: society._id, status: 'pending' }, { limit: 20 }),
    publicOpportunities(db, 'event', society._id, 20), publicOpportunities(db, 'call', society._id, 20),
    list(db, 'society_news', { societyId: society._id, status: 'published' }, { limit: 20 })
  ]);
  const users = await Promise.all(requests.map(row => read(db, 'users', row.userDocId)));
  return { society: publicSociety(society), managerRole: self.role, uploadPrefix: require('./settings').uploadPrefix(society._id), members: members.members, membersMore: members.hasMore, membersNextSkip: members.nextSkip, events, calls, news,
    requests: requests.map((row, index) => ({ ...row, nickName: users[index]?.nickName || '诗友', avatarUrl: users[index]?.avatarUrl || '' })) };
}
async function memberList(db, user, event) {
  await manager(db, event.societyId, user);
  const pagination = page(event);
  return publicMemberPage(db, event.societyId, pagination);
}
async function requestList(db, user, event) {
  await manager(db, event.societyId, user);
  const pagination = page(event);
  const rows = await list(db, 'society_join_requests', { societyId: event.societyId, status: 'pending' }, pagination);
  const users = await Promise.all(rows.map(row => read(db, 'users', row.userDocId)));
  return { requests: rows.map((row, i) => ({ ...row, nickName: users[i]?.nickName || '诗友', avatarUrl: users[i]?.avatarUrl || '' })), hasMore: rows.length === pagination.limit };
}
async function changeMember(db, user, event) {
  const societyId = id(event.societyId);
  const targetId = id(event.userId || user._openid);
  const action = event.operation;
  if (!['leave', 'remove', 'promote', 'demote', 'transfer'].includes(action)) throw error('成员操作无效');
  return db.runTransaction(async tx => {
    const society = await activeSociety(tx, societyId);
    const actor = await membership(tx, societyId, user._openid);
    const target = await membership(tx, societyId, targetId);
    if (!target) throw error('成员不存在', 'NOT_FOUND');
    if (action === 'leave') {
      if (targetId !== user._openid) throw error('只能退出自己的诗社', 'FORBIDDEN');
      if (target.role === 'owner') throw error('负责人须先移交诗社');
    } else {
      if (!actor || actor.role !== 'owner') throw error('仅负责人可管理成员职务', 'FORBIDDEN');
      if (targetId === user._openid) throw error('不能操作自己的职务');
      if (action === 'promote' && target.role !== 'member' || action === 'demote' && target.role !== 'admin' || action === 'transfer' && target.role === 'owner' || action === 'remove' && target.role === 'owner') throw error('成员职务已变化，请刷新');
    }
    const now = new Date();
    if (['leave', 'remove'].includes(action)) {
      await tx.collection('society_members').doc(membershipId(societyId, targetId)).update({ data: { status: 'inactive', leftAt: now } });
      await tx.collection('societies').doc(societyId).update({ data: { memberCount: Math.max(0, (society.memberCount || 1) - 1), updatedAt: now } });
    } else {
      await tx.collection('society_members').doc(membershipId(societyId, targetId)).update({ data: { role: action === 'demote' ? 'member' : action === 'transfer' ? 'owner' : 'admin', updatedAt: now } });
      if (action === 'transfer') {
        await tx.collection('society_members').doc(membershipId(societyId, user._openid)).update({ data: { role: 'admin', updatedAt: now } });
        await tx.collection('societies').doc(societyId).update({ data: { ownerId: targetId, updatedAt: now } });
      }
    }
    await tx.collection('society_audit_logs').doc(hash('member-change', societyId, targetId, action, now.getTime())).set({ data: { kind: 'member', societyId, targetId, action, operatorId: user._openid, createdAt: now } });
    await send(tx, { userId: targetId, societyId, category: 'membership', title: { leave: '已退出诗社', remove: '已被移出诗社', promote: '已成为管理员', demote: '管理员职务已结束', transfer: '已成为诗社负责人' }[action], body: society.name, targetId: societyId, targetKind: 'society' }, `member:${societyId}:${targetId}:${action}:${now.getTime()}`);
    return {};
  });
}
async function reviewJoin(db, user, event) {
  const societyId = id(event.societyId);
  const requestId = id(event.requestId);
  if (!['approved', 'rejected'].includes(event.decision)) throw error('审核状态无效');
  const note = text(event.note || '', 200, event.decision === 'rejected' ? 1 : 0, '审核说明');
  return db.runTransaction(async tx => {
    const society = await manager(tx, societyId, user);
    const request = await read(tx, 'society_join_requests', requestId);
    if (!request || request.societyId !== societyId) throw error('入社申请不存在', 'NOT_FOUND');
    if (request.revision !== event.revision) throw error('申请已更新，请刷新后审核', 'STALE_REVIEW');
    if (request.status !== 'pending') {
      if (request.status === event.decision) return { alreadyReviewed: true };
      throw error('申请已处理，请刷新列表', 'STALE_REVIEW');
    }
    const [existing, applicant] = await Promise.all([membership(tx, societyId, request.userId), read(tx, 'users', request.userDocId)]);
    if (!applicant || applicant._openid !== request.userId) throw error('申请人账号不存在');
    if (event.decision === 'approved' && society.recruitment === 'school' && !profileTextMatches(society.school, applicant.school)) throw error('申请人不符合本校招募范围', 'FORBIDDEN');
    const now = new Date();
    if (event.decision === 'approved' && !existing) {
      await tx.collection('society_members').doc(membershipId(societyId, request.userId)).set({ data: {
        societyId, userId: request.userId, userDocId: request.userDocId, role: 'member', status: 'active', joinedAt: now, createdAt: now
      } });
      await tx.collection('societies').doc(societyId).update({ data: { memberCount: (society.memberCount || 0) + 1, updatedAt: now } });
      await tx.collection('society_follows').doc(hash('follow', societyId, request.userId)).set({ data: {
        societyId, userId: request.userId, following: true, createdAt: now
      } });
    }
    await tx.collection('society_join_requests').doc(requestId).update({ data: { status: event.decision, reviewNote: note, reviewedBy: user._openid, reviewedAt: now } });
    await tx.collection('society_audit_logs').doc(hash('join-review', requestId, request.revision)).set({ data: {
      kind: 'join', societyId, targetId: requestId, revision: request.revision, decision: event.decision, note, operatorId: user._openid, createdAt: now
    } });
    await send(tx, { userId: request.userId, societyId, category: 'membership', title: event.decision === 'approved' ? '入社申请已通过' : '入社申请未通过', body: note, targetId: societyId, targetKind: 'society' }, `join:${requestId}:${request.revision}`);
    return {};
  });
}
async function mine(db, user) {
  const [members, follows, requests] = await Promise.all([
    list(db, 'society_members', { userId: user._openid, status: 'active' }, { limit: 100 }),
    list(db, 'society_follows', { userId: user._openid, following: true }, { limit: 100 }),
    list(db, 'society_join_requests', { userId: user._openid }, { limit: 100 })
  ]);
  const ids = [...new Set([...members, ...follows, ...requests].map(row => row.societyId))];
  const rows = await Promise.all(ids.map(societyId => read(db, 'societies', societyId)));
  const names = new Map();
  const societies = rows.filter(row => row?.status === 'active').map(row => {
    names.set(row._id, row.name);
    return { ...publicSociety(row), role: members.find(member => member.societyId === row._id)?.role || '', following: follows.some(follow => follow.societyId === row._id) };
  });
  return { societies, requests: requests.filter(row => names.has(row.societyId)).map(row => ({ ...row, societyName: names.get(row.societyId) })) };
}
module.exports = { follow, applyJoin, cancelJoin, manage, memberList, requestList, changeMember, reviewJoin, mine };
