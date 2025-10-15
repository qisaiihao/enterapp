// 账号切换/重新登录后的缓存清理与预热
// 使用处：登录成功、从设置里切换账号后

import cacheManager from '@/_utils/cache-manager';
import fileUrlCache from '@/_utils/file-url-cache';
const followCache = require('./followCache.js');
import { getMyInfo } from '@/api-cache/my.js';

function clearAllNamespaces() {
  try {
    const stats = (cacheManager && cacheManager.getStats) ? cacheManager.getStats() : {};
    Object.keys(stats || {}).forEach((nsName) => {
      try { cacheManager.namespace(nsName).clear(); } catch (_) {}
    });
  } catch (_) {}
}

function clearKeyValueResidue() {
  try { if (typeof uni !== 'undefined') uni.removeStorageSync('cachedPostList'); } catch (_) {}
}

// 强力清理：从本地存储扫描所有 __cm__:* 命名空间并逐一 clear（包括尚未被加载到内存的 namespace）
function sweepPersistedNamespaces() {
  try {
    if (typeof uni === 'undefined' || typeof uni.getStorageInfoSync !== 'function') return;
    const info = uni.getStorageInfoSync();
    const keys = (info && info.keys) || [];
    const nsSet = new Set();
    keys.forEach((k) => {
      if (typeof k === 'string' && k.startsWith('__cm__:') && k.endsWith(':__keys__')) {
        const ns = k.substring('__cm__:'.length, k.length - ':__keys__'.length);
        if (ns) nsSet.add(ns);
      }
    });
    nsSet.forEach((ns) => {
      try { cacheManager.namespace(ns, { persistent: true }).clear(); } catch (_) {}
    });
  } catch (_) {}
}

export async function resetAllCachesOnAccountChange({ newOpenId } = {}) {
  try {
    // 1) 清 fileUrlCache（内存 + 命名空间）
    try { fileUrlCache.invalidate(); } catch (_) {}
    // 2) 清所有 CacheManager 命名空间（包含 me:* / posts:* / profiles:* / avatars / follow:* / fileUrls 等）
    clearAllNamespaces();
    sweepPersistedNamespaces();
    // 3) 清理一些旧的散落本地键
    clearKeyValueResidue();
    // 4) 关注缓存针对所有用户的命名空间也做一次扫描清除（函数内部会遍历 storage key）
    try { if (followCache && followCache.clearAllFollowCache) followCache.clearAllFollowCache(); } catch (_) {}
    // 5) 预热当前用户信息，避免页面首次仍使用旧数据
    try {
      const app = (typeof getApp === 'function') ? getApp() : null;
      const ctx = app || { $tcb: (app && app.$tcb) ? app.$tcb : null };
      await getMyInfo(ctx);
    } catch (_) {}
  } catch (e) {
    // 允许静默失败，不阻塞登录流程
    try { console.warn('[accountCacheReset] 清理缓存时出错', e); } catch (_) {}
  }
}

export default { resetAllCachesOnAccountChange };
