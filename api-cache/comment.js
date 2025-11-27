/**
 * 评论相关API缓存层
 */
const { cloudCall } = require('../utils/cloudCall.js');

/**
 * 获取评论列表
 * @param {string} postId - 帖子ID
 * @param {Object} options - 额外选项
 * @returns {Promise} 评论列表数据
 */
function getComments(postId, options = {}) {
    if (!postId) {
        return Promise.reject(new Error('帖子ID不能为空'));
    }

    return cloudCall('getComments', {
        postId: postId
    }, Object.assign({
        injectOpenId: true,
        pageTag: 'post-detail',
        ...options
    }));
}

/**
 * 提交评论
 * @param {Object} commentData - 评论数据
 * @param {string} commentData.postId - 帖子ID
 * @param {string} commentData.content - 评论内容
 * @param {Array} commentData.images - 评论图片
 * @param {string} commentData.parentId - 父评论ID（回复时使用）
 * @param {Object} options - 额外选项
 * @returns {Promise} 提交结果
 */
function submitComment(commentData, options = {}) {
    if (!commentData) {
        return Promise.reject(new Error('评论数据不能为空'));
    }

    const { postId, content, images, parentId } = commentData;

    if (!postId) {
        return Promise.reject(new Error('帖子ID不能为空'));
    }

    const hasContent = content && content.trim().length > 0;
    const hasImages = images && images.length > 0;

    if (!hasContent && !hasImages) {
        return Promise.reject(new Error('评论内容不能为空'));
    }

    return cloudCall('addComment', {
        postId: postId,
        content: content ? content.trim() : '',
        images: images || [],
        parentId: parentId || null
    }, Object.assign({
        pageTag: 'post-detail',
        requireAuth: true,
        ...options
    }));
}

/**
 * 删除评论
 * @param {string} commentId - 评论ID
 * @param {string} postId - 帖子ID
 * @param {string} parentId - 父评论ID（删除回复时使用）
 * @param {Object} options - 额外选项
 * @returns {Promise} 删除结果
 */
function deleteComment(commentId, postId, parentId = null, options = {}) {
    if (!commentId) {
        return Promise.reject(new Error('评论ID不能为空'));
    }

    if (!postId) {
        return Promise.reject(new Error('帖子ID不能为空'));
    }

    return cloudCall('deleteComment', {
        commentId: commentId,
        postId: postId,
        parentId: parentId
    }, Object.assign({
        pageTag: 'post-detail',
        requireAuth: true,
        ...options
    }));
}

/**
 * 点赞评论
 * @param {string} commentId - 评论ID
 * @param {string} postId - 帖子ID
 * @param {boolean} isLiked - 是否点赞（可选，云函数会自动切换）
 * @param {Object} options - 额外选项
 * @returns {Promise} 点赞结果
 */
function likeComment(commentId, postId, isLiked, options = {}) {
    if (!commentId) {
        return Promise.reject(new Error('评论ID不能为空'));
    }
    if (!postId) {
        return Promise.reject(new Error('帖子ID不能为空'));
    }

    return cloudCall('likeComment', {
        commentId: commentId,
        postId: postId,
        isLiked: isLiked
    }, Object.assign({
        pageTag: 'post-detail',
        requireAuth: true,
        ...options
    }));
}

/**
 * 获取评论详情
 * @param {string} commentId - 评论ID
 * @param {Object} options - 额外选项
 * @returns {Promise} 评论详情
 */
function getCommentDetail(commentId, options = {}) {
    if (!commentId) {
        return Promise.reject(new Error('评论ID不能为空'));
    }

    return cloudCall('getCommentDetail', {
        commentId: commentId
    }, Object.assign({
        injectOpenId: true,
        pageTag: 'post-detail',
        ...options
    }));
}

/**
 * 举报评论
 * @param {string} commentId - 评论ID
 * @param {string} reason - 举报原因
 * @param {Object} options - 额外选项
 * @returns {Promise} 举报结果
 */
function reportComment(commentId, reason, options = {}) {
    if (!commentId) {
        return Promise.reject(new Error('评论ID不能为空'));
    }

    if (!reason || reason.trim().length === 0) {
        return Promise.reject(new Error('举报原因不能为空'));
    }

    return cloudCall('reportComment', {
        commentId: commentId,
        reason: reason.trim()
    }, Object.assign({
        pageTag: 'post-detail',
        requireAuth: true,
        ...options
    }));
}

/**
 * 获取评论回复列表
 * @param {string} commentId - 评论ID
 * @param {Object} options - 额外选项
 * @returns {Promise} 回复列表
 */
function getCommentReplies(commentId, options = {}) {
    if (!commentId) {
        return Promise.reject(new Error('评论ID不能为空'));
    }

    return cloudCall('getCommentReplies', {
        commentId: commentId
    }, Object.assign({
        injectOpenId: true,
        pageTag: 'post-detail',
        ...options
    }));
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