import { buildCacheKey } from './cache-key-builder.js';
import cacheManager from '@/cache/core/manager';
import { callCloudAndUnwrap, callActionAndUnwrap } from './_shared/cloud-wrapper.js';

// Following feed cache: TTL 60s + SWR 30s
const TTL_MS = 60 * 1000;
const SWR_MS = 30 * 1000;

const ns = cacheManager.namespace('following:posts', {
  persistent: true,
  maxItems: 128
});

/**
 * 获取关注流帖子
 * @param {Object} options
 * @param {number} options.page
 * @param {number} options.pageSize
 * @param {Object} options.context
 * @param {boolean} options.forceRefresh
 * @param {Function} options.onBackgroundUpdate
 * @param {string} options.filterByUserId
 */
async function getFollowingPosts({
  page = 0,
  pageSize = 10,
  context,
  forceRefresh = false,
  onBackgroundUpdate,
  filterByUserId
} = {}) {
  const userSuffix = filterByUserId ? `:user:${filterByUserId}` : '';
  const key = `following:${buildCacheKey({ page, pageSize })}${userSuffix}`;

  if (forceRefresh && page === 0) {
    ns.delete(key);
  }

  const cloudParams = {
    skip: page * pageSize,
    limit: pageSize
  };
  if (filterByUserId) {
    cloudParams.filterByUserId = filterByUserId;
  }

  console.log('[following] request', { key, forceRefresh, cloudParams });

  const fetchFollowingPosts = async () => {
    const result = await callCloudAndUnwrap(
      'getFollowingPosts',
      cloudParams,
      { pageTag: 'following', context, requireAuth: true },
      '加载失败'
    );
    return result.posts || [];
  };

  return ns.getOrFetch(
    key,
    () => {
      console.log('[following] cache miss, fetch from cloud', { key });
      return fetchFollowingPosts();
    },
    {
      ttlMs: TTL_MS,
      swrMs: SWR_MS,
      onBackgroundUpdate
    }
  );
}

/**
 * 清理关注流缓存
 * @param {Object} options
 * @param {number} options.page
 * @param {number} options.pageSize
 */
function invalidateFollowingPosts({ page, pageSize = 10 } = {}) {
  if (typeof page === 'number') {
    const key = `following:${buildCacheKey({ page, pageSize })}`;
    ns.delete(key);
    console.log('[following] invalidate page cache', { key });
  } else {
    ns.clear();
    console.log('[following] invalidate all cache');
  }
}

/**
 * 查询关注状态
 * @param {string} targetOpenid
 * @param {Object} options
 */
function checkFollowStatus(targetOpenid, options = {}) {
  if (!targetOpenid) {
    return Promise.reject(new Error('目标用户ID不能为空'));
  }

  return callActionAndUnwrap({
    functionName: 'follow',
    action: 'checkFollow',
    payload: { targetOpenid },
    pageTag: options.pageTag || 'post-detail',
    context: options.context,
    requireAuth: true,
    fallbackMessage: options.fallbackMessage || '查询失败'
  }).then((result) => ({
    success: true,
    isFollowing: !!result.isFollowing,
    isFollower: !!result.isFollower,
    isMutual: !!result.isMutual
  }));
}

/**
 * 切换关注/取消关注
 * @param {string} targetOpenid
 * @param {boolean} isFollow
 * @param {Object} options
 */
function toggleFollowStatus(targetOpenid, isFollow, options = {}) {
  if (!targetOpenid) {
    return Promise.reject(new Error('目标用户ID不能为空'));
  }

  return callActionAndUnwrap({
    functionName: 'follow',
    action: isFollow ? 'follow' : 'unfollow',
    payload: { targetOpenid },
    pageTag: options.pageTag || 'post-detail',
    context: options.context,
    requireAuth: true,
    fallbackMessage: options.fallbackMessage || '操作失败'
  }).then((result) => ({
    success: true,
    isFollowing: !!result.isFollowing,
    isMutual: !!result.isMutual
  }));
}

function toggleFollow(targetOpenid, options = {}) {
  if (!targetOpenid) {
    return Promise.reject(new Error('目标用户ID不能为空'));
  }

  return callActionAndUnwrap({
    functionName: 'follow',
    action: 'toggleFollow',
    payload: { targetOpenid },
    pageTag: options.pageTag || 'messages',
    context: options.context,
    requireAuth: true,
    fallbackMessage: options.fallbackMessage || '操作失败'
  }).then((result) => ({
    success: true,
    isFollowing: !!result.isFollowing,
    isMutual: !!result.isMutual
  }));
}

export {
  getFollowingPosts,
  invalidateFollowingPosts,
  checkFollowStatus,
  toggleFollowStatus,
  toggleFollow
};

export default {
  getFollowingPosts,
  invalidateFollowingPosts,
  checkFollowStatus,
  toggleFollowStatus,
  toggleFollow
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getFollowingPosts,
    invalidateFollowingPosts,
    checkFollowStatus,
    toggleFollowStatus,
    toggleFollow
  };
}
