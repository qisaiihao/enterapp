/**
 * 统一缓存系统入口
 * 
 * 使用方式：
 * ```js
 * import cache from '@/cache';
 * 
 * // 核心管理器
 * const ns = cache.manager.namespace('myData', { persistent: true });
 * ns.set('key', value, { ttlMs: 60000 });
 * 
 * // 文件 URL 缓存
 * const url = await cache.fileUrl.getTempUrl('cloud://...');
 * 
 * // 业务缓存
 * const avatar = await cache.stores.avatarCache.getUserAvatar(userId);
 * 
 * // 工具函数
 * await cache.hydrateTempUrls(posts);
 * cache.buildCacheKey({ page: 0, pageSize: 10 });
 * ```
 */

// 核心模块
const cacheManager = require('./core/manager');
const fileUrlCache = require('./core/file-url').default || require('./core/file-url');
const { hydrateTempUrls, warmTempUrlsFromPosts } = require('./core/hydrate');
const { buildCacheKey, parseCacheKey, isQueryMatch } = require('./core/key-builder');

// 业务缓存存储
const stores = require('./stores');

// 事件桥
const { setupCacheEventBridges } = require('./events');

// 统一导出
module.exports = {
  // 核心管理器
  manager: cacheManager,
  
  // 文件 URL 缓存
  fileUrl: fileUrlCache,
  
  // 业务缓存存储
  stores,
  
  // 工具函数
  hydrateTempUrls,
  warmTempUrlsFromPosts,
  buildCacheKey,
  parseCacheKey,
  isQueryMatch,
  
  // 事件桥初始化
  setupCacheEventBridges,
  
  // 便捷访问（向后兼容）
  avatarCache: stores.avatarCache,
  followCache: stores.followCache,
  signatureCache: stores.signatureCache,
  searchCache: stores.searchCache,
  likeStatusCache: stores.likeStatusCache,
  searchHistoryCache: stores.searchHistoryCache,
  refreshFlags: stores.refreshFlags,
  unreadBadge: stores.unreadBadge,
  
  // 调试工具
  getStats: () => cacheManager.getStats(),
  setDebug: (enabled) => cacheManager.setDebug(enabled),
  clearAll: () => cacheManager.clearAll()
};

// ES Module 兼容
module.exports.default = module.exports;
