/**
 * Activity badge store.
 * Shows a red dot when a newer activity appears than the last seen one.
 */

const EVENT_NAME = 'activity-badge-changed';
const STORAGE_LAST_SEEN = 'activityBadge:lastSeenToken';
const STORAGE_LATEST = 'activityBadge:latestToken';

let _hasNewActivity = false;
let _latestToken = '';
let _initialized = false;

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

function broadcast(hasNew) {
  try {
    if (typeof uni !== 'undefined' && uni.$emit) {
      uni.$emit(EVENT_NAME, { hasNew: !!hasNew });
    }
  } catch (_) {}
}

function getHasNewActivity() {
  return _hasNewActivity;
}

async function refreshActivityBadge({ forceRefresh = false, context } = {}) {
  try {
    const { getRecentActivities } = require('@/api-cache/activities.js');
    if (typeof getRecentActivities !== 'function') {
      return _hasNewActivity;
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
    _latestToken = nextLatestToken || '';
    setStorageString(STORAGE_LATEST, _latestToken);

    const lastSeenToken = getStorageString(STORAGE_LAST_SEEN, '');

    // First install/no history: mark current latest as seen to avoid false-positive red dot.
    if (!lastSeenToken) {
      if (_latestToken) {
        setStorageString(STORAGE_LAST_SEEN, _latestToken);
      }
      if (_hasNewActivity) {
        _hasNewActivity = false;
        broadcast(false);
      }
      _initialized = true;
      return _hasNewActivity;
    }

    const hasNew = !!_latestToken && _latestToken !== lastSeenToken;
    if (_hasNewActivity !== hasNew) {
      _hasNewActivity = hasNew;
      broadcast(_hasNewActivity);
    }
    _initialized = true;
    return _hasNewActivity;
  } catch (error) {
    console.warn('[activity-badge] refresh failed:', error);
    return _hasNewActivity;
  }
}

async function initActivityBadge() {
  if (_initialized) return _hasNewActivity;

  const lastSeenToken = getStorageString(STORAGE_LAST_SEEN, '');
  _latestToken = getStorageString(STORAGE_LATEST, '');
  _hasNewActivity = !!(_latestToken && lastSeenToken && _latestToken !== lastSeenToken);
  _initialized = true;

  try {
    await refreshActivityBadge({ forceRefresh: false });
  } catch (_) {}

  return _hasNewActivity;
}

function markActivitySeen() {
  if (!_latestToken) {
    _latestToken = getStorageString(STORAGE_LATEST, '');
  }
  if (_latestToken) {
    setStorageString(STORAGE_LAST_SEEN, _latestToken);
  }
  if (_hasNewActivity) {
    _hasNewActivity = false;
    broadcast(false);
  }
  return _hasNewActivity;
}

function subscribe(callback) {
  if (typeof callback !== 'function') return () => {};

  try {
    callback(_hasNewActivity);
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

module.exports = {
  initActivityBadge,
  getHasNewActivity,
  subscribe,
  refreshActivityBadge,
  markActivitySeen
};
