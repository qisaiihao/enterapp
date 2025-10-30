// 测试分享卡片文字计算逻辑
// 模拟Canvas上下文
const mockCtx = {
    font: '',
    measureText: function(text) {
        // 简单模拟中文字符宽度测量
        // 中文字符平均宽度约为字体大小的0.9倍，英文约为0.5倍
        const charCount = Array.from(text).length;
        const chineseCount = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
        const englishCount = charCount - chineseCount;

        // 28px字体，中文约25px，英文约14px
        const width = chineseCount * 25 + englishCount * 14;

        return { width: width };
    }
};

// 模拟我们的计算函数
function calculateActualLines(ctx, text, maxWidth, fontSize) {
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
            console.log(`【文字测量】长行需要拆分为${estimatedLines}行，宽度: ${textWidth}, 最大宽度: ${maxWidth}`);
        }
    });

    console.log(`【文字测量】总计需要${actualLineCount}行，原行数: ${lines.length}`);
    return actualLineCount;
}

// 智能防止短行换行的预处理函数（Canvas版本）
function preventShortLineBreakForCanvas(text) {
    if (!text || typeof text !== 'string') return text;
    
    // 使用正则表达式匹配 "1个或2个字符" + "一个标点符号" 的组合
    const regex = /(.{1,2})([，。；：！？、])/g;
    
    // 在匹配到的字符和标点之间，插入一个零宽度的"单词连接符" (\u2060)
    return text.replace(regex, '$1\u2060$2');
}

// 智能分割单行文字，避免单字换行
function smartWrapLine(ctx, line, maxWidth, fontSize) {
    const lines = [];
    let currentLine = '';
    
    // 按标点符号分割，优先在标点后换行
    const segments = line.split(/([，。；：！？、])/);
    
    for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        if (!segment) continue;
        
        const testLine = currentLine + segment;
        const testWidth = ctx.measureText ? ctx.measureText(testLine).width : testLine.length * fontSize * 0.6;
        
        if (testWidth <= maxWidth) {
            currentLine = testLine;
        } else {
            // 当前行已满，需要换行
            if (currentLine) {
                lines.push(currentLine);
            }
            
            // 如果单个标点符号，直接添加到当前行
            if (/^[，。；：！？、]$/.test(segment)) {
                currentLine = segment;
            } else {
                // 如果是内容段，需要进一步分割
                const subLines = splitLongSegment(ctx, segment, maxWidth, fontSize);
                if (subLines.length > 0) {
                    lines.push(...subLines.slice(0, -1)); // 除了最后一行
                    currentLine = subLines[subLines.length - 1]; // 最后一行作为当前行
                } else {
                    currentLine = segment;
                }
            }
        }
    }
    
    // 添加最后一行
    if (currentLine) {
        lines.push(currentLine);
    }
    
    return lines;
}

// 分割过长的内容段
function splitLongSegment(ctx, segment, maxWidth, fontSize) {
    const lines = [];
    let currentLine = '';
    
    for (let i = 0; i < segment.length; i++) {
        const testLine = currentLine + segment[i];
        const testWidth = ctx.measureText ? ctx.measureText(testLine).width : testLine.length * fontSize * 0.6;
        
        if (testWidth <= maxWidth) {
            currentLine = testLine;
        } else {
            // 当前行已满，开始新行
            if (currentLine) {
                lines.push(currentLine);
            }
            currentLine = segment[i];
        }
    }
    
    // 添加最后一行
    if (currentLine) {
        lines.push(currentLine);
    }
    
    return lines;
}

// 优化后的换行处理函数
function wrapTextForCanvas(ctx, text, maxWidth, fontSize) {
    ctx.font = fontSize + 'px Huiwen-mincho, sans-serif';

    // 先应用中文排版优化
    const optimizedText = preventShortLineBreakForCanvas(text);
    const originalLines = optimizedText.split('\n');
    const wrappedLines = [];

    originalLines.forEach(line => {
        if (!line.trim()) {
            // 保留空行
            wrappedLines.push('');
            return;
        }

        // 测量当前行宽度
        const textWidth = ctx.measureText ? ctx.measureText(line).width : line.length * fontSize * 0.6;

        if (textWidth <= maxWidth) {
            // 不需要换行
            wrappedLines.push(line);
        } else {
            // 需要换行，使用智能分割策略
            const smartLines = smartWrapLine(ctx, line, maxWidth, fontSize);
            wrappedLines.push(...smartLines);
        }
    });

    console.log(`【文字换行】原行数: ${originalLines.length}, 处理后行数: ${wrappedLines.length}`);
    return wrappedLines;
}

// 测试用例
console.log('=== 测试分享卡片文字计算逻辑 ===\n');

const fontSize = 38;
const titleFontSize = 42; // 标题字体稍大
const maxWidth = 520; // 600px - 80px padding
const lineHeight = 48;
const titleLineHeight = 52; // 标题行高

// 测试用例1：短文本
console.log('测试1: 短文本');
const shortText = '春江花月夜\n张若虚\n春江潮水连海平，海上明月共潮生。';
const shortLines = calculateActualLines(mockCtx, shortText, maxWidth, fontSize);
const shortWrapped = wrapTextForCanvas(mockCtx, shortText, maxWidth, fontSize);
console.log(`结果: 原行数=${shortText.split('\n').length}, 计算行数=${shortLines}, 换行后=${shortWrapped.length}\n`);

// 测试用例2：长文本
console.log('测试2: 长文本');
const longText = `春江花月夜
张若虚

春江潮水连海平，海上明月共潮生。
滟滟随波千万里，何处春江无月明！
江流宛转绕芳甸，月照花林皆似霰。
空里流霜不觉飞，汀上白沙看不见。
江天一色无纤尘，皎皎空中孤月轮。
江畔何人初见月？江月何年初照人？
人生代代无穷已，江月年年望相似。
不知江月待何人，但见长江送流水。
白云一片去悠悠，青枫浦上不胜愁。
谁家今夜扁舟子？何处相思明月楼？
可怜楼上月徘徊，应照离人妆镜台。
玉户帘中卷不去，捣衣砧上拂还来。
此时相望不相闻，愿逐月华流照君。
鸿雁长飞光不度，鱼龙潜跃水成文。
昨夜闲潭梦落花，可怜春半不还家。
江水流春去欲尽，江潭落月复西斜。
斜月沉沉藏海雾，碣石潇湘无限路。
不知乘月几人归，落月摇情满江树。`;

const longLines = calculateActualLines(mockCtx, longText, maxWidth, fontSize);
const longWrapped = wrapTextForCanvas(mockCtx, longText, maxWidth, fontSize);
console.log(`结果: 原行数=${longText.split('\n').length}, 计算行数=${longLines}, 换行后=${longWrapped.length}`);

// 计算Canvas高度
const canvasHeight = Math.max(longLines * lineHeight, 200) + 300 + 100; // 内容 + 签名 + 安全边距
console.log(`推荐Canvas高度: ${canvasHeight}px`);