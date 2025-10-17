<template>
  <view class="page-tabs-container" :style="{ top: safeAreaTop + 'px' }">
    <!-- 自定义顶部栏 -->
    <view class="custom-top-bar">
      <view class="top-left" @tap="navigateToAdd">
        <image class="top-icon" src="/static/images/create_post.png" mode="aspectFit"></image>
      </view>
      <view class="top-right">
        <view class="top-item" @tap="navigateToSearch">
          <image class="top-icon" src="/static/images/search.png" mode="aspectFit"></image>
        </view>
        <view class="top-item" @tap="navigateToMessages">
          <image class="top-icon" src="/static/images/messages.png" mode="aspectFit"></image>
        </view>
      </view>
    </view>

    <!-- 页面切换标签栏 -->
    <view class="tabs-container">
      <view class="tabs-list">
        <view
          v-for="(tab, index) in tabs"
          :key="index"
          :class="['tab-item', { active: currentTab === tab.value }]"
          @tap="switchTab(tab.value)"
        >
          <text class="tab-text">{{ tab.label }}</text>
          <view v-if="currentTab === tab.value" class="tab-indicator"></view>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { getUnreadCount } from '@/api-cache/unread.js';

export default {
  name: 'PageTabs',
  props: {
    currentTab: {
      type: String,
      default: 'square'
    }
  },
  data() {
    return {
      unreadMessageCount: 0,
      safeAreaTop: 0,
      tabs: [
        { label: '广场', value: 'square' },
        { label: '发现', value: 'discover' },
        { label: '讨论', value: 'discussion' }
      ]
    };
  },
  mounted() {
    // 检查未读消息数量
    this.checkUnreadMessageCount();
    // 获取安全区域高度
    this.getSafeAreaTop();
  },
  methods: {
    // 获取安全区域高度
    getSafeAreaTop() {
      try {
        const systemInfo = uni.getSystemInfoSync();
        console.log('【page-tabs】获取系统信息:', {
          statusBarHeight: systemInfo.statusBarHeight,
          platform: systemInfo.platform
        });
        
        // 使用状态栏高度作为安全区域
        const safeAreaTop = systemInfo.statusBarHeight || 0;
        console.log('【page-tabs】设置安全区域高度:', safeAreaTop);
        
        this.safeAreaTop = safeAreaTop;
      } catch (error) {
        console.error('【page-tabs】获取安全区域失败:', error);
        // 使用默认值
        this.safeAreaTop = 44; // iOS 默认状态栏高度
      }
    },

    // 切换标签页
    switchTab(tabValue) {
      if (tabValue !== this.currentTab) {
        this.$emit('tab-change', tabValue);
      }
    },

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
.page-tabs-container {
  position: fixed;
  left: 0;
  right: 0;
  background: #ffffff;
  z-index: 1000;
  box-shadow: 0 2rpx 10rpx rgba(0, 0, 0, 0.05);
  /* top 值通过 JavaScript 动态设置 */
  /* 添加伪元素作为状态栏区域的白色背景 */
}

.page-tabs-container::before {
  content: '';
  position: absolute;
  top: -100vh; /* 向上延伸覆盖状态栏区域 */
  left: 0;
  right: 0;
  height: 100vh;
  background: #ffffff;
  z-index: -1;
}

/* 自定义顶部栏样式 */
.custom-top-bar {
  height: 100rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20rpx 40rpx 0 40rpx;
  background: #fff;
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
}

.top-item:active {
  transform: scale(0.95);
}

.top-icon {
  width: 80rpx;
  height: 80rpx;
  filter: drop-shadow(0 2rpx 4rpx rgba(0, 0, 0, 0.1));
}

/* 标签栏样式 */
.tabs-container {
  height: 88rpx;
}

.tabs-list {
  display: flex;
  height: 100%;
  align-items: center;
}

.tab-item {
  flex: 1;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  position: relative;
  transition: all 0.2s ease;
}

.tab-item:active {
  background-color: rgba(0, 0, 0, 0.02);
}

.tab-text {
  font-size: 30rpx;
  color: #666;
  font-weight: 500;
  transition: color 0.2s ease;
}

.tab-item.active .tab-text {
  color: #24375f;
  font-weight: 600;
}

.tab-indicator {
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 60rpx;
  height: 6rpx;
  background: #24375f;
  border-radius: 3rpx;
  transition: all 0.3s ease;
}
</style>
</style>