// 通用图片加载工具 - 解决H5环境下的CORS问题
class ImageLoader {
    constructor() {
        this.cache = new Map();
        this.isH5 = typeof window !== 'undefined';
        this.isMiniProgram = typeof wx !== 'undefined' && wx.cloud;
    }

    /**
     * 智能图片加载 - 根据环境选择最佳加载策略
     * @param {string} url - 图片URL
     * @param {Object} options - 配置选项
     * @returns {Promise} 返回加载结果
     */
    async loadImage(url, options = {}) {
        const {
            useCache = true,
            timeout = 10000,
            fallbackToOriginal = true
        } = options;

        // 检查缓存
        if (useCache && this.cache.has(url)) {
            return {
                success: true,
                url: this.cache.get(url),
                fromCache: true
            };
        }

        // 环境检测和策略选择
        if (this.isH5) {
            return this.loadImageH5(url, options);
        } else if (this.isMiniProgram) {
            return this.loadImageMiniProgram(url, options);
        } else {
            return this.loadImageNative(url, options);
        }
    }

    /**
     * H5环境图片加载
     */
    async loadImageH5(url, options) {
        const { fallbackToOriginal = true } = options;
        
        // 检查是否为腾讯云存储URL
        if (this.isCloudStorageUrl(url)) {
            console.log('🔍 [H5] 检测到腾讯云存储URL，直接使用:', url);
            this.cache.set(url, url);
            return {
                success: true,
                url: url,
                fromCache: false,
                strategy: 'direct'
            };
        }

        // 尝试使用uni.downloadFile
        try {
            const result = await this.downloadFileWithTimeout(url, options.timeout);
            if (result.success) {
                this.cache.set(url, result.tempFilePath);
                return {
                    success: true,
                    url: result.tempFilePath,
                    fromCache: false,
                    strategy: 'download'
                };
            }
        } catch (error) {
            console.warn('🔍 [H5] downloadFile失败:', error);
        }

        // 降级方案：直接使用原URL
        if (fallbackToOriginal) {
            console.log('🔍 [H5] 使用降级方案，直接使用原URL:', url);
            this.cache.set(url, url);
            return {
                success: true,
                url: url,
                fromCache: false,
                strategy: 'fallback'
            };
        }

        return {
            success: false,
            error: 'H5环境下图片加载失败',
            url: url
        };
    }

    /**
     * 小程序环境图片加载
     */
    async loadImageMiniProgram(url, options) {
        try {
            const result = await this.downloadFileWithTimeout(url, options.timeout);
            if (result.success) {
                this.cache.set(url, result.tempFilePath);
                return {
                    success: true,
                    url: result.tempFilePath,
                    fromCache: false,
                    strategy: 'download'
                };
            }
        } catch (error) {
            console.error('小程序环境图片加载失败:', error);
        }

        return {
            success: false,
            error: '小程序环境下图片加载失败',
            url: url
        };
    }

    /**
     * 原生环境图片加载
     */
    async loadImageNative(url, options) {
        try {
            const result = await this.downloadFileWithTimeout(url, options.timeout);
            if (result.success) {
                this.cache.set(url, result.tempFilePath);
                return {
                    success: true,
                    url: result.tempFilePath,
                    fromCache: false,
                    strategy: 'download'
                };
            }
        } catch (error) {
            console.error('原生环境图片加载失败:', error);
        }

        return {
            success: false,
            error: '原生环境下图片加载失败',
            url: url
        };
    }

    /**
     * 带超时的downloadFile
     */
    downloadFileWithTimeout(url, timeout = 10000) {
        return new Promise((resolve) => {
            const timer = setTimeout(() => {
                resolve({
                    success: false,
                    error: '下载超时'
                });
            }, timeout);

            uni.downloadFile({
                url: url,
                success: (res) => {
                    clearTimeout(timer);
                    if (res.statusCode === 200) {
                        resolve({
                            success: true,
                            tempFilePath: res.tempFilePath
                        });
                    } else {
                        resolve({
                            success: false,
                            error: `HTTP ${res.statusCode}`
                        });
                    }
                },
                fail: (err) => {
                    clearTimeout(timer);
                    resolve({
                        success: false,
                        error: err.errMsg || '下载失败'
                    });
                }
            });
        });
    }

    /**
     * 检查是否为腾讯云存储URL
     */
    isCloudStorageUrl(url) {
        return url.includes('tcb.qcloud.la') || 
               url.includes('cloudbase') || 
               url.includes('cloud://');
    }

    /**
     * 批量加载图片
     */
    async loadImages(urls, options = {}) {
        const { maxConcurrent = 3 } = options;
        const results = [];
        
        // 分批处理，避免并发过多
        for (let i = 0; i < urls.length; i += maxConcurrent) {
            const batch = urls.slice(i, i + maxConcurrent);
            const batchResults = await Promise.all(
                batch.map(url => this.loadImage(url, options))
            );
            results.push(...batchResults);
        }
        
        return results;
    }

    /**
     * 清理缓存
     */
    clearCache() {
        this.cache.clear();
    }

    /**
     * 获取缓存统计
     */
    getCacheStats() {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys())
        };
    }
}

// 创建单例
const imageLoader = new ImageLoader();
module.exports = imageLoader;


















