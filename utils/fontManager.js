/**
 * 字体动态加载管理器
 * 支持从腾讯云存储动态下载字体文件并本地缓存
 * 支持用户添加本地字体
 * 
 * 重要：统一使用 displayName（如"汇文明朝"）作为字体标识符
 * 这样 uni.loadFontFace 注册的名称和 Canvas ctx.font 使用的名称一致
 */

import platformDetector from './platformDetector.js';
import fileUrlCache from '@/cache/core/file-url.js';

const FONT_STORAGE_KEY = 'cached_fonts';
const CUSTOM_FONTS_KEY = 'custom_fonts';
const FONT_CACHE_DIR = 'fonts';
const MAX_CACHE_SIZE = 100 * 1024 * 1024; // 100MB缓存限制

function getPlusSafe() {
    return typeof plus !== 'undefined' ? plus : null;
}

function waitForPlusReady(timeout = 10000) {
    return new Promise((resolve) => {
        const plusInstance = getPlusSafe();
        if (plusInstance && plusInstance.io) {
            resolve(plusInstance);
            return;
        }

        const start = Date.now();
        const timer = setInterval(() => {
            const runtimePlus = getPlusSafe();
            if (runtimePlus && runtimePlus.io) {
                clearInterval(timer);
                resolve(runtimePlus);
                return;
            }

            if (Date.now() - start >= timeout) {
                clearInterval(timer);
                resolve(null);
            }
        }, 50);
    });
}

function getDefaultLocalFileName(config, platform = platformDetector.getCurrentPlatform()) {
    if (config && config.localFileNameByPlatform && config.localFileNameByPlatform[platform]) {
        return config.localFileNameByPlatform[platform];
    }
    return config ? config.filename : '';
}

function buildStaticFontPath(sourcePath) {
    if (!sourcePath) return '';
    if (/^(\/|https?:\/\/|file:\/\/)/i.test(sourcePath)) {
        return sourcePath;
    }
    return `/static/fonts/${sourcePath}`;
}

function getPlatformLocalFontSources(config, platform = platformDetector.getCurrentPlatform()) {
    if (!config) return [];

    let rawSources = [];
    if (platform === 'app' && Array.isArray(config.appLocalSources)) {
        rawSources = config.appLocalSources;
    } else if (platform === 'h5' && Array.isArray(config.h5LocalSources)) {
        rawSources = config.h5LocalSources;
    } else if (config.localSourcesByPlatform && Array.isArray(config.localSourcesByPlatform[platform])) {
        rawSources = config.localSourcesByPlatform[platform];
    } else {
        const localFileName = getDefaultLocalFileName(config, platform);
        if (localFileName) {
            rawSources = [{ path: localFileName }];
        }
    }

    const sources = [];
    const seenPaths = new Set();
    rawSources.forEach((source) => {
        const rawPath = typeof source === 'string' ? source : (source.path || source.url || '');
        const path = buildStaticFontPath(String(rawPath || '').trim());
        if (!path || seenPaths.has(path)) return;

        seenPaths.add(path);
        sources.push({
            path,
            format: typeof source === 'string' ? '' : (source.format || '')
        });
    });

    return sources;
}

function getPrimaryLocalFontSource(config, platform = platformDetector.getCurrentPlatform()) {
    const sources = getPlatformLocalFontSources(config, platform);
    return sources.length ? sources[0] : null;
}

function getMiniProgramFontSources(config) {
    if (!config) return [];

    const sources = [];
    const seenUrls = new Set();
    const appendSource = (source) => {
        if (!source || !source.url) return;
        const url = String(source.url).trim();
        if (!url || seenUrls.has(url)) return;

        seenUrls.add(url);
        sources.push({
            url,
            format: source.format || ''
        });
    };

    if (config.mpWeixinUrl) {
        appendSource({
            url: config.mpWeixinUrl,
            format: 'woff2'
        });
    }

    if (Array.isArray(config.mpWeixinSources)) {
        config.mpWeixinSources.forEach(appendSource);
    }

    return sources;
}

function getPrimaryMiniProgramFontSource(config) {
    const sources = getMiniProgramFontSources(config);
    return sources.length ? sources[0] : null;
}

function getFileExtension(fileName = '') {
    const normalized = String(fileName || '').trim();
    const match = normalized.match(/(\.[a-z0-9]+)(?:[?#].*)?$/i);
    return match ? match[1].toLowerCase() : '';
}

function getSafeFileName(fontName, fileNameOrConfig = '') {
    let safeName = '';
    for (let i = 0; i < fontName.length; i++) {
        safeName += fontName.charCodeAt(i).toString(36);
    }

    const rawFileName = typeof fileNameOrConfig === 'string'
        ? fileNameOrConfig
        : ((fileNameOrConfig && fileNameOrConfig.filename) || '');
    const ext = getFileExtension(rawFileName) || '.ttf';
    return 'f_' + safeName + ext;
}

function isMiniProgramLocalFontPath(sourcePath) {
    const normalized = String(sourcePath || '').trim();
    if (!normalized) return false;

    const sanitize = (value) => String(value || '').trim().replace(/\\/g, '/').replace(/\/+$/, '');
    const normalizedPath = sanitize(normalized);
    const managedDirs = [];

    try {
        if (typeof wx !== 'undefined' && wx.env && wx.env.USER_DATA_PATH) {
            managedDirs.push(`${sanitize(wx.env.USER_DATA_PATH)}/${FONT_CACHE_DIR}`);
        }
    } catch (e) {}

    managedDirs.push(`wxfile://usr/${FONT_CACHE_DIR}`);
    managedDirs.push(`http://usr/${FONT_CACHE_DIR}`);

    return Array.from(new Set(managedDirs.map(sanitize).filter(Boolean))).some((dir) => {
        return normalizedPath === dir || normalizedPath.startsWith(`${dir}/`);
    });
}

function isRemoteFontSourcePath(sourcePath) {
    const normalized = String(sourcePath || '').trim();
    if (!normalized) return false;
    if (isMiniProgramLocalFontPath(normalized)) return false;
    return /^(https?:)?\/\//i.test(normalized);
}

function isLegacyBuiltinFontCache(fontFamily, cacheData, config) {
    if (!fontFamily || !cacheData || !config) return false;
    if (fontFamily !== '汇文明朝') return false;

    const expectedCloudUrls = getMiniProgramFontSources(config).map((item) => item.url);
    const cachedCloudUrl = cacheData.cloudUrl || '';
    const cachedPath = cacheData.path || '';
    const isMiniProgram = platformDetector.getCurrentPlatform() === 'mp-weixin';
    const expectedLocalExt = getFileExtension(config.filename);

    return (
        cachedCloudUrl.endsWith('.otf') ||
        cachedPath.endsWith('.otf') ||
        (isMiniProgram && !!cachedPath && !isMiniProgramLocalFontPath(cachedPath)) ||
        (isMiniProgram && expectedLocalExt && !!cachedPath && !cachedPath.endsWith(expectedLocalExt)) ||
        (isMiniProgram && !!cachedCloudUrl && !cachedPath) ||
        (cachedCloudUrl && expectedCloudUrls.length > 0 && !expectedCloudUrls.includes(cachedCloudUrl))
    );
}

// 内置字体配置表 - 统一使用 displayName 作为 key
const FONT_CONFIG = {
    '汇文明朝': {
        displayName: '汇文明朝',
        runtimeFamily: 'Huiwen-mincho',
        filename: 'Huiwen-mincho-compressed.woff2',
        localFileNameByPlatform: {
            h5: 'Huiwen-mincho-compressed.woff2',
            app: 'Huiwen-mincho-compressed.woff2'
        },
        h5LocalSources: [
            {
                path: 'Huiwen-mincho-compressed.woff2',
                format: 'woff2'
            }
        ],
        appLocalSources: [
            {
                path: 'Huiwen-mincho-compressed.woff2',
                format: 'woff2'
            }
        ],
        cloudPath: 'cloud://cloud1-5gb0pbyl400845f5.636c-cloud1-5gb0pbyl400845f5-1378788263/fonts/Huiwen-mincho-compressed.woff2',
        // 小程序端使用 WOFF2 格式的 HTTPS 链接（直接使用 TCB 域名，避免云函数超时）
        mpWeixinUrl: 'https://636c-cloud1-5gb0pbyl400845f5-1378788263.tcb.qcloud.la/fonts/Huiwen-mincho-compressed.woff2',
        size: 7993880, // 7.9MB
        mpWeixinSources: [
            {
                url: 'https://636c-cloud1-5gb0pbyl400845f5-1378788263.tcb.qcloud.la/fonts/Huiwen-mincho-compressed.woff2',
                format: 'woff2'
            },
            {
                url: 'https://636c-cloud1-5gb0pbyl400845f5-1378788263.tcb.qcloud.la/fonts/Huiwen-mincho-compressed.woff',
                format: 'woff'
            },
            {
                url: 'https://636c-cloud1-5gb0pbyl400845f5-1378788263.tcb.qcloud.la/fonts/Huiwen-mincho-compressed.ttf',
                format: 'ttf'
            }
        ],
        version: '1.4.0',
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
        this.loadingFonts = new Map();
        this.downloadingFonts = new Map();
        this.customFonts = this.getCustomFonts();
        this.cacheInfo = this.getCacheInfo();
        this._sanitizeMiniProgramCacheInfo();
        this._fontDirReadyPromise = null;
    }

    _sanitizeMiniProgramCacheInfo() {
        if (platformDetector.getCurrentPlatform() !== 'mp-weixin') return;
        if (!this.cacheInfo || !this.cacheInfo.fonts) return;

        let changed = false;
        Object.keys(this.cacheInfo.fonts).forEach((fontFamily) => {
            const fontData = this.cacheInfo.fonts[fontFamily];
            if (!fontData || !fontData.path) return;
            if (isMiniProgramLocalFontPath(fontData.path)) return;

            console.warn('[FontManager] purge invalid MP cache path:', fontFamily, fontData.path);
            this.cacheInfo.totalSize = Math.max(0, (this.cacheInfo.totalSize || 0) - (fontData.size || 0));
            delete this.cacheInfo.fonts[fontFamily];
            changed = true;
        });

        if (changed) {
            this.saveCacheInfo();
        }
    }

    getPlatformStoragePath() {
        const platform = platformDetector.getCurrentPlatform();
        if (platform === 'h5') return 'h5-temp-cache';
        if (platform === 'app') return '_doc/fonts/';
        if (platform === 'mp-weixin') return `${wx.env.USER_DATA_PATH}/${FONT_CACHE_DIR}`;
        return `temp/${FONT_CACHE_DIR}`;
    }

    initializeFontDir() {
        const platform = platformDetector.getCurrentPlatform();
        if (platform === 'h5') return Promise.resolve(true);
        
        // App 端使用 plus.io 创建目录
        if (platform === 'app') {
            if (this._fontDirReadyPromise) {
                return this._fontDirReadyPromise;
            }

            this._fontDirReadyPromise = (async () => {
                const plusInstance = await waitForPlusReady();
                if (!plusInstance || !plusInstance.io) {
                    console.warn('【FontManager】plus runtime unavailable, skip font dir init');
                    return false;
                }

                return new Promise((resolve) => {
                    plusInstance.io.resolveLocalFileSystemURL('_doc/', (entry) => {
                        entry.getDirectory('fonts', { create: true }, () => {
                            console.log('【FontManager】字体目录创建成功');
                            resolve(true);
                        }, (err) => {
                            console.warn('【FontManager】创建字体目录失败:', err);
                            resolve(false);
                        });
                    }, (err) => {
                        console.warn('【FontManager】访问_doc失败:', err);
                        resolve(false);
                    });
                });
            })();

            return this._fontDirReadyPromise;
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
            return Promise.resolve(false);
        }
        return Promise.resolve(true);
        // #endif
    }

    async getPlusInstance() {
        const plusInstance = await waitForPlusReady();
        if (!plusInstance || !plusInstance.io) {
            console.warn('【FontManager】plus runtime unavailable');
            return null;
        }
        return plusInstance;
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

    purgeFontCache(fontFamily) {
        if (!fontFamily || !this.cacheInfo || !this.cacheInfo.fonts) return;
        if (this.cacheInfo.fonts[fontFamily]) {
            delete this.cacheInfo.fonts[fontFamily];
            this.saveCacheInfo();
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
                        const safeFileName = getSafeFileName(fontFamily, fileName);
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

    async _readFileAsArrayBuffer(filePath) {
        // #ifdef APP-PLUS
        const plusInstance = await this.getPlusInstance();
        if (plusInstance && plusInstance.io) {
            return new Promise((resolve, reject) => {
                plusInstance.io.resolveLocalFileSystemURL(filePath, (entry) => {
                    entry.file((file) => {
                        const reader = new plusInstance.io.FileReader();
                        reader.onloadend = (e) => resolve(e.target.result);
                        reader.onerror = reject;
                        reader.readAsArrayBuffer(file);
                    }, reject);
                }, reject);
            });
        }
        throw new Error('plus runtime unavailable');
        // #endif
        
        // #ifdef MP-WEIXIN
        return new Promise((resolve, reject) => {
            const fs = uni.getFileSystemManager();
            fs.readFile({
                filePath,
                success: (res) => resolve(res.data),
                fail: reject
            });
        });
        // #endif
    }

    async _copyFile(srcPath, destPath) {
        // #ifdef APP-PLUS
        const plusInstance = await this.getPlusInstance();
        if (plusInstance && plusInstance.io) {
            await this.initializeFontDir();
            return new Promise((resolve, reject) => {
                plusInstance.io.resolveLocalFileSystemURL(srcPath, (srcEntry) => {
                    plusInstance.io.resolveLocalFileSystemURL(destPath.substring(0, destPath.lastIndexOf('/')), (destDir) => {
                        srcEntry.copyTo(destDir, destPath.substring(destPath.lastIndexOf('/') + 1), resolve, reject);
                    }, reject);
                }, reject);
            });
        }
        throw new Error('plus runtime unavailable');
        // #endif
        
        // #ifdef MP-WEIXIN
        return new Promise((resolve, reject) => {
            const fs = uni.getFileSystemManager();
            fs.copyFile({
                srcPath,
                destPath,
                success: resolve,
                fail: reject
            });
        });
        // #endif
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
                if (cacheData && cacheData.path && (platform !== 'mp-weixin' || isMiniProgramLocalFontPath(cacheData.path))) {
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

    getRuntimeFontFamily(fontFamily) {
        const normalizedName = this.normalizeFontName(fontFamily);
        const config = this.getFontConfig(normalizedName);
        if (!config) return normalizedName;
        return config.runtimeFamily || config.displayName || normalizedName;
    }

    getPreviewFontFamily(fontFamily) {
        const normalizedName = this.normalizeFontName(fontFamily);
        const config = this.getFontConfig(normalizedName);
        const runtimeFamily = this.getRuntimeFontFamily(normalizedName);
        const displayName = config?.displayName || normalizedName;

        if (runtimeFamily && displayName && runtimeFamily !== displayName) {
            return `"${runtimeFamily}", "${displayName}"`;
        }

        return runtimeFamily ? `"${runtimeFamily}"` : displayName;
    }

    isFontLoaded(fontFamily) {
        const normalizedName = this.normalizeFontName(fontFamily);
        return this.loadedFonts.has(normalizedName);
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

        const cacheData = this.cacheInfo.fonts[normalizedName];
        console.log('【FontManager】📦 缓存数据:', cacheData);
        
        if (!cacheData) {
            console.log('【FontManager】❌ 无缓存数据');
            return false;
        }
        if (isLegacyBuiltinFontCache(normalizedName, cacheData, config)) {
            console.log('【FontManager】⚠️ 检测到旧版字体缓存，准备清理:', cacheData);
            this.purgeFontCache(normalizedName);
            return false;
        }
        if (cacheData.version !== config.version) {
            console.log('【FontManager】⚠️ 版本不匹配，缓存:', cacheData.version, '配置:', config.version);
            this.purgeFontCache(normalizedName);
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
                    const plusInstance = await this.getPlusInstance();
                    if (!plusInstance || !plusInstance.io) {
                        return false;
                    }
                    await new Promise((resolve, reject) => {
                        plusInstance.io.resolveLocalFileSystemURL(cacheData.path, resolve, reject);
                    });
                    return true;
                } catch (e) {
                    return false;
                }
            }
            return !!cacheData.cloudUrl;
        }

        if (platform === 'mp-weixin') {
            if (!cacheData.path) {
                return false;
            }
            if (!isMiniProgramLocalFontPath(cacheData.path)) {
                this.purgeFontCache(normalizedName);
                return false;
            }
            let hasCached = false;
            try {
                const fs = uni.getFileSystemManager();
                fs.accessSync(cacheData.path);
                hasCached = true;
            } catch (e) {
                this.purgeFontCache(normalizedName);
                hasCached = false;
            }
            console.log('【FontManager】小程序端缓存检查，path:', cacheData.path, '结果:', hasCached);
            return hasCached;
        }

        try {
            const fs = uni.getFileSystemManager();
            const safeFileName = getSafeFileName(fontFamily, config);
            const baseDir = this.getPlatformStoragePath();
            const sep = baseDir.endsWith('/') ? '' : '/';
            fs.accessSync(`${baseDir}${sep}${safeFileName}`);
            return true;
        } catch (e) {
            return false;
        }
    }
    
    isFontCachedSync(fontFamily) {
        const normalizedName = this.normalizeFontName(fontFamily);
        const config = this.getFontConfig(normalizedName);
        if (!config) return false;
        if (config.isDefault) return true;
        if (config.isCustom) return true;
        
        const cacheData = this.cacheInfo.fonts[normalizedName];
        if (!cacheData) return false;
        if (isLegacyBuiltinFontCache(normalizedName, cacheData, config)) {
            this.purgeFontCache(normalizedName);
            return false;
        }
        if (cacheData.version !== config.version) return false;

        if (platformDetector.getCurrentPlatform() === 'mp-weixin') {
            if (!cacheData.path) {
                return false;
            }
            if (!isMiniProgramLocalFontPath(cacheData.path)) {
                this.purgeFontCache(normalizedName);
                return false;
            }
            try {
                const fs = uni.getFileSystemManager();
                fs.accessSync(cacheData.path);
                return true;
            } catch (e) {
                this.purgeFontCache(normalizedName);
                return false;
            }
        }
        
        return !!(cacheData.storageType === 'indexedDB' || cacheData.cloudUrl || cacheData.path);
    }

    async getFontPath(fontFamily) {
        const normalizedName = this.normalizeFontName(fontFamily);
        const config = this.getFontConfig(normalizedName);
        if (!config) return null;

        if (config.isDefault) {
            const platform = platformDetector.getCurrentPlatform();
            const primarySource = getPrimaryLocalFontSource(config, platform);
            return primarySource ? primarySource.path : null;
        }

        const platform = platformDetector.getCurrentPlatform();
        const cacheData = this.cacheInfo.fonts[normalizedName];
        
        if (platform === 'mp-weixin') {
            if (cacheData && isLegacyBuiltinFontCache(normalizedName, cacheData, config)) {
                console.log('【FontManager】⚠️ 检测到旧版小程序字体链接，已清理缓存');
                this.purgeFontCache(normalizedName);
            }
            if (cacheData && cacheData.path) {
                if (!isMiniProgramLocalFontPath(cacheData.path)) {
                    this.purgeFontCache(normalizedName);
                    return null;
                }
                console.log('【FontManager】小程序端使用本地字体缓存:', cacheData.path);
                return cacheData.path;
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

        const safeFileName = getSafeFileName(fontFamily, config);
        const baseDir = this.getPlatformStoragePath();
        const sep = baseDir.endsWith('/') ? '' : '/';
        return `${baseDir}${sep}${safeFileName}`;
    }

    async downloadFont(fontFamily, onProgress) {
        const config = this.getFontConfig(fontFamily);
        if (!config) throw new Error(`未知字体: ${fontFamily}`);
        if (config.isCustom) throw new Error('自定义字体无需下载');
        const platform = platformDetector.getCurrentPlatform();
        if (config.isDefault && platform !== 'mp-weixin') {
            const primarySource = getPrimaryLocalFontSource(config, platform);
            if (!primarySource || !primarySource.path) {
                throw new Error(`默认字体缺少本地资源: ${fontFamily}`);
            }
            console.log('【FontManager】📦 默认字体使用本地内置资源，跳过云端下载:', fontFamily, primarySource.path);
            if (onProgress) onProgress(100);
            return primarySource.path;
        }

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
        
        if (platform === 'mp-weixin') {
            const primarySource = getPrimaryMiniProgramFontSource(config);
            if (!primarySource || !primarySource.url) {
                throw new Error('小程序端字体链接未配置');
            }
            
            console.log('[FontManager] MP registering remote font source:', primarySource.url);
            console.log('【FontManager】⚠️ 请确保云存储 CORS 配置正确：');
            console.log('【FontManager】   Access-Control-Allow-Origin: *');
            
            if (onProgress) {
                onProgress(10);
                setTimeout(() => onProgress(35), 120);
                setTimeout(() => onProgress(60), 240);
                setTimeout(() => onProgress(100), 360);
            }
            
            return primarySource.url;
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
        const safeFileName = getSafeFileName(fontFamily, config);
        await this.initializeFontDir();
        
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
        await this.initializeFontDir();

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
        return (async () => {
            // #ifdef APP-PLUS
            const plusInstance = await this.getPlusInstance();
            if (!plusInstance || !plusInstance.io) {
                throw new Error('plus runtime unavailable');
            }

            await this.initializeFontDir();
            return new Promise((resolve, reject) => {
                plusInstance.io.resolveLocalFileSystemURL(tempFilePath, (tempEntry) => {
                    plusInstance.io.resolveLocalFileSystemURL('_doc/', (docEntry) => {
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
            });
            // #endif
        })();
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
                    const plusInstance = getPlusSafe();
                    if (!plusInstance || !plusInstance.io) {
                        continue;
                    }
                    plusInstance.io.resolveLocalFileSystemURL(fontData.path, (entry) => {
                        entry.remove();
                    });
                    // #endif
                } else {
                    // 小程序端使用 FileSystemManager
                    // #ifdef MP
                    if (isMiniProgramLocalFontPath(fontData.path)) {
                        const fs = uni.getFileSystemManager();
                        fs.unlinkSync(fontData.path);
                    }
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

        if (this.loadedFonts.has(normalizedName)) {
            console.log('【FontManager】✅ 字体已加载到内存');
            if (onProgress) onProgress(100);
            return (await this.getFontPath(normalizedName)) || normalizedName;
        }

        if (this.loadingFonts.has(normalizedName)) {
            console.log('[FontManager] waiting for in-flight font load:', normalizedName);
            const existingTask = this.loadingFonts.get(normalizedName);
            const result = await existingTask;
            if (onProgress) onProgress(100);
            return result;
        }

        const loadTask = this._ensureFontAvailableInternal(normalizedName, onProgress);
        this.loadingFonts.set(normalizedName, loadTask);

        try {
            return await loadTask;
        } finally {
            if (this.loadingFonts.get(normalizedName) === loadTask) {
                this.loadingFonts.delete(normalizedName);
            }
        }
    }

    async _ensureFontAvailableInternal(normalizedName, onProgress) {
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

        if (!fontPath) {
            throw new Error("字体路径不存在: " + normalizedName);
        }

        console.log('【FontManager】🔤 字体未加载到内存，开始加载...');
        const cssManagedAppBuiltinPath = await this._verifyCssManagedAppBuiltinFont(normalizedName, fontPath);
        if (cssManagedAppBuiltinPath) {
            this.loadedFonts.add(normalizedName);
            console.log('[FontManager] App builtin font ready via CSS-managed local woff2:', normalizedName, cssManagedAppBuiltinPath);
            if (onProgress) onProgress(100);
            return fontPath;
        }

        const loaded = await this._loadFontFace(normalizedName, fontPath);
        if (!loaded) {
            this.loadedFonts.delete(normalizedName);
            throw new Error("字体加载失败: " + normalizedName);
        }

        if (onProgress) onProgress(100);
        return fontPath;
    }

    async _verifyCssManagedAppBuiltinFont(fontFamily, fontPath) {
        if (platformDetector.getCurrentPlatform() !== 'app') return null;
        if (fontFamily !== '汇文明朝') return null;

        const plusInstance = await this.getPlusInstance();
        if (!plusInstance || !plusInstance.io) {
            return null;
        }

        const resolvedPath = this._resolveAppFontSourcePath(fontPath);
        if (!resolvedPath) {
            return null;
        }

        try {
            await new Promise((resolve, reject) => {
                plusInstance.io.resolveLocalFileSystemURL(resolvedPath, resolve, reject);
            });
            return resolvedPath;
        } catch (error) {
            console.warn('[FontManager] App builtin woff2 path unresolved, keep runtime fallback path:', fontFamily, fontPath, error);
            return null;
        }
    }

    async _loadFontFaceWithRetry(displayName, sourcePath, retryCount = 0, options = {}) {
        const MAX_RETRIES = typeof options.maxRetries === 'number' ? options.maxRetries : 2;
        const TIMEOUT_MS = typeof options.timeoutMs === 'number' ? options.timeoutMs : 30000;

        console.log('【FontManager】准备加载字体:', displayName, '路径:', sourcePath);
        if (retryCount > 0) {
            console.log('【FontManager】重试次数:', retryCount);
        }

        return new Promise((resolve) => {
            let settled = false;
            let retryScheduled = false;

            const finish = (result) => {
                if (settled) return;
                settled = true;
                resolve(result);
            };

            const scheduleRetry = () => {
                if (retryScheduled) return;
                retryScheduled = true;

                if (retryCount < MAX_RETRIES) {
                    console.log(`【FontManager】🔄 准备重试加载字体 (${retryCount + 1}/${MAX_RETRIES})...`);
                    setTimeout(async () => {
                        const retryResult = await this._loadFontFaceWithRetry(displayName, sourcePath, retryCount + 1, options);
                        finish(retryResult);
                    }, 2000);
                } else {
                    finish(false);
                }
            };

            const timeout = setTimeout(() => {
                console.warn(`【FontManager】⚠️ 字体加载超时 (${displayName})，准备重试或切换候选源:`, sourcePath);
                scheduleRetry();
            }, TIMEOUT_MS);

            uni.loadFontFace({
                family: displayName,
                source: `url("${sourcePath}")`,
                global: true,
                success: () => {
                    clearTimeout(timeout);
                    console.log(`【FontManager】✅ 字体加载成功:`, displayName, sourcePath);
                    finish(true);
                },
                fail: (err) => {
                    clearTimeout(timeout);
                    console.error(`【FontManager】❌ 字体加载失败:`, displayName, sourcePath, err);
                    scheduleRetry();
                }
            });
        });
    }

    async _loadMiniProgramFontFace(fontFamily, config, displayName, fontPath) {
        const candidateSources = [];
        const seenSources = new Set();
        const appendSource = (source) => {
            if (!source) return;

            const url = typeof source === 'string' ? source : (source.path || source.url || '');
            const format = typeof source === 'string' ? '' : (source.format || '');
            if (!url || !isRemoteFontSourcePath(url) || seenSources.has(url)) return;

            seenSources.add(url);
            candidateSources.push({ url, format });
        };
        appendSource(fontPath);
        getMiniProgramFontSources(config).forEach(appendSource);

        if (!candidateSources.length) {
            console.error('[FontManager] MP has no usable HTTPS font source:', fontFamily, fontPath);
            this.loadedFonts.delete(fontFamily);
            return false;
        }

        for (const candidate of candidateSources) {
            console.log('[FontManager] MP trying HTTPS font source:', candidate.format || 'unknown', candidate.url);
            const loaded = await this._loadFontFaceWithRetry(displayName, candidate.url, 0, {
                maxRetries: 0,
                timeoutMs: 12000
            });
            if (loaded) {
                this.loadedFonts.add(fontFamily);
                return true;
            }
        }

        console.error('[FontManager] MP font load failed after trying all HTTPS candidates; falling back to system font');
        this.loadedFonts.delete(fontFamily);
        return false;
    }

    _resolveAppFontSourcePath(fontPath) {
        if (!fontPath) return null;

        let sourcePath = fontPath;
        // #ifdef APP-PLUS
        const plusInstance = getPlusSafe();
        if (!plusInstance || !plusInstance.io) {
            return null;
        }
        if (fontPath.startsWith('/static/')) {
            try {
                sourcePath = plusInstance.io.convertLocalFileSystemURL(`_www${fontPath}`);
            } catch (e) {
                sourcePath = plusInstance.io.convertLocalFileSystemURL(fontPath);
            }
        } else if (!fontPath.startsWith('http') && !fontPath.startsWith('file://')) {
            sourcePath = plusInstance.io.convertLocalFileSystemURL(fontPath);
        }
        // #endif

        return sourcePath;
    }

    async _loadAppFontFace(fontFamily, config, displayName, fontPath) {
        const plusInstance = await this.getPlusInstance();
        if (!plusInstance || !plusInstance.io) {
            this.loadedFonts.delete(fontFamily);
            return false;
        }

        const candidateSources = [];
        const seenSources = new Set();
        const appendSource = (source) => {
            if (!source) return;

            const rawPath = typeof source === 'string' ? source : source.path;
            const format = typeof source === 'string' ? '' : (source.format || '');
            const resolvedPath = this._resolveAppFontSourcePath(rawPath);
            if (!resolvedPath || seenSources.has(resolvedPath)) return;

            seenSources.add(resolvedPath);
            candidateSources.push({
                path: resolvedPath,
                format,
                originalPath: rawPath
            });
        };

        appendSource(fontPath);
        if (!config.isCustom) {
            getPlatformLocalFontSources(config, 'app').forEach(appendSource);
        }

        if (!candidateSources.length) {
            console.error('【FontManager】❌ App端没有可用的字体源:', fontFamily);
            this.loadedFonts.delete(fontFamily);
            return false;
        }

        for (const candidate of candidateSources) {
            console.log('【FontManager】📱 App端尝试字体源:', candidate.format || 'unknown', candidate.originalPath, '->', candidate.path);
            const loaded = await this._loadFontFaceWithRetry(displayName, candidate.path);
            if (loaded) {
                this.loadedFonts.add(fontFamily);
                return true;
            }
        }

        console.error('【FontManager】⚠️ App端字体加载失败，已尝试所有本地候选源:', fontFamily);
        this.loadedFonts.delete(fontFamily);
        return false;
    }

    async _loadFontFace(fontFamily, fontPath) {
        const config = this.getFontConfig(fontFamily);
        const displayName = config?.displayName || fontFamily;
        const runtimeFamily = this.getRuntimeFontFamily(fontFamily);
        const platform = platformDetector.getCurrentPlatform();

        // H5 端使用原生 FontFace API，更可靠
        if (platform === 'h5' && typeof FontFace !== 'undefined') {
            try {
                const font = new FontFace(runtimeFamily, `url("${fontPath}")`);
                await font.load();
                document.fonts.add(font);
                
                // 【关键修复】等待字体真正可用
                await document.fonts.ready;
                
                this.loadedFonts.add(fontFamily);
                console.log(`【FontManager】✅ 字体加载成功 (FontFace API):`, displayName, '->', runtimeFamily);
                return true;
            } catch (err) {
                console.error(`【FontManager】❌ 字体加载失败 (FontFace API):`, displayName, '->', runtimeFamily, err);
                this.loadedFonts.delete(fontFamily);
                return false;
            }
        }

        if (platform === 'mp-weixin') {
            return this._loadMiniProgramFontFace(fontFamily, config, runtimeFamily, fontPath);
        }

        if (platform === 'app') {
            return this._loadAppFontFace(fontFamily, config, runtimeFamily, fontPath);
        }

        let sourcePath = fontPath;

        if (!sourcePath) {
            console.error('【FontManager】❌ 字体路径不存在:', displayName);
            this.loadedFonts.delete(fontFamily);
            return false;
        }

        const loaded = await this._loadFontFaceWithRetry(runtimeFamily, sourcePath);
        if (loaded) {
            this.loadedFonts.add(fontFamily);
        } else {
            this.loadedFonts.delete(fontFamily);
        }
        return loaded;
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
        const builtInFonts = Object.entries(FONT_CONFIG).map(([fontFamily, config]) => {
            const isLoaded = this.loadedFonts.has(fontFamily);
            const isCached = this.isFontCachedSync(fontFamily);
            return {
                fontFamily,
                displayName: config.displayName,
                runtimeFamily: this.getRuntimeFontFamily(fontFamily),
                previewFamily: this.getPreviewFontFamily(fontFamily),
                size: config.size,
                isDefault: config.isDefault || false,
                isCustom: false,
                isCached,
                isLoaded,
                needsLoad: !isLoaded
            };
        });
        
        const customFontsList = Object.entries(this.customFonts).map(([fontFamily, config]) => ({
            fontFamily,
            displayName: config.displayName,
            runtimeFamily: config.runtimeFamily || fontFamily,
            previewFamily: config.runtimeFamily && config.runtimeFamily !== config.displayName
                ? `"${config.runtimeFamily}", "${config.displayName}"`
                : `"${config.displayName || fontFamily}"`,
            size: config.size,
            isDefault: false,
            isCustom: true,
            isCached: true,
            isLoaded: this.loadedFonts.has(fontFamily),
            needsLoad: false
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
            } else if (fontData.path && (platform !== 'mp-weixin' || isMiniProgramLocalFontPath(fontData.path))) {
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
                } else if (fontData.path && (platform !== 'mp-weixin' || isMiniProgramLocalFontPath(fontData.path))) {
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
