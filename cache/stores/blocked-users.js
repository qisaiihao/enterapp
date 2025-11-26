/**
 * 屏蔽用户缓存存储
 * 
 * 命名空间: blockedUsers
 * TTL: 5分钟
 * 持久化: 否
 */
const cacheManager = require('../core/manager');

const NS_BLOCKED = cacheManager.namespace('blockedUsers', { persistent: false, maxItems: 500 });
const BLOCKED_TTL_MS = 5 * 60 * 1000; // 5分钟

/**
 * 从缓存获取屏蔽名单
 * @param {string} blockerId - 屏蔽者的 openid
 * @returns {string[]|null} 被屏蔽的用户ID列表
 */
function getCachedBlockedIds(blockerId) {
  if (!blockerId) return null;
  return NS_BLOCKED.get(blockerId) || null;
}

/**
 * 设置缓存
 * @param {string} blockerId - 屏蔽者的 openid
 * @param {string[]} blockedIds - 被屏蔽的用户ID列表
 */
function setCachedBlockedIds(blockerId, blockedIds) {
  if (!blockerId) return;
  NS_BLOCKED.set(blockerId, blockedIds || [], { ttlMs: BLOCKED_TTL_MS });
}

/**
 * 清除指定用户的缓存
 * @param {string} blockerId - 屏蔽者的 openid
 */
function clearCache(blockerId) {
  if (blockerId) {
    NS_BLOCKED.delete(blockerId);
  } else {
    NS_BLOCKED.clear();
  }
}

/**
 * 更新缓存（添加或删除一个被屏蔽用户）
 * @param {string} blockerId - 屏蔽者的 openid
 * @param {string} blockedId - 被屏蔽的用户ID
 * @param {boolean} isBlocked - true 表示添加屏蔽，false 表示取消屏蔽
 */
function updateCache(blockerId, blockedId, isBlocked) {
  if (!blockerId || !blockedId) return;
  
  const blockedIds = NS_BLOCKED.get(blockerId);
  if (!blockedIds) return;
  
  if (isBlocked) {
    if (!blockedIds.includes(blockedId)) {
      blockedIds.push(blockedId);
      setCachedBlockedIds(blockerId, blockedIds);
    }
  } else {
    const index = blockedIds.indexOf(blockedId);
    if (index > -1) {
      blockedIds.splice(index, 1);
      setCachedBlockedIds(blockerId, blockedIds);
    }
  }
}

/**
 * 获取缓存统计信息
 */
function getCacheStats() {
  const keys = NS_BLOCKED.keys();
  return {
    size: keys.length,
    entries: keys.map(key => ({
      blockerId: key,
      blockedCount: (NS_BLOCKED.get(key) || []).length
    }))
  };
}

module.exports = {
  getCachedBlockedIds,
  setCachedBlockedIds,
  clearCache,
  updateCache,
  getCacheStats
};
