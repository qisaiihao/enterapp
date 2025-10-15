import cacheManager from '@/_utils/cache-manager';
const { cloudCall } = require('@/utils/cloudCall.js');

// 发现页推荐：TTL 90s + SWR 45s（范围内可调整）
const TTL_MS = 90 * 1000;
const SWR_MS = 45 * 1000;

const ns = cacheManager.namespace('posts:discover', { persistent: true, maxItems: 64 });

function makeExcludeKey(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return 'ex:none';
  try {
    const uniq = Array.from(new Set(arr.map(String)));
    uniq.sort();
    // 为避免 key 过长，只保留前 50 个（足够覆盖单页去重场景）
    const head = uniq.slice(0, 50);
    return 'ex:' + head.join(',');
  } catch (_) {
    return 'ex:err';
  }
}

export async function getDiscoverFeed({ excludePostIds = [], page = 0, pageSize = 5, context } = {}) {
  const key = `page:${page}:${makeExcludeKey(excludePostIds)}`;
  return ns.getOrFetch(
    key,
    async () => {
      const res = await cloudCall('getRecommendationFeed', {
        limit: pageSize,
        personalizedLimit: 3,
        hotLimit: 2,
        skip: 0,
        excludePostIds: excludePostIds || []
      }, { pageTag: 'discover', context });
      if (res && res.result && res.result.success) {
        return {
          posts: res.result.posts || [],
          hasMore: !!res.result.hasMore
        };
      }
      return { posts: [], hasMore: false };
    },
    { ttlMs: TTL_MS, swrMs: SWR_MS }
  );
}

export function invalidateDiscover() {
  ns.clear();
}

export function clearDiscoverCache() {
  ns.clear();
}

