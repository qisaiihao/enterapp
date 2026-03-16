// pages/add/addPure.js
// 把与界面无关的纯函数集中到这里，便于复用与单测

/**
 * 计算不同模式下的 placeholder 文案
 */
export function computePlaceholder(publishMode = 'normal', isOriginal = false) {
    if (publishMode === 'normal') {
        return '此刻你想要分享...\n分享诗歌请在右边切换发布模式';
    }
    if (publishMode === 'poem' && isOriginal) {
        return '在这里写下你的原创诗歌~';
    }
    if (publishMode === 'poem' && !isOriginal) {
        return '在这里分享你喜欢的诗歌~';
    }
    if (publishMode === 'discussion') {
        return '在这里说说你想要讨论的吧~';
    }
    return '此刻你想要分享...';
}

/**
 * 是否存在正文/块/组诗文本内容（不包含图片）
 */
export function hasAnyContent({ content = '', blocks = [], seriesBlocks = [] } = {}) {
    const mainContent = (content || '').trim();
    if (mainContent) return true;

    if (Array.isArray(blocks) && blocks.some(b => (b.text || '').trim())) {
        return true;
    }

    if (Array.isArray(seriesBlocks) && seriesBlocks.some(b => ((b.content || b.subtitle || '').trim()))) {
        return true;
    }

    return false;
}

/**
 * 讨论模式：根据正文/引用块生成句子组
 */
export function buildDiscussionSentenceGroups(blocks = [], fallbackContent = '') {
    const orderedBlocks = Array.isArray(blocks) ? blocks : [];
    const groups = [];

    orderedBlocks.forEach((block) => {
        if (block.type === 'content') {
            const comment = (block.text || '').trim();
            if (comment) {
                groups.push({
                    sentences: [],
                    comment
                });
            }
        } else if (block.type === 'quote') {
            const sentences = (block.text || '')
                .split(/\r?\n/)
                .map(line => line.trim())
                .filter(Boolean);
            if (sentences.length) {
                groups.push({
                    sentences,
                    comment: ''
                });
            }
        }
    });

    if (!groups.length) {
        const fallback = (fallbackContent || '').trim();
        if (fallback) {
            groups.push({
                sentences: [],
                comment: fallback
            });
        }
    }

    return groups;
}

/**
 * 讨论模式：把引用句子与正文合并成最终正文
 */
export function mergeDiscussionContent(groups = [], content = '') {
    const quote = groups.length > 0
        ? groups.map(g => (g.sentences || []).join('\n')).filter(Boolean).join('\n')
        : '';

    if (quote && content) return `${quote}\n\n${content}`;
    if (quote) return quote;
    return content || '';
}

/**
 * 组诗：标准化段落并推导高光
 */
export function normalizeSeriesBlocks(blocks = [], manualSeriesHighlights = null, isSeriesMode = true) {
    const normalized = (blocks || []).map((b, order) => {
        const content = (b.content || '').trim();
        const subtitle = (b.subtitle || '').trim();
        const highlight =
            (b.highlightSentence && b.highlightSentence.trim()) ||
            (content.split(/\r?\n/).find(l => l && l.trim()) || '');
        const highlightLines =
            (Array.isArray(b.highlightLines) && b.highlightLines.length > 0)
                ? b.highlightLines
                : (highlight ? [highlight] : []);
        return {
            id: b.id || `series-${Date.now()}-${order}`,
            subtitle,
            content,
            highlightSentence: highlight,
            highlightLines,
            order
        };
    });

    // 有用户手选高光时，完全尊重所选顺序（可重复），只截取前三条；否则用段落默认高光补足
    const manualHighlights = Array.isArray(manualSeriesHighlights)
        ? manualSeriesHighlights
        : [];

    let limitedHighlights = manualHighlights
        .map(l => (l || '').trim())
        .filter(Boolean)
        .slice(0, 3);

    if (limitedHighlights.length === 0) {
        const auto = [];
        for (const block of normalized) {
            if (auto.length >= 3) break;
            const lines = Array.isArray(block.highlightLines) && block.highlightLines.length > 0
                ? block.highlightLines
                : (block.highlightSentence ? [block.highlightSentence] : []);
            for (const line of lines) {
                if (auto.length >= 3) break;
                const s = (line || '').trim();
                if (s) auto.push(s);
            }
        }
        limitedHighlights = auto.slice(0, 3);
    }

    return {
        blocks: normalized,
        highlightLines: isSeriesMode ? limitedHighlights : manualHighlights,
        highlightSentence: isSeriesMode ? (limitedHighlights[0] || '') : ''
    };
}

/**
 * 组诗：把段落合并为正文字符串
 */
export function seriesBlocksToContent(blocks = []) {
    return (blocks || [])
        .map(b => (b.content || b.subtitle || '').trim())
        .filter(Boolean)
        .join('\n\n');
}

/**
 * 根据高光行内容反推在原行数组中的索引
 */
export function deriveHighlightIndices(lines = [], highlightLines = []) {
    const indices = [];
    (highlightLines || []).forEach(hl => {
        const idx = (lines || []).findIndex(line => (line || '').trim() === (hl || '').trim());
        if (idx >= 0) indices.push(idx);
    });
    return indices;
}

