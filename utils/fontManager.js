/**
 * 字体动态加载管理器
 * 支持从腾讯云存储动态下载字体文件并本地缓存
 */

const platformDetector = require('./platformDetector.js');
const { cloudCall } = require('./cloudCall.js');

const FONT_STORAGE_KEY = 'cached_fonts';
const FONT_CACHE_DIR = 'fonts';
const MAX_CACHE_SIZE = 50 * 1024 * 1024; // 50MB缓存限制
const CLOUD_FONT_BASE_URL = 'https://default-5qd0qyp40l648f05.tcb.qcloud.la/fonts'; // 腾讯云存储URL

/**
 * 生成安全的文件名（避免中文字符导致的加载问题）
 * @param {string} fontName - 原始字体名
 * @returns {string} - 安全的文件名
 */
function getSafeFileName(fontName) {
    // 将中文字符转换为字符编码，确保纯英文数字
    let safeName = '';
    for (let i = 0; i < fontName.length; i++) {
        safeName += fontName.charCodeAt(i).toString(36);
    }
    return 'f_' + safeName + '.ttf'; // 结果类似 f_4e004e01.ttf
}

// 字体配置表 - 只保留三个字体
const FONT_CONFIG = {
    'Huiwen-mincho': {
        displayName: '汇文明朝',
        filename: 'Huiwen-mincho.otf',
        size: 15400, // 15.04KB
        version: '1.0.0',
        isDefault: true // 默认字体，本地预置
    },
    '小小皓体': {
        displayName: '小小皓体',
        filename: '小小皓体.ttf',
        size: 3010000, // 2.87MB
        version: '1.0.0'
    },
    '字体圈欣意吉祥宋': {
        displayName: '字体圈欣意吉祥宋',
        filename: '字体圈欣意吉祥宋.ttf',
        size: 3140000, // 3MB
        version: '1.0.0'
    }
};

class FontManager {
    constructor() {
        this.loadedFonts = new Set(); // 已加载到内存的字体
        this.downloadingFonts = new Map(); // 正在下载的字体Promise
        this.cacheInfo = this.getCacheInfo();
        this.initializeFontDir();
    }

    /**
     * 获取平台相关的存储路径
     */
    getPlatformStoragePath() {
        const platform = platformDetector.getCurrentPlatform();
        
        if (platform === 'h5') {
            // H5环境使用临时目录标识
            return 'h5-temp-cache';
        } else if (platform === 'app') {
            // App环境使用plus.io
            return plus.io.convertLocalFileSystemURL('_doc/fonts/');
        } else if (platform === 'mp-weixin') {
            // 小程序环境使用wx.env.USER_DATA_PATH
            return `${wx.env.USER_DATA_PATH}/${FONT_CACHE_DIR}`;
        }
        
        // 默认路径
        return `temp/${FONT_CACHE_DIR}`;
    }

    /**
     * 初始化字体缓存目录
     */
    initializeFontDir() {
        const platform = platformDetector.getCurrentPlatform();
        console.log('【FontManager】当前平台:', platform);
        
        if (platform === 'h5') {
            // H5环境不需要创建物理目录，使用localStorage
            console.log('【FontManager】H5环境，使用localStorage缓存字体信息');
            return;
        }
        
        try {
            const fs = uni.getFileSystemManager();
            const dirPath = this.getPlatformStoragePath();
            
            // 检查目录是否存在
            try {
                fs.accessSync(dirPath);
                console.log('【FontManager】字体缓存目录已存在');
            } catch (e) {
                // 目录不存在，创建目录
                fs.mkdirSync(dirPath, true);
                console.log('【FontManager】创建字体缓存目录:', dirPath);
            }
        } catch (error) {
            console.error('【FontManager】初始化字体缓存目录失败:', error);
        }
    }

    /**
     * 获取缓存信息
     */
    getCacheInfo() {
        try {
            const cacheData = uni.getStorageSync(FONT_STORAGE_KEY);
            return cacheData || { fonts: {}, totalSize: 0, lastCleanup: Date.now() };
        } catch (e) {
            return { fonts: {}, totalSize: 0, lastCleanup: Date.now() };
        }
    }

    /**
     * 保存缓存信息
     */
    saveCacheInfo() {
        try {
            uni.setStorageSync(FONT_STORAGE_KEY, this.cacheInfo);
        } catch (e) {
            console.warn('【FontManager】保存缓存信息失败:', e);
        }
    }

    /**
     * 检查字体是否已缓存
     */
    isFontCached(fontFamily) {
        const config = FONT_CONFIG[fontFamily];
        if (!config) return false;

        // 默认字体直接返回true（使用本地静态资源）
        if (config.isDefault) return true;

        const cacheData = this.cacheInfo.fonts[fontFamily];
        if (!cacheData) return false;

        // 检查版本
        if (cacheData.version !== config.version) return false;

        const platform = platformDetector.getCurrentPlatform();
        
        // H5和App环境使用云端字体，检查URL缓存
        if (platform === 'h5' || platform === 'app') {
            return cacheData.cloudUrl || cacheData.isH5Cache === true;
        }

        // 其他平台（小程序等）检查本地文件是否存在
        try {
            const fs = uni.getFileSystemManager();
            const safeFileName = getSafeFileName(fontFamily);
            const baseDir = this.getPlatformStoragePath();
            const sep = baseDir.endsWith('/') ? '' : '/';
            const fontPath = `${baseDir}${sep}${safeFileName}`;
            fs.accessSync(fontPath);
            return true;
        } catch (e) {
            console.warn('【FontManager】字体文件不存在:', fontFamily, e);
            return false;
        }
    }

    /**
     * 获取字体文件路径
     */
    getFontPath(fontFamily) {
        const config = FONT_CONFIG[fontFamily];
        if (!config) return null;

        // 默认字体使用静态资源路径
        if (config.isDefault) {
            return `/static/fonts/${config.filename}`;
        }

        const platform = platformDetector.getCurrentPlatform();
        
        // H5和App环境都使用云端 HTTPS URL - WebView会自动处理缓存
        if (platform === 'h5' || platform === 'app') {
            const cacheData = this.cacheInfo.fonts[fontFamily];
            if (cacheData && cacheData.cloudUrl) {
                return cacheData.cloudUrl; // 返回缓存的云端 URL
            }
            return `${CLOUD_FONT_BASE_URL}/${config.filename}`;
        }

        // 其他平台（如小程序）使用本地文件路径
        const safeFileName = getSafeFileName(fontFamily);
        const baseDir = this.getPlatformStoragePath();
        
        // 修复双斜杠问题
        const sep = baseDir.endsWith('/') ? '' : '/';
        return `${baseDir}${sep}${safeFileName}`;
    }

    /**
     * 下载字体文件
     */
    async downloadFont(fontFamily, onProgress) {
        const config = FONT_CONFIG[fontFamily];
        if (!config) {
            throw new Error(`未知字体: ${fontFamily}`);
        }

        // 如果正在下载，返回现有Promise
        if (this.downloadingFonts.has(fontFamily)) {
            return this.downloadingFonts.get(fontFamily);
        }

        const downloadPromise = this._performDownload(fontFamily, onProgress);
        this.downloadingFonts.set(fontFamily, downloadPromise);

        try {
            const result = await downloadPromise;
            return result;
        } finally {
            this.downloadingFonts.delete(fontFamily);
        }
    }

    /**
     * 云端字体处理方法 - H5和App环境直接使用HTTPS URL
     */
    async _handleCloudFont(fontFamily, downloadUrl, onProgress) {
        const platform = platformDetector.getCurrentPlatform();
        console.log(`【FontManager】${platform}环境，使用云端HTTPS字体URL:`, fontFamily);
        
        try {
            // 模拟进度更新
            const simulateProgress = (startProgress, endProgress, duration) => {
                return new Promise(resolve => {
                    const steps = 10;
                    const stepSize = (endProgress - startProgress) / steps;
                    const stepDuration = duration / steps;
                    let currentProgress = startProgress;
                    
                    const interval = setInterval(() => {
                        currentProgress += stepSize;
                        if (onProgress) onProgress(Math.min(Math.round(currentProgress), endProgress));
                        
                        if (currentProgress >= endProgress) {
                            clearInterval(interval);
                            resolve();
                        }
                    }, stepDuration);
                });
            };
            
            // 初始进度
            if (onProgress) onProgress(10);
            
            // 模拟准备阶段 (10-100%)
            await simulateProgress(10, 100, 500);
            
            // 缓存云端URL信息
            this.cacheInfo.fonts[fontFamily] = {
                version: FONT_CONFIG[fontFamily].version,
                size: FONT_CONFIG[fontFamily].size,
                downloadTime: Date.now(),
                cloudUrl: downloadUrl,
                isCloudFont: true
            };
            this.saveCacheInfo();
            
            console.log(`【FontManager】${platform}环境云端字体URL准备完成:`, fontFamily, downloadUrl);
            return downloadUrl;
            
        } catch (error) {
            console.error(`【FontManager】${platform}环境处理云端字体失败:`, error);
            throw error;
        }
    }

    /**
     * 执行字体下载
     */
    async _performDownload(fontFamily, onProgress) {
        const platform = platformDetector.getCurrentPlatform();
        const config = FONT_CONFIG[fontFamily];
        
        console.log('【FontManager】开始通过云函数获取字体:', fontFamily);
        
        try {
            // 通过云函数获取临时下载链接
            const result = await cloudCall('getFontFile', {
                fontFamily: fontFamily,
                action: 'getUrl'
            });
            
            if (!result.result || !result.result.success) {
                throw new Error(result.result?.error || '获取字体下载链接失败');
            }
            
            const downloadUrl = result.result.downloadUrl;
            console.log('【FontManager】获取到云端字体URL:', downloadUrl);
            
            // H5和App环境都直接使用云端HTTPS字体 - WebView自动缓存
            if (platform === 'h5' || platform === 'app') {
                return this._handleCloudFont(fontFamily, downloadUrl, onProgress);
            }
            
            // 其他平台（小程序等）下载到本地
            return this._downloadToLocal(fontFamily, downloadUrl, onProgress);
            
        } catch (error) {
            console.error('【FontManager】通过云函数获取字体失败:', error);
            throw error;
        }
    }
    
    /**
     * 下载字体文件到本地
     */
    async _downloadToLocal(fontFamily, downloadUrl, onProgress) {
        const config = FONT_CONFIG[fontFamily];
        
        // 使用安全的英文文件名，避免中文字符导致加载失败
        const safeFileName = getSafeFileName(fontFamily);
        const baseDir = this.getPlatformStoragePath();
        
        // 修复双斜杠问题：检查目录是否以/结尾
        const sep = baseDir.endsWith('/') ? '' : '/';
        const localPath = `${baseDir}${sep}${safeFileName}`;
        
        console.log('【FontManager】计算安全保存路径:', localPath);
        
        return new Promise((resolve, reject) => {
            const downloadTask = uni.downloadFile({
                url: downloadUrl,
                filePath: localPath,
                success: (res) => {
                    if (res.statusCode === 200) {
                        // 更新缓存信息
                        this.cacheInfo.fonts[fontFamily] = {
                            version: config.version,
                            size: config.size,
                            downloadTime: Date.now(),
                            path: localPath
                        };
                        this.cacheInfo.totalSize += config.size;
                        this.saveCacheInfo();

                        // 检查缓存大小，必要时清理
                        this.cleanupCacheIfNeeded();

                        console.log('【FontManager】字体下载成功:', fontFamily);
                        resolve(localPath);
                    } else {
                        console.error('【FontManager】字体下载失败 - 状态码:', res.statusCode);
                        reject(new Error(`下载失败，状态码: ${res.statusCode}`));
                    }
                },
                fail: (err) => {
                    console.error('【FontManager】字体下载失败:', fontFamily, err);
                    reject(err);
                }
            });

            // 下载进度回调
            if (onProgress && downloadTask.onProgressUpdate) {
                downloadTask.onProgressUpdate((res) => {
                    const progress = Math.round((res.bytesWritten / res.totalBytesExpectedToWrite) * 100);
                    onProgress(progress, res.bytesWritten, res.totalBytesExpectedTowrite);
                });
            }
        });
    }

    /**
     * 清理缓存（LRU策略）
     */
    cleanupCacheIfNeeded() {
        if (this.cacheInfo.totalSize <= MAX_CACHE_SIZE) return;

        console.log('【FontManager】开始清理字体缓存，当前大小:', this.cacheInfo.totalSize);

        // 按下载时间排序，删除最老的字体
        const fonts = Object.entries(this.cacheInfo.fonts)
            .filter(([fontFamily]) => !FONT_CONFIG[fontFamily]?.isDefault) // 不删除默认字体
            .sort(([, a], [, b]) => a.downloadTime - b.downloadTime);

        const fs = uni.getFileSystemManager();

        for (const [fontFamily, fontData] of fonts) {
            if (this.cacheInfo.totalSize <= MAX_CACHE_SIZE * 0.8) break; // 清理到80%

            try {
                // 删除文件
                fs.unlinkSync(fontData.path);
                
                // 更新缓存信息
                this.cacheInfo.totalSize -= fontData.size;
                delete this.cacheInfo.fonts[fontFamily];
                
                // 从已加载集合中移除
                this.loadedFonts.delete(fontFamily);
                
                console.log('【FontManager】清理字体缓存:', fontFamily);
            } catch (e) {
                console.warn('【FontManager】删除字体文件失败:', fontFamily, e);
            }
        }

        this.saveCacheInfo();
        console.log('【FontManager】缓存清理完成，当前大小:', this.cacheInfo.totalSize);
    }

    /**
     * 确保字体可用（下载并加载）
     */
    async ensureFontAvailable(fontFamily, onProgress) {
        console.log('【FontManager】确保字体可用:', fontFamily);

        // 检查是否已缓存
        if (!this.isFontCached(fontFamily)) {
            console.log('【FontManager】字体未缓存，开始下载:', fontFamily);
            await this.downloadFont(fontFamily, onProgress);
        }

        // 加载字体到内存
        if (!this.loadedFonts.has(fontFamily)) {
            await this.loadFontToMemory(fontFamily);
        }

        return this.getFontPath(fontFamily);
    }

    /**
     * 加载字体到内存
     */
    async loadFontToMemory(fontFamily) {
        const fontPath = this.getFontPath(fontFamily);
        if (!fontPath) {
            throw new Error(`字体路径不存在: ${fontFamily}`);
        }

        const config = FONT_CONFIG[fontFamily];
        const platform = platformDetector.getCurrentPlatform();
        
        console.log('【FontManager】加载字体到内存:', fontFamily, fontPath);

        return new Promise((resolve, reject) => {
            // H5和App平台都使用HTTPS URL - WebView自动处理缓存
            if (platform === 'h5' || platform === 'app' || fontPath.startsWith('http')) {
                console.log(`【FontManager】${platform}环境直接使用云端字体URL:`, fontPath);
                
                uni.loadFontFace({
                    family: config.displayName,
                    source: `url("${fontPath}")`,
                    success: () => {
                        this.loadedFonts.add(fontFamily);
                        console.log(`【FontManager】✅ ${platform}环境字体加载成功:`, fontFamily);
                        resolve(true);
                    },
                    fail: (err) => {
                        console.error(`【FontManager】❌ ${platform}环境字体加载失败:`, fontFamily, err);
                        resolve(false); // 这里 resolve false 而不是 reject，避免阻塞流程
                    }
                });
                return;
            } else {
                // 其他平台回退到原有逻辑
                uni.loadFontFace({
                    family: config.displayName,
                    source: `url("${fontPath}")`,
                    success: () => {
                        this.loadedFonts.add(fontFamily);
                        console.log('【FontManager】字体加载成功:', fontFamily);
                        resolve(true);
                    },
                    fail: (err) => {
                        console.error('【FontManager】字体加载失败:', fontFamily, err);
                        reject(err);
                    }
                });
            }
        });
    }

    /**
     * 获取可用字体列表
     */
    getAvailableFonts() {
        return Object.entries(FONT_CONFIG).map(([fontFamily, config]) => ({
            fontFamily,
            displayName: config.displayName,
            size: config.size,
            isDefault: config.isDefault || false,
            isCached: this.isFontCached(fontFamily),
            isLoaded: this.loadedFonts.has(fontFamily)
        }));
    }

    /**
     * 预加载常用字体
     */
    async preloadCommonFonts(fontFamilies = ['Huiwen-mincho']) {
        console.log('【FontManager】预加载常用字体:', fontFamilies);
        
        const promises = fontFamilies.map(async (fontFamily) => {
            try {
                await this.ensureFontAvailable(fontFamily);
                return { fontFamily, success: true };
            } catch (e) {
                console.warn('【FontManager】预加载字体失败:', fontFamily, e);
                return { fontFamily, success: false, error: e };
            }
        });

        return Promise.all(promises);
    }

    /**
     * 删除单个字体缓存
     */
    async deleteFontCache(fontFamily) {
        console.log('【FontManager】删除字体缓存:', fontFamily);
        
        const config = FONT_CONFIG[fontFamily];
        if (!config || config.isDefault) {
            throw new Error('无法删除默认字体');
        }
        
        const fontData = this.cacheInfo.fonts[fontFamily];
        if (!fontData) {
            console.log('【FontManager】字体未缓存:', fontFamily);
            return;
        }
        
        const platform = platformDetector.getCurrentPlatform();
        
        try {
            // 非H5环境需要删除文件
            if (platform !== 'h5') {
                const fs = uni.getFileSystemManager();
                fs.unlinkSync(fontData.path);
            }
            
            // 更新缓存信息
            this.cacheInfo.totalSize -= fontData.size;
            delete this.cacheInfo.fonts[fontFamily];
            
            // 从已加载集合中移除
            this.loadedFonts.delete(fontFamily);
            
            this.saveCacheInfo();
            
            console.log('【FontManager】字体缓存删除成功:', fontFamily);
        } catch (e) {
            console.warn('【FontManager】删除字体文件失败:', fontFamily, e);
            throw e;
        }
    }

    /**
     * 清除所有字体缓存
     */
    async clearAllCache() {
        console.log('【FontManager】清除所有字体缓存');
        
        const platform = platformDetector.getCurrentPlatform();
        
        // 删除所有缓存文件
        for (const [fontFamily, fontData] of Object.entries(this.cacheInfo.fonts)) {
            if (FONT_CONFIG[fontFamily]?.isDefault) continue; // 跳过默认字体
            
            try {
                // 非H5环境需要删除文件
                if (platform !== 'h5') {
                    const fs = uni.getFileSystemManager();
                    fs.unlinkSync(fontData.path);
                }
                this.loadedFonts.delete(fontFamily);
            } catch (e) {
                console.warn('【FontManager】删除字体文件失败:', fontFamily, e);
            }
        }

        // 重置缓存信息
        this.cacheInfo = { fonts: {}, totalSize: 0, lastCleanup: Date.now() };
        this.saveCacheInfo();
    }

    /**
     * 获取缓存统计信息
     */
    getCacheStats() {
        const totalFonts = Object.keys(FONT_CONFIG).length;
        const cachedFonts = Object.keys(this.cacheInfo.fonts).length;
        const loadedFonts = this.loadedFonts.size;
        
        return {
            totalFonts,
            cachedFonts,
            loadedFonts,
            cacheSize: this.cacheInfo.totalSize,
            cacheSizeFormatted: this.formatFileSize(this.cacheInfo.totalSize),
            maxCacheSize: MAX_CACHE_SIZE,
            maxCacheSizeFormatted: this.formatFileSize(MAX_CACHE_SIZE)
        };
    }

    /**
     * 格式化文件大小
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// 导出单例
const fontManager = new FontManager();

export default fontManager;
