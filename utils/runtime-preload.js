import fileUrlCache from '@/_utils/file-url-cache';
import { getMyInfo } from '@/api-cache/my.js';
import { getAppState } from '@/utils/app-state.js';

let resolverReady = false;
let badgesScheduled = false;
let prewarmReady = false;

function getCurrentTcb() {
  try {
    const app = typeof getApp === 'function' ? getApp() : null;
    if (app && app.$tcb && typeof app.$tcb.callFunction === 'function') {
      return app.$tcb;
    }
  } catch (_) {}

  if (typeof uni !== 'undefined' && uni.$tcb && typeof uni.$tcb.callFunction === 'function') {
    return uni.$tcb;
  }

  return null;
}

function buildTempFileMap(res) {
  const map = {};
  if (!res || !Array.isArray(res.fileList)) {
    return map;
  }

  res.fileList.forEach((item) => {
    if (item && item.tempFileURL) {
      map[item.fileID] = { url: item.tempFileURL, maxAgeSec: item.maxAge || 3600 };
    }
  });

  return map;
}

export function setupFileUrlResolver() {
  if (resolverReady) {
    return;
  }

  fileUrlCache.setResolver(async (ids) => {
    if (!Array.isArray(ids) || ids.length === 0) {
      return {};
    }

    const tcb = getCurrentTcb();
    if (tcb && typeof tcb.getTempFileURL === 'function') {
      const res = await tcb.getTempFileURL({ fileList: ids });
      return buildTempFileMap(res);
    }

    if (typeof wx !== 'undefined' && wx.cloud && typeof wx.cloud.getTempFileURL === 'function') {
      const res = await wx.cloud.getTempFileURL({ fileList: ids });
      return buildTempFileMap(res);
    }

    return {};
  });

  resolverReady = true;
}

export function initRuntimeBadges() {
  if (badgesScheduled) {
    return;
  }

  badgesScheduled = true;
  setTimeout(() => {
    try {
      const unreadBadge = require('@/cache/stores/unread-badge.js');
      unreadBadge.initUnreadCount();
    } catch (e) {
      console.warn('unreadBadge init failed', e);
    }

    try {
      const activityBadge = require('@/cache/stores/activity-badge.js');
      activityBadge.initActivityBadge();
    } catch (e) {
      console.warn('activityBadge init failed', e);
    }
  }, 1000);
}

export function prewarmAfterLogin() {
  if (prewarmReady) {
    return;
  }

  prewarmReady = true;
  const start = Date.now();
  const maxWaitMs = 5000;
  const timer = setInterval(async () => {
    try {
      const state = getAppState();
      if ((!state._loginProcessCompleted || !state.openid) && Date.now() - start <= maxWaitMs) {
        return;
      }

      clearInterval(timer);

      const tcb = getCurrentTcb();
      if (!tcb) {
        return;
      }

      try {
        await getMyInfo({ $tcb: tcb });
      } catch (e) {
        console.warn('🔰 [prewarm] getMyInfo failed', e);
      }
    } catch (_) {
      clearInterval(timer);
    }
  }, 120);
}
