<template>
  <view class="container">
    <view class="header">
      <text class="title">测试工具</text>
      <text class="subtitle">开发调试工具集合</text>
    </view>
    
    <view class="menu-list">
      <view class="menu-item" @tap="navigateTo('/pages-debug/test-domain-config/test-domain-config')">
        <view class="menu-content">
          <text class="menu-title">域名配置测试</text>
          <text class="menu-desc">测试云存储域名、CORS、字体加载</text>
        </view>
        <text class="menu-arrow">›</text>
      </view>
      
      <view class="menu-item" @tap="navigateTo('/pages-debug/test-direct-download/test-direct-download')">
        <view class="menu-content">
          <text class="menu-title">字体加载测试</text>
          <text class="menu-desc">测试字体下载、缓存、应用</text>
        </view>
        <text class="menu-arrow">›</text>
      </view>
      
      <view class="menu-item" @tap="navigateTo('/pages-debug/test-cloud-storage/test-cloud-storage')">
        <view class="menu-content">
          <text class="menu-title">云存储文件检查</text>
          <text class="menu-desc">检查云存储中的字体文件状态</text>
        </view>
        <text class="menu-arrow">›</text>
      </view>
    </view>
  </view>
</template>

<script>
export default {
  methods: {
    navigateTo(url) {
      uni.navigateTo({ url });
    }
  }
};
</script>

<style scoped>
.container {
  min-height: 100vh;
  background: #f5f5f5;
  padding: 30rpx;
}

.header {
  text-align: center;
  margin-bottom: 50rpx;
  padding-top: 40rpx;
}

.title {
  font-size: 40rpx;
  font-weight: bold;
  color: #333;
  display: block;
  margin-bottom: 10rpx;
}

.subtitle {
  font-size: 26rpx;
  color: #999;
  display: block;
}

.menu-list {
  background: white;
  border-radius: 12rpx;
  overflow: hidden;
}

.menu-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 30rpx;
  border-bottom: 1rpx solid #f0f0f0;
  transition: background-color 0.2s;
}

.menu-item:last-child {
  border-bottom: none;
}

.menu-item:active {
  background-color: #f5f5f5;
}

.menu-content {
  flex: 1;
}

.menu-title {
  font-size: 32rpx;
  color: #333;
  display: block;
  margin-bottom: 8rpx;
}

.menu-desc {
  font-size: 24rpx;
  color: #999;
  display: block;
}

.menu-arrow {
  font-size: 48rpx;
  color: #ccc;
  font-weight: 300;
}
</style>
