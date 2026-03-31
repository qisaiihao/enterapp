import { setupCacheEventBridges } from '@/api-cache/events.js';
import { getAppState, getOpenid, patchAppState } from '@/utils/app-state.js';
import { initWxCloud } from '@/utils/wxCloudInit.js';
import { initRuntimeBadges, prewarmAfterLogin, setupFileUrlResolver } from '@/utils/runtime-preload.js';

// #ifdef H5 || APP-PLUS
import tcb from '@cloudbase/js-sdk';
// #endif

const ENV_ID = 'cloud1-5gb0pbyl400845f5';
const TIMEOUT_MS = 120000;

let authReadyPromise = null;
let openidReadyPromise = null;
let mpTcbWrapper = null;
let sideEffectsReady = false;

function getBindingTarget(target) {
  if (!target) {
    return null;
  }
  if (target.$ && target.$.appContext && target.$.appContext.config && target.$.appContext.config.globalProperties) {
    return target.$.appContext.config.globalProperties;
  }
  if (target.config && target.config.globalProperties) {
    return target.config.globalProperties;
  }
  if (target.prototype) {
    return target.prototype;
  }
  return target;
}

function syncRuntimeToGlobals(instance, requireOpenid) {
  if (!instance) {
    return;
  }

  if (typeof uni !== 'undefined') {
    uni.$tcb = instance;
    uni.$requireOpenid = requireOpenid;
  }

  if (typeof getApp === 'function') {
    try {
      const app = getApp();
      if (app) {
        app.$tcb = instance;
        app.$requireOpenid = requireOpenid;
      }
    } catch (error) {}
  }
}

function ensureAnonymousAuth(instance) {
  if (!instance || typeof instance.auth !== 'function') {
    return Promise.resolve(null);
  }

  if (!authReadyPromise) {
    authReadyPromise = (async () => {
      try {
        const auth = instance.auth();
        const currentUser = auth && auth.currentUser;
        if (!currentUser && auth && typeof auth.signInAnonymously === 'function') {
          await auth.signInAnonymously();
        }
      } catch (error) {
        console.error('[runtime-bootstrap] anonymous auth failed', error);
      }
    })();
  }

  return authReadyPromise;
}

function ensureAppTcb() {
  // #ifdef H5 || APP-PLUS
  const globalRef = typeof globalThis !== 'undefined'
    ? globalThis
    : (typeof window !== 'undefined' ? window : {});

  if (!globalRef.__tcbAppInstance) {
    globalRef.__tcbAppInstance = tcb.init({
      env: ENV_ID,
      auth: { persistence: 'local' },
      timeout: TIMEOUT_MS
    });
  }

  ensureAnonymousAuth(globalRef.__tcbAppInstance);
  return globalRef.__tcbAppInstance;
  // #endif

  return null;
}

function createMpWrapper() {
  return {
    callFunction(options = {}) {
      return wx.cloud.callFunction(options);
    },
    getTempFileURL(args = {}) {
      return wx.cloud.getTempFileURL(args);
    },
    database() {
      return wx.cloud.database();
    },
    uploadFile(options = {}) {
      return wx.cloud.uploadFile(options);
    },
    downloadFile(options = {}) {
      return wx.cloud.downloadFile(options);
    },
    deleteFile(options = {}) {
      return wx.cloud.deleteFile(options);
    },
    auth() {
      return {
        currentUser: null,
        signInAnonymously() {
          return Promise.resolve();
        }
      };
    }
  };
}

function ensureMpTcb() {
  if (mpTcbWrapper) {
    return mpTcbWrapper;
  }

  const ready = initWxCloud();
  if (!ready && (typeof wx === 'undefined' || !wx.cloud)) {
    return null;
  }

  mpTcbWrapper = createMpWrapper();
  return mpTcbWrapper;
}

function requireOpenid() {
  const openid = getOpenid();
  if (openid) {
    return openid;
  }

  const state = getAppState();
  if (state._loginProcessCompleted && typeof uni !== 'undefined' && typeof uni.showToast === 'function') {
    uni.showToast({ title: '用户未登录', icon: 'none' });
  }

  return null;
}

function extractOpenidFromLoginResult(loginRes) {
  if (!loginRes || typeof loginRes !== 'object') {
    return null;
  }

  if (loginRes.result && loginRes.result.openid) {
    return loginRes.result.openid;
  }
  if (loginRes.openid) {
    return loginRes.openid;
  }
  if (loginRes.result && loginRes.result.uid) {
    return loginRes.result.uid;
  }

  return null;
}

function cacheOpenid(openid) {
  if (!openid) {
    return null;
  }

  patchAppState({ openid });
  if (typeof uni !== 'undefined' && typeof uni.setStorageSync === 'function') {
    try {
      uni.setStorageSync('userOpenId', openid);
    } catch (error) {}
  }

  return openid;
}

export async function ensureRuntimeOpenid(options = {}) {
  const existingOpenid = getOpenid();
  if (existingOpenid && !options.force) {
    return existingOpenid;
  }

  const instance = ensureTcbReady();
  if (!instance || typeof instance.callFunction !== 'function') {
    return null;
  }

  if (!openidReadyPromise || options.force) {
    openidReadyPromise = (async () => {
      try {
        await ensureAnonymousAuth(instance);
        const loginRes = await instance.callFunction({
          name: 'login',
          __skipOpenidGuard: true
        });
        return cacheOpenid(extractOpenidFromLoginResult(loginRes));
      } catch (error) {
        console.error('[runtime-bootstrap] openid bootstrap failed', error);
        return null;
      } finally {
        openidReadyPromise = null;
      }
    })();
  }

  return openidReadyPromise;
}

export function ensureTcbReady() {
  let instance = ensureAppTcb();
  if (!instance) {
    instance = ensureMpTcb();
  }
  syncRuntimeToGlobals(instance, requireOpenid);
  return instance;
}

export function installRuntimeBindings(target) {
  const instance = ensureTcbReady();
  const bindingTarget = getBindingTarget(target);
  if (bindingTarget) {
    bindingTarget.$tcb = instance;
    bindingTarget.$requireOpenid = requireOpenid;
  }
  syncRuntimeToGlobals(instance, requireOpenid);
  return instance;
}

export function setupRuntimeSideEffects() {
  if (sideEffectsReady) {
    return;
  }

  try {
    setupFileUrlResolver();
  } catch (error) {
    console.warn('fileUrlCache resolver setup failed', error);
  }

  try {
    setupCacheEventBridges();
  } catch (error) {
    console.warn('setupCacheEventBridges failed', error);
  }

  initRuntimeBadges();
  prewarmAfterLogin();
  sideEffectsReady = true;
}
