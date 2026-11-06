export const DEFAULT_POEM_FONT_SIZE = 14;
export const MIN_POEM_FONT_SIZE = 12;
export const MAX_POEM_FONT_SIZE = 36;
export const POEM_FONT_SIZE_PRESETS = [12, 14, 16, 18, 20, 24, 28, 32, 36];

export function normalizePoemFontSize(value) {
    const size = Number(value);
    return Number.isFinite(size) && size > 0
        ? Math.min(MAX_POEM_FONT_SIZE, Math.max(MIN_POEM_FONT_SIZE, Math.round(size)))
        : DEFAULT_POEM_FONT_SIZE;
}

export function getPoemTypographyFields(source = {}) {
    let styles = source.isSeries && Array.isArray(source.seriesBlocks)
        ? mergeSeriesTextStyles(source.seriesBlocks)
        : normalizePoemTextStyles(source.poemTextStyles, source.content || '');
    if ((source.publishMode === 'discussion' || source.isDiscussion) && Array.isArray(source.sentenceGroups)) styles = mergeDiscussionTextStyles(source.sentenceGroups, source.content || '');
    return { poemFontSize: normalizePoemFontSize(source.poemFontSize), poemTextStyles: styles };
}

export function normalizePoemTextStyles(styles, text) {
    const length = String(text || '').length;
    const result = [];
    for (const item of (Array.isArray(styles) ? styles : []).slice().sort((a, b) => a.start - b.start)) {
        const format = normalizePoemFormat(item);
        if (!Object.keys(format).length) continue;
        const paragraph = ['align', 'lineHeight', 'marginTop', 'marginBottom', 'indent'].some(key => format[key] !== undefined);
        const start = Math.max(result.length ? result[result.length - 1].end : 0, Math.trunc(Number(item.start) || 0));
        const end = Math.min(length + (paragraph ? 1 : 0), Math.trunc(Number(item.end) || 0));
        if (end <= start) continue;
        const last = result[result.length - 1];
        const previous = last && normalizePoemFormat(last);
        if (last && last.end === start && JSON.stringify(previous) === JSON.stringify(format)) last.end = end;
        else result.push({ start, end, ...format });
    }
    return result;
}

export function normalizePoemFormat(format = {}) {
    const result = {};
    const size = format.fontSize !== undefined ? format.fontSize : format.size;
    if (size !== undefined && size !== false) result.fontSize = normalizePoemFontSize(parseFloat(size));
    for (const key of ['bold', 'italic', 'underline', 'strike']) {
        if (format[key] === true) result[key] = true;
    }
    for (const key of ['color', 'backgroundColor']) {
        const value = String(format[key] || '').trim().toLowerCase();
        if (/^#[a-f0-9]{6}$/.test(value)) result[key] = value;
        else if (/^#[a-f0-9]{3}$/.test(value)) result[key] = '#' + value.slice(1).split('').map(char => char + char).join('');
        else {
            const rgb = value.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/);
            if (rgb) result[key] = '#' + rgb.slice(1).map(channel => Math.min(255, Number(channel)).toString(16).padStart(2, '0')).join('');
        }
    }
    for (const [key, minimum, maximum] of [['letterSpacing', 0, 6], ['lineHeight', 1, 3], ['marginTop', 0, 32], ['marginBottom', 0, 32], ['indent', 0, 4]]) {
        if (format[key] === undefined || format[key] === false || format[key] === '') continue;
        const value = parseFloat(format[key]);
        if (Number.isFinite(value)) result[key] = Math.round(Math.min(maximum, Math.max(minimum, value)) * 100) / 100;
    }
    if (['left', 'center', 'right', 'justify'].includes(format.align)) result.align = format.align;
    return result;
}

export function poemFormatToEditor(format = {}) {
    const attributes = normalizePoemFormat(format);
    for (const key of ['fontSize', 'letterSpacing', 'marginTop', 'marginBottom']) {
        if (attributes[key] !== undefined) attributes[key] += 'px';
    }
    if (attributes.lineHeight !== undefined) attributes.lineHeight = String(attributes.lineHeight);
    return attributes;
}

export function mergeSeriesTextStyles(blocks = []) {
    let offset = 0;
    const styles = [];
    for (const block of blocks) {
        const content = String(block.content || block.subtitle || '');
        if (!content.trim()) continue;
        for (const item of normalizePoemTextStyles(block.poemTextStyles, content)) {
            styles.push({ ...item, start: offset + item.start, end: offset + item.end });
        }
        offset += content.length + 2;
    }
    return styles;
}

export function mergeDiscussionTextStyles(groups = [], content = '') {
    const result = [];
    let quoteEnd = 0;
    for (const group of groups) {
        const quote = (group.sentences || []).join('\n');
        if (!quote) continue;
        const start = content.indexOf(quote, quoteEnd);
        if (start < 0) continue;
        for (const item of normalizePoemTextStyles(group.sentenceTextStyles, quote)) result.push({ ...item, start: start + item.start, end: start + item.end });
        quoteEnd = start + quote.length + 1;
    }
    let commentEnd = quoteEnd ? quoteEnd + 1 : 0;
    for (const group of groups) {
        if (!group.comment) continue;
        const start = content.indexOf(group.comment, commentEnd);
        if (start < 0) continue;
        for (const item of normalizePoemTextStyles(group.commentTextStyles, group.comment)) result.push({ ...item, start: start + item.start, end: start + item.end });
        commentEnd = start + group.comment.length;
    }
    return normalizePoemTextStyles(result, content);
}

function runsAt(text, styles, start) {
    const result = [];
    let cursor = 0;
    const append = (value, format = {}) => {
        if (!value) return;
        result.push({ text: value, ...format });
    };
    for (const item of styles) {
        const left = Math.max(0, item.start - start);
        const right = Math.min(text.length, item.end - start);
        if (right <= left || left >= text.length) continue;
        append(text.slice(cursor, left));
        append(text.slice(left, right), normalizePoemFormat(item));
        cursor = right;
    }
    append(text.slice(cursor));
    return result;
}

export function getPoemParagraphs(text = '', styles = [], sourceText = text) {
    text = String(text);
    sourceText = String(sourceText);
    const normalized = normalizePoemTextStyles(styles, sourceText);
    let search = 0;
    return text.split('\n').map(line => {
        const position = sourceText.indexOf(line.replace(/(?:…|\.\.\.)$/, ''), search);
        const start = position < 0 ? search : position;
        const delimiter = sourceText.indexOf('\n', start);
        const end = delimiter < 0 ? sourceText.length : delimiter;
        const format = normalizePoemFormat(normalized.find(item => item.start <= end && item.end > end));
        search = start + line.length + (sourceText.slice(start + line.length, start + line.length + 2) === '\r\n' ? 2 : 1);
        return { runs: runsAt(line, normalized, start), format };
    });
}

export function getPoemTextRuns(text = '', styles = [], sourceText = text) {
    const result = [];
    const append = run => {
        const last = result[result.length - 1];
        if (last && JSON.stringify(normalizePoemFormat(last)) === JSON.stringify(normalizePoemFormat(run))) last.text += run.text;
        else result.push({ ...run });
    };
    const paragraphs = getPoemParagraphs(text, styles, sourceText);
    paragraphs.forEach((paragraph, index) => {
        paragraph.runs.forEach(append);
        if (index < paragraphs.length - 1) append({ text: '\n' });
    });
    return result;
}

export function poemToEditorDelta(content = '', styles = []) {
    const normalized = normalizePoemTextStyles(styles, content);
    const ops = runsAt(content + '\n', normalized, 0).map(run => {
        const attributes = poemFormatToEditor(run);
        return { insert: run.text, ...(Object.keys(attributes).length ? { attributes } : {}) };
    });
    return { ops };
}

export function poemFromEditorDelta(delta = {}) {
    let content = '';
    const styles = [];
    for (const op of delta.ops || []) {
        if (typeof op.insert !== 'string') continue;
        const start = content.length;
        content += op.insert;
        const format = normalizePoemFormat(op.attributes);
        if (Object.keys(format).length) styles.push({ start, end: content.length, ...format });
    }
    // Delta ends with the editor's required paragraph delimiter.
    if (content.endsWith('\n')) content = content.slice(0, -1);
    return { content, poemTextStyles: normalizePoemTextStyles(styles, content) };
}

export function remapPoemTextStyles(text, styles, sourceText) {
    const ops = [];
    for (const paragraph of getPoemParagraphs(text, styles, sourceText)) {
        for (const run of paragraph.runs) ops.push({ insert: run.text, attributes: poemFormatToEditor(run) });
        ops.push({ insert: '\n', attributes: poemFormatToEditor(paragraph.format) });
    }
    return poemFromEditorDelta({ ops }).poemTextStyles;
}

export function layoutPoemText(ctx, content, styles, fontSize, baseFontSize, maxWidth, fontFamily) {
    const lines = [];
    const scale = fontSize / normalizePoemFontSize(baseFontSize);
    for (const paragraph of getPoemParagraphs(content, styles)) {
        let runs = [], width = 0, maximum = fontSize;
        const first = lines.length;
        const indent = (paragraph.format.indent || 0) * 3 * fontSize;
        const availableWidth = Math.max(fontSize, maxWidth - indent);
        const finish = wrapped => {
            lines.push({ runs, width, indent, availableWidth, wrapped, align: paragraph.format.align || 'left', fontSize: maximum,
                lineHeight: Math.round(maximum * (paragraph.format.lineHeight || 1.36)) * (runs.length || paragraph.format.lineHeight ? 1 : 0.5), before: 0, after: 0 });
            runs = []; width = 0; maximum = fontSize;
        };
        for (const run of paragraph.runs) {
            const size = run.fontSize ? Math.round(run.fontSize * scale) : fontSize;
            const spacing = (run.letterSpacing || 0) * scale;
            if (ctx) ctx.font = poemCanvasFont(run, size, fontFamily);
            for (const char of run.text) {
                if (char === '\r') continue;
                const measured = (ctx?.measureText ? ctx.measureText(char).width : size) + spacing;
                if (width + measured > availableWidth && runs.length) finish(true);
                const last = runs[runs.length - 1];
                if (last && last.source === run) { last.text += char; last.width += measured; }
                else runs.push({ ...normalizePoemFormat(run), text: char, fontSize: size, letterSpacing: spacing, width: measured, source: run });
                width += measured;
                maximum = Math.max(maximum, size);
            }
        }
        finish(false);
        lines[first].before = (paragraph.format.marginTop || 0) * scale;
        lines[lines.length - 1].after = (paragraph.format.marginBottom || 0) * scale;
        for (const line of lines.slice(first)) for (const run of line.runs) delete run.source;
    }
    return lines;
}

export function poemCanvasFont(format, size, family) {
    return `${format.italic ? 'italic ' : ''}${format.bold ? 'bold ' : ''}${size}px ${family}`;
}

export function drawPoemTextLayout(ctx, lines, { x, top, fontFamily, textColor }) {
    for (const line of lines) {
        top += line.before;
        const spare = Math.max(0, line.availableWidth - line.width);
        const count = line.runs.reduce((total, run) => total + Array.from(run.text).length, 0);
        const extra = line.align === 'justify' && line.wrapped && count > 1 ? spare / (count - 1) : 0;
        let left = x + line.indent + (line.align === 'center' ? spare / 2 : line.align === 'right' ? spare : 0);
        let remaining = count;
        for (const run of line.runs) {
            const baseline = top + line.fontSize;
            const characters = Array.from(run.text).length;
            const width = run.width + extra * (characters - (remaining === characters ? 1 : 0));
            ctx.font = poemCanvasFont(run, run.fontSize, fontFamily);
            if (run.backgroundColor) {
                ctx.setFillStyle(run.backgroundColor);
                ctx.fillRect(left, baseline - run.fontSize * 0.85, width, run.fontSize * 1.1);
            }
            const color = run.color || textColor;
            ctx.setFillStyle(color);
            if (run.letterSpacing || extra) {
                let cursor = left;
                for (const char of run.text) {
                    ctx.fillText(char, cursor, baseline);
                    cursor += ctx.measureText(char).width + run.letterSpacing + extra;
                }
            } else ctx.fillText(run.text, left, baseline);
            if (run.underline || run.strike) {
                ctx.setStrokeStyle(color);
                ctx.setLineWidth(Math.max(1, run.fontSize / 18));
                for (const offset of [run.underline ? run.fontSize * 0.12 : null, run.strike ? -run.fontSize * 0.32 : null]) {
                    if (offset === null) continue;
                    ctx.beginPath(); ctx.moveTo(left, baseline + offset); ctx.lineTo(left + width, baseline + offset); ctx.stroke();
                }
            }
            left += width;
            remaining -= characters;
        }
        top += line.lineHeight + line.after;
    }
    ctx.setFillStyle(textColor);
    return top;
}

export function getPoemFontVars(post, readFontVars = {}) {
    if (!post || !post.poemFontSize) return {};
    const size = normalizePoemFontSize(post.poemFontSize);
    const readScale = (parseFloat(readFontVars['--app-read-post-size']) || 28) / 28;
    const rpx = value => `${Math.round(value * readScale * 100) / 100}rpx`;
    return {
        '--app-read-post-size': rpx(size * 2),
        '--app-read-post-line': rpx(size * 38 / 14)
    };
}
