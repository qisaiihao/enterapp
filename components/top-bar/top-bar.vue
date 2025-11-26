<template>
  <view class="top-bar-container" :style="{ top: safeAreaTop + 'px' }">
    <!-- 自定义顶部栏 -->
    <view class="custom-top-bar">
      <view class="top-left" @tap="navigateToAdd">
        <image class="top-icon" src="/static/images/write_poetry.png" mode="aspectFit"></image>
      </view>
      <view class="top-right">
        <view class="top-item" @tap="navigateToSearch">
          <image class="top-icon" src="/static/images/search.png" mode="aspectFit"></image>
        </view>
        <view class="top-item" @tap="navigateToMessages">
          <image class="top-icon" src="/static/images/messages.png" mode="aspectFit"></image>
          <view v-if="unreadMessageCount > 0" class="unread-dot"></view>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import unreadBadge from '@/cache/stores/unread-badge.js';

export default {
  data() {
    return {
      unreadMessageCount: 0,
      safeAreaTop: 0,
      _unsubscribe: null
    };
  },
  mounted() {
    // 获取安全区域高度
    this.getSafeAreaTop();
    // 订阅未读数变化（会立即用当前值回调一次）
    this._unsubscribe = unreadBadge.subscribe((count) => {
      this.unreadMessageCount = count;
    });
  },
  beforeDestroy() {
    // 取消订阅
    if (this._unsubscribe) {
      this._unsubscribe();
      this._unsubscribe = null;
    }
  },
  // 暴露方法给父组件在 onShow 时调用
  expose: ['refreshUnreadCount', 'forceRefreshUnreadCount'],
  methods: {
    // 获取安全区域高度
    getSafeAreaTop() {
      try {
        const systemInfo = uni.getSystemInfoSync();
        
        // 使用状态栏高度作为安全区域
        const safeAreaTop = systemInfo.statusBarHeight || 0;
        
        this.safeAreaTop = safeAreaTop;
        try {
          if (this.$emit) {
            this.$emit('safe-area-ready', safeAreaTop);
          }
        } catch (_) {}
      } catch (error) {
        console.error('【top-bar】获取安全区域失败:', error);
        // 使用默认值
        this.safeAreaTop = 44; // iOS 默认状态栏高度
        try {
          if (this.$emit) {
            this.$emit('safe-area-ready', this.safeAreaTop);
          }
        } catch (_) {}
      }
    },

    // 跳转到写诗页面
    navigateToAdd() {
      uni.navigateTo({
        url: '/pages/add/add',
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
        url: '/pages/search/search',
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
      uni.navigateTo({
        url: '/pages/messages/messages',
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
    },
    
    // 强制刷新未读数（下拉刷新时调用）
    forceRefreshUnreadCount() {
      unreadBadge.refreshUnreadCount();
    }
  }
};
</script>

<style>
.top-bar-container {
  position: fixed;
  left: 0;
  right: 0;
  background: #ffffff;
  z-index: 1000;
  border-bottom: none;
  box-shadow: none;
  /* top 值通过 JavaScript 动态设置 */
  /* 添加伪元素作为状态栏区域的白色背景 */
}

.top-bar-container::before {
  content: '';
  position: absolute;
  top: -100vh; /* 向上延伸覆盖状态栏区域 */
  left: 0;
  right: 0;
  height: 100vh;
  background: #ffffff;
  z-index: -1;
}

.custom-top-bar {
  height: 100rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20rpx 40rpx 0 40rpx;
  background: #fff;
  border-bottom: none;
  box-shadow: none;
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
  filter: drop-shadow(0 2rpx 4rpx rgba(0, 0, 0, 0.1));
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
