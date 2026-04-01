/**
 * 头像缓存存储
 * 
 * 命名空间: avatars
 * TTL: 24小时
 * 持久化: 是
 */
import cacheManager from '../core/manager';
import fileUrlCache from '../core/file-url';
import { cloudCall } from '@/utils/cloudCall.js';

const NS_AVATAR = cacheManager.namespace('avatars', { persistent: true, maxItems: 2048 });
const AVATAR_TTL_MS = 6 * 60 * 60 * 1000; // 6h（平衡实时性和性能）

class AvatarCache {
  constructor() {
    this.loadingAvatars = new Set();
  }

  callCloudFunction(name, data = {}) {
    return cloudCall(name, data, { pageTag: 'avatarCache' });
  }

  getUserAvatar(userId) {
    if (!userId) return Promise.resolve(null);

    const cached = NS_AVATAR.get(userId);
    if (cached) {
      console.log(`【头像缓存】命中缓存: ${userId}`);
      return Promise.resolve(cached);
    }

    if (this.loadingAvatars.has(userId)) {
      return this.waitForAvatarLoad(userId);
    }

    return this.loadUserAvatar(userId);
  }

  waitForAvatarLoad(userId) {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (!this.loadingAvatars.has(userId)) {
          clearInterval(checkInterval);
          resolve(NS_AVATAR.get(userId));
        }
      }, 100);
      setTimeout(() => {
        clearInterval(checkInterval);
        this.loadingAvatars.delete(userId);
        resolve(null);
      }, 5000);
    });
  }

  loadUserAvatar(userId) {
    this.loadingAvatars.add(userId);
    return new Promise((resolve) => {
      this.callCloudFunction('getUserProfile', { userId })
        .then(async (res) => {
          if (res.result?.success && res.result.userInfo) {
            const userInfo = res.result.userInfo;
            let avatarUrl = userInfo.avatarUrl;
            try {
              if (typeof avatarUrl === 'string' && avatarUrl.startsWith('cloud://')) {
                avatarUrl = await fileUrlCache.getTempUrl(avatarUrl);
              }
            } catch (_) {}
            const avatarData = {
              avatarUrl,
              nickName: userInfo.nickName,
              bio: userInfo.bio,
              lastUpdated: Date.now()
            };
            NS_AVATAR.set(userId, avatarData, { ttlMs: AVATAR_TTL_MS });
            resolve(avatarData);
          } else {
            resolve(null);
          }
        })
        .catch(() => resolve(null))
        .finally(() => this.loadingAvatars.delete(userId));
    });
  }

  getBatchUserAvatars(userIds) {
    if (!userIds || userIds.length === 0) return Promise.resolve({});
    
    const results = {};
    const needLoadUserIds = [];

    userIds.forEach((userId) => {
      const cached = NS_AVATAR.get(userId);
      if (cached) {
        results[userId] = cached;
      } else {
        needLoadUserIds.push(userId);
      }
    });

    if (needLoadUserIds.length > 0) {
      return new Promise((resolve) => {
        this.callCloudFunction('getBatchUserProfiles', { userIds: needLoadUserIds })
          .then(async (res) => {
            if (res.result?.success && res.result.userProfiles) {
              for (const userInfo of res.result.userProfiles) {
                if (userInfo?._openid) {
                  let avatarUrl = userInfo.avatarUrl;
                  try {
                    if (typeof avatarUrl === 'string' && avatarUrl.startsWith('cloud://')) {
                      avatarUrl = await fileUrlCache.getTempUrl(avatarUrl);
                    }
                  } catch (_) {}
                  const avatarData = {
                    avatarUrl,
                    nickName: userInfo.nickName,
                    bio: userInfo.bio,
                    lastUpdated: Date.now()
                  };
                  results[userInfo._openid] = avatarData;
                  NS_AVATAR.set(userInfo._openid, avatarData, { ttlMs: AVATAR_TTL_MS });
                }
              }
            }
            resolve(results);
          })
          .catch(() => resolve(results));
      });
    }
    return Promise.resolve(results);
  }

  preloadAvatarsFromPosts(posts) {
    if (!posts || posts.length === 0) return;
    const userIds = [...new Set(posts.map((post) => post._openid).filter(Boolean))];
    if (userIds.length === 0) return;
    setTimeout(() => this.getBatchUserAvatars(userIds), 100);
  }

  updateUserAvatar(userId, avatarData) {
    if (!userId || !avatarData) return false;
    try {
      NS_AVATAR.set(userId, { ...avatarData, lastUpdated: Date.now() }, { ttlMs: AVATAR_TTL_MS });
      return true;
    } catch (e) {
      return false;
    }
  }

  clearUserAvatar(userId) {
    if (!userId) return false;
    try {
      NS_AVATAR.delete(userId);
      return true;
    } catch (e) {
      return false;
    }
  }

  getDefaultAvatar() {
    return '/static/images/avatar.png';
  }
}

const avatarCache = new AvatarCache();

export { avatarCache };
export default avatarCache;
