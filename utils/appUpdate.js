import { appid as APP_ID } from '@/manifest.json';
import { getDeviceInfoCompat } from '@/utils/system-info.js';
import { isUpdateVersion, compareUpdateVersion } from '@/utils/updateVersion.js';

const UPDATE_ROUTE = 'pages/app-update/app-update';
const CACHE_KEY = 'appUpdate.v2.latest';
const CACHE_MS = 30 * 60 * 1000;
let checkFlight = null;
let installFlight = null;
let pendingUpdate = null;
let installedWgt = null; // Process-local: clears on restart, including silent installs.
let cancelDownload = null;
let downloaded = null;

function appRuntime() {
  // #ifdef APP-PLUS
  if (typeof plus !== 'undefined' && plus.runtime) return plus;
  // #endif
  return null;
}

function withTimeout(promise, ms, message) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
  });
}

export function getAppVersionInfo() {
  const runtime = appRuntime();
  if (!runtime || runtime.runtime.appid !== APP_ID) {
    return Promise.reject(new Error('请使用正式安装包检查更新'));
  }
  return withTimeout(new Promise((resolve, reject) => {
    runtime.runtime.getProperty(runtime.runtime.appid, widget => {
      const appVersion = runtime.runtime.version;
      const wgtVersion = widget && widget.version;
      const platform = getDeviceInfoCompat().platform;
      if (!isUpdateVersion(appVersion) || !isUpdateVersion(wgtVersion) || !['android', 'ios'].includes(platform)) {
        reject(new Error('无法读取有效的原生版本和资源版本'));
        return;
      }
      resolve({ appid: APP_ID, appVersion, wgtVersion, platform, protocolVersion: 2 });
    });
  }), 10000, '读取版本信息超时');
}

function validateUpdate(info, local) {
  if (!info || ![101, 102].includes(info.code) ||
    info.type !== (info.code === 101 ? 'wgt' : 'native_app') || info.hasUpdate !== true ||
    !isUpdateVersion(info.version) || typeof info.url !== 'string' || !/^https:\/\/[^\s]+$/.test(info.url)) {
    throw new Error('更新包信息无效');
  }
  if (info.type === 'wgt') {
    if (!isUpdateVersion(info.min_uni_version) ||
      compareUpdateVersion(local.appVersion, info.min_uni_version) < 0 ||
      (info.max_uni_version && (!isUpdateVersion(info.max_uni_version) || compareUpdateVersion(local.appVersion, info.max_uni_version) > 0)) ||
      compareUpdateVersion(info.version, local.wgtVersion) <= 0 || compareUpdateVersion(info.version, local.appVersion) <= 0) {
      throw new Error('资源包与当前原生版本不兼容');
    }
  } else if (compareUpdateVersion(info.version, local.appVersion) <= 0 || compareUpdateVersion(info.version, local.wgtVersion) < 0) {
    throw new Error('整包版本不高于当前版本，已停止更新');
  }
  return { ...info, devicePlatform: local.platform, is_mandatory: info.is_mandatory === true,
    is_silently: info.type === 'wgt' && info.is_silently === true && info.is_mandatory !== true };
}

export function getPendingUpdate() {
  return pendingUpdate;
}

export function isWgtInstalled(info) {
  return !!(info && info.type === 'wgt' && installedWgt && info.version === installedWgt.version);
}

export function releaseUpdatePage() {
  if (pendingUpdate && !pendingUpdate.is_mandatory) {
    cancelDownload?.();
    pendingUpdate = null;
  }
}

function showUpdate(info) {
  pendingUpdate = info;
  const stack = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
  if (stack[stack.length - 1]?.route === UPDATE_ROUTE) return Promise.resolve();
  return new Promise((resolve, reject) => {
    uni.navigateTo({ url: `/${UPDATE_ROUTE}`, success: resolve, fail: reject });
  });
}

async function performCheck(manual) {
  if (installedWgt) {
    if (!manual && installedWgt.is_mandatory) await showUpdate(installedWgt);
    return { type: 'restart_pending' };
  }
  if (pendingUpdate) {
    await showUpdate(pendingUpdate);
    return { type: pendingUpdate.type };
  }
  const local = await getAppVersionInfo();
  const fingerprint = `${local.appid}:${local.platform}:${local.appVersion}:${local.wgtVersion}`;
  if (!manual) {
    try {
      const cache = uni.getStorageSync(CACHE_KEY);
      const age = Date.now() - cache.time;
      if (cache.fingerprint === fingerprint && age >= 0 && age < CACHE_MS) return { type: 'latest' };
    } catch (_) { /* Cache failure must not prevent a check. */ }
  }
  const response = await withTimeout(uniCloud.callFunction({ name: 'checkAppUpdate', data: local }),
    20000, '检查更新超时，请稍后重试');
  const info = response && response.result;
  if (info && info.code === 0 && info.hasUpdate === false) {
    try { uni.setStorageSync(CACHE_KEY, { fingerprint, time: Date.now() }); } catch (_) { /* Optional cache. */ }
    return { type: 'latest' };
  }
  if (!info || info.code < 0) throw new Error(info?.message || '检查更新失败');
  const update = validateUpdate(info, local);
  if (update.is_silently && !manual) {
    await downloadAndInstallUpdate(update);
    return { type: 'restart_pending' };
  }
  await showUpdate(update);
  return { type: update.type };
}

export async function checkAndUpdate({ manual = false } = {}) {
  if (!appRuntime()) return { type: 'skip' };
  if (!checkFlight) checkFlight = performCheck(manual).finally(() => { checkFlight = null; });
  try {
    const result = await checkFlight;
    if (manual && result.type === 'latest') uni.showToast({ title: '已是最新版本', icon: 'none' });
    if (manual && result.type === 'restart_pending' && installedWgt) await showUpdate(installedWgt);
    return result;
  } catch (error) {
    if (manual) uni.showToast({ title: error.message || '检查更新失败，请稍后重试', icon: 'none' });
    throw error;
  }
}

function downloadPackage(runtime, info, onProgress) {
  const key = `${info.type}:${info.version}:${info.url}`;
  if (downloaded?.key === key) return Promise.resolve(downloaded.path);
  return new Promise((resolve, reject) => {
    let done = false;
    let task;
    const finish = (error, path) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      cancelDownload = null;
      if (error) reject(error);
      else { downloaded = { key, path }; resolve(path); }
    };
    // Absolute deadline in addition to the downloader's network timeout.
    const timer = setTimeout(() => {
      finish(new Error('下载超时，请重试'));
      task?.abort();
    }, 10 * 60 * 1000);
    try {
      task = runtime.downloader.createDownload(info.url, {
        filename: `_doc/update/${info.type}-${info.version}-${Date.now()}.${info.type === 'wgt' ? 'wgt' : 'apk'}`,
        timeout: 60, retry: 1
      }, (download, status) => {
        if (status === 200 && download.filename) finish(null, download.filename);
        else finish(new Error(`下载失败（${status}），请重试`));
      });
      task.addEventListener('statechanged', progress => {
        if (!done && progress.totalSize > 0) onProgress?.(Math.min(100, Math.round(progress.downloadedSize * 100 / progress.totalSize)));
      });
      cancelDownload = () => {
        finish(new Error('已取消下载'));
        task.abort();
      };
      task.start();
    } catch (error) { finish(error); }
  });
}

export function downloadAndInstallUpdate(info, onProgress) {
  if (installFlight) return installFlight;
  installFlight = (async () => {
    const runtime = appRuntime();
    if (!runtime) throw new Error('仅支持 App 更新');
    if (isWgtInstalled(info)) return { type: 'restart_pending' };
    // Revalidate against actual runtime immediately before installing.
    const local = await getAppVersionInfo();
    info = validateUpdate(info, local);
    if (info.type === 'native_app' && local.platform === 'ios') {
      // openURL has an error callback only; successful dispatch isn't installation.
      runtime.runtime.openURL(info.url, () => uni.showToast({ title: '无法打开商店，请重试', icon: 'none' }));
      return { type: 'store_opened' };
    }
    const path = await downloadPackage(runtime, info, onProgress);
    onProgress?.(100);
    try {
      await withTimeout(new Promise((resolve, reject) => {
        runtime.runtime.install(path, { force: false }, resolve, reject);
      }), 120000, '安装未完成，请重试');
    } catch (error) {
      downloaded = null;
      throw new Error(error.message || '安装失败，请重新下载');
    }
    if (info.type === 'wgt') {
      installedWgt = info;
      downloaded = null;
      try { uni.removeStorageSync(CACHE_KEY); } catch (_) { /* Optional cache. */ }
      return { type: 'restart_pending' };
    }
    // Native installer success callback does not prove a new APK was installed.
    return { type: 'installation_requested' };
  })().finally(() => { installFlight = null; });
  return installFlight;
}

export function restartAfterUpdate() {
  if (installedWgt) appRuntime()?.runtime.restart();
}
