import cacheManager from '@/cache/core/manager.js';
import fileUrlCache from '@/_utils/file-url-cache';
import { normalizeAppBackgroundMode } from '@/utils/appBackground.js';
import { getOpenid } from '@/utils/app-state.js';
import { callCloudAndUnwrap } from './_shared/cloud-wrapper.js';
import { captureFavoriteRead, staleFavoriteError } from '@/cache/favorites.js';
import avatarCache from '@/cache/stores/avatar.js';

// 我的资料缓存
const nsMyInfo = cacheManager.namespace('me:info', { persistent: true, maxItems: 8 });
const PROFILE_TTL_MS = 30 * 60 * 1000;
const PROFILE_SWR_MS = 5 * 60 * 1000;

export async function getMyInfo(context) {
  const userId = getOpenid();
  const user = await nsMyInfo.getOrFetch(
    'me',
    async () => {
      const result = await callCloudAndUnwrap(
        'getMyProfileData',
        {},
        { pageTag: 'me:info', context, injectOpenId: true },
        '获取个人资料失败'
      );
      let user = result.userInfo || result.profile || result.data || {};

      try {
        const av = user && user.avatarUrl;
        if (typeof av === 'string' && av.startsWith('cloud://')) {
          const url = await fileUrlCache.getTempUrl(av);
          const ver = user.updatedAt || user.updateTime || user._updateTime || '';
          user.avatarUrl = ver ? `${url}?v=${encodeURIComponent(ver)}` : url;
        }
      } catch (_) {}

      try {
        const bg = user && user.appBackgroundUrl;
        if (typeof bg === 'string' && bg.startsWith('cloud://')) {
          user.appBackgroundUrl = await fileUrlCache.getTempUrl(bg);
        }
      } catch (_) {}

      if (user) {
        user.appBackgroundMode = normalizeAppBackgroundMode(user.appBackgroundMode, user.appBackgroundUrl);
      }

      return user;
    },
    { ttlMs: PROFILE_TTL_MS, swrMs: PROFILE_SWR_MS }
  );
  // 必须在读取缓存/网络之后合并：包含返回主页 onShow 强刷和保存前的迟到响应。
  // 云文件链接按文件 ID 复用，不为头像再次查询用户资料。
  while (userId && userId === getOpenid()) {
    const saved = avatarCache.getSavedAvatar(userId);
    if (!saved) break;
    const avatarFileID = saved.avatarUrl.startsWith('cloud://') ? saved.avatarUrl : '';
    let avatarUrl = saved.avatarUrl;
    try { if (avatarFileID) avatarUrl = await fileUrlCache.getTempUrl(avatarFileID); } catch (_) {}
    if (saved !== avatarCache.getSavedAvatar(userId)) continue;
    if (userId !== getOpenid()) break;
    // 同步修正已读取的缓存，确认记录过期后也不能重新读出此前缓存的旧头像。
    nsMyInfo.update('me', cached => ({ ...cached, avatarFileID, avatarUrl }));
    return { ...user, avatarFileID, avatarUrl };
  }
  return user;
}

export function invalidateMyInfo() {
  nsMyInfo.delete('me');
}

// 我的帖子分页：按账号、分页和原创筛选隔离，缓存 60 秒；主动刷新跳过缓存。
function nsMyPosts() {
  return cacheManager.namespace('me:posts', { persistent: true, maxItems: 200 });
}

export async function getMyPosts({ page = 0, pageSize = 10, originalOnly = false, context, forceRefresh = false }) {
  const openid = getOpenid();
  const fetchPosts = async () => {
    const result = await callCloudAndUnwrap(
      'getMyProfileData',
      { skip: page * pageSize, limit: pageSize, originalOnly, ...(openid ? { openid } : {}) },
      { pageTag: 'me:posts', context, injectOpenId: true },
      '获取我的帖子失败'
    );
    return result.posts || [];
  };
  // 身份未就绪时不建立可被其他账号复用的缓存。
  if (!openid) return fetchPosts();
  const ns = nsMyPosts();
  const key = `page:${page}:size:${pageSize}:user:${openid}:original:${originalOnly ? 1 : 0}`;
  if (forceRefresh) ns.delete(key);
  return ns.getOrFetch(key, fetchPosts, { ttlMs: 60 * 1000 });
}

export function invalidateMyPosts(page, pageSize = 10) {
  const ns = nsMyPosts();
  if (typeof page === 'number') {
    const prefix = `page:${page}:size:${pageSize}`;
    ns.keys().filter(key => key === prefix || key.startsWith(`${prefix}:`)).forEach(key => ns.delete(key));
    return;
  }
  ns.clear();
}

// 我的收藏分页
function nsFavorites() {
  return cacheManager.namespace('me:favorites', { persistent: true, maxItems: 200 });
}

export async function getMyFavorites({ page = 0, pageSize = 10, context }) {
  const ns = nsFavorites();
  const userId = getOpenid();
  const current = captureFavoriteRead();
  const key = `user:${userId}:page:${page}:size:${pageSize}`;
  const favorites = await ns.getOrFetch(
    key,
    async () => {
      const result = await callCloudAndUnwrap(
        'getMyProfileData',
        {
          action: 'getAllFavorites',
          skip: page * pageSize,
          limit: pageSize
        },
        { pageTag: 'me:favorites', context, injectOpenId: true },
        '获取收藏失败'
      );
      return result.favorites || [];
    },
    { ttlMs: 60 * 1000, swrMs: 0 }
  );
  if (!current()) throw staleFavoriteError();
  return favorites;
}

export function invalidateMyFavorites(page, pageSize = 10) {
  const ns = nsFavorites();
  if (typeof page === 'number') {
    ns.delete(`user:${getOpenid()}:page:${page}:size:${pageSize}`);
    return;
  }
  ns.clear();
}
