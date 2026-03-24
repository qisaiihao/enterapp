<template>
  <view class="container">
    <view class="title">字体下载测试</view>
    
    <view class="section">
      <text class="label">选择字体:</text>
      <picker :value="fontIndex" :range="fontList" @change="onFontChange">
        <view class="picker">{{ fontList[fontIndex] }}</view>
      </picker>
    </view>
    
    <button @click="testFontManager" type="primary">下载并应用字体</button>
    <button @click="testDomainConfig" type="default">测试域名配置</button>
    <button @click="addCustomFont" type="default">添加本地字体</button>
    <button @click="clearCache" type="warn">清除字体缓存</button>
    
    <!-- 示例文字区域 -->
    <view class="sample-text-section">
      <text class="sample-label">字体效果预览:</text>
      <view class="sample-text" :style="{ fontFamily: currentFontFamily }">
        <text>春眠不觉晓，处处闻啼鸟。</text>
        <text>夜来风雨声，花落知多少。</text>
        <text>ABCDEFG abcdefg 1234567890</text>
      </view>
      <text class="font-status">当前字体: {{ currentFontFamily || '默认' }} {{ fontLoaded ? '✅已加载' : '⏳未加载' }}</text>
    </view>
    
    <!-- 字体列表 -->
    <view class="font-list">
      <text class="font-list-title">可用字体:</text>
      <view class="font-item" v-for="font in availableFonts" :key="font.fontFamily">
        <text class="font-name">{{ font.displayName }}</text>
        <text class="font-size">{{ formatSize(font.size) }}</text>
        <text class="font-status-tag" :class="{ cached: font.isCached, loaded: font.isLoaded, custom: font.isCustom }">
          {{ font.isDefault ? '内置' : (font.isCustom ? '自定义' : (font.isCached ? (font.isLoaded ? '已加载' : '已缓存') : '未下载')) }}
        </text>
        <text v-if="font.isCustom" class="delete-btn" @click.stop="deleteCustomFont(font.fontFamily)">删除</text>
      </view>
    </view>
    
    <view class="result" v-if="result">
      <text class="result-title">测试结果:</text>
      <text class="result-text">{{ result }}</text>
    </view>
    
    <view class="log" v-if="logs.length > 0">
      <text class="log-title">日志:</text>
      <text class="log-item" v-for="(log, index) in logs" :key="index">{{ log }}</text>
    </view>
  </view>
</template>

<script>
import fontManager from '@/utils/fontManager.js';

export default {
  data() {
    return {
      fontIndex: 0,
      fontList: ['汇文明朝', '小小皓体', '字体圈欣意吉祥宋', '南西雅致黑', '文楷', '龙藏体'],
      fontFamilyMap: {
        '汇文明朝': '汇文明朝',
        '小小皓体': '小小皓体',
        '字体圈欣意吉祥宋': '字体圈欣意吉祥宋',
        '南西雅致黑': '南西雅致黑',
        '文楷': '文楷',
        '龙藏体': '龙藏体'
      },
      currentFontFamily: '',
      fontLoaded: false,
      availableFonts: [],
      result: '',
      logs: []
    };
  },
  
  onLoad() {
    this.refreshFontList();
  },
  
  methods: {
    onFontChange(e) {
      this.fontIndex = e.detail.value;
    },
    
    addLog(msg) {
      const time = new Date().toLocaleTimeString();
      this.logs.unshift(`[${time}] ${msg}`);
      console.log(msg);
    },
    
    formatSize(bytes) {
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / 1024 / 1024).toFixed(2) + ' MB';
    },
    
    refreshFontList() {
      this.availableFonts = fontManager.getAvailableFonts();
    },
    
    async testDomainConfig() {
      this.result = '';
      this.logs = [];
      this.addLog('🔍 开始测试域名配置...');
      
      try {
        // #ifdef MP-WEIXIN
        const testUrl = 'https://636c-cloud1-5gb0pbyl400845f5-1378788263.tcb.qcloud.la/fonts/Huiwen-mincho-compressed.woff2';
        this.addLog(`测试URL: ${testUrl}`);
        
        // 1. 测试 uni.request
        this.addLog('1️⃣ 测试 uni.request (HEAD)...');
        try {
          const requestRes = await new Promise((resolve, reject) => {
            uni.request({
              url: testUrl,
              method: 'HEAD',
              success: resolve,
              fail: reject
            });
          });
          this.addLog(`✅ uni.request 成功，状态码: ${requestRes.statusCode}`);
        } catch (err) {
          this.addLog(`❌ uni.request 失败: ${err.errMsg}`);
        }
        
        // 2. 测试 wx.cloud.getTempFileURL
        this.addLog('2️⃣ 测试 wx.cloud.getTempFileURL...');
        try {
          const cloudPath = 'cloud://cloud1-5gb0pbyl400845f5.636c-cloud1-5gb0pbyl400845f5-1378788263/fonts/Huiwen-mincho-compressed.woff2';
          const tempRes = await wx.cloud.getTempFileURL({
            fileList: [cloudPath]
          });
          
          if (tempRes.fileList && tempRes.fileList[0]) {
            const tempUrl = tempRes.fileList[0].tempFileURL;
            this.addLog(`✅ 获取临时链接成功`);
            this.addLog(`   临时URL: ${tempUrl}`);
            
            // 3. 测试 uni.loadFontFace
            this.addLog('3️⃣ 测试 uni.loadFontFace...');
            await new Promise((resolve, reject) => {
              uni.loadFontFace({
                family: '测试字体',
                source: `url("${tempUrl}")`,
                global: true,
                success: (res) => {
                  this.addLog(`✅ loadFontFace 成功!`);
                  this.addLog(`   结果: ${JSON.stringify(res)}`);
                  resolve(res);
                },
                fail: (err) => {
                  this.addLog(`❌ loadFontFace 失败: ${err.errMsg}`);
                  this.addLog(`   状态: ${err.status}`);
                  reject(err);
                }
              });
            });
            
            this.result = '✅ 所有测试通过！域名配置正确。';
            this.addLog('🎉 所有测试通过！');
            
          } else {
            throw new Error('未获取到临时链接');
          }
        } catch (err) {
          this.addLog(`❌ 云存储测试失败: ${err.message || err.errMsg}`);
          throw err;
        }
        // #endif
        
        // #ifndef MP-WEIXIN
        this.result = '⚠️ 此测试仅在微信小程序环境有效';
        this.addLog('⚠️ 此测试仅在微信小程序环境有效');
        // #endif
        
      } catch (error) {
        this.result = `❌ 测试失败\n\n可能原因：\n1. 域名未配置或配置错误\n2. 需要在微信公众平台配置 request 合法域名\n3. 域名：https://636c-cloud1-5gb0pbyl400845f5-1378788263.tcb.qcloud.la\n\n错误信息：${error.message || error.errMsg}`;
        this.addLog(`❌ 测试失败: ${error.message || error.errMsg}`);
      }
    },
    
    async testFontManager() {
      this.result = '';
      this.logs = [];
      
      const fontName = this.fontList[this.fontIndex];
      const fontFamily = this.fontFamilyMap[fontName];
      
      this.addLog(`开始加载字体: ${fontName}`);
      
      try {
        const cachedBefore = fontManager.isFontCachedSync(fontFamily);
        this.addLog(`缓存状态: ${cachedBefore ? '已缓存' : '未缓存'}`);
        
        const startTime = Date.now();
        
        this.addLog('调用 ensureFontAvailable...');
        const fontPath = await fontManager.ensureFontAvailable(fontFamily, (progress) => {
          this.addLog(`下载进度: ${progress}%`);
        });
        
        const duration = Date.now() - startTime;
        
        const cachedAfter = fontManager.isFontCachedSync(fontFamily);
        const isLoaded = fontManager.loadedFonts.has(fontFamily);
        
        this.result = `✅ 成功!\n耗时: ${duration}ms\n已缓存: ${cachedAfter}\n已加载: ${isLoaded}`;
        this.addLog(`✅ 完成! 耗时: ${duration}ms`);
        
        // 更新示例文字的字体
        const config = fontManager.getAvailableFonts().find(f => f.fontFamily === fontFamily);
        if (config) {
          this.currentFontFamily = config.displayName;
          this.fontLoaded = isLoaded;
        }
        
        this.refreshFontList();
        
      } catch (error) {
        this.result = `❌ 错误: ${error.message}`;
        this.addLog(`❌ 错误: ${error.message}`);
        console.error('字体加载失败:', error);
      }
    },
    
    async clearCache() {
      this.logs = [];
      this.addLog('清除所有字体缓存...');
      
      try {
        await fontManager.clearAllCache();
        this.addLog('✅ 缓存已清除');
        this.result = '✅ 字体缓存已清除';
        this.currentFontFamily = '';
        this.fontLoaded = false;
        this.refreshFontList();
      } catch (error) {
        this.addLog(`❌ 清除失败: ${error.message}`);
        this.result = `❌ 清除失败: ${error.message}`;
      }
    },
    
    async addCustomFont() {
      this.logs = [];
      this.addLog('选择本地字体文件...');
      
      try {
        const result = await fontManager.addCustomFont();
        this.addLog(`✅ 字体添加成功: ${result.displayName}`);
        this.result = `✅ 自定义字体添加成功!\n字体名: ${result.displayName}\nfontFamily: ${result.fontFamily}`;
        
        // 应用字体
        this.currentFontFamily = result.displayName;
        this.fontLoaded = true;
        this.refreshFontList();
        
      } catch (error) {
        this.addLog(`❌ 添加失败: ${error.message}`);
        this.result = `❌ 添加失败: ${error.message}`;
      }
    },
    
    async deleteCustomFont(fontFamily) {
      try {
        await fontManager.deleteCustomFont(fontFamily);
        this.addLog(`✅ 已删除自定义字体: ${fontFamily}`);
        this.refreshFontList();
        
        if (this.currentFontFamily === fontFamily) {
          this.currentFontFamily = '';
          this.fontLoaded = false;
        }
      } catch (error) {
        this.addLog(`❌ 删除失败: ${error.message}`);
      }
    }
  }
};
</script>

<style scoped>
.container {
  padding: 30rpx;
}

.title {
  font-size: 36rpx;
  font-weight: bold;
  margin-bottom: 40rpx;
  text-align: center;
}

.section {
  margin-bottom: 30rpx;
}

.label {
  display: block;
  margin-bottom: 10rpx;
  font-size: 28rpx;
  color: #666;
}

.picker {
  padding: 20rpx;
  background: #f5f5f5;
  border-radius: 8rpx;
}

button {
  margin-bottom: 20rpx;
}

.sample-text-section {
  margin: 40rpx 0;
  padding: 30rpx;
  background: #fffbeb;
  border-radius: 8rpx;
  border: 2rpx solid #fbbf24;
}

.sample-label {
  display: block;
  font-size: 26rpx;
  color: #92400e;
  margin-bottom: 20rpx;
}

.sample-text {
  font-size: 36rpx;
  line-height: 1.8;
  color: #1f2937;
  text-align: center;
}

.sample-text text {
  display: block;
}

.font-status {
  display: block;
  font-size: 22rpx;
  color: #666;
  margin-top: 20rpx;
  text-align: center;
}

.font-list {
  margin: 30rpx 0;
  padding: 20rpx;
  background: #f9fafb;
  border-radius: 8rpx;
}

.font-list-title {
  display: block;
  font-size: 26rpx;
  font-weight: bold;
  margin-bottom: 20rpx;
  color: #374151;
}

.font-item {
  display: flex;
  align-items: center;
  padding: 16rpx 0;
  border-bottom: 1rpx solid #e5e7eb;
}

.font-item:last-child {
  border-bottom: none;
}

.font-name {
  flex: 1;
  font-size: 26rpx;
  color: #1f2937;
}

.font-size {
  font-size: 22rpx;
  color: #9ca3af;
  margin-right: 20rpx;
}

.font-status-tag {
  font-size: 20rpx;
  padding: 4rpx 12rpx;
  border-radius: 4rpx;
  background: #e5e7eb;
  color: #6b7280;
}

.font-status-tag.cached {
  background: #dbeafe;
  color: #1d4ed8;
}

.font-status-tag.loaded {
  background: #d1fae5;
  color: #047857;
}

.font-status-tag.custom {
  background: #fef3c7;
  color: #92400e;
}

.delete-btn {
  font-size: 20rpx;
  color: #ef4444;
  margin-left: 16rpx;
}

.result {
  margin-top: 40rpx;
  padding: 30rpx;
  background: #f0f9ff;
  border-radius: 8rpx;
  border-left: 4rpx solid #0ea5e9;
}

.result-title {
  display: block;
  font-size: 28rpx;
  font-weight: bold;
  margin-bottom: 10rpx;
  color: #0369a1;
}

.result-text {
  display: block;
  font-size: 24rpx;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
}

.log {
  margin-top: 40rpx;
  padding: 30rpx;
  background: #fafafa;
  border-radius: 8rpx;
  max-height: 400rpx;
  overflow-y: auto;
}

.log-title {
  display: block;
  font-size: 28rpx;
  font-weight: bold;
  margin-bottom: 20rpx;
}

.log-item {
  display: block;
  font-size: 22rpx;
  line-height: 1.8;
  color: #666;
  font-family: monospace;
  margin-bottom: 8rpx;
}
</style>
