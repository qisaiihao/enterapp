// TODO: AI推荐算法暂时停用
// 以下代码已注释，等待后续完善

import cacheManager from '@/cache/core/manager.js';
import { buildCacheKey } from './cache-key-builder.js';
import { cloudCall } from '@/utils/cloudCall.js';

// 内容推荐：诗歌专用
// TTL/SWR 取轻量值，避免旧画像长时间生效
const TTL_MS = 60 * 1000;
const SWR_MS = 30 * 1000;
const REQ_TIMEOUT_MS = 60 * 1000;
const ns = cacheManager.namespace('poem:content-reco', { persistent: true, maxItems: 128 });

/**
 * 获取基于内容的诗歌推荐
 * @param {Object} options
 * @param {number} options.page - 从 0 开始
 * @param {number} options.pageSize - 每页条数
 * @param {Object} options.context - 页面上下文（用于 cloudCall 埋点）
 * @param {boolean} options.forceRefresh - 是否跳过缓存直接请求
 * @param {Array<string>} options.excludePostIds - 需要排除的 postId
 * @param {boolean} options.debugEmbedding - 是否开启 embedding 调试
 * @param {number} options.timeoutMs - 请求超时（毫秒）
 */
async function getContentPoemFeed({
  page = 0,
  pageSize = 10,
  context,
  forceRefresh = false,
  excludePostIds = [],
  debugEmbedding = false,
  timeoutMs
} = {}) {
  // TODO: AI推荐算法暂时停用，返回空数据
  console.log('AI推荐算法已停用');
  return { posts: [], hasMore: false };
  
  /* 以下代码暂时停用
  const baseKey = buildCacheKey({ page, pageSize, mode: 'content' });
  // 排除列表参与 key，避免重复命中
  const key =
    excludePostIds && excludePostIds.length
      ? `${baseKey}:ex:${excludePostIds.sort().join(',')}`
      : baseKey;

  const loader = async () => {
    const res = await cloudCall(
      'getPoemContentFeed',
      {
        skip: page * pageSize,
        limit: pageSize,
        excludePostIds,
        ...(debugEmbedding ? { debugEmbedding: true } : {})
      },
      {
        pageTag: 'poem-content-reco',
        context,
        requireAuth: true,
        timeoutMs: typeof timeoutMs === 'number' ? timeoutMs : REQ_TIMEOUT_MS
      }
    );
    if (res && res.result && res.result.success) {
      return {
        posts: res.result.posts || [],
        hasMore: !!res.result.hasMore,
        debug: res.result.debug
      };
    }
    return { posts: [], hasMore: false };
  };

  if (forceRefresh || debugEmbedding) {
    return loader();
  }

  return ns.getOrFetch(key, loader, { ttlMs: TTL_MS, swrMs: SWR_MS });
  */
}

/**
 * 失效缓存
 */
function invalidateContentPoemFeed({ page, pageSize = 10 } = {}) {
  // TODO: AI推荐算法暂时停用
  console.log('AI推荐算法已停用，无需清理缓存');
  return;
  
  /* 以下代码暂时停用
  if (typeof page === 'number') {
    const key = buildCacheKey({ page, pageSize, mode: 'content' });
    ns.delete(key);
  } else {
    ns.clear();
  }
  */
}

export { getContentPoemFeed, invalidateContentPoemFeed };

