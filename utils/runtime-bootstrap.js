import { setupCacheEventBridges } from '@/api-cache/events.js';
import { getAppState, getOpenid, patchAppState } from '@/utils/app-state.js';
import { formatErrorForLog } from '@/utils/error-log.js';
import { initWxCloud } from '@/utils/wxCloudInit.js';
import { initRuntimeBadges, prewarmAfterLogin, setupFileUrlResolver } from '@/utils/runtime-preload.js';

// #ifdef H5 || APP-PLUS || APP-HARMONY
import tcb from '@cloudbase/js-sdk';
// #endif

const ENV_ID = 'cloud1-5gb0pbyl400845f5';
const TIMEOUT_MS = 120000;
const TCB_STORAGE_PREFIX = '__tcb_web_storage__:';

let authReadyPromise = null;
let openidReadyPromise = null;
let mpTcbWrapper = null;
let sideEffectsReady = false;
let appPlusAdapterRegistered = false;

function sleep(ms = 0) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getGlobalRuntime() {
  if (typeof globalThis !== 'undefined') {
    return globalThis;
  }
  if (typeof self !== 'undefined') {
    return self;
  }
  return {};
}

function isObjectLike(value) {
  return !!value && (typeof value === 'object' || typeof value === 'function');
}

function getCachedAppInstance() {
  if (typeof uni === 'undefined') {
    return null;
  }
  return uni.$appInstance || null;
}

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

function hasStorageLike(storage) {
  return !!storage
    && typeof storage.getItem === 'function'
    && typeof storage.setItem === 'function'
    && typeof storage.removeItem === 'function';
}

function defineGlobalValue(target, key, value) {
  try {
    target[key] = value;
    return;
  } catch (error) {}

  try {
    Object.defineProperty(target, key, {
      configurable: true,
      enumerable: false,
      writable: true,
      value
    });
  } catch (error) {}
}

function syncRuntimeToGlobals(instance, requireOpenid, options = {}) {
  if (!instance) {
    return;
  }
  const {
    bindAppInstance = true,
    appInstance = null
  } = options;

  if (typeof uni !== 'undefined') {
    uni.$tcb = instance;
    uni.$requireOpenid = requireOpenid;
    uni.$ensureTcbAuthenticated = ensureTcbAuthenticated;
    if (appInstance) {
      uni.$appInstance = appInstance;
    }
  }

  const app = bindAppInstance ? (appInstance || getCachedAppInstance()) : null;
  if (app) {
    app.$tcb = instance;
    app.$requireOpenid = requireOpenid;
    app.$ensureTcbAuthenticated = ensureTcbAuthenticated;
  }
}

function ensureAnonymousAuth(instance) {
  if (!instance || instance.__skipAuth || typeof instance.auth !== 'function') {
    return Promise.resolve(null);
  }

  if (!authReadyPromise) {
    authReadyPromise = (async () => {
      try {
        ensureGlobalBrowserShims(getGlobalRuntime());
        const auth = instance.auth();
        const currentUser = auth && auth.currentUser;
        if (!currentUser && auth && typeof auth.signInAnonymously === 'function') {
          await auth.signInAnonymously();
        }
        if (auth) {
          for (let index = 0; index < 20; index += 1) {
            if (auth.currentUser) {
              break;
            }
            await sleep(100);
          }
        }
        if (auth && !auth.currentUser) {
          throw new Error('TCB auth user unavailable');
        }
        return auth && auth.currentUser ? auth.currentUser : null;
      } catch (error) {
        authReadyPromise = null;
        console.error(`[runtime-bootstrap] anonymous auth failed: ${formatErrorForLog(error)}`);
        throw error;
      }
    })();
  }

  return authReadyPromise;
}

export async function ensureTcbAuthenticated(instance = null) {
  const targetInstance = instance || ensureTcbReady();
  if (!targetInstance || targetInstance.__skipAuth || typeof targetInstance.auth !== 'function') {
    return targetInstance;
  }

  await ensureAnonymousAuth(targetInstance);
  return targetInstance;
}

function formatRequestUrl(url, query = {}) {
  let targetUrl = url || '';
  const queryString = Object.keys(query)
    .filter((key) => typeof query[key] !== 'undefined')
    .map((key) => `${key}=${encodeURIComponent(query[key])}`)
    .join('&');

  if (queryString) {
    targetUrl += `${/\?/.test(targetUrl) ? '&' : '?'}${queryString}`;
  }

  if (/^https?:\/\//.test(targetUrl)) {
    return targetUrl;
  }

  return `https:${targetUrl}`;
}

function createScopedStorage(globalRef) {
  if (globalRef.__enterappTcbStorage) {
    return globalRef.__enterappTcbStorage;
  }

  const readKeys = () => {
    if (typeof uni === 'undefined' || typeof uni.getStorageInfoSync !== 'function') {
      return [];
    }
    try {
      const info = uni.getStorageInfoSync();
      return Array.isArray(info && info.keys) ? info.keys : [];
    } catch (error) {
      return [];
    }
  };

  const storage = {
    mode: 'sync',
    getItem(key) {
      if (typeof uni === 'undefined' || typeof uni.getStorageSync !== 'function') {
        return null;
      }
      try {
        const value = uni.getStorageSync(`${TCB_STORAGE_PREFIX}${key}`);
        if (typeof value === 'undefined' || value === null) {
          return null;
        }
        return typeof value === 'string' ? value : String(value);
      } catch (error) {
        return null;
      }
    },
    setItem(key, value) {
      if (typeof uni === 'undefined' || typeof uni.setStorageSync !== 'function') {
        return;
      }
      try {
        uni.setStorageSync(`${TCB_STORAGE_PREFIX}${key}`, value);
      } catch (error) {}
    },
    removeItem(key) {
      if (typeof uni === 'undefined' || typeof uni.removeStorageSync !== 'function') {
        return;
      }
      try {
        uni.removeStorageSync(`${TCB_STORAGE_PREFIX}${key}`);
      } catch (error) {}
    },
    clear() {
      if (typeof uni === 'undefined' || typeof uni.removeStorageSync !== 'function') {
        return;
      }
      readKeys().forEach((storageKey) => {
        if (typeof storageKey === 'string' && storageKey.indexOf(TCB_STORAGE_PREFIX) === 0) {
          try {
            uni.removeStorageSync(storageKey);
          } catch (error) {}
        }
      });
    },
    key(index) {
      const scopedKeys = readKeys()
        .filter((storageKey) => typeof storageKey === 'string' && storageKey.indexOf(TCB_STORAGE_PREFIX) === 0)
        .map((storageKey) => storageKey.slice(TCB_STORAGE_PREFIX.length));
      return scopedKeys[index] || null;
    }
  };

  Object.defineProperty(storage, 'length', {
    enumerable: true,
    configurable: false,
    get() {
      return readKeys().filter((storageKey) => typeof storageKey === 'string' && storageKey.indexOf(TCB_STORAGE_PREFIX) === 0).length;
    }
  });

  globalRef.__enterappTcbStorage = storage;
  return storage;
}

function getAppPlusTcbRoot(globalRef) {
  if (globalRef.__enterappTcbRoot) {
    return globalRef.__enterappTcbRoot;
  }

  const storage = createScopedStorage(globalRef);
  const root = {
    location: {
      href: 'https://enterapp.local/',
      origin: 'https://enterapp.local',
      protocol: 'https:',
      host: 'enterapp.local',
      hostname: 'enterapp.local',
      pathname: '/',
      search: '',
      hash: ''
    },
    navigator: {
      userAgent: 'enterapp-app-runtime'
    },
    localStorage: storage,
    sessionStorage: storage
  };

  root.globalThis = root;
  root.self = root;
  root.window = root;
  globalRef.__enterappTcbRoot = root;
  return root;
}

function parseInlineQueryString(search = '') {
  const source = String(search || '').replace(/^\?/, '');
  if (!source) {
    return {};
  }

  return source.split('&').reduce((result, segment) => {
    if (!segment) {
      return result;
    }

    const separatorIndex = segment.indexOf('=');
    const rawKey = separatorIndex >= 0 ? segment.slice(0, separatorIndex) : segment;
    const rawValue = separatorIndex >= 0 ? segment.slice(separatorIndex + 1) : '';
    const key = decodeURIComponent(rawKey || '');
    const value = decodeURIComponent(rawValue || '');

    if (key) {
      result[key] = value;
    }
    return result;
  }, {});
}

function createAppPlusCaptchaOptions() {
  return {
    openURIWithCallback(rawUrl) {
      let url = rawUrl;
      let query = {};

      const matched = String(rawUrl || '').match(/^(data:.*?)(\?[^#\s]*)?$/);
      if (matched) {
        url = matched[1];
        query = parseInlineQueryString(matched[2] || '');
      }

      const { token } = query;

      if (/^data:/.test(String(url || '')) && !token) {
        return Promise.reject({
          error: 'invalid_argument',
          error_description: `invalid captcha data: ${rawUrl}`
        });
      }

      console.warn('[runtime-bootstrap] captcha challenge is not supported in app runtime');
      return Promise.reject({
        error: 'unimplemented',
        error_description: 'interactive captcha is not implemented for app runtime'
      });
    }
  };
}

function hasLocationLike(target) {
  try {
    return !!(target && target.location && typeof target.location === 'object' && target.location.href);
  } catch (error) {
    return false;
  }
}

function readGlobalTarget(target, key) {
  try {
    return target && target[key];
  } catch (error) {
    return null;
  }
}

function collectGlobalTargets(globalRef, root) {
  const targets = [];
  const pushTarget = (value) => {
    if (!isObjectLike(value) || targets.indexOf(value) !== -1) {
      return;
    }
    targets.push(value);
  };

  pushTarget(globalRef);
  pushTarget(root);
  pushTarget(readGlobalTarget(globalRef, 'window'));
  pushTarget(readGlobalTarget(globalRef, 'self'));
  pushTarget(readGlobalTarget(globalRef, 'globalThis'));
  pushTarget(typeof globalThis !== 'undefined' ? globalThis : null);
  pushTarget(typeof window !== 'undefined' ? window : null);
  pushTarget(typeof self !== 'undefined' ? self : null);

  return targets;
}

function ensureBrowserShimsOnTarget(target, root) {
  if (!isObjectLike(target)) {
    return;
  }

  if (!hasLocationLike(target)) {
    defineGlobalValue(target, 'location', root.location);
  }
  if (!readGlobalTarget(target, 'navigator') || typeof readGlobalTarget(target, 'navigator') !== 'object') {
    defineGlobalValue(target, 'navigator', root.navigator);
  }
  if (!hasStorageLike(readGlobalTarget(target, 'localStorage'))) {
    defineGlobalValue(target, 'localStorage', root.localStorage);
  }
  if (!hasStorageLike(readGlobalTarget(target, 'sessionStorage'))) {
    defineGlobalValue(target, 'sessionStorage', root.sessionStorage);
  }
  if (!isObjectLike(readGlobalTarget(target, 'window'))) {
    defineGlobalValue(target, 'window', target);
  }
  if (!isObjectLike(readGlobalTarget(target, 'self'))) {
    defineGlobalValue(target, 'self', target);
  }
  if (!isObjectLike(readGlobalTarget(target, 'globalThis'))) {
    defineGlobalValue(target, 'globalThis', target);
  }
}

function ensureGlobalBrowserShims(globalRef) {
  const root = getAppPlusTcbRoot(globalRef);
  const targets = collectGlobalTargets(globalRef, root);

  targets.forEach((target) => {
    ensureBrowserShimsOnTarget(target, root);
  });

  return root;
}

function initH5Tcb() {
  return tcb.init({
    env: ENV_ID,
    persistence: 'local',
    auth: { persistence: 'local' },
    timeout: TIMEOUT_MS
  });
}

class AppPlusTcbRequest {
  constructor(options = {}) {
    this.timeout = options.timeout || 0;
    this.timeoutMsg = options.timeoutMsg || '请求超时';
    this.restrictedMethods = options.restrictedMethods || ['get', 'post', 'upload', 'download'];
  }

  get(options) {
    return this.request({
      ...options,
      method: 'GET'
    }, this.restrictedMethods.includes('get'));
  }

  post(options) {
    return this.request({
      ...options,
      method: 'POST'
    }, this.restrictedMethods.includes('post'));
  }

  put(options) {
    return this.request({
      ...options,
      method: 'PUT'
    });
  }

  upload(options = {}) {
    const {
      url,
      file,
      data = {},
      headers = {},
      fileType,
      onUploadProgress,
      timeout
    } = options;

    return new Promise((resolve, reject) => {
      const task = uni.uploadFile({
        url: formatRequestUrl(url),
        name: options.name || 'file',
        formData: { ...data },
        filePath: file,
        fileType,
        header: headers,
        timeout: timeout || this.timeout,
        success(res) {
          const result = {
            statusCode: res.statusCode,
            data: res.data || {}
          };
          if (res.statusCode === 200 && data.success_action_status) {
            result.statusCode = parseInt(data.success_action_status, 10);
          }
          resolve(result);
        },
        fail(error) {
          reject(new Error((error && error.errMsg) || 'uploadFile:fail'));
        }
      });

      if (typeof onUploadProgress === 'function' && task && typeof task.onProgressUpdate === 'function') {
        task.onProgressUpdate((progress) => {
          onUploadProgress({
            loaded: progress.totalBytesSent,
            total: progress.totalBytesExpectedToSend
          });
        });
      }
    });
  }

  download(options = {}) {
    return new Promise((resolve, reject) => {
      uni.downloadFile({
        url: formatRequestUrl(options.url),
        timeout: options.timeout || this.timeout,
        success: resolve,
        fail: reject
      });
    });
  }

  fetch(options = {}) {
    return this.request({
      ...options,
      method: options.method || 'GET',
      data: options.body
    }).then((res) => ({
      data: res.data,
      statusCode: res.statusCode,
      headers: res.header || {},
      header: res.header || {}
    }));
  }

  request(options = {}, enableTimeout = false) {
    const method = String(options.method || 'GET').toUpperCase();
    const headers = options.headers || options.header || {};
    const requestData = options.data || {};
    const requestUrl = formatRequestUrl(options.url, method === 'GET' ? requestData : {});

    return new Promise((resolve, reject) => {
      uni.request({
        url: requestUrl,
        data: method === 'GET' ? undefined : requestData,
        method,
        header: headers,
        timeout: options.timeout || (enableTimeout ? this.timeout : 0),
        responseType: options.responseType === 'arraybuffer' ? 'arraybuffer' : 'text',
        success(res) {
          resolve({
            ...res,
            header: res.header || {},
            headers: res.header || {}
          });
        },
        fail(error) {
          reject(error);
        }
      });
    });
  }
}

function ensureAppPlusAdapter(globalRef) {
  if (appPlusAdapterRegistered || typeof tcb.useAdapters !== 'function') {
    return;
  }

  const root = ensureGlobalBrowserShims(globalRef);
  const wsClass = typeof WebSocket !== 'undefined'
    ? WebSocket
    : function UnsupportedWebSocket() {
      throw new Error('WebSocket is not supported on current platform');
    };

  tcb.useAdapters({
    runtime: 'app_plus',
    isMatch() {
      return true;
    },
    genAdapter() {
      return {
        root,
        reqClass: AppPlusTcbRequest,
        wsClass,
        captchaOptions: createAppPlusCaptchaOptions(),
        localStorage: root.localStorage,
        sessionStorage: root.sessionStorage,
        primaryStorage: 'local'
      };
    }
  });

  appPlusAdapterRegistered = true;
}

function initAppPlusTcb(globalRef) {
  ensureAppPlusAdapter(globalRef);
  return tcb.init({
    env: ENV_ID,
    persistence: 'local',
    auth: { persistence: 'local' },
    timeout: TIMEOUT_MS
  });
}

function ensureAppTcb() {
  // #ifdef H5 || APP-PLUS || APP-HARMONY
  const globalRef = getGlobalRuntime();

  if (!globalRef.__tcbAppInstance) {
    // #ifdef H5
    globalRef.__tcbAppInstance = initH5Tcb();
    // #endif
    // #ifdef APP-PLUS || APP-HARMONY
    globalRef.__tcbAppInstance = initAppPlusTcb(globalRef);
    // #endif
  }

  ensureAnonymousAuth(globalRef.__tcbAppInstance).catch(() => {});
  return globalRef.__tcbAppInstance;
  // #endif

  return null;
}

function createMpWrapper() {
  return {
    __runtime: 'mp-weixin',
    __skipAuth: true,
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
        await ensureTcbAuthenticated(instance);
        const loginRes = await instance.callFunction({
          name: 'login',
          __skipOpenidGuard: true
        });
        return cacheOpenid(extractOpenidFromLoginResult(loginRes));
      } catch (error) {
        console.error(`[runtime-bootstrap] openid bootstrap failed: ${formatErrorForLog(error)}`);
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
  syncRuntimeToGlobals(instance, requireOpenid, { bindAppInstance: false });
  return instance;
}

export function installRuntimeBindings(target) {
  const instance = ensureTcbReady();
  const bindingTarget = getBindingTarget(target);
  const appInstance = bindingTarget === target ? target : null;
  if (bindingTarget) {
    bindingTarget.$tcb = instance;
    bindingTarget.$requireOpenid = requireOpenid;
  }
  syncRuntimeToGlobals(instance, requireOpenid, {
    bindAppInstance: !!appInstance,
    appInstance
  });
  return instance;
}

export function setupRuntimeSideEffects() {
  if (sideEffectsReady) {
    return;
  }

  try {
    setupFileUrlResolver();
  } catch (error) {
    console.warn(`fileUrlCache resolver setup failed: ${formatErrorForLog(error)}`);
  }

  try {
    setupCacheEventBridges();
  } catch (error) {
    console.warn(`setupCacheEventBridges failed: ${formatErrorForLog(error)}`);
  }

  initRuntimeBadges();
  prewarmAfterLogin();
  sideEffectsReady = true;
}
