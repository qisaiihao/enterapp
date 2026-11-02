'use strict';
const { hash, error, text, id, read, list, page, pick, manager, membership, activeSociety } = require('./common');
const { moderateBeforeWrite } = require('../_lib/moderation-gate');
const { send } = require('./notifications');

const collections = { news: 'society_news', event: 'society_events', call: 'society_calls' };
function collection(kind) { if (!collections[kind]) throw error('内容类型无效'); return collections[kind]; }
function date(value, label) {
  if (typeof value !== 'string' || !value || !Number.isFinite(Date.parse(value))) throw error(`请填写有效的${label}`);
  return new Date(value);
}
function image(value) {
  const url = text(value || '', 1000);
  if (url && !/^(cloud:\/\/|https:\/\/)/.test(url)) throw error('图片地址无效');
  return url;
}
function form(kind, source = {}) {
  const value = { title: text(source.title, 100, 1, '标题') };
  if (kind === 'news') return { ...value, content: text(source.content, 5000, 1, '正文') };
  Object.assign(value, { description: text(source.description, 5000, 1, '正文'), requirements: text(source.requirements || '', 2000),
    category: text(source.category || '', 20), coverImage: image(source.coverImage),
    audience: source.audience || 'all' });
  if (!['all', 'members', 'school'].includes(value.audience)) throw error('收稿范围无效');
  if (!Array.isArray(source.guests || []) || (source.guests || []).length > 10) throw error('嘉宾最多10位');
  value.guests = (source.guests || []).map(guest => ({ name: text(guest.name, 40, 1), role: text(guest.role || '嘉宾', 20), bio: text(guest.bio || '', 200), avatarUrl: image(guest.avatarUrl) }));
  if (kind === 'event') {
    Object.assign(value, { location: text(source.location, 200, 1, '地点'), startTime: date(source.startTime, '开始时间'),
      endTime: date(source.endTime, '结束时间'), registrationEnd: date(source.registrationEnd, '报名截止时间'), capacity: Number(source.capacity || 0) });
    if (value.endTime <= value.startTime || value.registrationEnd > value.startTime) throw error('请检查活动及报名时间顺序');
    if (!Number.isSafeInteger(value.capacity) || value.capacity < 0 || value.capacity > 100000) throw error('人数上限无效');
  } else {
    value.deadline = date(source.deadline, '征稿截止时间');
    if (!Array.isArray(source.invitedSocietyIds || []) || (source.invitedSocietyIds || []).length > 10) throw error('合办诗社最多10个');
    value.invitedSocietyIds = [...new Set((source.invitedSocietyIds || []).map(id))];
  }
  return value;
}
async function saveContent(db, cloud, user, event) {
  const table = collection(event.kind);
  const societyId = id(event.societyId);
  await manager(db, societyId, user);
  if (user.postingBanned === true) throw error('账号已被限制发布内容', 'FORBIDDEN');
  const value = form(event.kind, event.form);
  const itemId = event.id ? id(event.id) : hash('content', societyId, event.kind, user._openid, id(event.requestId));
  const fingerprint = hash(value);
  const audit = await moderateBeforeWrite(cloud, { title: value.title, content: [value.content, value.description, value.requirements, value.location, value.category,
    ...(value.guests || []).map(guest => `${guest.role} ${guest.name} ${guest.bio}`)].filter(Boolean).join('\n'),
    images: [value.coverImage, ...(value.guests || []).map(guest => guest.avatarUrl)].filter(Boolean) });
  if (audit) throw error(audit.message, audit.code);
  return db.runTransaction(async tx => {
    const society = await manager(tx, societyId, user);
    const old = await read(tx, table, itemId);
    if (event.id && !old) throw error('内容不存在', 'NOT_FOUND');
    if (old && (old.societyId !== societyId || old.status === 'deleted')) throw error('内容不存在', 'NOT_FOUND');
    if (old?.payloadHash === fingerprint) return { id: itemId, revision: old.revision };
    if (old && old.revision !== event.revision) throw error('内容已更新，请刷新后编辑', 'STALE_REVIEW');
    if (event.kind === 'event' && value.capacity && value.capacity < (old?.registrationCount || 0)) throw error('人数上限不能少于已报名人数');
    for (const host of value.invitedSocietyIds || []) await activeSociety(tx, host);
    const invitedManagers = event.kind === 'call' ? await Promise.all(value.invitedSocietyIds.filter(host => !old?.invitedSocietyIds?.includes(host)).map(async hostId => ({ hostId, rows: (await Promise.all(['owner', 'admin'].map(role => list(tx, 'society_members', { societyId: hostId, status: 'active', role }, { limit: 20 })))).flat() }))) : [];
    const now = new Date();
    if (event.kind !== 'news' && (event.kind === 'event' ? value.endTime : value.deadline) <= now) throw error('结束时间须晚于当前时间');
    const hosts = event.kind === 'call' ? [...new Set([societyId, ...(old?.hostSocietyIds || []).filter(host => value.invitedSocietyIds.includes(host))])] : [];
    const record = { ...value, societyId, status: 'published', payloadHash: fingerprint, revision: (old?.revision || 0) + 1,
      createdAt: old?.createdAt || now, updatedAt: now, authorId: old?.authorId || user._openid,
      pinned: old?.pinned || false, registrationCount: old?.registrationCount || 0, submissionCount: old?.submissionCount || 0, hostSocietyIds: hosts };
    await tx.collection(table).doc(itemId).set({ data: record });
    const countKey = event.kind === 'event' ? 'eventCount' : event.kind === 'call' ? 'callCount' : null;
    if (!old && countKey) await tx.collection('societies').doc(societyId).update({ data: { [countKey]: (society[countKey] || 0) + 1 } });
    if (event.kind === 'call') for (const { hostId, rows } of invitedManagers) {
      for (const host of rows.filter(row => ['owner', 'admin'].includes(row.role))) await send(tx, { userId: host.userId, societyId: hostId, category: 'invitation', title: '收到联合征稿邀请', body: value.title, targetId: hostId, targetKind: 'manage' }, `host:${itemId}:${hostId}:${host.userId}`);
    }
    return { id: itemId, revision: record.revision };
  });
}
async function changeContent(db, user, event) {
  const table = collection(event.kind);
  if (!['delete', 'pin', 'unpin'].includes(event.operation) || (event.kind !== 'news' && event.operation !== 'delete')) throw error('操作无效');
  return db.runTransaction(async tx => {
    const society = await manager(tx, event.societyId, user);
    const row = await read(tx, table, id(event.id));
    if (!row || row.societyId !== society._id) throw error('内容不存在', 'NOT_FOUND');
    if (event.operation === 'delete' && row.status === 'deleted') return {};
    if (row.revision !== event.revision || row.status !== 'published') throw error('内容已更新，请刷新', 'STALE_REVIEW');
    await tx.collection(table).doc(row._id).update({ data: { ...(event.operation === 'delete' ? { status: 'deleted' } : { pinned: event.operation === 'pin' }), revision: row.revision + 1, updatedAt: new Date() } });
    const countKey = event.kind === 'event' ? 'eventCount' : event.kind === 'call' ? 'callCount' : null;
    if (countKey) await tx.collection('societies').doc(society._id).update({ data: { [countKey]: Math.max(0, (society[countKey] || 0) - 1) } });
    return {};
  });
}
async function editContent(db, user, event) {
  const society = await manager(db, event.societyId, user);
  const item = await read(db, collection(event.kind), id(event.id));
  if (!item || item.societyId !== society._id || item.status !== 'published') throw error('内容不存在', 'NOT_FOUND');
  return { item };
}
async function acceptHost(db, user, event) {
  return db.runTransaction(async tx => {
    await manager(tx, event.societyId, user);
    const call = await read(tx, 'society_calls', id(event.id));
    if (!call || call.status !== 'published' || !call.invitedSocietyIds?.includes(event.societyId)) throw error('邀请不存在', 'NOT_FOUND');
    await activeSociety(tx, call.societyId);
    if (call.hostSocietyIds.includes(event.societyId)) return {};
    const organizer = await activeSociety(tx, call.societyId);
    await tx.collection('society_calls').doc(call._id).update({ data: { hostSocietyIds: [...call.hostSocietyIds, event.societyId], revision: call.revision + 1, updatedAt: new Date() } });
    await send(tx, { userId: organizer.ownerId, societyId: call.societyId, category: 'invitation', title: '合办诗社已接受邀请', body: call.title, targetId: call._id, targetKind: 'call' }, `host-accepted:${call._id}:${event.societyId}`);
    return {};
  });
}
function eligiblePost(post, userId) {
  return post && post._openid === userId && post._openid !== '123456' && post.isAnonymous !== true && post.isAnonymous !== 'true'
    && !post.isHidden && !post.isDeleted && (!post.auditStatus || post.auditStatus === 'approved')
    && (post.publishMode ? post.publishMode === 'poem' : post.isPoem === true);
}
function submittablePost(post, userId) {
  return eligiblePost(post, userId) && post.isOriginal === true;
}
async function myWorks(db, user, event) {
  const pagination = page(event);
  const rows = await list(db, 'posts', { _openid: user._openid }, { ...pagination, order: 'createTime' });
  const eligible = event.originalOnly === true ? submittablePost : eligiblePost;
  return { works: rows.filter(post => eligible(post, user._openid)).map(post => pick(post, ['_id', 'title', 'content', 'createTime'])), hasMore: rows.length === pagination.limit };
}
async function publishWork(db, user, event) {
  if (user.postingBanned) throw error('账号已被限制发布内容', 'FORBIDDEN');
  const societyId = id(event.societyId), postId = id(event.postId);
  return db.runTransaction(async tx => {
    const society = await activeSociety(tx, societyId);
    const member = await membership(tx, societyId, user._openid);
    if (!member) throw error('仅诗社成员可以发表作品', 'FORBIDDEN');
    const post = await read(tx, 'posts', postId);
    if (!eligiblePost(post, user._openid)) throw error('请选择本人已公开且通过审核的诗歌');
    const relationId = hash('publication', societyId, postId);
    const old = await read(tx, 'society_publications', relationId);
    if (old?.status === 'published') return { alreadyPublished: true };
    await tx.collection('society_publications').doc(relationId).set({ data: { societyId, postId, authorId: user._openid, status: 'published', publishedAt: new Date() } });
    await tx.collection('societies').doc(societyId).update({ data: { workCount: (society.workCount || 0) + 1 } });
    return {};
  });
}
module.exports = { saveContent, changeContent, editContent, acceptHost, eligiblePost, submittablePost, myWorks, publishWork };
