<template>
    <view class="poem-rich-text">
        <view v-for="(paragraph, index) in paragraphs" :key="index" class="poem-rich-paragraph" :style="paragraphStyle(paragraph.format)">
            <text v-if="!paragraph.runs.length">{{ '\u00a0' }}</text>
            <text v-for="(run, runIndex) in paragraph.runs" :key="runIndex" :selectable="selectable" :user-select="selectable" :style="runStyle(run)">{{ run.text }}</text>
        </view>
    </view>
</template>

<script>
import { getPoemParagraphs, normalizePoemFontSize } from '@/utils/poemTypography.js';
export default {
    name: 'PoemRichText',
    props: {
        text: { type: String, default: '' },
        styles: { type: Array, default: () => [] },
        sourceText: { type: String, default: '' },
        baseFontSize: { type: Number, default: 14 },
        selectable: { type: Boolean, default: false }
    },
    computed: {
        baseSize() { return normalizePoemFontSize(this.baseFontSize); },
        paragraphs() { return getPoemParagraphs(this.text, this.styles, this.sourceText || this.text); }
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
        }
    }
};
</script>

<style scoped>
.poem-rich-text { display: block; width: 100%; white-space: pre-wrap; overflow-wrap: break-word; }
.poem-rich-paragraph { min-width: 0; box-sizing: border-box; }
</style>
