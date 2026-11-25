import { EVENTS } from '@/utils/events.js';
import {
  getUnreadCount as fetchUnreadCount,
  invalidateUnread
} from '@/api-cache/unread.js';
import { prefetchMessages } from '@/api-cache/messages.js';
import { formatErrorForLog } from '@/utils/error-log.js';
import { getAppState } from '@/utils/app-state.js';

let globalUnreadCount = 0;
let initialized = false;
let refreshTask = null;
let refreshTimer = null;
let eventsBound = false;
let countRevision = 0;
let lastRefreshAt = null;
let activeUserKey = null;
const POLL_INTERVAL_MS = 2 * 60 * 1000;
const subscribers = new Set();

function currentUserKey() {
  const state = getAppState();
  if (!state.isLoggedIn) return '';
  return state.openid || state.userInfo?._openid || state.userInfo?.openid || '';
}

function syncUser() {
  const key = currentUserKey();
  if (activeUserKey !== key) {
    activeUserKey = key;
    initialized = false;
    lastRefreshAt = null;
    refreshTask = null;
    invalidateUnread({ refresh: false });
    clearUnread();
  }
  return key;
}

function applyUnreadCount(count) {
  countRevision += 1;
  const nextCount = Math.max(0, count | 0);
  if (globalUnreadCount === nextCount) return;
  globalUnreadCount = nextCount;
  subscribers.forEach((callback) => {
    try { callback(nextCount); } catch (_) {}
  });
}

function ensureEventBridge() {
  if (eventsBound || typeof uni === 'undefined' || !uni.$on) return;
  uni.$on(EVENTS.UNREAD_CHANGED, (payload = {}) => {
    if (payload.cleared) {
      // 其他实例/分包完成“全部已读”后，本实例短期内不再回源，避免旧数据把红点重新点亮
      initialized = true;
      lastRefreshAt = Date.now();
    }
    if (typeof payload.count === 'number') {
      applyUnreadCount(payload.count);
    } else if (typeof payload.delta === 'number') {
      applyUnreadCount(globalUnreadCount + payload.delta);
    }
  });
  eventsBound = true;
}

async function ensureRuntimeAuthReady() {
  try {
    const authEnsurer = typeof uni !== 'undefined' ? uni.$ensureTcbAuthenticated : null;
    if (typeof authEnsurer === 'function') {
      await authEnsurer();
    }
  } catch (error) {
    console.warn(`[unread-badge] auth not ready: ${formatErrorForLog(error)}`);
    throw error;
  }
}

async function initUnreadCount() {
  ensureEventBridge();
  syncUser();
  if (initialized) return globalUnreadCount;
  return refreshUnreadCount();
}

function getUnreadCount() {
  syncUser();
  return globalUnreadCount;
}

function broadcast(count, extra) {
  try {
    if (typeof uni !== 'undefined' && uni.$emit) {
      uni.$emit(EVENTS.UNREAD_CHANGED, Object.assign({ count }, extra || {}));
    }
  } catch (_) {}
}

function setUnreadCount(count, { cleared = false } = {}) {
  ensureEventBridge();
  const nextCount = Math.max(0, count | 0);
  const changed = globalUnreadCount !== nextCount;
  applyUnreadCount(nextCount);
  // 即使本实例计数相同也广播：分包/多实例的顶部栏靠事件同步，不能依赖本地“有变化”判断
  broadcast(nextCount, cleared ? { cleared: true } : null);
  if (changed) {
    console.log('[unread-badge] updated:', nextCount);
  }
}

function decreaseUnread(delta = 1) {
  setUnreadCount(globalUnreadCount - delta);
}

function clearUnread() {
  setUnreadCount(0);
}

function acknowledgeAllRead() {
  // 进入消息页全部已读：立即清零并阻止短期内用旧缓存/在途请求恢复红点
  ensureEventBridge();
  initialized = true;
  lastRefreshAt = Date.now();
  setUnreadCount(0, { cleared: true });
}

function refreshUnreadCount({ forceRefresh = true } = {}) {
  ensureEventBridge();
  const userKey = syncUser();
  if (!userKey) return Promise.resolve(globalUnreadCount);
  if (refreshTask) return refreshTask;
  // 顶部栏挂载和短时间切回前台复用近期成功结果，手动刷新仍立即请求。
  if (!forceRefresh && lastRefreshAt !== null && Date.now() - lastRefreshAt < POLL_INTERVAL_MS) {
    return Promise.resolve(globalUnreadCount);
  }
  const task = (async () => {
    try {
      await ensureRuntimeAuthReady();
      if (currentUserKey() !== userKey) return globalUnreadCount;
      // 只失效缓存，由下面的请求负责刷新，避免一次刷新发出两次云调用。
      invalidateUnread({ refresh: false });
      const revision = countRevision;
      const count = await fetchUnreadCount();
      // 请求期间若已读操作更新了状态，不允许旧响应重新点亮红点。
      if (currentUserKey() === userKey && activeUserKey === userKey) {
        if (revision === countRevision) {
          const shouldPrefetch = count > 0 && count !== globalUnreadCount;
          setUnreadCount(count || 0);
          if (shouldPrefetch) prefetchMessages(undefined, { forceRefresh: true });
        }
        initialized = true;
        lastRefreshAt = Date.now();
      }
    } catch (error) {
      console.warn(`[unread-badge] refresh failed: ${formatErrorForLog(error)}`);
    }
    return globalUnreadCount;
  })().finally(() => { if (refreshTask === task) refreshTask = null; });
  refreshTask = task;
  return refreshTask;
}

function refreshWhenLoggedIn() {
  return refreshUnreadCount({ forceRefresh: false });
}

function startPolling() {
  if (refreshTimer !== null) return;
  refreshWhenLoggedIn();
  // 其他用户的点赞/评论没有本地事件，前台定期拉取服务器未读数。
  refreshTimer = setInterval(() => refreshUnreadCount(), POLL_INTERVAL_MS);
}

function stopPolling() {
  if (refreshTimer === null) return;
  clearInterval(refreshTimer);
  refreshTimer = null;
}

function subscribe(callback) {
  if (typeof callback !== 'function') return () => {};
  ensureEventBridge();
  subscribers.add(callback);

  try {
    callback(globalUnreadCount);
  } catch (_) {}

  return () => subscribers.delete(callback);
}

const unreadBadge = {
  initUnreadCount,
  getUnreadCount,
  setUnreadCount,
  decreaseUnread,
  clearUnread,
  acknowledgeAllRead,
  refreshUnreadCount,
  startPolling,
  stopPolling,
  subscribe
};

export {
  initUnreadCount,
  getUnreadCount,
  setUnreadCount,
  decreaseUnread,
  clearUnread,
  acknowledgeAllRead,
  refreshUnreadCount,
  startPolling,
  stopPolling,
  subscribe
};

export default unreadBadge;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = unreadBadge;
  module.exports.default = unreadBadge;
}
