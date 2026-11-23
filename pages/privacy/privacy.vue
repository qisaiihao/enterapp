<template>
  <view class="privacy-page" :data-app-theme="appThemeMode" :style="[appThemeVars, readFontVars]">
    <view class="privacy-header">
      <view class="privacy-back-btn" @tap="goBack">
        <image class="back-icon" src="/static/images/left_exit.png" mode="aspectFit"></image>
      </view>
      <text class="privacy-title">{{ isUserAgreement ? '用户协议' : '隐私政策' }}</text>
    </view>

    <view class="privacy-content">
      <LegalDocument :is-user-agreement="isUserAgreement" />
    </view>
  </view>
  <app-overlay-host />
</template>

<script>
import LegalDocument from '@/components/LegalDocument.vue';
import { hasAcceptedPrivacyConsent } from '@/utils/privacyConsent.js';

export default {
  components: { LegalDocument },
  data() {
    return { isUserAgreement: false };
  },
  onLoad(options = {}) {
    this.isUserAgreement = options.document === 'agreement';
  },
  methods: {
    goBack() {
      try {
        const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
        if (pages && pages.length > 1) {
          uni.navigateBack({ delta: 1 });
          return;
        }
      } catch (_) {}
      if (!hasAcceptedPrivacyConsent()) {
        uni.reLaunch({ url: '/pages/splash/splash' });
        return;
      }
      uni.switchTab({ url: '/pages/profile/profile' });
    }
  }
};
</script>

<style scoped>
.privacy-page {
  min-height: 100vh;
  background: var(--app-page-bg, #ffffff);
  color: var(--app-primary-text, #111111);
  box-sizing: border-box;
}

.privacy-header {
  position: relative;
  height: calc(var(--app-safe-area-top, 0px) + 88rpx);
  padding-top: var(--app-safe-area-top, 0px);
  box-sizing: border-box;
  background: var(--app-surface-bg, #ffffff);
  border-bottom: 1rpx solid var(--app-border-color, #f0f0f0);
}

.privacy-back-btn {
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

.privacy-title {
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

.privacy-content {
  padding: 36rpx 40rpx 80rpx;
  box-sizing: border-box;
}
</style>
