// 字体预加载 - 确保Huiwen-mincho字体在应用启动时就加载
// #ifdef H5
if (typeof document !== 'undefined') {
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
      font-family: 'Huiwen-mincho';
      src: url('/static/fonts/Huiwen-mincho.otf') format('opentype');
      font-weight: normal;
      font-style: normal;
      font-display: swap;
    }
  `;
  document.head.appendChild(fontStyle);
}
// #endif

// #ifdef APP-PLUS
// App端字体预加载
try {
  const fontPath = plus.io.convertLocalFileSystemURL('/static/fonts/Huiwen-mincho.otf');
} catch (e) {
  console.warn('🔤 [字体预加载] App端字体预加载失败:', e);
}
// #endif

// #ifdef MP-WEIXIN
// 微信小程序字体预加载
// #endif

import App from './App';
import fileUrlCache from './_utils/file-url-cache';
import { setupCacheEventBridges } from '@/api-cache/events.js';
import { getMyInfo } from '@/api-cache/my.js';

// 全局mixins，用于实现setData等功能，请勿删除！';
import zpMixins from '@/uni_modules/zp-mixins/index.js';

// #ifndef VUE3
import Vue from 'vue';

// --- TCB 初始化开始 (这是我们新加的部分) ---
// 1. 引入新的、正确的 tencent-cloudbase SDK
// #ifdef H5 || APP-PLUS
import tcb from '@cloudbase/js-sdk';
// #endif

// 2. 初始化云开发环境（支持热更新/重复执行，确保单例）
// #ifdef H5 || APP-PLUS
const __global = (typeof globalThis !== 'undefined') ? globalThis : (typeof window !== 'undefined' ? window : {});
const tcbApp = __global.__tcbAppInstance || tcb.init({
  env: 'cloud1-5gb0pbyl400845f5',
  auth: { persistence: 'local' }
});
if (!__global.__tcbAppInstance) {
  __global.__tcbAppInstance = tcbApp;
}
// #endif

// 3. 将 tcb 实例挂载到 Vue 的原型上
// #ifdef H5 || APP-PLUS
Vue.prototype.$tcb = tcbApp;
// #endif
// #ifdef MP-WEIXIN
Vue.prototype.$tcb = {
  callFunction(options = {}) { return wx.cloud.callFunction(options); },
  getTempFileURL(args = {}) { return wx.cloud.getTempFileURL(args); }
};
// #endif

// 注入临时 URL 解析器（全平台支持）
try {
  fileUrlCache.setResolver(async (ids) => {
    if (!Array.isArray(ids) || ids.length === 0) return {};

    let res;
    // #ifdef H5 || APP-PLUS
    if (typeof tcbApp !== 'undefined' && tcbApp.getTempFileURL) {
      res = await tcbApp.getTempFileURL({ fileList: ids });
    }
    // #endif

    // #ifdef MP-WEIXIN
    if (typeof wx !== 'undefined' && wx.cloud && wx.cloud.getTempFileURL) {
      res = await wx.cloud.getTempFileURL({ fileList: ids });
    }
    // #endif

    const map = {};
    if (res && Array.isArray(res.fileList)) {
      res.fileList.forEach((it) => {
        if (it && it.tempFileURL) {
          map[it.fileID] = { url: it.tempFileURL, maxAgeSec: it.maxAge || 3600 };
        }
      });
    }
    return map;
  });
} catch (e) {
  console.warn('fileUrlCache resolver setup failed:', e);
}


// 5. 立即进行匿名认证，确保在调用云函数之前完成认证（幂等处理）
// 这是关键修复：在应用启动时就完成 TCB 匿名认证，避免后续调用云函数时出现 "you can't request without auth" 错误
// #ifdef H5 || APP-PLUS
(async () => {
  try {
    // 检查是否已经登录
    const currentUser = tcbApp.auth().currentUser;
    if (!currentUser) {
      await tcbApp.auth().signInAnonymously();
    }
  } catch (error) {
    console.error('❌ [TCB初始化] 匿名认证失败:', error);
    // 认证失败不应该阻止应用启动，只是会影响后续的云函数调用
  }
})();
// #endif
Vue.prototype.$requireOpenid = function () {
  const appInstance = getApp();
  let openid = appInstance && appInstance.globalData && appInstance.globalData.openid;
  // H5/App 刷新后先从本地缓存兜底恢复
  if (!openid) {
    try {
      openid = uni.getStorageSync('userOpenId') || uni.getStorageSync('openid');
      if (openid) {
        appInstance.globalData = appInstance.globalData || {};
        appInstance.globalData.openid = openid;
      }
    } catch (e) {}
  }
  if (!openid) {
    // 检查是否是应用启动初期（避免在自动登录过程中显示提示）
    const isAppStarting = !appInstance.globalData || !appInstance.globalData._loginProcessCompleted;
    if (!isAppStarting) {
      uni.showToast({ title: '用户未登录', icon: 'none' });
    }
  }
  return openid;
};
// --- TCB 初始化结束 ---

// 缓存事件桥：监听发帖/头像更新等事件并失效相关缓存
try { setupCacheEventBridges(); } catch (e) { console.warn('setupCacheEventBridges failed', e); }

// 登录完成后预热：我的资料 + 头像
try {
  const waitLoginThen = (fn) => {
    const start = Date.now();
    const MAX = 5000; // 最多等待 5s
    const timer = setInterval(() => {
      try {
        const app = getApp && getApp();
        const done = app && app.globalData && app.globalData._loginProcessCompleted;
        const oid = app && app.globalData && app.globalData.openid;
        if ((done && oid) || Date.now() - start > MAX) {
          clearInterval(timer);
          fn && fn();
        }
      } catch (_) { clearInterval(timer); }
    }, 120);
  };

  waitLoginThen(async () => {
    try {
      const ctx = { $tcb: (Vue && Vue.prototype && Vue.prototype.$tcb) ? Vue.prototype.$tcb : (typeof uni !== 'undefined' && uni.$tcb ? uni.$tcb : null) };
      // 触发一次资料读取（内部会将 cloud:// 头像映射为 https，并写入持久层）
      await getMyInfo(ctx);
    } catch (e) {
      console.warn('🔰 [prewarm] getMyInfo failed', e);
    }
  });
} catch (e) { console.warn('prewarm setup failed', e); }

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
  const appInstance = getApp();
  let openid = appInstance && appInstance.globalData && appInstance.globalData.openid;
  // 刷新后优先从本地恢复 openid，并回填到 globalData，保证早期请求可用
  if (!openid) {
    try {
      openid = uni.getStorageSync('userOpenId') || uni.getStorageSync('openid');
      if (openid) {
        appInstance.globalData = appInstance.globalData || {};
        appInstance.globalData.openid = openid;
      }
    } catch (e) {}
  }
  if (!openid) {
    // 检查是否是应用启动初期（避免在自动登录过程中显示提示）
    const isAppStarting = !appInstance.globalData || !appInstance.globalData._loginProcessCompleted;
    if (!isAppStarting) {
      uni.showToast({ title: '用户未登录', icon: 'none' });
    }
    return { openid: null, allowed: false };
  }
  return { openid, allowed: true };
}

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

// #ifdef H5 || APP-PLUS
const originalTcbCallFunction = tcbApp.callFunction.bind(tcbApp);
tcbApp.callFunction = function (options = {}) {
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
// #endif

Vue.use(zpMixins); // 保留这行

Vue.config.productionTip = false;
App.mpType = 'app';
const app = new Vue({
    ...App
});
app.$mount();
// #endif

// #ifdef VUE3
import { createSSRApp } from 'vue';
// VUE3环境下的TCB引入
// #ifdef H5 || APP-PLUS
import tcb from '@cloudbase/js-sdk';
// #endif

export function createApp() {
    const app = createSSRApp(App);
    
    // --- VUE3 环境下的 TCB 初始化 (为您一并写好，以备未来升级) ---
    // #ifdef H5 || APP-PLUS
    // 1. 初始化
    const tcbApp = tcb.init({
      env: 'cloud1-5gb0pbyl400845f5',  // 使用正确的环境ID
      // 启用匿名认证，允许未登录用户调用云函数
      auth: {
        persistence: 'local'
      }
    });
    // 2. 挂载
    app.config.globalProperties.$tcb = tcbApp;
    
    // 3. 立即进行匿名认证，确保在调用云函数之前完成认证
    (async () => {
      try {
        const currentUser = tcbApp.auth().currentUser;
        if (!currentUser) {
          await tcbApp.auth().signInAnonymously();
        }
      } catch (error) {
        console.error('❌ [TCB初始化-VUE3] 匿名认证失败:', error);
      }
    })();
    // #endif
    // #ifdef MP-WEIXIN
    app.config.globalProperties.$tcb = {
      callFunction(options = {}) { return wx.cloud.callFunction(options); },
      getTempFileURL(args = {}) { return wx.cloud.getTempFileURL(args); }
    };

    // 注入临时 URL 解析器（VUE3环境）
    try {
      fileUrlCache.setResolver(async (ids) => {
        if (!Array.isArray(ids) || ids.length === 0) return {};
        let res;
        // #ifdef H5 || APP-PLUS
        if (typeof tcbApp !== 'undefined' && tcbApp.getTempFileURL) {
          res = await tcbApp.getTempFileURL({ fileList: ids });
        }
        // #endif
        // #ifdef MP-WEIXIN
        if (typeof wx !== 'undefined' && wx.cloud && wx.cloud.getTempFileURL) {
          res = await wx.cloud.getTempFileURL({ fileList: ids });
        }
        // #endif
        const map = {};
        if (res && Array.isArray(res.fileList)) {
          res.fileList.forEach((it) => {
            if (it && it.tempFileURL) {
              map[it.fileID] = { url: it.tempFileURL, maxAgeSec: it.maxAge || 3600 };
            }
          });
        }
        return map;
      });
    } catch (e) {
      console.warn('fileUrlCache resolver setup failed (VUE3):', e);
    }
    // #endif
    app.config.globalProperties.$requireOpenid = function () {
      const appInstance = getApp();
      const openid = appInstance && appInstance.globalData && appInstance.globalData.openid;
      if (!openid) {
        uni.showToast({ title: '用户未登录', icon: 'none' });
      }
      return openid;
    };
    // --- TCB 初始化结束 ---
    
    app.mixin(zpMixins); // 保留这行
    return {
        app
    };
}
// #endif
