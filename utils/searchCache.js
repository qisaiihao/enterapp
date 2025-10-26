// 搜索缓存管理器
class SearchCacheManager {
  constructor() {
    this.cache = new Map();
    this.maxCacheSize = 50; // 最大缓存条目数
    this.cacheExpiry = 5 * 60 * 1000; // 5分钟过期
  }

  // 生成缓存键
  generateCacheKey(keyword, filter = 'all', sort = 'relevance', page = 1) {
    return `${keyword}_${filter}_${sort}_${page}`;
  }

  // 获取缓存
  get(keyword, filter = 'all', sort = 'relevance', page = 1) {
    const key = this.generateCacheKey(keyword, filter, sort, page);
    const cached = this.cache.get(key);
    
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      console.log('使用搜索缓存:', key);
      return cached.data;
    }
    
    if (cached) {
      this.cache.delete(key);
    }
    
    return null;
  }

  // 设置缓存
  set(keyword, filter = 'all', sort = 'relevance', page = 1, data) {
    const key = this.generateCacheKey(keyword, filter, sort, page);
    
    // 如果缓存已满，删除最旧的条目
    if (this.cache.size >= this.maxCacheSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    
    this.cache.set(key, {
      data: data,
      timestamp: Date.now()
    });
    
    console.log('设置搜索缓存:', key);
  }

  // 清除缓存
  clear() {
    this.cache.clear();
  }

  // 清除特定关键词的缓存
  clearByKeyword(keyword) {
    for (const key of this.cache.keys()) {
      if (key.startsWith(keyword + '_')) {
        this.cache.delete(key);
      }
    }
  }

  // 获取缓存统计
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
      keys: Array.from(this.cache.keys())
    };
  }
}

// 创建全局缓存实例
const searchCache = new SearchCacheManager();

module.exports = {
  searchCache,
  SearchCacheManager
};
