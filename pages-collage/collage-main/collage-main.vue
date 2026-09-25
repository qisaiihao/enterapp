<template>
  <view class="collage-main" :style="mpNavStyle">
    <!-- 自定义返回按钮 -->
    <view class="custom-back-btn" @tap="goBack">
      <image class="back-icon" src="/static/images/left_exit.png" mode="aspectFit"></image>
    </view>

    <!-- 功能选项 -->
    <view class="options-container">
      <!-- 上传图片 -->
      <view class="option-item" @tap="navigateToUpload">
        <view class="option-bg option-bg-1"></view>
        <view class="option-text">上传图片</view>
      </view>

      <!-- 拼贴创作 -->
      <view class="option-item" @tap="navigateToCompose">
        <view class="option-bg option-bg-2"></view>
        <view class="option-text">拼贴创作</view>
      </view>

      <!-- 图片拼贴 -->
      <view class="option-item" @tap="navigateToCollage">
        <view class="option-bg option-bg-3"></view>
        <view class="option-text">图片拼贴</view>
      </view>

      <!-- 拼贴诗广场 -->
      <view class="option-item" @tap="navigateToSquare">
        <view class="option-bg option-bg-4"></view>
        <view class="option-text">拼贴诗广场</view>
      </view>
    </view>
  </view>
    <app-overlay-host />
</template>

<script>
import { createCollageLogger } from '@/utils/collage/debug.js';
import { getCollageNavStyle } from '@/utils/collage/nav.js';

const log = createCollageLogger('main');

export default {
  data() {
    return {
      mpNavStyle: null
    }
  },
  onLoad() {
    log.info('进入拼贴诗主页');
    this.mpNavStyle = getCollageNavStyle();
  },
  onUnload() {
    log.debug('离开拼贴诗主页');
  },
  methods: {
    goBack() {
      log.debug('返回上一页');
      uni.navigateBack()
    },
    
    // 跳转到上传页面
    navigateToUpload() {
      log.info('打开上传图片页');
      uni.navigateTo({
        url: '/pages-collage/collage-upload/collage-upload'
      })
    },
    
    // 跳转到拼贴创作页面
    navigateToCompose() {
      log.info('打开拼贴创作页');
      uni.navigateTo({ url: '/pages-collage/collage-studio/collage-studio' })
    },
    
    // 跳转到拼贴页面
    navigateToCollage() {
      log.info('打开图片拼贴页');
      uni.navigateTo({ url: '/pages-collage/collage-studio/collage-studio?tab=board' })
    },
    
    // 跳转到拼贴诗广场
    navigateToSquare() {
      log.info('打开拼贴诗广场');
      uni.navigateTo({
        url: '/pages-collage/collage-square/collage-square'
      })
    }
  }
}
</script>

<style scoped>
.collage-main {
  width: 100vw;
  height: 100vh;
  background-color: #ffffff;
  position: relative;
  overflow: hidden;
}

/* 自定义返回按钮 */
.custom-back-btn {
  position: absolute;
  top: calc(90rpx + env(safe-area-inset-top, var(--safe-area-inset-top, 0px)));
  left: 40rpx;
  width: 100rpx;
  height: 100rpx;
  background: transparent;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  transition: all 0.2s ease;
}

/* #ifdef MP-WEIXIN */
/* 小程序端：与胶囊按钮同一行，紧凑靠左，避开刘海屏 */
.custom-back-btn {
  top: var(--collage-nav-top, calc(90rpx + env(safe-area-inset-top, var(--safe-area-inset-top, 0px))));
  left: 24rpx;
  width: 80rpx;
  height: 80rpx;
}
/* #endif */

.custom-back-btn:active {
  transform: scale(0.95);
}

.custom-back-btn .back-icon {
  width: 22rpx;
  height: 38rpx;
  display: block;
  object-fit: contain;
}

/* 功能选项容器 */
.options-container {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  gap: 33px;
  align-items: center;
}

.option-item {
  position: relative;
  width: 233px;
  height: 60px;
  border-radius: 10px;
  box-shadow: 0px 4px 4px 0px rgba(0,0,0,0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.option-item:active {
  transform: scale(0.98);
}

.option-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  border-radius: 10px;
}

.option-bg-1 {
  background-color: rgba(76, 76, 76, 0.2);
}

.option-bg-2 {
  background-color: rgba(76, 76, 76, 0.4);
}

.option-bg-3 {
  background-color: rgba(76, 76, 76, 0.6);
}

.option-bg-4 {
  background-color: rgba(76, 76, 76, 0.8);
}

.option-text {
  position: relative;
  z-index: 1;
  font-size: 16px;
  color: rgba(0, 0, 0, 0.7);
  text-decoration: underline;
  text-underline-offset: 25%;
  letter-spacing: 3.2px;
  font-family: 'Inter', 'Noto Sans SC', 'Noto Sans JP', sans-serif;
  font-weight: normal;
}
</style>
