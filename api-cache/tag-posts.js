import cacheManager from '@/_utils/cache-manager';
const { cloudCall } = require('@/utils/cloudCall.js');

// 标签页分页：TTL 90s + SWR 45s
const TTL_MS = 90 * 1000;
const SWR_MS = 45 * 1000;

function nsForTag(tag) {
  const safe = encodeURIComponent(String(tag || ''));
  return cacheManager.namespace(`posts:tag:${safe}`, { persistent: true, maxItems: 128 });
}

export async function getTagPosts({ tag, page = 0, pageSize = 10, context } = {}) {
  const ns = nsForTag(tag);
  const key = `page:${page}:size:${pageSize}`;
  return ns.getOrFetch(
    key,
    async () => {
      const res = await cloudCall(
        'getPostList',
        { skip: page * pageSize, limit: pageSize, tag },
        { pageTag: `tag:${tag}`, context }
      );
      if (res && res.result && res.result.success) {
        return res.result.posts || [];
      }
      return [];
    },
    { ttlMs: TTL_MS, swrMs: SWR_MS }
  );
}

export function invalidateTagPosts({ tag, page, pageSize = 10 } = {}) {
  const ns = nsForTag(tag);
  if (typeof page === 'number') {
    ns.delete(`page:${page}:size:${pageSize}`);
  } else {
    ns.clear();
  }
}

