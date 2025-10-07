import App from './App';

// 全局mixins，用于实现setData等功能，请勿删除！';
import zpMixins from '@/uni_modules/zp-mixins/index.js';

// #ifndef VUE3
import Vue from 'vue';

// --- TCB 初始化开始 (这是我们新加的部分) ---
// 1. 引入新的、正确的 tencent-cloudbase SDK
import tcb from '@cloudbase/js-sdk';

// 2. 初始化云开发环境
const tcbApp = tcb.init({
  // !!!【请在此处替换为您自己的环境 ID】!!!
  env: 'cloud1-5gb0pbyl400845f5',
  // 启用匿名认证，允许未登录用户调用云函数
  auth: {
    persistence: 'local'
  }
});

// 3. 将 tcb 实例挂载到 Vue 的原型上
Vue.prototype.$tcb = tcbApp;

// 4. 添加调试信息，确保TCB正确初始化
console.log('🔧 [TCB初始化] TCB实例已创建:', tcbApp);
console.log('🔧 [TCB初始化] 环境ID:', tcbApp.config?.env);
console.log('🔧 [TCB初始化] 数据库方法可用:', typeof tcbApp.database === 'function');
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

function resolveOpenidForCall(functionName) {
  // 登录/获取 openid 类函数允许在无 openid 时调用
  if (functionName === 'login' || functionName === 'getOpenId') {
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
import tcb from '@cloudbase/js-sdk';

export function createApp() {
    const app = createSSRApp(App);
    
    // --- VUE3 环境下的 TCB 初始化 (为您一并写好，以备未来升级) ---
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
