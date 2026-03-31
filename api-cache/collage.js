import cacheManager from '@/cache/core/manager.js';
import { buildCacheKey } from './cache-key-builder.js';
import { hydrateTempUrls } from '@/cache/core/hydrate.js';
import { cloudCall } from '@/utils/cloudCall.js';
import likeStatusCache from '@/cache/stores/like-status.js';
import { callCloudAndUnwrap } from './_shared/cloud-wrapper.js';

const TTL_MS = 60 * 1000;
const SWR_MS = 30 * 1000;

const listNs = cacheManager.namespace('posts:collage', { persistent: true, maxItems: 128 });

/**
 * 获取拼贴诗词库
 * @param {Object} options
 * @param {number} options.limit 每组返回数量，默认 10，范围 3-20
 * @param {Array<string>} options.groups 词组类型，默认 ['nouns','verbs','imagery']
 * @param {number} options.seed 可选，前后端复现同一批次
 */
export function getCollageWords(options = {}) {
  const payload = Object.assign(
    {
      mode: 'words',
      limit: 10,
      groups: ['nouns', 'verbs', 'imagery']
    },
    options
  );

  return cloudCall('getCollagePoetry', payload, {
    pageTag: 'collage',
    injectOpenId: false
  });
}

async function fetchCollageListPage({ page, pageSize, context }) {
  const result = await callCloudAndUnwrap(
    'getCollagePoetry',
    { page, pageSize },
    { pageTag: 'collage-square', context, requireAuth: true },
    '加载拼贴诗失败'
  );

  const posts = Array.isArray(result.data) ? result.data : [];
  await hydrateTempUrls(posts);

  try {
    likeStatusCache.preloadFromPosts(posts);
  } catch (error) {
    console.warn('[collage cache] preload like status failed:', error);
  }

  return posts;
}

export async function getCollageList({
  page = 0,
  pageSize = 10,
  context,
  forceRefresh = false,
  onBackgroundUpdate
} = {}) {
  const key = buildCacheKey({ page, pageSize });

  if (forceRefresh && page === 0) {
    listNs.delete(key);
  }

  const posts = await listNs.getOrFetch(
    key,
    () => fetchCollageListPage({ page, pageSize, context }),
    {
      ttlMs: TTL_MS,
      swrMs: SWR_MS,
      onBackgroundUpdate
    }
  );

  const safePosts = Array.isArray(posts) ? posts : [];
  return {
    posts: safePosts,
    hasMore: safePosts.length === pageSize
  };
}

export function invalidateCollageList({ page, pageSize = 10 } = {}) {
  if (typeof page === 'number') {
    listNs.delete(buildCacheKey({ page, pageSize }));
    return;
  }
  listNs.clear();
}
