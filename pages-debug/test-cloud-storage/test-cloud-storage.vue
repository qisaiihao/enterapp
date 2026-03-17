<template>
  <view class="container">
    <view class="header">
      <text class="title">云存储字体文件检查</text>
    </view>
    
    <view class="test-section">
      <button @click="checkFiles" class="test-btn">检查云存储文件</button>
      <button @click="clearLog" class="clear-btn">清除日志</button>
    </view>
    
    <view class="log-section">
      <text class="log-title">检查结果：</text>
      <view class="log-content">
        <text class="log-item" v-for="(log, index) in logs" :key="index">{{ log }}</text>
      </view>
    </view>
  </view>
</template>

<script>
export default {
  data() {
    return {
      logs: [],
      fontFiles: [
        'Huiwen-mincho.otf',
        'Huiwen-mincho-compressed.woff2',
        'Huiwen-mincho.woff2',
        '汇文明朝.otf',
        '汇文明朝.woff2'
      ]
    };
  },
  
  methods: {
    addLog(msg) {
      const time = new Date().toLocaleTimeString();
      this.logs.push(`[${time}] ${msg}`);
      console.log(msg);
    },
    
    clearLog() {
      this.logs = [];
    },
    
    async checkFiles() {
      this.addLog('========== 开始检查云存储文件 ==========');
      this.addLog('');
      
      for (const filename of this.fontFiles) {
        await this.checkFile(filename);
        this.addLog('');
      }
      
      this.addLog('========== 检查完成 ==========');
    },
    
    async checkFile(filename) {
      const url = `https://636c-cloud1-5gb0pbyl400845f5-1378788263.tcb.qcloud.la/fonts/${filename}`;
      this.addLog(`📁 检查文件: ${filename}`);
      this.addLog(`🔗 URL: ${url}`);
      
      try {
        // 使用 HEAD 请求获取文件信息
        const res = await new Promise((resolve, reject) => {
          wx.request({
            url: url,
            method: 'HEAD',
            success: resolve,
            fail: reject
          });
        });
        
        if (res.statusCode === 200) {
          const contentLength = res.header['Content-Length'] || res.header['content-length'];
          const contentType = res.header['Content-Type'] || res.header['content-type'];
          const sizeKB = (parseInt(contentLength) / 1024).toFixed(2);
          const sizeMB = (parseInt(contentLength) / 1024 / 1024).toFixed(2);
          
          this.addLog(`✅ 文件存在`);
          this.addLog(`   大小: ${contentLength} 字节 (${sizeKB} KB / ${sizeMB} MB)`);
          this.addLog(`   类型: ${contentType}`);
          
          // 判断文件大小是否合理
          if (sizeMB > 5) {
            this.addLog(`   ⚠️ 文件较大，可能导致加载超时`);
          } else if (sizeMB < 0.1) {
            this.addLog(`   ✅ 文件大小合理`);
          }
          
        } else {
          this.addLog(`⚠️ 状态码: ${res.statusCode}`);
        }
        
      } catch (error) {
        this.addLog(`❌ 文件不存在或无法访问`);
        this.addLog(`   错误: ${error.errMsg || error.message}`);
      }
    }
  },
  
  onLoad() {
    this.addLog('页面加载完成');
    this.addLog('点击按钮开始检查云存储中的字体文件');
    this.addLog('');
  }
};
</script>

<style scoped>
.container {
  padding: 30rpx;
  min-height: 100vh;
  background: #f5f5f5;
}

.header {
  text-align: center;
  margin-bottom: 40rpx;
}

.title {
  font-size: 36rpx;
  font-weight: bold;
  color: #333;
}

.test-section {
  margin-bottom: 40rpx;
}

.test-btn {
  width: 100%;
  margin-bottom: 20rpx;
  background: #07c160;
  color: white;
  border-radius: 8rpx;
  font-size: 28rpx;
}

.clear-btn {
  width: 100%;
  background: #ff6b6b;
  color: white;
  border-radius: 8rpx;
  font-size: 28rpx;
}

.log-section {
  background: white;
  border-radius: 12rpx;
  padding: 30rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.1);
}

.log-title {
  font-size: 28rpx;
  font-weight: bold;
  color: #333;
  display: block;
  margin-bottom: 20rpx;
}

.log-content {
  max-height: 1000rpx;
  overflow-y: auto;
}

.log-item {
  display: block;
  font-size: 24rpx;
  line-height: 40rpx;
  color: #666;
  font-family: 'Courier New', monospace;
  word-break: break-all;
  margin-bottom: 10rpx;
}
</style>
