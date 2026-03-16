// pages/add/useSeries.js
// 组诗相关逻辑，使用 addPure 中的纯函数，保持上下文 this 的 setData / checkCanPublish
import { normalizeSeriesBlocks, seriesBlocksToContent } from './addPure.js';

export function toggleSeriesMode(ctx) {
    if (ctx.publishMode !== 'poem') {
        uni.showToast({ title: '组诗仅支持诗歌模式', icon: 'none' });
        return;
    }
    if (ctx.isSeries) {
        // 关闭组诗，合并内容回主正文
        const merged = seriesBlocksToContent(ctx.seriesBlocks);
        ctx.setData({
            isSeries: false,
            content: merged
        });
    } else {
        // 开启组诗，用现有正文初始化第一段
        const initialBlocks = (ctx.seriesBlocks && ctx.seriesBlocks.length > 0)
            ? ctx.seriesBlocks
            : [{
                id: `series-${Date.now()}`,
                subtitle: '',
                content: ctx.content || '',
                highlightSentence: '',
                highlightLines: []
            }];
        ctx.setData({
            isSeries: true,
            seriesBlocks: initialBlocks,
            content: ''
        });
        syncSeriesBlocks(ctx, initialBlocks);
    }
    ctx.checkCanPublish && ctx.checkCanPublish();
}

export function syncSeriesBlocks(ctx, blocks, manualSeriesHighlights = null) {
    const manual = manualSeriesHighlights ?? ctx.highlightLines;
    const { blocks: normalized, highlightLines, highlightSentence } = normalizeSeriesBlocks(
        blocks,
        manual,
        ctx.isSeries
    );
    ctx.setData({
        seriesBlocks: normalized,
        highlightLines: ctx.isSeries ? highlightLines : ctx.highlightLines,
        highlightSentence: ctx.isSeries ? (highlightSentence || '') : ctx.highlightSentence
    });
    ctx.checkCanPublish && ctx.checkCanPublish();
}

export function addSeriesBlock(ctx, afterIndex = -1) {
    if ((ctx.seriesBlocks || []).length >= ctx.maxSeriesBlocks) {
        uni.showToast({ title: '已达到段落上限', icon: 'none' });
        return;
    }
    const next = (ctx.seriesBlocks || []).slice();
    const insertPos = Math.max(0, afterIndex + 1);
    next.splice(insertPos, 0, {
        id: `series-${Date.now()}-${Math.random()}`,
        subtitle: '',
        content: '',
        highlightSentence: '',
        highlightLines: []
    });
    syncSeriesBlocks(ctx, next);
}

export function removeSeriesBlock(ctx, idx) {
    const next = (ctx.seriesBlocks || []).slice();
    if (next.length <= 1) {
        uni.showToast({ title: '至少保留一个段落', icon: 'none' });
        return;
    }
    next.splice(idx, 1);
    syncSeriesBlocks(ctx, next);
}

export function moveSeriesBlock(ctx, idx, direction) {
    const next = (ctx.seriesBlocks || []).slice();
    const target = idx + direction;
    if (target < 0 || target >= next.length) return;
    const [item] = next.splice(idx, 1);
    next.splice(target, 0, item);
    syncSeriesBlocks(ctx, next);
}

export function onSeriesSubtitleInput(ctx, idx, val) {
    const next = (ctx.seriesBlocks || []).slice();
    next[idx] = { ...next[idx], subtitle: val || '' };
    syncSeriesBlocks(ctx, next);
}

export function onSeriesContentInput(ctx, idx, val) {
    const next = (ctx.seriesBlocks || []).slice();
    next[idx] = { ...next[idx], content: val || '' };
    syncSeriesBlocks(ctx, next);
}
