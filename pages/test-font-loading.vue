<template>
    <view class="container">
        <view class="header">
            <text class="title">汇文明朝字体加载测试</text>
        </view>
        
        <view class="status-card">
            <view class="status-item">
                <text class="label">字体状态：</text>
                <text :class="'value ' + (fontLoaded ? 'success' : 'loading')">
                    {{ fontLoaded ? '✅ 已加载' : '⏳ 加载中...' }}
                </text>
            </view>
            
            <view class="status-item">
                <text class="label">下载进度：</text>
                <text class="value">{{ downloadProgress }}%</text>
            </view>
            
            <view class="status-item">
                <text class="label">缓存状态：</text>
                <text class="value">{{ isCached ? '✅ 已缓存' : '❌ 未缓存' }}</text>
            </view>
        </view>
        
        <view class="preview-card">
            <text class="preview-title">字体预览</text>
            <view class="preview-content">
                <text class="preview-text default-font">默认字体：春江潮水连海平，海上明月共潮生</text>
                <text class="preview-text custom-font">汇文明朝：春江潮水连海平，海上明月共潮生</text>
            </view>
        </view>
        
        <view class="actions">
            <button class="btn" @tap="checkFontStatus">检查字体状态</button>
            <button class="btn" @tap="reloadFont">重新加载字体</button>
            <button class="btn danger" @tap="clearCache">清除缓存</button>
        </view>
        
        <view class="info-card">
            <text class="info-title">说明</text>
            <text class="info-text">• 小程序首次启动时会从云端下载汇文明朝字体</text>
            <text class="info-text">• 下载完成前使用微信默认字体</text>
            <text class="info-text">• 下载完成后自动切换到汇文明朝</text>
            <text class="info-text">• 字体会永久缓存在本地，下次启动直接使用</text>
        </view>
    </view>
</template>

<script>
import fontManager from '@/utils/fontManager.js';

export default {
    data() {
        return {
            fontLoaded: false,
            downloadProgress: 0,
            isCached: false
        };
    },
    
    onLoad() {
        this.checkFontStatus();
    },
    
    methods: {
        async checkFontStatus() {
            try {
                // 检查是否已缓存
                this.isCached = await fontManager.isFontCached('汇文明朝');
                
                // 检查是否已加载到内存
                this.fontLoaded = fontManager.loadedFonts.has('汇文明朝');
                
                console.log('字体状态:', {
                    cached: this.isCached,
                    loaded: this.fontLoaded
                });
                
                // 如果未加载，尝试加载
                if (!this.fontLoaded) {
                    await this.loadFont();
                }
            } catch (error) {
                console.error('检查字体状态失败:', error);
                uni.showToast({
                    title: '检查失败',
                    icon: 'none'
                });
            }
        },
        
        async loadFont() {
            try {
                uni.showLoading({ title: '加载字体中...' });
                
                await fontManager.ensureFontAvailable('汇文明朝', (progress) => {
                    this.downloadProgress = progress;
                    console.log(`字体下载进度: ${progress}%`);
                });
                
                this.fontLoaded = true;
                this.isCached = true;
                
                uni.hideLoading();
                uni.showToast({
                    title: '字体加载成功',
                    icon: 'success'
                });
                
                // 强制页面重新渲染以应用新字体
                this.$forceUpdate();
            } catch (error) {
                console.error('加载字体失败:', error);
                uni.hideLoading();
                uni.showToast({
                    title: '加载失败: ' + error.message,
                    icon: 'none'
                });
            }
        },
        
        async reloadFont() {
            this.fontLoaded = false;
            this.downloadProgress = 0;
            await this.loadFont();
        },
        
        async clearCache() {
            uni.showModal({
                title: '确认清除',
                content: '确定要清除字体缓存吗？下次启动需要重新下载。',
                success: async (res) => {
                    if (res.confirm) {
                        try {
                            await fontManager.deleteFontCache('汇文明朝');
                            this.isCached = false;
                            this.fontLoaded = false;
                            this.downloadProgress = 0;
                            
                            uni.showToast({
                                title: '缓存已清除',
                                icon: 'success'
                            });
                        } catch (error) {
                            console.error('清除缓存失败:', error);
                            uni.showToast({
                                title: '清除失败',
                                icon: 'none'
                            });
                        }
                    }
                }
            });
        }
    }
};
</script>

<style scoped>
.container {
    padding: 40rpx;
    background: #f5f5f5;
    min-height: 100vh;
}

.header {
    text-align: center;
    margin-bottom: 40rpx;
}

.title {
    font-size: 48rpx;
    font-weight: bold;
    color: #333;
}

.status-card,
.preview-card,
.info-card {
    background: white;
    border-radius: 20rpx;
    padding: 40rpx;
    margin-bottom: 30rpx;
    box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.05);
}

.status-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20rpx 0;
    border-bottom: 1rpx solid #f0f0f0;
}

.status-item:last-child {
    border-bottom: none;
}

.label {
    font-size: 32rpx;
    color: #666;
}

.value {
    font-size: 32rpx;
    color: #333;
    font-weight: 500;
}

.value.success {
    color: #52c41a;
}

.value.loading {
    color: #1890ff;
}

.preview-title,
.info-title {
    font-size: 36rpx;
    font-weight: bold;
    color: #333;
    margin-bottom: 30rpx;
    display: block;
}

.preview-content {
    display: flex;
    flex-direction: column;
    gap: 30rpx;
}

.preview-text {
    font-size: 32rpx;
    line-height: 1.8;
    color: #333;
    padding: 20rpx;
    background: #f9f9f9;
    border-radius: 10rpx;
    display: block;
}

.default-font {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.custom-font {
    font-family: '汇文明朝', sans-serif;
}

.actions {
    display: flex;
    flex-direction: column;
    gap: 20rpx;
    margin-bottom: 30rpx;
}

.btn {
    height: 88rpx;
    line-height: 88rpx;
    background: #1890ff;
    color: white;
    border-radius: 44rpx;
    font-size: 32rpx;
    border: none;
}

.btn.danger {
    background: #ff4d4f;
}

.info-text {
    font-size: 28rpx;
    color: #666;
    line-height: 1.8;
    margin-bottom: 16rpx;
    display: block;
}

.info-text:last-child {
    margin-bottom: 0;
}
</style>
