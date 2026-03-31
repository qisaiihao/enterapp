/**
 * Unified cache entrypoint.
 */

import cacheManager from './core/manager.js';
import fileUrlCache from './core/file-url.js';
import { hydrateTempUrls, warmTempUrlsFromPosts } from './core/hydrate.js';
import { buildCacheKey, parseCacheKey, isQueryMatch } from './core/key-builder.js';
import stores from './stores/index.js';
import { setupCacheEventBridges } from './events.js';

const manager = cacheManager;
const fileUrl = fileUrlCache;
const avatarCache = stores.avatarCache;
const followCache = stores.followCache;
const signatureCache = stores.signatureCache;
const searchCache = stores.searchCache;
const likeStatusCache = stores.likeStatusCache;
const searchHistoryCache = stores.searchHistoryCache;
const refreshFlags = stores.refreshFlags;
const unreadBadge = stores.unreadBadge;
const activityBadge = stores.activityBadge;
const getStats = () => cacheManager.getStats();
const setDebug = (enabled) => cacheManager.setDebug(enabled);
const clearAll = () => cacheManager.clearAll();

const cache = {
  manager,
  fileUrl,
  stores,
  hydrateTempUrls,
  warmTempUrlsFromPosts,
  buildCacheKey,
  parseCacheKey,
  isQueryMatch,
  setupCacheEventBridges,
  avatarCache,
  followCache,
  signatureCache,
  searchCache,
  likeStatusCache,
  searchHistoryCache,
  refreshFlags,
  unreadBadge,
  activityBadge,
  getStats,
  setDebug,
  clearAll
};

export {
  manager,
  fileUrl,
  stores,
  hydrateTempUrls,
  warmTempUrlsFromPosts,
  buildCacheKey,
  parseCacheKey,
  isQueryMatch,
  setupCacheEventBridges,
  avatarCache,
  followCache,
  signatureCache,
  searchCache,
  likeStatusCache,
  searchHistoryCache,
  refreshFlags,
  unreadBadge,
  activityBadge,
  getStats,
  setDebug,
  clearAll
};

export default cache;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = cache;
  module.exports.default = cache;
}
