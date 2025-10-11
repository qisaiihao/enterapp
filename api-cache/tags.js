import cacheManager from '@/\_utils/cache-manager';
const { cloudCall } = require('@/utils/cloudCall.js');

const ns = cacheManager.namespace('tags', { persistent: true, maxItems: 128 });

export async function getAllTags(context) {
  return ns.getOrFetch('all', async () => {
    const res = await cloudCall('getAllTags', {}, { pageTag: 'tags', context, injectOpenId: false });
    if (res && res.result && res.result.success) {
      return res.result.tags || res.result.list || [];
    }
    return [];
  }, { ttlMs: 30 * 60 * 1000, swrMs: 5 * 60 * 1000 });
}

export function invalidateAllTags() { ns.delete('all'); }

