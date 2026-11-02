<template>
  <view v-if="items.length" :class="['poem-stack-wrap', 'poem-stack-wrap--' + variant]" @touchmove.stop.prevent>
    <view class="poem-stack" @touchstart="onTouchStart" @touchend="onTouchEnd" @touchcancel="onTouchCancel">
      <view
        v-for="(card, stackIndex) in visibleCards"
        :key="card._id || card.postId || card.id || stackIndex"
        :class="['poem-stack-card', 'poem-stack-card-' + (stackIndex + 1), { 'is-shuffling': animating }]"
        :style="cardStyle ? cardStyle(card, stackIndex) : { backgroundColor: card.backgroundColor || '#f1d5bf' }"
        @tap="onCardTap(card, stackIndex)"
      >
        <slot v-if="stackIndex === 0" name="front" :card="card" />
      </view>
    </view>
  </view>
</template>

<script>
export default {
  name: 'PoemStack',
  props: {
    items: { type: Array, default: () => [] },
    current: { type: Number, default: 0 },
    variant: { type: String, default: 'weekly' },
    cardStyle: { type: Function, default: null }
  },
  emits: ['shift', 'select'],
  data: () => ({ touchX: null, touchY: null, lastShiftAt: 0, animating: false, animationTimer: null }),
  computed: {
    visibleCards() {
      const total = this.items.length;
      if (!total) return [];
      const start = ((this.current % total) + total) % total;
      return Array.from({ length: Math.min(4, total) }, (_, offset) => this.items[(start + offset) % total]);
    }
  },
  watch: {
    current() {
      this.animating = true;
      clearTimeout(this.animationTimer);
      this.animationTimer = setTimeout(() => { this.animating = false; }, 180);
    }
  },
  beforeUnmount() { clearTimeout(this.animationTimer); },
  methods: {
    onTouchStart(event) {
      const touch = event?.changedTouches?.[0];
      if (!touch) return;
      this.touchX = touch.clientX ?? touch.pageX ?? 0;
      this.touchY = touch.clientY ?? touch.pageY ?? 0;
    },
    onTouchEnd(event) {
      const touch = event?.changedTouches?.[0];
      if (!touch || this.touchX === null || this.items.length <= 1) return this.onTouchCancel();
      const deltaX = (touch.clientX ?? touch.pageX ?? 0) - this.touchX;
      const deltaY = (touch.clientY ?? touch.pageY ?? 0) - this.touchY;
      this.onTouchCancel();
      if (Math.abs(deltaX) < 42 || Math.abs(deltaX) < Math.abs(deltaY) * 1.15) return;
      this.lastShiftAt = Date.now();
      this.$emit('shift', deltaX < 0 ? 1 : -1);
    },
    onTouchCancel() { this.touchX = null; this.touchY = null; },
    onCardTap(card, index) { if (index === 0 && Date.now() - this.lastShiftAt > 250) this.$emit('select', card); }
  }
};
</script>

<style scoped>
.poem-stack-wrap { touch-action: none; }
.poem-stack { position: relative; margin: 0 auto; }
.poem-stack-card { position: absolute; box-sizing: border-box; overflow: hidden; border-radius: 14rpx; transition: left .18s ease, bottom .18s ease, width .18s ease, height .18s ease, transform .18s ease; }
.poem-stack-card.is-shuffling { transform: scale(.992); }
.poem-stack-wrap--weekly { padding-top: 44rpx; }
.poem-stack-wrap--weekly .poem-stack { width: 550rpx; height: 650rpx; }
.poem-stack-wrap--weekly .poem-stack-card { border: 10rpx solid; }
.poem-stack-wrap--weekly .poem-stack-card-1 { left: 0; bottom: 0; z-index: 5; width: 484rpx; height: 536rpx; cursor: pointer; }
.poem-stack-wrap--weekly .poem-stack-card-2 { left: 40rpx; bottom: 52rpx; z-index: 4; width: 466rpx; height: 516rpx; }
.poem-stack-wrap--weekly .poem-stack-card-3 { left: 80rpx; bottom: 104rpx; z-index: 3; width: 448rpx; height: 496rpx; }
.poem-stack-wrap--weekly .poem-stack-card-4 { left: 120rpx; bottom: 156rpx; z-index: 2; width: 430rpx; height: 476rpx; }
.poem-stack-wrap--society .poem-stack { width: 100%; height: 334rpx; }
.poem-stack-wrap--society .poem-stack-card { width: calc(100% - 58rpx); height: 286rpx; border: 0; }
.poem-stack-wrap--society .poem-stack-card-1 { left: 0; bottom: 0; z-index: 5; }
.poem-stack-wrap--society .poem-stack-card-2 { left: 16rpx; bottom: 12rpx; z-index: 4; }
.poem-stack-wrap--society .poem-stack-card-3 { left: 34rpx; bottom: 23rpx; z-index: 3; }
.poem-stack-wrap--society .poem-stack-card-4 { left: 52rpx; bottom: 34rpx; z-index: 2; }
</style>
