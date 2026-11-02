'use strict';
const { hash, error, id, read, list, page, pick, manager, membership, activeSociety, profileTextMatches } = require('./common');
const { eligiblePost, submittablePost } = require('./content');
const postFingerprint = post => hash(post.title || '', post.content || '', post.seriesBlocks || []);
async function published(db, kind, itemId) {
  const item = await read(db, kind === 'call' ? 'society_calls' : 'society_events', id(itemId));
  if (!item || item.status !== 'published') throw error('内容不存在或已下架', 'NOT_FOUND');
  await activeSociety(db, item.societyId);
  return item;
}
async function participant(db, item, user) {
  if (user.postingBanned) throw error('账号已被限制参与', 'FORBIDDEN');
  const hostSocietyIds = item.hostSocietyIds?.length ? item.hostSocietyIds : [item.societyId];
  if (item.audience === 'school') {
    const hosts = await Promise.all(hostSocietyIds.map(societyId => read(db, 'societies', societyId)));
    if (!hosts.some(host => profileTextMatches(host?.school, user.school))) throw error('仅限本校学生参与', 'FORBIDDEN');
  } else if (item.audience === 'members') {
    const members = await Promise.all(hostSocietyIds.map(societyId => membership(db, societyId, user._openid)));
    if (!members.some(Boolean)) throw error('仅主办或合办诗社成员可以参与', 'FORBIDDEN');
  }
}
async function reviewer(db, item, user, societyId) {
  if (!(item.hostSocietyIds?.length ? item.hostSocietyIds : [item.societyId]).includes(societyId)) throw error('你没有这次征稿的管理权限', 'FORBIDDEN');
  return manager(db, societyId, user);
}
async function registration(db, user, event) {
  if (typeof event.registered !== 'boolean') throw error('报名状态无效');
  return db.runTransaction(async tx => {
    const item = await published(tx, 'event', event.id);
    const key = hash('registration', item._id, user._openid);
    const old = await read(tx, 'society_registrations', key);
    if ((old?.status === 'registered') === event.registered) return { registered: event.registered };
    const now = new Date();
    if (event.registered) {
      await participant(tx, item, user);
      if (!item.registrationEnd || new Date(item.registrationEnd) <= now || new Date(item.startTime) <= now) throw error('报名已截止', 'CLOSED');
      if (item.capacity && item.registrationCount >= item.capacity) throw error('报名人数已满', 'FULL');
    } else if (new Date(item.startTime) <= now) throw error('活动已开始，无法取消报名', 'CLOSED');
    await tx.collection('society_registrations').doc(key).set({ data: { eventId: item._id, societyId: item.societyId, userId: user._openid, userDocId: user._id,
      status: event.registered ? 'registered' : 'cancelled', createdAt: old?.createdAt || now, updatedAt: now } });
    await tx.collection('society_events').doc(item._id).update({ data: { registrationCount: Math.max(0, (item.registrationCount || 0) + (event.registered ? 1 : -1)) } });
    await require('./notifications').send(tx, { userId: user._openid, societyId: item.societyId, category: 'activity', title: event.registered ? '活动报名成功' : '活动报名已取消', body: item.title, targetId: item._id, targetKind: 'event' }, `registration:${key}:${event.registered}:${now.getTime()}`);
    return { registered: event.registered };
  });
}
async function registrations(db, user, event) {
  const item = await published(db, 'event', event.id);
  await manager(db, item.societyId, user);
  const pagination = page(event);
  const rows = await list(db, 'society_registrations', { eventId: item._id, status: 'registered' }, pagination);
  const users = await Promise.all(rows.map(row => read(db, 'users', row.userDocId)));
  return { records: rows.map((row, i) => ({ ...pick(row, ['_id', 'userId', 'createdAt']), nickName: users[i]?.nickName || '诗友', avatarUrl: users[i]?.avatarUrl || '' })), hasMore: rows.length === pagination.limit, total: item.registrationCount || 0 };
}
async function submitWork(db, user, event) {
  const postId = id(event.postId);
  return db.runTransaction(async tx => {
    const item = await published(tx, 'call', event.id);
    await participant(tx, item, user);
    const post = await read(tx, 'posts', postId);
    if (!submittablePost(post, user._openid)) throw error('请选择本人已公开、通过审核的原创诗歌');
    const key = hash('submission', item._id, user._openid, postId);
    const old = await read(tx, 'society_submissions', key);
    const fingerprint = postFingerprint(post);
    if (old && ['pending', 'deferred', 'approved'].includes(old.status)) {
      if (old.postFingerprint === fingerprint) return { id: key, alreadySubmitted: true };
      throw error('作品已修改，请先撤回原投稿');
    }
    if (!item.deadline || new Date(item.deadline) <= new Date()) throw error('征稿已截止', 'CLOSED');
    const society = await activeSociety(tx, item.societyId);
    const now = new Date();
    await tx.collection('society_submissions').doc(key).set({ data: { callId: item._id, societyId: item.societyId, userId: user._openid, userDocId: user._id,
      postId, postFingerprint: fingerprint, status: 'pending', revision: (old?.revision || 0) + 1, createdAt: old?.createdAt || now, submittedAt: now } });
    if (!old || old.status === 'withdrawn') await tx.collection('society_calls').doc(item._id).update({ data: { submissionCount: (item.submissionCount || 0) + 1 } });
    await require('./notifications').send(tx, { userId: society.ownerId, societyId: society._id, category: 'submission', title: '征稿收到新投稿', body: item.title, targetId: society._id, targetKind: 'manage' }, `new-submission:${key}:${(old?.revision || 0) + 1}`);
    return { id: key };
  });
}
async function withdrawWork(db, user, event) {
  return db.runTransaction(async tx => {
    const row = await read(tx, 'society_submissions', id(event.id));
    if (!row || row.userId !== user._openid) throw error('投稿不存在', 'NOT_FOUND');
    const item = await read(tx, 'society_calls', row.callId);
    if (row.status === 'withdrawn') return {};
    if (row.status === 'approved') throw error('已入选作品不能撤回');
    if (row.revision !== event.revision) throw error('投稿已更新，请刷新', 'STALE_REVIEW');
    await tx.collection('society_submissions').doc(row._id).update({ data: { status: 'withdrawn', revision: row.revision + 1, updatedAt: new Date() } });
    if (item) await tx.collection('society_calls').doc(item._id).update({ data: { submissionCount: Math.max(0, (item.submissionCount || 0) - 1) } });
    return {};
  });
}
async function submissions(db, user, event) {
  const item = await published(db, 'call', event.id);
  await reviewer(db, item, user, event.societyId);
  const pagination = page(event);
  const filter = { callId: item._id };
  if (event.status) {
    if (!['pending', 'deferred', 'approved', 'rejected', 'withdrawn'].includes(event.status)) throw error('稿件状态无效');
    filter.status = event.status;
  }
  const rows = await list(db, 'society_submissions', filter, pagination);
  const posts = await Promise.all(rows.map(row => read(db, 'posts', row.postId)));
  return { records: rows.map((row, i) => ({ ...pick(row, ['_id', 'postId', 'userId', 'status', 'revision', 'submittedAt']),
    post: eligiblePost(posts[i], row.userId) ? pick(posts[i], ['_id', 'title', 'content', 'seriesBlocks', 'authorName', 'backgroundColor', 'textColor']) : null,
    changed: !!posts[i] && postFingerprint(posts[i]) !== row.postFingerprint })), hasMore: rows.length === pagination.limit };
}
async function reviewWork(db, user, event) {
  if (!['approved', 'deferred', 'rejected'].includes(event.decision)) throw error('评审状态无效');
  return db.runTransaction(async tx => {
    const row = await read(tx, 'society_submissions', id(event.id));
    if (!row) throw error('投稿不存在', 'NOT_FOUND');
    const item = await published(tx, 'call', row.callId);
    await reviewer(tx, item, user, event.societyId);
    const logId = hash('submission-review', row._id, event.revision);
    const previous = await read(tx, 'society_audit_logs', logId);
    if (previous?.decision === event.decision && previous.operatorId === user._openid) return { alreadyReviewed: true };
    if (row.revision !== event.revision || !['pending', 'deferred'].includes(row.status)) throw error('稿件已处理或重新提交，请刷新', 'STALE_REVIEW');
    const post = await read(tx, 'posts', row.postId);
    if (event.decision === 'approved' && (!eligiblePost(post, row.userId) || postFingerprint(post) !== row.postFingerprint)) throw error('原作已修改或不可公开，请退回重新投稿', 'POST_CHANGED');
    const society = await activeSociety(tx, item.societyId);
    const publicationId = hash('publication', item.societyId, row.postId);
    const old = await read(tx, 'society_publications', publicationId);
    const now = new Date();
    await tx.collection('society_submissions').doc(row._id).update({ data: { status: event.decision, revision: row.revision + 1, reviewedAt: now, reviewedBy: user._openid } });
    await tx.collection('society_audit_logs').doc(logId).set({ data: { kind: 'submission', societyId: item.societyId, targetId: row._id,
      revision: event.revision, decision: event.decision, operatorId: user._openid, createdAt: now } });
    await require('./notifications').send(tx, { userId: row.userId, societyId: item.societyId, category: 'submission', title: { approved: '投稿已入选', deferred: '投稿待定', rejected: '投稿未通过' }[event.decision], body: item.title || '', targetId: item._id, targetKind: 'call' }, `submission:${row._id}:${event.revision}`);
    if (event.decision === 'approved' && old?.status !== 'published') {
      await tx.collection('society_publications').doc(publicationId).set({ data: { societyId: item.societyId, postId: row.postId, authorId: row.userId, callId: item._id, status: 'published', publishedAt: now } });
      await tx.collection('societies').doc(item.societyId).update({ data: { workCount: (society.workCount || 0) + 1 } });
    }
    return {};
  });
}
async function myParticipation(db, user, event) {
  const pagination = page(event);
  const kind = event.kind === 'event' ? 'event' : 'call';
  const rows = await list(db, kind === 'event' ? 'society_registrations' : 'society_submissions', { userId: user._openid }, pagination);
  const items = await Promise.all(rows.map(row => read(db, kind === 'event' ? 'society_events' : 'society_calls', row.eventId || row.callId)));
  const posts = kind === 'call' ? await Promise.all(rows.map(row => read(db, 'posts', row.postId))) : [];
  const societies = await Promise.all(items.map(item => item ? read(db, 'societies', item.societyId) : null));
  return { records: rows.map((row, i) => ({ ...pick(row, ['_id', 'callId', 'eventId', 'postId', 'status', 'revision', 'submittedAt', 'createdAt']),
    title: eligiblePost(posts[i], user._openid) ? posts[i].title : '',
    item: items[i]?.status === 'published' && societies[i]?.status === 'active' ? pick(items[i], ['_id', 'title', 'deadline', 'startTime']) : null })), hasMore: rows.length === pagination.limit };
}
module.exports = { published, registration, registrations, submitWork, withdrawWork, submissions, reviewWork, myParticipation };
