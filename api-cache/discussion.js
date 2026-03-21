import cacheManager from '@/_utils/cache-manager';
import { buildCacheKey } from './cache-key-builder.js';
const { cloudCall } = require('@/utils/cloudCall.js');

// 讨论页帖子：TTL 120s + SWR 60s（讨论内容更新相对较慢，缓存时间可以较长）
const TTL_MS = 120 * 1000;
const SWR_MS = 60 * 1000;

// 使用独立的 discussion:posts 命名空间
const ns = cacheManager.namespace('discussion:posts', { persistent: true, maxItems: 128 });

/**
 * 获取讨论页的帖子列表
 * @param {Object} options
 * @param {number} options.page - 页码，从0开始
 * @param {number} options.pageSize - 每页数量
 * @param {Object} options.context - 页面上下文
 * @param {boolean} options.forceRefresh - 是否强制刷新（跳过缓存）
 * @param {Function} options.onBackgroundUpdate - SWR后台更新完成回调
 */
export async function getDiscussionPosts({
  page = 0,
  pageSize = 10,
  context,
  forceRefresh = false,
  onBackgroundUpdate
} = {}) {
  // 构建缓存键
  const key = buildCacheKey({ page, pageSize });

  console.log(' [discussion] 请求数据 - key:', key, 'forceRefresh:', forceRefresh);

  if (forceRefresh && page === 0) {
    ns.delete(key);
  }

  return ns.getOrFetch(
    key,
    async () => {
      console.log(' [discussion] 缓存未命中，调用云函数 - key:', key);
      const res = await cloudCall(
        'getDiscussionPosts',
        {
          skip: page * pageSize,
          limit: pageSize
        },
        { pageTag: 'discussion', context, requireAuth: false }
      );
      console.log('🔍 [discussion] 云函数返回 - success:', res?.result?.success, 'posts数量:', res?.result?.posts?.length);
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
 * 清除讨论页帖子列表缓存
 * @param {Object} options
 * @param {number} options.page - 页码，如果指定则只清除该页的缓存
 * @param {number} options.pageSize - 每页数量
 */
export function invalidateDiscussionPosts({ page, pageSize = 10 } = {}) {
  if (typeof page === 'number') {
    // 清除特定页的缓存
    const key = buildCacheKey({ page, pageSize });
    ns.delete(key);
    console.log(`🔍 [discussion] 清除缓存 - key: ${key}`);
  } else {
    // 清除所有缓存
    ns.clear();
    console.log(`🔍 [discussion] 清除所有缓存`);
  }
}