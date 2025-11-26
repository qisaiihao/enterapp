/**
 * 点赞状态同步工具
 * @deprecated 请使用 @/cache/stores/like-status 代替
 * 
 * 此文件为兼容层，重定向到新的缓存模块
 */
const likeStatusCache = require('../cache/stores/like-status');

/**
 * 从所有相关缓存中同步帖子的点赞状态
 */
function syncLikeStatusForPosts(postIds = []) {
    const result = likeStatusCache.syncToListCaches(postIds);
    return {
        success: result.errors.length === 0,
        updated: result.updated,
        errors: result.errors
    };
}

/**
 * 获取帖子的最新点赞状态
 */
function getLatestLikeStatus(postId) {
    const status = likeStatusCache.getLikeStatus(postId);
    if (status) {
        return { votes: status.votes, isVoted: status.isVoted };
    }
    return null;
}

/**
 * 更新帖子的点赞状态到缓存
 */
function updateLikeStatus(postId, votes, isVoted) {
    likeStatusCache.updateLikeStatus(postId, votes, isVoted);
}

/**
 * 清理过期的点赞状态缓存
 */
function cleanupExpiredLikeStatus() {
    // CacheManager 会自动处理过期，这里保留接口兼容
    console.log('[likeStatusSync] 过期清理由 CacheManager 自动处理');
}

module.exports = {
    syncLikeStatusForPosts,
    updateLikeStatus,
    getLatestLikeStatus,
    cleanupExpiredLikeStatus
};