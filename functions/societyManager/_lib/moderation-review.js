'use strict';

// Server-prepared content only. This module is never exposed as a submission action.
const { createHash } = require('crypto');
const { resolveOwner } = require('./posts');
const { listAdminUsersByPoemId, isAdminByPoemId } = require('./admin-auth');

const COLLECTION = 'moderation_review';
const TIMESTAMP_KEYS = new Set(['createTime', 'createdAt', 'updateTime', 'updatedAt', 'auditTime', 'activityPublishTime', 'joinedActivityAt']);
const CONTENT_KEYS = [
  '_openid', 'realAuthorOpenid', 'title', 'content', 'author', 'authorName', 'authorAvatar',
  'authorNameSnapshot', 'authorAvatarSnapshot', 'authorSignature', 'isAnonymous', 'anonymousAuthorName',
  'tags', 'imageUrl', 'imageUrls', 'originalImageUrl', 'originalImageUrls', 'poemBgImage',
  'backgroundColor', 'textColor', 'highlightSentence', 'highlightLines', 'sentenceGroups',
  'discussionSentences', 'isSeries', 'seriesBlocks', 'seriesBlockCount', 'seriesCoverImage', 'seriesCoverHighlight',
  'isPoem', 'isOriginal', 'isDiscussion', 'isFoundPoetry', 'publishMode', 'isActivityPost',
  'activityId', 'activityTitleSnapshot', 'joinedActivityId', 'joinedActivityTitleSnapshot',
  'quotedPostId', 'quotedPostTitle', 'quotedPostAuthor', 'quotedPostAuthorId', 'parentPostId', 'isDeleted', 'isHidden'
];
const isDate = value => Object.prototype.toString.call(value) === '[object Date]';

function stable(value, omitTimes = false) {
  if (isDate(value)) return value.toISOString();
  if (Array.isArray(value)) return value.map(item => stable(item, omitTimes));
  if (!value || typeof value !== 'object') return value;
  const output = {};
  for (const key of Object.keys(value).sort()) {
    if (value[key] !== undefined && !(omitTimes && TIMESTAMP_KEYS.has(key))) Object.defineProperty(output, key, { value: stable(value[key], omitTimes), enumerable: true, writable: true, configurable: true });
  }
  return output;
}

function copyData(value) {
  if (isDate(value)) return new Date(value.getTime());
  if (Array.isArray(value)) return value.map(copyData);
  if (!value || typeof value !== 'object') return value;
  const prototype = Object.getPrototypeOf(value);
  if (Object.prototype.toString.call(value) !== '[object Object]' ||
      (prototype && (!prototype.constructor || prototype.constructor.name !== 'Object')) ||
      (value.operator && Array.isArray(value.operands))) {
    throw new Error('复核内容必须使用已准备的普通数据');
  }
  const output = {};
  for (const key of Object.keys(value)) if (value[key] !== undefined) Object.defineProperty(output, key, { value: copyData(value[key]), enumerable: true, writable: true, configurable: true });
  return output;
}

const digest = value => createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
function postFingerprint(post) {
  const content = {};
  for (const key of CONTENT_KEYS) if (post[key] !== undefined) content[key] = post[key];
  return digest(content);
}
async function readDoc(ref) {
  try { return (await ref.get()).data || null; }
  catch (error) {
    if (/document.*(does not exist|not exist)|record not found/i.test(String(error.errMsg || error.message || error))) return null;
    throw error;
  }
}
function snapshot(data) {
  const output = {};
  for (const key of CONTENT_KEYS) if (!['_openid', 'realAuthorOpenid'].includes(key) && data[key] !== undefined) output[key] = copyData(data[key]);
  output.title = String(data.title || '');
  output.content = String(data.content || '');
  output.authorName = String(data.authorName || '');
  output.imageUrls = Array.isArray(data.imageUrls) ? data.imageUrls.slice() : (data.imageUrl ? [data.imageUrl] : []);
  return output;
}
function replay(review) {
  if (review.status === 'pending') return {
    success: false, code: 'REVIEW_PENDING', queued: true, reviewQueued: true, reviewStored: true, reviewId: review._id,
    originalCode: review.audit.code, message: review.kind === 'post_edit'
      ? '修改已提交管理员复核，通过后将自动生效' : '内容已提交管理员复核，通过后将自动发布'
  };
  return {
    success: false, queued: false, reviewQueued: false, reviewStored: true, reviewId: review._id,
    code: review.status === 'approved' ? 'REVIEW_ALREADY_APPROVED' : 'REVIEW_ALREADY_REJECTED',
    resultPostId: review.resultPostId || '', resultCommentId: review.resultCommentId || '',
    message: review.status === 'approved' ? '该内容已通过管理员复核，请查看已发布内容' : '该内容未通过管理员复核，请修改后重新提交'
  };
}
const notificationId = (reviewId, recipient, kind) => digest({ reviewId, recipient, kind });

async function queueModerationReview(db, input) {
  const audit = input.audit || {};
  if (audit.passed === true || (!['Block', 'Review'].includes(audit.suggestion) && !['CONTENT_BLOCKED', 'REVIEW_REQUIRED'].includes(audit.code))) return audit;
  try {
    const { openid, source, kind, postId = '', basePost, related = {} } = input;
    if (!openid || !source || !['post', 'post_edit', 'comment'].includes(kind) || !input.data) throw new Error('复核参数无效');
    const data = copyData(input.data);
    if (kind === 'post_edit' && (!postId || !basePost || resolveOwner(basePost) !== openid)) throw new Error('无权提交该帖子的修改');
    const baseFingerprint = kind === 'post_edit' ? postFingerprint(basePost) : '';
    const reviewId = digest(stable({ openid, source, kind, postId, data, related, baseFingerprint }, true));
    const existing = await readDoc(db.collection(COLLECTION).doc(reviewId));
    if (existing) return replay(existing);
    const userResult = await db.collection('users').where({ _openid: openid }).get();
    const users = userResult.data || [];
    if (kind === 'post' && (!users.length || users.some(user => user.postingBanned === true))) throw new Error('账号不存在或已被限制发帖');
    const user = users[0] || {};
    // Server configuration allows isolated production smoke tests without sending
    // test submissions to real administrators. Client input cannot set this flag.
    const admins = process.env.MODERATION_REVIEW_NOTIFY_ADMINS === 'false' ? []
      : await listAdminUsersByPoemId({ db, command: db.command, loggerPrefix: 'moderation-review' });
    const adminOpenids = [...new Set(admins.map(item => item && item._openid).filter(Boolean))];
    const now = new Date();
    const review = {
      kind, source, submitterOpenid: openid, submitterName: user.nickName || '用户',
      createTime: now, status: 'pending', data, related: copyData(related),
      audit: { code: audit.code || '', suggestion: audit.suggestion || '', failedType: audit.failedType || '', requestId: audit.requestId || '', message: audit.message || '' },
      snapshot: snapshot(kind === 'post_edit' ? { ...basePost, ...data } : data)
    };
    if (postId) review.postId = postId;
    if (kind === 'post_edit') review.baseFingerprint = baseFingerprint;
    const persisted = await db.runTransaction(async transaction => {
      const ref = transaction.collection(COLLECTION).doc(reviewId);
      const current = await readDoc(ref);
      if (current) return current;
      await ref.set({ data: review });
      for (const recipient of adminOpenids) await transaction.collection('messages').doc(notificationId(reviewId, recipient, 'new')).set({ data: {
        fromUserId: openid, fromUserName: user.nickName || '用户', fromUserAvatar: user.avatarUrl || '',
        toUserId: recipient, type: 'content_review_new', reviewId, reviewKind: kind,
        postId, postTitle: review.snapshot.title, content: `${user.nickName || '用户'}提交了内容复核`,
        isRead: false, createTime: now
      } });
      return { ...review, _id: reviewId };
    });
    return replay(persisted);
  } catch (error) {
    console.error('[moderation-review] queue failed:', error.code || error.message);
    return { success: false, code: 'REVIEW_QUEUE_FAILED', queued: false, reviewQueued: false, message: '复核提交失败，请稍后重试' };
  }
}

async function listModerationReviews(db, event = {}) {
  const status = ['pending', 'approved', 'rejected', 'all'].includes(event.status) ? event.status : 'pending';
  const skip = Math.max(0, Math.floor(Number(event.skip) || 0));
  const limit = Math.min(30, Math.max(1, Math.floor(Number(event.limit) || 20)));
  let query = db.collection(COLLECTION);
  if (status !== 'all') query = query.where({ status });
  const result = await query.orderBy('createTime', 'desc').skip(skip).limit(limit + 1).get();
  // Full prepared write data and private ownership are only needed when resolving.
  const reviews = (result.data || []).slice(0, limit).map(review => {
    const { data, baseFingerprint, ...view } = review;
    return view;
  });
  return { success: true, reviews, hasMore: (result.data || []).length > limit };
}
function validateId(value) {
  const id = typeof value === 'string' ? value.trim() : '';
  if (!/^[a-f0-9]{64}$/.test(id)) throw new Error('复核标识无效');
  return id;
}
async function getModerationReview(db, event = {}) {
  const review = await readDoc(db.collection(COLLECTION).doc(validateId(event.reviewId)));
  if (!review) throw new Error('复核记录不存在');
  const { data, baseFingerprint, ...view } = review;
  return { success: true, review: view };
}

function available(post) { return post && post.isDeleted !== true && post.isHidden !== true; }
function validateJoinedActivity(activity, now) {
  if (!activity || activity.isDeleted === true) throw new Error('参与的活动不存在');
  if (activity.status !== 'published' || activity.allowUserSubmission === false) throw new Error('该活动暂不接受投稿');
  const start = +new Date(activity.startTime || 0), end = +new Date(activity.endTime || 0);
  if (!start || !end || +now < start || +now > end) throw new Error('活动已结束或尚未开始，不能通过复核');
}

async function resolveModerationReview(db, event = {}, openid) {
  const reviewId = validateId(event.reviewId);
  const decision = event.decision;
  const note = typeof event.note === 'string' ? event.note.trim() : '';
  if (!['approve', 'reject'].includes(decision) || (event.note != null && typeof event.note !== 'string') || note.length > 500) throw new Error('复核处理参数无效，说明最多500字');
  const command = db.command;
  return db.runTransaction(async transaction => {
    const ref = transaction.collection(COLLECTION).doc(reviewId);
    const review = await readDoc(ref);
    if (!review) throw new Error('复核记录不存在');
    const status = decision === 'approve' ? 'approved' : 'rejected';
    if (review.status !== 'pending') {
      if (review.status !== status) throw new Error('该内容已经处理，请刷新列表');
      return { success: true, status, alreadyHandled: true, postId: review.resultPostId || '', commentId: review.resultCommentId || '' };
    }
    const now = new Date();
    const userResult = await transaction.collection('users').where({ _openid: review.submitterOpenid }).get();
    const users = userResult.data || [];
    const user = users[0] || {};
    const adminResult = await transaction.collection('users').where({ _openid: openid }).limit(1).get();
    const admin = adminResult.data && adminResult.data[0] || {};
    let targetPost = null, parentComment = null, quotedPost = null, poet = null;
    const activities = new Map();
    const data = copyData(review.data);
    if (decision === 'approve') {
      if (!users.length) throw new Error('账号已不存在，不能通过复核');
      if (review.kind === 'post') {
        if (!users.length || users.some(item => item.postingBanned === true)) throw new Error('账号不存在或已被限制发帖，不能通过复核');
        const quotedId = review.related.quotedPostId || data.quotedPostId || (data.isDiscussion && data.parentPostId) || '';
        if (quotedId) {
          quotedPost = await readDoc(transaction.collection('posts').doc(quotedId));
          if (!available(quotedPost)) throw new Error('引用的帖子已不存在或不可见');
        }
        if (review.source === 'contentCheck' && (data.isPoem || data.isSeries) && !data.isOriginal && data.author && data.author.trim()) {
          const result = await transaction.collection('poets').where({ name: data.author.trim() }).limit(1).get();
          poet = result.data && result.data[0] || null;
        }
      } else if (review.kind === 'post_edit') {
        targetPost = await readDoc(transaction.collection('posts').doc(review.postId));
        if (!targetPost || targetPost.isDeleted === true || resolveOwner(targetPost) !== review.submitterOpenid) throw new Error('帖子不存在或作者身份已变化');
        if (postFingerprint(targetPost) !== review.baseFingerprint) throw new Error('原帖已被修改，请重新提交修改，避免覆盖新内容');
      } else if (review.kind === 'comment') {
        targetPost = await readDoc(transaction.collection('posts').doc(data.postId));
        if (!available(targetPost)) throw new Error('评论所属帖子已不存在或不可见');
        if (data.parentId) {
          parentComment = await readDoc(transaction.collection('comments').doc(data.parentId));
          if (!parentComment || parentComment.isDeleted || parentComment.postId !== data.postId) throw new Error('回复的评论已不存在');
        }
      } else throw new Error('复核内容类型无效');
      const oldActivityId = review.kind === 'post_edit' ? (targetPost.isActivityPost ? targetPost.activityId : targetPost.joinedActivityId) || '' : '';
      const newActivityId = review.kind === 'post' ? (data.isActivityPost ? data.activityId : data.joinedActivityId) || ''
        : review.kind === 'post_edit' ? (targetPost.isActivityPost ? targetPost.activityId : (data.joinedActivityId !== undefined ? data.joinedActivityId : targetPost.joinedActivityId)) || '' : '';
      for (const activityId of [...new Set([oldActivityId, newActivityId].filter(Boolean))]) {
        activities.set(activityId, await readDoc(transaction.collection('activities').doc(activityId)));
      }
      if (newActivityId && (review.kind === 'post' || oldActivityId !== newActivityId)) {
        if (data.isActivityPost || (targetPost && targetPost.isActivityPost)) {
          const activity = activities.get(newActivityId);
          if (!activity || activity.isDeleted) throw new Error('官方活动已不存在');
          if (!await isAdminByPoemId({ db: transaction, command, openid: review.submitterOpenid, loggerPrefix: 'moderation-review' })) throw new Error('官方活动发布者已失去管理员权限');
        } else validateJoinedActivity(activities.get(newActivityId), now);
      }
      review.oldActivityId = oldActivityId;
      review.newActivityId = newActivityId;
    }

    let postId = review.postId || '', commentId = '';
    if (decision === 'approve') {
      if (review.kind === 'post') {
        data.createTime = now;
        for (const field of ['createdAt', 'updatedAt', 'updateTime', 'auditTime', 'activityPublishTime', 'joinedActivityAt']) {
          if (isDate(data[field])) data[field] = now;
        }
        data.auditStatus = 'approved';
        data.auditTime = now;
        postId = (await transaction.collection('posts').add({ data }))._id;
        if (quotedPost && review.source === 'createDiscussionPost') await transaction.collection('posts').doc(quotedPost._id).update({ data: { discussionCount: command.inc(1), updateTime: now } });
        if (review.source === 'contentCheck' && !poet && (data.isPoem || data.isSeries) && !data.isOriginal && data.author && data.author.trim()) {
          await transaction.collection('poets').add({ data: { name: data.author.trim(), avatar: '', bio: '', createTime: now, updateTime: now, creatorOpenid: review.submitterOpenid } });
        }
      } else if (review.kind === 'post_edit') {
        data.updateTime = now;
        await transaction.collection('posts').doc(postId).update({ data });
      } else {
        data.createTime = now;
        commentId = (await transaction.collection('comments').add({ data }))._id;
        postId = data.postId;
        await transaction.collection('posts').doc(postId).update({ data: { commentCount: command.inc(1) } });
        const recipient = parentComment ? (parentComment.realAuthorOpenid || parentComment._openid) : resolveOwner(targetPost);
        if (recipient && recipient !== review.submitterOpenid && !data.isAnonymous) {
          const contentType = targetPost.isDiscussion ? 'discussion' : targetPost.isPoem ? (targetPost.isOriginal ? 'original' : 'non-original') : 'post';
          const contentText = { discussion: '讨论', original: '原创诗歌', 'non-original': '诗歌', post: '帖子' }[contentType];
          await transaction.collection('messages').doc(notificationId(reviewId, recipient, 'comment')).set({ data: {
            fromUserId: review.submitterOpenid, fromUserName: data.authorName || user.nickName || '微信用户', fromUserAvatar: data.authorAvatar || '',
            toUserId: recipient, type: 'comment', postId, postTitle: targetPost.title || '无标题', contentType,
            isReply: Boolean(data.parentId), content: data.parentId ? `${data.authorName || '微信用户'} 回复了你的评论` : `${data.authorName || '微信用户'} 评论了你的${contentText}`,
            commentId, isRead: false, createTime: now
          } });
        }
      }
      if (review.oldActivityId !== review.newActivityId) {
        if (review.oldActivityId && activities.get(review.oldActivityId)) await transaction.collection('activities').doc(review.oldActivityId).update({ data: {
          postCount: Math.max(0, (Number(activities.get(review.oldActivityId).postCount) || 0) - 1), updatedAt: now
        } });
        if (review.newActivityId) await transaction.collection('activities').doc(review.newActivityId).update({ data: {
          postCount: command.inc(1), lastPostTime: now, updatedAt: now
        } });
      }
    }
    await ref.update({ data: { status, handledBy: openid, handledAt: now, note, resultPostId: decision === 'approve' ? postId : '', resultCommentId: commentId } });
    await transaction.collection('messages').doc(notificationId(reviewId, review.submitterOpenid, 'result')).set({ data: {
      fromUserId: openid, fromUserName: admin.nickName || '管理员', fromUserAvatar: admin.avatarUrl || '',
      toUserId: review.submitterOpenid, type: decision === 'approve' ? 'content_review_approved' : 'content_review_rejected',
      reviewId, reviewKind: review.kind, postId: decision === 'approve' ? postId : (review.postId || ''),
      commentId, postTitle: review.snapshot.title, note,
      content: decision === 'approve' ? '您提交的内容已通过管理员复核' : `您提交的内容未通过管理员复核${note ? '：' + note : ''}`,
      isRead: false, createTime: now
    } });
    return { success: true, status, postId, commentId };
  });
}

module.exports = { queueModerationReview, listModerationReviews, getModerationReview, resolveModerationReview, postFingerprint };
