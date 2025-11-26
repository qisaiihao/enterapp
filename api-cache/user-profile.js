import cacheManager from '@/cache/core/manager';
const { cloudCall } = require('@/utils/cloudCall.js');

// 用户资料缓存：TTL 5min + SWR 2min
// 使用 TTL 作为兜底，避免事件失效时缓存永不更新
const USER_PROFILE_TTL = 5 * 60 * 1000;  // 5分钟
const USER_PROFILE_SWR = 2 * 60 * 1000;  // 2分钟

const nsProfile = cacheManager.namespace('profiles:user', { persistent: true, maxItems: 512 });

export async function getUserInfo(userId, context) {
  const key = `${userId}`;
  return nsProfile.getOrFetch(key, async () => {
    const res = await cloudCall('getUserProfile', { userId, skip: 0, limit: 1 }, { pageTag: 'user-profile:info', context, injectOpenId: true });
    if (res && res.result && res.result.success) {
      return res.result.userInfo || {};
    }
    return {};
  }, { ttlMs: USER_PROFILE_TTL, swrMs: USER_PROFILE_SWR });
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
  return ns.getOrFetch(key, async () => {
    const res = await cloudCall('getUserProfile', { userId, skip: page * pageSize, limit: pageSize }, { pageTag: 'user-profile:posts', context, injectOpenId: true });
    if (res && res.result && res.result.success) {
      return res.result.posts || [];
    }
    return [];
  }, { ttlMs: USER_POSTS_TTL, swrMs: USER_POSTS_SWR });
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
  console.log('【getUserPortfolios API缓存】禁用缓存，直接调用云函数，userId:', userId);
  const res = await cloudCall('getUserPortfolio', { userId }, { pageTag: 'user-profile:portfolio', context, injectOpenId: true });
  console.log('【getUserPortfolios API缓存】云函数返回结果:', res);
  if (res && res.result && res.result.success) {
    console.log('【getUserPortfolios API缓存】调用成功，返回文件夹数量:', res.result.folders?.length || 0);
    return res.result.folders || [];
  }
  console.log('【getUserPortfolios API缓存】调用失败，返回空数组');
  return [];
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
  return ns.getOrFetch(key, async () => {
    const res = await cloudCall('getUserFavorites', { userId, skip: page * pageSize, limit: pageSize }, { pageTag: 'user-profile:favorites', context, injectOpenId: true });
    if (res && res.result && res.result.success) {
      return res.result.favorites || [];
    }
    return [];
  }, { ttlMs: USER_FAVORITES_TTL, swrMs: USER_FAVORITES_SWR });
}

export function invalidateUserFavorites(userId, page, pageSize = 10) {
  const ns = favoritesNs(userId);
  if (typeof page === 'number') {
    ns.delete(`page:${page}:size:${pageSize}`);
  } else {
    ns.clear();
  }
}

