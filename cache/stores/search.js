/**
 * 搜索缓存存储
 * 
 * 命名空间: search
 * TTL: 5分钟
 * 持久化: 否
 */
import cacheManager from '../core/manager.js';

const NS_SEARCH = cacheManager.namespace('search', { persistent: false, maxItems: 50 });
const SEARCH_TTL_MS = 5 * 60 * 1000; // 5分钟

class SearchCache {
  generateCacheKey(keyword, filter = 'all', sort = 'relevance', page = 1) {
    return `${keyword}_${filter}_${sort}_${page}`;
  }

  get(keyword, filter = 'all', sort = 'relevance', page = 1) {
    const key = this.generateCacheKey(keyword, filter, sort, page);
    const cached = NS_SEARCH.get(key);
    if (cached) {
      console.log('使用搜索缓存:', key);
      return cached;
    }
    return null;
  }

  set(keyword, filter = 'all', sort = 'relevance', page = 1, data) {
    const key = this.generateCacheKey(keyword, filter, sort, page);
    NS_SEARCH.set(key, data, { ttlMs: SEARCH_TTL_MS });
    console.log('设置搜索缓存:', key);
  }

  clear() {
    NS_SEARCH.clear();
  }

  clearByKeyword(keyword) {
    const keys = NS_SEARCH.keys();
    keys.forEach((key) => {
      if (key.startsWith(keyword + '_')) {
        NS_SEARCH.delete(key);
      }
    });
  }

  getStats() {
    return {
      size: NS_SEARCH.keys().length,
      maxSize: 50,
      keys: NS_SEARCH.keys()
    };
  }
}

const searchCache = new SearchCache();

const searchStore = {
  searchCache,
  SearchCache
};

export {
  searchCache,
  SearchCache
};

export default searchStore;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = searchStore;
  module.exports.default = searchStore;
}
