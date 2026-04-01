import fileUrlCache from '@/_utils/file-url-cache';
import { getMyInfo } from '@/api-cache/my.js';
import { getAppState } from '@/utils/app-state.js';
import { formatErrorForLog } from '@/utils/error-log.js';

let resolverReady = false;
let badgesScheduled = false;
let prewarmReady = false;

function getCachedAppInstance() {
  if (typeof uni === 'undefined') {
    return null;
  }
  return uni.$appInstance || null;
}

async function ensureGlobalTcbAuthenticated(instance = null) {
  try {
    const authEnsurer = typeof uni !== 'undefined' ? uni.$ensureTcbAuthenticated : null;
    if (typeof authEnsurer === 'function') {
      await authEnsurer(instance || getCurrentTcb());
    }
  } catch (error) {
    console.warn(`[runtime-preload] ensure auth failed: ${formatErrorForLog(error)}`);
    throw error;
  }
}

function getCurrentTcb() {
  const app = getCachedAppInstance();
  if (app && app.$tcb && typeof app.$tcb.callFunction === 'function') {
    return app.$tcb;
  }

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
      await ensureGlobalTcbAuthenticated(tcb);
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
      ensureGlobalTcbAuthenticated().then(() => {
        try {
          unreadBadgeResult.value?.default?.initUnreadCount?.();
        } catch (error) {
          console.warn(`unreadBadge init failed: ${formatErrorForLog(error)}`);
        }

        try {
          activityBadgeResult.value?.default?.initActivityBadge?.();
        } catch (error) {
          console.warn(`activityBadge init failed: ${formatErrorForLog(error)}`);
        }
      }).catch((error) => {
        console.warn(`[runtime-preload] badge init skipped before auth ready: ${formatErrorForLog(error)}`);
      });
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
        await ensureGlobalTcbAuthenticated(tcb);
        await getMyInfo({ $tcb: tcb });
      } catch (error) {
        console.warn(`[prewarm] getMyInfo failed: ${formatErrorForLog(error)}`);
      }
    } catch (error) {
      clearInterval(timer);
    }
  }, 120);
}
