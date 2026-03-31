import cacheManager from '@/cache/core/manager.js';
import { callCloudAndUnwrap } from './_shared/cloud-wrapper.js';

const ns = cacheManager.namespace('tags', { persistent: true, maxItems: 128 });

async function getAllTags(context) {
  return ns.getOrFetch(
    'all',
    async () => {
      const result = await callCloudAndUnwrap(
        'getAllTags',
        {},
        { pageTag: 'tags', context, injectOpenId: false },
        '获取标签失败'
      );
      return result.tags || result.list || [];
    },
    { ttlMs: 30 * 60 * 1000, swrMs: 5 * 60 * 1000 }
  );
}

function invalidateAllTags() {
  ns.delete('all');
}

const tagsApi = {
  getAllTags,
  invalidateAllTags
};

export {
  getAllTags,
  invalidateAllTags
};

export default tagsApi;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = tagsApi;
  module.exports.default = tagsApi;
}
