<template>
    <view class="poem-text-editor" @tap.stop>
        <!-- #ifdef APP-PLUS || H5 -->
        <view style="display: none;" :lineCommand="lineCommand" :change:lineCommand="lineFormatter.handle"></view>
        <!-- #endif -->
        <PoemTypographyToolbar :value="selectionFontSize" :formats="formats" :painter-active="!!painter" :disabled="!ready" @change="formatSelection" @format="formatText" @reset="resetFormatting" @painter="togglePainter" @undo="undo" @redo="redo" />
        <slot name="under-toolbar"></slot>
        <editor
            :id="editorId"
            class="poem-native-editor"
            :style="{ fontSize: fontSize + 'px' }"
            :placeholder="placeholder"
            @ready="onReady"
            @input="onInput"
            @focus="onEditorFocus"
            @blur="focused = false"
            @statuschange="onStatusChange"
            @touchend="applyPainter"
            @mouseup="applyPainter"
            @keyup="onEditorKeyup"
        />
        <view class="editor-footnote"><text>{{ painter ? '格式刷：选中目标文字' : '未选中时整行排版 · 工具栏可横滑' }}</text><text>{{ content.length }}/{{ maxLength }}</text></view>
    </view>
</template>

<script>
// #ifdef H5
import Quill from 'quill';
if (!window.Quill) window.Quill = Quill;
// #endif
import PoemTypographyToolbar from './PoemTypographyToolbar.vue';
import { normalizePoemFontSize, normalizePoemFormat, poemFormatToEditor, poemToEditorDelta, poemFromEditorDelta } from '@/utils/poemTypography.js';

let nextEditorId = 0;
export default {
    name: 'PoemTextEditor',
    components: { PoemTypographyToolbar },
    props: {
        content: { type: String, default: '' },
        styles: { type: Array, default: () => [] },
        fontSize: { type: Number, default: 14 },
        maxLength: { type: Number, default: 1500 },
        formatPainter: { type: Object, default: null },
        placeholder: { type: String, default: '写下你的诗…' }
    },
    emits: ['change', 'painter-change'],
    data() { return { editorId: `poem-editor-${++nextEditorId}`, ready: false, focused: false, everFocused: false, selectionFontSize: this.fontSize, formats: {}, lineCommand: null, lineCommandSeq: 0 }; },
    computed: {
        painter: { get() { return this.formatPainter; }, set(value) { this.$emit('painter-change', value); } }
    },
    watch: {
        content() { this.syncContents(); },
        styles: { deep: true, handler() { this.syncContents(); } }
    },
    methods: {
        undo() { this.editorContext.undo(); },
        redo() { this.editorContext.redo(); },
        onReady() {
            uni.createSelectorQuery().in(this).select(`#${this.editorId}`).context(result => {
                this.editorContext = result.context;
                this.ready = true;
                this.syncContents();
            }).exec();
        },
        syncContents() {
            if (!this.ready) return;
            const delta = poemToEditorDelta(this.content, this.styles);
            const snapshot = JSON.stringify(delta);
            if (snapshot === this._contentsSnapshot) return;
            this._contentsSnapshot = snapshot;
            this.editorContext.setContents({ delta });
        },
        onInput(event) {
            const value = poemFromEditorDelta(event.detail.delta);
            if (value.content.length > this.maxLength) {
                this.editorContext.undo();
                uni.showToast({ title: `最多${this.maxLength}字`, icon: 'none' });
                return;
            }
            this._contentsSnapshot = JSON.stringify(poemToEditorDelta(value.content, value.poemTextStyles));
            this.$emit('change', value);
        },
        onStatusChange(event) {
            if (!this.focused && Object.keys(event.detail).length === 0) return;
            this.formats = { ...event.detail };
            const size = event.detail.fontSize;
            this._selectedFormat = size;
            if (typeof size === 'string') this.selectionFontSize = normalizePoemFontSize(parseFloat(size));
            else if (!size) this.selectionFontSize = this.fontSize;
        },
        onEditorFocus() { this.focused = true; this.everFocused = true; },
        requestLineFormat(command) {
            // #ifdef APP-PLUS || H5
            this.lineCommand = { ...command, id: ++this.lineCommandSeq, editorId: this.editorId };
            // #endif
            // #ifdef MP-WEIXIN
            uni.showToast({ title: '请先选中要调整的文字', icon: 'none' });
            // #endif
        },
        formatText({ name, value }) {
            this.editorContext.getSelectionText({ success: selection => {
                if (selection.text) { this.applySelectedFormat(name, value); return; }
                // #ifdef APP-PLUS || H5
                if (this.everFocused) this.applyLineFormat(name, value);
                // #endif
                // #ifdef MP-WEIXIN
                this.applySelectedFormat(name, value);
                // #endif
            } });
        },
        applySelectedFormat(name, value) {
            if (name === 'indent') {
                const current = Number(this.formats.indent) || 0;
                if ((value === '+1' && current >= 4) || (value === '-1' && current <= 0)) return;
                this.editorContext.format('indent', value);
                return;
            }
            if (['bold', 'italic', 'underline', 'strike'].includes(name)) {
                this.editorContext.format(name);
                return;
            }
            const current = this.formats[name];
            if (current === value || (!current && (value === false || (name === 'align' && value === 'left')))) return;
            this.editorContext.format(name, value);
        },
        applyLineFormat(name, value) {
            if (name === 'indent') {
                const current = Number(this.formats.indent) || 0;
                if ((value === '+1' && current >= 4) || (value === '-1' && current <= 0)) return;
                this.requestLineFormat({ op: 'format', name, value });
                return;
            }
            if (['bold', 'italic', 'underline', 'strike'].includes(name)) {
                this.requestLineFormat({ op: 'format', name, value: !this.formats[name] });
                return;
            }
            this.requestLineFormat({ op: 'format', name, value });
        },
        resetFormatting() {
            this.editorContext.getSelectionText({ success: selection => {
                if (selection.text) { this.replaceFormatting({ fontSize: this.fontSize }); return; }
                if (!this.everFocused) { uni.showToast({ title: '请先选中要调整的文字', icon: 'none' }); return; }
                this.requestLineFormat({ op: 'reset', fontSize: this.fontSize });
            } });
        },
        replaceFormatting(format) {
            const attributes = poemFormatToEditor(format);
            this.editorContext.removeFormat({ success: () => {
                this.formats = {};
                this._selectedFormat = attributes.fontSize;
                this.selectionFontSize = normalizePoemFontSize(format.fontSize);
                for (const [name, value] of Object.entries(attributes)) {
                    if (name === 'indent') {
                        for (let index = 0; index < value; index++) this.editorContext.format('indent', '+1');
                    } else this.editorContext.format(name, value);
                }
            } });
        },
        togglePainter() {
            if (this.painter) { this.painter = null; return; }
            this.editorContext.getSelectionText({ success: selection => {
                if (!selection.text) { uni.showToast({ title: '请先选中格式来源文字', icon: 'none' }); return; }
                this.painter = normalizePoemFormat({ ...this.formats, fontSize: this.selectionFontSize });
            } });
        },
        applyPainter() {
            if (!this.painter) return;
            this.editorContext.getSelectionText({ success: selection => {
                if (!selection.text || !this.painter) return;
                const format = this.painter;
                this.painter = null;
                this.replaceFormatting(format);
            } });
        },
        onEditorKeyup(event) { if (['Shift', 'Control', 'Meta'].includes(event.key)) this.applyPainter(); },
        formatSelection(value) {
            this.editorContext.getSelectionText({ success: selection => {
                const size = normalizePoemFontSize(value);
                if (selection.text) {
                    if (this._selectedFormat === `${size}px`) return;
                    this.selectionFontSize = size;
                    this._selectedFormat = `${size}px`;
                    this.editorContext.format('fontSize', `${size}px`);
                    return;
                }
                if (!this.everFocused) {
                    uni.showToast({ title: '请先选中要调整的文字', icon: 'none' });
                    return;
                }
                this.selectionFontSize = size;
                this._selectedFormat = `${size}px`;
                this.requestLineFormat({ op: 'format', name: 'fontSize', value: `${size}px` });
            } });
        }
    }
};
</script>

<script module="lineFormatter" lang="renderjs">
export default {
    methods: {
        handle(command) {
            if (!command || !command.id || typeof document === 'undefined') return;
            const container = document.getElementById(command.editorId);
            const quill = container && container.__quill;
            if (!quill || typeof quill.getText !== 'function') return;
            const range = quill.getSelection() || (quill.selection && quill.selection.savedRange);
            if (!range || range.length) return;
            const text = quill.getText();
            const index = Math.max(0, Math.min(range.index, text.length));
            const start = index > 0 && text[index - 1] !== '\n' ? text.lastIndexOf('\n', index - 1) + 1 : index;
            const nextBreak = text.indexOf('\n', index);
            const end = nextBreak < 0 ? text.length : nextBreak;
            if (end <= start) return;
            quill.setSelection(start, end - start, 'silent');
            if (command.op === 'reset') {
                quill.removeFormat(start, end - start, 'user');
                quill.format('fontSize', `${command.fontSize}px`, 'user');
            } else {
                quill.format(command.name, command.value, 'user');
            }
            quill.setSelection(index, 0, 'user');
        }
    }
};
</script>

<style>
.poem-text-editor { width: 100%; min-width: 0; }
.content-input-wrapper > .poem-text-editor { flex: 1; display: flex; flex-direction: column; min-height: 0; }
.content-input-wrapper > .poem-text-editor .poem-native-editor { flex: 1; height: auto; min-height: 200rpx; }
.poem-native-editor { margin-top: 16rpx; width: 100%; height: 766rpx; min-height: 260rpx; padding: 48rpx; box-sizing: border-box; border-radius: 20rpx; background: var(--app-input-bg, #e8e8e8); color: var(--app-primary-text, #333); line-height: 1.36; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; }
.poem-native-editor .ql-container { font-size: inherit; }
.poem-native-editor .ql-editor { padding: 0 0 2px; line-height: 1.36; white-space: pre-wrap; }
.poem-native-editor .ql-editor p { margin: 0; white-space: pre-wrap; }
.poem-native-editor .ql-editor.ql-blank::before { left: 0; right: 0; font-style: normal; color: var(--app-input-placeholder, #aaa); }
.editor-footnote { display: flex; justify-content: space-between; flex-shrink: 0; gap: 16rpx; padding: 16rpx 8rpx 0; color: var(--app-muted-text, #999); font-size: 20rpx; }
.series-block .poem-native-editor { height: 480rpx; }
.discussion-block .poem-native-editor { height: 320rpx; min-height: 220rpx; padding: 30rpx; }
.discussion-block.quote .poem-native-editor { height: 280rpx; }
@media screen and (max-height: 600px) { .poem-native-editor { height: 46vh; } }
</style>
