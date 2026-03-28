// Shared helper for reading blocked user ids with a small in-memory cache.

const cloud = require('wx-server-sdk');
const path = require('path');
const blockedCache = require(path.resolve(__dirname, './blocked-users-cache'));

async function getBlockedUserIds(blockerId, db = null) {
  if (!blockerId) {
    return [];
  }

  const cached = blockedCache.getCachedBlockedIds(blockerId);
  if (cached !== null) {
    console.log('[getBlockedUserIds] cache hit:', cached.length);
    return cached;
  }

  try {
    if (!db) {
      cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
      db = cloud.database();
    }

    const blocksCollection = db.collection('blocks');
    const blocksRes = await blocksCollection.where({
      blockerId
    }).field({ blockedId: true }).get();

    const blockedIds = blocksRes.data.map(item => item.blockedId);

    blockedCache.setCachedBlockedIds(blockerId, blockedIds);
    console.log('[getBlockedUserIds] database hit:', blockedIds.length);

    return blockedIds;
  } catch (error) {
    console.error('[getBlockedUserIds] failed to load blocked ids:', error);
    return [];
  }
}

module.exports = getBlockedUserIds;
