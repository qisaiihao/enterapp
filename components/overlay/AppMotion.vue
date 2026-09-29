<template>
  <view v-if="rendered" class="app-motion-root" :class="[maskClass, { 'is-dark': maskDark, 'tag-selector-mask--dark': maskDark && maskClass === 'tag-selector-mask' }, 'app-motion-' + placement, 'app-motion-' + motion]" @tap.stop="onMaskTap" @touchmove.stop.prevent>
    <slot />
  </view>
</template>

<script>
import { registerOverlayDismiss, resolveOverlayOwner } from '@/utils/appOverlay.js';

// Keep the exit deadline in sync with styles/overlay-motion.css.
const LEAVE_MS = 120;
export default {
  name: 'AppMotion',
  // No native component layout wrapper; explicit mask props also work without
  // the optional global mergeVirtualHostAttributes compiler setting.
  options: { virtualHost: true },
  inheritAttrs: false,
  emits: ['dismiss'],
  props: {
    visible: Boolean,
    busy: Boolean,
    maskClass: String,
    maskDark: Boolean,
    closeOnMask: Boolean,
    placement: { type: String, default: 'center' }
  },
  data() { return { rendered: false, motion: '' }; },
  watch: {
    visible: {
      immediate: true,
      handler(value) {
        this.pendingDismiss = false;
        this.pendingCallback = null;
        if (value) {
          this.clearTimer();
          this.rendered = true;
          this.motion = 'enter';
          this.releaseDismiss?.();
          this.releaseDismiss = registerOverlayDismiss(resolveOverlayOwner(this), () => this.dismiss());
        } else if (this.rendered) {
          this.leave();
        }
      }
    }
  },
  beforeUnmount() { this.clearTimer(); this.pendingCallback = null; this.releaseDismiss?.(); },
  methods: {
    onMaskTap() { if (this.closeOnMask) this.dismiss(); },
    clearTimer() { clearTimeout(this.closeTimer); this.closeTimer = null; },
    dismiss(callback) {
      if (!this.visible || this.busy || this.motion === 'leave') return;
      this.pendingDismiss = true;
      this.pendingCallback = typeof callback === 'function' ? callback : null;
      this.leave();
    },
    leave() {
      if (this.closeTimer) return;
      this.motion = 'leave';
      this.closeTimer = setTimeout(() => {
        this.clearTimer();
        this.rendered = false;
        this.motion = '';
        this.releaseDismiss?.();
        this.releaseDismiss = null;
        const notify = this.pendingDismiss;
        const callback = this.pendingCallback;
        this.pendingDismiss = false;
        this.pendingCallback = null;
        if (notify) {
          if (callback) callback();
          else this.$emit('dismiss');
        }
      }, LEAVE_MS);
    }
  }
};
</script>
