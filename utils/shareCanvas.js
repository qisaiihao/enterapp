/**
 * 分享图片 Canvas 绘制工具函数
 */

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
function calculateActualLines(ctx, text, maxWidth, fontSize, fontFamily = 'Huiwen-mincho, sans-serif') {
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
function wrapText(ctx, text, maxWidth, fontSize, fontFamily = 'Huiwen-mincho, sans-serif') {
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
                if (testWidth > maxWidth && currentLine) {
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

module.exports = {
    drawImageAsync,
    calculateActualLines,
    wrapText,
    preventShortLineBreak,
    drawRoundRect,
    drawMultiLineText,
    loadFont,
    canvasToTempFile
};
