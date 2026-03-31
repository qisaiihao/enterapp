import { getRecentActivities } from '@/api-cache/activities.js';

const EVENT_NAME = 'activity-badge-changed';
const STORAGE_LAST_SEEN = 'activityBadge:lastSeenToken';
const STORAGE_LATEST = 'activityBadge:latestToken';

let hasNewActivity = false;
let latestToken = '';
let initialized = false;

function getStorageString(key, fallback = '') {
  try {
    const value = uni.getStorageSync(key);
    if (typeof value === 'string') return value;
    if (value === undefined || value === null || value === '') return fallback;
    return String(value);
  } catch (_) {
    return fallback;
  }
}

function setStorageString(key, value) {
  try {
    uni.setStorageSync(key, typeof value === 'string' ? value : String(value || ''));
  } catch (_) {}
}

function normalizeDateToken(value) {
  if (value === undefined || value === null || value === '') return '';
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isFinite(time) ? String(time) : '';
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(Math.trunc(value)) : '';
  }
  const text = String(value).trim();
  if (!text) return '';
  const time = Date.parse(text);
  if (!Number.isNaN(time)) return String(time);
  return text;
}

function buildActivityToken(activity) {
  if (!activity || typeof activity !== 'object') return '';

  const createdAtToken = normalizeDateToken(activity.createdAt);
  const id = activity._id ? String(activity._id).trim() : '';

  if (createdAtToken) {
    return id ? `createdAt:${createdAtToken}|id:${id}` : `createdAt:${createdAtToken}`;
  }

  return id ? `id:${id}` : '';
}

function broadcast(nextHasNew) {
  try {
    if (typeof uni !== 'undefined' && uni.$emit) {
      uni.$emit(EVENT_NAME, { hasNew: !!nextHasNew });
    }
  } catch (_) {}
}

function getHasNewActivity() {
  return hasNewActivity;
}

async function refreshActivityBadge({ forceRefresh = false, context } = {}) {
  try {
    if (typeof getRecentActivities !== 'function') {
      return hasNewActivity;
    }

    const result = await getRecentActivities({
      page: 0,
      pageSize: 1,
      scene: 'recent',
      context,
      forceRefresh: !!forceRefresh
    });

    const activities = Array.isArray(result && result.activities) ? result.activities : [];
    const latestActivity = activities[0] || null;
    const nextLatestToken = buildActivityToken(latestActivity);
    latestToken = nextLatestToken || '';
    setStorageString(STORAGE_LATEST, latestToken);

    const lastSeenToken = getStorageString(STORAGE_LAST_SEEN, '');
    if (!lastSeenToken) {
      if (latestToken) {
        setStorageString(STORAGE_LAST_SEEN, latestToken);
      }
      if (hasNewActivity) {
        hasNewActivity = false;
        broadcast(false);
      }
      initialized = true;
      return hasNewActivity;
    }

    const nextHasNew = !!latestToken && latestToken !== lastSeenToken;
    if (hasNewActivity !== nextHasNew) {
      hasNewActivity = nextHasNew;
      broadcast(hasNewActivity);
    }
    initialized = true;
    return hasNewActivity;
  } catch (error) {
    console.warn('[activity-badge] refresh failed:', error);
    return hasNewActivity;
  }
}

async function initActivityBadge() {
  if (initialized) return hasNewActivity;

  const lastSeenToken = getStorageString(STORAGE_LAST_SEEN, '');
  latestToken = getStorageString(STORAGE_LATEST, '');
  hasNewActivity = !!(latestToken && lastSeenToken && latestToken !== lastSeenToken);
  initialized = true;

  try {
    await refreshActivityBadge({ forceRefresh: false });
  } catch (_) {}

  return hasNewActivity;
}

function markActivitySeen() {
  if (!latestToken) {
    latestToken = getStorageString(STORAGE_LATEST, '');
  }
  if (latestToken) {
    setStorageString(STORAGE_LAST_SEEN, latestToken);
  }
  if (hasNewActivity) {
    hasNewActivity = false;
    broadcast(false);
  }
  return hasNewActivity;
}

function subscribe(callback) {
  if (typeof callback !== 'function') return () => {};

  try {
    callback(hasNewActivity);
  } catch (_) {}

  const handler = (payload = {}) => {
    try {
      callback(!!payload.hasNew);
    } catch (_) {}
  };

  try {
    if (typeof uni !== 'undefined' && uni.$on) {
      uni.$on(EVENT_NAME, handler);
    }
  } catch (_) {}

  return () => {
    try {
      if (typeof uni !== 'undefined' && uni.$off) {
        uni.$off(EVENT_NAME, handler);
      }
    } catch (_) {}
  };
}

const activityBadge = {
  initActivityBadge,
  getHasNewActivity,
  subscribe,
  refreshActivityBadge,
  markActivitySeen
};

export {
  initActivityBadge,
  getHasNewActivity,
  subscribe,
  refreshActivityBadge,
  markActivitySeen
};

export default activityBadge;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = activityBadge;
  module.exports.default = activityBadge;
}
