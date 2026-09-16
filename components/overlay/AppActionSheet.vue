<template>
  <view v-if="rendered" class="app-sheet-mask" :class="{ 'overlay-dark': isDark === null ? appThemeMode === 'dark' : isDark, 'app-sheet-plain': variant === 'plain', 'app-sheet-enter': motion === 'enter', 'app-sheet-leave': motion === 'leave' }" @tap.stop="answer('cancel')" @touchmove.stop.prevent>
    <view class="app-sheet" role="dialog" :aria-label="title || '选择操作'" @tap.stop>
      <view v-if="variant !== 'plain'" class="app-sheet-header">
        <text class="app-sheet-title">{{ title || '选择操作' }}</text>
        <button class="app-sheet-close" aria-label="关闭" @tap="answer('cancel')">×</button>
      </view>
      <scroll-view class="app-sheet-list" scroll-y @touchmove.stop>
        <slot :select="selectValue">
        <button v-for="(item, index) in displayItems" :key="index" class="app-sheet-item" :class="{ 'is-danger': item.danger }" :disabled="item.disabled" @tap="answer('select', index)">
          <text class="app-sheet-item-text">{{ item.text }}</text>
          <text v-if="item.description" class="app-sheet-item-description">{{ item.description }}</text>
        </button>
        </slot>
      </scroll-view>
      <button class="app-sheet-cancel" @tap="answer('cancel')">{{ cancelText }}</button>
    </view>
  </view>
</template>

<script>
import { registerOverlayDismiss, resolveOverlayOwner, isDangerousOverlayAction } from '@/utils/appOverlay.js';
const LEAVE_DURATION = 180;
export default {
  name: 'AppActionSheet',
  emits: ['cancel', 'select'],
  props: {
    visible: Boolean, title: String,
    items: { type: Array, default: () => [] },
    variant: { type: String, default: 'plain' },
    cancelText: { type: String, default: '取消' },
    isDark: { type: Boolean, default: null }
  },
  data() { return { answered: false, rendered: false, motion: '' }; },
  computed: {
    displayItems() {
      return this.items.map(item => typeof item === 'string'
        ? { text: item, danger: isDangerousOverlayAction(item) }
        : item);
    }
  },
  watch: {
    visible: {
      immediate: true,
      handler(value) {
        // 外部关闭或重开时，撤销尚未完成的操作，避免旧动画触发新页面动作。
        this.pendingAnswer = null;
        if (value) {
          this.clearCloseTimer();
          this.answered = false;
          this.rendered = true;
          this.motion = this.variant === 'plain' ? 'enter' : '';
          this.releaseDismiss?.();
          this.releaseDismiss = registerOverlayDismiss(resolveOverlayOwner(this), () => this.answer('cancel'));
        } else {
          this.closeSheet();
        }
      }
    }
  },
  beforeUnmount() {
    this.clearCloseTimer();
    this.pendingAnswer = null;
    this.releaseDismiss?.();
  },
  methods: {
    // 自定义选择内容也在退出动画结束后提交，保持与列表菜单相同的交互。
    selectValue(value) { this.answer('select', value); },
    clearCloseTimer() {
      if (this.closeTimer) clearTimeout(this.closeTimer);
      this.closeTimer = null;
    },
    closeSheet() {
      this.answered = true;
      if (this.variant !== 'plain' || !this.rendered) {
        this.finishClose();
        return;
      }
      if (this.closeTimer) return;
      this.motion = 'leave';
      this.closeTimer = setTimeout(() => this.finishClose(), LEAVE_DURATION);
    },
    finishClose() {
      this.clearCloseTimer();
      this.rendered = false;
      this.motion = '';
      this.releaseDismiss?.();
      this.releaseDismiss = null;
      const answer = this.pendingAnswer;
      this.pendingAnswer = null;
      // 先移除返回拦截，再通知父组件跳转或展开下一级菜单。
      if (answer) this.$emit(answer.event, answer.index);
    },
    answer(event, index) {
      if (!this.visible || this.answered || (event === 'select' && this.displayItems[index]?.disabled)) return;
      this.answered = true;
      if (this.variant === 'plain') {
        this.pendingAnswer = { event, index };
        this.closeSheet();
      } else {
        this.$emit(event, index);
      }
    }
  }
};
</script>

<style scoped>
.app-sheet-mask { --overlay-bg: #fff; --overlay-text: #171717; --overlay-border: #171717; --overlay-divider: #e5e5e5; position: fixed; inset: 0; z-index: 1000000; background: rgba(0, 0, 0, 0.4); display: flex; align-items: flex-end; }
.overlay-dark { --overlay-bg: #171a20; --overlay-text: #f4f1ea; --overlay-border: #c9ced8; --overlay-divider: #363940; }
.app-sheet-mask { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif; }
.app-sheet { width: 100%; box-sizing: border-box; padding: 28rpx 32rpx calc(24rpx + env(safe-area-inset-bottom)); background: var(--overlay-bg); color: var(--overlay-text); border: 1px solid var(--overlay-border); border-bottom: none; border-radius: 16rpx 16rpx 0 0; }
.app-sheet-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12rpx; }
.app-sheet-title { font-size: 30rpx; font-weight: 500; }
.app-sheet-close { margin: 0; padding: 0; width: 64rpx; height: 64rpx; line-height: 60rpx; font-size: 40rpx; background: transparent; color: var(--overlay-text); }
.app-sheet-list { max-height: 55vh; }
.app-sheet-item { padding: 26rpx 8rpx; margin: 0; font-size: 28rpx; line-height: 1.5; text-align: left; border-radius: 0; border-bottom: 1px solid var(--overlay-divider); background: transparent; color: var(--overlay-text); }
.app-sheet-item.is-danger { color: #c43d3d; }
.overlay-dark .app-sheet-item.is-danger { color: #f08a8a; }
.app-sheet-item[disabled] { opacity: 0.4; }
.app-sheet-cancel { margin: 24rpx 0 0; padding: 14rpx; font-size: 27rpx; line-height: 1.5; background: transparent; color: var(--overlay-text); border: 1px solid var(--overlay-border); border-radius: 8rpx; }
.app-sheet-item:active, .app-sheet-cancel:active, .app-sheet-close:active { opacity: 0.65; }
.app-sheet-item::after, .app-sheet-cancel::after, .app-sheet-close::after { border: none; }
.app-sheet-item-text { display: block; }
.app-sheet-item-description { display: block; margin-top: 6rpx; font-size: 23rpx; line-height: 1.4; color: var(--overlay-muted, #777); }

/* 底部面板统一使用整行操作与独立取消区。 */
.app-sheet-plain { --overlay-bg: #fff; --overlay-text: #262626; --overlay-muted: #929292; --overlay-divider: #f0f0f0; --overlay-gap: #f5f5f5; --overlay-control-bg: #f5f5f5; --overlay-danger: #c43d3d; }
.app-sheet-plain.overlay-dark { --overlay-bg: #27272c; --overlay-text: #d6d6d8; --overlay-muted: #79797e; --overlay-divider: #303035; --overlay-gap: #222226; --overlay-control-bg: #343439; --overlay-danger: #f08a8a; }
.app-sheet-plain .app-sheet { padding: 0; border: none; border-radius: 24rpx 24rpx 0 0; overflow: hidden; }
.app-sheet-plain .app-sheet-list { max-height: 65vh; }
.app-sheet-plain .app-sheet-item { display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%; min-height: 116rpx; padding: 26rpx 32rpx; box-sizing: border-box; text-align: center; font-size: 30rpx; line-height: 1.4; }
.app-sheet-plain .app-sheet-item:last-child { border-bottom: none; }
.app-sheet-plain .app-sheet-item-description { margin-top: 8rpx; font-size: 22rpx; }
.app-sheet-plain .app-sheet-cancel { display: flex; align-items: center; justify-content: center; width: 100%; min-height: 116rpx; margin: 0; padding: 32rpx 32rpx calc(32rpx + env(safe-area-inset-bottom)); box-sizing: border-box; border: none; border-top: 14rpx solid var(--overlay-gap); border-radius: 0; font-size: 30rpx; line-height: 1.4; }

.app-sheet-enter { animation: app-sheet-mask-in 240ms ease-out both; }
.app-sheet-enter .app-sheet { animation: app-sheet-slide-in 240ms cubic-bezier(0.22, 1, 0.36, 1) both; }
.app-sheet-leave { animation: app-sheet-mask-out 180ms ease-in both; }
.app-sheet-leave .app-sheet { animation: app-sheet-slide-out 180ms cubic-bezier(0.4, 0, 1, 1) both; }
.app-sheet-leave .app-sheet-list { pointer-events: none; }
@keyframes app-sheet-mask-in { from { background-color: rgba(0, 0, 0, 0); } to { background-color: rgba(0, 0, 0, 0.4); } }
@keyframes app-sheet-mask-out { from { background-color: rgba(0, 0, 0, 0.4); } to { background-color: rgba(0, 0, 0, 0); } }
@keyframes app-sheet-slide-in { from { transform: translateY(100%); } to { transform: translateY(0); } }
@keyframes app-sheet-slide-out { from { transform: translateY(0); } to { transform: translateY(100%); } }
@media (prefers-reduced-motion: reduce) {
  .app-sheet-enter, .app-sheet-leave, .app-sheet-enter .app-sheet, .app-sheet-leave .app-sheet { animation-duration: 1ms; }
}
</style>
