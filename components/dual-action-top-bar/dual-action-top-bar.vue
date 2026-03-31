<template>
  <view class="dual-action-top-bar">
    <view
      class="dual-action-top-bar__inner"
      :class="{ 'dual-action-top-bar__inner--divider': showDivider }"
      :style="{ paddingTop: safeAreaTop + 'px' }"
    >
      <view v-if="title" class="dual-action-top-bar__title">{{ title }}</view>
      <view class="dual-action-top-bar__actions">
        <view class="dual-action-top-bar__button dual-action-top-bar__button--left" @tap.stop="handleLeftClick">
          <image class="dual-action-top-bar__icon dual-action-top-bar__icon--left" :src="leftIcon" mode="aspectFit"></image>
        </view>
        <view v-if="showRight" class="dual-action-top-bar__button dual-action-top-bar__button--right" @tap.stop="handleRightClick">
          <image class="dual-action-top-bar__icon dual-action-top-bar__icon--right" :src="rightIcon" mode="aspectFit"></image>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
export default {
  name: 'DualActionTopBar',
  emits: ['safe-area-ready', 'left-click', 'right-click'],
  props: {
    leftIcon: {
      type: String,
      default: '/static/images/left_exit.png'
    },
    rightIcon: {
      type: String,
      default: '/static/images/select_more.png'
    },
    showRight: {
      type: Boolean,
      default: true
    },
    title: {
      type: String,
      default: ''
    },
    showDivider: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      safeAreaTop: 0
    };
  },
  mounted() {
    this.initSafeAreaTop();
  },
  methods: {
    initSafeAreaTop() {
      try {
        const systemInfo = uni.getSystemInfoSync();
        const safeAreaTop = systemInfo.statusBarHeight || 0;

        this.safeAreaTop = safeAreaTop;
        this.$emit('safe-area-ready', safeAreaTop);
      } catch (error) {
        console.error('【dual-action-top-bar】获取安全区域失败:', error);
        this.safeAreaTop = 0;
        this.$emit('safe-area-ready', 0);
      }
    },
    handleLeftClick() {
      this.$emit('left-click');
    },
    handleRightClick() {
      this.$emit('right-click');
    }
  }
};
</script>

<style>
.dual-action-top-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  pointer-events: none;
}

.dual-action-top-bar__inner {
  pointer-events: auto;
  position: relative;
  background: #fff;
}

.dual-action-top-bar__inner--divider {
  border-bottom: 1rpx solid #e9ecef;
}

.dual-action-top-bar__title {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 100rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  font-size: 36rpx;
  font-weight: 600;
  color: #333;
}

.dual-action-top-bar__actions {
  height: 100rpx;
  display: flex;
  align-items: center;
  padding-left: 30rpx;
  padding-right: 40rpx;
  box-sizing: border-box;
  position: relative;
  z-index: 1;
  /* #ifdef MP-WEIXIN */
  justify-content: flex-start;
  /* #endif */
  /* #ifndef MP-WEIXIN */
  justify-content: space-between;
  /* #endif */
}

.dual-action-top-bar__button {
  height: 100rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s ease;
}

.dual-action-top-bar__button--left {
  width: 72rpx;
  justify-content: flex-start;
}

.dual-action-top-bar__button--right {
  width: 100rpx;
}

/* #ifdef MP-WEIXIN */
.dual-action-top-bar__button + .dual-action-top-bar__button {
  margin-left: 38rpx;
}
/* #endif */

.dual-action-top-bar__button:active {
  transform: scale(0.95);
}

.dual-action-top-bar__icon {
  display: block;
  object-fit: contain;
}

.dual-action-top-bar__icon--left {
  width: 22rpx;
  height: 38rpx;
}

.dual-action-top-bar__icon--right {
  width: 100rpx;
  height: 100rpx;
}
</style>
