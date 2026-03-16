<template>
  <view class="container">
    <view class="header">
      <text class="title">域名配置测试</text>
    </view>
    
    <view class="test-section">
      <button @click="testRequest" class="test-btn">1. 测试 request 域名</button>
      <button @click="testDownload" class="test-btn">2. 测试 downloadFile 域名</button>
      <button @click="testCORS" class="test-btn">3. 测试 CORS 配置</button>
      <button @click="testLoadFontCloud" class="test-btn">4. 测试字体加载（云端）</button>
      <button @click="testLoadFontLocal" class="test-btn">5. 测试字体加载（本地）</button>
      <button @click="testAll" class="test-btn primary">🚀 一键全部测试</button>
      <button @click="clearLog" class="clear-btn">清除日志</button>
    </view>
    
    <view class="log-section">
      <text class="log-title">测试日志：</text>
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
      fontUrl: 'https://636c-cloud1-5gb0pbyl400845f5-1378788263.tcb.qcloud.la/fonts/Huiwen-mincho-compressed.woff2'
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
    
    // 测试 request 域名
    async testRequest() {
      this.addLog('========== 测试 request 域名 ==========');
      this.addLog(`目标URL: ${this.fontUrl}`);
      this.addLog('发送 HEAD 请求...');
      
      try {
        const res = await new Promise((resolve, reject) => {
          uni.request({
            url: this.fontUrl,
            method: 'HEAD',
            success: resolve,
            fail: reject
          });
        });
        
        this.addLog(`✅ request 测试成功`);
        this.addLog(`状态码: ${res.statusCode}`);
        this.addLog(`Content-Type: ${res.header['Content-Type'] || res.header['content-type']}`);
        this.addLog(`Content-Length: ${res.header['Content-Length'] || res.header['content-length']}`);
        
        // 检查 CORS 头
        const corsHeader = res.header['Access-Control-Allow-Origin'] || res.header['access-control-allow-origin'];
        if (corsHeader) {
          this.addLog(`✅ CORS 头存在: ${corsHeader}`);
        } else {
          this.addLog(`⚠️ 未检测到 CORS 头（Access-Control-Allow-Origin）`);
        }
        
        if (res.statusCode === 200) {
          this.addLog('🎉 request 合法域名配置正确！');
        } else {
          this.addLog(`⚠️ 状态码异常: ${res.statusCode}`);
        }
        
      } catch (error) {
        this.addLog(`❌ request 测试失败`);
        this.addLog(`错误信息: ${error.errMsg || error.message}`);
        
        if (error.errMsg && error.errMsg.includes('request:fail')) {
          this.addLog('');
          this.addLog('💡 可能的原因：');
          this.addLog('1. request 合法域名未配置');
          this.addLog('2. 域名配置错误（注意是字母l不是数字1）');
          this.addLog('3. 配置后未生效（需要等待几分钟）');
          this.addLog('');
          this.addLog('📝 需要配置的域名：');
          this.addLog('https://636c-cloud1-5gb0pbyl400845f5-1378788263.tcb.qcloud.la');
        }
      }
    },
    
    // 测试 downloadFile 域名
    async testDownload() {
      this.addLog('========== 测试 downloadFile 域名 ==========');
      this.addLog(`目标URL: ${this.fontUrl}`);
      
      try {
        const res = await new Promise((resolve, reject) => {
          const downloadTask = uni.downloadFile({
            url: this.fontUrl,
            success: resolve,
            fail: reject
          });
          
          downloadTask.onProgressUpdate((progress) => {
            this.addLog(`下载进度: ${progress.progress}%`);
          });
        });
        
        this.addLog(`✅ downloadFile 测试成功`);
        this.addLog(`状态码: ${res.statusCode}`);
        this.addLog(`临时文件路径: ${res.tempFilePath}`);
        
        if (res.statusCode === 200) {
          this.addLog('🎉 downloadFile 合法域名配置正确！');
          
          // 检查文件大小
          // #ifdef MP-WEIXIN
          try {
            const fs = uni.getFileSystemManager();
            const stat = fs.statSync(res.tempFilePath);
            this.addLog(`文件大小: ${(stat.size / 1024).toFixed(2)} KB`);
          } catch (e) {
            this.addLog(`无法获取文件信息: ${e.message}`);
          }
          // #endif
        } else {
          this.addLog(`⚠️ 状态码异常: ${res.statusCode}`);
        }
        
      } catch (error) {
        this.addLog(`❌ downloadFile 测试失败`);
        this.addLog(`错误信息: ${error.errMsg || error.message}`);
        
        if (error.errMsg && error.errMsg.includes('downloadFile:fail')) {
          this.addLog('');
          this.addLog('💡 可能的原因：');
          this.addLog('1. downloadFile 合法域名未配置');
          this.addLog('2. 域名配置错误（注意是字母l不是数字1）');
          this.addLog('3. 配置后未生效（需要等待几分钟）');
          this.addLog('');
          this.addLog('📝 需要配置的域名：');
          this.addLog('https://636c-cloud1-5gb0pbyl400845f5-1378788263.tcb.qcloud.la');
        }
      }
    },
    
    // 测试字体加载
    async testLoadFont() {
      this.addLog('========== 测试字体加载 ==========');
      this.addLog(`字体URL: ${this.fontUrl}`);
      
      try {
        // 先下载字体文件
        this.addLog('步骤1: 下载字体文件...');
        const downloadRes = await new Promise((resolve, reject) => {
          uni.downloadFile({
            url: this.fontUrl,
            success: resolve,
            fail: reject
          });
        });
        
        if (downloadRes.statusCode !== 200) {
          throw new Error(`下载失败，状态码: ${downloadRes.statusCode}`);
        }
        
        this.addLog(`✅ 字体文件下载成功`);
        this.addLog(`临时路径: ${downloadRes.tempFilePath}`);
        
        // 加载字体
        this.addLog('步骤2: 加载字体到内存...');
        const loadRes = await new Promise((resolve, reject) => {
          uni.loadFontFace({
            family: '汇文明朝测试',
            source: `url("${this.fontUrl}")`,
            global: true,
            success: resolve,
            fail: reject
          });
        });
        
        this.addLog(`✅ 字体加载成功`);
        this.addLog(`状态: ${loadRes.status}`);
        this.addLog('🎉 字体系统配置完全正确！');
        
      } catch (error) {
        this.addLog(`❌ 字体加载失败`);
        this.addLog(`错误信息: ${error.errMsg || error.message}`);
        
        this.addLog('');
        this.addLog('💡 完整的配置要求：');
        this.addLog('1. request 合法域名');
        this.addLog('2. downloadFile 合法域名');
        this.addLog('3. 云存储文件访问权限设置为公开读');
        this.addLog('');
        this.addLog('📝 域名：');
        this.addLog('https://636c-cloud1-5gb0pbyl400845f5-1378788263.tcb.qcloud.la');
      }
    },
    
    // 测试 CORS 配置
    async testCORS() {
      this.addLog('========== 测试 CORS 配置 ==========');
      this.addLog(`目标URL: ${this.fontUrl}`);
      this.addLog('发送 GET 请求检查 CORS 头...');
      
      try {
        const res = await new Promise((resolve, reject) => {
          uni.request({
            url: this.fontUrl,
            method: 'GET',
            responseType: 'arraybuffer',
            success: resolve,
            fail: reject
          });
        });
        
        this.addLog(`✅ 请求成功，状态码: ${res.statusCode}`);
        this.addLog('');
        this.addLog('📋 响应头信息：');
        
        // 检查所有 CORS 相关的头
        const headers = res.header || {};
        const corsHeaders = [
          'Access-Control-Allow-Origin',
          'access-control-allow-origin',
          'Access-Control-Allow-Methods',
          'access-control-allow-methods',
          'Access-Control-Allow-Headers',
          'access-control-allow-headers'
        ];
        
        let hasCORS = false;
        for (const key of corsHeaders) {
          if (headers[key]) {
            this.addLog(`  ${key}: ${headers[key]}`);
            hasCORS = true;
          }
        }
        
        this.addLog('');
        if (hasCORS) {
          this.addLog('✅ CORS 配置已启用');
          
          const allowOrigin = headers['Access-Control-Allow-Origin'] || headers['access-control-allow-origin'];
          if (allowOrigin === '*' || allowOrigin === 'https://servicewechat.com') {
            this.addLog('🎉 CORS 配置正确！');
            this.addLog(`允许的来源: ${allowOrigin}`);
          } else {
            this.addLog(`⚠️ CORS 配置可能不正确`);
            this.addLog(`当前: ${allowOrigin}`);
            this.addLog(`建议: * 或 https://servicewechat.com`);
          }
        } else {
          this.addLog('❌ 未检测到 CORS 配置');
          this.addLog('');
          this.addLog('💡 需要配置 CORS：');
          this.addLog('1. 登录腾讯云控制台');
          this.addLog('2. 云开发 > 云存储 > 权限设置');
          this.addLog('3. 添加 CORS 规则：');
          this.addLog('   AllowedOrigins: ["*"]');
          this.addLog('   AllowedMethods: ["GET","HEAD"]');
        }
        
        if (res.data) {
          const size = res.data.byteLength || 0;
          this.addLog('');
          this.addLog(`文件大小: ${(size / 1024 / 1024).toFixed(2)} MB`);
        }
        
      } catch (error) {
        this.addLog(`❌ CORS 测试失败`);
        this.addLog(`错误: ${error.errMsg || error.message}`);
      }
    },
    
    // 测试字体加载（云端 URL）
    async testLoadFontCloud() {
      this.addLog('========== 测试字体加载（云端）==========');
      this.addLog(`字体URL: ${this.fontUrl}`);
      this.addLog('⚠️ 直接使用云端 URL，需要 CORS 配置');
      this.addLog('');
      
      try {
        this.addLog('开始加载字体...');
        const startTime = Date.now();
        
        const loadRes = await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('加载超时（30秒）'));
          }, 30000);
          
          uni.loadFontFace({
            family: '汇文明朝测试云端',
            source: `url("${this.fontUrl}")`,
            global: true,
            success: (res) => {
              clearTimeout(timeout);
              resolve(res);
            },
            fail: (err) => {
              clearTimeout(timeout);
              reject(err);
            }
          });
        });
        
        const loadTime = ((Date.now() - startTime) / 1000).toFixed(2);
        this.addLog(`✅ 字体加载成功！耗时: ${loadTime}秒`);
        this.addLog(`状态: ${loadRes.status}`);
        this.addLog('🎉 云端字体加载完全正常！');
        
      } catch (error) {
        this.addLog(`❌ 字体加载失败`);
        this.addLog(`错误: ${error.errMsg || error.message}`);
        this.addLog('');
        
        if (error.errMsg && error.errMsg.includes('network error')) {
          this.addLog('💡 网络错误 - 可能是 CORS 问题');
          this.addLog('请先运行"测试 CORS 配置"');
        } else if (error.message && error.message.includes('超时')) {
          this.addLog('💡 加载超时 - 文件较大（7.9MB）');
        }
      }
    },
    
    // 测试字体加载（本地缓存）
    async testLoadFontLocal() {
      this.addLog('========== 测试字体加载（本地）==========');
      this.addLog('方案：先下载到本地，再加载');
      this.addLog('');
      
      try {
        // #ifdef MP-WEIXIN
        this.addLog('步骤1: 下载字体到本地...');
        const downloadRes = await new Promise((resolve, reject) => {
          const filePath = `${wx.env.USER_DATA_PATH}/test-font.woff2`;
          
          const downloadTask = uni.downloadFile({
            url: this.fontUrl,
            filePath: filePath,
            success: resolve,
            fail: reject
          });
          
          downloadTask.onProgressUpdate((res) => {
            if (res.progress % 20 === 0) {
              this.addLog(`  下载进度: ${res.progress}%`);
            }
          });
        });
        
        if (downloadRes.statusCode !== 200) {
          throw new Error(`下载失败: ${downloadRes.statusCode}`);
        }
        
        const localPath = downloadRes.filePath || downloadRes.tempFilePath;
        this.addLog(`✅ 下载成功: ${localPath}`);
        
        // 检查文件
        const fs = uni.getFileSystemManager();
        const stat = fs.statSync(localPath);
        this.addLog(`文件大小: ${(stat.size / 1024 / 1024).toFixed(2)} MB`);
        
        this.addLog('');
        this.addLog('步骤2: 从本地路径加载字体...');
        const startTime = Date.now();
        
        const loadRes = await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('加载超时（30秒）'));
          }, 30000);
          
          uni.loadFontFace({
            family: '汇文明朝测试本地',
            source: `url("${localPath}")`,
            global: true,
            success: (res) => {
              clearTimeout(timeout);
              resolve(res);
            },
            fail: (err) => {
              clearTimeout(timeout);
              reject(err);
            }
          });
        });
        
        const loadTime = ((Date.now() - startTime) / 1000).toFixed(2);
        this.addLog(`✅ 字体加载成功！耗时: ${loadTime}秒`);
        this.addLog(`状态: ${loadRes.status}`);
        this.addLog('🎉 本地字体加载方案可行！');
        this.addLog('');
        this.addLog('💡 此方案优点：');
        this.addLog('  ✓ 不需要 CORS 配置');
        this.addLog('  ✓ 加载速度快（本地文件）');
        this.addLog('  ✓ 可离线使用');
        // #endif
        
      } catch (error) {
        this.addLog(`❌ 测试失败`);
        this.addLog(`错误: ${error.errMsg || error.message}`);
      }
    },
    
    // 一键全部测试
    async testAll() {
      this.clearLog();
      this.addLog('🚀 开始完整测试流程...');
      this.addLog('');
      
      await this.testRequest();
      this.addLog('');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      await this.testDownload();
      this.addLog('');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      await this.testCORS();
      this.addLog('');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      await this.testLoadFontCloud();
      this.addLog('');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      await this.testLoadFontLocal();
      this.addLog('');
      this.addLog('========== 测试完成 ==========');
    }
  },
  
  onLoad() {
    this.addLog('📱 测试页面加载完成');
    this.addLog('');
    this.addLog('📋 测试说明：');
    this.addLog('1️⃣ 测试 request 域名（检查域名配置）');
    this.addLog('2️⃣ 测试 downloadFile 域名（检查下载权限）');
    this.addLog('3️⃣ 测试 CORS 配置（关键！）');
    this.addLog('4️⃣ 测试云端字体加载（需要 CORS）');
    this.addLog('5️⃣ 测试本地字体加载（备选方案）');
    this.addLog('');
    this.addLog('💡 推荐：点击"一键全部测试"');
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

.test-btn.primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  font-weight: bold;
  font-size: 32rpx;
  padding: 30rpx 0;
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
  max-height: 800rpx;
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
