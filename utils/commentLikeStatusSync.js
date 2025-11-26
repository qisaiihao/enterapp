/**
 * 评论点赞状态缓存
 * 
 * 命名空间: comment:like:status
 * TTL: 10分钟
 * 持久化: 是
 */
const cacheManager = require('../cache/core/manager');

const NS = cacheManager.namespace('comment:like:status', { persistent: true, maxItems: 2000 });
const TTL_MS = 10 * 60 * 1000; // 10分钟

/**
 * 更新评论点赞状态到缓存
 */
function updateCommentLikeCache(commentId, likes, liked) {
  if (!commentId) return;
  try {
    NS.set(String(commentId), { 
      likes: Number(likes) || 0, 
      liked: !!liked, 
      ts: Date.now() 
    }, { ttlMs: TTL_MS });
  } catch (_) {}
}

/**
 * 获取评论的最新点赞状态
 */
function getLatestCommentLike(commentId) {
  if (!commentId) return null;
  try {
    const v = NS.get(String(commentId));
    if (v) {
      return { likes: Number(v.likes) || 0, liked: !!v.liked };
    }
  } catch (_) {}
  return null;
}

/**
 * 持久化到缓存（兼容旧接口，实际已通过 CacheManager 持久化）
 * @deprecated 直接使用 updateCommentLikeCache 即可
 */
function persistToStorage(commentId, likes, liked) {
  // CacheManager 已配置 persistent: true，无需额外持久化
  updateCommentLikeCache(commentId, likes, liked);
}

/**
 * 批量获取评论点赞状态
 */
function getBatchCommentLikes(commentIds) {
  if (!Array.isArray(commentIds) || commentIds.length === 0) return {};
  const result = {};
  commentIds.forEach(id => {
    const status = getLatestCommentLike(id);
    if (status) result[id] = status;
  });
  return result;
}

/**
 * 清除评论点赞状态
 */
function clearCommentLikeCache(commentId) {
  if (!commentId) return;
  try { NS.delete(String(commentId)); } catch (_) {}
}

module.exports = {
  updateCommentLikeCache,
  getLatestCommentLike,
  persistToStorage,
  getBatchCommentLikes,
  clearCommentLikeCache,
};

