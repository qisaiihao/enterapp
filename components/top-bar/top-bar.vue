<template>
  <view
    class="top-bar-shell"
    :class="{
      'top-bar-shell--reserve-space': reserveSpace,
      'top-bar-shell--compact': compact,
      'top-bar-shell--wide-rail': isWideRailMode
    }"
    :style="{ '--top-bar-safe-area-top': safeAreaTop + 'px' }"
  >
    <view class="top-bar-container" :class="{ 'top-bar-container--wide-rail': isWideRailMode }">
      <view class="custom-top-bar" :class="{ 'custom-top-bar--wide-rail': isWideRailMode }" :style="customTopBarStyle">
        <view v-if="showLeft && !hideDuplicateNavActions" class="top-left" @tap="navigateToAdd">
          <image class="top-icon" :src="leftIcon" mode="aspectFit"></image>
        </view>
        <slot name="center" />
        <view v-if="showActions && !hideDuplicateNavActions" class="top-right">
          <view class="top-item" @tap="navigateToSearch">
            <image class="top-icon" src="/static/images/newicons/search.png" mode="aspectFit"></image>
          </view>
          <view class="top-item" @tap="navigateToMessages">
            <image class="top-icon" src="/static/images/newicons/notification.png" mode="aspectFit"></image>
            <view v-if="unreadMessageCount > 0" class="unread-dot"></view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import unreadBadge from '@/cache/stores/unread-badge.js';
import { prefetchMessages } from '@/api-cache/messages.js';
import { getMenuButtonBoundingClientRectCompat, getStatusBarHeightCompat, getWindowInfoCompat } from '@/utils/system-info.js';
import { LAYOUT_CHANGED_EVENT, rpxToPx } from '@/utils/layout.js';

function getDefaultStatusBarHeight() {
  // #ifdef H5
  return 0;
  // #endif

  return 44;
}

const DEFAULT_STATUS_BAR_HEIGHT = getDefaultStatusBarHeight();

export default {
  emits: ['safe-area-ready'],
  props: {
    leftIcon: {
      type: String,
      default: '/static/images/write_poetry.png'
    },
    showLeft: {
      type: Boolean,
      default: true
    },
    showActions: {
      type: Boolean,
      default: true
    },
    compact: {
      type: Boolean,
      default: false
    },
    reserveSpace: Boolean,
    adaptToNavRail: {
      type: Boolean,
      default: true
    }
  },
  data() {
    return {
      unreadMessageCount: 0,
      safeAreaTop: DEFAULT_STATUS_BAR_HEIGHT,
      capsuleAvoidRight: 40,
      _unsubscribe: null,
      _layoutUnsub: null
    };
  },
  computed: {
    isWideRailMode() {
      return !!(this.adaptToNavRail && this.hasLeftNavRail);
    },
    hideDuplicateNavActions() {
      return this.isWideRailMode;
    },
    customTopBarStyle() {
      // #ifdef MP-WEIXIN
      return {
        paddingRight: this.capsuleAvoidRight + 'px'
      };
      // #endif

      return {};
    }
  },
  mounted() {
    // 获取安全区域高度
    this.getSafeAreaTop();
    this.updateCapsuleAvoidance();
    // 订阅未读数变化（会立即用当前值回调一次）
    this._unsubscribe = unreadBadge.subscribe((count) => {
      this.unreadMessageCount = count;
    });
    if (typeof uni !== 'undefined' && typeof uni.$on === 'function') {
      this._layoutUnsub = () => {
        this.getSafeAreaTop();
        this.updateCapsuleAvoidance();
      };
      uni.$on(LAYOUT_CHANGED_EVENT, this._layoutUnsub);
    }
    this.refreshUnreadCount();
  },
  beforeUnmount() {
    // 取消订阅
    if (this._unsubscribe) {
      this._unsubscribe();
      this._unsubscribe = null;
    }
    if (this._layoutUnsub && typeof uni !== 'undefined' && typeof uni.$off === 'function') {
      uni.$off(LAYOUT_CHANGED_EVENT, this._layoutUnsub);
      this._layoutUnsub = null;
    }
  },
  // 暴露方法给父组件在 onShow 时调用
  expose: ['refreshUnreadCount', 'forceRefreshUnreadCount'],
  methods: {
    // 获取安全区域高度
    getSafeAreaTop() {
      try {
        const layoutTop = this.appLayout && this.appLayout.safeAreaInsets ? Number(this.appLayout.safeAreaInsets.top) : NaN;
        const rawTop = Number.isFinite(layoutTop) ? layoutTop : Number(getStatusBarHeightCompat() || 0);
        // 横屏下 iOS/H5 状态栏高度可能为 0，仅在非横屏且未拿到值时回退默认高度
        const isLandscape = !!(this.appLayout && this.appLayout.isLandscape);
        const safeAreaTop = rawTop > 0 ? rawTop : (isLandscape ? 0 : DEFAULT_STATUS_BAR_HEIGHT);
        
        this.safeAreaTop = safeAreaTop;
        try {
          if (this.$emit) {
            this.$emit('safe-area-ready', safeAreaTop);
          }
        } catch (_) {}
      } catch (error) {
        this.safeAreaTop = DEFAULT_STATUS_BAR_HEIGHT;
        console.error('【top-bar】获取安全区域失败:', error);
        try {
          if (this.$emit) {
            this.$emit('safe-area-ready', this.safeAreaTop);
          }
        } catch (_) {}
      }
    },

    updateCapsuleAvoidance() {
      // #ifdef MP-WEIXIN
      try {
        const menuRect = getMenuButtonBoundingClientRectCompat();
        const windowInfo = getWindowInfoCompat();
        const windowWidth = Number(windowInfo.windowWidth || windowInfo.screenWidth || 0);
        const menuLeft = Number(menuRect && menuRect.left);
        const menuWidth = Number(menuRect && menuRect.width);
        if (windowWidth > 0 && menuLeft > 0 && menuWidth > 0) {
          this.capsuleAvoidRight = Math.max(40, windowWidth - menuLeft + 12);
          return;
        }
      } catch (error) {
        console.warn('【top-bar】获取小程序胶囊区域失败:', error);
      }
      this.capsuleAvoidRight = rpxToPx(200) || 100;
      // #endif
    },

    // 跳转到写诗页面
    navigateToAdd() {
      uni.navigateTo({
        url: '/pages-publish/add/add',
        fail: (err) => {
          console.error('跳转到add页面失败:', err);
          uni.showToast({
            title: '跳转失败',
            icon: 'none'
          });
        }
      });
    },

    // 跳转到搜索页面
    navigateToSearch() {
      uni.navigateTo({
        url: '/pages-tools/search/search',
        fail: (err) => {
          console.error('跳转到搜索页面失败:', err);
          uni.showToast({
            title: '跳转失败',
            icon: 'none'
          });
        }
      });
    },

    // 跳转到消息页面
    navigateToMessages() {
      prefetchMessages(this);
      uni.navigateTo({
        url: '/pages-tools/messages/messages',
        fail: (err) => {
          console.error('跳转到消息页面失败:', err);
          uni.showToast({
            title: '跳转失败',
            icon: 'none'
          });
        }
      });
    },

    // 刷新未读数（页面 onShow 时调用）
    refreshUnreadCount() {
      this.unreadMessageCount = unreadBadge.getUnreadCount();
      return unreadBadge.refreshUnreadCount({ forceRefresh: false });
    },
    
    // 强制刷新未读数（下拉刷新时调用）
    forceRefreshUnreadCount() {
      return unreadBadge.refreshUnreadCount();
    }
  }
};
</script>

<style>
.top-bar-shell {
  --top-bar-height: 120rpx;
}

.top-bar-shell--reserve-space {
  height: calc(var(--top-bar-safe-area-top) + var(--top-bar-height));
}

.top-bar-shell--compact {
  --top-bar-height: 32rpx;
}

.top-bar-shell--wide-rail {
  --top-bar-height: 52px;
}

.top-bar-shell--wide-rail.top-bar-shell--compact {
  --top-bar-height: 16px;
}

.top-bar-container {
  position: fixed;
  top: var(--top-bar-safe-area-top);
  left: 0;
  right: 0;
  background: var(--app-fixed-bar-bg, #ffffff);
  z-index: 1000;
  border-bottom: none;
  box-shadow: none;
  /* 添加伪元素作为状态栏区域的白色背景 */
}

.top-bar-container--wide-rail {
  left: var(--app-nav-rail-width, 0px);
  right: var(--app-safe-area-right, 0px);
  border-bottom: 1px solid var(--app-border-color, rgba(0, 0, 0, 0.06));
}

.top-bar-container::before {
  content: '';
  position: absolute;
  top: -100vh; /* 向上延伸覆盖状态栏区域 */
  left: 0;
  right: 0;
  height: 100vh;
  background: var(--app-fixed-bar-bg, #ffffff);
  z-index: -1;
}

.custom-top-bar {
  height: var(--top-bar-height);
  box-sizing: border-box;
  display: flex;
  justify-content: space-between;
  padding: 20rpx calc(40rpx + var(--app-safe-area-right, 0px)) 0 calc(40rpx + var(--app-safe-area-left, 0px));
  align-items: center;
  background: var(--app-fixed-bar-bg, #fff);
  border-bottom: none;
  box-shadow: none;
}

.custom-top-bar--wide-rail {
  justify-content: center;
  padding: 0 24px;
}

.top-left {
  display: flex;
  align-items: center;
  cursor: pointer;
  transition: all 0.2s ease;
  padding: 10rpx;
}

.top-left:active {
  transform: scale(0.95);
}

.top-right {
  display: flex;
  align-items: center;
  gap: 40rpx;
  /* #ifdef MP-WEIXIN */
  gap: 12rpx;
  /* #endif */
}

.top-item {
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  padding: 10rpx;
  position: relative;
}

.top-item:active {
  transform: scale(0.95);
}

.top-icon {
  width: 80rpx;
  height: 80rpx;
  filter: var(--app-icon-filter, drop-shadow(0 2rpx 4rpx rgba(0, 0, 0, 0.1)));
}

/* 未读消息红点 */
.unread-dot {
  position: absolute;
  top: 4rpx;
  right: 4rpx;
  width: 16rpx;
  height: 16rpx;
  background-color: #ff6b6b;
  border-radius: 50%;
  border: 2rpx solid #ffffff;
  z-index: 10;
  animation: pulse 2s infinite;
}

/* 红点脉冲动画 */
@keyframes pulse {
  0% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.2);
    opacity: 0.8;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}
</style>
