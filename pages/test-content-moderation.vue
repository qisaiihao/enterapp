<template>
  <view class="container">
    <view class="header">
      <text class="title">内容审核测试</text>
    </view>

    <!-- 文本审核测试 -->
    <view class="section">
      <view class="section-title">📝 文本审核测试</view>
      
      <textarea 
        class="textarea" 
        v-model="textContent" 
        placeholder="输入要审核的文本内容..."
        maxlength="2500"
      />
      
      <view class="char-count">{{ textContent.length }}/2500</view>
      
      <view class="scene-selector">
        <text class="label">场景：</text>
        <picker mode="selector" :range="sceneOptions" :value="textScene" @change="onTextSceneChange">
          <view class="picker">{{ sceneOptions[textScene] }}</view>
        </picker>
      </view>
      
      <button 
        class="btn btn-primary" 
        @click="testTextModeration" 
        :loading="textChecking"
        :disabled="!textContent.trim()"
      >
        {{ textChecking ? '审核中...' : '开始审核文本' }}
      </button>
      
      <view v-if="textResult" class="result" :class="textResult.passed ? 'success' : 'error'">
        <text class="result-icon">{{ textResult.passed ? '✅' : '❌' }}</text>
        <text class="result-text">{{ textResult.message }}</text>
      </view>
    </view>

    <!-- 图片审核测试 -->
    <view class="section">
      <view class="section-title">🖼️ 图片审核测试</view>
      
      <view class="upload-section">
        <button class="btn btn-upload" @click="chooseImage">
          📤 选择图片上传
        </button>
        <text v-if="uploadedImageUrl" class="upload-tip">已上传图片</text>
      </view>
      
      <input 
        class="input" 
        v-model="imageUrl" 
        placeholder="或输入图片URL..."
        type="text"
      />
      
      <view class="scene-selector">
        <text class="label">场景：</text>
        <picker mode="selector" :range="sceneOptions" :value="imageScene" @change="onImageSceneChange">
          <view class="picker">{{ sceneOptions[imageScene] }}</view>
        </picker>
      </view>
      
      <button 
        class="btn btn-primary" 
        @click="testImageModeration" 
        :loading="imageChecking"
        :disabled="!imageUrl.trim()"
      >
        {{ imageChecking ? '审核中...' : '开始审核图片' }}
      </button>
      
      <view v-if="imageResult" class="result" :class="imageResult.passed ? 'success' : 'error'">
        <text class="result-icon">{{ imageResult.passed ? '✅' : '❌' }}</text>
        <text class="result-text">{{ imageResult.message }}</text>
        <text v-if="imageResult.traceId" class="trace-id">Trace ID: {{ imageResult.traceId }}</text>
      </view>
      
      <view v-if="imageUrl" class="image-preview">
        <image :src="imageUrl" mode="aspectFit" @error="onImageError" />
      </view>
    </view>

    <!-- 批量审核测试 -->
    <view class="section">
      <view class="section-title">📦 批量审核测试</view>
      
      <textarea 
        class="textarea small" 
        v-model="batchText" 
        placeholder="输入文本内容..."
      />
      
      <input 
        class="input" 
        v-model="batchImage1" 
        placeholder="图片URL 1（可选）"
        type="text"
      />
      
      <input 
        class="input" 
        v-model="batchImage2" 
        placeholder="图片URL 2（可选）"
        type="text"
      />
      
      <button 
        class="btn btn-primary" 
        @click="testBatchModeration" 
        :loading="batchChecking"
        :disabled="!batchText.trim() && !batchImage1.trim() && !batchImage2.trim()"
      >
        {{ batchChecking ? '审核中...' : '开始批量审核' }}
      </button>
      
      <view v-if="batchResult" class="result" :class="batchResult.passed ? 'success' : 'error'">
        <text class="result-icon">{{ batchResult.passed ? '✅' : '❌' }}</text>
        <text class="result-text">{{ batchResult.message }}</text>
        <text v-if="batchResult.failedType" class="failed-type">失败类型: {{ batchResult.failedType }}</text>
      </view>
    </view>

    <!-- 测试用例 -->
    <view class="section">
      <view class="section-title">🧪 快速测试用例</view>
      
      <view class="test-cases">
        <button class="btn btn-small" @click="fillNormalText">正常文本</button>
        <button class="btn btn-small" @click="fillEmptyText">空文本</button>
        <button class="btn btn-small" @click="fillLongText">超长文本</button>
      </view>
    </view>

    <!-- 日志 -->
    <view class="section">
      <view class="section-title">📋 测试日志</view>
      <view class="logs">
        <view v-for="(log, index) in logs" :key="index" class="log-item">
          <text class="log-time">{{ log.time }}</text>
          <text class="log-content">{{ log.content }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { checkText, checkImage, checkContent } from '@/utils/contentModeration.js';

export default {
  data() {
    return {
      // 文本审核
      textContent: '',
      textScene: 1, // 默认评论场景
      textChecking: false,
      textResult: null,
      
      // 图片审核
      imageUrl: '',
      imageScene: 1,
      imageChecking: false,
      imageResult: null,
      uploadedImageUrl: '', // 上传后的图片URL
      
      // 批量审核
      batchText: '',
      batchImage1: '',
      batchImage2: '',
      batchChecking: false,
      batchResult: null,
      
      // 场景选项
      sceneOptions: ['资料', '评论', '论坛', '社交日志'],
      
      // 日志
      logs: []
    };
  },
  
  methods: {
    // 选择图片
    chooseImage() {
      this.addLog('选择图片...');
      
      uni.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
        success: (res) => {
          const tempFilePath = res.tempFilePaths[0];
          this.addLog('图片已选择，开始上传...');
          this.uploadImage(tempFilePath);
        },
        fail: (error) => {
          console.error('选择图片失败:', error);
          this.addLog('选择图片失败');
          uni.showToast({
            title: '选择图片失败',
            icon: 'none'
          });
        }
      });
    },
    
    // 上传图片到云存储
    async uploadImage(filePath) {
      try {
        uni.showLoading({
          title: '上传中...',
          mask: true
        });
        
        // 生成云存储路径
        const cloudPath = `test-moderation/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
        
        // 上传到云存储
        const uploadResult = await wx.cloud.uploadFile({
          cloudPath: cloudPath,
          filePath: filePath
        });
        
        console.log('上传成功:', uploadResult);
        
        // 获取临时链接
        const tempFileURL = uploadResult.fileID;
        
        // 获取真实的 HTTP URL
        const fileList = await wx.cloud.getTempFileURL({
          fileList: [tempFileURL]
        });
        
        if (fileList.fileList && fileList.fileList.length > 0) {
          const httpUrl = fileList.fileList[0].tempFileURL;
          this.imageUrl = httpUrl;
          this.uploadedImageUrl = httpUrl;
          this.addLog('图片上传成功');
          
          uni.hideLoading();
          uni.showToast({
            title: '上传成功',
            icon: 'success'
          });
        } else {
          throw new Error('获取图片URL失败');
        }
      } catch (error) {
        console.error('上传图片失败:', error);
        this.addLog(`上传失败: ${error.message}`);
        
        uni.hideLoading();
        uni.showToast({
          title: '上传失败，请重试',
          icon: 'none'
        });
      }
    },
    
    // 文本审核
    async testTextModeration() {
      this.textChecking = true;
      this.textResult = null;
      this.addLog('开始文本审核...');
      
      try {
        const result = await checkText(this.textContent, {
          scene: this.textScene + 1, // 场景值从1开始
          title: '测试标题',
          nickname: '测试用户'
        });
        
        this.textResult = result;
        this.addLog(`文本审核完成: ${result.passed ? '通过' : '未通过'} - ${result.message}`);
        
        uni.showToast({
          title: result.message,
          icon: result.passed ? 'success' : 'none',
          duration: 2000
        });
      } catch (error) {
        console.error('文本审核失败:', error);
        this.addLog(`文本审核失败: ${error.message}`);
        uni.showToast({
          title: '审核失败，请重试',
          icon: 'none'
        });
      } finally {
        this.textChecking = false;
      }
    },
    
    // 图片审核
    async testImageModeration() {
      this.imageChecking = true;
      this.imageResult = null;
      this.addLog('开始图片审核...');
      
      try {
        const result = await checkImage(this.imageUrl, {
          scene: this.imageScene + 1
        });
        
        this.imageResult = result;
        this.addLog(`图片审核完成: ${result.passed ? '通过' : '未通过'} - ${result.message}`);
        
        if (result.traceId) {
          this.addLog(`Trace ID: ${result.traceId}`);
        }
        
        uni.showToast({
          title: result.message,
          icon: result.passed ? 'success' : 'none',
          duration: 2000
        });
      } catch (error) {
        console.error('图片审核失败:', error);
        this.addLog(`图片审核失败: ${error.message}`);
        uni.showToast({
          title: '审核失败，请重试',
          icon: 'none'
        });
      } finally {
        this.imageChecking = false;
      }
    },
    
    // 批量审核
    async testBatchModeration() {
      this.batchChecking = true;
      this.batchResult = null;
      this.addLog('开始批量审核...');
      
      try {
        const images = [];
        if (this.batchImage1.trim()) images.push(this.batchImage1);
        if (this.batchImage2.trim()) images.push(this.batchImage2);
        
        const result = await checkContent({
          text: this.batchText,
          images: images
        }, {
          scene: 2,
          title: '批量测试'
        });
        
        this.batchResult = result;
        this.addLog(`批量审核完成: ${result.passed ? '通过' : '未通过'} - ${result.message}`);
        
        if (result.failedType) {
          this.addLog(`失败类型: ${result.failedType}`);
        }
        
        uni.showToast({
          title: result.message,
          icon: result.passed ? 'success' : 'none',
          duration: 2000
        });
      } catch (error) {
        console.error('批量审核失败:', error);
        this.addLog(`批量审核失败: ${error.message}`);
        uni.showToast({
          title: '审核失败，请重试',
          icon: 'none'
        });
      } finally {
        this.batchChecking = false;
      }
    },
    
    // 场景选择
    onTextSceneChange(e) {
      this.textScene = e.detail.value;
    },
    
    onImageSceneChange(e) {
      this.imageScene = e.detail.value;
    },
    
    // 图片加载错误
    onImageError() {
      uni.showToast({
        title: '图片加载失败',
        icon: 'none'
      });
    },
    
    // 快速测试用例
    fillNormalText() {
      this.textContent = '这是一段正常的测试文本，用于测试内容审核功能。';
      this.addLog('填充正常文本');
    },
    
    fillEmptyText() {
      this.textContent = '   ';
      this.addLog('填充空文本（测试验证）');
    },
    
    fillLongText() {
      this.textContent = '测试'.repeat(1300); // 超过2500字符
      this.addLog('填充超长文本（测试长度限制）');
    },
    
    // 添加日志
    addLog(content) {
      const now = new Date();
      const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
      
      this.logs.unshift({
        time,
        content
      });
      
      // 只保留最近20条日志
      if (this.logs.length > 20) {
        this.logs = this.logs.slice(0, 20);
      }
    }
  },
  
  onLoad() {
    this.addLog('测试页面加载完成');
  }
};
</script>

<style scoped>
.container {
  padding: 20rpx;
  background-color: #f5f5f5;
  min-height: 100vh;
}

.header {
  text-align: center;
  padding: 30rpx 0;
}

.title {
  font-size: 40rpx;
  font-weight: bold;
  color: #333;
}

.section {
  background-color: #fff;
  border-radius: 16rpx;
  padding: 30rpx;
  margin-bottom: 20rpx;
}

.section-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 20rpx;
}

.textarea {
  width: 100%;
  min-height: 200rpx;
  padding: 20rpx;
  border: 2rpx solid #e0e0e0;
  border-radius: 8rpx;
  font-size: 28rpx;
  box-sizing: border-box;
}

.textarea.small {
  min-height: 120rpx;
}

.char-count {
  text-align: right;
  font-size: 24rpx;
  color: #999;
  margin-top: 10rpx;
}

.input {
  width: 100%;
  padding: 20rpx;
  border: 2rpx solid #e0e0e0;
  border-radius: 8rpx;
  font-size: 28rpx;
  margin-bottom: 20rpx;
  box-sizing: border-box;
}

.scene-selector {
  display: flex;
  align-items: center;
  margin: 20rpx 0;
}

.label {
  font-size: 28rpx;
  color: #666;
  margin-right: 20rpx;
}

.picker {
  flex: 1;
  padding: 20rpx;
  border: 2rpx solid #e0e0e0;
  border-radius: 8rpx;
  font-size: 28rpx;
}

.btn {
  width: 100%;
  margin-top: 20rpx;
  border-radius: 8rpx;
  font-size: 28rpx;
}

.btn-primary {
  background-color: #07c160;
  color: #fff;
}

.btn-small {
  width: auto;
  padding: 10rpx 30rpx;
  margin: 10rpx;
  font-size: 24rpx;
  background-color: #f0f0f0;
  color: #333;
}

.btn-upload {
  background-color: #1989fa;
  color: #fff;
  margin-bottom: 20rpx;
}

.upload-section {
  margin-bottom: 20rpx;
}

.upload-tip {
  display: block;
  font-size: 24rpx;
  color: #07c160;
  margin-top: 10rpx;
  text-align: center;
}

.result {
  margin-top: 20rpx;
  padding: 20rpx;
  border-radius: 8rpx;
  display: flex;
  flex-direction: column;
}

.result.success {
  background-color: #e7f9f0;
  border: 2rpx solid #07c160;
}

.result.error {
  background-color: #fef0f0;
  border: 2rpx solid #f56c6c;
}

.result-icon {
  font-size: 40rpx;
  margin-bottom: 10rpx;
}

.result-text {
  font-size: 28rpx;
  color: #333;
}

.trace-id,
.failed-type {
  font-size: 24rpx;
  color: #999;
  margin-top: 10rpx;
}

.image-preview {
  margin-top: 20rpx;
  width: 100%;
  height: 400rpx;
  border: 2rpx solid #e0e0e0;
  border-radius: 8rpx;
  overflow: hidden;
}

.image-preview image {
  width: 100%;
  height: 100%;
}

.test-cases {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-start;
}

.logs {
  max-height: 600rpx;
  overflow-y: auto;
}

.log-item {
  padding: 15rpx 0;
  border-bottom: 1rpx solid #f0f0f0;
  display: flex;
  flex-direction: column;
}

.log-time {
  font-size: 24rpx;
  color: #999;
  margin-bottom: 5rpx;
}

.log-content {
  font-size: 26rpx;
  color: #666;
}
</style>
