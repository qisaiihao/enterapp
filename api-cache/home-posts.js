import cacheManager from '@/cache/core/manager.js';
import { buildCacheKey } from './cache-key-builder.js';
import { cloudCall } from '@/utils/cloudCall.js';
import { withTimeout } from '@/utils/asyncTimeout.js';
import { filterExpiredPublicPosts } from '@/utils/postVisibility.js';

// 首页广场分页：TTL 90s + SWR 45s
// 【优化】统一使用 posts:list 命名空间，实现跨页面缓存复用
// 与 mountain、poem-square、road 等页面共享缓存
const TTL_MS = 90 * 1000;
const SWR_MS = 45 * 1000;

// 使用统一的 posts:list 命名空间，以便与其他页面共享缓存
const ns = cacheManager.namespace('posts:list', { persistent: true, maxItems: 256 });

// 「显示全部」使用加权时间、随机和高赞混排。显式类型或标签筛选按时间排序。
function homeQueryParams(params) {
  const { isPoem, isOriginal, isDiscussion, tag, excludeAnonymous } = params;
  const homeRanking = isPoem === undefined && isOriginal === undefined && isDiscussion === undefined && !tag;
  return { ...params, homeRanking, homeMix: homeRanking && !excludeAnonymous };
}

export function peekHomePosts({ page = 0, pageSize = 10, isPoem, isOriginal, isDiscussion, tag, excludeAnonymous } = {}) {
  return filterExpiredPublicPosts(ns.get(buildCacheKey(homeQueryParams({ page, pageSize, isPoem, isOriginal, isDiscussion, tag, excludeAnonymous }))));
}

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
 * @param {boolean} options.homeRandom - 随机抽取整批广场帖子（跳过缓存）
 * @param {string[]} options.excludePostIds - 本轮已加载的帖子 ID
 * @param {string[]} options.previousPostIds - 刷新前首批帖子 ID
 * @param {Function} options.onBackgroundUpdate - SWR后台更新完成回调
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
  forceRefresh = false,
  homeRandom = false,
  excludePostIds,
  previousPostIds,
  onBackgroundUpdate,
  timeoutMs,
  silent = false
} = {}) {
  const queryParams = homeQueryParams({ isPoem, isOriginal, isDiscussion, tag, excludeAnonymous });
  const random = queryParams.homeMix && homeRandom === true;

  const fetchPosts = async () => {
    const res = await withTimeout(cloudCall(
      'getPostList',
      {
        skip: page * pageSize, limit: pageSize, ...queryParams,
        ...(random ? { homeRandom: true } : {}),
        ...(queryParams.homeMix && page > 0 && Array.isArray(excludePostIds) ? { excludePostIds } : {}),
        ...(queryParams.homeMix && page === 0 && previousPostIds?.length ? { previousPostIds } : {})
      },
      { pageTag: 'home', context, timeoutMs, silent }
    ), timeoutMs);
    if (res && res.result && res.result.success) {
      return res.result.posts || [];
    }
    throw new Error(res?.result?.error?.message || res?.result?.message || '加载帖子失败，请重试');
  };
  if (random || (queryParams.homeMix && page > 0)) return filterExpiredPublicPosts(await fetchPosts());

  const key = buildCacheKey({ page, pageSize, ...queryParams });
  if (page === 0 && (forceRefresh || (queryParams.homeMix && previousPostIds?.length))) {
    ns.delete(key);
  }
  return ns.getOrFetch(key, fetchPosts, { ttlMs: TTL_MS, swrMs: SWR_MS, onBackgroundUpdate })
    .then(filterExpiredPublicPosts);
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
    const key = buildCacheKey(homeQueryParams({ page, pageSize, isPoem, isOriginal, isDiscussion, tag, excludeAnonymous }));
    ns.delete(key);
    console.log(`🔍 [home-posts] 清除缓存 - key: ${key}`);
  } else {
    // 清除所有匹配条件的缓存
    const prefix = buildCacheKey(homeQueryParams({ page: 0, pageSize, isPoem, isOriginal, isDiscussion, tag, excludeAnonymous }));
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
