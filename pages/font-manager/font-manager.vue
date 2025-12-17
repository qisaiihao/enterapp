<template>
    <view class="font-manager-page">
        <view class="page-header">
            <view class="header-title">字体管理</view>
            <view class="header-desc">管理本地字体缓存</view>
        </view>

        <view class="cache-stats">
            <view class="stats-card">
                <view class="stats-item">
                    <view class="stats-value">{{ cacheStats.cachedFonts }}</view>
                    <view class="stats-label">已缓存</view>
                </view>
                <view class="stats-divider"></view>
                <view class="stats-item">
                    <view class="stats-value">{{ cacheStats.totalFonts }}</view>
                    <view class="stats-label">总字体数</view>
                </view>
                <view class="stats-divider"></view>
                <view class="stats-item">
                    <view class="stats-value">{{ cacheStats.cacheSizeFormatted }}</view>
                    <view class="stats-label">缓存大小</view>
                </view>
            </view>
        </view>

        <view class="font-list">
            <view class="list-header">
                <text class="list-title">字体列表</text>
                <view class="header-actions">
                    <text class="action-btn" @tap="refreshFontList">刷新</text>
                    <text class="action-btn danger" @tap="clearAllCache">清空缓存</text>
                </view>
            </view>

            <view class="font-items">
                <view 
                    v-for="font in fontList" 
                    :key="font.fontFamily"
                    class="font-item"
                    :class="{ 'cached': font.isCached, 'loading': font.isLoading }"
                >
                    <view class="font-info">
                        <text class="font-name" :style="{ fontFamily: font.isLoaded ? font.fontFamily : 'inherit' }">
                            {{ font.displayName }}
                        </text>
                        <view class="font-meta">
                            <text class="font-size">{{ font.sizeFormatted }}</text>
                            <text class="font-status" :class="getStatusClass(font)">
                                {{ getStatusText(font) }}
                            </text>
                        </view>
                    </view>

                    <view class="font-actions">
                        <view v-if="font.isLoading" class="loading-indicator">
                            <view class="loading-spinner"></view>
                        </view>
                        <view v-else-if="!font.isCached && !font.isDefault" class="download-action">
                            <text class="action-text" @tap="downloadFont(font)">下载</text>
                        </view>
                        <view v-else-if="font.isCached && !font.isDefault" class="delete-action">
                            <text class="action-text danger" @tap="deleteFont(font)">删除</text>
                        </view>
                        <view v-else class="default-action">
                            <text class="action-text disabled">默认</text>
                        </view>
                    </view>
                </view>
            </view>
        </view>

        <view class="page-footer">
            <view class="footer-info">
                <text class="info-text">字体文件将自动缓存到本地，提升使用体验</text>
                <text class="info-text">缓存上限: {{ cacheStats.maxCacheSizeFormatted }}</text>
            </view>
        </view>
    </view>
</template>

<script>
import fontManager from '@/utils/fontManager.js';

export default {
    name: 'FontManager',
    data() {
        return {
            fontList: [],
            cacheStats: {
                totalFonts: 0,
                cachedFonts: 0,
                loadedFonts: 0,
                cacheSize: 0,
                cacheSizeFormatted: '0 B',
                maxCacheSize: 0,
                maxCacheSizeFormatted: '0 B'
            },
            isLoading: false
        };
    },
    async onLoad() {
        await this.loadFontData();
    },
    onShow() {
        // 页面显示时刷新数据
        this.loadFontData();
    },
    methods: {
        async loadFontData() {
            try {
                this.isLoading = true;
                
                // 获取字体列表
                const availableFonts = fontManager.getAvailableFonts();
                this.fontList = availableFonts.map(font => ({
                    ...font,
                    sizeFormatted: fontManager.formatFileSize(font.size),
                    isLoading: false
                }));

                // 获取缓存统计
                this.cacheStats = fontManager.getCacheStats();
                
            } catch (error) {
                console.error('加载字体数据失败:', error);
                uni.showToast({
                    title: '加载失败',
                    icon: 'none'
                });
            } finally {
                this.isLoading = false;
            }
        },

        async refreshFontList() {
            uni.showLoading({ title: '刷新中...' });
            try {
                await this.loadFontData();
                uni.showToast({
                    title: '刷新成功',
                    icon: 'success'
                });
            } catch (error) {
                uni.showToast({
                    title: '刷新失败',
                    icon: 'none'
                });
            } finally {
                uni.hideLoading();
            }
        },

        async downloadFont(font) {
            if (font.isLoading) return;
            
            try {
                // 更新UI状态
                const fontIndex = this.fontList.findIndex(f => f.fontFamily === font.fontFamily);
                if (fontIndex !== -1) {
                    this.$set(this.fontList[fontIndex], 'isLoading', true);
                }

                uni.showLoading({ title: '下载中...' });
                
                await fontManager.ensureFontAvailable(font.fontFamily, (progress) => {
                    console.log(`字体下载进度: ${progress}%`);
                });

                uni.showToast({
                    title: '下载成功',
                    icon: 'success'
                });

                // 刷新数据
                await this.loadFontData();
                
            } catch (error) {
                console.error('下载字体失败:', error);
                uni.showToast({
                    title: '下载失败',
                    icon: 'none'
                });
            } finally {
                uni.hideLoading();
                
                // 重置加载状态
                const fontIndex = this.fontList.findIndex(f => f.fontFamily === font.fontFamily);
                if (fontIndex !== -1) {
                    this.$set(this.fontList[fontIndex], 'isLoading', false);
                }
            }
        },

        async deleteFont(font) {
            if (font.isDefault || font.isLoading) return;

            try {
                const result = await new Promise((resolve) => {
                    uni.showModal({
                        title: '确认删除',
                        content: `确定要删除字体"${font.displayName}"吗？`,
                        success: (res) => resolve(res.confirm),
                        fail: () => resolve(false)
                    });
                });

                if (!result) return;

                uni.showLoading({ title: '删除中...' });

                // 删除字体缓存
                await fontManager.deleteFontCache(font.fontFamily);

                uni.showToast({
                    title: '删除成功',
                    icon: 'success'
                });

                // 刷新数据
                await this.loadFontData();
                
            } catch (error) {
                console.error('删除字体失败:', error);
                uni.showToast({
                    title: '删除失败',
                    icon: 'none'
                });
            } finally {
                uni.hideLoading();
            }
        },

        async clearAllCache() {
            try {
                const result = await new Promise((resolve) => {
                    uni.showModal({
                        title: '确认清空',
                        content: '确定要清空所有字体缓存吗？此操作不可撤销。',
                        success: (res) => resolve(res.confirm),
                        fail: () => resolve(false)
                    });
                });

                if (!result) return;

                uni.showLoading({ title: '清空中...' });

                await fontManager.clearAllCache();

                uni.showToast({
                    title: '清空成功',
                    icon: 'success'
                });

                // 刷新数据
                await this.loadFontData();
                
            } catch (error) {
                console.error('清空缓存失败:', error);
                uni.showToast({
                    title: '清空失败',
                    icon: 'none'
                });
            } finally {
                uni.hideLoading();
            }
        },

        getStatusText(font) {
            if (font.isDefault) return '默认';
            if (font.isCached) return '已缓存';
            return '需下载';
        },

        getStatusClass(font) {
            if (font.isDefault) return 'default';
            if (font.isCached) return 'cached';
            return 'not-cached';
        }
    }
};
</script>

<style scoped>
.font-manager-page {
    min-height: 100vh;
    background: #f8f9fa;
    padding: 0 32rpx 120rpx;
}

.page-header {
    padding: 60rpx 0 40rpx;
    text-align: center;
}

.header-title {
    font-size: 44rpx;
    font-weight: 600;
    color: #333;
    margin-bottom: 12rpx;
}

.header-desc {
    font-size: 28rpx;
    color: #666;
}

.cache-stats {
    margin-bottom: 40rpx;
}

.stats-card {
    background: #fff;
    border-radius: 16rpx;
    padding: 32rpx;
    display: flex;
    align-items: center;
    justify-content: space-around;
    box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.06);
}

.stats-item {
    text-align: center;
    flex: 1;
}

.stats-value {
    font-size: 32rpx;
    font-weight: 600;
    color: #333;
    margin-bottom: 8rpx;
}

.stats-label {
    font-size: 24rpx;
    color: #666;
}

.stats-divider {
    width: 2rpx;
    height: 60rpx;
    background: #eee;
    margin: 0 24rpx;
}

.font-list {
    background: #fff;
    border-radius: 16rpx;
    overflow: hidden;
    box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.06);
}

.list-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 32rpx;
    border-bottom: 2rpx solid #f5f5f5;
}

.list-title {
    font-size: 32rpx;
    font-weight: 600;
    color: #333;
}

.header-actions {
    display: flex;
    gap: 24rpx;
}

.action-btn {
    font-size: 26rpx;
    color: #1890ff;
    padding: 12rpx 20rpx;
    border: 2rpx solid #1890ff;
    border-radius: 8rpx;
    transition: all 0.2s;
}

.action-btn:active {
    background: #1890ff;
    color: #fff;
}

.action-btn.danger {
    color: #ff4d4f;
    border-color: #ff4d4f;
}

.action-btn.danger:active {
    background: #ff4d4f;
    color: #fff;
}

.font-items {
    padding: 0;
}

.font-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 24rpx 32rpx;
    border-bottom: 2rpx solid #f5f5f5;
    transition: background 0.2s;
}

.font-item:last-child {
    border-bottom: none;
}

.font-item.loading {
    background: #f0f8ff;
}

.font-info {
    flex: 1;
}

.font-name {
    font-size: 30rpx;
    font-weight: 500;
    color: #333;
    display: block;
    margin-bottom: 8rpx;
}

.font-meta {
    display: flex;
    align-items: center;
    gap: 16rpx;
}

.font-size {
    font-size: 22rpx;
    color: #999;
    background: #f0f0f0;
    padding: 4rpx 8rpx;
    border-radius: 4rpx;
}

.font-status {
    font-size: 22rpx;
    padding: 4rpx 8rpx;
    border-radius: 4rpx;
    font-weight: 500;
}

.font-status.default {
    color: #52c41a;
    background: #f6ffed;
}

.font-status.cached {
    color: #1890ff;
    background: #e6f7ff;
}

.font-status.not-cached {
    color: #fa8c16;
    background: #fff7e6;
}

.font-actions {
    min-width: 100rpx;
    display: flex;
    justify-content: flex-end;
}

.loading-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 60rpx;
    height: 60rpx;
}

.loading-spinner {
    width: 32rpx;
    height: 32rpx;
    border: 4rpx solid #f3f3f3;
    border-top: 4rpx solid #1890ff;
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}

.action-text {
    font-size: 26rpx;
    padding: 12rpx 20rpx;
    border-radius: 6rpx;
    transition: all 0.2s;
}

.download-action .action-text {
    color: #1890ff;
    border: 2rpx solid #1890ff;
}

.download-action .action-text:active {
    background: #1890ff;
    color: #fff;
}

.delete-action .action-text {
    color: #ff4d4f;
    border: 2rpx solid #ff4d4f;
}

.delete-action .action-text:active {
    background: #ff4d4f;
    color: #fff;
}

.default-action .action-text {
    color: #ccc;
    border: 2rpx solid #eee;
}

.action-text.disabled {
    color: #ccc;
    border: 2rpx solid #eee;
    cursor: not-allowed;
}

.page-footer {
    margin-top: 40rpx;
    text-align: center;
}

.footer-info {
    display: flex;
    flex-direction: column;
    gap: 8rpx;
}

.info-text {
    font-size: 24rpx;
    color: #999;
}
</style>
