const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;
const $ = _.aggregate;

/**
 * 在批次内补齐 posts 集合的作者快照与评论数
 * @param {number} event.batchSize 单次处理的文档数量（默认 50）
 * @param {number} event.offset 跳过的文档数量，用于手动分页（默认 0）
 * @param {boolean} event.forceCommentCount 是否强制重算评论数（默认仅当缺失时才计算）
 */
exports.main = async (event) => {
  const { batchSize = 50, offset = 0, forceCommentCount = false } = event || {};

  const postsRes = await db.collection('posts')
    .orderBy('createTime', 'desc')
    .skip(offset)
    .limit(batchSize)
    .get();

  const posts = postsRes.data || [];
  if (posts.length === 0) {
    return {
      success: true,
      processed: 0,
      updated: 0,
      message: '没有更多帖子需要处理'
    };
  }

  const postsNeedingUser = [];
  const postsNeedingComment = [];
  const userIdSet = new Set();

  posts.forEach((post) => {
    const needsAuthorSnapshot = !post.authorNameSnapshot || !post.authorAvatarSnapshot;
    const needsAuthorFields = !post.authorName || !post.authorAvatar;
    if (needsAuthorSnapshot || needsAuthorFields) {
      postsNeedingUser.push(post._id);
      userIdSet.add(post._openid);
    }
    if (forceCommentCount || post.commentCount === undefined || post.commentCount === null) {
      postsNeedingComment.push(post._id);
    }
  });

  let userMap = new Map();
  if (userIdSet.size > 0) {
    const usersRes = await db.collection('users')
      .where({ _openid: _.in(Array.from(userIdSet)) })
      .field({ _openid: true, nickName: true, avatarUrl: true })
      .get();
    userMap = new Map(usersRes.data.map((user) => [user._openid, user]));
  }

  let commentCountMap = new Map();
  if (postsNeedingComment.length > 0) {
    const commentAgg = await db.collection('comments').aggregate()
      .match({ postId: _.in(postsNeedingComment) })
      .group({ _id: '$postId', count: $.sum(1) })
      .end();
    commentCountMap = new Map(commentAgg.list.map((item) => [item._id, item.count]));
  }

  let updated = 0;
  for (const post of posts) {
    const updateData = {};

    if (!post.authorNameSnapshot || !post.authorAvatarSnapshot || !post.authorName || !post.authorAvatar) {
      const user = userMap.get(post._openid) || null;
      const authorName = user && user.nickName ? user.nickName : (post.authorName || post.author || '匿名用户');
      const authorAvatar = user && user.avatarUrl ? user.avatarUrl : (post.authorAvatar || '');
      updateData.authorNameSnapshot = authorName;
      updateData.authorAvatarSnapshot = authorAvatar;
      updateData.authorName = post.authorName || authorName;
      updateData.authorAvatar = post.authorAvatar || authorAvatar;
    }

    if (forceCommentCount || post.commentCount === undefined || post.commentCount === null) {
      const commentCount = commentCountMap.get(post._id) || 0;
      updateData.commentCount = commentCount;
    }

    if (Object.keys(updateData).length > 0) {
      await db.collection('posts').doc(post._id).update({
        data: updateData
      });
      updated += 1;
    }
  }

  return {
    success: true,
    processed: posts.length,
    updated,
    nextOffset: offset + posts.length
  };
};
