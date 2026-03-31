<template>
  <view class="collage-square">
    <!-- 自定义返回按钮 -->
    <view class="custom-back-btn" @tap="goBack">
      <image class="back-icon" src="/static/images/left_exit.png" mode="aspectFit"></image>
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
            <image class="action-icon" src="/static/images/newicons/comment.png" mode="aspectFit" />
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
import { getCollageList } from '@/api-cache/collage.js';
import { togglePostLike } from '../../utils/likeService.js';
import likeIcon from '../../utils/likeIcon.js';
import { getLatestLikeStatus } from '@/utils/likeStatusSync.js';

const PAGE_SIZE = 10;

export default {
  data() {
    return {
      collageList: [],
      currentCollageIndex: 0,
      currentCollage: null,
      isLoading: false,
      hasMore: true,
      page: 0,
      bgLayers: [
        { url: '', visible: false },
        { url: '', visible: false }
      ],
      activeLayerIndex: 0,
      preloadedImages: {},
      touchStartX: 0,
      touchStartY: 0,
      touchEndX: 0,
      touchEndY: 0,
      isTransitioning: false,
      votingInProgress: {}
    }
  },

  onLoad() {
    this.bindGlobalEvents()
    this.loadCollageList()
  },

  onShow() {
    this.syncLikeStatusFromCache()
    this.syncCurrentCollageFromList()
  },

  onUnload() {
    this.unbindGlobalEvents()
  },

  methods: {
    bindGlobalEvents() {
      if (!this._likeChangedHandler) {
        this._likeChangedHandler = (payload = {}) => {
          this.onGlobalLikeChanged(payload)
        }
      }
      try { uni.$on && uni.$on('like-changed', this._likeChangedHandler) } catch (_) {}
    },

    unbindGlobalEvents() {
      try { uni.$off && this._likeChangedHandler && uni.$off('like-changed', this._likeChangedHandler) } catch (_) {}
    },

    normalizeCollage(post = {}) {
      const votes = Number(post.votes) || 0
      const isVoted = !!post.isVoted
      return {
        ...post,
        imageUrls: Array.isArray(post.imageUrls) ? post.imageUrls : (post.imageUrls ? [post.imageUrls] : []),
        votes,
        isVoted,
        likeIcon: post.likeIcon || likeIcon.getLikeIcon(votes, isVoted)
      }
    },

    syncCurrentCollageFromList() {
      if (!Array.isArray(this.collageList) || this.collageList.length === 0) {
        this.currentCollage = null
        this.currentCollageIndex = 0
        return
      }

      const nextIndex = Math.min(this.currentCollageIndex, this.collageList.length - 1)
      this.currentCollageIndex = nextIndex
      this.currentCollage = this.collageList[nextIndex]
    },

    syncLikeStatusFromCache() {
      if (!Array.isArray(this.collageList) || this.collageList.length === 0) return

      let changed = false
      const nextList = this.collageList.map((item) => {
        if (!item || !item._id) return item
        const cached = getLatestLikeStatus(item._id)
        if (!cached) return item
        const votes = Number(cached.votes) || 0
        const isVoted = !!cached.isVoted
        if (votes === Number(item.votes || 0) && isVoted === !!item.isVoted) {
          return item
        }
        changed = true
        return {
          ...item,
          votes,
          isVoted,
          likeIcon: likeIcon.getLikeIcon(votes, isVoted)
        }
      })

      if (changed) {
        this.collageList = nextList
      }
      this.syncCurrentCollageFromList()
    },

    onGlobalLikeChanged(payload = {}) {
      const postId = payload.postId
      if (!postId) return

      const index = this.collageList.findIndex(item => item && item._id === postId)
      if (index < 0) return

      const current = this.collageList[index]
      const votes = typeof payload.votes === 'number' ? payload.votes : (Number(current.votes) || 0)
      const isVoted = typeof payload.isLiked === 'boolean' ? payload.isLiked : !!current.isVoted
      const nextList = this.collageList.slice()
      nextList[index] = {
        ...current,
        votes,
        isVoted,
        likeIcon: likeIcon.getLikeIcon(votes, isVoted)
      }
      this.collageList = nextList
      this.syncCurrentCollageFromList()
    },

    goBack() {
      uni.navigateBack()
    },

    async loadCollageList() {
      if (this.isLoading) return
      if (!this.hasMore && this.page > 0) return

      const isFirstPage = this.page === 0
      this.isLoading = true

      try {
        const result = await getCollageList({
          page: this.page,
          pageSize: PAGE_SIZE,
          context: this
        })

        const incoming = (result.posts || []).map((item) => this.normalizeCollage(item))
        if (isFirstPage) {
          this.collageList = incoming
          this.currentCollageIndex = 0
        } else {
          const existingIds = new Set(this.collageList.map(item => item && item._id).filter(Boolean))
          const uniquePosts = incoming.filter(item => item && item._id && !existingIds.has(item._id))
          this.collageList = this.collageList.concat(uniquePosts)
        }

        this.hasMore = !!result.hasMore
        this.page += 1
        this.syncLikeStatusFromCache()
        this.syncCurrentCollageFromList()

        if (isFirstPage && this.currentCollage) {
          this.updateBackgroundImage(this.currentCollageIndex)
        }
      } catch (error) {
        console.error('? [?????] ???????:', error)
        uni.showToast({
          title: '????',
          icon: 'none'
        })
      } finally {
        this.isLoading = false
      }
    },
    
    // ??????
    updateBackgroundImage(index) {
      const collage = this.collageList[index]
      if (!collage || !collage.imageUrls || !collage.imageUrls[0]) {
        this.resetBackgroundLayers()
        return
      }
      
      const imageUrl = collage.imageUrls[0]
      
      let finalImageUrl = this.preloadedImages[imageUrl]
      if (!finalImageUrl) {
        finalImageUrl = imageUrl
      }
      
      const isFirstDisplay = this.bgLayers[0].url === '' && this.bgLayers[1].url === ''
      
      if (isFirstDisplay) {
        this.setData({
          'bgLayers[0].url': finalImageUrl,
          'bgLayers[0].visible': true,
          'bgLayers[1].visible': false,
          activeLayerIndex: 0
        })
        this.preloadNextBackgroundImage(index)
      } else {
        setTimeout(() => {
          this.switchBackgroundImage(finalImageUrl)
        }, 100)
        this.preloadNextBackgroundImage(index)
      }
    },
    
    switchBackgroundImage(newImageUrl) {
      if (!newImageUrl) {
        this.resetBackgroundLayers()
        return
      }
      
      const preloadedUrl = this.preloadedImages[newImageUrl]
      const finalImageUrl = preloadedUrl || newImageUrl
      
      const currentActiveIndex = this.activeLayerIndex
      const nextActiveIndex = (currentActiveIndex + 1) % 2
      
      this.setData({
        [`bgLayers[${nextActiveIndex}].url`]: finalImageUrl
      })
      
      setTimeout(() => {
        this.setData({
          [`bgLayers[${currentActiveIndex}].visible`]: false,
          [`bgLayers[${nextActiveIndex}].visible`]: true,
          activeLayerIndex: nextActiveIndex
        })
      }, preloadedUrl ? 50 : 150)
    },
    
    resetBackgroundLayers() {
      this.setData({
        'bgLayers[0].url': '',
        'bgLayers[0].visible': false,
        'bgLayers[1].url': '',
        'bgLayers[1].visible': false,
        activeLayerIndex: 0
      })
    },
    
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
      if (this.preloadedImages[imageUrl]) {
        return
      }
      
      try {
        // #ifdef H5
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => {
          this.setData({
            [`preloadedImages.${imageUrl}`]: imageUrl
          })
        }
        img.onerror = () => {
          console.warn('????????????URL:', imageUrl)
        }
        img.src = imageUrl
        // #endif

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
          fail: () => {
            console.warn('????????????URL:', imageUrl)
            this.setData({
              [`preloadedImages.${imageUrl}`]: imageUrl
            })
          }
        })
        // #endif
      } catch (error) {
        console.warn('????????????URL:', imageUrl)
        this.setData({
          [`preloadedImages.${imageUrl}`]: imageUrl
        })
      }
    },
    
    onBackgroundImageLoad(e) {
      const layerIndex = e.currentTarget.dataset.layerIndex
      console.log(`??${layerIndex}??????`)
    },
    
    touchStart(e) {
      this.touchStartX = e.touches[0].clientX
      this.touchStartY = e.touches[0].clientY
    },
    
    touchEnd(e) {
      this.touchEndX = e.changedTouches[0].clientX
      this.touchEndY = e.changedTouches[0].clientY
      
      const diffX = this.touchStartX - this.touchEndX
      const diffY = this.touchStartY - this.touchEndY
      const distance = Math.sqrt(diffX * diffX + diffY * diffY)
      const angle = Math.abs((Math.atan2(Math.abs(diffY), Math.abs(diffX)) * 180) / Math.PI)
      
      if (distance > 80 && Math.abs(diffX) > 50 && angle < 45) {
        if (diffX > 0) {
          this.nextCollage()
        } else {
          this.prevCollage()
        }
      }
    },
    
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
    
    onCollageTap(e) {
      const postId = e.currentTarget.dataset.postid
      uni.navigateTo({
        url: `/pages/post-detail/post-detail?id=${postId}`
      })
    },
    
    previewCollageImage() {
      if (!this.currentCollage || !this.currentCollage.imageUrls || this.currentCollage.imageUrls.length === 0) return
      uni.previewImage({
        urls: this.currentCollage.imageUrls,
        current: this.currentCollage.imageUrls[0]
      })
    },
    
    async onLike(e) {
      const postId = e.currentTarget.dataset.postid
      if (!postId || this.votingInProgress[postId]) return

      const current = this.currentCollage || this.collageList.find(item => item && item._id === postId)
      if (!current) return

      this.votingInProgress[postId] = true

      const originalVotes = Number(current.votes) || 0
      const originalIsVoted = !!current.isVoted
      const optimisticVotes = originalIsVoted ? Math.max(0, originalVotes - 1) : originalVotes + 1

      this.onGlobalLikeChanged({
        postId,
        votes: optimisticVotes,
        isLiked: !originalIsVoted
      })

      try {
        const result = await togglePostLike(postId, {
          pageTag: 'collage-square',
          context: this,
          currentVotes: originalVotes,
          currentIsLiked: originalIsVoted,
          requireAuth: true
        })

        if (!result || !result.success) {
          throw new Error('????')
        }

        this.onGlobalLikeChanged({
          postId,
          votes: result.votes,
          isLiked: result.isLiked
        })
      } catch (error) {
        this.onGlobalLikeChanged({
          postId,
          votes: originalVotes,
          isLiked: originalIsVoted
        })
      } finally {
        this.votingInProgress[postId] = false
      }
    },
    
    onComment(e) {
      const postId = e.currentTarget.dataset.postid
      uni.navigateTo({
        url: `/pages/post-detail/post-detail?id=${postId}`
      })
    },
    
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

.custom-back-btn:active {
  transform: scale(0.95);
}

.custom-back-btn .back-icon {
  width: 22rpx;
  height: 38rpx;
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
