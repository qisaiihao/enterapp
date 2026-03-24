// pages/add/useDiscussion.js
// 讨论模式相关状态操作，依赖外部 ctx.setData / ctx.checkCanPublish
import { buildDiscussionSentenceGroups } from './addPure.js';

function scheduleDraftSave(ctx) {
    ctx.scheduleWorkingDraftSave && ctx.scheduleWorkingDraftSave();
}

export function addBlock(ctx, afterIndex, type) {
    const next = (ctx.blocks || []).slice();
    const insertPos = afterIndex + 1;
    next.splice(insertPos, 0, { type, text: '' });
    ctx.setData({ blocks: next });
    ctx.checkCanPublish && ctx.checkCanPublish();
    scheduleDraftSave(ctx);
}

export function removeBlock(ctx, idx) {
    const next = (ctx.blocks || []).slice();
    next.splice(idx, 1);
    if (!next.some(block => block.type === 'content')) {
        next.unshift({ type: 'content', text: '' });
    }
    ctx.setData({ blocks: next });
    ctx.checkCanPublish && ctx.checkCanPublish();
    scheduleDraftSave(ctx);
}

export function moveBlock(ctx, idx, direction) {
    const next = (ctx.blocks || []).slice();
    const target = idx + direction;
    if (target < 0 || target >= next.length) return;
    const [item] = next.splice(idx, 1);
    next.splice(target, 0, item);
    ctx.setData({ blocks: next });
    ctx.checkCanPublish && ctx.checkCanPublish();
    scheduleDraftSave(ctx);
}

export function onQuoteBlockInput(ctx, idx, val) {
    const next = (ctx.blocks || []).slice();
    next[idx] = { ...next[idx], text: val || '' };
    ctx.setData({ blocks: next });
    ctx.checkCanPublish && ctx.checkCanPublish();
    scheduleDraftSave(ctx);
}

export function onBlockInput(ctx, idx, val) {
    const next = (ctx.blocks || []).slice();
    next[idx] = { ...next[idx], text: val || '' };
    ctx.setData({ blocks: next });
    const firstContentIndex = next.findIndex(block => block.type === 'content');
    if (firstContentIndex === idx) {
        ctx.setData({ content: val });
    }
    ctx.checkCanPublish && ctx.checkCanPublish();
    scheduleDraftSave(ctx);
}

export function onDiscussionQuoteInput(ctx, e) {
    const val = e?.detail?.value || '';
    const idx = (ctx.blocks || []).findIndex(block => block.type === 'quote');
    if (idx === -1) {
        addBlock(ctx, 0, 'quote');
        onQuoteBlockInput(ctx, 1, val);
        return;
    }
    onQuoteBlockInput(ctx, idx, val);
}

export function buildGroups(blocks, content) {
    return buildDiscussionSentenceGroups(blocks, content);
}
