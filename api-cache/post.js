/**
 * 帖子相关API缓存层
 */
const { cloudCall } = require('../utils/cloudCall.js');

/**
 * 获取帖子详情
 * @param {string} postId - 帖子ID
 * @param {Object} options - 额外选项
 * @returns {Promise} 帖子详情数据
 */
function getPostDetail(postId, options = {}) {
    if (!postId) {
        return Promise.reject(new Error('帖子ID不能为空'));
    }

    return cloudCall('getPostDetail', {
        postId: postId
    }, Object.assign({
        injectOpenId: false,
        pageTag: 'post-detail',
        ...options
    }));
}

/**
 * 更新帖子内容
 * @param {string} postId - 帖子ID
 * @param {Object} updateData - 更新数据
 * @param {Object} options - 额外选项
 * @returns {Promise} 更新结果
 */
function updatePostContent(postId, updateData, options = {}) {
    if (!postId) {
        return Promise.reject(new Error('帖子ID不能为空'));
    }

    if (!updateData || Object.keys(updateData).length === 0) {
        return Promise.reject(new Error('更新数据不能为空'));
    }

    return cloudCall('updatePostContent', {
        postId: postId,
        ...updateData
    }, Object.assign({
        pageTag: 'post-detail',
        requireAuth: true,
        ...options
    }));
}

/**
 * 删除帖子
 * @param {string} postId - 帖子ID
 * @param {Object} options - 额外选项
 * @returns {Promise} 删除结果
 */
function deletePost(postId, options = {}) {
    if (!postId) {
        return Promise.reject(new Error('帖子ID不能为空'));
    }

    return cloudCall('deletePost', {
        postId: postId
    }, Object.assign({
        pageTag: 'post-detail',
        requireAuth: true,
        ...options
    }));
}

/**
 * 收藏帖子
 * @param {string} postId - 帖子ID
 * @param {boolean} isFavorite - 是否收藏
 * @param {Object} options - 额外选项
 * @returns {Promise} 收藏结果
 */
function togglePostFavorite(postId, isFavorite, options = {}) {
    if (!postId) {
        return Promise.reject(new Error('帖子ID不能为空'));
    }

    return cloudCall('togglePostFavorite', {
        postId: postId,
        isFavorite: isFavorite
    }, Object.assign({
        pageTag: 'post-detail',
        requireAuth: true,
        ...options
    }));
}

/**
 * 记录帖子浏览
 * @param {string} postId - 帖子ID
 * @param {Object} options - 额外选项
 * @returns {Promise} 记录结果
 */
function recordPostView(postId, options = {}) {
    if (!postId) {
        return Promise.reject(new Error('帖子ID不能为空'));
    }

    return cloudCall('recordView', {
        postId: postId,
        timestamp: Date.now()
    }, Object.assign({
        pageTag: 'post-detail',
        injectOpenId: false,
        silent: true, // 静默调用，不显示loading
        ...options
    }));
}

/**
 * 批量获取帖子信息（用于预加载）
 * @param {Array} postIds - 帖子ID数组
 * @param {Object} options - 额外选项
 * @returns {Promise} 批量帖子数据
 */
function batchGetPosts(postIds, options = {}) {
    if (!Array.isArray(postIds) || postIds.length === 0) {
        return Promise.reject(new Error('帖子ID数组不能为空'));
    }

    return cloudCall('batchGetPosts', {
        postIds: postIds
    }, Object.assign({
        pageTag: 'post-detail',
        injectOpenId: false,
        ...options
    }));
}

/**
 * 获取相关推荐帖子
 * @param {string} postId - 当前帖子ID
 * @param {Object} options - 额外选项
 * @returns {Promise} 推荐帖子列表
 */
function getRelatedPosts(postId, options = {}) {
    if (!postId) {
        return Promise.reject(new Error('帖子ID不能为空'));
    }

    return cloudCall('getRelatedPosts', {
        postId: postId
    }, Object.assign({
        pageTag: 'post-detail',
        injectOpenId: false,
        ...options
    }));
}

module.exports = {
    getPostDetail,
    updatePostContent,
    deletePost,
    togglePostFavorite,
    recordPostView,
    batchGetPosts,
    getRelatedPosts
};