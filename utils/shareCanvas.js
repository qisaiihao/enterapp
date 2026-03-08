/**
 * 分享图片 Canvas 绘制工具函数
 */

// 兼容旧的 fontFamily ID 到 displayName 的映射
const LEGACY_FONT_MAP = {
    'Huiwen-mincho': '汇文明朝'
};

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
                    const scale = fixedWidth / res.width;
                    const drawWidth = fixedWidth;
                    const drawHeight = res.height * scale;
                    ctx.drawImage(res.path, x, y, drawWidth, drawHeight);
                    resolve({ width: drawWidth, height: drawHeight });
                } catch (e) {
                    reject(e);
                }
            },
            fail: (err) => {
                // H5 备用方案
                if (err?.errMsg?.includes('responseText')) {
                    try {
                        ctx.drawImage(url, x, y, fixedWidth, fixedWidth);
                        resolve({ width: fixedWidth, height: fixedWidth });
                    } catch (e) {
                        reject(err);
                    }
                } else {
                    reject(err);
                }
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
function canvasToTempFile(canvasId, context, width, height) {
    return new Promise((resolve, reject) => {
        uni.canvasToTempFilePath({
            canvasId,
            x: 0,
            y: 0,
            width,
            height,
            destWidth: width * 2,
            destHeight: height * 2,
            fileType: 'jpg',
            quality: 0.9,
            success: (res) => resolve(res.tempFilePath),
            fail: (err) => reject(err)
        }, context);
    });
}

/**
 * 绘制圆角矩形（使用 quadraticCurveTo）
 */
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
    
    if (post.authorSignature && shouldShowSignature) {
        try {
            const sigInfo = await new Promise((resolve) => {
                uni.getImageInfo({ src: post.authorSignature, success: (res) => resolve(res), fail: () => resolve(null) });
            });
            if (sigInfo && sigInfo.width > 0) {
                const scale = fixedSignatureWidth / sigInfo.width;
                signatureDrawHeight = Math.max(1, Math.round(sigInfo.height * scale));
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
        signatureTextFontSize
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
        shouldShowSignature
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

        await drawImageAsync(ctx, post.authorSignature, signatureX, signatureY, fixedSignatureWidth);
    } else if (shouldShowSignature) {
        const authorName = ((post.authorName || post.author || '') + '').trim();
        if (authorName) {
            ctx.setTextAlign('right');
            ctx.setFillStyle(textColor);
            ctx.font = signatureTextFontSize + 'px ' + actualFontFamily;
            const textMargin = 48;
            const sigTextX = canvasWidth - textMargin;
            const sigTextY = Math.max(canvasHeight - textMargin, y + signatureTopGap);
            ctx.fillText(authorName, sigTextX, sigTextY);
            ctx.setTextAlign('left');
        }
    } else if (post.isPoem && post.isOriginal === false && post.author) {
        const originalAuthor = (post.author + '').trim();
        if (originalAuthor) {
            ctx.setTextAlign('right');
            ctx.setFillStyle(textColor);
            ctx.font = signatureTextFontSize + 'px ' + actualFontFamily;
            const textMargin = 48;
            const sigTextX = canvasWidth - textMargin;
            const sigTextY = Math.max(canvasHeight - textMargin, y + signatureTopGap);
            ctx.fillText(originalAuthor, sigTextX, sigTextY);
            ctx.setTextAlign('left');
        }
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
    drawCornerWatermark,
    calculateShareCardHeight,
    drawShareCardContent
};
