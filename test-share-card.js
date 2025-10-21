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

// 模拟换行处理函数
function wrapTextForCanvas(ctx, text, maxWidth, fontSize) {
    ctx.font = fontSize + 'px Huiwen-mincho, sans-serif';

    const originalLines = text.split('\n');
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
            // 需要换行，按字符逐步分割
            let currentLine = '';
            for (let i = 0; i < line.length; i++) {
                const testLine = currentLine + line[i];
                const testWidth = ctx.measureText ? ctx.measureText(testLine).width : testLine.length * fontSize * 0.6;

                if (testWidth <= maxWidth) {
                    currentLine = testLine;
                } else {
                    // 当前行已满，开始新行
                    if (currentLine) {
                        wrappedLines.push(currentLine);
                    }
                    currentLine = line[i];
                }
            }

            // 添加最后一行
            if (currentLine) {
                wrappedLines.push(currentLine);
            }
        }
    });

    console.log(`【文字换行】原行数: ${originalLines.length}, 处理后行数: ${wrappedLines.length}`);
    return wrappedLines;
}

// 测试用例
console.log('=== 测试分享卡片文字计算逻辑 ===\n');

const fontSize = 38;
const maxWidth = 520; // 600px - 80px padding
const lineHeight = 48;

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