<template>
  <view class="update-mask app-motion-root app-motion-center app-motion-enter" :class="{ 'update-dark': appThemeMode === 'dark' }" @touchmove.stop.prevent @tap="dismiss">
    <view class="update-dialog app-motion-panel" role="dialog" :aria-label="state.update.title || '版本更新'" @tap.stop>
      <text class="update-title">{{ state.installed ? '更新已安装' : (state.update.title || '发现新版本') }}</text>
      <text class="update-version">{{ state.update.version }}</text>
      <scroll-view class="update-body" scroll-y @touchmove.stop>
        <text class="update-notes">{{ state.update.contents || '修复问题，改善使用体验。' }}</text>
        <text v-if="state.installed" class="update-hint">重启应用后即可使用新版本。</text>
        <text v-else-if="state.update.is_mandatory" class="update-hint">请更新到此版本后继续使用。</text>
        <view v-if="state.busy" class="update-progress">
          <progress :percent="state.progress" activeColor="#888888" stroke-width="4" />
          <text>{{ state.progress < 100 ? `正在下载 ${state.progress}%` : '正在安装，请稍候…' }}</text>
        </view>
        <text v-if="state.message" class="update-message">{{ state.message }}</text>
      </scroll-view>
      <view class="update-actions">
        <button v-if="!state.update.is_mandatory" class="update-button update-button--cancel" :disabled="state.busy && state.progress >= 100" @tap="dismiss">{{ state.busy ? '取消下载' : '稍后再说' }}</button>
        <button class="update-button update-button--confirm" :disabled="state.busy" @tap="start">{{ state.installed ? '立即重启' : (state.busy ? '更新中…' : buttonText) }}</button>
      </view>
    </view>
  </view>
</template>

<script>
import { registerOverlayDismiss, resolveOverlayOwner } from '@/utils/appOverlay.js';
import { releaseUpdatePage, startPendingUpdate } from '@/utils/appUpdate.js';

export default {
  name: 'AppUpdateDialog',
  props: { state: { type: Object, required: true } },
  computed: {
    buttonText() {
      if (this.state.update?.type === 'native_app' && this.state.update.devicePlatform === 'ios') return '前往应用商店';
      return this.state.attempted ? '重试更新' : '立即更新';
    }
  },
  mounted() {
    this.releaseDismiss = registerOverlayDismiss(resolveOverlayOwner(this), () => this.dismiss());
  },
  beforeUnmount() { this.releaseDismiss?.(); },
  methods: {
    start() { startPendingUpdate(); },
    dismiss() {
      if (this.state.update.is_mandatory || (this.state.busy && this.state.progress >= 100)) return;
      releaseUpdatePage();
    }
  }
};
</script>

<style scoped>
.update-mask {
  --update-bg: #fff;
  --update-text: #333;
  --update-muted: #666;
  --update-cancel-bg: #f5f6f7;
  --update-confirm-bg: #333;
  --update-confirm-text: #fff;
  --update-shadow: 0 16rpx 64rpx rgba(0, 0, 0, 0.14);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  position: fixed;
  inset: 0;
  z-index: 1000001;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  padding: 40rpx;
  background: rgba(0, 0, 0, 0.4);
}
.update-dark {
  --update-bg: #27272c;
  --update-text: #f4f1ea;
  --update-muted: #c9ced8;
  --update-cancel-bg: #343439;
  --update-confirm-bg: #f4f1ea;
  --update-confirm-text: #27272c;
  --update-shadow: 0 16rpx 64rpx rgba(0, 0, 0, 0.3);
}
.update-dialog { width: 100%; max-width: 580rpx; max-height: 100%; display: flex; flex-direction: column; padding: 40rpx; box-sizing: border-box; border-radius: 32rpx; border: none; background: var(--update-bg); color: var(--update-text); box-shadow: var(--update-shadow); }
.update-title { display: block; font-size: 36rpx; font-weight: 600; text-align: center; }
.update-version { display: block; margin-top: 12rpx; font-size: 26rpx; text-align: center; color: var(--update-muted); }
.update-body { max-height: 50vh; min-height: 0; margin-top: 28rpx; }
.update-notes, .update-hint, .update-message { display: block; font-size: 28rpx; line-height: 1.6; color: var(--update-muted); white-space: pre-wrap; overflow-wrap: anywhere; }
.update-hint, .update-message, .update-progress { margin-top: 20rpx; }
.update-progress text { display: block; margin-top: 12rpx; font-size: 26rpx; color: var(--update-muted); }
.update-actions { display: flex; gap: 24rpx; margin-top: 40rpx; }
.update-button { flex: 1; min-width: 0; min-height: 88rpx; margin: 0; padding: 16rpx; box-sizing: border-box; display: flex; align-items: center; justify-content: center; border: none; border-radius: 44rpx; font-size: 30rpx; font-weight: 500; line-height: 1.4; white-space: normal; overflow-wrap: anywhere; }
.update-button::after { border: none; }
.update-button--cancel { background: var(--update-cancel-bg); color: var(--update-muted); }
.update-button--confirm { background: var(--update-confirm-bg); color: var(--update-confirm-text); }
.update-button[disabled] { opacity: 0.45; }
</style>
