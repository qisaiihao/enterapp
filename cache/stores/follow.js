/**
 * 关注状态缓存存储
 * 
 * 命名空间: follow:<userId>
 * TTL: 1小时
 * 持久化: 是
 */
import cacheManager from '../core/manager';
import { cloudCall } from '@/utils/cloudCall.js';
import { createCachedBatchReader } from '../core/batch-reader.js';

const FOLLOW_TTL_MS = 60 * 60 * 1000; // 1小时

function nsFollow(currentUserId) {
  return cacheManager.namespace(`follow:${currentUserId}`, { persistent: true, maxItems: 4000 });
}

class FollowCache {
  constructor() {
    this.reader = createCachedBatchReader({
      namespace: nsFollow,
      ttlMs: FOLLOW_TTL_MS,
      fetchBatch: async (ids, currentUserId) => {
        const single = ids.length === 1;
        const res = await this.callCloudFunction(single ? 'follow' : 'getBatchFollowStatus', single
          ? { action: 'checkFollow', targetOpenid: ids[0], openid: currentUserId }
          : { currentUserId, targetUserIds: ids, openid: currentUserId });
        if (!res.result?.success) throw new Error('获取关注状态失败');
        const statuses = single ? [{
          targetUserId: ids[0], isFollowing: res.result.isFollowing,
          isFollowedByAuthor: res.result.isFollower, isMutualFollow: res.result.isMutual
        }] : res.result.followStatuses;
        return Object.fromEntries((statuses || []).filter(status => ids.includes(status?.targetUserId)).map(status => [status.targetUserId, {
          isFollowing: !!status.isFollowing,
          isFollowedByAuthor: !!status.isFollowedByAuthor,
          isMutualFollow: !!status.isMutualFollow,
          lastUpdated: Date.now()
        }]));
      }
    });
  }

  callCloudFunction(name, data = {}) {
    return cloudCall(name, data, { pageTag: 'followCache', requireAuth: true });
  }

  getFollowStatus(currentUserId, targetUserId) {
    if (!currentUserId || !targetUserId || currentUserId === targetUserId) return Promise.resolve(null);
    return this.reader.read(targetUserId, currentUserId);
  }

  // 保留旧方法名，所有读取共用同一进行中请求，不再使用定时器轮询。
  waitForFollowLoad(currentUserId, targetUserId) {
    return this.getFollowStatus(currentUserId, targetUserId);
  }

  loadFollowStatus(currentUserId, targetUserId) {
    return this.getFollowStatus(currentUserId, targetUserId);
  }

  getBatchFollowStatus(currentUserId, targetUserIds) {
    if (!currentUserId) return Promise.resolve({});
    return this.reader.readMany((Array.isArray(targetUserIds) ? targetUserIds : []).filter(id => id !== currentUserId), currentUserId);
  }

  preloadFollowStatusFromPosts(posts, currentUserId) {
    if (!posts || posts.length === 0 || !currentUserId) return;
    const targetUserIds = [...new Set(posts.map((p) => p._openid).filter((id) => id && id !== currentUserId))];
    if (targetUserIds.length === 0) return;
    setTimeout(() => this.getBatchFollowStatus(currentUserId, targetUserIds), 100);
  }

  updateFollowStatus(currentUserId, targetUserId, followData) {
    if (!currentUserId || !targetUserId || !followData) return false;
    try {
      nsFollow(currentUserId).set(targetUserId, { ...followData, lastUpdated: Date.now() }, { ttlMs: FOLLOW_TTL_MS });
      return true;
    } catch (e) {
      return false;
    }
  }

  toggleFollowStatus(currentUserId, targetUserId) {
    if (!currentUserId || !targetUserId || currentUserId === targetUserId) {
      return Promise.resolve(null);
    }
    return new Promise((resolve) => {
      this.callCloudFunction('follow', { action: 'toggleFollow', targetOpenid: targetUserId, openid: currentUserId })
        .then((res) => {
          if (res.result?.success) {
            const followData = {
              isFollowing: !!res.result.isFollowing,
              isFollowedByAuthor: !!res.result.isFollower,
              isMutualFollow: !!res.result.isMutual,
              lastUpdated: Date.now()
            };
            this.updateFollowStatus(currentUserId, targetUserId, followData);
            resolve(followData);
          } else {
            resolve(null);
          }
        })
        .catch(() => resolve(null));
    });
  }

  clearUserFollowCache(userId) {
    if (!userId) return false;
    try {
      nsFollow(userId).clear();
      return true;
    } catch (e) {
      return false;
    }
  }

  clearAllFollowCache() {
    try {
      // 冷缓存请求尚未生成持久索引，也必须失效。
      Object.keys(cacheManager.getStats()).filter(name => name.startsWith('follow:')).forEach(name => {
        cacheManager.namespace(name).clear();
      });
      const info = typeof uni !== 'undefined' ? uni.getStorageInfoSync?.() : null;
      const keys = info?.keys || [];
      keys.forEach((k) => {
        if (typeof k === 'string' && k.startsWith('__cm__:follow:') && k.endsWith(':__keys__')) {
          const ns = k.substring('__cm__:'.length, k.length - ':__keys__'.length);
          try { cacheManager.namespace(ns, { persistent: true }).clear(); } catch (_) {}
        }
      });
      return true;
    } catch (e) {
      return false;
    }
  }
}

const followCache = new FollowCache();

export { followCache };
export default followCache;
