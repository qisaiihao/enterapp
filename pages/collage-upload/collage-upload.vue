<template>
  <view class="collage-upload">
    <!-- 自定义返回按钮 -->
    <view class="custom-back-btn" @tap="goBack">
      <image class="back-icon" src="/static/images/back_to_edit.png" mode="aspectFit"></image>
    </view>

    <!-- 内容区域 -->
    <view class="container">
      <!-- 上传区域 -->
      <view class="upload-section">
        <view class="upload-title">上传拼贴诗图片</view>
        
        <!-- 图片预览区域 -->
        <view class="image-preview-container" v-if="selectedImage">
          <image 
            class="preview-image" 
            :src="selectedImage" 
            mode="aspectFit"
            @tap="previewImage"
          />
          <view class="image-actions">
            <view class="action-btn delete-btn" @tap="removeImage">
              <text>删除</text>
            </view>
          </view>
        </view>
        
        <!-- 上传按钮区域 -->
        <view class="upload-area" v-else @tap="chooseImage">
          <view class="upload-icon">📷</view>
          <text class="upload-text">点击选择图片</text>
          <text class="upload-hint">支持 JPG、PNG 格式</text>
        </view>
        
        <!-- 上传按钮 -->
        <view 
          class="submit-btn" 
          :class="{ 'disabled': !selectedImage || isUploading }"
          @tap="uploadImage"
        >
          <text v-if="isUploading">上传中...</text>
          <text v-else>上传拼贴诗</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
export default {
  data() {
    return {
      selectedImage: '', // 选中的图片路径
      isUploading: false // 是否正在上传
    }
  },
  methods: {
    goBack() {
      uni.navigateBack()
    },
    
    // 选择图片
    chooseImage() {
      uni.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
        success: (res) => {
          this.selectedImage = res.tempFilePaths[0]
        },
        fail: (err) => {
          console.error('选择图片失败:', err)
          // 如果是用户取消，不显示错误提示
          if (err.errMsg && err.errMsg.includes('cancel')) {
            return
          }
          uni.showToast({
            title: '选择图片失败',
            icon: 'none'
          })
        }
      })
    },
    
    // 预览图片
    previewImage() {
      uni.previewImage({
        urls: [this.selectedImage],
        current: this.selectedImage
      })
    },
    
    // 删除图片
    removeImage() {
      this.selectedImage = ''
    },
    
    // 上传图片
    async uploadImage() {
      if (!this.selectedImage) {
        uni.showToast({
          title: '请先选择图片',
          icon: 'none'
        })
        return
      }
      
      if (this.isUploading) {
        return
      }
      
      this.isUploading = true
      
      try {
        // 调用云函数上传
        const result = await uni.cloud.callFunction({
          name: 'uploadCollagePoetry',
          data: {
            imagePath: this.selectedImage
          }
        })
        
        if (result.result && result.result.success) {
          uni.showToast({
            title: '上传成功',
            icon: 'success'
          })
          
          // 清空选择的图片
          this.selectedImage = ''
          
          // 延迟返回上一页
          setTimeout(() => {
            uni.navigateBack()
          }, 1500)
        } else {
          throw new Error(result.result?.message || '上传失败')
        }
      } catch (error) {
        console.error('上传失败:', error)
        uni.showToast({
          title: error.message || '上传失败',
          icon: 'none'
        })
      } finally {
        this.isUploading = false
      }
    }
  }
}
</script>

<style scoped>
.collage-upload {
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

.container {
  background-color: #ffffff;
  min-height: 100vh;
  padding: 140rpx 40rpx 40rpx 40rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
}

.upload-section {
  width: 100%;
  max-width: 600rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.upload-title {
  font-size: 36rpx;
  font-weight: 600;
  color: #333333;
  margin-bottom: 60rpx;
  text-align: center;
}

/* 图片预览区域 */
.image-preview-container {
  width: 100%;
  margin-bottom: 40rpx;
  border-radius: 16rpx;
  overflow: hidden;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.1);
}

.preview-image {
  width: 100%;
  height: 400rpx;
  background-color: #f5f5f5;
}

.image-actions {
  display: flex;
  justify-content: center;
  padding: 20rpx;
  background-color: #ffffff;
}

.action-btn {
  padding: 16rpx 32rpx;
  border-radius: 8rpx;
  font-size: 28rpx;
  cursor: pointer;
  transition: all 0.2s ease;
}

.delete-btn {
  background-color: #ff4757;
  color: #ffffff;
}

.delete-btn:active {
  background-color: #ff3742;
  transform: scale(0.95);
}

/* 上传区域 */
.upload-area {
  width: 100%;
  height: 400rpx;
  border: 2rpx dashed #cccccc;
  border-radius: 16rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background-color: #fafafa;
  margin-bottom: 40rpx;
  transition: all 0.2s ease;
}

.upload-area:active {
  border-color: #9ed7ee;
  background-color: #f0f9ff;
}

.upload-icon {
  font-size: 80rpx;
  margin-bottom: 20rpx;
}

.upload-text {
  font-size: 32rpx;
  color: #333333;
  margin-bottom: 10rpx;
}

.upload-hint {
  font-size: 24rpx;
  color: #999999;
}

/* 上传按钮 */
.submit-btn {
  width: 100%;
  height: 88rpx;
  background: linear-gradient(135deg, #9ed7ee 0%, #7bc4d4 100%);
  border-radius: 44rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  font-size: 32rpx;
  font-weight: 600;
  transition: all 0.2s ease;
  box-shadow: 0 4rpx 20rpx rgba(158, 215, 238, 0.3);
}

.submit-btn:active {
  transform: scale(0.98);
  box-shadow: 0 2rpx 10rpx rgba(158, 215, 238, 0.3);
}

.submit-btn.disabled {
  background: #cccccc;
  box-shadow: none;
  cursor: not-allowed;
}

.submit-btn.disabled:active {
  transform: none;
}
</style>
