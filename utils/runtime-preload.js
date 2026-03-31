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
  } catch (error) {}

  if (typeof uni !== 'undefined' && uni.$tcb && typeof uni.$tcb.callFunction === 'function') {
    return uni.$tcb;
  }

  return null;
}

function buildTempFileMap(response) {
  const map = {};
  if (!response || !Array.isArray(response.fileList)) {
    return map;
  }

  response.fileList.forEach((item) => {
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
      const response = await tcb.getTempFileURL({ fileList: ids });
      return buildTempFileMap(response);
    }

    if (typeof wx !== 'undefined' && wx.cloud && typeof wx.cloud.getTempFileURL === 'function') {
      const response = await wx.cloud.getTempFileURL({ fileList: ids });
      return buildTempFileMap(response);
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
  // #ifdef H5
  return;
  // #endif
  setTimeout(() => {
    Promise.allSettled([
      import('@/cache/stores/unread-badge.js'),
      import('@/cache/stores/activity-badge.js')
    ]).then(([unreadBadgeResult, activityBadgeResult]) => {
      try {
        unreadBadgeResult.value?.default?.initUnreadCount?.();
      } catch (error) {
        console.warn('unreadBadge init failed', error);
      }

      try {
        activityBadgeResult.value?.default?.initActivityBadge?.();
      } catch (error) {
        console.warn('activityBadge init failed', error);
      }
    });
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
      } catch (error) {
        console.warn('[prewarm] getMyInfo failed', error);
      }
    } catch (error) {
      clearInterval(timer);
    }
  }, 120);
}
