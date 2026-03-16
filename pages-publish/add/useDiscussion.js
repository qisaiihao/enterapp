// pages/add/useDiscussion.js
// 讨论模式相关的状态操作，依赖外部上下文(this)的 setData / checkCanPublish
import { buildDiscussionSentenceGroups } from './addPure.js';

export function addBlock(ctx, afterIndex, type) {
    const next = (ctx.blocks || []).slice();
    const insertPos = afterIndex + 1;
    next.splice(insertPos, 0, { type, text: '' });
    ctx.setData({ blocks: next });
}

export function removeBlock(ctx, idx) {
    const next = (ctx.blocks || []).slice();
    next.splice(idx, 1);
    // 保证至少有一个正文块
    if (!next.some(b => b.type === 'content')) {
        next.unshift({ type: 'content', text: '' });
    }
    ctx.setData({ blocks: next });
    ctx.checkCanPublish && ctx.checkCanPublish();
}

export function moveBlock(ctx, idx, direction) {
    const next = (ctx.blocks || []).slice();
    const target = idx + direction;
    if (target < 0 || target >= next.length) return;
    const [item] = next.splice(idx, 1);
    next.splice(target, 0, item);
    ctx.setData({ blocks: next });
}

export function onQuoteBlockInput(ctx, idx, val) {
    const next = (ctx.blocks || []).slice();
    next[idx] = { ...next[idx], text: val || '' };
    ctx.setData({ blocks: next });
    ctx.checkCanPublish && ctx.checkCanPublish();
}

export function onBlockInput(ctx, idx, val) {
    const next = (ctx.blocks || []).slice();
    next[idx] = { ...next[idx], text: val || '' };
    ctx.setData({ blocks: next });
    // 若这是第一个正文块，同步到 content 供高光等逻辑使用
    const firstContentIndex = next.findIndex(b => b.type === 'content');
    if (firstContentIndex === idx) {
        ctx.setData({ content: val });
    }
    ctx.checkCanPublish && ctx.checkCanPublish();
}

export function onDiscussionQuoteInput(ctx, e) {
    const val = e?.detail?.value || '';
    const idx = (ctx.blocks || []).findIndex(b => b.type === 'quote');
    if (idx === -1) {
        addBlock(ctx, 0, 'quote');
        onQuoteBlockInput(ctx, 1, val); // 新增在正文后
    } else {
        onQuoteBlockInput(ctx, idx, val);
    }
}

export function buildGroups(blocks, content) {
    return buildDiscussionSentenceGroups(blocks, content);
}
