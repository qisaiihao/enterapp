/**
 * 分享图片 Canvas 绘制工具函数
 */

import fontManager from './fontManager.js';
import fileUrlCache from '@/cache/core/file-url.js';

// 兼容旧的 fontFamily ID 到 displayName 的映射
const LEGACY_FONT_MAP = {
    'Huiwen-mincho': '汇文明朝'
};

const DEFAULT_SIGNATURE_OPTIONS = {
    threshold: 245,
    neutralTolerance: 18,
    targetWidth: 240
};

const signaturePreprocessCache = new Map();

function isMiniProgramEnv() {
    return typeof wx !== 'undefined' && !!wx;
}

function isH5BrowserEnv() {
    return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function isCanvasSafeUrl(url) {
    if (!url || typeof url !== 'string') return false;
    if (/^(data:|blob:|file:|\/)/i.test(url)) return true;
    if (!isH5BrowserEnv()) return false;
    try {
        const parsed = new URL(url, window.location.origin);
        return parsed.origin === window.location.origin;
    } catch (_) {
        return false;
    }
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function isCloudUrl(src) {
    return typeof src === 'string' && src.startsWith('cloud://');
}

function getImageInfoSafe(src) {
    // 【防御】cloud:// 协议 URL 在 H5 环境下无法被 uni.getImageInfo 处理，
    // 直接返回 null 避免框架内部抛出 filePath.indexOf 错误
    if (isCloudUrl(src)) {
        console.warn('[shareCanvas] getImageInfoSafe called with cloud:// URL, returning null', src);
        return Promise.resolve(null);
    }
    return new Promise((resolve) => {
        try {
            uni.getImageInfo({
                src,
                success: (res) => resolve(res || null),
                fail: () => resolve(null)
            });
        } catch (syncError) {
            // 防御 uni.getImageInfo 同步抛出异常（如框架内部对非标准 URL 调用 filePath.indexOf）
            console.warn('[shareCanvas] getImageInfoSafe sync error:', syncError);
            resolve(null);
        }
    }).catch(() => null);
}

function dataUrlToTempFilePath(dataUrl) {
    return new Promise((resolve, reject) => {
        if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
            reject(new Error('invalid data url'));
            return;
        }
        if (typeof uni.base64ToTempFilePath !== 'function') {
            reject(new Error('base64ToTempFilePath unavailable'));
            return;
        }
        uni.base64ToTempFilePath({
            base64Data: dataUrl,
            success: (res) => resolve(res.filePath),
            fail: (err) => reject(err)
        });
    });
}

function getCanvasImageFactory(target) {
    if (!target) return null;
    if (typeof target.createImage === 'function') {
        return () => target.createImage();
    }
    const canvas = target.canvas || target._canvas;
    if (canvas && typeof canvas.createImage === 'function') {
        return () => canvas.createImage();
    }
    if (isH5BrowserEnv() && typeof Image !== 'undefined') {
        return () => new Image();
    }
    return null;
}

function loadCanvasImage(target, src) {
    return new Promise((resolve, reject) => {
        const createImage = getCanvasImageFactory(target);
        if (!createImage) {
            reject(new Error('canvas image factory unavailable'));
            return;
        }

        let image = null;
        try {
            image = createImage();
        } catch (error) {
            reject(error);
            return;
        }

        if (!image) {
            reject(new Error('canvas image unavailable'));
            return;
        }

        image.onload = () => resolve(image);
        image.onerror = (error) => reject(error || new Error('canvas image load failed'));
        if (isH5BrowserEnv() && typeof image.crossOrigin !== 'undefined' && /^https?:\/\//i.test(src) && !isCanvasSafeUrl(src)) {
            image.crossOrigin = 'anonymous';
        }
        image.src = src;
    });
}

/**
 * 检测是否为传统 uni-app CanvasContext（有 draw() 缓冲方法但无原生 createImage）
 * H5 传统 CanvasContext 不支持直接传入 Image 元素绘制，
 * 否则框架在 ctx.draw() 冲刷缓冲区时会尝试从 Image 提取 path 并调用 indexOf 导致 TypeError
 */
function isLegacyCanvasContext(ctx) {
    if (!ctx) return false;
    // 原生 CanvasRenderingContext2D（小程序 2D canvas）有 createImage 方法
    // 传统 uni-app CanvasContext 有 draw() 缓冲方法但无 createImage
    return typeof ctx.draw === 'function' && typeof ctx.createImage !== 'function';
}

async function drawImageSource(ctx, src, x, y, width, height) {
    // 传统 uni-app CanvasContext：只能传入字符串路径，由框架内部加载图片
    if (isLegacyCanvasContext(ctx)) {
        ctx.drawImage(src, x, y, width, height);
        return;
    }
    // 原生 Canvas 上下文（小程序 2D canvas）：需手动加载 Image 后绘制
    if (getCanvasImageFactory(ctx)) {
        const image = await loadCanvasImage(ctx, src);
        ctx.drawImage(image, x, y, width, height);
        return;
    }
    ctx.drawImage(src, x, y, width, height);
}

async function removeWhiteBackgroundFromSignature(localPath, imageInfo, options) {
    if (!isMiniProgramEnv() || !wx.createOffscreenCanvas) return null;
    if (!localPath) return null;

    const sourceWidth = imageInfo && imageInfo.width ? imageInfo.width : 0;
    const sourceHeight = imageInfo && imageInfo.height ? imageInfo.height : 0;
    if (!sourceWidth || !sourceHeight) return null;

    const targetWidth = Math.max(1, Math.round(Math.min(options.targetWidth || sourceWidth, sourceWidth)));
    const scale = targetWidth / sourceWidth;
    const targetHeight = Math.max(1, Math.round(sourceHeight * scale));

    let canvas = null;
    let ctx = null;
    try {
        canvas = wx.createOffscreenCanvas({ type: '2d', width: targetWidth, height: targetHeight });
        ctx = canvas && canvas.getContext && canvas.getContext('2d');
    } catch (_) {}
    if (!canvas || !ctx) return null;

    try {
        ctx.clearRect(0, 0, targetWidth, targetHeight);
        const signatureImage = await loadCanvasImage(canvas, localPath);
        ctx.drawImage(signatureImage, 0, 0, targetWidth, targetHeight);
        const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
        const data = imageData && imageData.data;
        if (!data || !data.length) return null;

        let changed = 0;
        for (let i = 0; i < data.length; i += 4) {
            const alpha = data[i + 3];
            if (!alpha) continue;
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const spread = Math.max(r, g, b) - Math.min(r, g, b);
            const isNearWhite = r >= options.threshold && g >= options.threshold && b >= options.threshold;
            if (isNearWhite && spread <= options.neutralTolerance) {
                data[i + 3] = 0;
                changed += 1;
            }
        }

        if (!changed) return null;
        ctx.putImageData(imageData, 0, 0);

        if (typeof canvas.toTempFilePath === 'function') {
            const res = await new Promise((resolve, reject) => {
                canvas.toTempFilePath({
                    fileType: 'png',
                    quality: 1,
                    success: resolve,
                    fail: reject
                });
            });
            return (res && (res.tempFilePath || res.filePath)) || null;
        }

        if (typeof canvas.toDataURL === 'function') {
            const dataUrl = canvas.toDataURL('image/png');
            if (!dataUrl) return null;
            return await dataUrlToTempFilePath(dataUrl);
        }
    } catch (e) {
        console.warn('[shareCanvas] remove signature white background failed', e);
    }

    return null;
}

async function resolveCloudUrl(url) {
    if (typeof url !== 'string' || !url.startsWith('cloud://')) return url;
    try {
        const tempUrl = await fileUrlCache.getTempUrl(url);
        if (tempUrl && tempUrl !== url) return tempUrl;
    } catch (_) {}
    return url;
}

async function prepareSignatureForCard(signatureUrl, rawOptions = {}) {
    if (!signatureUrl || typeof signatureUrl !== 'string') return signatureUrl;

    // 【修复】将 cloud:// 签名 URL 转换为可访问的 HTTP 临时 URL，
    // 避免 uni.getImageInfo 在 H5 环境下因无法处理 cloud:// 协议而抛出 filePath.indexOf 错误
    const resolvedUrl = await resolveCloudUrl(signatureUrl);

    const options = {
        ...DEFAULT_SIGNATURE_OPTIONS,
        ...rawOptions
    };

    const cacheKey = `${resolvedUrl}|${options.threshold}|${options.neutralTolerance}|${options.targetWidth}`;
    if (signaturePreprocessCache.has(cacheKey)) {
        return signaturePreprocessCache.get(cacheKey);
    }

    const task = (async () => {
        if (isH5BrowserEnv()) {
            if (isCanvasSafeUrl(resolvedUrl) || typeof fetch !== 'function') {
                return resolvedUrl;
            }
            try {
                const response = await fetch(resolvedUrl, { mode: 'cors', cache: 'no-store' });
                if (!response || !response.ok) return resolvedUrl;
                const blob = await response.blob();
                if (!blob) return resolvedUrl;
                // 【修复】H5 使用 data URL 替代 blob URL，
                // blob URL 在 uni-app 传统 CanvasContext 中会导致 ctx.drawImage()
                // 内部渲染时序异常，使之前绘制的背景色被覆盖为白色。
                // data URL 对所有 Canvas/Image/getImageInfo 原生支持，无 CORS/时序问题。
                const dataUrl = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });
                console.log('[shareCanvas] H5 签名已转为 data URL，长度:', dataUrl ? dataUrl.length : 0);
                return dataUrl;
            } catch (_) {
                return resolvedUrl;
            }
        }

        if (!isMiniProgramEnv()) return signatureUrl;

        const info = await getImageInfoSafe(signatureUrl);
        if (!info) return signatureUrl;

        const localPath = info.path || info.tempFilePath || signatureUrl;
        const processedPath = await removeWhiteBackgroundFromSignature(localPath, info, options);
        return processedPath || localPath || signatureUrl;
    })().catch(() => signatureUrl);

    signaturePreprocessCache.set(cacheKey, task);
    return task;
}

/**
 * 获取字体的显示名称（用于 Canvas）
 * 统一使用 displayName，兼容旧的 fontFamily ID
 */
function getFontDisplayName(fontFamily) {
    return LEGACY_FONT_MAP[fontFamily] || fontFamily;
}

function quoteFontFamily(fontFamily) {
    if (!fontFamily) return '';
    return `"${String(fontFamily).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function getRuntimeFontFamily(fontFamily) {
    if (fontManager && typeof fontManager.getRuntimeFontFamily === 'function') {
        return fontManager.getRuntimeFontFamily(fontFamily);
    }
    return LEGACY_FONT_MAP[fontFamily] || fontFamily;
}

function resolveShareCanvasFontFamily(fontFamily) {
    if (!fontFamily || fontFamily === 'system') {
        return 'sans-serif';
    }

    const fontDisplayName = getFontDisplayName(fontFamily);
    const runtimeFamily = getRuntimeFontFamily(fontFamily);
    // Canvas 绘制统一使用 runtimeFamily（如 "Huiwen-mincho"），
    // 该字体名由 fontManager 通过 FontFace API 从本地静态文件加载，
    // 而非从云存储下载。小程序也通过 uni.loadFontFace 加载同名。
    return quoteFontFamily(runtimeFamily || fontDisplayName) || 'sans-serif';
}

/**
 * 异步绘制网络图片到 Canvas
 * @param {Object} ctx - Canvas 上下文
 * @param {string} url - 图片 URL
 * @param {number} x - x 坐标
 * @param {number} y - y 坐标
 * @param {number} fixedWidth - 固定宽度
 * @returns {Promise<{width: number, height: number}>}
 */
async function drawImageAsync(ctx, url, x, y, fixedWidth) {
    if (!url || typeof url !== 'string') {
        throw new Error('invalid image url');
    }

    // 【防御】cloud:// 协议 URL 无法被 uni.getImageInfo 处理（H5 环境），提前拒绝
    if (isCloudUrl(url)) {
        throw new Error('cloud:// URL is not supported for canvas drawing, use a resolved HTTP URL instead');
    }

    const res = await new Promise((resolve, reject) => {
        uni.getImageInfo({
            src: url,
            success: resolve,
            fail: reject
        });
    });

    // 【防御】确保 drawPath 是字符串，防止框架内部因非字符串路径抛出 filePath.indexOf 错误
    const rawPath = res.path || res.tempFilePath;
    const drawPath = (typeof rawPath === 'string' ? rawPath : url);
    if (!drawPath || typeof drawPath !== 'string') {
        throw new Error('invalid draw path');
    }
    if (isH5BrowserEnv() && !isCanvasSafeUrl(drawPath)) {
        throw new Error('H5 cross-origin image would taint canvas');
    }

    const scale = fixedWidth / res.width;
    const drawWidth = fixedWidth;
    const drawHeight = res.height * scale;
    await drawImageSource(ctx, drawPath, x, y, drawWidth, drawHeight);
    return { width: drawWidth, height: drawHeight };
}

/**
 * 计算文字实际行数
 * @param {Object} ctx - Canvas 上下文
 * @param {string} text - 文本
 * @param {number} maxWidth - 最大宽度
 * @param {number} fontSize - 字体大小
 * @param {string} fontFamily - 字体
 * @returns {number}
 */
function calculateActualLines(ctx, text, maxWidth, fontSize, fontFamily = '"Huiwen-mincho"') {
    ctx.font = `${fontSize}px ${fontFamily}`;
    const lines = text.split('\n');
    let actualLineCount = 0;

    lines.forEach(line => {
        if (!line.trim()) {
            actualLineCount += 0.5;
            return;
        }
        const textWidth = ctx.measureText ? ctx.measureText(line).width : line.length * fontSize * 0.6;
        if (textWidth <= maxWidth) {
            actualLineCount += 1;
        } else {
            actualLineCount += Math.ceil(textWidth / maxWidth);
        }
    });

    return actualLineCount;
}

/**
 * 文字换行处理
 * @param {Object} ctx - Canvas 上下文
 * @param {string} text - 文本
 * @param {number} maxWidth - 最大宽度
 * @param {number} fontSize - 字体大小
 * @param {string} fontFamily - 字体
 * @returns {string[]}
 */
function wrapText(ctx, text, maxWidth, fontSize, fontFamily = '"Huiwen-mincho"') {
    ctx.font = `${fontSize}px ${fontFamily}`;
    const optimizedText = preventShortLineBreak(text);
    const originalLines = optimizedText.split('\n');
    const wrappedLines = [];

    originalLines.forEach(line => {
        if (!line.trim()) {
            wrappedLines.push('');
            return;
        }

        const textWidth = ctx.measureText ? ctx.measureText(line).width : line.length * fontSize * 0.6;
        if (textWidth <= maxWidth) {
            wrappedLines.push(line);
        } else {
            // 按字符拆分
            let currentLine = '';
            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                const testLine = currentLine + char;
                const testWidth = ctx.measureText ? ctx.measureText(testLine).width : testLine.length * fontSize * 0.6;
                // 优化：给Canvas文本测量增加5%的容错，避免过于保守的换行
                if (testWidth > maxWidth * 0.95 && currentLine) {
                    wrappedLines.push(currentLine);
                    currentLine = char;
                } else {
                    currentLine = testLine;
                }
            }
            if (currentLine) wrappedLines.push(currentLine);
        }
    });

    return wrappedLines;
}

/**
 * 防止单字换行的中文排版优化
 * @param {string} text - 原文本
 * @returns {string}
 */
function preventShortLineBreak(text) {
    if (!text) return '';
    // 在标点前添加零宽空格防止单字换行
    return text.replace(/([，。！？、：；""''）】」》])/g, '\u200B$1');
}

/**
 * 绘制圆角矩形
 * @param {Object} ctx - Canvas 上下文
 * @param {number} x - x 坐标
 * @param {number} y - y 坐标
 * @param {number} width - 宽度
 * @param {number} height - 高度
 * @param {number} radius - 圆角半径
 */
function drawRoundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.arcTo(x + width, y, x + width, y + radius, radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
    ctx.lineTo(x + radius, y + height);
    ctx.arcTo(x, y + height, x, y + height - radius, radius);
    ctx.lineTo(x, y + radius);
    ctx.arcTo(x, y, x + radius, y, radius);
    ctx.closePath();
}

/**
 * 绘制多行文字
 * @param {Object} ctx - Canvas 上下文
 * @param {string[]} lines - 行数组
 * @param {number} x - x 坐标
 * @param {number} startY - 起始 y 坐标
 * @param {number} lineHeight - 行高
 * @param {string} color - 颜色
 * @returns {number} 结束 y 坐标
 */
function drawMultiLineText(ctx, lines, x, startY, lineHeight, color = '#333') {
    ctx.setFillStyle(color);
    let y = startY;
    lines.forEach(line => {
        ctx.fillText(line, x, y);
        y += lineHeight;
    });
    return y;
}

/**
 * 加载字体
 * @param {string} family - 字体名
 * @param {string} source - 字体源
 * @returns {Promise<boolean>}
 */
function loadFont(family, source) {
    return new Promise((resolve) => {
        uni.loadFontFace({
            family,
            source,
            success: () => resolve(true),
            fail: () => resolve(false)
        });
    });
}

/**
 * 导出 Canvas 为图片
 * @param {string} canvasId - Canvas ID
 * @param {Object} context - 组件上下文
 * @param {number} width - 宽度
 * @param {number} height - 高度
 * @returns {Promise<string>}
 */
function canvasToTempFile(canvasId, context, width, height, options = {}) {
    const destScale = Math.max(1, Number(options.destScale || 2));
    const fileType = options.fileType || 'jpg';
    const quality = typeof options.quality === 'number' ? options.quality : 0.9;
    const canvas = options.canvas || null;

    return new Promise((resolve, reject) => {
        if (canvas) {
            const exportOptions = {
                x: 0,
                y: 0,
                width,
                height,
                destWidth: Math.max(1, Math.round(width * destScale)),
                destHeight: Math.max(1, Math.round(height * destScale)),
                fileType,
                quality,
                success: (res) => resolve((res && (res.tempFilePath || res.filePath)) || ''),
                fail: (err) => reject(err)
            };

            if (typeof canvas.toTempFilePath === 'function') {
                canvas.toTempFilePath(exportOptions);
                return;
            }

            if (typeof wx !== 'undefined' && wx.canvasToTempFilePath) {
                wx.canvasToTempFilePath({
                    canvas,
                    ...exportOptions
                });
                return;
            }

            reject(new Error('canvas node export unavailable'));
            return;
        }

        uni.canvasToTempFilePath({
            canvasId,
            x: 0,
            y: 0,
            width,
            height,
            destWidth: Math.max(1, Math.round(width * destScale)),
            destHeight: Math.max(1, Math.round(height * destScale)),
            fileType,
            quality,
            success: (res) => resolve(res.tempFilePath),
            fail: (err) => reject(err)
        }, context);
    });
}

/**
 * Export share canvas with retry scales for mini-program reliability.
 * @param {Object} options
 * @returns {Promise<{tempFilePath: string, scale: number}>}
 */
async function exportShareCanvas(options) {
    const {
        canvasId,
        context,
        canvas,
        width,
        height,
        fileType = 'jpg',
        quality = 0.9,
        scales = [2, 2, 1.5, 1],
        retryDelayMs = 120
    } = options || {};

    let lastError = null;
    for (let i = 0; i < scales.length; i++) {
        const scale = scales[i];
        try {
            const tempFilePath = await canvasToTempFile(canvasId, context, width, height, {
                canvas,
                destScale: scale,
                fileType,
                quality
            });
            return { tempFilePath, scale };
        } catch (err) {
            lastError = err;
            console.warn('[shareCanvas] export retry failed', { scale, err });
            if (i < scales.length - 1 && retryDelayMs > 0) {
                await sleep(retryDelayMs);
            }
        }
    }

    throw (lastError || new Error('canvas export failed'));
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

/**
 * 绘制右下角水印
 */
function drawCornerWatermark(ctx, canvasWidth, canvasHeight) {
    const margin = 24;
    const w = 220;
    const h = 180;
    const stepX = 0.55;
    const stepY = 0.60;
    const x0 = canvasWidth - w - margin;
    const y0 = canvasHeight - h - margin;
    const lineWidth = 1.5;
    const strokeColor = 'rgba(0,0,0,0.16)';
    const textColor = 'rgba(0,0,0,0.22)';
    const sx = x0 + w * stepX;
    const sy = y0 + h * stepY;
    
    ctx.save();
    try {
        if (ctx.setLineWidth) ctx.setLineWidth(lineWidth); else ctx.lineWidth = lineWidth;
        if (ctx.setStrokeStyle) ctx.setStrokeStyle(strokeColor); else ctx.strokeStyle = strokeColor;
        // 顶边
        ctx.beginPath();
        ctx.moveTo(sx, y0);
        ctx.lineTo(x0 + w, y0);
        ctx.stroke();
        // 左边
        ctx.beginPath();
        ctx.moveTo(x0, sy);
        ctx.lineTo(x0, y0 + h);
        ctx.stroke();
        // 内横线
        ctx.beginPath();
        ctx.moveTo(x0, sy);
        ctx.lineTo(sx, sy);
        ctx.stroke();
        // 内竖线
        ctx.beginPath();
        ctx.moveTo(sx, y0);
        ctx.lineTo(sx, sy);
        ctx.stroke();
        // 小字"poementer"
        try {
            const inset = 12;
            if (ctx.setFillStyle) ctx.setFillStyle(textColor); else ctx.fillStyle = textColor;
            const fontPx = 18;
            try { ctx.font = `${fontPx}px "Huiwen-mincho"`; } catch (_) {}
            if (ctx.setFontSize) ctx.setFontSize(fontPx);
            if (ctx.setTextAlign) ctx.setTextAlign('left'); else ctx.textAlign = 'left';
            ctx.fillText('poementer', x0 + inset, y0 + h - inset);
        } catch (_) {}
    } finally { ctx.restore(); }
}

/**
 * 计算分享卡片所需高度
 * @param {Object} options - 配置项
 * @returns {Promise<{canvasHeight: number, processedLines: string[], titleHeight: number, signatureDrawHeight: number}>}
 */
async function calculateShareCardHeight(options) {
    const {
        measureCtx,
        post,
        shareConfig,
        canvasWidth = 750,
        shouldShowSignature = true
    } = options;

    const baseFontSize = shareConfig.fontSize || 38;
    const fontScale = shareConfig.fontScale || 1.0;
    const fontSize = Math.round(baseFontSize * fontScale);
    const lineHeight = Math.round(fontSize * 1.26);
    const fontFamily = shareConfig.fontFamily || '汇文明朝';
    
    const actualFontFamily = resolveShareCanvasFontFamily(fontFamily);
    console.log('【shareCanvas】当前端使用字体:', actualFontFamily);

    const textPadding = 60;
    const textTopPadding = 80;
    const textBottomPadding = 60;

    const baseTitleFontSize = shareConfig.titleFontSize || Math.round(baseFontSize * 1.21);
    const titleFontSize = Math.round(baseTitleFontSize * fontScale);
    const titleLineHeight = Math.round(titleFontSize * 1.22);
    const titleBottomSpacing = Math.round(fontSize * 0.84);

    const textAreaWidth = canvasWidth - 120;
    const content = post.content || '';

    if (measureCtx) {
        measureCtx.font = fontSize + 'px ' + actualFontFamily;
    }

    // 计算正文行数和高度
    const processedLines = wrapText(measureCtx, content, textAreaWidth, fontSize, actualFontFamily);
    const wrappedContentHeight = processedLines.reduce((h, line) => h + (line && line.trim() ? lineHeight : lineHeight * 0.5), 0);
    const contentHeight = Math.max(wrappedContentHeight, 200);

    // 计算标题高度
    let actualTitleHeight = titleLineHeight + 20;
    if (post.title) {
        const titleLines = wrapText(measureCtx, post.title, textAreaWidth, titleFontSize, actualFontFamily);
        const titleLinesCount = titleLines.filter(line => line.trim()).length;
        if (titleLinesCount > 1) {
            actualTitleHeight = titleLinesCount * titleLineHeight + 20;
        }
    }
    const titleHeight = actualTitleHeight;

    // 计算签名高度
    const signatureTopGap = 40;
    const fixedSignatureWidth = 240; // 签名宽度（从 120 增加到 240，两倍大小）
    const signatureTextFontSize = 28;
    let signatureDrawHeight = 0;
    let preparedSignatureUrl = '';
    
    if (post.authorSignature && shouldShowSignature) {
        try {
            preparedSignatureUrl = await prepareSignatureForCard(post.authorSignature, {
                targetWidth: fixedSignatureWidth
            });
            const sigInfo = await getImageInfoSafe(preparedSignatureUrl || post.authorSignature);
            if (sigInfo && sigInfo.width > 0) {
                const scale = fixedSignatureWidth / sigInfo.width;
                signatureDrawHeight = Math.max(1, Math.round(sigInfo.height * scale));
            } else {
                signatureDrawHeight = Math.round(fixedSignatureWidth * 0.42);
            }
        } catch (_) {
            signatureDrawHeight = Math.round(fixedSignatureWidth * 0.42);
        }
    }

    // 计算最终高度
    const isNonOriginalPoem = post.isPoem && post.isOriginal === false && post.author;
    const needsAuthorSpace = shouldShowSignature || isNonOriginalPoem;

    let finalCanvasHeight = textTopPadding + titleHeight + titleBottomSpacing + contentHeight
        + (post.authorSignature && shouldShowSignature
            ? (signatureTopGap + signatureDrawHeight)
            : (needsAuthorSpace && ((post.authorName && post.authorName.trim()) || (post.author && post.author.trim())))
                ? (signatureTopGap + signatureTextFontSize)
                : 0)
        + textBottomPadding + 10;

    const safetyMargin = Math.max(60, Math.ceil(lineHeight * 1.5));
    finalCanvasHeight += safetyMargin;

    return {
        canvasHeight: Math.ceil(finalCanvasHeight),
        processedLines,
        titleHeight,
        signatureDrawHeight,
        fontSize,
        lineHeight,
        titleFontSize,
        titleLineHeight,
        titleBottomSpacing,
        actualFontFamily,
        textPadding,
        textTopPadding,
        textBottomPadding,
        textAreaWidth,
        signatureTopGap,
        fixedSignatureWidth,
        signatureTextFontSize,
        preparedSignatureUrl
    };
}

/**
 * 绘制分享卡片内容
 * @param {Object} options - 配置项
 */
async function drawShareCardContent(options) {
    const {
        ctx,
        post,
        shareConfig,
        canvasWidth,
        canvasHeight,
        processedLines,
        titleHeight,
        signatureDrawHeight,
        fontSize,
        lineHeight,
        titleFontSize,
        titleLineHeight,
        titleBottomSpacing,
        actualFontFamily,
        textPadding,
        textTopPadding,
        textAreaWidth,
        signatureTopGap,
        fixedSignatureWidth,
        signatureTextFontSize,
        shouldShowSignature,
        preparedSignatureUrl
    } = options;

    // 设置字体
    ctx.font = fontSize + 'px ' + actualFontFamily;

    // 【修复】先清空Canvas，确保没有残留
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // 绘制圆角背景
    // 【修复】优先使用 post 的背景颜色（原始数据），然后才是 shareConfig（可能被用户修改）
    // 空字符串被视为无效值，会回退到下一个选项
    // 【调试】打印背景颜色来源，追踪颜色丢失问题
    const postBgColor = (post.backgroundColor && post.backgroundColor.trim()) || '';
    const configBgColor = (shareConfig.backgroundColor && shareConfig.backgroundColor.trim()) || '';
    const bgColor = postBgColor || configBgColor || '#a4c4bd';
    console.log('[shareCanvas] 背景颜色调试:', {
        postBgColorRaw: post.backgroundColor,
        postBgColor: postBgColor,
        shareConfigBgColorRaw: shareConfig.backgroundColor,
        configBgColor: configBgColor,
        finalBgColor: bgColor
    });
    ctx.setFillStyle(bgColor);
    drawRoundedRect(ctx, 0, 0, canvasWidth, canvasHeight, 15);
    ctx.fill();

    // 绘制文字内容
    const postTextColor = (post.textColor && post.textColor.trim()) || '';
    const configTextColor = (shareConfig.textColor && shareConfig.textColor.trim()) || '';
    const textColor = postTextColor || configTextColor || '#333333';
    ctx.setFillStyle(textColor);
    ctx.setTextAlign('left');

    // 绘制标题
    const title = post.title || '';
    if (title) {
        ctx.font = titleFontSize + 'px ' + actualFontFamily;
        ctx.setFillStyle(textColor);
        ctx.setTextAlign('left');

        const titleLines = wrapText(ctx, title, textAreaWidth, titleFontSize, actualFontFamily);
        let titleY = textTopPadding + titleFontSize;
        const titleX = textPadding;

        titleLines.forEach((line) => {
            if (line.trim()) {
                ctx.fillText(line, titleX, titleY);
                titleY += titleLineHeight;
            } else {
                titleY += titleLineHeight * 0.5;
            }
        });

        ctx.font = fontSize + 'px ' + actualFontFamily;
    }

    // 绘制正文
    let y = textTopPadding + titleHeight + titleBottomSpacing + fontSize;
    const x = textPadding;
    const drawTextSignature = (signatureName) => {
        const finalName = ((signatureName || '') + '').trim();
        if (!finalName) return;
        ctx.setTextAlign('right');
        ctx.setFillStyle(textColor);
        ctx.font = signatureTextFontSize + 'px ' + actualFontFamily;
        const textMargin = 48;
        const sigTextX = canvasWidth - textMargin;
        const sigTextY = Math.min(y + signatureTopGap + signatureTextFontSize, canvasHeight - textMargin);
        ctx.fillText(finalName, sigTextX, sigTextY);
        ctx.setTextAlign('left');
    };

    processedLines.forEach((line) => {
        if (line.trim()) {
            ctx.fillText(line, x, y);
            y += lineHeight;
        } else {
            y += lineHeight * 0.5;
        }
    });

    // 绘制签名
    if (post.authorSignature && shouldShowSignature) {
        const signatureMargin = 40;
        const signatureX = canvasWidth - fixedSignatureWidth - signatureMargin;
        const signatureY = Math.min(y + signatureTopGap, canvasHeight - signatureDrawHeight - signatureMargin);
        try {
            await drawImageAsync(ctx, preparedSignatureUrl || post.authorSignature, signatureX, signatureY, fixedSignatureWidth);
        } catch (e) {
            console.warn('draw signature image failed, fallback to text signature', e);
            drawTextSignature(post.authorName || post.author);
        }
    } else if (shouldShowSignature) {
        drawTextSignature(post.authorName || post.author);
    } else if (post.isPoem && post.isOriginal === false && post.author) {
        drawTextSignature(post.author);
    }

    // 绘制水印
    try { drawCornerWatermark(ctx, canvasWidth, canvasHeight); } catch (e) { console.warn('draw watermark failed', e); }
}

const shareCanvas = {
    drawImageAsync,
    calculateActualLines,
    wrapText,
    preventShortLineBreak,
    drawRoundRect,
    drawRoundedRect,
    drawMultiLineText,
    loadFont,
    canvasToTempFile,
    exportShareCanvas,
    prepareSignatureForCard,
    drawCornerWatermark,
    calculateShareCardHeight,
    drawShareCardContent
};

export {
    drawImageAsync,
    calculateActualLines,
    wrapText,
    preventShortLineBreak,
    drawRoundRect,
    drawRoundedRect,
    drawMultiLineText,
    loadFont,
    canvasToTempFile,
    exportShareCanvas,
    prepareSignatureForCard,
    drawCornerWatermark,
    calculateShareCardHeight,
    drawShareCardContent
};

export default shareCanvas;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = shareCanvas;
    module.exports.default = shareCanvas;
}
