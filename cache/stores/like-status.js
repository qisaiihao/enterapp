/**
 * 点赞状态缓存存储
 * 
 * 命名空间: like:status
 * TTL: 10分钟
 * 持久化: 是（跨页面同步需要）
 * 
 * 用途：
 * - 存储帖子的点赞状态 { votes, isVoted }
 * - 跨页面同步点赞状态
 * - 减少重复请求
 */
const cacheManager = require('../core/manager');

const NS_LIKE = cacheManager.namespace('like:status', { persistent: true, maxItems: 2000 });
const LIKE_TTL_MS = 10 * 60 * 1000; // 10分钟

// 动态加载 likeIcon，避免循环依赖
let likeIconModule = null;
function getLikeIconModule() {
  if (!likeIconModule) {
    try {
      likeIconModule = require('@/utils/likeIcon');
    } catch (e) {
      likeIconModule = { getLikeIcon: () => '/static/images/icons/like.png' };
    }
  }
  return likeIconModule;
}

/**
 * 获取帖子的点赞状态
 * @param {string} postId - 帖子ID
 * @returns {Object|null} { votes, isVoted, likeIcon } 或 null
 */
function getLikeStatus(postId) {
  if (!postId) return null;
  
  const cached = NS_LIKE.get(postId);
  if (cached) {
    return {
      votes: cached.votes,
      isVoted: cached.isVoted,
      likeIcon: getLikeIconModule().getLikeIcon(cached.votes, cached.isVoted)
    };
  }
  
  return null;
}

/**
 * 更新帖子的点赞状态
 * @param {string} postId - 帖子ID
 * @param {number} votes - 点赞数
 * @param {boolean} isVoted - 是否已点赞
 */
function updateLikeStatus(postId, votes, isVoted) {
  if (!postId) return;
  
  NS_LIKE.set(postId, { 
    votes, 
    isVoted,
    updatedAt: Date.now()
  }, { ttlMs: LIKE_TTL_MS });
  
  console.log(`[like-status] 更新帖子 ${postId}: votes=${votes}, isVoted=${isVoted}`);
}

/**
 * 批量获取点赞状态
 * @param {Array<string>} postIds - 帖子ID数组
 * @returns {Object} { postId: { votes, isVoted, likeIcon } }
 */
function getBatchLikeStatus(postIds) {
  if (!Array.isArray(postIds) || postIds.length === 0) return {};
  
  const result = {};
  postIds.forEach(postId => {
    const status = getLikeStatus(postId);
    if (status) {
      result[postId] = status;
    }
  });
  return result;
}

/**
 * 批量更新点赞状态
 * @param {Object} statusMap - { postId: { votes, isVoted } }
 */
function batchUpdateLikeStatus(statusMap) {
  if (!statusMap || typeof statusMap !== 'object') return;
  
  Object.entries(statusMap).forEach(([postId, status]) => {
    if (status && typeof status.votes === 'number') {
      updateLikeStatus(postId, status.votes, !!status.isVoted);
    }
  });
}

/**
 * 清除指定帖子的点赞状态
 * @param {string} postId - 帖子ID
 */
function clearLikeStatus(postId) {
  if (!postId) return;
  NS_LIKE.delete(postId);
}

/**
 * 清除所有点赞状态缓存
 */
function clearAllLikeStatus() {
  NS_LIKE.clear();
}

/**
 * 将点赞状态同步到帖子列表缓存
 * 遍历所有帖子列表命名空间，更新匹配的帖子
 * @param {Array<string>} postIds - 需要同步的帖子ID数组
 * @returns {Object} { updated: number, errors: Array }
 */
function syncToListCaches(postIds = []) {
  if (!Array.isArray(postIds) || postIds.length === 0) {
    return { updated: 0, errors: [] };
  }
  
  const result = { updated: 0, errors: [] };
  
  try {
    const nsStats = cacheManager.getStats?.() || {};
    const nsNames = Object.keys(nsStats);
    
    // 找到所有帖子列表相关的命名空间
    const targets = nsNames.filter((n) => (
      n === 'posts:list' ||
      n === 'posts:home' ||
      n === 'posts:discover' ||
      n.startsWith('posts:tag:') ||
      n.startsWith('posts:') ||
      n.startsWith('me:posts') ||
      n.startsWith('userPosts:') ||
      n === 'myLikes'
    ));
    
    targets.forEach((nsName) => {
      try {
        const ns = cacheManager.namespace(nsName);
        const keys = ns.keys?.() || [];
        
        keys.forEach((key) => {
          try {
            ns.update(key, (list) => {
              if (!Array.isArray(list)) return list;
              
              let changed = false;
              list.forEach((post) => {
                const postId = post?._id || post?.id;
                if (postId && postIds.includes(postId)) {
                  const status = getLikeStatus(postId);
                  if (status) {
                    post.votes = status.votes;
                    post.isVoted = status.isVoted;
                    post.likeIcon = status.likeIcon;
                    changed = true;
                    result.updated++;
                  }
                }
              });
              
              return changed ? list : list;
            });
          } catch (e) {
            result.errors.push(`更新 ${nsName}:${key} 失败`);
          }
        });
      } catch (e) {
        result.errors.push(`处理 ${nsName} 失败`);
      }
    });
  } catch (e) {
    result.errors.push(`同步失败: ${e.message}`);
  }
  
  return result;
}

/**
 * 从帖子列表预加载点赞状态到缓存
 * @param {Array} posts - 帖子列表
 */
function preloadFromPosts(posts) {
  if (!Array.isArray(posts) || posts.length === 0) return;
  
  posts.forEach(post => {
    const postId = post?._id || post?.id;
    if (postId && typeof post.votes === 'number') {
      // 只有缓存中没有时才写入，避免覆盖更新的状态
      if (!NS_LIKE.get(postId)) {
        NS_LIKE.set(postId, {
          votes: post.votes,
          isVoted: !!post.isVoted,
          updatedAt: Date.now()
        }, { ttlMs: LIKE_TTL_MS });
      }
    }
  });
}

/**
 * 获取缓存统计
 */
function getStats() {
  return {
    size: NS_LIKE.keys().length,
    keys: NS_LIKE.keys()
  };
}

module.exports = {
  getLikeStatus,
  updateLikeStatus,
  getBatchLikeStatus,
  batchUpdateLikeStatus,
  clearLikeStatus,
  clearAllLikeStatus,
  syncToListCaches,
  preloadFromPosts,
  getStats,
  
  // 常量导出
  LIKE_TTL_MS
};
