<template>
  <view class="widget-page" :data-app-theme="appThemeMode" :style="appThemeVars">
    <text v-if="!available" class="widget-note">{{ unavailableText }}</text>
    <template v-else>
      <view class="widget-section">
        <text class="widget-label">尺寸</text>
        <view class="widget-options">
          <button
            v-for="item in sizes"
            :key="item.value"
            class="widget-option"
            :class="{ 'is-selected': size === item.value }"
            :aria-pressed="size === item.value"
            @tap="size = item.value"
          >{{ item.label }}</button>
        </view>
      </view>

      <view class="widget-section">
        <text class="widget-label">预览</text>
        <view
          class="widget-preview"
          :class="{ 'preview-wide': size === 'wide', 'preview-square': isIOS && size === 'compact' }"
          :style="previewColors"
        >
          <text class="preview-excerpt">{{ preview.excerpt }}</text>
          <view v-if="size === 'wide'" class="preview-footer">
            <image class="preview-icon" src="/pages-user/static/poem-widget-icon.png" mode="aspectFit" />
            <text class="preview-author">{{ preview.title ? preview.author + ' · ' + preview.title : preview.author }}</text>
            <view class="preview-next" role="img" aria-label="换一首" />
          </view>
        </view>
      </view>

      <view class="widget-section">
        <text class="widget-label">内容来源</text>
        <view class="widget-options">
          <button
            v-for="item in sources"
            :key="item.value"
            class="widget-option"
            :class="{ 'is-selected': options.source === item.value }"
            :aria-pressed="options.source === item.value"
            @tap="options.source = item.value"
          >{{ item.label }}</button>
        </view>
      </view>

      <view class="widget-section">
        <text class="widget-label">色卡搭配</text>
        <view class="widget-options">
          <button
            v-for="item in paletteModes"
            :key="item.value"
            class="widget-option"
            :class="{ 'is-selected': options.palette === item.value }"
            :aria-pressed="options.palette === item.value"
            @tap="options.palette = item.value"
          >{{ item.label }}</button>
        </view>

        <template v-if="options.palette === 'custom'">
          <view class="widget-swatches">
            <button
              v-for="item in swatches"
              :key="item.name"
              class="widget-swatch"
              :class="{ 'is-selected': swatchSelected(item) }"
              :style="{ backgroundColor: item.backgroundColor, color: item.textColor }"
              :aria-label="item.name"
              :aria-pressed="swatchSelected(item)"
              @tap="chooseSwatch(item)"
            >诗</button>
          </view>
          <view class="widget-options">
            <label class="widget-color-input">
              <text>背景色</text>
              <input v-model="options.backgroundColor" type="text" maxlength="7" placeholder="#F5EFE5" />
            </label>
            <label class="widget-color-input">
              <text>文字色</text>
              <input v-model="options.textColor" type="text" maxlength="7" placeholder="#302820" />
            </label>
          </view>
        </template>
      </view>

      <button class="widget-save" @tap="save">保存设置</button>
      <text class="widget-note">在主屏幕长按，添加 poementer 的「桌面诗歌」。诗歌每天按北京时间换一首。</text>
    </template>
    <app-overlay-host />
  </view>
</template>

<script>
import colorPalettes from '@/utils/colorPalettes.js';
import { getSystemInfoCompat } from '@/utils/system-info.js';
import {
  DEFAULT_WIDGET_OPTIONS,
  POEM_WIDGET_SOURCES,
  normalizeWidgetColor,
  normalizeWidgetSettings
} from '@/utils/poemWidget.js';
// #ifdef APP-PLUS
import {
  isPoemWidgetAvailable,
  readPoemWidgetPreview,
  readPoemWidgetSettings,
  writePoemWidgetSettings
} from '@/uni_modules/poem-widget';
// #endif

const PREVIEW = {
  excerpt: '风翻过书页，\n把一行诗留给清晨。',
  author: 'poementer',
  title: ''
};

const SWATCHES = colorPalettes.slice(0, 6).map(palette => ({ name: palette.name, ...palette.colors[0] }));

export default {
  data() {
    return {
      available: false,
      unavailableText: '请在 Android 或 iOS App 中设置桌面小组件。',
      isIOS: false,
      size: 'wide',
      draft: normalizeWidgetSettings(),
      saved: normalizeWidgetSettings(),
      cached: {},
      sources: POEM_WIDGET_SOURCES,
      swatches: SWATCHES,
      paletteModes: [
        { value: 'poem', label: '跟随诗歌原色卡' },
        { value: 'custom', label: '自定义色卡' }
      ]
    };
  },
  computed: {
    sizes() {
      return [
        { value: 'compact', label: this.isIOS ? '小号方形' : '1×4 诗句' },
        { value: 'wide', label: this.isIOS ? '中号横卡' : '2×4 诗卡' }
      ];
    },
    options() {
      return this.draft[this.size];
    },
    preview() {
      const poem = this.cached[this.size];
      return poem?.excerpt && this.options.source === this.saved[this.size].source ? poem : PREVIEW;
    },
    previewColors() {
      const colors = this.options.palette === 'custom' ? this.options : this.preview;
      return {
        backgroundColor: normalizeWidgetColor(colors.backgroundColor) || DEFAULT_WIDGET_OPTIONS.backgroundColor,
        color: normalizeWidgetColor(colors.textColor) || DEFAULT_WIDGET_OPTIONS.textColor
      };
    }
  },
  onLoad() {
    // #ifdef APP-PLUS
    this.isIOS = getSystemInfoCompat().platform === 'ios';
    this.unavailableText = '当前安装包未提供桌面小组件。';
    try {
      this.available = isPoemWidgetAvailable();
      if (this.available) {
        const settings = JSON.parse(readPoemWidgetSettings());
        this.saved = normalizeWidgetSettings(settings);
        this.draft = normalizeWidgetSettings(settings);
      }
    } catch (_) {
      this.available = false;
    }
    // #endif
  },
  onShow() {
    this.readCachedPoems();
  },
  methods: {
    chooseSwatch(item) {
      this.options.backgroundColor = item.backgroundColor;
      this.options.textColor = item.textColor;
    },
    swatchSelected(item) {
      return normalizeWidgetColor(this.options.backgroundColor) === item.backgroundColor
        && normalizeWidgetColor(this.options.textColor) === item.textColor;
    },
    readCachedPoems() {
      // #ifdef APP-PLUS
      if (!this.available) return;
      try {
        this.cached = {
          compact: JSON.parse(readPoemWidgetPreview('compact')),
          wide: JSON.parse(readPoemWidgetPreview('wide'))
        };
      } catch (_) {
        this.cached = {};
      }
      // #endif
    },
    save() {
      // #ifdef APP-PLUS
      const invalid = ['compact', 'wide'].find(size => {
        const options = this.draft[size];
        return options.palette === 'custom'
          && (!normalizeWidgetColor(options.backgroundColor) || !normalizeWidgetColor(options.textColor));
      });
      if (invalid) {
        this.size = invalid;
        uni.showToast({ title: '请输入有效的 3 位或 6 位 HEX 色值', icon: 'none' });
        return;
      }
      const settings = normalizeWidgetSettings(this.draft);
      try {
        if (writePoemWidgetSettings(JSON.stringify(settings))) {
          this.saved = settings;
          this.draft = normalizeWidgetSettings(settings);
          this.readCachedPoems();
          uni.showToast({ title: '已保存', icon: 'none' });
          return;
        }
      } catch (_) {
        // The original installation package may not contain the native module.
      }
      uni.showToast({ title: '小组件设置保存失败', icon: 'none' });
      // #endif
    }
  }
};
</script>

<style scoped>
.widget-page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 34rpx 36rpx calc(36rpx + env(safe-area-inset-bottom));
  background: var(--app-page-bg, #f6f6f6);
  color: var(--app-primary-text, #27272c);
}

.widget-section {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  margin-bottom: 32rpx;
}

.widget-label {
  font-size: 28rpx;
  font-weight: 600;
}

.widget-options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12rpx;
}

.widget-option,
.widget-swatch,
.widget-save {
  box-sizing: border-box;
  width: 100%;
  margin: 0;
  border-radius: 16rpx;
  font-size: 27rpx;
  line-height: 1.35;
}

.widget-option {
  min-height: 82rpx;
  padding: 18rpx 10rpx;
  border: 2rpx solid transparent;
  background: var(--app-surface-bg, #fff);
  color: var(--app-primary-text, #27272c);
}

.widget-option.is-selected {
  border-color: var(--app-primary-text, #27272c);
  background: var(--app-control-active-bg, #ebe8e2);
  font-weight: 600;
}

.widget-option::after,
.widget-swatch::after,
.widget-save::after {
  border: 0;
}

.widget-preview {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 16rpx;
  min-height: 110rpx;
  padding: 20rpx 30rpx;
  border-radius: 36rpx;
}

.widget-preview.preview-wide {
  min-height: 250rpx;
  padding: 24rpx 30rpx;
}

.widget-preview.preview-square {
  width: 258rpx;
  height: 258rpx;
  padding-inline: 24rpx;
}

.preview-excerpt {
  display: -webkit-box;
  overflow: hidden;
  font-family: 'Huiwen-mincho', '汇文明朝', serif;
  font-size: 32rpx;
  line-height: 1.5;
  white-space: pre-wrap;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.preview-wide .preview-excerpt,
.preview-square .preview-excerpt {
  -webkit-line-clamp: 4;
}

.preview-footer {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-top: auto;
  font-size: 24rpx;
}

.preview-icon {
  flex: 0 0 38rpx;
  width: 38rpx;
  height: 38rpx;
  border-radius: 8rpx;
}

.preview-author {
  flex: 1;
  overflow: hidden;
  font-family: 'Huiwen-mincho', '汇文明朝', serif;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preview-next {
  flex: 0 0 34rpx;
  width: 34rpx;
  height: 34rpx;
  background-color: currentColor;
  -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='1.75' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M21 15V9.5A3.5 3.5 0 0 0 17.5 6H3.5'/%3E%3Cpath d='M8 1.5L3.5 6L8 10.5'/%3E%3Cpath d='M3 9v5.5A3.5 3.5 0 0 0 6.5 18h14'/%3E%3Cpath d='M16 13.5L20.5 18L16 22.5'/%3E%3C/svg%3E") center / contain no-repeat;
  mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='1.75' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M21 15V9.5A3.5 3.5 0 0 0 17.5 6H3.5'/%3E%3Cpath d='M8 1.5L3.5 6L8 10.5'/%3E%3Cpath d='M3 9v5.5A3.5 3.5 0 0 0 6.5 18h14'/%3E%3Cpath d='M16 13.5L20.5 18L16 22.5'/%3E%3C/svg%3E") center / contain no-repeat;
}

.widget-swatches {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 12rpx;
}

.widget-swatch {
  min-height: 72rpx;
  padding: 10rpx 0;
  border: 3rpx solid transparent;
  font-family: 'Huiwen-mincho', '汇文明朝', serif;
  font-size: 30rpx;
}

.widget-swatch.is-selected {
  border-color: currentColor;
}

.widget-color-input {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  min-width: 0;
  padding: 16rpx 20rpx;
  border-radius: 16rpx;
  background: var(--app-input-bg, #fff);
  font-size: 24rpx;
}

.widget-color-input input {
  font-size: 30rpx;
}

.widget-save {
  padding: 24rpx 16rpx;
  background: var(--app-control-accent-bg, #27272c);
  color: var(--app-control-accent-text, #fff);
  font-weight: 600;
}

.widget-note {
  display: block;
  margin-top: 18rpx;
  color: var(--app-secondary-text, #55515a);
  font-size: 24rpx;
  line-height: 1.6;
}
</style>
