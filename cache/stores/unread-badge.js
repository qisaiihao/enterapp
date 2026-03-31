import { EVENTS } from '@/utils/events.js';
import {
  getUnreadCount as fetchUnreadCount,
  invalidateUnread
} from '@/api-cache/unread.js';

let globalUnreadCount = 0;
let initialized = false;

async function initUnreadCount() {
  if (initialized) return globalUnreadCount;

  try {
    const count = await fetchUnreadCount();
    globalUnreadCount = count || 0;
    initialized = true;
    console.log('[unread-badge] initialized:', globalUnreadCount);
  } catch (error) {
    console.warn('[unread-badge] init failed:', error);
  }

  return globalUnreadCount;
}

function getUnreadCount() {
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
  const nextCount = Math.max(0, count | 0);
  if (globalUnreadCount !== nextCount) {
    globalUnreadCount = nextCount;
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

async function refreshUnreadCount() {
  try {
    invalidateUnread();
    const count = await fetchUnreadCount();
    setUnreadCount(count || 0);
    return globalUnreadCount;
  } catch (error) {
    console.warn('[unread-badge] refresh failed:', error);
    return globalUnreadCount;
  }
}

function subscribe(callback) {
  if (typeof callback !== 'function') return () => {};

  try {
    callback(globalUnreadCount);
  } catch (_) {}

  const handler = ({ count }) => {
    try {
      callback(count);
    } catch (_) {}
  };

  try {
    if (typeof uni !== 'undefined' && uni.$on) {
      uni.$on(EVENTS.UNREAD_CHANGED, handler);
    }
  } catch (_) {}

  return () => {
    try {
      if (typeof uni !== 'undefined' && uni.$off) {
        uni.$off(EVENTS.UNREAD_CHANGED, handler);
      }
    } catch (_) {}
  };
}

const unreadBadge = {
  initUnreadCount,
  getUnreadCount,
  setUnreadCount,
  decreaseUnread,
  clearUnread,
  refreshUnreadCount,
  subscribe
};

export {
  initUnreadCount,
  getUnreadCount,
  setUnreadCount,
  decreaseUnread,
  clearUnread,
  refreshUnreadCount,
  subscribe
};

export default unreadBadge;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = unreadBadge;
  module.exports.default = unreadBadge;
}
