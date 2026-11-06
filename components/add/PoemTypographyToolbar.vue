<template>
    <view class="poem-typography-toolbar" role="toolbar" aria-label="文字排版" @tap.stop>
        <scroll-view class="typography-scroll" scroll-x :show-scrollbar="false" :scroll-left="toolsScrollLeft" scroll-with-animation @scroll="onToolsScroll">
            <view class="typography-controls">
                <view class="typography-group">
                    <button class="typography-button history-undo" :disabled="disabled" aria-label="撤销" title="撤销" @mousedown.prevent @tap="$emit('undo')"><view class="history-icon"></view></button>
                    <button class="typography-button history-redo" :disabled="disabled" aria-label="重做" title="重做" @mousedown.prevent @tap="$emit('redo')"><view class="history-icon history-icon--redo"></view></button>
                </view>
                <view class="typography-divider"></view>
                <view class="size-field">
                    <input class="size-input" type="number" :value="draftSize" :disabled="disabled" maxlength="2" confirm-type="done" :adjust-position="true" aria-label="正文字号，12至36" @focus="editingSize = true" @input="onSizeInput" @blur="onSizeBlur" @confirm="commitSize" />
                    <text class="size-unit">px</text>
                    <picker class="size-presets" :disabled="disabled" :range="presetLabels" :value="presetIndex" @change="selectPreset">
                        <view class="size-preset-button" role="button" aria-label="选择常用字号"><view class="preset-chevron"></view></view>
                    </picker>
                </view>
                <view class="typography-group inline-formats">
                    <button v-for="tool in inlineTools" :key="tool.name" class="typography-button" :class="['format-' + tool.name, { 'is-active': !!formats[tool.name] }]" :disabled="disabled" :aria-label="tool.label" :title="tool.label" :aria-pressed="!!formats[tool.name]" @mousedown.prevent @tap="$emit('format', { name: tool.name })"><text>{{ tool.glyph }}</text></button>
                </view>
                <view class="typography-divider"></view>
                <button class="typography-button format-painter" :class="{ 'is-active': painterActive }" :disabled="disabled" aria-label="格式刷" title="格式刷：选中来源文字，再选中目标文字" :aria-pressed="painterActive" @mousedown.prevent @tap="$emit('painter')"><view class="painter-icon"></view></button>
                <button class="typography-button size-reset" :disabled="disabled" aria-label="清除格式" title="清除格式" @mousedown.prevent @tap="$emit('reset')"><text class="size-letter">A</text><view class="reset-eraser"></view></button>
                <view class="typography-divider"></view>
                <picker v-for="tool in colorTools" :key="tool.name" :disabled="disabled" :range="tool.labels" :value="formatIndex(tool)" @change="selectFormat(tool, $event)">
                    <view class="typography-button format-picker" role="button" :aria-label="tool.label" :title="tool.label"><text :class="tool.name === 'color' ? 'color-letter' : 'highlight-letter'" :style="tool.name === 'color' ? { borderBottomColor: formats.color || 'currentColor' } : { backgroundColor: formats.backgroundColor || '#ddd1a8' }">{{ tool.name === 'color' ? 'A' : 'ab' }}</text><view class="preset-chevron"></view></view>
                </picker>
                <view class="typography-divider"></view>
                <view class="typography-group alignment-formats">
                    <button v-for="tool in alignTools" :key="tool.name" class="typography-button" :class="['format-align-' + tool.name, { 'is-active': (formats.align || 'left') === tool.name }]" :disabled="disabled" :aria-label="tool.label" :title="tool.label" @mousedown.prevent @tap="$emit('format', { name: 'align', value: tool.name })"><view class="align-lines" :class="'align-lines--' + tool.name"><view></view><view></view><view></view><view></view></view></button>
                </view>
                <view class="typography-group">
                    <button class="typography-button format-outdent" :disabled="disabled" aria-label="减少缩进" title="减少缩进" @mousedown.prevent @tap="$emit('format', { name: 'indent', value: '-1' })"><text class="indent-arrow">‹</text><view class="align-lines"><view></view><view></view><view></view></view></button>
                    <button class="typography-button format-indent" :disabled="disabled" aria-label="增加缩进" title="增加缩进" @mousedown.prevent @tap="$emit('format', { name: 'indent', value: '+1' })"><text class="indent-arrow">›</text><view class="align-lines"><view></view><view></view><view></view></view></button>
                </view>
                <view class="typography-divider"></view>
                <picker v-for="tool in spacingTools" :key="tool.name" :disabled="disabled" :range="tool.labels" :value="formatIndex(tool)" @change="selectFormat(tool, $event)">
                    <view class="typography-button format-picker" :class="'format-' + tool.name" role="button" :aria-label="tool.label" :title="tool.label"><text class="spacing-glyph">{{ tool.glyph }}</text><view class="preset-chevron"></view></view>
                </picker>
                <view class="typography-divider"></view>
                <view class="typography-group size-adjustments">
                    <button class="typography-button size-step" :disabled="disabled || currentSize <= minSize" aria-label="减小字号" title="减小字号" @mousedown.prevent @tap="step(-1)"><text class="size-letter">A</text><text class="size-mark">−</text></button>
                    <button class="typography-button size-step" :disabled="disabled || currentSize >= maxSize" aria-label="增大字号" title="增大字号" @mousedown.prevent @tap="step(1)"><text class="size-letter">A</text><text class="size-mark">+</text></button>
                </view>
            </view>
        </scroll-view>
        <button class="toolbar-scroll-button toolbar-scroll-prev" :disabled="disabled || !canScrollBack" aria-label="向左查看排版工具" title="向左查看排版工具" @mousedown.prevent @tap="scrollTools(-1)"><view class="toolbar-chevron toolbar-chevron--prev"></view></button>
        <button class="toolbar-scroll-button toolbar-scroll-next" :disabled="disabled || !canScrollForward" aria-label="向右查看排版工具" title="向右查看排版工具" @mousedown.prevent @tap="scrollTools(1)"><view class="toolbar-chevron"></view></button>
    </view>
</template>

<script>
import { DEFAULT_POEM_FONT_SIZE, MIN_POEM_FONT_SIZE, MAX_POEM_FONT_SIZE, POEM_FONT_SIZE_PRESETS, normalizePoemFontSize } from '@/utils/poemTypography.js';

export default {
    name: 'PoemTypographyToolbar',
    props: {
        value: { type: Number, default: DEFAULT_POEM_FONT_SIZE }, disabled: { type: Boolean, default: false },
        formats: { type: Object, default: () => ({}) }, painterActive: { type: Boolean, default: false }
    },
    emits: ['change', 'format', 'undo', 'redo', 'reset', 'painter'],
    data() {
        return {
            draftSize: String(normalizePoemFontSize(this.value)), editingSize: false,
            toolsScrollLeft: 0, toolsScrollPosition: 0, toolsWidth: 0, toolsContentWidth: 0,
            defaultSize: DEFAULT_POEM_FONT_SIZE, minSize: MIN_POEM_FONT_SIZE, maxSize: MAX_POEM_FONT_SIZE,
            presets: POEM_FONT_SIZE_PRESETS, presetLabels: POEM_FONT_SIZE_PRESETS.map(size => size + ' px'),
            inlineTools: [{ name: 'bold', label: '加粗', glyph: 'B' }, { name: 'italic', label: '斜体', glyph: 'I' }, { name: 'underline', label: '下划线', glyph: 'U' }, { name: 'strike', label: '删除线', glyph: 'S' }],
            alignTools: [{ name: 'left', label: '左对齐' }, { name: 'center', label: '居中对齐' }, { name: 'right', label: '右对齐' }, { name: 'justify', label: '两端对齐' }],
            colorTools: [
                { name: 'color', label: '文字颜色', labels: ['默认颜色', '墨黑', '灰色', '赭红', '靛蓝', '苔绿', '月白'], values: [false, '#333333', '#888888', '#906161', '#3f5874', '#59745b', '#f4f1ea'] },
                { name: 'backgroundColor', label: '文字底色', labels: ['无底色', '浅黄', '浅绿', '浅蓝', '浅粉', '浅灰'], values: [false, '#f4e8b8', '#d4e3ce', '#d5e3ef', '#ecd6d6', '#e4e4e4'] }
            ],
            spacingTools: [
                { name: 'lineHeight', label: '行距', glyph: '↕≡', labels: ['单倍行距', '默认 1.36 倍', '1.5 倍行距', '1.75 倍行距', '2 倍行距', '2.5 倍行距', '3 倍行距'], values: ['1', '1.36', '1.5', '1.75', '2', '2.5', '3'] },
                { name: 'letterSpacing', label: '字距', glyph: '↔A', labels: ['标准字距', '加宽 0.5 px', '加宽 1 px', '加宽 2 px', '加宽 3 px', '加宽 4 px', '加宽 6 px'], values: ['0px', '0.5px', '1px', '2px', '3px', '4px', '6px'] },
                { name: 'marginTop', label: '段前间距', glyph: '↑¶', labels: ['段前 0 px', '段前 4 px', '段前 8 px', '段前 12 px', '段前 16 px', '段前 24 px', '段前 32 px'], values: ['0px', '4px', '8px', '12px', '16px', '24px', '32px'] },
                { name: 'marginBottom', label: '段后间距', glyph: '↓¶', labels: ['段后 0 px', '段后 4 px', '段后 8 px', '段后 12 px', '段后 16 px', '段后 24 px', '段后 32 px'], values: ['0px', '4px', '8px', '12px', '16px', '24px', '32px'] }
            ]
        };
    },
    computed: {
        currentSize() { return normalizePoemFontSize(this.value); },
        presetIndex() { return Math.max(0, this.presets.indexOf(this.currentSize)); },
        canScrollBack() { return this.toolsScrollPosition > 3; },
        canScrollForward() { return this.toolsScrollPosition + this.toolsWidth < this.toolsContentWidth - 3; }
    },
    watch: { value(value) { this.draftSize = String(normalizePoemFontSize(value)); } },
    mounted() { this.$nextTick(() => this.measureTools()); },
    methods: {
        measureTools() {
            uni.createSelectorQuery().in(this).select('.typography-scroll').boundingClientRect().select('.typography-controls').boundingClientRect().exec(rects => {
                this.toolsWidth = rects[0].width;
                this.toolsContentWidth = rects[1].width;
            });
        },
        onToolsScroll(event) {
            this.toolsScrollPosition = event.detail.scrollLeft;
            this.toolsContentWidth = event.detail.scrollWidth;
        },
        scrollTools(direction) {
            const target = Math.max(0, Math.min(this.toolsContentWidth - this.toolsWidth, this.toolsScrollPosition + direction * this.toolsWidth * 0.8));
            this.toolsScrollLeft = this.toolsScrollPosition;
            this.$nextTick(() => { this.toolsScrollLeft = target; });
        },
        applySize(value) { const size = normalizePoemFontSize(value); this.draftSize = String(size); this.$emit('change', size); },
        onSizeInput(event) { if (this.editingSize) this.draftSize = event.detail.value; },
        onSizeBlur(event) { this.editingSize = false; this.commitSize(event); },
        commitSize(event) { const value = event?.detail?.value ?? this.draftSize; this.applySize(String(value).trim() ? value : this.value); },
        step(delta) { this.applySize(normalizePoemFontSize(this.editingSize ? this.draftSize : this.value) + delta); },
        selectPreset(event) { this.applySize(this.presets[Number(event.detail.value)]); },
        formatIndex(tool) {
            const value = this.formats[tool.name] ?? (tool.name === 'lineHeight' ? '1.36' : tool.name.includes('margin') || tool.name === 'letterSpacing' ? '0px' : false);
            return Math.max(0, tool.values.indexOf(value));
        },
        selectFormat(tool, event) { this.$emit('format', { name: tool.name, value: tool.values[Number(event.detail.value)] }); }
    }
};
</script>

<style scoped>
.poem-typography-toolbar { position: relative; flex-shrink: 0; min-width: 0; padding: 8rpx 52rpx; border-radius: 14rpx; background: var(--app-subtle-surface-bg, #f5f5f5); color: var(--app-secondary-text, #555); }
.typography-scroll { width: 100%; white-space: nowrap; }
.typography-controls, .typography-group { display: inline-flex; align-items: center; vertical-align: middle; }
.typography-controls { gap: 10rpx; min-width: 100%; min-height: 64rpx; }
.typography-group { flex-shrink: 0; gap: 4rpx; }
.typography-divider { flex-shrink: 0; width: 1rpx; height: 30rpx; background: var(--app-border-color, rgba(0, 0, 0, 0.1)); }
.typography-button { display: flex; align-items: center; justify-content: center; flex-shrink: 0; width: 56rpx; height: 64rpx; margin: 0; padding: 0; border: none; border-radius: 8rpx; color: inherit; background: transparent; font-family: Arial, sans-serif; font-size: 29rpx; font-weight: 400; line-height: 1; }
.typography-button::after { border: none; }
.typography-button[disabled] { color: inherit; opacity: 0.3; background: transparent; }
.typography-button:active, .typography-button.is-active { background: var(--app-control-press-bg, rgba(0, 0, 0, 0.08)); color: var(--app-primary-text, #222); }
.history-icon { position: relative; width: 26rpx; height: 24rpx; border: 3rpx solid currentColor; border-left-color: transparent; border-bottom-color: transparent; border-radius: 50%; transform: rotate(-20deg); box-sizing: border-box; }
.history-icon::before { content: ''; position: absolute; top: -7rpx; left: -5rpx; width: 12rpx; height: 12rpx; border-left: 3rpx solid currentColor; border-bottom: 3rpx solid currentColor; transform: rotate(25deg); }
.history-icon--redo { transform: scaleX(-1) rotate(-20deg); }
.size-field { display: flex; align-items: center; flex-shrink: 0; height: 60rpx; padding-left: 6rpx; border-radius: 8rpx; background: var(--app-page-bg, #fff); }
.size-input { width: 48rpx; height: 60rpx; font-size: 26rpx; line-height: 60rpx; text-align: center; color: var(--app-primary-text, #333); }
.size-unit { font-size: 20rpx; }
.size-presets { flex-shrink: 0; }
.size-preset-button { display: flex; align-items: center; justify-content: center; width: 36rpx; height: 60rpx; }
.preset-chevron { flex-shrink: 0; width: 8rpx; height: 8rpx; border-right: 2rpx solid currentColor; border-bottom: 2rpx solid currentColor; transform: rotate(45deg); margin-top: -5rpx; opacity: 0.7; }
.size-letter { font-family: Arial, sans-serif; font-size: 30rpx; }
.size-mark { align-self: flex-start; margin-top: 14rpx; margin-left: 1rpx; font-size: 20rpx; }
.size-reset { position: relative; }
.reset-eraser { position: absolute; right: 6rpx; bottom: 16rpx; width: 12rpx; height: 20rpx; border: 2rpx solid currentColor; border-radius: 2rpx; background: var(--app-subtle-surface-bg, #f5f5f5); transform: rotate(38deg); box-sizing: border-box; }
.reset-eraser::after { content: ''; position: absolute; top: 8rpx; left: 0; width: 100%; border-top: 2rpx solid currentColor; }
.format-bold { font-weight: 700; }
.format-italic { font-family: Georgia, serif; font-style: italic; }
.format-underline { text-decoration: underline; text-underline-offset: 5rpx; }
.format-strike { text-decoration: line-through; }
.painter-icon { position: relative; width: 26rpx; height: 14rpx; border: 2rpx solid currentColor; border-radius: 3rpx; transform: rotate(-30deg); }
.painter-icon::before { content: ''; position: absolute; top: -8rpx; left: 3rpx; width: 16rpx; height: 6rpx; border-left: 2rpx solid currentColor; border-right: 2rpx solid currentColor; }
.painter-icon::after { content: ''; position: absolute; top: 14rpx; left: 9rpx; width: 5rpx; height: 15rpx; border-radius: 0 0 3rpx 3rpx; background: currentColor; }
.format-picker { gap: 7rpx; width: 70rpx; }
.color-letter { padding: 0 2rpx 3rpx; border-bottom: 5rpx solid; font-size: 29rpx; }
.highlight-letter { padding: 3rpx; border-radius: 2rpx; font-size: 23rpx; }
.align-lines { display: flex; flex-direction: column; align-items: flex-start; justify-content: center; gap: 5rpx; width: 30rpx; }
.align-lines > view { width: 100%; height: 2rpx; background: currentColor; }
.align-lines > view:nth-child(2), .align-lines > view:nth-child(4) { width: 65%; }
.align-lines--center { align-items: center; }
.align-lines--right { align-items: flex-end; }
.align-lines--justify > view { width: 100%; }
.indent-arrow { margin-right: 3rpx; font-size: 30rpx; }
.format-indent .align-lines, .format-outdent .align-lines { width: 23rpx; }
.spacing-glyph { font-size: 24rpx; }
.toolbar-scroll-button { position: absolute; top: 0; bottom: 0; display: flex; align-items: center; justify-content: center; width: 44rpx; margin: 0; padding: 0; border: none; background: var(--app-subtle-surface-bg, #f5f5f5); font-size: 36rpx; line-height: 1; color: var(--app-secondary-text, #777); }
.toolbar-scroll-button::after { border: none; }
.toolbar-scroll-button:active { color: var(--app-primary-text, #222); }
.toolbar-scroll-button[disabled] { color: inherit; opacity: 0.3; background: var(--app-subtle-surface-bg, #f5f5f5); }
.toolbar-scroll-prev { left: 0; border-radius: 14rpx 0 0 14rpx; }
.toolbar-scroll-next { right: 0; border-radius: 0 14rpx 14rpx 0; }
.toolbar-chevron { position: absolute; top: 50%; left: 50%; width: 12rpx; height: 12rpx; border-top: 3rpx solid currentColor; border-right: 3rpx solid currentColor; transform: translate(-50%, -50%) rotate(45deg); box-sizing: border-box; }
.toolbar-chevron--prev { transform: translate(-50%, -50%) rotate(-135deg); }
</style>
