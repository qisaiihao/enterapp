<template>
  <view class="top-bar-container">
    <!-- 自定义顶部栏 -->
    <view class="custom-top-bar">
      <view class="top-left" @tap="navigateToAdd">
        <image class="top-icon" src="/static/images/写诗.png" mode="aspectFit"></image>
      </view>
      <view class="top-right">
        <view class="top-item" @tap="navigateToSearch">
          <image class="top-icon" src="/static/images/搜索.png" mode="aspectFit"></image>
        </view>
        <view class="top-item" @tap="navigateToMessages">
          <image class="top-icon" src="/static/images/消息.png" mode="aspectFit"></image>
          <view v-if="unreadMessageCount > 0" class="unread-dot"></view>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { getUnreadCount } from '@/api-cache/unread.js';

export default {
  data() {
    return {
      unreadMessageCount: 0
    };
  },
  mounted() {
    // 检查未读消息数量
    this.checkUnreadMessageCount();
  },
  methods: {
    // 跳转到写诗页面
    navigateToAdd() {
      console.log('点击写诗按钮，跳转到add页面');
      uni.navigateTo({
        url: '/pages/add/add',
        success: () => {
          console.log('跳转到add页面成功');
        },
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
      console.log('点击搜索框，跳转到搜索页面');
      uni.navigateTo({
        url: '/pages/search/search',
        success: () => {
          console.log('跳转到搜索页面成功');
        },
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
        success: () => {
          console.log('跳转到消息页面成功');
        },
        fail: (err) => {
          console.error('跳转到消息页面失败:', err);
          uni.showToast({
            title: '跳转失败',
            icon: 'none'
          });
        }
      });
    },

    // 检查未读消息数量
    checkUnreadMessageCount() {
      getUnreadCount(this).then((n) => {
        this.unreadMessageCount = n || 0;
      }).catch(() => {});
    }
  }
};
</script>

<style>
.top-bar-container {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 100rpx;
  background: #ffffff;
  z-index: 1000;
  border-bottom: none;
  box-shadow: none;
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
  background-color: #ff4757;
  border-radius: 50%;
  border: 2rpx solid #fff;
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