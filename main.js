// 【性能优化】生产环境静默日志输出
import { silenceConsoleInProduction } from '@/utils/logger.js';
silenceConsoleInProduction();

// 字体预加载 - 确保汇文明朝字体在应用启动时就加载
// #ifdef H5
if (typeof document !== 'undefined') {
  console.log('🔤 [字体预加载] H5端开始预加载汇文明朝字体');
  
  // 创建字体预加载链接
  const fontLink = document.createElement('link');
  fontLink.rel = 'preload';
  fontLink.as = 'font';
  fontLink.type = 'font/otf';
  fontLink.href = '/static/fonts/Huiwen-mincho.otf';
  fontLink.crossOrigin = 'anonymous';
  document.head.appendChild(fontLink);
  
  // 同时创建字体样式表
  const fontStyle = document.createElement('style');
  fontStyle.textContent = `
    @font-face {
      font-family: '汇文明朝';
      src: url('/static/fonts/Huiwen-mincho.otf') format('opentype');
      font-weight: normal;
      font-style: normal;
      font-display: swap;
    }
  `;
  document.head.appendChild(fontStyle);
  
  // 使用 FontFace API 强制加载字体
  if (typeof FontFace !== 'undefined') {
    const font = new FontFace('汇文明朝', 'url(/static/fonts/Huiwen-mincho.otf)');
    font.load().then(function(loadedFont) {
      document.fonts.add(loadedFont);
      console.log('✅ [字体预加载] H5端汇文明朝字体加载成功');
    }).catch(function(error) {
      console.error('❌ [字体预加载] H5端汇文明朝字体加载失败:', error);
    });
  }
}
// #endif

// #ifdef APP-PLUS
// App端字体预加载
console.log('🔤 [字体预加载] App端开始预加载汇文明朝字体');
try {
  const fontPath = plus.io.convertLocalFileSystemURL('_www/static/fonts/Huiwen-mincho.otf');
  console.log('📍 [字体预加载] App端字体路径:', fontPath);
  
  // 使用 uni.loadFontFace 加载字体
  uni.loadFontFace({
    family: '汇文明朝',
    source: `url("${fontPath}")`,
    global: true,
    success: function() {
      console.log('✅ [字体预加载] App端汇文明朝字体加载成功');
    },
    fail: function(err) {
      console.error('❌ [字体预加载] App端汇文明朝字体加载失败:', err);
    }
  });
} catch (e) {
  console.warn('❌ [字体预加载] App端字体预加载失败:', e);
}
// #endif

// #ifdef MP-WEIXIN
// 微信小程序端不预加载字体，使用系统默认字体
console.log('⚠️ [字体预加载] 小程序端跳过字体预加载，使用系统字体');
// #endif

import App from './App';
import { getAppState, getOpenid } from '@/utils/app-state.js';
import { ensureTcbReady, installRuntimeBindings, setupRuntimeSideEffects } from '@/utils/runtime-bootstrap.js';

// 全局mixins，用于实现setData等功能，请勿删除！';
import zpMixins from '@/uni_modules/zp-mixins/index.js';

const runtimeTcb = ensureTcbReady();
setupRuntimeSideEffects();

// 调试：读取本地 CACHE_DEBUG 开关并注入查看函数
try {
  const cacheManager = require('@/_utils/cache-manager');
  let dbg = false;
  try { const v = uni.getStorageSync && uni.getStorageSync('CACHE_DEBUG'); dbg = v === true || v === '1' || v === 1 || v === 'true'; } catch(_) {}
  cacheManager.setDebug(!!dbg);
  if (typeof uni !== 'undefined') {
    uni.$cacheStats = () => { try { console.log('[CacheStats]', cacheManager.getStats()); } catch(e) { console.log('[CacheStats] failed', e); } };
    uni.$cacheDebug = (on) => { try { cacheManager.setDebug(!!on); console.log('[CacheDebug] =', !!on); } catch(e) {} };
  }
} catch(e) { console.warn('cache debug setup failed', e); }

function resolveOpenidForCall(functionName) {
  // 登录/获取 openid 类函数允许在无 openid 时调用
  // getPhoneNumberByToken 是 uniCloud 云函数，仅用于获取手机号，不需要腾讯云开发的 openid
  if (functionName === 'login' || functionName === 'getOpenId' || functionName === 'getPhoneNumberByToken') {
    return { openid: null, allowed: true };
  }
  const state = getAppState();
  const openid = getOpenid();
  if (!openid) {
    // 检查是否是应用启动初期（避免在自动登录过程中显示提示）
    const isAppStarting = !state._loginProcessCompleted;
    if (!isAppStarting) {
      uni.showToast({ title: '用户未登录', icon: 'none' });
    }
    return { openid: null, allowed: false };
  }
  return { openid, allowed: true };
}

// #ifdef APP-PLUS
// uniCloud 拦截器仅在 APP 环境下启用（用于热更新和一键登录）
const originalUniCloudCallFunction = uniCloud.callFunction.bind(uniCloud);
uniCloud.callFunction = function (options = {}) {
  const name = options.name;
  if (!name) {
    return originalUniCloudCallFunction(options);
  }
  const { openid, allowed } = resolveOpenidForCall(name);
  if (!allowed) {
    const error = new Error('NO_OPENID');
    error.code = 'NO_OPENID';
    if (typeof options.fail === 'function') {
      options.fail(error);
    }
    if (typeof options.complete === 'function') {
      options.complete(error);
    }
    return Promise.reject(error);
  }
  const data = Object.assign({}, options.data || {});
  if (openid) {
    data.openid = openid;
  }
  const mergedOptions = Object.assign({}, options, { data });
  return originalUniCloudCallFunction(mergedOptions);
};
// #endif

// #ifdef H5 || APP-PLUS
if (runtimeTcb && typeof runtimeTcb.callFunction === 'function') {
  const originalTcbCallFunction = runtimeTcb.callFunction.bind(runtimeTcb);
  runtimeTcb.callFunction = function (options = {}) {
    const name = options.name;
    if (!name) {
      return originalTcbCallFunction(options);
    }
    const { openid, allowed } = resolveOpenidForCall(name);
    if (!allowed) {
      const error = new Error('NO_OPENID');
      error.code = 'NO_OPENID';
      if (typeof options.fail === 'function') {
        options.fail(error);
      }
      if (typeof options.complete === 'function') {
        options.complete(error);
      }
      return Promise.reject(error);
    }
    const data = Object.assign({}, options.data || {});
    if (openid) {
      data.openid = openid;
    }
    const mergedOptions = Object.assign({}, options, { data });
    return originalTcbCallFunction(mergedOptions);
  };
}
// #endif

// #ifndef VUE3
import Vue from 'vue';

installRuntimeBindings(Vue);
Vue.use(zpMixins); // 保留这行

Vue.config.productionTip = false;
App.mpType = 'app';
const app = new Vue({
    ...App
});
installRuntimeBindings(app);
app.$mount();
// #endif

// #ifdef VUE3
import { createSSRApp } from 'vue';

export function createApp() {
    const app = createSSRApp(App);
    installRuntimeBindings(app);
    app.mixin(zpMixins);
    return {
        app
    };
}
// #endif
