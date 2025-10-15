<template>
  <view class="top-bar-container">
    <!-- 左侧搜索按钮 -->
    <view class="top-bar-left">
      <view class="search-box" @tap="navigateToSearch">
        <view class="search-icon">🔍</view>
        <view class="search-placeholder">搜索帖子...</view>
      </view>
    </view>

    <!-- 右侧功能按钮组 -->
    <view class="top-bar-right">
      <!-- 发帖按钮 -->
      <navigator url="/pages/add/add" class="add-button">
        <view>+</view>
      </navigator>

      <!-- 消息按钮 -->
      <view class="message-icon-container" @tap="navigateToMessages">
        <view class="message-icon">✉️</view>
        <view v-if="unreadMessageCount > 0" class="unread-dot"></view>
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
  height: 88rpx;
  background: #ffffff;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 24rpx;
  z-index: 1000;
}

.top-bar-left {
  flex: 1;
  display: flex;
  align-items: center;
}

.top-bar-right {
  display: flex;
  align-items: center;
  gap: 24rpx;
}

/* 搜索框样式 */
.search-box {
  background: rgba(245, 245, 245, 0.9);
  border-radius: 20rpx;
  padding: 16rpx 20rpx;
  display: flex;
  align-items: center;
  border: 1rpx solid rgba(0, 0, 0, 0.03);
  transition: all 0.2s ease;
  max-width: 400rpx;
  width: 100%;
}

.search-box:active {
  transform: scale(0.98);
  background: rgba(240, 240, 240, 0.9);
}

.search-icon {
  font-size: 28rpx;
  margin-right: 16rpx;
  color: #999;
}

.search-placeholder {
  font-size: 26rpx;
  color: #999;
  flex: 1;
}

/* 发帖按钮 */
.add-button {
  width: 60rpx;
  height: 60rpx;
  background: rgba(135, 206, 235, 0.9);
  backdrop-filter: blur(20rpx);
  -webkit-backdrop-filter: blur(20rpx);
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  color: white;
  font-size: 32rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.1);
  border: 1rpx solid rgba(255, 255, 255, 0.2);
  transition: all 0.2s ease;
}

.add-button:active {
  transform: scale(0.9);
}

/* 消息图标容器 */
.message-icon-container {
  width: 60rpx;
  height: 60rpx;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(20rpx);
  -webkit-backdrop-filter: blur(20rpx);
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.08);
  border: 1rpx solid rgba(255, 255, 255, 0.3);
  transition: all 0.2s ease;
  position: relative;
}

.message-icon-container:active {
  transform: scale(0.95);
  background: rgba(255, 255, 255, 0.8);
}

.message-icon {
  font-size: 28rpx;
  color: #333;
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