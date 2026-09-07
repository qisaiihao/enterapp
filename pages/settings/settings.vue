<template>
  <view class="settings-page" :data-app-theme="appThemeMode" :style="[appThemeVars, readFontVars]">
    <view class="settings-header">
      <view class="settings-back-btn" @tap="goBack">
        <image class="back-icon" src="/static/images/left_exit.png" mode="aspectFit"></image>
      </view>
      <text class="settings-title">设置</text>
    </view>

    <view class="settings-content">
      <view class="settings-section">
        <view class="settings-section-title">阅读字号</view>
        <view class="settings-card">
          <view class="settings-row">
            <text class="settings-row-label">正文阅读字号</text>
            <view class="font-size-options">
              <view
                v-for="item in fontSizeOptions"
                :key="item.value"
                :class="['font-size-option', activeFontSize === item.value ? 'active' : '']"
                @tap="onFontSizeChange(item.value)"
              >
                <text>{{ item.label }}</text>
              </view>
            </view>
          </view>
          <text class="settings-row-desc">调整诗歌正文、详情正文等阅读文字的大小，行高会同步适配。</text>
        </view>
      </view>

      <view class="settings-section">
        <view class="settings-section-title">关于</view>
        <view class="settings-card">
          <view class="settings-row">
            <text class="settings-row-label">版本</text>
            <text class="settings-row-value">1.6.3</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { getSystemInfoCompat } from '@/utils/system-info.js';
import {
  READ_FONT_LEVELS,
  READ_FONT_LEVEL_NAMES,
  getReadFontSizeLevel,
  setReadFontSize
} from '@/utils/fontSize.js';

export default {
  data() {
    return {
      pageInlineStyle: {},
      activeFontSize: getReadFontSizeLevel(),
      fontSizeOptions: READ_FONT_LEVEL_NAMES.map(value => ({
        value,
        label: READ_FONT_LEVELS[value].label
      }))
    };
  },
  onLoad() {
    this.setupHeaderLayout();
  },
  methods: {
    setupHeaderLayout() {
      try {
        const systemInfo = getSystemInfoCompat();
        const safeAreaTop = (systemInfo.safeAreaInsets && systemInfo.safeAreaInsets.top) || systemInfo.statusBarHeight || 0;
        if (safeAreaTop > 0) {
          this.pageInlineStyle = { '--settings-safe-area-top': `${safeAreaTop}px` };
        }
      } catch (error) {
        console.warn('[settings] setup header layout failed:', error);
      }
    },

    onFontSizeChange(value) {
      this.activeFontSize = setReadFontSize(value);
      uni.showToast({ title: `已切换为${READ_FONT_LEVELS[value].label}字号`, icon: 'none' });
    },

    goBack() {
      try {
        const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
        if (pages && pages.length > 1) {
          uni.navigateBack({ delta: 1 });
          return;
        }
      } catch (_) {}
      uni.switchTab({ url: '/pages/profile/profile' });
    }
  }
};
</script>

<style scoped>
.settings-page {
  min-height: 100vh;
  background: var(--app-page-bg, #ffffff);
  color: var(--app-primary-text, #111111);
  box-sizing: border-box;
}

.settings-header {
  position: relative;
  height: calc(var(--settings-safe-area-top, 0px) + 88rpx);
  padding-top: var(--settings-safe-area-top, 0px);
  box-sizing: border-box;
  background: var(--app-surface-bg, #ffffff);
  border-bottom: 1rpx solid var(--app-border-color, #f0f0f0);
}

.settings-back-btn {
  position: absolute;
  left: 30rpx;
  bottom: 16rpx;
  width: 56rpx;
  height: 56rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.back-icon {
  width: 22rpx;
  height: 38rpx;
  display: block;
  filter: var(--app-icon-filter, none);
}

.settings-title {
  position: absolute;
  left: 120rpx;
  right: 120rpx;
  bottom: 24rpx;
  font-size: 30rpx;
  line-height: 40rpx;
  font-weight: 600;
  color: var(--app-primary-text, #000000);
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.settings-content {
  padding: 30rpx 26rpx 60rpx;
  box-sizing: border-box;
}

.settings-section + .settings-section {
  margin-top: 44rpx;
}

.settings-section-title {
  font-size: 24rpx;
  color: var(--app-muted-text, #999999);
  margin-bottom: 14rpx;
  padding-left: 6rpx;
}

.settings-card {
  background: var(--app-surface-bg, #ffffff);
  border-radius: 16rpx;
  padding: 8rpx 26rpx;
  box-sizing: border-box;
  border: 1rpx solid var(--app-border-color, #f0f0f0);
}

.settings-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  padding: 26rpx 0;
  border-bottom: 1rpx solid var(--app-border-color, #f0f0f0);
}

.settings-card .settings-row:last-child {
  border-bottom: none;
}

.settings-row-label {
  font-size: 28rpx;
  color: var(--app-primary-text, #333333);
  flex-shrink: 0;
}

.settings-row-value {
  font-size: 28rpx;
  color: var(--app-muted-text, #999999);
}

.settings-row-desc {
  display: block;
  padding: 20rpx 0 24rpx;
  font-size: 22rpx;
  line-height: 32rpx;
  color: var(--app-muted-text, #999999);
}

.font-size-options {
  display: flex;
  gap: 14rpx;
}

.font-size-option {
  min-width: 96rpx;
  padding: 14rpx 10rpx;
  text-align: center;
  border-radius: 10rpx;
  background: var(--app-control-active-bg, #f5f5f5);
  color: var(--app-primary-text, #333333);
  font-size: 26rpx;
  transition: all 0.2s ease;
}

.font-size-option.active {
  background: var(--app-control-accent-bg, #111111);
  color: var(--app-control-accent-text, #ffffff);
}
</style>