import cacheManager from '@/\_utils/cache-manager';
const { cloudCall } = require('@/utils/cloudCall.js');

// 用户资料缓存（仅在事件触发后失效，不设 TTL）
const nsProfile = cacheManager.namespace('profiles:user', { persistent: true, maxItems: 512 });

export async function getUserInfo(userId, context) {
  const key = `${userId}`;
  return nsProfile.getOrFetch(key, async () => {
    const res = await cloudCall('getUserProfile', { userId, skip: 0, limit: 1 }, { pageTag: 'user-profile:info', context, injectOpenId: true });
    if (res && res.result && res.result.success) {
      return res.result.userInfo || {};
    }
    return {};
  }, { ttlMs: 0, swrMs: 0 });
}

export function invalidateUserInfo(userId) {
  nsProfile.delete(`${userId}`);
}

// 用户帖子分页缓存（仅事件触发时失效，不设 TTL）
function postsNs(userId) {
  return cacheManager.namespace(`userPosts:${userId}`, { persistent: true, maxItems: 200 });
}

export async function getUserPosts({ userId, page = 0, pageSize = 10, context }) {
  const ns = postsNs(userId);
  const key = `page:${page}:size:${pageSize}`;
  return ns.getOrFetch(key, async () => {
    const res = await cloudCall('getUserProfile', { userId, skip: page * pageSize, limit: pageSize }, { pageTag: 'user-profile:posts', context, injectOpenId: true });
    if (res && res.result && res.result.success) {
      return res.result.posts || [];
    }
    return [];
  }, { ttlMs: 0, swrMs: 0 });
}

export function invalidateUserPosts(userId, page, pageSize = 10) {
  const ns = postsNs(userId);
  if (typeof page === 'number') {
    ns.delete(`page:${page}:size:${pageSize}`);
  } else {
    ns.clear();
  }
}

// 用户作品集缓存（仅在事件触发后失效，不设 TTL）
const nsPortfolio = cacheManager.namespace('portfolio:user', { persistent: true, maxItems: 200 });

export async function getUserPortfolios(userId, context) {
  const key = `${userId}`;
  return nsPortfolio.getOrFetch(key, async () => {
    const res = await cloudCall('getUserPortfolio', { userId }, { pageTag: 'user-profile:portfolio', context, injectOpenId: true });
    if (res && res.result && res.result.success) {
      return res.result.folders || [];
    }
    return [];
  }, { ttlMs: 0, swrMs: 0 });
}

export function invalidateUserPortfolios(userId) {
  nsPortfolio.delete(`${userId}`);
}

// 用户收藏分页缓存（仅事件触发时失效，不设 TTL）
function favoritesNs(userId) {
  return cacheManager.namespace(`userFavorites:${userId}`, { persistent: true, maxItems: 200 });
}

export async function getUserFavorites({ userId, page = 0, pageSize = 10, context }) {
  const ns = favoritesNs(userId);
  const key = `page:${page}:size:${pageSize}`;
  return ns.getOrFetch(key, async () => {
    const res = await cloudCall('getUserFavorites', { userId, skip: page * pageSize, limit: pageSize }, { pageTag: 'user-profile:favorites', context, injectOpenId: true });
    if (res && res.result && res.result.success) {
      return res.result.favorites || [];
    }
    return [];
  }, { ttlMs: 0, swrMs: 0 });
}

export function invalidateUserFavorites(userId, page, pageSize = 10) {
  const ns = favoritesNs(userId);
  if (typeof page === 'number') {
    ns.delete(`page:${page}:size:${pageSize}`);
  } else {
    ns.clear();
  }
}

