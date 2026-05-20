import { silenceConsoleInProduction } from '@/utils/logger.js';
import App from './App';
import AppBackgroundPageRoot from '@/components/AppBackgroundPageRoot.vue';
import cacheManager from '@/cache/core/manager.js';
import { getAppState, getOpenid } from '@/utils/app-state.js';
import { ensureRuntimeOpenid, ensureTcbAuthenticated, ensureTcbReady, installRuntimeBindings, setupRuntimeSideEffects } from '@/utils/runtime-bootstrap.js';
import zpMixins from '@/uni_modules/zp-mixins/index.js';
import appFontManager from './utils/fontManager.js';
import { THEME_CHANGED_EVENT, applyThemeMode, getThemeMode, getThemeVars } from '@/utils/theme.js';

silenceConsoleInProduction();
applyThemeMode(getThemeMode());

function emitBuiltinFontLoaded() {
  try {
    uni.$emit && uni.$emit('font-loaded', { fontFamily: '汇文明朝' });
  } catch (error) {}
}

// #ifdef H5
if (typeof document !== 'undefined') {
  const fontLink = document.createElement('link');
  fontLink.rel = 'preload';
  fontLink.as = 'font';
  fontLink.type = 'font/woff2';
  fontLink.href = '/static/fonts/Huiwen-mincho-compressed.woff2';
  fontLink.crossOrigin = 'anonymous';
  document.head.appendChild(fontLink);

  const fontStyle = document.createElement('style');
  fontStyle.textContent = `
    @font-face {
      font-family: '汇文明朝';
      src: url('/static/fonts/Huiwen-mincho-compressed.woff2') format('woff2');
      font-weight: normal;
      font-style: normal;
      font-display: swap;
    }
  `;
  document.head.appendChild(fontStyle);

  if (typeof FontFace !== 'undefined') {
    const font = new FontFace('汇文明朝', 'url(/static/fonts/Huiwen-mincho-compressed.woff2)');
    font.load().then((loadedFont) => {
      document.fonts.add(loadedFont);
      emitBuiltinFontLoaded();
    }).catch((error) => {
      console.warn('[font preload] h5 load failed', error);
    });
  }
}
// #endif

// #ifdef APP-PLUS
function preloadBuiltinAppFont() {
  if (!appFontManager || typeof appFontManager.ensureFontAvailable !== 'function') {
    return;
  }
  appFontManager.ensureFontAvailable('汇文明朝').then(() => {
    emitBuiltinFontLoaded();
  }).catch((error) => {
    console.warn('[font preload] app plus load failed', error);
  });
}

if (typeof plus !== 'undefined') {
  preloadBuiltinAppFont();
}
// #endif

// #ifdef APP-HARMONY
console.log('[font preload] harmony uses bundled/static font fallback');
// #endif

// #ifdef MP-WEIXIN
console.log('[font preload] mp-weixin skips builtin preload');
// #endif

const runtimeTcb = ensureTcbReady();
setupRuntimeSideEffects();

try {
  let debugEnabled = false;
  try {
    const value = uni.getStorageSync && uni.getStorageSync('CACHE_DEBUG');
    debugEnabled = value === true || value === '1' || value === 1 || value === 'true';
  } catch (error) {}
  cacheManager.setDebug(!!debugEnabled);
  if (typeof uni !== 'undefined') {
    uni.$cacheStats = () => {
      try {
        console.log('[CacheStats]', cacheManager.getStats());
      } catch (error) {
        console.log('[CacheStats] failed', error);
      }
    };
    uni.$cacheDebug = (enabled) => {
      try {
        cacheManager.setDebug(!!enabled);
        console.log('[CacheDebug] =', !!enabled);
      } catch (error) {}
    };
  }
} catch (error) {
  console.warn('cache debug setup failed', error);
}

function normalizeCloudCallOptions(options = {}) {
  const nextOptions = Object.assign({}, options);
  delete nextOptions.__skipOpenidGuard;
  return nextOptions;
}

async function resolveOpenidForCall(functionName) {
  if (functionName === 'login' || functionName === 'getOpenId' || functionName === 'getPhoneNumberByToken') {
    return { openid: null, allowed: true };
  }

  let openid = getOpenid();
  if (!openid) {
    openid = await ensureRuntimeOpenid();
  }
  if (!openid) {
    const state = getAppState();
    if (state._loginProcessCompleted && typeof uni !== 'undefined' && typeof uni.showToast === 'function') {
      uni.showToast({ title: '用户未登录', icon: 'none' });
    }
    return { openid: null, allowed: false };
  }

  return { openid, allowed: true };
}

// #ifdef APP-PLUS || APP-HARMONY
if (typeof uniCloud !== 'undefined' && typeof uniCloud.callFunction === 'function') {
  const originalUniCloudCallFunction = uniCloud.callFunction.bind(uniCloud);
  uniCloud.callFunction = async function(options = {}) {
    const normalizedOptions = normalizeCloudCallOptions(options);
    const name = normalizedOptions.name;
    if (!name || options.__skipOpenidGuard) {
      return originalUniCloudCallFunction(normalizedOptions);
    }

    const { openid, allowed } = await resolveOpenidForCall(name);
    if (!allowed) {
      const error = new Error('NO_OPENID');
      error.code = 'NO_OPENID';
      if (typeof normalizedOptions.fail === 'function') {
        normalizedOptions.fail(error);
      }
      if (typeof normalizedOptions.complete === 'function') {
        normalizedOptions.complete(error);
      }
      throw error;
    }

    const data = Object.assign({}, normalizedOptions.data || {});
    if (openid && !data.openid) {
      data.openid = openid;
    }
    return originalUniCloudCallFunction(Object.assign({}, normalizedOptions, { data }));
  };
}
// #endif

// #ifdef H5 || APP-PLUS || APP-HARMONY
if (runtimeTcb && typeof runtimeTcb.callFunction === 'function') {
  const originalTcbCallFunction = runtimeTcb.callFunction.bind(runtimeTcb);
  runtimeTcb.callFunction = async function(options = {}) {
    const normalizedOptions = normalizeCloudCallOptions(options);
    const name = normalizedOptions.name;
    if (!name || options.__skipOpenidGuard) {
      return originalTcbCallFunction(normalizedOptions);
    }

    await ensureTcbAuthenticated(runtimeTcb);

    const { openid, allowed } = await resolveOpenidForCall(name);
    if (!allowed) {
      const error = new Error('NO_OPENID');
      error.code = 'NO_OPENID';
      if (typeof normalizedOptions.fail === 'function') {
        normalizedOptions.fail(error);
      }
      if (typeof normalizedOptions.complete === 'function') {
        normalizedOptions.complete(error);
      }
      throw error;
    }

    const data = Object.assign({}, normalizedOptions.data || {});
    if (openid && !data.openid) {
      data.openid = openid;
    }
    return originalTcbCallFunction(Object.assign({}, normalizedOptions, { data }));
  };
}
// #endif

function notifyH5AppReady() {
  // #ifdef H5
  if (typeof window === 'undefined') {
    return;
  }
  if (typeof window.__ENTERAPP_HIDE_BOOT_MASK__ === 'function') {
    window.__ENTERAPP_HIDE_BOOT_MASK__();
  }
  window.dispatchEvent(new Event('enterapp-ready'));
  // #endif
}

import { createSSRApp } from 'vue';

export function createApp() {
  const app = createSSRApp(App);
  installRuntimeBindings(app);
  app.use(zpMixins);
  app.mixin({
    data() {
      return {
        appThemeMode: getThemeMode()
      };
    },
    computed: {
      appThemeVars() {
        return getThemeVars(this.appThemeMode);
      }
    },
    created() {
      if (typeof uni === 'undefined' || typeof uni.$on !== 'function') {
        return;
      }
      this._appThemeChangedHandler = (payload = {}) => {
        const mode = payload.mode || getThemeMode();
        this.appThemeMode = mode;
        applyThemeMode(mode);
      };
      uni.$on(THEME_CHANGED_EVENT, this._appThemeChangedHandler);
    },
    beforeUnmount() {
      if (this._appThemeChangedHandler && typeof uni !== 'undefined' && typeof uni.$off === 'function') {
        uni.$off(THEME_CHANGED_EVENT, this._appThemeChangedHandler);
      }
      this._appThemeChangedHandler = null;
    }
  });
  app.component('app-background-page-root', AppBackgroundPageRoot);
  applyThemeMode(getThemeMode());
  notifyH5AppReady();
  return {
    app
  };
}
