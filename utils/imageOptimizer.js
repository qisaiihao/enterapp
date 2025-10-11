// 图片优化工具
const imageLoader = require('./imageLoader');

class ImageOptimizer {
    constructor() {
        this.cache = new Map();
        this.preloadQueue = [];
        this.maxPreloadCount = 3;
        this.isH5 = typeof window !== 'undefined';
    }

    // 预加载图片
    async preloadImages(urls, callback) {
        if (!Array.isArray(urls) || urls.length === 0) {
            return;
        }
        const urlsToPreload = urls.slice(0, this.maxPreloadCount);
        
        // 使用新的图片加载工具
        for (const url of urlsToPreload) {
            if (this.cache.has(url)) {
                if (callback) {
                    callback(url, true);
                }
                continue;
            }
            
            try {
                const result = await imageLoader.loadImage(url, {
                    useCache: true,
                    fallbackToOriginal: true
                });
                
                if (result.success) {
                    this.cache.set(url, result.url);
                    if (callback) {
                        callback(url, true);
                    }
                } else {
                    console.error('图片预加载失败:', url, result.error);
                    if (callback) {
                        callback(url, false);
                    }
                }
            } catch (error) {
                console.error('图片预加载异常:', url, error);
                if (callback) {
                    callback(url, false);
                }
            }
        }
    }

    // 获取缓存的图片路径
    getCachedImage(url) {
        return this.cache.get(url) || url;
    }

    // 清理缓存
    clearCache() {
        this.cache.clear();
    }

    // 获取缓存大小
    getCacheSize() {
        return this.cache.size;
    }
}

// 创建单例
const imageOptimizer = new ImageOptimizer();
module.exports = imageOptimizer;
