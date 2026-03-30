const shareCanvasModule = require('./shareCanvas.js');
const fontManagerModule = require('./fontManager.js');

const {
    wrapText,
    drawRoundedRect,
    exportShareCanvas,
    drawCornerWatermark
} = shareCanvasModule || {};

const fontManager = fontManagerModule && fontManagerModule.default
    ? fontManagerModule.default
    : fontManagerModule;

const CANVAS_WIDTH = 750;
const MAX_PAGE_HEIGHT = 6000;
const MIN_PAGE_HEIGHT = 1200;
const PAGE_RADIUS = 18;
const PAGE_PADDING_X = 56;
const PAGE_PADDING_BOTTOM = 96;
const FIRST_PAGE_HEADER_HEIGHT = 320;
const FOLLOW_PAGE_HEADER_HEIGHT = 176;
const CONTENT_TOP_GAP = 24;
const TIMELINE_LINE_X = 92;
const CONTENT_X = 132;
const TIMELINE_MARKER_SIZE = 16;
const MONTH_BLOCK_HEIGHT = 74;
const POST_BLOCK_GAP = 32;

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function setFillStyle(ctx, value) {
    if (!ctx) return;
    if (typeof ctx.setFillStyle === 'function') {
        ctx.setFillStyle(value);
        return;
    }
    ctx.fillStyle = value;
}

function setStrokeStyle(ctx, value) {
    if (!ctx) return;
    if (typeof ctx.setStrokeStyle === 'function') {
        ctx.setStrokeStyle(value);
        return;
    }
    ctx.strokeStyle = value;
}

function setLineWidth(ctx, value) {
    if (!ctx) return;
    if (typeof ctx.setLineWidth === 'function') {
        ctx.setLineWidth(value);
        return;
    }
    ctx.lineWidth = value;
}

function setTextAlign(ctx, value) {
    if (!ctx) return;
    if (typeof ctx.setTextAlign === 'function') {
        ctx.setTextAlign(value);
        return;
    }
    ctx.textAlign = value;
}

function quoteFontFamily(fontFamily) {
    if (!fontFamily) return 'sans-serif';
    return `"${String(fontFamily).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function resolveCanvasFontFamily(fontFamily) {
    if (!fontFamily || fontFamily === 'system') {
        return 'sans-serif';
    }

    if (fontManager && typeof fontManager.getRuntimeFontFamily === 'function') {
        const runtimeFamily = fontManager.getRuntimeFontFamily(fontFamily);
        if (runtimeFamily) {
            return quoteFontFamily(runtimeFamily);
        }
    }

    return quoteFontFamily(fontFamily);
}

function ensureArray(value) {
    return Array.isArray(value) ? value : [];
}

function normalizeText(value) {
    return String(value || '')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .trim();
}

function formatAbsoluteDate(dateValue, fallback = '') {
    if (!dateValue) return fallback;

    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return fallback;

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}.${month}.${day}`;
}

function formatMonthLabel(monthKey) {
    if (!monthKey || typeof monthKey !== 'string') return '';
    const parts = monthKey.split('-');
    if (parts.length < 2) return monthKey;
    const year = parts[0];
    const month = String(parseInt(parts[1], 10) || parts[1]);
    return `${year}年${month}月`;
}

function formatDateLabel(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return '';
    const parts = dateStr.split('-');
    if (parts.length < 3) return dateStr;
    return `${parts[1]}.${parts[2]}`;
}

function clampLines(lines, maxLines) {
    const safeLines = ensureArray(lines).filter((line) => typeof line === 'string');
    if (!maxLines || safeLines.length <= maxLines) {
        return safeLines;
    }

    const nextLines = safeLines.slice(0, maxLines);
    const lastIndex = nextLines.length - 1;
    nextLines[lastIndex] = `${String(nextLines[lastIndex] || '').replace(/[，。！？；、,.!?;:…\s]+$/g, '')}…`;
    return nextLines;
}

function getTimelineExcerpt(post = {}) {
    const directContent = normalizeText(post.content);
    if (directContent) return directContent;

    const seriesBlocks = ensureArray(post.seriesBlocks);
    for (let index = 0; index < seriesBlocks.length; index += 1) {
        const block = seriesBlocks[index] || {};
        const content = normalizeText(block.content);
        if (content) {
            return content;
        }
    }

    return '';
}

function buildPreparedPosts(posts = []) {
    const sortedPosts = ensureArray(posts)
        .filter((post) => post && post.createTime)
        .slice()
        .sort((a, b) => {
            const timeA = new Date(a.createTime).getTime();
            const timeB = new Date(b.createTime).getTime();
            return timeB - timeA;
        });

    let lastDate = '';
    return sortedPosts.map((post) => {
        const createdAt = new Date(post.createTime);
        const year = createdAt.getFullYear();
        const month = String(createdAt.getMonth() + 1).padStart(2, '0');
        const day = String(createdAt.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        const showDate = dateStr !== lastDate;
        lastDate = dateStr;

        return {
            ...post,
            dateStr,
            showDate,
            monthKey: `${year}-${month}`,
            excerpt: getTimelineExcerpt(post)
        };
    });
}

function buildSummary(posts = [], userInfo = {}) {
    const safePosts = buildPreparedPosts(posts);
    const firstPost = safePosts[0] || null;
    const lastPost = safePosts[safePosts.length - 1] || null;
    const postCount = safePosts.length;

    return {
        title: '创作时间轴',
        nickName: userInfo && userInfo.nickName ? userInfo.nickName : '我的时间轴',
        avatarUrl: userInfo && userInfo.avatarUrl ? userInfo.avatarUrl : '',
        postCount,
        dateRangeText: postCount > 0
            ? `${formatAbsoluteDate(lastPost && lastPost.createTime)} — ${formatAbsoluteDate(firstPost && firstPost.createTime)}`
            : '暂无创作记录'
    };
}

function createMeasureContext(canvasRuntime, logicalWidth = CANVAS_WIDTH) {
    if (canvasRuntime && typeof canvasRuntime.createMeasureContext === 'function') {
        return canvasRuntime.createMeasureContext(logicalWidth);
    }

    if (canvasRuntime && canvasRuntime.canvasId && canvasRuntime.context) {
        return uni.createCanvasContext(canvasRuntime.canvasId, canvasRuntime.context);
    }

    return null;
}

function normalizeShareConfig(shareConfig = {}) {
    const baseFontSize = Number(shareConfig.fontSize || 38);
    const fontScale = Number(shareConfig.fontScale || 1);
    const fontSize = Math.round(baseFontSize * fontScale);
    const titleFontSize = Math.round((Number(shareConfig.titleFontSize || Math.round(baseFontSize * 1.21))) * fontScale);
    const fontFamily = shareConfig.fontFamily || '汇文明朝';
    const canvasFontFamily = resolveCanvasFontFamily(fontFamily);
    const textColor = shareConfig.textColor || '#000000';
    const backgroundColor = shareConfig.backgroundColor || '#FFFFFF';

    return {
        ...shareConfig,
        fontSize,
        titleFontSize,
        fontFamily,
        canvasFontFamily,
        textColor,
        backgroundColor,
        monthFontSize: Math.max(28, Math.round(fontSize * 0.92)),
        metaFontSize: Math.max(24, Math.round(fontSize * 0.66)),
        excerptFontSize: Math.max(26, Math.round(fontSize * 0.84)),
        statFontSize: Math.max(24, Math.round(fontSize * 0.76))
    };
}

function measurePostBlock(measureCtx, post, config) {
    const titleWidth = CANVAS_WIDTH - CONTENT_X - PAGE_PADDING_X;
    const titleLineHeight = Math.round(config.fontSize * 1.34);
    const excerptLineHeight = Math.round(config.excerptFontSize * 1.45);
    const dateLineHeight = Math.round(config.metaFontSize * 1.28);

    if (measureCtx) {
        measureCtx.font = `${config.fontSize}px ${config.canvasFontFamily}`;
    }
    const titleLines = wrapText(
        measureCtx,
        normalizeText(post.title) || '未命名作品',
        titleWidth,
        config.fontSize,
        config.canvasFontFamily
    );

    if (measureCtx) {
        measureCtx.font = `${config.excerptFontSize}px ${config.canvasFontFamily}`;
    }
    const excerptLines = clampLines(
        wrapText(
            measureCtx,
            normalizeText(post.excerpt),
            titleWidth,
            config.excerptFontSize,
            config.canvasFontFamily
        ),
        2
    );

    let height = 24;
    if (post.showDate) {
        height += dateLineHeight + 10;
    }
    height += Math.max(titleLineHeight, titleLines.length * titleLineHeight);
    if (excerptLines.length > 0) {
        height += 14 + (excerptLines.length * excerptLineHeight);
    }
    height += 26 + POST_BLOCK_GAP;

    return {
        titleLines,
        excerptLines,
        titleLineHeight,
        excerptLineHeight,
        dateLineHeight,
        height
    };
}

function createPage(type, summary) {
    const headerHeight = type === 'summary' ? FIRST_PAGE_HEADER_HEIGHT : FOLLOW_PAGE_HEADER_HEIGHT;
    return {
        type,
        headerHeight,
        summary,
        blocks: [],
        usedHeight: headerHeight + CONTENT_TOP_GAP,
        height: headerHeight + PAGE_PADDING_BOTTOM
    };
}

function buildPaginatedPages(posts, userInfo, shareConfig, measureCtx) {
    const preparedPosts = buildPreparedPosts(posts);
    const summary = buildSummary(preparedPosts, userInfo);
    const config = normalizeShareConfig(shareConfig);

    if (!preparedPosts.length) {
        const emptyPage = createPage('summary', summary);
        emptyPage.height = Math.max(MIN_PAGE_HEIGHT, emptyPage.usedHeight + 240);
        return {
            pages: [emptyPage],
            summary,
            config
        };
    }

    const groupedPosts = preparedPosts.reduce((acc, post) => {
        if (!acc[post.monthKey]) {
            acc[post.monthKey] = [];
        }
        acc[post.monthKey].push(post);
        return acc;
    }, {});

    const monthKeys = Object.keys(groupedPosts).sort((a, b) => (a < b ? 1 : -1));
    const pages = [createPage('summary', summary)];
    let currentPage = pages[0];

    monthKeys.forEach((monthKey) => {
        const monthLabel = formatMonthLabel(monthKey);
        let monthInsertedOnCurrentPage = false;
        const monthPosts = groupedPosts[monthKey] || [];

        monthPosts.forEach((post) => {
            const postMetrics = measurePostBlock(measureCtx, post, config);
            const monthHeight = monthInsertedOnCurrentPage ? 0 : MONTH_BLOCK_HEIGHT;
            const nextHeight = currentPage.usedHeight + monthHeight + postMetrics.height + PAGE_PADDING_BOTTOM;

            if (nextHeight > MAX_PAGE_HEIGHT && currentPage.blocks.length > 0) {
                currentPage.height = Math.max(MIN_PAGE_HEIGHT, Math.min(MAX_PAGE_HEIGHT, currentPage.usedHeight + PAGE_PADDING_BOTTOM));
                currentPage = createPage('continuation', summary);
                pages.push(currentPage);
                monthInsertedOnCurrentPage = false;
            }

            if (!monthInsertedOnCurrentPage) {
                currentPage.blocks.push({
                    type: 'month',
                    monthKey,
                    label: monthLabel,
                    continued: currentPage.type === 'continuation'
                });
                currentPage.usedHeight += MONTH_BLOCK_HEIGHT;
                monthInsertedOnCurrentPage = true;
            }

            currentPage.blocks.push({
                type: 'post',
                monthKey,
                post,
                metrics: postMetrics
            });
            currentPage.usedHeight += postMetrics.height;
        });
    });

    pages.forEach((page) => {
        page.height = Math.max(MIN_PAGE_HEIGHT, Math.min(MAX_PAGE_HEIGHT, Math.ceil(page.usedHeight + PAGE_PADDING_BOTTOM)));
    });

    return {
        pages,
        summary,
        config
    };
}

function getInitialLetter(nickName = '') {
    const safeName = String(nickName || '').trim();
    return safeName ? safeName.charAt(0).toUpperCase() : '我';
}

function drawPlaceholderAvatar(ctx, x, y, size, summary, config) {
    setFillStyle(ctx, 'rgba(0, 0, 0, 0.08)');
    drawRoundedRect(ctx, x, y, size, size, Math.round(size / 2));
    ctx.fill();

    ctx.font = `${Math.round(size * 0.36)}px ${config.canvasFontFamily}`;
    setTextAlign(ctx, 'center');
    setFillStyle(ctx, config.textColor);
    ctx.fillText(getInitialLetter(summary.nickName), x + (size / 2), y + Math.round(size * 0.62));
    setTextAlign(ctx, 'left');
}

function getImageInfoSafe(src) {
    return new Promise((resolve) => {
        if (!src) {
            resolve(null);
            return;
        }
        uni.getImageInfo({
            src,
            success: (res) => resolve(res || null),
            fail: () => resolve(null)
        });
    });
}

async function drawCoverImage(ctx, src, x, y, width, height, radius) {
    const info = await getImageInfoSafe(src);
    if (!info) return false;

    const drawPath = info.path || info.tempFilePath || src;
    const sourceWidth = info.width || width;
    const sourceHeight = info.height || height;
    const targetRatio = width / height;
    const sourceRatio = sourceWidth / sourceHeight;

    let sx = 0;
    let sy = 0;
    let sw = sourceWidth;
    let sh = sourceHeight;

    if (sourceRatio > targetRatio) {
        sw = sourceHeight * targetRatio;
        sx = Math.max(0, Math.round((sourceWidth - sw) / 2));
    } else if (sourceRatio < targetRatio) {
        sh = sourceWidth / targetRatio;
        sy = Math.max(0, Math.round((sourceHeight - sh) / 2));
    }

    if (typeof ctx.save === 'function' && typeof ctx.clip === 'function') {
        ctx.save();
        drawRoundedRect(ctx, x, y, width, height, radius);
        ctx.clip();
        ctx.drawImage(drawPath, sx, sy, sw, sh, x, y, width, height);
        ctx.restore();
        return true;
    }

    ctx.drawImage(drawPath, sx, sy, sw, sh, x, y, width, height);
    return true;
}

async function drawSummaryHeader(ctx, page, summary, config, pageNumber, totalPages) {
    const avatarSize = 92;
    const avatarX = PAGE_PADDING_X;
    const avatarY = 72;
    const pageTag = pageNumber > 1 ? `第 ${pageNumber}/${totalPages} 页` : '';

    const avatarDrawn = await drawCoverImage(ctx, summary.avatarUrl, avatarX, avatarY, avatarSize, avatarSize, Math.round(avatarSize / 2));
    if (!avatarDrawn) {
        drawPlaceholderAvatar(ctx, avatarX, avatarY, avatarSize, summary, config);
    }

    setTextAlign(ctx, 'left');
    setFillStyle(ctx, config.textColor);

    ctx.font = `${Math.max(30, Math.round(config.statFontSize * 1.1))}px ${config.canvasFontFamily}`;
    ctx.fillText(summary.nickName || '我的时间轴', avatarX + avatarSize + 28, avatarY + 36);

    ctx.font = `${config.titleFontSize}px ${config.canvasFontFamily}`;
    ctx.fillText(summary.title, avatarX + avatarSize + 28, avatarY + 92);

    ctx.font = `${config.statFontSize}px ${config.canvasFontFamily}`;
    ctx.fillText(`共 ${summary.postCount} 首作品`, PAGE_PADDING_X, avatarY + avatarSize + 58);
    ctx.fillText(`创作跨度  ${summary.dateRangeText}`, PAGE_PADDING_X, avatarY + avatarSize + 102);

    if (pageTag) {
        setTextAlign(ctx, 'right');
        ctx.font = `${config.metaFontSize}px ${config.canvasFontFamily}`;
        setFillStyle(ctx, 'rgba(0, 0, 0, 0.54)');
        ctx.fillText(pageTag, CANVAS_WIDTH - PAGE_PADDING_X, avatarY + 30);
        setTextAlign(ctx, 'left');
        setFillStyle(ctx, config.textColor);
    }

    setStrokeStyle(ctx, 'rgba(0, 0, 0, 0.12)');
    setLineWidth(ctx, 2);
    ctx.beginPath();
    ctx.moveTo(PAGE_PADDING_X, page.headerHeight - 24);
    ctx.lineTo(CANVAS_WIDTH - PAGE_PADDING_X, page.headerHeight - 24);
    ctx.stroke();
}

function drawContinuationHeader(ctx, page, summary, config, pageNumber, totalPages) {
    setTextAlign(ctx, 'left');
    setFillStyle(ctx, config.textColor);

    ctx.font = `${Math.max(30, Math.round(config.statFontSize * 1.06))}px ${config.canvasFontFamily}`;
    ctx.fillText(summary.nickName || '我的时间轴', PAGE_PADDING_X, 80);

    ctx.font = `${Math.max(42, Math.round(config.titleFontSize * 0.82))}px ${config.canvasFontFamily}`;
    ctx.fillText(`${summary.title}（续）`, PAGE_PADDING_X, 138);

    setTextAlign(ctx, 'right');
    ctx.font = `${config.metaFontSize}px ${config.canvasFontFamily}`;
    setFillStyle(ctx, 'rgba(0, 0, 0, 0.54)');
    ctx.fillText(`第 ${pageNumber}/${totalPages} 页`, CANVAS_WIDTH - PAGE_PADDING_X, 80);
    setTextAlign(ctx, 'left');

    setStrokeStyle(ctx, 'rgba(0, 0, 0, 0.12)');
    setLineWidth(ctx, 2);
    ctx.beginPath();
    ctx.moveTo(PAGE_PADDING_X, page.headerHeight - 28);
    ctx.lineTo(CANVAS_WIDTH - PAGE_PADDING_X, page.headerHeight - 28);
    ctx.stroke();
}

function drawTimelineTrack(ctx, headerHeight, pageHeight) {
    setStrokeStyle(ctx, 'rgba(0, 0, 0, 0.12)');
    setLineWidth(ctx, 4);
    ctx.beginPath();
    ctx.moveTo(TIMELINE_LINE_X, headerHeight + 6);
    ctx.lineTo(TIMELINE_LINE_X, pageHeight - PAGE_PADDING_BOTTOM + 24);
    ctx.stroke();
}

function drawTimelineMarker(ctx, x, y, size, color) {
    setFillStyle(ctx, color);
    drawRoundedRect(ctx, x - (size / 2), y - (size / 2), size, size, Math.round(size / 2));
    ctx.fill();
}

function drawPageBlocks(ctx, page, config) {
    if (!page.blocks.length) {
        ctx.font = `${config.fontSize}px ${config.canvasFontFamily}`;
        setFillStyle(ctx, 'rgba(0, 0, 0, 0.52)');
        setTextAlign(ctx, 'center');
        ctx.fillText('还没有可导出的时间轴内容', CANVAS_WIDTH / 2, page.headerHeight + 140);
        setTextAlign(ctx, 'left');
        return;
    }

    drawTimelineTrack(ctx, page.headerHeight, page.height);

    let currentY = page.headerHeight + CONTENT_TOP_GAP;

    page.blocks.forEach((block) => {
        if (block.type === 'month') {
            const markerY = currentY + 18;
            drawTimelineMarker(ctx, TIMELINE_LINE_X, markerY, TIMELINE_MARKER_SIZE, 'rgba(111, 128, 101, 0.96)');
            ctx.font = `${config.monthFontSize}px ${config.canvasFontFamily}`;
            setFillStyle(ctx, 'rgba(17, 17, 17, 0.92)');
            setTextAlign(ctx, 'left');
            ctx.fillText(block.label, CONTENT_X, currentY + 26);
            currentY += MONTH_BLOCK_HEIGHT;
            return;
        }

        const post = block.post || {};
        const metrics = block.metrics || {};
        const markerY = currentY + 18;
        drawTimelineMarker(ctx, TIMELINE_LINE_X, markerY, 10, 'rgba(17, 17, 17, 0.28)');

        let textY = currentY + 8;
        if (post.showDate) {
            ctx.font = `${config.metaFontSize}px ${config.canvasFontFamily}`;
            setFillStyle(ctx, 'rgba(0, 0, 0, 0.56)');
            ctx.fillText(formatDateLabel(post.dateStr), CONTENT_X, textY + metrics.dateLineHeight);
            textY += metrics.dateLineHeight + 10;
        }

        ctx.font = `${config.fontSize}px ${config.canvasFontFamily}`;
        setFillStyle(ctx, config.textColor);
        ensureArray(metrics.titleLines).forEach((line) => {
            if (!line || !line.trim()) return;
            ctx.fillText(line, CONTENT_X, textY + metrics.titleLineHeight);
            textY += metrics.titleLineHeight;
        });

        const excerptLines = ensureArray(metrics.excerptLines);
        if (excerptLines.length > 0) {
            textY += 14;
            ctx.font = `${config.excerptFontSize}px ${config.canvasFontFamily}`;
            setFillStyle(ctx, 'rgba(0, 0, 0, 0.70)');
            excerptLines.forEach((line) => {
                if (!line || !line.trim()) return;
                ctx.fillText(line, CONTENT_X, textY + metrics.excerptLineHeight);
                textY += metrics.excerptLineHeight;
            });
        }

        setStrokeStyle(ctx, 'rgba(0, 0, 0, 0.10)');
        setLineWidth(ctx, 1);
        ctx.beginPath();
        ctx.moveTo(CONTENT_X, currentY + metrics.height - POST_BLOCK_GAP + 4);
        ctx.lineTo(CANVAS_WIDTH - PAGE_PADDING_X, currentY + metrics.height - POST_BLOCK_GAP + 4);
        ctx.stroke();

        currentY += metrics.height;
    });
}

async function renderPageToImage({ page, summary, config, canvasRuntime, pageNumber, totalPages }) {
    const canvasId = (canvasRuntime && canvasRuntime.canvasId) || 'timelineShareCanvas';
    const context = canvasRuntime && canvasRuntime.context;

    if (!context) {
        throw new Error('timeline share context is required');
    }

    if (canvasRuntime && typeof canvasRuntime.setCanvasHeight === 'function') {
        await canvasRuntime.setCanvasHeight(page.height);
    }

    let runtime = null;
    if (canvasRuntime && typeof canvasRuntime.ensureCanvasRuntime === 'function') {
        runtime = await canvasRuntime.ensureCanvasRuntime(CANVAS_WIDTH, page.height);
    }

    const ctx = runtime && runtime.ctx
        ? runtime.ctx
        : uni.createCanvasContext(canvasId, context);

    if (!ctx) {
        throw new Error('timeline share canvas context unavailable');
    }

    ctx.clearRect(0, 0, CANVAS_WIDTH, page.height);
    setFillStyle(ctx, config.backgroundColor);
    drawRoundedRect(ctx, 0, 0, CANVAS_WIDTH, page.height, PAGE_RADIUS);
    ctx.fill();

    if (page.type === 'summary') {
        await drawSummaryHeader(ctx, page, summary, config, pageNumber, totalPages);
    } else {
        drawContinuationHeader(ctx, page, summary, config, pageNumber, totalPages);
    }

    drawPageBlocks(ctx, page, config);
    try {
        drawCornerWatermark(ctx, CANVAS_WIDTH, page.height);
    } catch (error) {
        console.warn('[timelineShareCanvas] draw watermark failed', error);
    }

    if (runtime && runtime.canvas) {
        await sleep(60);
        const exportResult = await exportShareCanvas({
            canvasId,
            context,
            canvas: runtime.canvas,
            width: runtime.canvas.width,
            height: runtime.canvas.height,
            fileType: 'jpg',
            quality: 0.92,
            scales: [1],
            retryDelayMs: 60
        });
        return (exportResult && exportResult.tempFilePath) || '';
    }

    await new Promise((resolve) => ctx.draw(false, resolve));
    await sleep(120);
    const exportResult = await exportShareCanvas({
        canvasId,
        context,
        width: CANVAS_WIDTH,
        height: page.height,
        fileType: 'jpg',
        quality: 0.92,
        scales: [2, 1.5, 1],
        retryDelayMs: 120
    });
    return (exportResult && exportResult.tempFilePath) || '';
}

function normalizeExportedImageUrl(rawPath = '') {
    if (!rawPath) return '';

    // #ifdef H5
    if (!rawPath.startsWith('data:') && !/^blob:/i.test(rawPath)) {
        const cacheBuster = Date.now();
        return `${rawPath}${rawPath.indexOf('?') > -1 ? '&' : '?'}_=${cacheBuster}`;
    }
    // #endif

    return rawPath;
}

async function generateTimelineShareImages(options = {}) {
    const {
        posts = [],
        userInfo = {},
        shareConfig = {},
        canvasRuntime = {}
    } = options;

    const measureCtx = createMeasureContext(canvasRuntime, CANVAS_WIDTH);
    const { pages, summary, config } = buildPaginatedPages(posts, userInfo, shareConfig, measureCtx);
    const totalPages = pages.length;
    const images = [];

    for (let index = 0; index < pages.length; index += 1) {
        const page = pages[index];
        const pageNumber = index + 1;
        const filePath = await renderPageToImage({
            page,
            summary,
            config,
            canvasRuntime,
            pageNumber,
            totalPages
        });

        images.push({
            imageUrl: normalizeExportedImageUrl(filePath),
            filePath,
            pageNumber,
            totalPages
        });
    }

    return images;
}

module.exports = {
    generateTimelineShareImages
};
