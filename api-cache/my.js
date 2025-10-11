import cacheManager from '@/\_utils/cache-manager';
const { cloudCall } = require('@/utils/cloudCall.js');

// 当前用户资料（可直接用 api-cache/profile.getMyProfile，但这里保留命名方便聚合）
const nsMyInfo = cacheManager.namespace('me:info', { persistent: true, maxItems: 8 });
export async function getMyInfo(context) {
  return nsMyInfo.getOrFetch('me', async () => {
    const res = await cloudCall('getMyProfileData', {}, { pageTag: 'me:info', context, injectOpenId: true });
    if (res && res.result && (res.result.profile || res.result.data)) {
      return res.result.profile || res.result.data;
    }
    return {};
  }, { ttlMs: 0, swrMs: 0 });
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

