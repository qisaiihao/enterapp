/**
 * 获取被屏蔽的用户ID列表（共享函数）
 * 使用缓存机制减少数据库查询
 */

const cloud = require('wx-server-sdk');
const path = require('path');
const blockedCache = require(path.resolve(__dirname, './blocked-users-cache'));

/**
 * 获取被屏蔽的用户ID列表
 * @param {string} blockerId - 屏蔽者的 openid
 * @param {object} db - 数据库实例（可选，如果不提供则创建新的）
 * @returns {Promise<string[]>} 被屏蔽的用户ID列表
 */
async function getBlockedUserIds(blockerId, db = null) {
  if (!blockerId) {
    return [];
  }

  // 先尝试从缓存获取
  const cached = blockedCache.getCachedBlockedIds(blockerId);
  if (cached !== null) {
    console.log('✅ [getBlockedUserIds] 从缓存获取，数量:', cached.length);
    return cached;
  }

  // 缓存未命中，从数据库查询
  try {
    // 如果没有提供 db 实例，创建一个
    if (!db) {
      cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
      db = cloud.database();
    }

    const blocksCollection = db.collection('blocks');
    const blocksRes = await blocksCollection.where({
      blockerId
    }).field({ blockedId: true }).get();

    const blockedIds = blocksRes.data.map(item => item.blockedId);
    
    // 写入缓存
    blockedCache.setCachedBlockedIds(blockerId, blockedIds);
    console.log('✅ [getBlockedUserIds] 从数据库查询并缓存，数量:', blockedIds.length);
    
    return blockedIds;
  } catch (error) {
    console.error('❌ [getBlockedUserIds] 获取屏蔽用户列表失败:', error);
    return [];
  }
}

module.exports = getBlockedUserIds;


