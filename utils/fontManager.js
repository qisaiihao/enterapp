/**
 * 字体动态加载管理器
 * 支持从腾讯云存储动态下载字体文件并本地缓存
 * 支持用户添加本地字体
 * 
 * 重要：统一使用 displayName（如"汇文明朝"）作为字体标识符
 * 这样 uni.loadFontFace 注册的名称和 Canvas ctx.font 使用的名称一致
 */

const platformDetector = require('./platformDetector.js');
import fileUrlCache from '@/cache/core/file-url.js';

const FONT_STORAGE_KEY = 'cached_fonts';
const CUSTOM_FONTS_KEY = 'custom_fonts';
const FONT_CACHE_DIR = 'fonts';
const MAX_CACHE_SIZE = 100 * 1024 * 1024; // 100MB缓存限制

function getDefaultLocalFileName(config, platform = platformDetector.getCurrentPlatform()) {
    if (config && config.localFileNameByPlatform && config.localFileNameByPlatform[platform]) {
        return config.localFileNameByPlatform[platform];
    }
    return config ? config.filename : '';
}

/**
 * 生成安全的文件名（避免中文字符导致的加载问题）
 */
function getSafeFileName(fontName) {
    let safeName = '';
    for (let i = 0; i < fontName.length; i++) {
        safeName += fontName.charCodeAt(i).toString(36);
    }
    return 'f_' + safeName + '.ttf';
}

// 内置字体配置表 - 统一使用 displayName 作为 key
const FONT_CONFIG = {
    '汇文明朝': {
        displayName: '汇文明朝',
        filename: 'Huiwen-mincho-compressed.woff2',
        localFileNameByPlatform: {
            h5: 'Huiwen-mincho-compressed.woff2',
            app: 'Huiwen-mincho.otf'
        },
        cloudPath: 'cloud://cloud1-5gb0pbyl400845f5.636c-cloud1-5gb0pbyl400845f5-1378788263/fonts/Huiwen-mincho.otf',
        // 小程序端使用 WOFF2 格式的 HTTPS 链接（直接使用 TCB 域名，避免云函数超时）
        mpWeixinUrl: 'https://636c-cloud1-5gb0pbyl400845f5-1378788263.tcb.qcloud.la/fonts/Huiwen-mincho-compressed.woff2',
        size: 7993880, // 7.9MB
        version: '1.0.0',
        // 小程序端使用 wx.loadFontFace 加载，App/H5 使用本地文件
        isDefault: platformDetector.getCurrentPlatform() !== 'mp-weixin',
    },
    '小小皓体': {
        displayName: '小小皓体',
        filename: '小小皓体.ttf',
        cloudPath: 'cloud://cloud1-5gb0pbyl400845f5.636c-cloud1-5gb0pbyl400845f5-1378788263/fonts/小小皓体.ttf',
        size: 2810000,
        version: '1.0.0'
    },
    '字体圈欣意吉祥宋': {
        displayName: '字体圈欣意吉祥宋',
        filename: '字体圈欣意吉祥宋.ttf',
        cloudPath: 'cloud://cloud1-5gb0pbyl400845f5.636c-cloud1-5gb0pbyl400845f5-1378788263/fonts/字体圈欣意吉祥宋.ttf',
        size: 3000000,
        version: '1.0.0'
    },
    '南西雅致黑': {
        displayName: '南西雅致黑',
        filename: '南西雅致黑.ttf',
        cloudPath: 'cloud://cloud1-5gb0pbyl400845f5.636c-cloud1-5gb0pbyl400845f5-1378788263/fonts/南西雅致黑.ttf',
        size: 15050000,
        version: '1.0.0'
    },
    '文楷': {
        displayName: '文楷',
        filename: '文楷.ttf',
        cloudPath: 'cloud://cloud1-5gb0pbyl400845f5.636c-cloud1-5gb0pbyl400845f5-1378788263/fonts/文楷.ttf',
        size: 7850000,
        version: '1.0.0'
    },
    '龙藏体': {
        displayName: '龙藏体',
        filename: '龙藏体.ttf',
        cloudPath: 'cloud://cloud1-5gb0pbyl400845f5.636c-cloud1-5gb0pbyl400845f5-1378788263/fonts/龙藏体.ttf',
        size: 4920000,
        version: '1.0.0'
    }
};

// 兼容旧的 fontFamily ID 到新的 displayName 的映射
const LEGACY_FONT_MAP = {
    'Huiwen-mincho': '汇文明朝'
};

class FontManager {
    constructor() {
        this.loadedFonts = new Set();
        this.downloadingFonts = new Map();
        this.customFonts = this.getCustomFonts();
        this.cacheInfo = this.getCacheInfo();
        this.initializeFontDir();
    }

    getPlatformStoragePath() {
        const platform = platformDetector.getCurrentPlatform();
        if (platform === 'h5') return 'h5-temp-cache';
        if (platform === 'app') return plus.io.convertLocalFileSystemURL('_doc/fonts/');
        if (platform === 'mp-weixin') return `${wx.env.USER_DATA_PATH}/${FONT_CACHE_DIR}`;
        return `temp/${FONT_CACHE_DIR}`;
    }

    initializeFontDir() {
        const platform = platformDetector.getCurrentPlatform();
        if (platform === 'h5') return;
        
        // App 端使用 plus.io 创建目录
        if (platform === 'app') {
            // #ifdef APP-PLUS
            plus.io.resolveLocalFileSystemURL('_doc/', (entry) => {
                entry.getDirectory('fonts', { create: true }, () => {
                    console.log('【FontManager】字体目录创建成功');
                }, (err) => {
                    console.warn('【FontManager】创建字体目录失败:', err);
                });
            });
            // #endif
            return;
        }
        
        // 小程序端使用 FileSystemManager
        // #ifdef MP
        try {
            const fs = uni.getFileSystemManager();
            const dirPath = this.getPlatformStoragePath();
            try {
                fs.accessSync(dirPath);
            } catch (e) {
                fs.mkdirSync(dirPath, true);
            }
        } catch (error) {
            console.error('【FontManager】初始化字体缓存目录失败:', error);
        }
        // #endif
    }

    getCacheInfo() {
        try {
            return uni.getStorageSync(FONT_STORAGE_KEY) || { fonts: {}, totalSize: 0, lastCleanup: Date.now() };
        } catch (e) {
            return { fonts: {}, totalSize: 0, lastCleanup: Date.now() };
        }
    }

    saveCacheInfo() {
        try {
            uni.setStorageSync(FONT_STORAGE_KEY, this.cacheInfo);
        } catch (e) {
            console.warn('【FontManager】保存缓存信息失败:', e);
        }
    }

    // ========== 自定义字体管理 ==========
    
    getCustomFonts() {
        try {
            return uni.getStorageSync(CUSTOM_FONTS_KEY) || {};
        } catch (e) {
            return {};
        }
    }

    saveCustomFonts() {
        try {
            uni.setStorageSync(CUSTOM_FONTS_KEY, this.customFonts);
        } catch (e) {
            console.warn('【FontManager】保存自定义字体失败:', e);
        }
    }

    /**
     * 添加用户自定义字体（从本地文件）
     * @param {string} fontName - 字体显示名称（可选）
     * @returns {Promise<object>} - 添加结果
     */
    async addCustomFont(fontName) {
        const platform = platformDetector.getCurrentPlatform();
        
        // H5 环境直接使用 input 元素
        if (platform === 'h5') {
            return this._addCustomFontH5(fontName);
        }
        
        // App/小程序环境
        return new Promise((resolve, reject) => {
            uni.chooseMessageFile({
                count: 1,
                type: 'file',
                extension: ['ttf', 'otf', 'woff', 'woff2'],
                success: async (res) => {
                    if (!res.tempFiles || res.tempFiles.length === 0) {
                        reject(new Error('未选择文件'));
                        return;
                    }
                    
                    const file = res.tempFiles[0];
                    const fileName = file.name || `custom_${Date.now()}.ttf`;
                    const fileSize = file.size || 0;
                    const fontFamily = `custom_${fontName || fileName.replace(/\.[^.]+$/, '')}`;
                    
                    try {
                        const safeFileName = getSafeFileName(fontFamily);
                        const baseDir = this.getPlatformStoragePath();
                        const sep = baseDir.endsWith('/') ? '' : '/';
                        const fontPath = `${baseDir}${sep}${safeFileName}`;
                        
                        await this._copyFile(file.path, fontPath);
                        
                        this.customFonts[fontFamily] = {
                            displayName: fontName || fileName.replace(/\.[^.]+$/, ''),
                            filename: fileName,
                            size: fileSize,
                            addTime: Date.now(),
                            isCustom: true,
                            path: fontPath
                        };
                        this.saveCustomFonts();
                        
                        this.cacheInfo.fonts[fontFamily] = {
                            version: '1.0.0',
                            size: fileSize,
                            downloadTime: Date.now(),
                            path: fontPath,
                            isCustom: true,
                            storageType: 'local'
                        };
                        this.cacheInfo.totalSize += fileSize;
                        this.saveCacheInfo();
                        
                        await this._loadFontFace(fontFamily, fontPath);
                        
                        resolve({
                            success: true,
                            fontFamily,
                            displayName: this.customFonts[fontFamily].displayName,
                            path: fontPath
                        });
                        
                    } catch (error) {
                        console.error('【FontManager】添加自定义字体失败:', error);
                        reject(error);
                    }
                },
                fail: (err) => {
                    reject(new Error(err.errMsg || '选择文件失败'));
                }
            });
        });
    }

    /**
     * H5 专用：通过 input 元素选择字体文件
     */
    _addCustomFontH5(fontName) {
        return new Promise((resolve, reject) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.ttf,.otf,.woff,.woff2';
            
            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (!file) {
                    reject(new Error('未选择文件'));
                    return;
                }
                
                const fileName = file.name;
                const fileSize = file.size;
                const fontFamily = `custom_${fontName || fileName.replace(/\.[^.]+$/, '')}`;
                
                try {
                    const arrayBuffer = await file.arrayBuffer();
                    await this._saveToIndexedDB(fontFamily, arrayBuffer);
                    
                    const blob = new Blob([arrayBuffer], { type: 'font/ttf' });
                    const fontPath = URL.createObjectURL(blob);
                    
                    this.customFonts[fontFamily] = {
                        displayName: fontName || fileName.replace(/\.[^.]+$/, ''),
                        filename: fileName,
                        size: fileSize,
                        addTime: Date.now(),
                        isCustom: true
                    };
                    this.saveCustomFonts();
                    
                    this.cacheInfo.fonts[fontFamily] = {
                        version: '1.0.0',
                        size: fileSize,
                        downloadTime: Date.now(),
                        isCustom: true,
                        storageType: 'indexedDB'
                    };
                    this.cacheInfo.totalSize += fileSize;
                    this.saveCacheInfo();
                    
                    await this._loadFontFace(fontFamily, fontPath);
                    
                    resolve({
                        success: true,
                        fontFamily,
                        displayName: this.customFonts[fontFamily].displayName,
                        path: fontPath
                    });
                    
                } catch (error) {
                    reject(error);
                }
            };
            
            input.click();
        });
    }

    _readFileAsArrayBuffer(filePath) {
        return new Promise((resolve, reject) => {
            // #ifdef APP-PLUS
            plus.io.resolveLocalFileSystemURL(filePath, (entry) => {
                entry.file((file) => {
                    const reader = new plus.io.FileReader();
                    reader.onloadend = (e) => resolve(e.target.result);
                    reader.onerror = reject;
                    reader.readAsArrayBuffer(file);
                }, reject);
            }, reject);
            // #endif
            
            // #ifdef MP-WEIXIN
            const fs = uni.getFileSystemManager();
            fs.readFile({
                filePath,
                success: (res) => resolve(res.data),
                fail: reject
            });
            // #endif
        });
    }

    _copyFile(srcPath, destPath) {
        return new Promise((resolve, reject) => {
            // #ifdef APP-PLUS
            plus.io.resolveLocalFileSystemURL(srcPath, (srcEntry) => {
                plus.io.resolveLocalFileSystemURL(destPath.substring(0, destPath.lastIndexOf('/')), (destDir) => {
                    srcEntry.copyTo(destDir, destPath.substring(destPath.lastIndexOf('/') + 1), resolve, reject);
                }, reject);
            }, reject);
            // #endif
            
            // #ifdef MP-WEIXIN
            const fs = uni.getFileSystemManager();
            fs.copyFile({
                srcPath,
                destPath,
                success: resolve,
                fail: reject
            });
            // #endif
        });
    }

    /**
     * 删除自定义字体
     */
    async deleteCustomFont(fontFamily) {
        if (!this.customFonts[fontFamily]) {
            throw new Error('字体不存在');
        }
        
        const platform = platformDetector.getCurrentPlatform();
        
        try {
            if (platform === 'h5') {
                await this._deleteFromIndexedDB(fontFamily);
            } else {
                const cacheData = this.cacheInfo.fonts[fontFamily];
                if (cacheData && cacheData.path) {
                    const fs = uni.getFileSystemManager();
                    fs.unlinkSync(cacheData.path);
                }
            }
        } catch (e) {
            console.warn('【FontManager】删除自定义字体文件失败:', e);
        }
        
        const size = this.customFonts[fontFamily].size || 0;
        delete this.customFonts[fontFamily];
        this.saveCustomFonts();
        
        if (this.cacheInfo.fonts[fontFamily]) {
            this.cacheInfo.totalSize -= size;
            delete this.cacheInfo.fonts[fontFamily];
            this.saveCacheInfo();
        }
        
        this.loadedFonts.delete(fontFamily);
    }

    _deleteFromIndexedDB(fontFamily) {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('FontCache', 1);
            request.onsuccess = (event) => {
                const db = event.target.result;
                const transaction = db.transaction(['fonts'], 'readwrite');
                const store = transaction.objectStore('fonts');
                store.delete(fontFamily);
                transaction.oncomplete = () => { db.close(); resolve(); };
                transaction.onerror = () => { db.close(); reject(transaction.error); };
            };
            request.onerror = () => reject(request.error);
        });
    }

    // ========== 内置字体管理 ==========

    /**
     * 规范化字体名称（兼容旧的 fontFamily ID）
     */
    normalizeFontName(fontFamily) {
        // 如果是旧的 ID 格式，转换为 displayName
        if (LEGACY_FONT_MAP[fontFamily]) {
            return LEGACY_FONT_MAP[fontFamily];
        }
        return fontFamily;
    }

    /**
     * 获取字体配置（内置 + 自定义）
     */
    getFontConfig(fontFamily) {
        // 先规范化字体名称
        const normalizedName = this.normalizeFontName(fontFamily);
        return FONT_CONFIG[normalizedName] || this.customFonts[normalizedName] || null;
    }

    async isFontCached(fontFamily) {
        const normalizedName = this.normalizeFontName(fontFamily);
        console.log('【FontManager】🔍 检查字体缓存:', fontFamily, '规范化后:', normalizedName);
        
        const config = this.getFontConfig(normalizedName);
        if (!config) {
            console.log('【FontManager】❌ 字体配置不存在:', normalizedName);
            return false;
        }
        
        console.log('【FontManager】✅ 字体配置:', config);
        
        if (config.isDefault) {
            console.log('【FontManager】✅ 默认字体，视为已缓存');
            return true;
        }
        if (config.isCustom) {
            console.log('【FontManager】✅ 自定义字体，视为已缓存');
            return true;
        }

        const cacheData = this.cacheInfo.fonts[fontFamily];
        console.log('【FontManager】📦 缓存数据:', cacheData);
        
        if (!cacheData) {
            console.log('【FontManager】❌ 无缓存数据');
            return false;
        }
        if (cacheData.version !== config.version) {
            console.log('【FontManager】⚠️ 版本不匹配，缓存:', cacheData.version, '配置:', config.version);
            return false;
        }

        const platform = platformDetector.getCurrentPlatform();
        console.log('【FontManager】🔍 当前平台:', platform);
        
        if (platform === 'h5') {
            if (cacheData.storageType === 'indexedDB') {
                try {
                    const cached = await this._loadFromIndexedDB(fontFamily);
                    return !!(cached && cached.data);
                } catch (e) {
                    return false;
                }
            }
            return !!(cacheData.cloudUrl || cacheData.isH5Cache);
        }
        
        if (platform === 'app') {
            if (cacheData.path) {
                try {
                    await new Promise((resolve, reject) => {
                        plus.io.resolveLocalFileSystemURL(cacheData.path, resolve, reject);
                    });
                    return true;
                } catch (e) {
                    return false;
                }
            }
            return !!cacheData.cloudUrl;
        }

        // 小程序端：检查是否有云存储链接
        if (platform === 'mp-weixin') {
            const hasCached = !!cacheData.cloudUrl;
            console.log('【FontManager】小程序端缓存检查，cloudUrl:', cacheData.cloudUrl, '结果:', hasCached);
            return hasCached;
        }

        try {
            const fs = uni.getFileSystemManager();
            const safeFileName = getSafeFileName(fontFamily);
            const baseDir = this.getPlatformStoragePath();
            const sep = baseDir.endsWith('/') ? '' : '/';
            fs.accessSync(`${baseDir}${sep}${safeFileName}`);
            return true;
        } catch (e) {
            return false;
        }
    }
    
    isFontCachedSync(fontFamily) {
        const config = this.getFontConfig(fontFamily);
        if (!config) return false;
        if (config.isDefault) return true;
        if (config.isCustom) return true;
        
        const cacheData = this.cacheInfo.fonts[fontFamily];
        if (!cacheData) return false;
        if (cacheData.version !== config.version) return false;
        
        return !!(cacheData.storageType === 'indexedDB' || cacheData.cloudUrl || cacheData.path);
    }

    async getFontPath(fontFamily) {
        const config = this.getFontConfig(fontFamily);
        if (!config) return null;

        if (config.isDefault) {
            const platform = platformDetector.getCurrentPlatform();
            return `/static/fonts/${getDefaultLocalFileName(config, platform)}`;
        }

        const platform = platformDetector.getCurrentPlatform();
        const cacheData = this.cacheInfo.fonts[fontFamily];
        
        // 【关键修复】小程序端优先使用云存储链接（需要配置 CORS）
        if (platform === 'mp-weixin') {
            if (cacheData && cacheData.cloudUrl) {
                console.log('【FontManager】小程序端使用云存储链接:', cacheData.cloudUrl);
                return cacheData.cloudUrl;
            }
            return null;
        }
        
        if (platform === 'h5') {
            if (cacheData && cacheData.storageType === 'indexedDB') {
                try {
                    const cached = await this._loadFromIndexedDB(fontFamily);
                    if (cached && cached.data) {
                        const blob = new Blob([cached.data], { type: 'font/ttf' });
                        return URL.createObjectURL(blob);
                    }
                } catch (e) {
                    console.warn('【FontManager】从 IndexedDB 加载字体失败:', e);
                }
            }
            if (cacheData && cacheData.cloudUrl) return cacheData.cloudUrl;
            return null;
        }
        
        if (platform === 'app') {
            if (cacheData && cacheData.path) return cacheData.path;
            if (cacheData && cacheData.cloudUrl) return cacheData.cloudUrl;
            return null;
        }

        const safeFileName = getSafeFileName(fontFamily);
        const baseDir = this.getPlatformStoragePath();
        const sep = baseDir.endsWith('/') ? '' : '/';
        return `${baseDir}${sep}${safeFileName}`;
    }

    async downloadFont(fontFamily, onProgress) {
        const config = this.getFontConfig(fontFamily);
        if (!config) throw new Error(`未知字体: ${fontFamily}`);
        if (config.isCustom) throw new Error('自定义字体无需下载');

        console.log('【FontManager】⬇️ 开始下载字体:', fontFamily, '配置:', config);

        if (this.downloadingFonts.has(fontFamily)) {
            console.log('【FontManager】⏳ 字体正在下载中，等待现有下载任务...');
            return this.downloadingFonts.get(fontFamily);
        }

        const downloadPromise = this._performDownload(fontFamily, onProgress);
        this.downloadingFonts.set(fontFamily, downloadPromise);

        try {
            const result = await downloadPromise;
            console.log('【FontManager】✅ 字体下载任务完成:', result);
            return result;
        } finally {
            this.downloadingFonts.delete(fontFamily);
        }
    }

    async _performDownload(fontFamily, onProgress) {
        const platform = platformDetector.getCurrentPlatform();
        const config = this.getFontConfig(fontFamily);
        
        console.log('【FontManager】🔍 执行下载 - 字体:', fontFamily, '平台:', platform);
        
        // 【关键修复】小程序端直接使用 HTTPS 链接（需要配置 CORS）
        if (platform === 'mp-weixin') {
            // 优先使用配置中的 mpWeixinUrl（WOFF2 格式）
            const mpUrl = config.mpWeixinUrl;
            if (!mpUrl) {
                throw new Error('小程序端字体链接未配置');
            }
            
            console.log('【FontManager】☁️ 小程序端直接使用 HTTPS 链接:', mpUrl);
            console.log('【FontManager】⚠️ 请确保云存储 CORS 配置正确：');
            console.log('【FontManager】   Access-Control-Allow-Origin: servicewechat.com 或 *');
            
            // 保存 HTTPS 链接到缓存信息
            this.cacheInfo.fonts[fontFamily] = {
                version: config.version,
                size: config.size,
                downloadTime: Date.now(),
                cloudUrl: mpUrl,
                isCloudFont: true
            };
            this.saveCacheInfo();
            
            console.log('【FontManager】💾 已保存字体链接到缓存:', this.cacheInfo.fonts[fontFamily]);
            
            // 模拟下载进度
            if (onProgress) {
                for (let i = 0; i <= 100; i += 10) {
                    setTimeout(() => onProgress(i), i * 10);
                }
            }
            
            return mpUrl;
        }
        
        // 其他平台（H5/App）使用云存储路径获取临时链接
        console.log('【FontManager】📦 云存储路径:', config.cloudPath);
        const downloadUrl = await fileUrlCache.getTempUrl(config.cloudPath);
        console.log('【FontManager】🔗 获取临时链接:', downloadUrl);
        
        if (!downloadUrl || downloadUrl === config.cloudPath) {
            throw new Error('获取字体下载链接失败');
        }
        
        if (platform === 'h5') {
            return this._handleH5Font(fontFamily, downloadUrl, onProgress);
        }
        
        return this._downloadToLocal(fontFamily, downloadUrl, onProgress);
    }
    
    async _handleH5Font(fontFamily, downloadUrl, onProgress) {
        const config = this.getFontConfig(fontFamily);
        
        try {
            if (onProgress) onProgress(10);
            
            const response = await fetch(downloadUrl);
            if (!response.ok) throw new Error(`下载失败: HTTP ${response.status}`);
            
            if (onProgress) onProgress(50);
            const arrayBuffer = await response.arrayBuffer();
            
            if (onProgress) onProgress(80);
            await this._saveToIndexedDB(fontFamily, arrayBuffer);
            
            if (onProgress) onProgress(100);
            
            this.cacheInfo.fonts[fontFamily] = {
                version: config.version,
                size: arrayBuffer.byteLength,
                downloadTime: Date.now(),
                isH5Cache: true,
                storageType: 'indexedDB'
            };
            this.cacheInfo.totalSize += arrayBuffer.byteLength;
            this.saveCacheInfo();
            
            const blob = new Blob([arrayBuffer], { type: 'font/ttf' });
            return URL.createObjectURL(blob);
            
        } catch (error) {
            console.error('【FontManager】H5字体处理失败:', error);
            this.cacheInfo.fonts[fontFamily] = {
                version: config.version,
                size: config.size,
                downloadTime: Date.now(),
                cloudUrl: downloadUrl,
                isCloudFont: true
            };
            this.saveCacheInfo();
            return downloadUrl;
        }
    }
    
    _saveToIndexedDB(fontFamily, arrayBuffer) {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('FontCache', 1);
            request.onerror = () => reject(request.error);
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('fonts')) {
                    db.createObjectStore('fonts', { keyPath: 'fontFamily' });
                }
            };
            request.onsuccess = (event) => {
                const db = event.target.result;
                const transaction = db.transaction(['fonts'], 'readwrite');
                const store = transaction.objectStore('fonts');
                store.put({ fontFamily, data: arrayBuffer, timestamp: Date.now() });
                transaction.oncomplete = () => { db.close(); resolve(); };
                transaction.onerror = () => { db.close(); reject(transaction.error); };
            };
        });
    }
    
    _loadFromIndexedDB(fontFamily) {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('FontCache', 1);
            request.onerror = () => reject(request.error);
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('fonts')) {
                    db.createObjectStore('fonts', { keyPath: 'fontFamily' });
                }
            };
            request.onsuccess = (event) => {
                const db = event.target.result;
                const transaction = db.transaction(['fonts'], 'readonly');
                const store = transaction.objectStore('fonts');
                const getRequest = store.get(fontFamily);
                getRequest.onsuccess = () => { db.close(); resolve(getRequest.result); };
                getRequest.onerror = () => { db.close(); reject(getRequest.error); };
            };
        });
    }
    
    async _downloadToLocal(fontFamily, downloadUrl, onProgress) {
        const platform = platformDetector.getCurrentPlatform();
        const config = this.getFontConfig(fontFamily);
        const safeFileName = getSafeFileName(fontFamily);
        
        console.log('【FontManager】开始下载字体:', fontFamily);
        console.log('【FontManager】下载URL:', downloadUrl);
        
        // App 端：先下载到临时文件，再保存到持久目录
        if (platform === 'app') {
            return this._downloadForApp(fontFamily, downloadUrl, config, safeFileName, onProgress);
        }
        
        // 小程序端：直接下载到指定路径
        const baseDir = this.getPlatformStoragePath();
        const sep = baseDir.endsWith('/') ? '' : '/';
        const localPath = `${baseDir}${sep}${safeFileName}`;
        
        console.log('【FontManager】目标路径:', localPath);
        
        return new Promise((resolve, reject) => {
            const downloadTask = uni.downloadFile({
                url: downloadUrl,
                // 【关键修复】小程序端必须指定 filePath，否则会返回 wxfile:// 临时路径
                filePath: localPath,
                success: (res) => {
                    console.log('【FontManager】下载结果:', res);
                    if (res.statusCode === 200) {
                        // 【关键修复】优先使用 filePath（指定的保存路径），而不是 tempFilePath
                        const savedPath = localPath;
                        console.log('【FontManager】字体已保存到:', savedPath);
                        
                        this.cacheInfo.fonts[fontFamily] = {
                            version: config.version,
                            size: config.size,
                            downloadTime: Date.now(),
                            path: savedPath
                        };
                        this.cacheInfo.totalSize += config.size;
                        this.saveCacheInfo();
                        this.cleanupCacheIfNeeded();
                        resolve(savedPath);
                    } else {
                        reject(new Error(`下载失败，状态码: ${res.statusCode}`));
                    }
                },
                fail: (err) => {
                    console.error('【FontManager】下载失败:', err);
                    reject(new Error(err.errMsg || '下载失败'));
                }
            });

            if (onProgress && downloadTask && downloadTask.onProgressUpdate) {
                downloadTask.onProgressUpdate((res) => {
                    const progress = res.progress || Math.round((res.totalBytesWritten / res.totalBytesExpectedToWrite) * 100) || 0;
                    onProgress(progress);
                });
            }
        });
    }
    
    /**
     * App 端专用下载方法
     */
    async _downloadForApp(fontFamily, downloadUrl, config, safeFileName, onProgress) {
        return new Promise((resolve, reject) => {
            const downloadTask = uni.downloadFile({
                url: downloadUrl,
                success: async (res) => {
                    console.log('【FontManager】App下载结果:', res);
                    if (res.statusCode === 200 && res.tempFilePath) {
                        try {
                            // #ifdef APP-PLUS
                            // 将临时文件保存到持久目录
                            const targetPath = `_doc/fonts/${safeFileName}`;
                            console.log('【FontManager】准备保存到:', targetPath);
                            
                            // 使用 plus.io 保存文件
                            const savedPath = await this._saveFileToDoc(res.tempFilePath, targetPath);
                            console.log('【FontManager】App字体已保存到:', savedPath);
                            
                            this.cacheInfo.fonts[fontFamily] = {
                                version: config.version,
                                size: config.size,
                                downloadTime: Date.now(),
                                path: savedPath
                            };
                            this.cacheInfo.totalSize += config.size;
                            this.saveCacheInfo();
                            resolve(savedPath);
                            // #endif
                        } catch (saveErr) {
                            console.error('【FontManager】保存文件失败:', saveErr);
                            // 保存失败时直接使用临时文件路径
                            this.cacheInfo.fonts[fontFamily] = {
                                version: config.version,
                                size: config.size,
                                downloadTime: Date.now(),
                                path: res.tempFilePath
                            };
                            this.cacheInfo.totalSize += config.size;
                            this.saveCacheInfo();
                            resolve(res.tempFilePath);
                        }
                    } else {
                        reject(new Error(`下载失败，状态码: ${res.statusCode}`));
                    }
                },
                fail: (err) => {
                    console.error('【FontManager】App下载失败:', err);
                    reject(new Error(err.errMsg || '下载失败'));
                }
            });

            if (onProgress && downloadTask && downloadTask.onProgressUpdate) {
                downloadTask.onProgressUpdate((res) => {
                    const progress = res.progress || 0;
                    onProgress(progress);
                });
            }
        });
    }
    
    /**
     * App 端：将文件保存到 _doc 目录
     */
    _saveFileToDoc(tempFilePath, targetPath) {
        return new Promise((resolve, reject) => {
            // #ifdef APP-PLUS
            plus.io.resolveLocalFileSystemURL(tempFilePath, (tempEntry) => {
                plus.io.resolveLocalFileSystemURL('_doc/', (docEntry) => {
                    // 确保 fonts 目录存在
                    docEntry.getDirectory('fonts', { create: true }, (fontsDir) => {
                        const fileName = targetPath.split('/').pop();
                        tempEntry.copyTo(fontsDir, fileName, (newEntry) => {
                            const savedPath = newEntry.fullPath;
                            console.log('【FontManager】文件复制成功:', savedPath);
                            resolve(savedPath);
                        }, (copyErr) => {
                            console.error('【FontManager】文件复制失败:', copyErr);
                            reject(copyErr);
                        });
                    }, (dirErr) => {
                        console.error('【FontManager】创建目录失败:', dirErr);
                        reject(dirErr);
                    });
                }, (docErr) => {
                    console.error('【FontManager】访问_doc失败:', docErr);
                    reject(docErr);
                });
            }, (tempErr) => {
                console.error('【FontManager】访问临时文件失败:', tempErr);
                reject(tempErr);
            });
            // #endif
        });
    }

    cleanupCacheIfNeeded() {
        if (this.cacheInfo.totalSize <= MAX_CACHE_SIZE) return;

        const platform = platformDetector.getCurrentPlatform();
        
        // H5 端不需要清理文件系统
        if (platform === 'h5') {
            // H5 使用 IndexedDB，暂不自动清理
            return;
        }

        const fonts = Object.entries(this.cacheInfo.fonts)
            .filter(([fontFamily]) => !this.getFontConfig(fontFamily)?.isDefault)
            .sort(([, a], [, b]) => a.downloadTime - b.downloadTime);

        for (const [fontFamily, fontData] of fonts) {
            if (this.cacheInfo.totalSize <= MAX_CACHE_SIZE * 0.8) break;

            try {
                // App 端使用 plus.io
                if (platform === 'app') {
                    // #ifdef APP-PLUS
                    plus.io.resolveLocalFileSystemURL(fontData.path, (entry) => {
                        entry.remove();
                    });
                    // #endif
                } else {
                    // 小程序端使用 FileSystemManager
                    // #ifdef MP
                    const fs = uni.getFileSystemManager();
                    fs.unlinkSync(fontData.path);
                    // #endif
                }
                
                this.cacheInfo.totalSize -= fontData.size;
                delete this.cacheInfo.fonts[fontFamily];
                this.loadedFonts.delete(fontFamily);
            } catch (e) {
                console.warn('【FontManager】删除字体文件失败:', fontFamily, e);
            }
        }

        this.saveCacheInfo();
    }

    async ensureFontAvailable(fontFamily, onProgress) {
        // 规范化字体名称
        const normalizedName = this.normalizeFontName(fontFamily);
        console.log('【FontManager】🎯 确保字体可用:', fontFamily, '规范化后:', normalizedName);
        
        const config = this.getFontConfig(normalizedName);
        if (!config) {
            throw new Error("未知字体: " + normalizedName);
        }
        
        const cached = await this.isFontCached(normalizedName);
        console.log('【FontManager】📦 字体缓存状态:', cached);
        
        let fontPath = null;
        
        if (!cached) {
            console.log('【FontManager】⬇️ 字体未缓存，开始下载...');
            fontPath = await this.downloadFont(normalizedName, onProgress);
            console.log('【FontManager】✅ 字体下载完成，路径:', fontPath);
        } else {
            console.log('【FontManager】✅ 字体已缓存，获取路径...');
            fontPath = await this.getFontPath(normalizedName);
            console.log('【FontManager】📍 字体路径:', fontPath);
        }

        if (!this.loadedFonts.has(normalizedName) && fontPath) {
            console.log('【FontManager】🔤 字体未加载到内存，开始加载...');
            const loaded = await this._loadFontFace(normalizedName, fontPath);
            if (!loaded) {
                throw new Error("字体加载失败: " + normalizedName);
            }
        } else {
            console.log('【FontManager】✅ 字体已加载到内存');
        }

        return fontPath;
    }
    
    async _loadFontFace(fontFamily, fontPath, retryCount = 0) {
        const config = this.getFontConfig(fontFamily);
        const displayName = config?.displayName || fontFamily;
        const platform = platformDetector.getCurrentPlatform();
        const MAX_RETRIES = 2; // 最多重试2次

        // H5 端使用原生 FontFace API，更可靠
        if (platform === 'h5' && typeof FontFace !== 'undefined') {
            try {
                const font = new FontFace(displayName, `url("${fontPath}")`);
                await font.load();
                document.fonts.add(font);
                
                // 【关键修复】等待字体真正可用
                await document.fonts.ready;
                
                this.loadedFonts.add(fontFamily);
                console.log(`【FontManager】✅ 字体加载成功 (FontFace API):`, displayName);
                return true;
            } catch (err) {
                console.error(`【FontManager】❌ 字体加载失败 (FontFace API):`, displayName, err);
                return false;
            }
        }

        // 小程序端路径处理
        let sourcePath = fontPath;
        if (platform === 'mp-weixin') {
            // #ifdef MP-WEIXIN
            // 对于默认字体（/static/ 开头），小程序不支持直接加载
            if (fontPath && fontPath.startsWith('/static/')) {
                console.log('【FontManager】⚠️ 小程序环境跳过默认字体加载（使用系统字体）:', displayName);
                this.loadedFonts.add(fontFamily);
                return true;
            }
            
            // 【关键修复】小程序端支持 HTTPS 云端字体（需要配置 CORS）
            // 云存储链接已经是 https，直接使用
            if (fontPath && (fontPath.startsWith('http://') || fontPath.startsWith('https://'))) {
                console.log('【FontManager】小程序端使用云存储链接加载字体:', fontPath);
                console.log('【FontManager】字体大小:', config?.size ? `${(config.size / 1024 / 1024).toFixed(2)} MB` : '未知');
                console.log('【FontManager】⚠️ 如果加载失败，请检查云存储 CORS 配置');
                sourcePath = fontPath;
            } else {
                console.error('【FontManager】小程序端不支持的字体路径协议:', fontPath);
                this.loadedFonts.add(fontFamily);
                return false;
            }
            // #endif
        }
        
        // App 端需要转换路径格式
        if (platform === 'app') {
            // #ifdef APP-PLUS
            // 对于 /static/ 开头的本地资源，需要转换到 _www 下的真实路径
            if (fontPath && fontPath.startsWith('/static/')) {
                try {
                    sourcePath = plus.io.convertLocalFileSystemURL(`_www${fontPath}`);
                } catch (e) {
                    sourcePath = plus.io.convertLocalFileSystemURL(fontPath);
                }
            } else if (fontPath && !fontPath.startsWith('http') && !fontPath.startsWith('file://')) {
                sourcePath = plus.io.convertLocalFileSystemURL(fontPath);
            }
            console.log('【FontManager】App端字体路径:', fontPath, '->', sourcePath);
            // #endif
        }

        console.log('【FontManager】准备加载字体:', displayName, '路径:', sourcePath);
        if (retryCount > 0) {
            console.log('【FontManager】重试次数:', retryCount);
        }

        // 使用 uni.loadFontFace，添加超时和重试机制
        return new Promise((resolve) => {
            // 设置超时时间（大文件需要更长时间）
            const timeout = setTimeout(() => {
                console.warn(`【FontManager】⚠️ 字体加载超时 (${displayName})，但可能仍在后台加载...`);
                
                // 超时后重试
                if (retryCount < MAX_RETRIES) {
                    console.log(`【FontManager】🔄 准备重试加载字体 (${retryCount + 1}/${MAX_RETRIES})...`);
                    setTimeout(async () => {
                        const retryResult = await this._loadFontFace(fontFamily, fontPath, retryCount + 1);
                        resolve(retryResult);
                    }, 2000); // 等待2秒后重试
                } else {
                    console.error(`【FontManager】❌ 字体加载失败，已达到最大重试次数`);
                    // 标记为已加载，避免重复尝试
                    this.loadedFonts.add(fontFamily);
                    resolve(false);
                }
            }, 30000); // 30秒超时（大文件需要更长时间）
            
            uni.loadFontFace({
                family: displayName,
                source: `url("${sourcePath}")`,
                global: true,
                success: () => {
                    clearTimeout(timeout);
                    this.loadedFonts.add(fontFamily);
                    console.log(`【FontManager】✅ 字体加载成功:`, displayName);
                    if (retryCount > 0) {
                        console.log(`【FontManager】✅ 重试成功！`);
                    }
                    resolve(true);
                },
                fail: (err) => {
                    clearTimeout(timeout);
                    console.error(`【FontManager】❌ 字体加载失败:`, displayName, sourcePath, err);
                    
                    // 【关键提示】小程序端字体加载失败的常见原因
                    if (platform === 'mp-weixin') {
                        console.error(`【FontManager】⚠️ 小程序端字体加载失败可能的原因：`);
                        console.error(`  1. 云存储 CORS 配置不正确（最常见）`);
                        console.error(`  2. 需要设置 Access-Control-Allow-Origin: servicewechat.com 或 *`);
                        console.error(`  3. 配置路径：腾讯云控制台 > 云开发 > 云存储 > 权限设置 > CORS配置`);
                        console.error(`  4. 字体文件较大 (${config?.size ? (config.size / 1024 / 1024).toFixed(2) + ' MB' : '未知'})，可能需要更长加载时间`);
                        console.error(`  5. 字体 URL: ${sourcePath.match(/https?:\/\/[^/]+/)?.[0]}`);
                        console.error(`  6. 小程序将回退使用系统默认字体`);
                    }
                    
                    // 失败后重试
                    if (retryCount < MAX_RETRIES) {
                        console.log(`【FontManager】🔄 准备重试加载字体 (${retryCount + 1}/${MAX_RETRIES})...`);
                        setTimeout(async () => {
                            const retryResult = await this._loadFontFace(fontFamily, fontPath, retryCount + 1);
                            resolve(retryResult);
                        }, 2000); // 等待2秒后重试
                    } else {
                        // 标记为已加载，避免重复尝试
                        this.loadedFonts.add(fontFamily);
                        resolve(false);
                    }
                }
            });
        });
    }
    
    async loadFontToMemory(fontFamily) {
        const fontPath = await this.getFontPath(fontFamily);
        if (!fontPath) throw new Error(`字体路径不存在: ${fontFamily}`);
        return this._loadFontFace(fontFamily, fontPath);
    }

    /**
     * 获取所有可用字体列表（内置 + 自定义）
     */
    getAvailableFonts() {
        const builtInFonts = Object.entries(FONT_CONFIG).map(([fontFamily, config]) => ({
            fontFamily,
            displayName: config.displayName,
            size: config.size,
            isDefault: config.isDefault || false,
            isCustom: false,
            isCached: this.isFontCachedSync(fontFamily),
            isLoaded: this.loadedFonts.has(fontFamily)
        }));
        
        const customFontsList = Object.entries(this.customFonts).map(([fontFamily, config]) => ({
            fontFamily,
            displayName: config.displayName,
            size: config.size,
            isDefault: false,
            isCustom: true,
            isCached: true,
            isLoaded: this.loadedFonts.has(fontFamily)
        }));
        
        return [...builtInFonts, ...customFontsList];
    }

    async preloadCommonFonts(fontFamilies = ['汇文明朝']) {
        console.log('【FontManager】预加载常用字体:', fontFamilies);
        const promises = fontFamilies.map(async (fontFamily) => {
            try {
                await this.ensureFontAvailable(fontFamily);
                return { fontFamily, success: true };
            } catch (e) {
                console.error('【FontManager】预加载字体失败:', fontFamily, e);
                return { fontFamily, success: false, error: e };
            }
        });
        return Promise.all(promises);
    }

    async deleteFontCache(fontFamily) {
        const config = this.getFontConfig(fontFamily);
        if (!config) throw new Error('字体不存在');
        if (config.isDefault) throw new Error('无法删除默认字体');
        if (config.isCustom) {
            return this.deleteCustomFont(fontFamily);
        }
        
        const fontData = this.cacheInfo.fonts[fontFamily];
        if (!fontData) return;
        
        const platform = platformDetector.getCurrentPlatform();
        
        try {
            if (platform === 'h5') {
                await this._deleteFromIndexedDB(fontFamily);
            } else if (fontData.path) {
                const fs = uni.getFileSystemManager();
                fs.unlinkSync(fontData.path);
            }
        } catch (e) {
            console.warn('【FontManager】删除字体文件失败:', fontFamily, e);
        }
        
        this.cacheInfo.totalSize -= fontData.size || 0;
        delete this.cacheInfo.fonts[fontFamily];
        this.loadedFonts.delete(fontFamily);
        this.saveCacheInfo();
    }

    async clearAllCache() {
        const platform = platformDetector.getCurrentPlatform();
        
        for (const [fontFamily, fontData] of Object.entries(this.cacheInfo.fonts)) {
            const config = this.getFontConfig(fontFamily);
            if (config?.isDefault) continue;
            
            try {
                if (platform === 'h5') {
                    await this._deleteFromIndexedDB(fontFamily);
                } else if (fontData.path) {
                    const fs = uni.getFileSystemManager();
                    fs.unlinkSync(fontData.path);
                }
                this.loadedFonts.delete(fontFamily);
            } catch (e) {
                console.warn('【FontManager】删除字体文件失败:', fontFamily, e);
            }
        }

        // 清除自定义字体
        for (const fontFamily of Object.keys(this.customFonts)) {
            try {
                if (platform === 'h5') {
                    await this._deleteFromIndexedDB(fontFamily);
                }
                this.loadedFonts.delete(fontFamily);
            } catch (e) {}
        }
        this.customFonts = {};
        this.saveCustomFonts();

        this.cacheInfo = { fonts: {}, totalSize: 0, lastCleanup: Date.now() };
        this.saveCacheInfo();
    }

    getCacheStats() {
        const builtInCount = Object.keys(FONT_CONFIG).length;
        const customCount = Object.keys(this.customFonts).length;
        const cachedFonts = Object.keys(this.cacheInfo.fonts).length;
        
        return {
            totalFonts: builtInCount + customCount,
            builtInFonts: builtInCount,
            customFonts: customCount,
            cachedFonts,
            loadedFonts: this.loadedFonts.size,
            cacheSize: this.cacheInfo.totalSize,
            cacheSizeFormatted: this.formatFileSize(this.cacheInfo.totalSize),
            maxCacheSize: MAX_CACHE_SIZE,
            maxCacheSizeFormatted: this.formatFileSize(MAX_CACHE_SIZE)
        };
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

const fontManager = new FontManager();
export default fontManager;
