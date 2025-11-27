<template>
  <view class="collage-square">
    <!-- 自定义返回按钮 -->
    <view class="custom-back-btn" @tap="goBack">
      <image class="back-icon" src="/static/images/back_to_edit.png" mode="aspectFit"></image>
    </view>

    <!-- 双图层清晰背景 -->
    <view class="background-wrapper">
      <image
        :class="'bg-image ' + (item.visible ? 'visible' : '')"
        :src="item.url"
        mode="aspectFill"
        @load="onBackgroundImageLoad"
        :data-layer-index="index"
        v-for="(item, index) in bgLayers"
        :key="index"
      ></image>
    </view>
    
    <!-- 双图层模糊背景 -->
    <view class="blur-background-wrapper">
      <image
        :class="'bg-image blur-image ' + (item.visible ? 'visible' : '')"
        :src="item.url"
        mode="aspectFill"
        @load="onBackgroundImageLoad"
        :data-layer-index="index"
        v-for="(item, index) in bgLayers"
        :key="index"
      ></image>
    </view>

    <!-- 骨架屏 -->
    <view v-if="isLoading && collageList.length === 0" class="skeleton-container">
      <view class="skeleton-wrapper">
        <view class="skeleton-line long skeleton-animate"></view>
        <view class="skeleton-line medium skeleton-animate"></view>
        <view class="skeleton-line short skeleton-animate"></view>
      </view>
    </view>

    <!-- 拼贴诗展示区域 -->
    <view v-if="collageList.length > 0" class="collage-mode-container" @touchstart="touchStart" @touchend="touchEnd">
      <view class="single-collage-content" @tap.stop.prevent="onCollageTap" :data-postid="currentCollage._id">
        <!-- 作者信息 -->
        <view class="single-author-info">
          <image
            class="single-author-avatar"
            :src="currentCollage.authorAvatar || '/static/images/avatar.png'"
            mode="aspectFill"
            @tap.stop.prevent="navigateToUserProfile"
            :data-user-id="currentCollage._openid"
          />
          <text class="single-author-name">{{ currentCollage.authorName }}</text>
        </view>

        <!-- 拼贴诗图片 -->
        <view class="collage-image-container">
          <image 
            class="collage-main-image" 
            :src="currentCollage.imageUrls[0]" 
            mode="aspectFit"
            @tap="previewCollageImage"
          />
        </view>

        <!-- 互动区域 -->
        <view class="collage-actions">
          <view class="action-item" @tap.stop.prevent="onLike" :data-postid="currentCollage._id">
            <image class="action-icon" :src="currentCollage.likeIcon || '/static/images/seed.png'" mode="aspectFit" />
            <text class="action-text">{{ currentCollage.votes || 0 }}</text>
          </view>
          <view class="action-item" @tap.stop.prevent="onComment" :data-postid="currentCollage._id">
            <image class="action-icon" src="/static/images/comment.png" mode="aspectFit" />
            <text class="action-text">{{ currentCollage.commentCount || 0 }}</text>
          </view>
        </view>
      </view>

      <view v-if="collageList.length === 0 && !isLoading" class="empty-state">
        <view class="empty-icon">🎨</view>
        <view class="empty-text">还没有拼贴诗作品</view>
        <view class="empty-subtext">快来创作第一首拼贴诗吧！</view>
      </view>
    </view>
  </view>
</template>

<script>
// 引入云函数调用工具
const { cloudCall } = require('../../utils/cloudCall.js');

export default {
  data() {
    return {
      // 拼贴诗数据
      collageList: [],
      currentCollageIndex: 0,
      currentCollage: null,
      isLoading: false,
      hasMore: true,
      page: 0,
      
      // 双图层背景系统
      bgLayers: [
        { url: '', visible: false },
        { url: '', visible: false }
      ],
      activeLayerIndex: 0,
      preloadedImages: {},
      
      // 触摸相关
      touchStartX: 0,
      touchStartY: 0,
      touchEndX: 0,
      touchEndY: 0,
      isTransitioning: false
    }
  },
  
  onLoad() {
    this.loadCollageList()
  },
  
  methods: {
    goBack() {
      uni.navigateBack()
    },
    
    // 加载拼贴诗列表
    async loadCollageList() {
      if (this.isLoading) return

      console.log('🔍 [拼贴诗广场] 开始加载拼贴诗列表，page:', this.page)
      this.isLoading = true

      try {
        const result = await cloudCall('getCollagePoetry', {
          page: this.page,
          pageSize: 10
        }, { pageTag: 'collage-square', context: this, requireAuth: true })
        
        console.log('🔍 [拼贴诗广场] 云函数调用结果:', result)
        console.log('🔍 [拼贴诗广场] result.result:', result.result)
        
        if (result && result.result && result.result.success) {
          const newCollages = result.result.data || []
          console.log('✅ [拼贴诗广场] 获取到拼贴诗数量:', newCollages.length)
          console.log('✅ [拼贴诗广场] 拼贴诗数据:', newCollages)
          
          if (this.page === 0) {
            this.collageList = newCollages
          } else {
            this.collageList = this.collageList.concat(newCollages)
          }
          
          this.hasMore = newCollages.length === 10
          this.page++
          
          // 如果有数据且是首次加载，设置当前拼贴诗
          if (this.collageList.length > 0 && !this.currentCollage) {
            this.currentCollage = this.collageList[0]
            this.updateBackgroundImage(0)
          }
        } else {
          console.error('❌ [拼贴诗广场] 云函数调用失败:', result)
          console.error('❌ [拼贴诗广场] 失败原因分析:', {
            hasResult: !!result,
            hasResultResult: !!(result && result.result),
            hasSuccess: !!(result && result.result && result.result.success),
            resultStructure: result
          })
        }
      } catch (error) {
        console.error('❌ [拼贴诗广场] 加载拼贴诗失败:', error)
        uni.showToast({
          title: '加载失败',
          icon: 'none'
        })
      } finally {
        this.isLoading = false
      }
    },
    
    // 更新背景图片
    updateBackgroundImage(index) {
      const collage = this.collageList[index]
      if (!collage || !collage.imageUrls || !collage.imageUrls[0]) {
        this.resetBackgroundLayers()
        return
      }
      
      const imageUrl = collage.imageUrls[0]
      
      // 优先使用预加载的本地缓存路径
      let finalImageUrl = this.preloadedImages[imageUrl]
      
      if (!finalImageUrl) {
        finalImageUrl = imageUrl
      }
      
      // 检查是否是首次显示
      const isFirstDisplay = this.bgLayers[0].url === '' && this.bgLayers[1].url === ''
      
      if (isFirstDisplay) {
        // 首次显示：直接设置第一个图层
        this.setData({
          'bgLayers[0].url': finalImageUrl,
          'bgLayers[0].visible': true,
          'bgLayers[1].visible': false,
          activeLayerIndex: 0
        })
        
        // 预加载下一张
        this.preloadNextBackgroundImage(index)
      } else {
        // 后续切换：延迟切换背景图
        setTimeout(() => {
          this.switchBackgroundImage(finalImageUrl)
        }, 100)
        
        // 预加载下一张
        this.preloadNextBackgroundImage(index)
      }
    },
    
    // 双图层切换函数
    switchBackgroundImage(newImageUrl) {
      if (!newImageUrl) {
        this.resetBackgroundLayers()
        return
      }
      
      const preloadedUrl = this.preloadedImages[newImageUrl]
      const finalImageUrl = preloadedUrl || newImageUrl
      
      const currentActiveIndex = this.activeLayerIndex
      const nextActiveIndex = (currentActiveIndex + 1) % 2
      
      // 先设置下一层的图片URL
      this.setData({
        [`bgLayers[${nextActiveIndex}].url`]: finalImageUrl
      })
      
      // 延迟切换可见性
      setTimeout(() => {
        this.setData({
          [`bgLayers[${currentActiveIndex}].visible`]: false,
          [`bgLayers[${nextActiveIndex}].visible`]: true,
          activeLayerIndex: nextActiveIndex
        })
      }, preloadedUrl ? 50 : 150)
    },
    
    // 重置背景图层
    resetBackgroundLayers() {
      this.setData({
        'bgLayers[0].url': '',
        'bgLayers[0].visible': false,
        'bgLayers[1].url': '',
        'bgLayers[1].visible': false,
        activeLayerIndex: 0
      })
    },
    
    // 预加载下一张背景图
    preloadNextBackgroundImage(currentIndex) {
      const nextIndex = currentIndex + 1
      if (nextIndex >= this.collageList.length) {
        if (this.hasMore && !this.isLoading) {
          this.loadCollageList()
        }
        return
      }
      
      const nextCollage = this.collageList[nextIndex]
      if (!nextCollage || !nextCollage.imageUrls || !nextCollage.imageUrls[0]) {
        return
      }
      
      const imageUrl = nextCollage.imageUrls[0]
      
      // 检查是否已预加载
      if (this.preloadedImages[imageUrl]) {
        return
      }
      
      // 预加载图片 - 使用更安全的方式
      try {
        // 对于H5环境，直接使用Image对象预加载
        // #ifdef H5
        const img = new Image()
        img.crossOrigin = 'anonymous' // 设置跨域属性
        img.onload = () => {
          this.setData({
            [`preloadedImages.${imageUrl}`]: imageUrl
          })
        }
        img.onerror = (err) => {
          console.warn('图片预加载失败，将使用原URL:', imageUrl)
        }
        img.src = imageUrl
        // #endif

        // 对于小程序环境，使用downloadFile
        // #ifndef H5
        uni.downloadFile({
          url: imageUrl,
          success: (res) => {
            if (res.statusCode === 200 && res.tempFilePath) {
              this.setData({
                [`preloadedImages.${imageUrl}`]: res.tempFilePath
              })
            }
          },
          fail: (err) => {
            console.warn('图片预加载失败，将使用原URL:', imageUrl)
            // 降级处理：即使预加载失败，也不影响显示
            this.setData({
              [`preloadedImages.${imageUrl}`]: imageUrl
            })
          }
        })
        // #endif
      } catch (error) {
        console.warn('图片预加载异常，将使用原URL:', imageUrl)
        // 降级处理：即使预加载失败，也不影响显示
        this.setData({
          [`preloadedImages.${imageUrl}`]: imageUrl
        })
      }
    },
    
    // 背景图片加载完成
    onBackgroundImageLoad(e) {
      const layerIndex = e.currentTarget.dataset.layerIndex
      console.log(`图层${layerIndex}图片加载完成`)
    },
    
    // 触摸开始
    touchStart(e) {
      this.touchStartX = e.touches[0].clientX
      this.touchStartY = e.touches[0].clientY
    },
    
    // 触摸结束
    touchEnd(e) {
      this.touchEndX = e.changedTouches[0].clientX
      this.touchEndY = e.changedTouches[0].clientY
      
      const diffX = this.touchStartX - this.touchEndX
      const diffY = this.touchStartY - this.touchEndY
      const distance = Math.sqrt(diffX * diffX + diffY * diffY)
      const angle = Math.abs((Math.atan2(Math.abs(diffY), Math.abs(diffX)) * 180) / Math.PI)
      
      // 水平滑动切换
      if (distance > 80 && Math.abs(diffX) > 50 && angle < 45) {
        if (diffX > 0) {
          // 左滑：下一张
          this.nextCollage()
        } else {
          // 右滑：上一张
          this.prevCollage()
        }
      }
    },
    
    // 下一张拼贴诗
    nextCollage() {
      if (this.isTransitioning || this.collageList.length <= 1) return
      
      this.isTransitioning = true
      const nextIndex = (this.currentCollageIndex + 1) % this.collageList.length
      
      this.setData({
        currentCollageIndex: nextIndex,
        currentCollage: this.collageList[nextIndex]
      })
      
      this.updateBackgroundImage(nextIndex)
      
      setTimeout(() => {
        this.isTransitioning = false
      }, 500)
    },
    
    // 上一张拼贴诗
    prevCollage() {
      if (this.isTransitioning || this.collageList.length <= 1) return
      
      this.isTransitioning = true
      const prevIndex = this.currentCollageIndex === 0 ? this.collageList.length - 1 : this.currentCollageIndex - 1
      
      this.setData({
        currentCollageIndex: prevIndex,
        currentCollage: this.collageList[prevIndex]
      })
      
      this.updateBackgroundImage(prevIndex)
      
      setTimeout(() => {
        this.isTransitioning = false
      }, 500)
    },
    
    // 点击拼贴诗
    onCollageTap(e) {
      const postId = e.currentTarget.dataset.postid
      uni.navigateTo({
        url: `/pages/post-detail/post-detail?id=${postId}`
      })
    },
    
    // 预览拼贴诗图片
    previewCollageImage() {
      uni.previewImage({
        urls: this.currentCollage.imageUrls,
        current: this.currentCollage.imageUrls[0]
      })
    },
    
    // 点赞
    onLike(e) {
      const postId = e.currentTarget.dataset.postid
      // 实现点赞逻辑
      console.log('点赞:', postId)
    },
    
    // 评论
    onComment(e) {
      const postId = e.currentTarget.dataset.postid
      uni.navigateTo({
        url: `/pages/post-detail/post-detail?id=${postId}`
      })
    },
    
    // 跳转到用户主页
    navigateToUserProfile(e) {
      const userId = e.currentTarget.dataset.userId
      uni.navigateTo({
        url: `/pages-user/user-profile/user-profile?userId=${userId}`
      })
    }
  }
}
</script>

<style scoped>
.collage-square {
  width: 100vw;
  height: 100vh;
  background-color: #ffffff;
  position: relative;
}

/* 自定义返回按钮 */
.custom-back-btn {
  position: absolute;
  top: calc(90rpx + env(safe-area-inset-top, var(--safe-area-inset-top, 44px)));
  left: 40rpx;
  width: 100rpx;
  height: 100rpx;
  background: transparent;
  border: none;
  display: block;
  z-index: 100;
  transition: all 0.2s ease;
}

.custom-back-btn:active {
  transform: scale(0.95);
}

.custom-back-btn .back-icon {
  width: 100rpx;
  height: 100rpx;
  display: block;
  object-fit: contain;
}

/* 双图层背景系统 */
.background-wrapper,
.blur-background-wrapper {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: -2;
}

.blur-background-wrapper {
  z-index: -1;
  filter: blur(30px) brightness(0.7);
  transform: scale(1.1);
}

.bg-image {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  transition: opacity 0.5s ease-in-out;
}

.bg-image.visible {
  opacity: 1;
}

/* 拼贴诗展示容器 */
.collage-mode-container {
  position: relative;
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 140rpx 20rpx 40rpx 20rpx;
  box-sizing: border-box;
}

.single-collage-content {
  width: 100%;
  max-width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  z-index: 10;
}

/* 作者信息 */
.single-author-info {
  display: flex;
  align-items: center;
  margin-bottom: 40rpx;
  padding: 20rpx 30rpx;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 50rpx;
  backdrop-filter: blur(10rpx);
}

.single-author-avatar {
  width: 60rpx;
  height: 60rpx;
  border-radius: 50%;
  margin-right: 20rpx;
}

.single-author-name {
  font-size: 28rpx;
  color: #333333;
  font-weight: 500;
}

/* 拼贴诗图片容器 - 放大显示 */
.collage-image-container {
  width: 100%;
  max-width: 90%;
  height: 1000rpx;
  border-radius: 20rpx;
  overflow: hidden;
  box-shadow: 0 8rpx 40rpx rgba(0, 0, 0, 0.2);
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10rpx);
  margin-bottom: 40rpx;
}

.collage-main-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

/* 互动区域 */
.collage-actions {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 60rpx;
  padding: 20rpx 40rpx;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 50rpx;
  backdrop-filter: blur(10rpx);
}

.action-item {
  display: flex;
  align-items: center;
  gap: 10rpx;
  padding: 16rpx 24rpx;
  border-radius: 30rpx;
  transition: all 0.2s ease;
}

.action-item:active {
  background: rgba(0, 0, 0, 0.1);
  transform: scale(0.95);
}

.action-icon {
  width: 40rpx;
  height: 40rpx;
}

.action-text {
  font-size: 28rpx;
  color: #333333;
  font-weight: 500;
}

/* 骨架屏 */
.skeleton-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 5;
}

.skeleton-wrapper {
  width: 80%;
  max-width: 500rpx;
}

.skeleton-line {
  height: 20rpx;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 10rpx;
  margin-bottom: 20rpx;
}

.skeleton-line.long {
  width: 100%;
}

.skeleton-line.medium {
  width: 70%;
}

.skeleton-line.short {
  width: 50%;
}

.skeleton-animate {
  animation: skeleton-loading 1.5s ease-in-out infinite;
}

@keyframes skeleton-loading {
  0% { opacity: 0.3; }
  50% { opacity: 0.7; }
  100% { opacity: 0.3; }
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: rgba(255, 255, 255, 0.8);
}

.empty-icon {
  font-size: 120rpx;
  margin-bottom: 30rpx;
}

.empty-text {
  font-size: 32rpx;
  margin-bottom: 15rpx;
  font-weight: 500;
}

.empty-subtext {
  font-size: 28rpx;
  opacity: 0.7;
}
</style>
