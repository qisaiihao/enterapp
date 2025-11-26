/**
 * 帖子相关API缓存层
 */
const cacheManager = require('@/cache/core/manager');
const { cloudCall } = require('../utils/cloudCall.js');

// 帖子详情缓存：TTL 2min + SWR 1min
// 详情页访问频繁，但需要保持一定的实时性
const POST_DETAIL_TTL = 2 * 60 * 1000;
const POST_DETAIL_SWR = 60 * 1000;

const nsDetail = cacheManager.namespace('posts:detail', { persistent: true, maxItems: 200 });

/**
 * 获取帖子详情（带缓存）
 * @param {string} postId - 帖子ID
 * @param {Object} options - 额外选项
 * @param {boolean} options.forceRefresh - 是否强制刷新
 * @returns {Promise} 帖子详情数据，格式与原 cloudCall 一致: { result: { success, post, commentCount } }
 */
async function getPostDetail(postId, options = {}) {
    if (!postId) {
        return Promise.reject(new Error('帖子ID不能为空'));
    }

    const { forceRefresh = false, ...cloudOptions } = options;
    
    // 强制刷新时先清除缓存
    if (forceRefresh) {
        nsDetail.delete(postId);
    }

    // 缓存的是 result 内容，返回时包装成原格式
    const cachedResult = await nsDetail.getOrFetch(postId, async () => {
        const res = await cloudCall('getPostDetail', {
            postId: postId
        }, Object.assign({
            injectOpenId: false,
            pageTag: 'post-detail',
            ...cloudOptions
        }));
        
        // 只缓存成功的结果
        if (res && res.result && res.result.success) {
            return res.result;
        }
        // 失败时不缓存，抛出以让外层处理
        throw new Error(res?.result?.message || '获取帖子详情失败');
    }, { ttlMs: POST_DETAIL_TTL, swrMs: POST_DETAIL_SWR });
    
    // 返回与原 cloudCall 一致的格式
    return { result: cachedResult };
}

/**
 * 从列表缓存预填充帖子详情
 * 当从列表页进入详情页时，可以先用列表数据快速显示，再后台刷新完整数据
 * @param {Object} postFromList - 列表中的帖子数据
 */
function prefillPostDetail(postFromList) {
    if (!postFromList || !postFromList._id) return;
    
    const postId = postFromList._id;
    const existing = nsDetail.get(postId);
    
    // 如果缓存中没有，用列表数据预填充（标记为部分数据）
    if (!existing) {
        nsDetail.set(postId, {
            success: true,
            post: { ...postFromList, _partialFromList: true }
        }, { ttlMs: 30 * 1000 }); // 预填充只保留30秒
    }
}

/**
 * 失效帖子详情缓存
 * @param {string} postId - 帖子ID
 */
function invalidatePostDetail(postId) {
    if (postId) {
        nsDetail.delete(postId);
    }
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
    prefillPostDetail,
    invalidatePostDetail,
    updatePostContent,
    deletePost,
    togglePostFavorite,
    recordPostView,
    batchGetPosts,
    getRelatedPosts
};