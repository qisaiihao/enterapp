import cacheManager from '@/_utils/cache-manager';
import fileUrlCache from '@/_utils/file-url-cache';

const { callCloudAndUnwrap } = require('./_shared/cloud-wrapper.js');

// 我的资料缓存
const nsMyInfo = cacheManager.namespace('me:info', { persistent: true, maxItems: 8 });
const PROFILE_TTL_MS = 30 * 60 * 1000;
const PROFILE_SWR_MS = 5 * 60 * 1000;

export async function getMyInfo(context) {
  return nsMyInfo.getOrFetch(
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

      return user;
    },
    { ttlMs: PROFILE_TTL_MS, swrMs: PROFILE_SWR_MS }
  );
}

export function invalidateMyInfo() {
  nsMyInfo.delete('me');
}

// 我的帖子分页（保持当前策略：直接请求，不走缓存）
function nsMyPosts() {
  return cacheManager.namespace('me:posts', { persistent: true, maxItems: 200 });
}

export async function getMyPosts({ page = 0, pageSize = 10, context, forceRefresh = false }) { // eslint-disable-line no-unused-vars
  const result = await callCloudAndUnwrap(
    'getMyProfileData',
    { skip: page * pageSize, limit: pageSize },
    { pageTag: 'me:posts', context, injectOpenId: true },
    '获取我的帖子失败'
  );
  return result.posts || [];
}

export function invalidateMyPosts(page, pageSize = 10) {
  const ns = nsMyPosts();
  if (typeof page === 'number') {
    ns.delete(`page:${page}:size:${pageSize}`);
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
  const key = `page:${page}:size:${pageSize}`;
  return ns.getOrFetch(
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
    { ttlMs: 0, swrMs: 0 }
  );
}

export function invalidateMyFavorites(page, pageSize = 10) {
  const ns = nsFavorites();
  if (typeof page === 'number') {
    ns.delete(`page:${page}:size:${pageSize}`);
    return;
  }
  ns.clear();
}
