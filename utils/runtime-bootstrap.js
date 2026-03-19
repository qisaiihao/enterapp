import { setupCacheEventBridges } from '@/api-cache/events.js';
import { getAppState, getOpenid } from '@/utils/app-state.js';
import { initWxCloud } from '@/utils/wxCloudInit.js';
import { initRuntimeBadges, prewarmAfterLogin, setupFileUrlResolver } from '@/utils/runtime-preload.js';

// #ifdef H5 || APP-PLUS
import tcb from '@cloudbase/js-sdk';
// #endif

const ENV_ID = 'cloud1-5gb0pbyl400845f5';
const TIMEOUT_MS = 120000;

let authReadyPromise = null;
let mpTcbWrapper = null;
let sideEffectsReady = false;

function getBindingTarget(target) {
  if (!target) {
    return null;
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
  }

  if (typeof getApp === 'function') {
    try {
      const app = getApp();
      if (app) {
        app.$tcb = instance;
        app.$requireOpenid = requireOpenid;
      }
    } catch (_) {}
  }
}

function ensureAnonymousAuth(instance) {
  if (!instance || typeof instance.auth !== 'function') {
    return;
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
        console.error('❌ [runtime-bootstrap] 匿名认证失败:', error);
      }
    })();
  }
}

function ensureH5AppTcb() {
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
  const isAppStarting = !state._loginProcessCompleted;
  if (!isAppStarting && typeof uni !== 'undefined' && typeof uni.showToast === 'function') {
    uni.showToast({ title: '用户未登录', icon: 'none' });
  }

  return null;
}

export function ensureTcbReady() {
  let instance = ensureH5AppTcb();
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
  } catch (e) {
    console.warn('fileUrlCache resolver setup failed', e);
  }

  try {
    setupCacheEventBridges();
  } catch (e) {
    console.warn('setupCacheEventBridges failed', e);
  }

  initRuntimeBadges();
  prewarmAfterLogin();
  sideEffectsReady = true;
}
