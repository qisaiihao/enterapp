import cacheManager from '@/cache/core/manager';
const { cloudCall } = require('@/utils/cloudCall.js');
const { emitUnreadChanged } = require('@/utils/events.js');

const ns = cacheManager.namespace('unread', { persistent: false, maxItems: 64 });
const KEY = 'count';

export async function getUnreadCount(context) {
  return ns.getOrFetch(KEY, async () => {
    const res = await cloudCall('getUnreadMessageCount', {}, { pageTag: 'unread', context, injectOpenId: true });
    if (res && res.result && res.result.success) {
      return res.result.count || 0;
    }
    return 0;
  }, { ttlMs: 30 * 1000, swrMs: 30 * 1000 }); // 30秒，消息需要更实时
}

export function invalidateUnread() {
  ns.delete(KEY);
  // 触发一次后台刷新并广播最新值（用于“立即消失/出现”）
  try {
    cloudCall('getUnreadMessageCount', {}, { pageTag: 'unread:refresh', injectOpenId: true })
      .then((res) => {
        const n = (res && res.result && res.result.success) ? (res.result.count || 0) : 0;
        updateUnreadCache(n);
        try { emitUnreadChanged({ count: n }); } catch (_) {}
      })
      .catch(() => {});
  } catch (_) {}
}

// 直接更新未读缓存（用于事件驱动的即时一致性）
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
    } else if (typeof next === 'number') {
      const n = next < 0 ? 0 : (next | 0);
      ns.set(KEY, n, { ttlMs: 30 * 1000 });
    }
  } catch (_) {}
}

export function getCachedUnreadCount() {
  const v = ns.get(KEY);
  return typeof v === 'number' ? v : 0;
}
