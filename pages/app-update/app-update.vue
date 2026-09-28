<template>
  <view class="update-page" :data-app-theme="appThemeMode" :style="appThemeVars">
    <view v-if="update" class="update-card">
      <text class="update-title">{{ installed ? '更新已安装' : (update.title || '发现新版本') }}</text>
      <text class="update-version">{{ update.version }}</text>
      <scroll-view class="update-notes" scroll-y>
        <text>{{ update.contents || '修复问题，改善使用体验。' }}</text>
      </scroll-view>
      <text v-if="installed" class="update-hint">重启应用后即可使用新版本。</text>
      <text v-else-if="update.is_mandatory" class="update-hint">请更新到此版本后继续使用。</text>
      <view v-if="busy" class="update-progress">
        <progress :percent="progress" activeColor="#333333" stroke-width="4" />
        <text>{{ progress < 100 ? `正在下载 ${progress}%` : '正在安装，请稍候…' }}</text>
      </view>
      <text v-if="message" class="update-message">{{ message }}</text>
      <button class="update-button" :disabled="busy" @tap="startUpdate">
        {{ installed ? '立即重启' : (busy ? '更新中…' : buttonText) }}
      </button>
      <button v-if="!update.is_mandatory" class="update-later" :disabled="busy && progress >= 100" @tap="leave">{{ busy ? '取消下载' : '稍后再说' }}</button>
    </view>
    <app-overlay-host />
  </view>
</template>

<script>
import { getPendingUpdate, isWgtInstalled, downloadAndInstallUpdate, releaseUpdatePage, restartAfterUpdate } from '@/utils/appUpdate.js';

export default {
  data() {
    return { update: null, busy: false, installed: false, progress: 0, message: '', attempted: false };
  },
  computed: {
    buttonText() {
      if (this.update?.type === 'native_app' && this.update.devicePlatform === 'ios') return '前往应用商店';
      return this.attempted ? '重试更新' : '立即更新';
    }
  },
  onLoad() {
    this.update = getPendingUpdate();
    this.installed = isWgtInstalled(this.update);
    if (!this.update) this.leave();
  },
  onBackPress() {
    return !!this.update?.is_mandatory || (this.busy && this.progress >= 100);
  },
  onUnload() {
    releaseUpdatePage();
  },
  methods: {
    async startUpdate() {
      if (this.busy || !this.update) return;
      if (this.installed) { restartAfterUpdate(); return; }
      this.busy = true;
      this.attempted = true;
      this.message = '';
      this.progress = 0;
      try {
        const result = await downloadAndInstallUpdate(this.update, value => { this.progress = value; });
        this.installed = result.type === 'restart_pending';
        if (result.type === 'installation_requested') this.message = '请在系统安装界面完成更新；若已取消，可点击重试。';
        if (result.type === 'store_opened') this.message = '请在应用商店完成更新。';
      } catch (error) {
        this.message = error.message || '更新失败，请重试';
      } finally {
        this.busy = false;
      }
    },
    leave() {
      if (this.update?.is_mandatory || (this.busy && this.progress >= 100)) return;
      uni.navigateBack({ fail: () => uni.switchTab({ url: '/pages/profile/profile' }) });
    }
  }
};
</script>

<style scoped>
.update-page { min-height: 100vh; padding: calc(80rpx + env(safe-area-inset-top)) 40rpx 60rpx; box-sizing: border-box; background: var(--app-page-bg, #fff); color: var(--app-primary-text, #111); }
.update-card { max-width: 640rpx; margin: 0 auto; }
.update-title { display: block; font-size: 40rpx; font-weight: 600; }
.update-version { display: block; margin-top: 16rpx; font-size: 28rpx; color: var(--app-muted-text, #888); }
.update-notes { max-height: 40vh; margin: 48rpx 0; font-size: 28rpx; line-height: 1.8; white-space: pre-wrap; }
.update-hint, .update-message { display: block; margin: 24rpx 0; font-size: 26rpx; line-height: 1.6; }
.update-progress { margin: 30rpx 0; font-size: 24rpx; }
.update-progress text { display: block; margin-top: 16rpx; }
.update-button { margin-top: 40rpx; background: var(--app-control-accent-bg, #111); color: var(--app-control-accent-text, #fff); font-size: 28rpx; border-radius: 12rpx; }
.update-later { margin-top: 20rpx; background: transparent; color: var(--app-muted-text, #888); font-size: 26rpx; }
.update-later::after { border: none; }
</style>
