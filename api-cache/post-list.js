import cacheManager from '@/_utils/cache-manager';
import { buildCacheKey } from './cache-key-builder.js';
const { cloudCall } = require('@/utils/cloudCall.js');

// 通用帖子列表缓存：TTL 90s + SWR 45s
// 支持不同筛选条件的帖子列表缓存
// 【重要】使用统一的 posts:list 命名空间和 buildCacheKey 函数，实现跨页面缓存共享
const TTL_MS = 90 * 1000;  // 90秒过期
const SWR_MS = 45 * 1000;  // 45秒后台刷新

const ns = cacheManager.namespace('posts:list', { persistent: true, maxItems: 256 });

/**
 * 获取帖子列表（带缓存）
 * @param {Object} options
 * @param {number} options.page - 页码，从0开始
 * @param {number} options.pageSize - 每页数量
 * @param {boolean} options.isPoem - 是否只获取诗歌
 * @param {boolean} options.isOriginal - 是否只获取原创
 * @param {boolean} options.isDiscussion - 是否只获取讨论
 * @param {string} options.tag - 标签筛选
 * @param {boolean} options.excludeAnonymous - 是否排除匿名
 * @param {string} options.author - 按诗人（作者）筛选
 * @param {Object} options.context - 页面上下文
 * @param {boolean} options.forceRefresh - 是否强制刷新（跳过缓存）
 * @param {Function} options.onBackgroundUpdate - SWR后台更新完成回调
 */
export async function getPostList({ 
  page = 0, 
  pageSize = 10, 
  isPoem, 
  isOriginal, 
  isDiscussion, 
  tag, 
  excludeAnonymous,
  author,
  context, 
  forceRefresh = false,
  onBackgroundUpdate
} = {}) {
  const authorSuffix = author ? `:author:${author}` : '';
  const key = buildCacheKey({ page, pageSize, isPoem, isOriginal, isDiscussion, tag, excludeAnonymous }) + authorSuffix;
  
  // 如果强制刷新，使用时间戳作为缓存键的一部分来绕过缓存
  const cacheKey = forceRefresh && page === 0 ? `${key}:ts:${Date.now()}` : key;
  
  console.log('🔍 [post-list-cache] 请求数据 - key:', cacheKey, 'forceRefresh:', forceRefresh, 'params:', {
    page, pageSize, isPoem, isOriginal, isDiscussion, tag, excludeAnonymous, author
  });
  
  // 第一页且强制刷新时，跳过缓存直接调用云函数
  if (page === 0 && forceRefresh) {
    console.log('🔍 [post-list-cache] 第一页强制刷新，跳过缓存直接调用云函数');
    const res = await cloudCall(
      'getPostList',
      {
        skip: page * pageSize,
        limit: pageSize,
        isPoem,
        isOriginal,
        isDiscussion,
        tag,
        excludeAnonymous,
        author
      },
      { pageTag: 'post-list', context }
    );
    if (res && res.result && res.result.success) {
      return res.result.posts || [];
    }
    return [];
  }
  
  // 使用缓存（与 home-posts.js 共享 posts:list 命名空间）
  // 如果其他页面（如首页、mountain、poem-square）已经加载过相同查询条件的数据，这里会直接复用缓存
  // 无需额外调用云函数，提升加载速度并减少服务器压力
  return ns.getOrFetch(
    cacheKey,
    async () => {
      console.log('🔍 [post-list-cache] 缓存未命中，调用云函数 - key:', key);
      const res = await cloudCall(
        'getPostList',
        {
          skip: page * pageSize,
          limit: pageSize,
          isPoem,
          isOriginal,
          isDiscussion,
          tag,
          excludeAnonymous,
          author
        },
        { pageTag: 'post-list', context }
      );
      console.log('🔍 [post-list-cache] 云函数返回 - success:', res?.result?.success, 'posts数量:', res?.result?.posts?.length);
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
 * 清除帖子列表缓存
 * @param {Object} options
 * @param {number} options.page - 页码，如果指定则只清除该页的缓存
 * @param {boolean} options.isPoem - 是否只获取诗歌
 * @param {boolean} options.isOriginal - 是否只获取原创
 * @param {boolean} options.isDiscussion - 是否只获取讨论
 * @param {string} options.tag - 标签筛选
 * @param {boolean} options.excludeAnonymous - 是否排除匿名
 */
export function invalidatePostList({ page, pageSize = 10, isPoem, isOriginal, isDiscussion, tag, excludeAnonymous } = {}) {
  if (typeof page === 'number') {
    // 清除特定条件的特定页缓存
    const key = buildCacheKey({ page, pageSize, isPoem, isOriginal, isDiscussion, tag, excludeAnonymous });
    ns.delete(key);
    console.log(`🔍 [post-list-cache] 清除缓存 - key: ${key}`);
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
    console.log(`🔍 [post-list-cache] 清除缓存 - prefix: ${prefixWithoutPage}, 清除数量: ${keys.filter(k => k.includes(prefixWithoutPage)).length}`);
  }
}

/**
 * 清除所有帖子列表缓存
 */
export function invalidateAllPostList() {
  ns.clear();
  console.log('🔍 [post-list-cache] 清除所有帖子列表缓存');
}

