import cacheManager from '@/_utils/cache-manager';
import { buildCacheKey } from './cache-key-builder.js';
const { cloudCall } = require('@/utils/cloudCall.js');

// 诗歌相关API缓存：TTL 75s + SWR 30s (诗歌更新频率适中)
const TTL_MS = 75 * 1000;
const SWR_MS = 30 * 1000;

// 使用独立的 poems:following 命名空间
const followingNs = cacheManager.namespace('poems:following', { persistent: true, maxItems: 128 });

/**
 * 获取关注用户的诗歌帖子列表
 * @param {Object} options
 * @param {number} options.page - 页码，从0开始
 * @param {number} options.pageSize - 每页数量
 * @param {Object} options.context - 页面上下文
 * @param {boolean} options.forceRefresh - 是否强制刷新（跳过缓存）
 * @param {Function} options.onBackgroundUpdate - SWR后台更新完成回调
 * @param {string} options.filterByUserId - 筛选特定用户的诗歌
 */
async function getFollowingPoems({
  page = 0,
  pageSize = 10,
  context,
  forceRefresh = false,
  onBackgroundUpdate,
  filterByUserId
} = {}) {
  // 构建缓存键（添加用户筛选）
  const userSuffix = filterByUserId ? `:user:${filterByUserId}` : '';
  const key = buildCacheKey({ page, pageSize }) + userSuffix;

  // 如果强制刷新，使用时间戳作为缓存键的一部分来绕过缓存
  const cacheKey = forceRefresh && page === 0 ? `${key}:ts:${Date.now()}` : key;

  console.log('🔍 [poems] 请求数据 - key:', cacheKey, 'forceRefresh:', forceRefresh);

  // 第一页且强制刷新时，跳过缓存直接调用云函数
  if (page === 0 && forceRefresh) {
    console.log('🔍 [poems] 第一页强制刷新，跳过缓存直接调用云函数');
    const cloudParams = {
      skip: page * pageSize,
      limit: pageSize,
      excludeAnonymous: true,
      isPoem: true,
      isOriginal: true
    };
    if (filterByUserId) {
      cloudParams.filterByUserId = filterByUserId;
    }
    const res = await cloudCall(
      'getFollowingPosts',
      cloudParams,
      { pageTag: 'poems', context, requireAuth: true }
    );
    console.log('🔍 [poems] 云函数返回 - success:', res?.result?.success, 'posts数量:', res?.result?.posts?.length);
    if (res && res.result && res.result.success) {
      return res.result.posts || [];
    }
    return [];
  }

  // 使用缓存
  return followingNs.getOrFetch(
    cacheKey,
    async () => {
      console.log('🔍 [poems] 缓存未命中，调用云函数 - key:', key);
      const cloudParams = {
        skip: page * pageSize,
        limit: pageSize,
        excludeAnonymous: true,
        isPoem: true,
        isOriginal: true
      };
      if (filterByUserId) {
        cloudParams.filterByUserId = filterByUserId;
      }
      const res = await cloudCall(
        'getFollowingPosts',
        cloudParams,
        { pageTag: 'poems', context, requireAuth: true }
      );
      console.log('🔍 [poems] 云函数返回 - success:', res?.result?.success, 'posts数量:', res?.result?.posts?.length);
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
 * 清除关注用户诗歌缓存
 * @param {Object} options
 * @param {number} options.page - 页码，如果指定则只清除该页的缓存
 * @param {number} options.pageSize - 每页数量
 */
function invalidateFollowingPoems({ page, pageSize = 10 } = {}) {
  if (typeof page === 'number') {
    // 清除特定页的缓存
    const key = buildCacheKey({ page, pageSize });
    followingNs.delete(key);
    console.log(`🔍 [poems] 清除关注诗歌缓存 - key: ${key}`);
  } else {
    // 清除所有缓存
    followingNs.clear();
    console.log(`🔍 [poems] 清除所有关注诗歌缓存`);
  }
}

/**
 * 获取原创诗歌（square模式）
 * 使用通用的 post-list 缓存，但提供更语义化的接口
 * @param {Object} options
 * @param {number} options.page - 页码，从0开始
 * @param {number} options.pageSize - 每页数量
 * @param {Object} options.context - 页面上下文
 * @param {boolean} options.forceRefresh - 是否强制刷新（跳过缓存）
 * @param {Function} options.onBackgroundUpdate - SWR后台更新完成回调
 */
async function getOriginalPoems({
  page = 0,
  pageSize = 10,
  context,
  forceRefresh = false,
  onBackgroundUpdate
} = {}) {
  const { getPostList } = require('./post-list.js');

  return getPostList({
    page,
    pageSize,
    isPoem: true,
    isOriginal: true,
    excludeAnonymous: true,
    context,
    forceRefresh,
    onBackgroundUpdate
  });
}

/**
 * 获取山诗（非原创诗歌）
 * 使用通用的 post-list 缓存，但提供更语义化的接口
 * @param {Object} options
 * @param {number} options.page - 页码，从0开始
 * @param {number} options.pageSize - 每页数量
 * @param {Object} options.context - 页面上下文
 * @param {boolean} options.forceRefresh - 是否强制刷新（跳过缓存）
 * @param {Function} options.onBackgroundUpdate - SWR后台更新完成回调
 * @param {string} options.filterByPoet - 按诗人筛选
 */
async function getMountainPoems({
  page = 0,
  pageSize = 10,
  context,
  forceRefresh = false,
  onBackgroundUpdate,
  filterByPoet
} = {}) {
  const { getPostList } = require('./post-list.js');

  return getPostList({
    page,
    pageSize,
    isPoem: true,
    isOriginal: false,
    excludeAnonymous: true,
    author: filterByPoet,
    context,
    forceRefresh,
    onBackgroundUpdate
  });
}

module.exports = {
  getFollowingPoems,
  invalidateFollowingPoems,
  getOriginalPoems,
  getMountainPoems
};