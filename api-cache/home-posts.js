import cacheManager from '@/_utils/cache-manager';
const { cloudCall } = require('@/utils/cloudCall.js');

// 首页广场分页：TTL 90s + SWR 45s
const TTL_MS = 90 * 1000;
const SWR_MS = 45 * 1000;

const ns = cacheManager.namespace('posts:home', { persistent: true, maxItems: 128 });

export async function getHomePosts({ page = 0, pageSize = 10, context, forceRefresh = false } = {}) {
  // 第一页不使用缓存，直接调用云函数以确保随机性
  // 其他页使用缓存以提高性能
  const isFirstPage = page === 0;
  
  // 如果强制刷新，使用时间戳作为缓存键的一部分来绕过缓存
  const cacheKeySuffix = (isFirstPage && forceRefresh) ? `:ts:${Date.now()}` : '';
  const key = `page:${page}:size:${pageSize}${cacheKeySuffix}`;
  
  console.log('🔍 [home-posts] 请求数据 - page:', page, 'pageSize:', pageSize, 'forceRefresh:', forceRefresh, 'key:', key, 'isFirstPage:', isFirstPage);
  
  // 第一页：不使用缓存，直接调用云函数以确保每次都是随机的
  if (isFirstPage) {
    console.log('🔍 [home-posts] 第一页，跳过缓存直接调用云函数以确保随机性');
    const res = await cloudCall(
      'getPostList',
      { skip: page * pageSize, limit: pageSize },
      { pageTag: 'home', context }
    );
    console.log('🔍 [home-posts] 云函数返回 - success:', res?.result?.success, 'posts数量:', res?.result?.posts?.length);
    if (res && res.result && res.result.success) {
      return res.result.posts || [];
    }
    return [];
  }
  
  // 其他页：使用缓存
  const cacheTTL = TTL_MS; // 90秒
  const cacheSWR = SWR_MS; // 45秒
  
  return ns.getOrFetch(
    key,
    async () => {
      console.log('🔍 [home-posts] 缓存未命中，调用云函数 - page:', page);
      const res = await cloudCall(
        'getPostList',
        { skip: page * pageSize, limit: pageSize },
        { pageTag: 'home', context }
      );
      console.log('🔍 [home-posts] 云函数返回 - success:', res?.result?.success, 'posts数量:', res?.result?.posts?.length);
      if (res && res.result && res.result.success) {
        return res.result.posts || [];
      }
      return [];
    },
    { ttlMs: cacheTTL, swrMs: cacheSWR }
  );
}

export function invalidateHomePosts({ page, pageSize = 10 } = {}) {
  if (typeof page === 'number') {
    ns.delete(`page:${page}:size:${pageSize}`);
  } else {
    ns.clear();
  }
}

