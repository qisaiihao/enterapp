/**
 * 分享图片 Canvas 绘制工具函数
 */

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

function getImageInfoSafe(src) {
    return new Promise((resolve) => {
        uni.getImageInfo({
            src,
            success: (res) => resolve(res || null),
            fail: () => resolve(null)
        });
    });
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
        ctx.drawImage(localPath, 0, 0, targetWidth, targetHeight);
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

async function prepareSignatureForCard(signatureUrl, rawOptions = {}) {
    if (!signatureUrl || typeof signatureUrl !== 'string') return signatureUrl;

    const options = {
        ...DEFAULT_SIGNATURE_OPTIONS,
        ...rawOptions
    };

    const cacheKey = `${signatureUrl}|${options.threshold}|${options.neutralTolerance}|${options.targetWidth}`;
    if (signaturePreprocessCache.has(cacheKey)) {
        return signaturePreprocessCache.get(cacheKey);
    }

    const task = (async () => {
        if (isH5BrowserEnv()) {
            if (isCanvasSafeUrl(signatureUrl) || typeof fetch !== 'function' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
                return signatureUrl;
            }
            try {
                const response = await fetch(signatureUrl, { mode: 'cors', cache: 'no-store' });
                if (!response || !response.ok) return signatureUrl;
                const blob = await response.blob();
                if (!blob) return signatureUrl;
                return URL.createObjectURL(blob);
            } catch (_) {
                return signatureUrl;
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

/**
 * 异步绘制网络图片到 Canvas
 * @param {Object} ctx - Canvas 上下文
 * @param {string} url - 图片 URL
 * @param {number} x - x 坐标
 * @param {number} y - y 坐标
 * @param {number} fixedWidth - 固定宽度
 * @returns {Promise<{width: number, height: number}>}
 */
function drawImageAsync(ctx, url, x, y, fixedWidth) {
    return new Promise((resolve, reject) => {
        if (!url || typeof url !== 'string') {
            reject(new Error('无效的图片URL'));
            return;
        }
        
        uni.getImageInfo({
            src: url,
            success: (res) => {
                try {
                    const drawPath = res.path || res.tempFilePath || url;
                    if (isH5BrowserEnv() && !isCanvasSafeUrl(drawPath)) {
                        reject(new Error('H5跨域图片会污染Canvas，已跳过图片绘制'));
                        return;
                    }

                    const scale = fixedWidth / res.width;
                    const drawWidth = fixedWidth;
                    const drawHeight = res.height * scale;
                    ctx.drawImage(drawPath, x, y, drawWidth, drawHeight);
                    resolve({ width: drawWidth, height: drawHeight });
                } catch (e) {
                    reject(e);
                }
            },
            fail: (err) => {
                reject(err);
            }
        });
    });
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
function calculateActualLines(ctx, text, maxWidth, fontSize, fontFamily = '汇文明朝, sans-serif') {
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
function wrapText(ctx, text, maxWidth, fontSize, fontFamily = '汇文明朝, sans-serif') {
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

    return new Promise((resolve, reject) => {
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
            try { ctx.font = fontPx + 'px 汇文明朝, sans-serif'; } catch (_) {}
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
    
    // 将字体 ID 转换为显示名称，用于 Canvas 绑定
    const fontDisplayName = getFontDisplayName(fontFamily);
    const actualFontFamily = fontFamily === 'system' ? 'sans-serif' : fontDisplayName + ', sans-serif';
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
        } catch (_) {}
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
    const bgColor = shareConfig.backgroundColor || post.backgroundColor || '#FFFFFF';
    ctx.setFillStyle(bgColor);
    drawRoundedRect(ctx, 0, 0, canvasWidth, canvasHeight, 15);
    ctx.fill();

    // 绘制文字内容
    const textColor = shareConfig.textColor || post.textColor || '#000000';
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
        const sigTextY = Math.max(canvasHeight - textMargin, y + signatureTopGap);
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

module.exports = {
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
