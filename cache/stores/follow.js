/**
 * 关注状态缓存存储
 * 
 * 命名空间: follow:<userId>
 * TTL: 1小时
 * 持久化: 是
 */
import cacheManager from '../core/manager';
import { cloudCall } from '@/utils/cloudCall.js';

const FOLLOW_TTL_MS = 60 * 60 * 1000; // 1小时

function nsFollow(currentUserId) {
  return cacheManager.namespace(`follow:${currentUserId}`, { persistent: true, maxItems: 4000 });
}

class FollowCache {
  constructor() {
    this.loadingFollows = new Set();
  }

  callCloudFunction(name, data = {}) {
    return cloudCall(name, data, { pageTag: 'followCache', requireAuth: true });
  }

  getFollowStatus(currentUserId, targetUserId) {
    if (!currentUserId || !targetUserId || currentUserId === targetUserId) {
      return Promise.resolve(null);
    }

    const cached = nsFollow(currentUserId).get(targetUserId);
    if (cached) return Promise.resolve(cached);

    const key = `${currentUserId}_${targetUserId}`;
    if (this.loadingFollows.has(key)) {
      return this.waitForFollowLoad(currentUserId, targetUserId);
    }

    return this.loadFollowStatus(currentUserId, targetUserId);
  }

  waitForFollowLoad(currentUserId, targetUserId) {
    return new Promise((resolve) => {
      const key = `${currentUserId}_${targetUserId}`;
      const checkInterval = setInterval(() => {
        if (!this.loadingFollows.has(key)) {
          clearInterval(checkInterval);
          resolve(nsFollow(currentUserId).get(targetUserId));
        }
      }, 100);
      setTimeout(() => {
        clearInterval(checkInterval);
        this.loadingFollows.delete(key);
        resolve(null);
      }, 3000);
    });
  }

  loadFollowStatus(currentUserId, targetUserId) {
    const key = `${currentUserId}_${targetUserId}`;
    this.loadingFollows.add(key);
    return new Promise((resolve) => {
      this.callCloudFunction('follow', { action: 'checkFollow', targetOpenid: targetUserId })
        .then((res) => {
          if (res.result?.success) {
            const followData = {
              isFollowing: !!res.result.isFollowing,
              isFollowedByAuthor: !!res.result.isFollower,
              isMutualFollow: !!res.result.isMutual,
              lastUpdated: Date.now()
            };
            nsFollow(currentUserId).set(targetUserId, followData, { ttlMs: FOLLOW_TTL_MS });
            resolve(followData);
          } else {
            resolve(null);
          }
        })
        .catch(() => resolve(null))
        .finally(() => this.loadingFollows.delete(key));
    });
  }

  getBatchFollowStatus(currentUserId, targetUserIds) {
    if (!currentUserId || !targetUserIds || targetUserIds.length === 0) {
      return Promise.resolve({});
    }
    
    const results = {};
    const needLoadUserIds = [];

    targetUserIds.forEach((targetUserId) => {
      if (targetUserId !== currentUserId) {
        const cached = nsFollow(currentUserId).get(targetUserId);
        if (cached) {
          results[targetUserId] = cached;
        } else {
          needLoadUserIds.push(targetUserId);
        }
      }
    });

    if (needLoadUserIds.length > 0) {
      return new Promise((resolve) => {
        this.callCloudFunction('getBatchFollowStatus', { currentUserId, targetUserIds: needLoadUserIds })
          .then((res) => {
            if (res.result?.success && res.result.followStatuses) {
              res.result.followStatuses.forEach((status) => {
                if (status?.targetUserId) {
                  const followData = {
                    isFollowing: !!status.isFollowing,
                    isFollowedByAuthor: !!status.isFollowedByAuthor,
                    isMutualFollow: !!status.isMutualFollow,
                    lastUpdated: Date.now()
                  };
                  results[status.targetUserId] = followData;
                  nsFollow(currentUserId).set(status.targetUserId, followData, { ttlMs: FOLLOW_TTL_MS });
                }
              });
            }
            resolve(results);
          })
          .catch(() => resolve(results));
      });
    }
    return Promise.resolve(results);
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
      this.callCloudFunction('follow', { action: 'toggleFollow', targetOpenid: targetUserId })
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
      const info = uni.getStorageInfoSync?.();
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
export default followCache;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = followCache;
  module.exports.default = followCache;
}
