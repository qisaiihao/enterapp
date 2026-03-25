function setCanvasFont(ctx, fontSize) {
    ctx.font = `${fontSize}px "Huiwen-mincho"`;
}

function calculateActualLines(ctx, text, maxWidth, fontSize) {
    setCanvasFont(ctx, fontSize);

    const lines = text.split('\n');
    let actualLineCount = 0;

    lines.forEach((line) => {
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

function wrapText(ctx, text, maxWidth) {
    const lines = text.split('\n');
    const wrappedLines = [];

    lines.forEach((line) => {
        if (!line) {
            wrappedLines.push('');
            return;
        }

        if (ctx.measureText(line).width <= maxWidth) {
            wrappedLines.push(line);
            return;
        }

        const chars = line.split('');
        let currentLine = '';

        for (let i = 0; i < chars.length; i += 1) {
            const testLine = currentLine + chars[i];
            const metrics = ctx.measureText(testLine);

            if (metrics.width > maxWidth && currentLine) {
                wrappedLines.push(currentLine);
                currentLine = chars[i];
            } else {
                currentLine = testLine;
            }
        }

        if (currentLine) {
            wrappedLines.push(currentLine);
        }
    });

    return wrappedLines;
}

function clampText(ctx, text, maxWidth, maxLines) {
    const lines = wrapText(ctx, text, maxWidth);
    if (lines.length <= maxLines) {
        return text;
    }

    const truncatedLines = lines.slice(0, maxLines);
    let result = truncatedLines.join('\n');
    const lastLine = truncatedLines[truncatedLines.length - 1];
    const ellipsis = '...';
    const testLine = lastLine + ellipsis;

    if (ctx.measureText(testLine).width <= maxWidth) {
        result = result.replace(lastLine, testLine);
    } else {
        result = result.replace(lastLine, lastLine.slice(0, -1) + ellipsis);
    }

    return result;
}

module.exports = {
    calculateActualLines,
    wrapText,
    clampText
};
