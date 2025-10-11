import cacheManager from '@/\_utils/cache-manager';
const { cloudCall } = require('@/utils/cloudCall.js');

const ns = cacheManager.namespace('unread', { persistent: false, maxItems: 64 });
const KEY = 'count';

export async function getUnreadCount(context) {
  return ns.getOrFetch(KEY, async () => {
    const res = await cloudCall('getUnreadMessageCount', {}, { pageTag: 'unread', context, injectOpenId: true });
    if (res && res.result && res.result.success) {
      return res.result.count || 0;
    }
    return 0;
  }, { ttlMs: 60 * 1000, swrMs: 60 * 1000 });
}

export function invalidateUnread() {
  ns.delete(KEY);
}

