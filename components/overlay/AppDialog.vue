<template>
  <view v-if="rendered" class="app-dialog-mask app-motion-root app-motion-center" :class="[{ 'overlay-dark': appThemeMode === 'dark' }, 'app-motion-' + motion]" @touchmove.stop.prevent @tap="onMaskTap">
    <view class="app-dialog app-motion-panel" :class="{ 'app-dialog--review': requireScrollToConfirm }" role="dialog" :aria-label="title" @tap.stop>
      <text v-if="title" class="app-dialog-title">{{ title }}</text>
      <scroll-view
        :key="reviewBodyKey"
        class="app-dialog-body"
        :class="{ 'app-dialog-body--review': requireScrollToConfirm }"
        scroll-y
        :lower-threshold="requireScrollToConfirm ? 8 : 50"
        @touchmove.stop
        @scrolltolower="unlockScrollConfirm"
      >
        <text v-if="message" class="app-dialog-message">{{ message }}</text>
        <input v-if="editable" v-model="inputValue" class="app-dialog-input" :password="password" :placeholder="placeholder" :focus="visible" />
        <slot />
        <view v-if="requireScrollToConfirm" class="app-dialog-body-end" aria-hidden="true" />
      </scroll-view>
      <text v-if="requireScrollToConfirm" class="app-dialog-scroll-hint" aria-live="polite">{{ scrollConfirmHint }}</text>
      <view class="app-dialog-actions">
        <button v-if="showCancel" class="app-dialog-button" :style="cancelText === '取消' ? null : cancelActionStyle(cancelText)" :disabled="busy" @tap="cancel">{{ cancelText }}</button>
        <button v-if="extraText" class="app-dialog-button" :style="extraText === '取消' ? null : cancelActionStyle(extraText)" @tap="answer('extra')">{{ extraText }}</button>
        <button class="app-dialog-button app-dialog-button--confirm" :class="{ 'is-danger': danger }" :style="confirmText === '取消' ? null : cancelActionStyle(confirmText, appThemeMode, true)" :disabled="confirmDisabled" @tap="answer('confirm')">{{ confirmText }}</button>
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
    visible: Boolean, title: String, message: String, danger: Boolean, deferAnswer: Boolean,
    editable: Boolean, password: Boolean, placeholder: String, extraText: String, busy: Boolean,
    requireScrollToConfirm: Boolean,
    scrollConfirmTimeoutSeconds: { type: Number, default: 0 },
    initialValue: { type: String, default: '' },
    showCancel: { type: Boolean, default: true },
    closeOnMask: { type: Boolean, default: false },
    confirmText: { type: String, default: '确定' },
    cancelText: { type: String, default: '取消' }
  },
  data() { return { inputValue: '', answered: false, rendered: false, motion: '', scrollConfirmUnlocked: false, reviewBodyKey: 0 }; },
  computed: {
    confirmDisabled() {
      return this.busy || (this.requireScrollToConfirm && !this.scrollConfirmUnlocked);
    },
    scrollConfirmHint() {
      if (this.scrollConfirmUnlocked) return '可以继续，请确认是否同意';
      if (this.scrollConfirmTimeoutSeconds > 0) return `请滑至文末，或等待 ${this.scrollConfirmTimeoutSeconds} 秒后继续`;
      return '请滑动至文末后继续';
    }
  },
  watch: {
    busy(value) { if (!value && this.motion !== 'leave') this.answered = false; },
    visible: {
      immediate: true,
      handler(value) {
        this.pendingAnswer = null;
        if (value) {
          this.clearCloseTimer();
          this.rendered = true;
          this.motion = 'enter';
          this.inputValue = this.initialValue;
          this.answered = false;
          this.scrollConfirmUnlocked = false;
          if (this.requireScrollToConfirm) {
            const key = ++this.reviewBodyKey;
            if (this.scrollConfirmTimeoutSeconds > 0) {
              this.scrollConfirmTimer = setTimeout(this.unlockScrollConfirm, this.scrollConfirmTimeoutSeconds * 1000);
            }
            this.$nextTick(() => this.observeBodyEnd(key));
          }
          this.releaseDismiss?.();
          this.releaseDismiss = registerOverlayDismiss(resolveOverlayOwner(this), () => this.cancel());
        } else if (this.rendered) {
          this.closeDialog();
        }
      }
    }
  },
  beforeUnmount() {
    this.reviewBodyKey++;
    this.stopScrollConfirmChecks();
    this.clearCloseTimer();
    this.pendingAnswer = null;
    this.releaseDismiss?.();
  },
  methods: {
    observeBodyEnd(key) {
      if (key !== this.reviewBodyKey || !this.visible || this.motion !== 'enter' || this.scrollConfirmUnlocked) return;
      if (typeof uni.createIntersectionObserver !== 'function') return;
      const observer = uni.createIntersectionObserver(this, { thresholds: [0.5] });
      this.bodyEndObserver = observer;
      observer.relativeTo('.app-dialog-body').observe('.app-dialog-body-end', ({ intersectionRatio }) => {
        if (this.bodyEndObserver === observer && intersectionRatio >= 0.5) this.unlockScrollConfirm();
      });
    },
    stopScrollConfirmChecks() {
      clearTimeout(this.scrollConfirmTimer);
      this.scrollConfirmTimer = null;
      this.bodyEndObserver?.disconnect();
      this.bodyEndObserver = null;
    },
    unlockScrollConfirm() {
      if (!this.requireScrollToConfirm || !this.visible || this.motion !== 'enter' || this.scrollConfirmUnlocked) return;
      this.scrollConfirmUnlocked = true;
      this.stopScrollConfirmChecks();
    },
    clearCloseTimer() { clearTimeout(this.closeTimer); this.closeTimer = null; },
    closeDialog() {
      if (this.closeTimer) return;
      this.stopScrollConfirmChecks();
      this.motion = 'leave';
      this.closeTimer = setTimeout(() => {
        this.clearCloseTimer();
        this.rendered = false;
        this.motion = '';
        this.releaseDismiss?.();
        this.releaseDismiss = null;
        const answer = this.pendingAnswer;
        this.pendingAnswer = null;
        if (answer) this.$emit(answer.event, answer.value);
      }, 120);
    },
    answer(event) {
      if (!this.visible || this.answered || this.busy || this.motion === 'leave') return;
      if (event === 'confirm' && this.confirmDisabled) return;
      this.answered = true;
      if (this.deferAnswer) {
        this.pendingAnswer = { event, value: this.inputValue };
        this.closeDialog();
      } else {
        // Controlled async dialogs submit immediately and remain visible for busy/retry.
        this.$emit(event, this.inputValue);
      }
    },
    cancel() { if (this.showCancel) this.answer('cancel'); },
    onMaskTap() { if (this.closeOnMask) this.cancel(); }
  }
};
</script>

<style scoped>
.app-dialog-mask {
  --overlay-bg: #fff;
  --overlay-text: #333;
  --overlay-muted: #666;
  --overlay-button-bg: #f5f6f7;
  --overlay-button-text: #666;
  --overlay-confirm-bg: #333;
  --overlay-confirm-text: #fff;
  --overlay-danger-bg: #cc9090;
  --overlay-danger-text: #fff;
  --overlay-input-bg: #f8f8f8;
  --overlay-shadow: 0 16rpx 64rpx rgba(0, 0, 0, 0.14);
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
.overlay-dark { --overlay-bg: #27272c; --overlay-text: #f4f1ea; --overlay-muted: #c9ced8; --overlay-button-bg: #343439; --overlay-button-text: #c9ced8; --overlay-confirm-bg: #f4f1ea; --overlay-confirm-text: #27272c; --overlay-input-bg: #343439; --overlay-shadow: 0 16rpx 64rpx rgba(0, 0, 0, 0.3); }
.app-dialog { width: 100%; max-width: 580rpx; max-height: 100%; display: flex; flex-direction: column; padding: 40rpx; box-sizing: border-box; border: none; border-radius: 32rpx; background: var(--overlay-bg); color: var(--overlay-text); box-shadow: var(--overlay-shadow); }
.app-dialog-title { display: block; font-size: 36rpx; font-weight: 600; text-align: center; margin-bottom: 24rpx; }
.app-dialog-body { max-height: 50vh; min-height: 0; }
.app-dialog--review { max-width: 660rpx; }
.app-dialog-body--review { height: 50vh; }
/* Match lower-threshold so the scroll event also waits until the text is visible. */
.app-dialog-body-end { height: 8px; }
.app-dialog-scroll-hint { flex-shrink: 0; margin-top: 20rpx; color: var(--overlay-muted); font-size: 24rpx; line-height: 1.4; text-align: center; }
.app-dialog-title, .app-dialog-actions { flex-shrink: 0; }
.app-dialog-message { display: block; font-size: 28rpx; line-height: 1.6; color: var(--overlay-muted); white-space: pre-wrap; overflow-wrap: anywhere; }
.app-dialog-actions { display: flex; gap: 24rpx; margin-top: 40rpx; }
.app-dialog--review .app-dialog-actions { margin-top: 20rpx; }
.app-dialog-button { flex: 1; min-width: 0; min-height: 88rpx; margin: 0; padding: 16rpx; box-sizing: border-box; line-height: 1.4; font-size: 32rpx; font-weight: 500; border: none; border-radius: 44rpx; background: var(--overlay-button-bg); color: var(--overlay-button-text); display: flex; align-items: center; justify-content: center; white-space: normal; overflow-wrap: anywhere; }
.app-dialog-button--confirm { background: var(--overlay-confirm-bg); color: var(--overlay-confirm-text); }
.app-dialog-button::after { border: none; }
.app-dialog-button:active { opacity: 0.65; }
.app-dialog-button[disabled] { opacity: 0.45; }
.app-dialog--review .app-dialog-button--confirm[disabled] { background: var(--overlay-button-bg); color: var(--overlay-muted); opacity: 0.8; }
.app-dialog-button.is-danger { background: var(--overlay-danger-bg); color: var(--overlay-danger-text); }
.app-dialog-input { margin-top: 20rpx; padding: 16rpx; height: 52rpx; font-size: 28rpx; border: none; border-radius: 12rpx; background: var(--overlay-input-bg); color: var(--overlay-text); }

@media screen and (min-width: 600px) {
  .app-dialog { max-width: 440px; }
  .app-dialog--review { max-width: 520px; }
}

@media screen and (max-height: 500px) {
  .app-dialog-mask { padding: 14px 24px; }
  .app-dialog { padding: 24rpx 32rpx; }
  .app-dialog-title { margin-bottom: 14rpx; }
  .app-dialog-body { max-height: 42vh; }
  .app-dialog-body--review { height: 42vh; }
  .app-dialog-actions { margin-top: 20rpx; }
}
</style>
