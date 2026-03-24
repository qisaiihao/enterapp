/**
 * 评论相关 API 封装
 */
const { callCloudAndUnwrap } = require('./_shared/cloud-wrapper.js');
const { invalidatePostDetail } = require('./post.js');

function getComments(postId, options = {}) {
  if (!postId) {
    return Promise.reject(new Error('帖子ID不能为空'));
  }

  return callCloudAndUnwrap(
    'getComments',
    { postId },
    Object.assign({
      injectOpenId: true,
      pageTag: 'post-detail'
    }, options),
    '获取评论失败'
  );
}

function submitComment(commentData, options = {}) {
  if (!commentData) {
    return Promise.reject(new Error('评论数据不能为空'));
  }

  const { postId, content, images, parentId, replyToAuthorName, isAnonymous } = commentData;
  if (!postId) {
    return Promise.reject(new Error('帖子ID不能为空'));
  }

  const hasContent = content && content.trim().length > 0;
  const hasImages = images && images.length > 0;
  if (!hasContent && !hasImages) {
    return Promise.reject(new Error('评论内容不能为空'));
  }

  let imageUrls = [];
  let originalImageUrls = [];
  if (hasImages) {
    imageUrls = images.map((img) => img.url || img).filter(Boolean);
    originalImageUrls = images.map((img) => img.originalUrl || img.url || img).filter(Boolean);
  }

  return callCloudAndUnwrap(
    'addComment',
    {
      postId,
      content: content ? content.trim() : '',
      imageUrls,
      originalImageUrls,
      parentId: parentId || null,
      replyToAuthorName: replyToAuthorName || null,
      isAnonymous: isAnonymous || false
    },
    Object.assign({
      pageTag: 'post-detail',
      requireAuth: true
    }, options),
    '评论失败'
  ).then((result) => {
    invalidatePostDetail(postId);
    return result;
  });
}

function deleteComment(commentId, postId, parentId = null, options = {}) {
  if (!commentId) {
    return Promise.reject(new Error('评论ID不能为空'));
  }
  if (!postId) {
    return Promise.reject(new Error('帖子ID不能为空'));
  }

  return callCloudAndUnwrap(
    'deleteComment',
    { commentId, postId, parentId },
    Object.assign({
      pageTag: 'post-detail',
      requireAuth: true
    }, options),
    '删除评论失败'
  ).then((result) => {
    invalidatePostDetail(postId);
    return result;
  });
}

function likeComment(commentId, postId, isLiked, options = {}) {
  if (!commentId) {
    return Promise.reject(new Error('评论ID不能为空'));
  }
  if (!postId) {
    return Promise.reject(new Error('帖子ID不能为空'));
  }

  return callCloudAndUnwrap(
    'likeComment',
    { commentId, postId, isLiked },
    Object.assign({
      pageTag: 'post-detail',
      requireAuth: true
    }, options),
    '点赞失败'
  );
}

function getCommentDetail(commentId, options = {}) {
  if (!commentId) {
    return Promise.reject(new Error('评论ID不能为空'));
  }
  return callCloudAndUnwrap(
    'getCommentDetail',
    { commentId },
    Object.assign({
      injectOpenId: true,
      pageTag: 'post-detail'
    }, options),
    '获取评论详情失败'
  );
}

function reportComment(commentId, reason, options = {}) {
  if (!commentId) {
    return Promise.reject(new Error('评论ID不能为空'));
  }
  if (!reason || reason.trim().length === 0) {
    return Promise.reject(new Error('举报原因不能为空'));
  }

  return callCloudAndUnwrap(
    'reportComment',
    { commentId, reason: reason.trim() },
    Object.assign({
      pageTag: 'post-detail',
      requireAuth: true
    }, options),
    '举报失败'
  );
}

function getCommentReplies(commentId, options = {}) {
  if (!commentId) {
    return Promise.reject(new Error('评论ID不能为空'));
  }

  return callCloudAndUnwrap(
    'getCommentReplies',
    { commentId },
    Object.assign({
      injectOpenId: true,
      pageTag: 'post-detail'
    }, options),
    '获取回复失败'
  );
}

module.exports = {
  getComments,
  submitComment,
  deleteComment,
  likeComment,
  getCommentDetail,
  reportComment,
  getCommentReplies
};
