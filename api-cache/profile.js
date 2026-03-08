import cacheManager from '@/cache/core/manager';

const { callCloudAndUnwrap } = require('./_shared/cloud-wrapper.js');

const ns = cacheManager.namespace('profiles', { persistent: true, maxItems: 256 });

export async function getMyProfile(context) {
  return ns.getOrFetch(
    'me',
    async () => {
      const result = await callCloudAndUnwrap(
        'getMyProfileData',
        {},
        { pageTag: 'profiles', context, injectOpenId: true },
        '获取个人资料失败'
      );
      return result.profile || result.data || {};
    },
    { ttlMs: 30 * 60 * 1000, swrMs: 5 * 60 * 1000 }
  );
}

export function invalidateMyProfile() {
  ns.delete('me');
}

