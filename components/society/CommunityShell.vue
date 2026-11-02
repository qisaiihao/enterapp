<template>
  <view class="community-shell" :style="{ paddingTop: `${top}px` }">
    <view class="shell-inner">
      <view class="shell-nav">
        <button class="back-button" aria-label="返回" @tap="back"><view class="back-chevron"></view></button>
        <text class="shell-title">{{ title }}</text>
        <view class="shell-actions"><slot name="actions" /></view>
      </view>
      <slot />
    </view>
  </view>
</template>
<script>
import { getSystemInfoCompat } from '@/utils/system-info.js';
export default {
  props: { title: { type: String, default: '' } },
  data: () => ({ top: 0 }),
  mounted() {
    try { const info = getSystemInfoCompat(); this.top = info.safeAreaInsets?.top || info.statusBarHeight || 0; } catch (_) {}
  },
  methods: {
    back() {
      if (getCurrentPages().length > 1) uni.navigateBack();
      else uni.reLaunch({ url: '/pages-content/activity-list/activity-list' });
    }
  }
};
</script>
<style scoped>
.community-shell { min-height: 100vh; box-sizing: border-box; background: var(--app-page-bg, #fff); color: var(--app-primary-text, #242020); }
.shell-inner { max-width: 680px; margin: 0 auto; padding: 0 36rpx calc(48rpx + env(safe-area-inset-bottom)); }
.shell-nav { display: flex; align-items: center; gap: 12rpx; height: 96rpx; margin: 0 -12rpx 26rpx; }
.back-button { display: flex; align-items: center; justify-content: center; width: 68rpx; height: 76rpx; padding: 0; margin: 0; background: transparent; }
.back-button::after { border: 0; }
.back-chevron { width: 18rpx; height: 18rpx; border-left: 3rpx solid currentColor; border-bottom: 3rpx solid currentColor; transform: rotate(45deg); color: var(--app-primary-text, #242020); }
.shell-title { font-size: 26rpx; color: var(--app-muted-text, #8a807b); flex: 1; }
.shell-actions { display: flex; gap: 22rpx; align-items: center; }
</style>
