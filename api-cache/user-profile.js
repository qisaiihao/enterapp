import cacheManager from '@/cache/core/manager';

const { callCloudAndUnwrap } = require('./_shared/cloud-wrapper.js');

// 用户资料缓存：TTL 5min + SWR 2min
const USER_PROFILE_TTL = 5 * 60 * 1000;
const USER_PROFILE_SWR = 2 * 60 * 1000;

const nsProfile = cacheManager.namespace('profiles:user', { persistent: true, maxItems: 512 });

export async function getUserInfo(userId, context) {
  const key = `${userId}`;
  return nsProfile.getOrFetch(
    key,
    async () => {
      const result = await callCloudAndUnwrap(
        'getUserProfile',
        { userId, skip: 0, limit: 1 },
        { pageTag: 'user-profile:info', context, injectOpenId: true },
        '获取用户信息失败'
      );
      return result.userInfo || {};
    },
    { ttlMs: USER_PROFILE_TTL, swrMs: USER_PROFILE_SWR }
  );
}

export function invalidateUserInfo(userId) {
  nsProfile.delete(`${userId}`);
}

// 用户帖子分页缓存：TTL 2min + SWR 1min
const USER_POSTS_TTL = 2 * 60 * 1000;
const USER_POSTS_SWR = 60 * 1000;

function postsNs(userId) {
  return cacheManager.namespace(`userPosts:${userId}`, { persistent: true, maxItems: 200 });
}

export async function getUserPosts({ userId, page = 0, pageSize = 10, context }) {
  const ns = postsNs(userId);
  const key = `page:${page}:size:${pageSize}`;
  return ns.getOrFetch(
    key,
    async () => {
      const result = await callCloudAndUnwrap(
        'getUserProfile',
        { userId, skip: page * pageSize, limit: pageSize },
        { pageTag: 'user-profile:posts', context, injectOpenId: true },
        '获取用户帖子失败'
      );
      return result.posts || [];
    },
    { ttlMs: USER_POSTS_TTL, swrMs: USER_POSTS_SWR }
  );
}

export function invalidateUserPosts(userId, page, pageSize = 10) {
  const ns = postsNs(userId);
  if (typeof page === 'number') {
    ns.delete(`page:${page}:size:${pageSize}`);
    return;
  }
  ns.clear();
}

// 用户作品集缓存（保持与当前行为一致：每次直接请求）
const nsPortfolio = cacheManager.namespace('portfolio:user', { persistent: true, maxItems: 200 });

export async function getUserPortfolios(userId, context) {
  const result = await callCloudAndUnwrap(
    'getUserPortfolio',
    { userId },
    { pageTag: 'user-profile:portfolio', context, injectOpenId: true },
    '获取作品集失败'
  );
  return result.folders || [];
}

export function invalidateUserPortfolios(userId) {
  nsPortfolio.delete(`${userId}`);
}

// 用户收藏分页缓存：TTL 2min + SWR 1min
const USER_FAVORITES_TTL = 2 * 60 * 1000;
const USER_FAVORITES_SWR = 60 * 1000;

function favoritesNs(userId) {
  return cacheManager.namespace(`userFavorites:${userId}`, { persistent: true, maxItems: 200 });
}

export async function getUserFavorites({ userId, page = 0, pageSize = 10, context }) {
  const ns = favoritesNs(userId);
  const key = `page:${page}:size:${pageSize}`;
  return ns.getOrFetch(
    key,
    async () => {
      const result = await callCloudAndUnwrap(
        'getUserFavorites',
        { userId, skip: page * pageSize, limit: pageSize },
        { pageTag: 'user-profile:favorites', context, injectOpenId: true },
        '获取收藏失败'
      );
      return result.favorites || [];
    },
    { ttlMs: USER_FAVORITES_TTL, swrMs: USER_FAVORITES_SWR }
  );
}

export function invalidateUserFavorites(userId, page, pageSize = 10) {
  const ns = favoritesNs(userId);
  if (typeof page === 'number') {
    ns.delete(`page:${page}:size:${pageSize}`);
    return;
  }
  ns.clear();
}

