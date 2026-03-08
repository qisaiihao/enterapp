import cacheManager from '@/cache/core/manager';

const { emitUnreadChanged } = require('@/utils/events.js');
const { callCloudAndUnwrap } = require('./_shared/cloud-wrapper.js');

const ns = cacheManager.namespace('unread', { persistent: false, maxItems: 64 });
const KEY = 'count';

export async function getUnreadCount(context) {
  return ns.getOrFetch(
    KEY,
    async () => {
      const result = await callCloudAndUnwrap(
        'getUnreadMessageCount',
        {},
        { pageTag: 'unread', context, injectOpenId: true },
        '获取未读数失败'
      );
      return result.count || 0;
    },
    { ttlMs: 30 * 1000, swrMs: 30 * 1000 }
  );
}

export function invalidateUnread() {
  ns.delete(KEY);
  try {
    callCloudAndUnwrap(
      'getUnreadMessageCount',
      {},
      { pageTag: 'unread:refresh', injectOpenId: true },
      '获取未读数失败'
    ).then((result) => {
      const n = result.count || 0;
      updateUnreadCache(n);
      try {
        emitUnreadChanged({ count: n });
      } catch (_) {}
    }).catch(() => {});
  } catch (_) {}
}

export function updateUnreadCache(next) {
  try {
    if (typeof next === 'function') {
      ns.update(KEY, (v) => {
        const base = typeof v === 'number' ? v : 0;
        let n = next(base);
        n = typeof n === 'number' ? n : base;
        if (n < 0) n = 0;
        return n | 0;
      });
      return;
    }
    if (typeof next === 'number') {
      const n = next < 0 ? 0 : (next | 0);
      ns.set(KEY, n, { ttlMs: 30 * 1000 });
    }
  } catch (_) {}
}

export function getCachedUnreadCount() {
  const v = ns.get(KEY);
  return typeof v === 'number' ? v : 0;
}

