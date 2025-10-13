import cacheManager from '@/_utils/cache-manager';
import fileUrlCache from '@/_utils/file-url-cache';
const { cloudCall } = require('@/utils/cloudCall.js');

// 当前用户资料（可直接用 api-cache/profile.getMyProfile，但这里保留命名方便聚合）
const nsMyInfo = cacheManager.namespace('me:info', { persistent: true, maxItems: 8 });
const PROFILE_TTL_MS = 30 * 60 * 1000; // 30min
const PROFILE_SWR_MS = 5 * 60 * 1000;   // 5min

export async function getMyInfo(context) {
  return nsMyInfo.getOrFetch(
    'me',
    async () => {
      const res = await cloudCall('getMyProfileData', {}, { pageTag: 'me:info', context, injectOpenId: true });
      const result = (res && res.result) || {};
      let user = result.userInfo || result.profile || result.data || {};
      try {
        const av = user && user.avatarUrl;
        if (typeof av === 'string' && av.startsWith('cloud://')) {
          const url = await fileUrlCache.getTempUrl(av);
          // 带上版本参数，避免跨设备长 TTL 旧图
          const ver = user.updatedAt || user.updateTime || user._updateTime || '';
          user.avatarUrl = ver ? `${url}?v=${encodeURIComponent(ver)}` : url;
        }
      } catch (_) {}
      return user;
    },
    { ttlMs: PROFILE_TTL_MS, swrMs: PROFILE_SWR_MS }
  );
}
export function invalidateMyInfo() { nsMyInfo.delete('me'); }

// 我的帖子分页
function nsMyPosts() { return cacheManager.namespace('me:posts', { persistent: true, maxItems: 200 }); }
export async function getMyPosts({ page = 0, pageSize = 10, context }) {
  const ns = nsMyPosts();
  const key = `page:${page}:size:${pageSize}`;
  return ns.getOrFetch(key, async () => {
    const res = await cloudCall('getMyProfileData', { skip: page * pageSize, limit: pageSize }, { pageTag: 'me:posts', context, injectOpenId: true });
    if (res && res.result && res.result.success) return res.result.posts || [];
    return [];
  }, { ttlMs: 0, swrMs: 0 });
}
export function invalidateMyPosts(page, pageSize = 10) {
  const ns = nsMyPosts();
  if (typeof page === 'number') ns.delete(`page:${page}:size:${pageSize}`); else ns.clear();
}

// 我的收藏分页
function nsFavorites() { return cacheManager.namespace('me:favorites', { persistent: true, maxItems: 200 }); }
export async function getMyFavorites({ page = 0, pageSize = 10, context }) {
  const ns = nsFavorites();
  const key = `page:${page}:size:${pageSize}`;
  return ns.getOrFetch(key, async () => {
    const res = await cloudCall('getMyProfileData', { action: 'getAllFavorites', skip: page * pageSize, limit: pageSize }, { pageTag: 'me:favorites', context, injectOpenId: true });
    if (res && res.result && res.result.success) return res.result.favorites || [];
    return [];
  }, { ttlMs: 0, swrMs: 0 });
}
export function invalidateMyFavorites(page, pageSize = 10) {
  const ns = nsFavorites();
  if (typeof page === 'number') ns.delete(`page:${page}:size:${pageSize}`); else ns.clear();
}
