<template>
    <view class="poem-rich-text" :class="{ 'poem-rich-text--vertical': vertical }">
        <template v-if="vertical">
            <view v-for="(column, index) in verticalColumns" :key="index" class="poem-rich-column" :style="columnStyle(column)">
                <text v-for="(run, runIndex) in column.runs" :key="runIndex" :selectable="selectable" :user-select="selectable" :style="runStyle(run)">{{ run.text }}</text>
            </view>
        </template>
        <template v-else>
            <view v-for="(paragraph, index) in paragraphs" :key="index" class="poem-rich-paragraph" :style="paragraphStyle(paragraph.format)">
                <text v-if="!paragraph.runs.length">{{ '\u00a0' }}</text>
                <text v-for="(run, runIndex) in paragraph.runs" :key="runIndex" :selectable="selectable" :user-select="selectable" :style="runStyle(run)">{{ run.text }}</text>
            </view>
        </template>
    </view>
</template>

<script>
import { getPoemParagraphs, layoutVerticalPoem, normalizePoemFontSize } from '@/utils/poemTypography.js';
export default {
    name: 'PoemRichText',
    props: {
        text: { type: String, default: '' },
        styles: { type: Array, default: () => [] },
        sourceText: { type: String, default: '' },
        baseFontSize: { type: Number, default: 14 },
        selectable: { type: Boolean, default: false },
        vertical: { type: Boolean, default: false },
        maxVerticalColumns: { type: Number, default: 0 }
    },
    computed: {
        baseSize() { return normalizePoemFontSize(this.baseFontSize); },
        paragraphs() { return getPoemParagraphs(this.text, this.styles, this.sourceText || this.text); },
        verticalColumns() {
            return layoutVerticalPoem(this.text, this.styles, this.baseSize, this.baseSize, this.sourceText || this.text, this.maxVerticalColumns);
        }
    },
    methods: {
        runStyle(run) {
            return {
                fontSize: run.fontSize ? (run.fontSize / this.baseSize) + 'em' : undefined,
                fontWeight: run.bold ? '700' : undefined,
                fontStyle: run.italic ? 'italic' : undefined,
                textDecoration: [run.underline ? 'underline' : '', run.strike ? 'line-through' : ''].filter(Boolean).join(' ') || undefined,
                color: run.color,
                backgroundColor: run.backgroundColor,
                letterSpacing: run.letterSpacing !== undefined ? (run.letterSpacing / (run.fontSize || this.baseSize)) + 'em' : undefined
            };
        },
        paragraphStyle(format) {
            return {
                textAlign: format.align,
                lineHeight: format.lineHeight || 1.36,
                marginTop: format.marginTop ? (format.marginTop / this.baseSize) + 'em' : undefined,
                marginBottom: format.marginBottom ? (format.marginBottom / this.baseSize) + 'em' : undefined,
                paddingLeft: format.indent ? (format.indent * 3) + 'em' : undefined
            };
        },
        columnStyle(column) {
            const em = value => (value / this.baseSize) + 'em';
            return {
                width: em(column.width),
                minHeight: em(Math.max(this.baseSize, column.indent + column.length)),
                paddingTop: em(column.indent),
                marginRight: em(column.before),
                marginLeft: em(column.after),
                textAlign: column.align || 'start',
                textAlignLast: column.align === 'justify' && column.wrapped ? 'justify' : undefined
            };
        }
    }
};
</script>

<style scoped>
.poem-rich-text { display: block; width: 100%; white-space: pre-wrap; overflow-wrap: break-word; }
.poem-rich-paragraph { min-width: 0; box-sizing: border-box; }
.poem-rich-text--vertical { display: flex; flex-flow: row-reverse wrap; row-gap: 1em; }
.poem-rich-column {
    flex: 0 0 auto;
    box-sizing: border-box;
    writing-mode: vertical-rl;
    text-orientation: upright;
    white-space: pre;
    line-height: 1;
    tab-size: 1;
}
</style>
