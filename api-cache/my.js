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
// 展示快照与网络缓存分开：刷新失败仍可先显示上次成功的数据。
const nsProfileDisplay = cacheManager.namespace('me:display:v1', { persistent: true, maxItems: 40 });
const nsFollowerCount = cacheManager.namespace('me:followers', { persistent: true, maxItems: 8 });
const DISPLAY_TTL_MS = 24 * 60 * 60 * 1000;
const FOLLOWER_TTL_MS = 60 * 1000;
let infoRevision = 0;
let postsRevision = 0;
let followerRevision = 0;

function displayKey(kind, userId, pageSize = 10, originalOnly = false) {
  return `${kind}:user:${userId}${kind === 'posts' ? `:size:${pageSize}:original:${originalOnly ? 1 : 0}` : ''}`;
}

export function getCachedMyProfile({ pageSize = 10, originalOnly = false } = {}) {
  const userId = getOpenid();
  if (!userId) return {};
  const header = nsProfileDisplay.get(displayKey('header', userId));
  const posts = nsProfileDisplay.get(displayKey('posts', userId, pageSize, originalOnly));
  const followers = nsProfileDisplay.get(displayKey('followers', userId));
  return {
    userId,
    userInfo: header && header.userId === userId ? header.value : undefined,
    posts: posts && posts.userId === userId ? posts.value : undefined,
    followerCount: followers && followers.userId === userId ? followers.value : undefined,
    refreshedAt: header && posts && header.userId === userId && posts.userId === userId
      ? Math.min(header.fetchedAt, posts.fetchedAt) : 0
  };
}

function rememberProfileDisplay(kind, userId, value, pageSize, originalOnly) {
  if (!userId || userId !== getOpenid()) return;
  nsProfileDisplay.set(displayKey(kind, userId, pageSize, originalOnly), {
    userId, value, fetchedAt: Date.now()
  }, { ttlMs: DISPLAY_TTL_MS });
}

export async function getMyInfo(context, { forceRefresh = false } = {}) {
  const userId = getOpenid();
  const key = `user:${userId}`;
  if (forceRefresh) {
    infoRevision += 1;
    nsMyInfo.delete(key);
  }
  const revision = infoRevision;
  let fetched = false;
  const user = await nsMyInfo.getOrFetch(
    key,
    async () => {
      const result = await callCloudAndUnwrap(
        'getMyProfileData',
        userId ? { openid: userId } : {},
        { pageTag: 'me:info', context, injectOpenId: true },
        '获取个人资料失败'
      );
      let user = { ...(result.userInfo || result.profile || result.data || {}), ...(userId ? { _openid: userId } : {}) };

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

      if (userId !== getOpenid()) throw new Error('个人资料账号已切换');
      fetched = true;
      return user;
    },
    { ttlMs: PROFILE_TTL_MS, swrMs: PROFILE_SWR_MS }
  );
  if (userId !== getOpenid()) throw new Error('个人资料账号已切换');
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
    nsMyInfo.update(key, cached => ({ ...cached, avatarFileID, avatarUrl }));
    const confirmedUser = { ...user, avatarFileID, avatarUrl };
    if (fetched && revision === infoRevision) rememberProfileDisplay('header', userId, confirmedUser);
    return confirmedUser;
  }
  if (fetched && revision === infoRevision) rememberProfileDisplay('header', userId, user);
  return user;
}

export function invalidateMyInfo() {
  infoRevision += 1;
  nsMyInfo.delete('me');
  const userId = getOpenid();
  nsMyInfo.delete(`user:${userId}`);
  nsProfileDisplay.delete(displayKey('header', userId));
}

export async function getMyFollowerCount(context, { forceRefresh = false } = {}) {
  const userId = getOpenid();
  if (!userId) throw new Error('无法获取用户openid');
  const key = `user:${userId}`;
  if (forceRefresh) {
    followerRevision += 1;
    nsFollowerCount.delete(key);
  }
  const revision = followerRevision;
  return nsFollowerCount.getOrFetch(key, async () => {
    const result = await callCloudAndUnwrap('follow', {
      action: 'getFollowerList', skip: 0, limit: 1, openid: userId
    }, { pageTag: 'profile:follower-count', context, requireAuth: true }, '获取粉丝数量失败');
    if (userId !== getOpenid()) throw new Error('粉丝数量账号已切换');
    const total = typeof result.total === 'number' ? result.total : 0;
    if (revision === followerRevision) rememberProfileDisplay('followers', userId, total);
    return total;
  }, { ttlMs: FOLLOWER_TTL_MS });
}

// 我的帖子分页：按账号、分页和原创筛选隔离，缓存 60 秒；主动刷新跳过缓存。
function nsMyPosts() {
  return cacheManager.namespace('me:posts', { persistent: true, maxItems: 200 });
}

export async function getMyPosts({ page = 0, pageSize = 10, originalOnly = false, context, forceRefresh = false }) {
  const openid = getOpenid();
  if (forceRefresh) postsRevision += 1;
  const revision = postsRevision;
  const fetchPosts = async () => {
    const result = await callCloudAndUnwrap(
      'getMyProfileData',
      { skip: page * pageSize, limit: pageSize, originalOnly, ...(openid ? { openid } : {}) },
      { pageTag: 'me:posts', context, injectOpenId: true },
      '获取我的帖子失败'
    );
    if (openid !== getOpenid()) throw new Error('帖子账号已切换');
    const posts = result.posts || [];
    if (page === 0 && revision === postsRevision) rememberProfileDisplay('posts', openid, posts, pageSize, originalOnly);
    return posts;
  };
  // 身份未就绪时不建立可被其他账号复用的缓存。
  if (!openid) return fetchPosts();
  const ns = nsMyPosts();
  const key = `page:${page}:size:${pageSize}:user:${openid}:original:${originalOnly ? 1 : 0}`;
  if (forceRefresh) ns.delete(key);
  return ns.getOrFetch(key, fetchPosts, { ttlMs: 60 * 1000 });
}

export function invalidateMyPosts(page, pageSize = 10) {
  postsRevision += 1;
  const ns = nsMyPosts();
  const userId = getOpenid();
  if (typeof page !== 'number' || page === 0) {
    nsProfileDisplay.keys().filter(key => key.startsWith(`posts:user:${userId}:`)).forEach(key => nsProfileDisplay.delete(key));
  }
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
