/** 资料缓存保留云文件 ID；临时链接由 fileUrlCache 独立续期。 */
import cacheManager from '../core/manager';
import fileUrlCache from '../core/file-url';
import { cloudCall } from '@/utils/cloudCall.js';
import { createCachedBatchReader } from '../core/batch-reader.js';

// 新版本不复用旧缓存里已丢失文件 ID 的临时链接。
const NS_AVATAR = cacheManager.namespace('avatars:v2', { persistent: true, maxItems: 2048 });
const AVATAR_TTL_MS = 6 * 60 * 60 * 1000;
const DISPLAY_URL_TTL_MS = 45 * 60 * 1000;
// 保存后的短期确认记录独立于普通查询缓存，返回主页强刷也不能抹掉它。
const NS_SAVED_AVATAR = cacheManager.namespace('avatars:recent-saves', { persistent: true, maxItems: 8 });
const SAVED_AVATAR_TTL_MS = 5 * 60 * 1000;

class AvatarCache {
  constructor() {
    this.reader = createCachedBatchReader({
      namespace: () => NS_AVATAR,
      ttlMs: AVATAR_TTL_MS,
      fetchBatch: async ids => {
        const res = await this.callCloudFunction('getBatchUserProfiles', { userIds: ids, rawAvatar: true });
        if (!res.result?.success) throw new Error('获取头像失败');
        return Object.fromEntries((res.result.userProfiles || []).filter(user => ids.includes(user?._openid)).map(user => [user._openid, {
          avatarUrl: user.avatarFileID || user.avatarUrl,
          nickName: user.nickName,
          bio: user.bio,
          lastUpdated: Date.now()
        }]));
      }
    });
  }

  callCloudFunction(name, data = {}) {
    return cloudCall(name, data, { pageTag: 'avatarCache' });
  }

  async getUserAvatar(userId) {
    if (!userId) return null;
    return (await this.getBatchUserAvatars([userId]))[userId] || null;
  }

  waitForAvatarLoad(userId) { return this.getUserAvatar(userId); }
  loadUserAvatar(userId) { return this.getUserAvatar(userId); }

  async getBatchUserAvatars(userIds) {
    const values = await this.reader.readMany(userIds);
    const ids = Object.values(values).map(value => value.avatarUrl).filter(url => typeof url === 'string' && url.startsWith('cloud://'));
    let urls = {};
    try { if (ids.length) urls = await fileUrlCache.getTempUrls(ids); } catch (_) {}
    return Object.fromEntries(Object.entries(values).map(([id, value]) => [id, {
      ...value, avatarUrl: urls[value.avatarUrl] || value.avatarUrl
    }]));
  }

  preloadAvatarsFromPosts(posts) {
    if (!Array.isArray(posts) || !posts.length) return;
    const userIds = [...new Set(posts.map(post => post?._openid).filter(Boolean))];
    if (userIds.length) this.getBatchUserAvatars(userIds).catch(() => {});
  }

  updateUserAvatar(userId, avatarData) {
    if (!userId || !avatarData) return false;
    const avatarUrl = avatarData.avatarFileID || avatarData.avatarUrl;
    // 用户主页可能只提供签名 URL，不能按资料的六小时 TTL 保存。
    const ttlMs = typeof avatarUrl === 'string' && avatarUrl.startsWith('cloud://') ? AVATAR_TTL_MS : DISPLAY_URL_TTL_MS;
    NS_AVATAR.set(userId, { ...avatarData, avatarUrl, lastUpdated: Date.now() }, { ttlMs });
    return true;
  }

  rememberSavedAvatar(userId, avatarData) {
    if (!this.updateUserAvatar(userId, avatarData)) return false;
    const avatarUrl = avatarData.avatarFileID || avatarData.avatarUrl;
    NS_SAVED_AVATAR.set(userId, { avatarUrl }, { ttlMs: SAVED_AVATAR_TTL_MS });
    return true;
  }

  getSavedAvatar(userId) {
    return userId ? NS_SAVED_AVATAR.get(userId) : undefined;
  }

  clearUserAvatar(userId) {
    if (!userId) return false;
    NS_AVATAR.delete(userId);
    return true;
  }

  getDefaultAvatar() { return '/static/images/avatar.png'; }
}

const avatarCache = new AvatarCache();
export { avatarCache };
export default avatarCache;
