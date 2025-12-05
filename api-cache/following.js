import cacheManager from '@/_utils/cache-manager';
import { buildCacheKey } from './cache-key-builder.js';
const { cloudCall } = require('@/utils/cloudCall.js');

// 关注页帖子：TTL 60s + SWR 30s（关注页内容更新较快，缓存时间较短）
const TTL_MS = 60 * 1000;
const SWR_MS = 30 * 1000;

// 使用独立的 following:posts 命名空间
const ns = cacheManager.namespace('following:posts', { persistent: true, maxItems: 128 });

/**
 * 获取关注页的帖子列表
 * @param {Object} options
 * @param {number} options.page - 页码，从0开始
 * @param {number} options.pageSize - 每页数量
 * @param {Object} options.context - 页面上下文
 * @param {boolean} options.forceRefresh - 是否强制刷新（跳过缓存）
 * @param {Function} options.onBackgroundUpdate - SWR后台更新完成回调
 */
async function getFollowingPosts({
  page = 0,
  pageSize = 10,
  context,
  forceRefresh = false,
  onBackgroundUpdate
} = {}) {
  // 构建缓存键（添加 following 标识避免与其他页面冲突）
  const key = `following:${buildCacheKey({ page, pageSize })}`;

  // 如果强制刷新，使用时间戳作为缓存键的一部分来绕过缓存
  const cacheKey = forceRefresh && page === 0 ? `${key}:ts:${Date.now()}` : key;

  console.log('🔍 [following] 请求数据 - key:', cacheKey, 'forceRefresh:', forceRefresh);

  // 第一页且强制刷新时，跳过缓存直接调用云函数
  if (page === 0 && forceRefresh) {
    console.log('🔍 [following] 第一页强制刷新，跳过缓存直接调用云函数');
    const res = await cloudCall(
      'getFollowingPosts',
      {
        skip: page * pageSize,
        limit: pageSize
      },
      { pageTag: 'following', context, requireAuth: true }
    );
    console.log('🔍 [following] 云函数返回 - success:', res?.result?.success, 'posts数量:', res?.result?.posts?.length);
    if (res && res.result && res.result.success) {
      return res.result.posts || [];
    }
    return [];
  }

  // 使用缓存
  return ns.getOrFetch(
    cacheKey,
    async () => {
      console.log('🔍 [following] 缓存未命中，调用云函数 - key:', key);
      const res = await cloudCall(
        'getFollowingPosts',
        {
          skip: page * pageSize,
          limit: pageSize
        },
        { pageTag: 'following', context, requireAuth: true }
      );
      console.log('🔍 [following] 云函数返回 - success:', res?.result?.success, 'posts数量:', res?.result?.posts?.length);
      if (res && res.result && res.result.success) {
        return res.result.posts || [];
      }
      return [];
    },
    { 
      ttlMs: TTL_MS, 
      swrMs: SWR_MS,
      onBackgroundUpdate
    }
  );
}

/**
 * 清除关注页帖子列表缓存
 * @param {Object} options
 * @param {number} options.page - 页码，如果指定则只清除该页的缓存
 * @param {number} options.pageSize - 每页数量
 */
function invalidateFollowingPosts({ page, pageSize = 10 } = {}) {
  if (typeof page === 'number') {
    // 清除特定页的缓存
    const key = `following:${buildCacheKey({ page, pageSize })}`;
    ns.delete(key);
    console.log(`🔍 [following] 清除缓存 - key: ${key}`);
  } else {
    // 清除所有缓存
    ns.clear();
    console.log(`🔍 [following] 清除所有缓存`);
  }
}

/**
 * 检查关注状态
 * @param {string} targetOpenid - 目标用户ID
 * @param {Object} options - 额外选项
 * @returns {Promise} 关注状态
 */
function checkFollowStatus(targetOpenid, options = {}) {
  if (!targetOpenid) {
    return Promise.reject(new Error('目标用户ID不能为空'));
  }

  return cloudCall('follow', {
    action: 'checkFollow',
    targetOpenid: targetOpenid
  }, Object.assign({
    pageTag: 'post-detail',
    requireAuth: true,
    ...options
  }));
}

/**
 * 切换关注状态
 * @param {string} targetOpenid - 目标用户ID
 * @param {boolean} isFollow - 是否关注
 * @param {Object} options - 额外选项
 * @returns {Promise} 操作结果
 */
function toggleFollowStatus(targetOpenid, isFollow, options = {}) {
  if (!targetOpenid) {
    return Promise.reject(new Error('目标用户ID不能为空'));
  }

  return cloudCall('follow', {
    action: isFollow ? 'follow' : 'unfollow',
    targetOpenid: targetOpenid
  }, Object.assign({
    pageTag: 'post-detail',
    requireAuth: true,
    ...options
  }));
}

module.exports = {
  getFollowingPosts,
  invalidateFollowingPosts,
  checkFollowStatus,
  toggleFollowStatus
};