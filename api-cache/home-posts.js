import cacheManager from '@/_utils/cache-manager';
import { buildCacheKey } from './cache-key-builder.js';
const { cloudCall } = require('@/utils/cloudCall.js');

// 首页广场分页：TTL 90s + SWR 45s
// 【优化】统一使用 posts:list 命名空间，实现跨页面缓存复用
// 与 mountain、poem-square、road 等页面共享缓存
const TTL_MS = 90 * 1000;
const SWR_MS = 45 * 1000;

// 使用统一的 posts:list 命名空间，以便与其他页面共享缓存
const ns = cacheManager.namespace('posts:list', { persistent: true, maxItems: 256 });

/**
 * 获取首页帖子列表（支持筛选条件，复用统一缓存）
 * @param {Object} options
 * @param {number} options.page - 页码，从0开始
 * @param {number} options.pageSize - 每页数量
 * @param {boolean} options.isPoem - 是否只获取诗歌（可选）
 * @param {boolean} options.isOriginal - 是否只获取原创（可选）
 * @param {boolean} options.isDiscussion - 是否只获取讨论（可选）
 * @param {string} options.tag - 标签筛选（可选）
 * @param {boolean} options.excludeAnonymous - 是否排除匿名（可选）
 * @param {Object} options.context - 页面上下文
 * @param {boolean} options.forceRefresh - 是否强制刷新（跳过缓存）
 */
export async function getHomePosts({ 
  page = 0, 
  pageSize = 10, 
  isPoem,
  isOriginal,
  isDiscussion,
  tag,
  excludeAnonymous,
  context, 
  forceRefresh = false 
} = {}) {
  // 构建统一的缓存键
  const key = buildCacheKey({ page, pageSize, isPoem, isOriginal, isDiscussion, tag, excludeAnonymous });
  
  // 如果强制刷新，使用时间戳作为缓存键的一部分来绕过缓存
  const cacheKey = forceRefresh && page === 0 ? `${key}:ts:${Date.now()}` : key;
  
  console.log('🔍 [home-posts] 请求数据 - key:', cacheKey, 'forceRefresh:', forceRefresh, 'params:', {
    page, pageSize, isPoem, isOriginal, isDiscussion, tag, excludeAnonymous
  });
  
  // 第一页且强制刷新时，跳过缓存直接调用云函数
  if (page === 0 && forceRefresh) {
    console.log('🔍 [home-posts] 第一页强制刷新，跳过缓存直接调用云函数');
    const res = await cloudCall(
      'getPostList',
      {
        skip: page * pageSize,
        limit: pageSize,
        isPoem,
        isOriginal,
        isDiscussion,
        tag,
        excludeAnonymous
      },
      { pageTag: 'home', context }
    );
    console.log('🔍 [home-posts] 云函数返回 - success:', res?.result?.success, 'posts数量:', res?.result?.posts?.length);
    if (res && res.result && res.result.success) {
      return res.result.posts || [];
    }
    return [];
  }
  
  // 使用统一缓存（与 post-list.js 共享 posts:list 命名空间）
  // 注意：首页的无筛选条件查询（isPoem/isOriginal 等均为 undefined）会使用 'all' 作为过滤键
  // 这样即使 poem-square 获取了原创诗歌，首页仍然可以独立缓存无筛选的广场数据
  // 但如果首页也需要相同的筛选条件（如 isPoem: true, isOriginal: true），可以直接复用其他页面的缓存！
  return ns.getOrFetch(
    cacheKey,
    async () => {
      console.log('🔍 [home-posts] 缓存未命中，调用云函数 - key:', key);
      const res = await cloudCall(
        'getPostList',
        {
          skip: page * pageSize,
          limit: pageSize,
          isPoem,
          isOriginal,
          isDiscussion,
          tag,
          excludeAnonymous
        },
        { pageTag: 'home', context }
      );
      console.log('🔍 [home-posts] 云函数返回 - success:', res?.result?.success, 'posts数量:', res?.result?.posts?.length);
      if (res && res.result && res.result.success) {
        return res.result.posts || [];
      }
      return [];
    },
    { ttlMs: TTL_MS, swrMs: SWR_MS }
  );
}

/**
 * 清除首页帖子列表缓存（支持筛选条件）
 * @param {Object} options
 * @param {number} options.page - 页码，如果指定则只清除该页的缓存
 * @param {number} options.pageSize - 每页数量
 * @param {boolean} options.isPoem - 是否只获取诗歌
 * @param {boolean} options.isOriginal - 是否只获取原创
 * @param {boolean} options.isDiscussion - 是否只获取讨论
 * @param {string} options.tag - 标签筛选
 * @param {boolean} options.excludeAnonymous - 是否排除匿名
 */
export function invalidateHomePosts({ page, pageSize = 10, isPoem, isOriginal, isDiscussion, tag, excludeAnonymous } = {}) {
  if (typeof page === 'number') {
    // 清除特定条件的特定页缓存
    const key = buildCacheKey({ page, pageSize, isPoem, isOriginal, isDiscussion, tag, excludeAnonymous });
    ns.delete(key);
    console.log(`🔍 [home-posts] 清除缓存 - key: ${key}`);
  } else {
    // 清除所有匹配条件的缓存
    const prefix = buildCacheKey({ page: 0, pageSize, isPoem, isOriginal, isDiscussion, tag, excludeAnonymous });
    const prefixWithoutPage = prefix.replace(/^page:\d+:size:/, '');
    const keys = ns.keys();
    keys.forEach(k => {
      if (k.includes(prefixWithoutPage)) {
        ns.delete(k);
      }
    });
    console.log(`🔍 [home-posts] 清除缓存 - prefix: ${prefixWithoutPage}, 清除数量: ${keys.filter(k => k.includes(prefixWithoutPage)).length}`);
  }
}

