import { EVENTS } from '@/utils/events.js';
import {
  getUnreadCount as fetchUnreadCount,
  invalidateUnread
} from '@/api-cache/unread.js';
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

function broadcast(count) {
  try {
    if (typeof uni !== 'undefined' && uni.$emit) {
      uni.$emit(EVENTS.UNREAD_CHANGED, { count });
    }
  } catch (_) {}
}

function setUnreadCount(count) {
  ensureEventBridge();
  const nextCount = Math.max(0, count | 0);
  const changed = globalUnreadCount !== nextCount;
  applyUnreadCount(nextCount);
  if (changed) {
    broadcast(nextCount);
    console.log('[unread-badge] updated:', nextCount);
  }
}

function decreaseUnread(delta = 1) {
  setUnreadCount(globalUnreadCount - delta);
}

function clearUnread() {
  setUnreadCount(0);
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
        if (revision === countRevision) setUnreadCount(count || 0);
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
