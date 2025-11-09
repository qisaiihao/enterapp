/**
 * 屏蔽名单缓存管理器（云函数端）
 * 使用内存缓存减少数据库查询频率
 * 
 * 缓存策略：
 * - 内存缓存，TTL 5分钟
 * - 当用户屏蔽/取消屏蔽时，清除对应 openid 的缓存
 */

// 内存缓存：openid -> { blockedIds: [], timestamp: number }
const cache = new Map();

// 缓存过期时间：5分钟
const CACHE_TTL = 5 * 60 * 1000;

/**
 * 从缓存获取屏蔽名单
 * @param {string} blockerId - 屏蔽者的 openid
 * @returns {string[]|null} 被屏蔽的用户ID列表，如果缓存不存在返回 null
 */
function getCachedBlockedIds(blockerId) {
  if (!blockerId) return null;
  
  const cached = cache.get(blockerId);
  if (!cached) return null;
  
  // 检查是否过期
  const now = Date.now();
  if (now - cached.timestamp > CACHE_TTL) {
    cache.delete(blockerId);
    return null;
  }
  
  return cached.blockedIds;
}

/**
 * 设置缓存
 * @param {string} blockerId - 屏蔽者的 openid
 * @param {string[]} blockedIds - 被屏蔽的用户ID列表
 */
function setCachedBlockedIds(blockerId, blockedIds) {
  if (!blockerId) return;
  
  cache.set(blockerId, {
    blockedIds: blockedIds || [],
    timestamp: Date.now()
  });
}

/**
 * 清除指定用户的缓存
 * @param {string} blockerId - 屏蔽者的 openid
 */
function clearCache(blockerId) {
  if (blockerId) {
    cache.delete(blockerId);
  } else {
    // 如果不指定 blockerId，清除所有缓存（谨慎使用）
    cache.clear();
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
  
  const cached = cache.get(blockerId);
  if (!cached) {
    // 缓存不存在，直接清除（下次查询时会重新加载）
    return;
  }
  
  const blockedIds = cached.blockedIds || [];
  if (isBlocked) {
    // 添加屏蔽
    if (!blockedIds.includes(blockedId)) {
      blockedIds.push(blockedId);
      setCachedBlockedIds(blockerId, blockedIds);
    }
  } else {
    // 取消屏蔽
    const index = blockedIds.indexOf(blockedId);
    if (index > -1) {
      blockedIds.splice(index, 1);
      setCachedBlockedIds(blockerId, blockedIds);
    }
  }
}

/**
 * 获取缓存统计信息（用于调试）
 */
function getCacheStats() {
  return {
    size: cache.size,
    entries: Array.from(cache.keys()).map(key => ({
      blockerId: key,
      blockedCount: cache.get(key)?.blockedIds?.length || 0,
      age: Date.now() - (cache.get(key)?.timestamp || 0)
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

