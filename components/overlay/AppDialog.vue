<template>
  <view v-if="visible" class="app-dialog-mask" :class="{ 'overlay-dark': appThemeMode === 'dark' }" @touchmove.stop.prevent @tap="onMaskTap">
    <view class="app-dialog" role="dialog" :aria-label="title" @tap.stop>
      <text v-if="title" class="app-dialog-title">{{ title }}</text>
      <scroll-view class="app-dialog-body" scroll-y @touchmove.stop>
        <text v-if="message" class="app-dialog-message">{{ message }}</text>
        <input v-if="editable" v-model="inputValue" class="app-dialog-input" :placeholder="placeholder" :focus="visible" />
        <slot />
      </scroll-view>
      <view class="app-dialog-actions">
        <button v-if="showCancel" class="app-dialog-button" :disabled="busy" @tap="cancel">{{ cancelText }}</button>
        <button v-if="extraText" class="app-dialog-button" @tap="answer('extra')">{{ extraText }}</button>
        <button class="app-dialog-button" :class="{ 'is-danger': danger }" :disabled="busy" @tap="answer('confirm')">{{ confirmText }}</button>
      </view>
    </view>
  </view>
</template>

<script>
import { registerOverlayDismiss, resolveOverlayOwner } from '@/utils/appOverlay.js';
export default {
  name: 'AppDialog',
  emits: ['cancel', 'confirm', 'extra'],
  props: {
    visible: Boolean, title: String, message: String, danger: Boolean,
    editable: Boolean, placeholder: String, extraText: String, busy: Boolean,
    initialValue: { type: String, default: '' },
    showCancel: { type: Boolean, default: true },
    closeOnMask: { type: Boolean, default: false },
    confirmText: { type: String, default: '确定' },
    cancelText: { type: String, default: '取消' }
  },
  data() { return { inputValue: '', answered: false }; },
  watch: {
    busy(value) { if (!value) this.answered = false; },
    visible: {
      immediate: true,
      handler(value) {
        this.releaseDismiss?.();
        this.releaseDismiss = null;
        if (value) {
          this.inputValue = this.initialValue;
          this.answered = false;
          this.releaseDismiss = registerOverlayDismiss(resolveOverlayOwner(this), () => this.cancel());
        }
      }
    }
  },
  beforeUnmount() { this.releaseDismiss?.(); },
  methods: {
    answer(event) {
      if (this.answered || this.busy) return;
      this.answered = true;
      this.$emit(event, this.inputValue);
    },
    cancel() { if (this.showCancel) this.answer('cancel'); },
    onMaskTap() { if (this.closeOnMask) this.cancel(); }
  }
};
</script>

<style scoped>
.app-dialog-mask {
  --overlay-bg: #fff;
  --overlay-text: #171717;
  --overlay-muted: #666;
  --overlay-border: #171717;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  position: fixed;
  inset: 0;
  z-index: 1000000;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40rpx;
  box-sizing: border-box;
}
.overlay-dark { --overlay-bg: #171a20; --overlay-text: #f4f1ea; --overlay-muted: #c9ced8; --overlay-border: #c9ced8; }
.app-dialog { width: 100%; max-width: 580rpx; padding: 32rpx; box-sizing: border-box; border: 1px solid var(--overlay-border); border-radius: 12rpx; background: var(--overlay-bg); color: var(--overlay-text); }
.app-dialog-title { display: block; font-size: 30rpx; font-weight: 500; text-align: center; margin-bottom: 24rpx; }
.app-dialog-body { max-height: 50vh; }
.app-dialog-message { display: block; font-size: 27rpx; line-height: 1.7; color: var(--overlay-muted); white-space: pre-wrap; overflow-wrap: anywhere; }
.app-dialog-actions { display: flex; gap: 16rpx; margin-top: 32rpx; }
.app-dialog-button { flex: 1; min-width: 0; margin: 0; padding: 16rpx 8rpx; line-height: 1.4; font-size: 25rpx; border: 1px solid var(--overlay-border); border-radius: 8rpx; background: var(--overlay-bg); color: var(--overlay-text); display: flex; align-items: center; justify-content: center; }
.app-dialog-button::after { border: none; }
.app-dialog-button:active { opacity: 0.65; }
.app-dialog-button[disabled] { opacity: 0.45; }
.app-dialog-button.is-danger { color: #c43d3d; }
.overlay-dark .app-dialog-button.is-danger { color: #f08a8a; }
.app-dialog-input { margin-top: 20rpx; padding: 16rpx; height: 52rpx; font-size: 28rpx; border: 1px solid var(--overlay-border); border-radius: 8rpx; color: var(--overlay-text); }
</style>
