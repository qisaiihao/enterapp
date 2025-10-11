import cacheManager from '@/\_utils/cache-manager';
const { cloudCall } = require('@/utils/cloudCall.js');

const ns = cacheManager.namespace('profiles', { persistent: true, maxItems: 256 });

export async function getMyProfile(context) {
  const key = 'me';
  return ns.getOrFetch(key, async () => {
    const res = await cloudCall('getMyProfileData', {}, { pageTag: 'profiles', context, injectOpenId: true });
    if (res && res.result && res.result.success) {
      return res.result.profile || res.result.data || {};
    }
    return {};
  }, { ttlMs: 30 * 60 * 1000, swrMs: 5 * 60 * 1000 });
}

export function invalidateMyProfile() {
  ns.delete('me');
}

