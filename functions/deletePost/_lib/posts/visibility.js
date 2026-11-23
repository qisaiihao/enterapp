'use strict';

const { createHash } = require('crypto');
const DAY_MS = 24 * 60 * 60 * 1000;
const relationId = (kind, societyId, id) => createHash('sha256').update(JSON.stringify([kind, societyId, id])).digest('hex');

function prepareVisibility(event, { isPoem, isSubmission, isAnonymous }) {
  const visibility = event.visibility;
  if (visibility === undefined || visibility === 'public') return {};
  if (visibility === 'scheduled') throw new Error('定时隐藏已停用，发布后可手动隐藏');
  if (!isPoem || isSubmission) throw new Error('活动投稿和非诗歌内容须公开发布');
  if (visibility === 'self') return { visibility, isHidden: true };
  if (visibility === 'society') {
    const visibilitySocietyId = typeof event.visibilitySocietyId === 'string' ? event.visibilitySocietyId.trim() : '';
    if (!visibilitySocietyId || visibilitySocietyId.length > 128) throw new Error('请选择诗社');
    if (isAnonymous) throw new Error('诗社成员可见的作品须署名发布');
    return { visibility, visibilitySocietyId, isHidden: true };
  }
  throw new Error('请选择有效的诗歌可见范围');
}

function publicVisibilityWhere(now = Date.now()) {
  return { $or: [
    { visibility: { $exists: false } },
    { visibility: 'public' },
    { visibility: 'scheduled', hideAt: { $gt: now } }
  ] };
}

function isRestricted(post, now = Date.now()) {
  if (!post) return false;
  return post.visibility === 'self' || post.visibility === 'society' ||
    (post.visibility === 'scheduled' && !(post.hideAt > now));
}

async function activeMember(db, societyId, userId) {
  if (!societyId || !userId) return null;
  const [society, member] = await Promise.all([
    db.collection('societies').doc(societyId).get(),
    db.collection('society_members').doc(relationId('member', societyId, userId)).get()
  ]).catch(error => {
    if (/document .* does not exist/.test(String(error.errMsg || error.message))) return [];
    throw error;
  });
  const active = result => result && result.data && result.data.status === 'active';
  return active(society) && active(member) ? society.data : null;
}

async function canViewPost(db, post, viewerId, ownerId) {
  if (!post) return false;
  if (!isRestricted(post) && post.isHidden !== true) return true;
  if (viewerId && viewerId === ownerId) return true;
  return post.visibility === 'society' && Boolean(await activeMember(db, post.visibilitySocietyId, viewerId));
}

async function requirePublicationSociety(db, data) {
  const society = await activeMember(db, data.visibilitySocietyId, data._openid);
  if (!society) throw new Error('您已不在所选诗社，请重新选择可见范围');
  return society;
}

async function insertPublishedPost(db, data, { inTransaction = false } = {}) {
  if (data.visibility === 'scheduled') {
    data = { ...data, hideAt: +data.createTime + data.hideAfterDays * DAY_MS };
  }
  if (data.visibility !== 'society') return db.collection('posts').add({ data });

  async function publishToSociety(tx) {
    const societyId = data.visibilitySocietyId;
    const owner = data._openid;
    const society = await requirePublicationSociety(tx, data);
    const result = await tx.collection('posts').add({ data });
    await tx.collection('society_publications').doc(relationId('publication', societyId, result._id)).set({ data: {
      societyId, postId: result._id, authorId: owner, status: 'published', membersOnly: true, publishedAt: data.createTime
    } });
    await tx.collection('societies').doc(societyId).update({ data: { workCount: (society.workCount || 0) + 1 } });
    return result;
  }
  return inTransaction ? publishToSociety(db) : db.runTransaction(publishToSociety);
}

module.exports = { prepareVisibility, publicVisibilityWhere, isRestricted, canViewPost, requirePublicationSociety, insertPublishedPost };
