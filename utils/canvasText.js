/**
 * Canvas文本处理工具函数
 */

/**
 * 精确计算文字在Canvas中的实际渲染行数
 * @param {Object} ctx - Canvas上下文
 * @param {string} text - 要计算的文本
 * @param {number} maxWidth - 最大宽度
 * @param {number} fontSize - 字体大小
 * @returns {number} 实际需要的行数
 */
function calculateActualLines(ctx, text, maxWidth, fontSize) {
    // 设置字体
    ctx.font = fontSize + 'px Huiwen-mincho, sans-serif';

    const lines = text.split('\n');
    let actualLineCount = 0;

    lines.forEach(line => {
        if (!line.trim()) {
            actualLineCount += 0.5; // 空行占一半高度
            return;
        }

        // 测量文字宽度
        const textWidth = ctx.measureText ? ctx.measureText(line).width : line.length * fontSize * 0.6;

        // 计算需要多少行
        if (textWidth <= maxWidth) {
            actualLineCount += 1;
        } else {
            // 长文本需要换行，精确计算需要的行数
            const estimatedLines = Math.ceil(textWidth / maxWidth);
            actualLineCount += estimatedLines;
        }
    });

    return actualLineCount;
}

/**
 * 智能处理文字换行，将长文本按宽度分割成适合的行
 * @param {Object} ctx - Canvas上下文
 * @param {string} text - 要分割的文本
 * @param {number} maxWidth - 最大宽度
 * @returns {Array} 分割后的文本行数组
 */
function wrapText(ctx, text, maxWidth) {
    const lines = text.split('\n');
    const wrappedLines = [];

    lines.forEach(line => {
        if (!line) {
            wrappedLines.push('');
            return;
        }

        if (ctx.measureText(line).width <= maxWidth) {
            wrappedLines.push(line);
        } else {
            // 长文本需要分割
            const words = line.split('');
            let currentLine = '';

            for (let i = 0; i < words.length; i++) {
                const testLine = currentLine + words[i];
                const metrics = ctx.measureText(testLine);

                if (metrics.width > maxWidth && currentLine) {
                    wrappedLines.push(currentLine);
                    currentLine = words[i];
                } else {
                    currentLine = testLine;
                }
            }

            if (currentLine) {
                wrappedLines.push(currentLine);
            }
        }
    });

    return wrappedLines;
}

/**
 * 智能截断文本，超出指定行数的部分用省略号表示
 * @param {Object} ctx - Canvas上下文
 * @param {string} text - 要处理的文本
 * @param {number} maxWidth - 最大宽度
 * @param {number} maxLines - 最大行数
 * @returns {string} 处理后的文本
 */
function clampText(ctx, text, maxWidth, maxLines) {
    const lines = wrapText(ctx, text, maxWidth);

    if (lines.length <= maxLines) {
        return text;
    }

    // 截取指定行数并添加省略号
    const truncatedLines = lines.slice(0, maxLines);
    let result = truncatedLines.join('\n');

    // 如果最后一行还有空间，添加省略号
    const lastLine = truncatedLines[truncatedLines.length - 1];
    const ellipsis = '...';
    const testLine = lastLine + ellipsis;

    if (ctx.measureText(testLine).width <= maxWidth) {
        result = result.replace(lastLine, testLine);
    } else {
        // 如果没有空间，替换最后一行的最后一个字符
        const truncatedLastLine = lastLine.slice(0, -1) + ellipsis;
        result = result.replace(lastLine, truncatedLastLine);
    }

    return result;
}

module.exports = {
    calculateActualLines,
    wrapText,
    clampText
};