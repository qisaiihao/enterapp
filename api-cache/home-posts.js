import cacheManager from '@/_utils/cache-manager';
const { cloudCall } = require('@/utils/cloudCall.js');

// 首页广场分页：TTL 90s + SWR 45s
const TTL_MS = 90 * 1000;
const SWR_MS = 45 * 1000;

const ns = cacheManager.namespace('posts:home', { persistent: true, maxItems: 128 });

export async function getHomePosts({ page = 0, pageSize = 10, context } = {}) {
  const key = `page:${page}:size:${pageSize}`;
  return ns.getOrFetch(
    key,
    async () => {
      const res = await cloudCall(
        'getPostList',
        { skip: page * pageSize, limit: pageSize },
        { pageTag: 'home', context }
      );
      if (res && res.result && res.result.success) {
        return res.result.posts || [];
      }
      return [];
    },
    { ttlMs: TTL_MS, swrMs: SWR_MS }
  );
}

export function invalidateHomePosts({ page, pageSize = 10 } = {}) {
  if (typeof page === 'number') {
    ns.delete(`page:${page}:size:${pageSize}`);
  } else {
    ns.clear();
  }
}

