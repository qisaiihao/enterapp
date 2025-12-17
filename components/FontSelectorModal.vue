<template>
    <!-- 字号字体选择弹窗 -->
    <view v-if="show" class="font-selector-mask" @tap.stop="$emit('close')">
        <view class="font-selector" @tap.stop>
            <view class="font-selector-title">字体设置</view>
            
            <!-- 字号调整 -->
            <view class="font-size-section">
                <view class="section-title">字号大小</view>
                <view class="font-size-slider">
                    <text class="size-label">A</text>
                    <slider 
                        class="slider"
                        :value="currentFontSize" 
                        :min="24" 
                        :max="72" 
                        :step="1"
                        @changing="onFontSizeChanging"
                        @change="onFontSizeChange"
                        activeColor="#333333"
                        backgroundColor="#E5E5E5"
                        block-size="24"
                        block-color="#FFFFFF"
                    />
                    <text class="size-label large">A</text>
                </view>
                <view class="font-size-value">{{ currentFontSize }}px</view>
            </view>

            <!-- 字体选择 -->
            <view class="font-family-section">
                <view class="section-title">字体样式</view>
                <scroll-view class="font-options-scroll" :scroll-y="true">
                    <view class="font-options">
                        <view 
                            v-for="font in fontOptions" 
                            :key="font.value"
                            class="font-option"
                            :class="{ 
                                'selected': currentFontFamily === font.value,
                                'downloading': downloadingFont === font.value
                            }"
                            @tap="onFontFamilyChange(font.value)"
                        >
                            <view class="font-option-content">
                                <text class="font-option-text" :style="{ fontFamily: font.isLoaded ? font.value : 'inherit' }">
                                    {{ font.name }}
                                </text>
                                <view class="font-option-meta">
                                    <text v-if="!font.isDefault" class="font-size-text">{{ font.sizeFormatted }}</text>
                                    <text v-if="font.isCached && !font.isDefault" class="font-status-text">已缓存</text>
                                    <text v-else-if="!font.isDefault" class="font-status-text">需下载</text>
                                </view>
                            </view>
                            
                            <!-- 下载进度条 -->
                            <view v-if="downloadingFont === font.value" class="download-progress">
                                <view class="progress-bar">
                                    <view class="progress-fill" :style="{ width: downloadProgress + '%' }" style="background-color: #ccc;"></view>
                                </view>
                                <text class="progress-text">{{ downloadProgress }}%</text>
                            </view>
                            
                            <!-- 选中标记 -->
                            <text v-else-if="currentFontFamily === font.value" class="font-check">✓</text>
                        </view>
                    </view>
                </scroll-view>
            </view>

            <!-- 确认按钮 -->
            <view class="font-actions">
                <view class="action-btn cancel-btn" @tap="$emit('close')">取消</view>
                <view class="action-btn confirm-btn" @tap="onConfirm">确认</view>
            </view>
        </view>
    </view>
</template>

<script>
import fontManager from '@/utils/fontManager.js';

export default {
    name: 'FontSelectorModal',
    props: {
        show: {
            type: Boolean,
            default: false
        },
        fontSize: {
            type: Number,
            default: 38
        },
        fontFamily: {
            type: String,
            default: 'Huiwen-mincho'
        },
        previewText: {
            type: String,
            default: '示例文字'
        }
    },
    data() {
        return {
            currentFontSize: this.fontSize,
            currentFontFamily: this.fontFamily,
            fontOptions: [],
            downloadingFont: '', // 当前正在下载的字体
            downloadProgress: 0, // 下载进度 0-100
            isLoading: false
        };
    },
    async created() {
        await this.loadFontOptions();
    },
    watch: {
        fontSize(val) {
            this.currentFontSize = val;
        },
        fontFamily(val) {
            this.currentFontFamily = val;
        },
        // 当弹窗关闭时重置状态
        show(val) {
            if (val) {
                this.currentFontSize = this.fontSize;
                this.currentFontFamily = this.fontFamily;
            }
        }
    },
    methods: {
        // 滑动过程中实时更新显示
        onFontSizeChanging(e) {
            this.currentFontSize = e.detail.value;
        },
        
        // 滑动结束时触发预览
        onFontSizeChange(e) {
            this.currentFontSize = e.detail.value;
            // 实时预览
            this.$emit('font-size-preview', this.currentFontSize);
        },
        
        async onFontFamilyChange(fontFamily) {
            const fontOption = this.fontOptions.find(opt => opt.value === fontFamily);
            
            // 默认字体直接切换，无需下载
            if (fontOption.isDefault) {
                this.currentFontFamily = fontFamily;
                this.$emit('font-family-preview', this.currentFontFamily);
                return;
            }
            
            // 非默认字体且未缓存，需要下载
            if (!fontOption.isCached) {
                try {
                    this.downloadingFont = fontFamily;
                    this.downloadProgress = 0;
                    
                    await fontManager.ensureFontAvailable(fontFamily, (progress) => {
                        this.downloadProgress = progress;
                    });
                    
                    // 更新字体选项状态
                    await this.loadFontOptions();
                    
                    uni.showToast({
                        title: '字体下载完成',
                        icon: 'success',
                        duration: 1000
                    });
                } catch (error) {
                    console.error('字体下载失败:', error);
                    uni.showToast({
                        title: '字体下载失败',
                        icon: 'none',
                        duration: 2000
                    });
                    return; // 下载失败时不切换字体
                } finally {
                    this.downloadingFont = '';
                    this.downloadProgress = 0;
                }
            }
            
            this.currentFontFamily = fontFamily;
            // 实时预览
            this.$emit('font-family-preview', this.currentFontFamily);
        },
        
        onConfirm() {
            this.$emit('confirm', {
                fontSize: this.currentFontSize,
                fontFamily: this.currentFontFamily
            });
        },
        
        async loadFontOptions() {
            this.isLoading = true;
            try {
                const availableFonts = fontManager.getAvailableFonts();
                this.fontOptions = availableFonts.map(font => ({
                    name: font.displayName,
                    value: font.fontFamily,
                    size: font.size,
                    isDefault: font.isDefault,
                    isCached: font.isCached,
                    isLoaded: font.isLoaded,
                    sizeFormatted: fontManager.formatFileSize(font.size)
                }));
            } catch (error) {
                console.error('加载字体选项失败:', error);
            } finally {
                this.isLoading = false;
            }
        }
    }
};
</script>

<style scoped>
/* 弹窗遮罩 */
.font-selector-mask { 
    position: fixed; 
    left: 0; 
    right: 0; 
    top: 0; 
    bottom: 0; 
    background: rgba(0,0,0,.35); 
    z-index: 9999; 
    display: flex; 
    align-items: flex-end; 
}

.font-selector {
    width: 100%;
    background: #fff;
    border-top-left-radius: 24rpx;
    border-top-right-radius: 24rpx;
    padding: 32rpx 32rpx calc(32rpx + env(safe-area-inset-bottom));
    height: 40vh;
    max-height: 40vh;
    display: flex;
    flex-direction: column;
    animation: slideUp 0.3s ease;
}

.font-selector-title {
    font-size: 36rpx;
    font-weight: 600;
    color: #333;
    text-align: center;
    margin-bottom: 40rpx;
}

/* 字号调整部分 */
.font-size-section {
    margin-bottom: 40rpx;
}

.section-title {
    font-size: 28rpx;
    color: #666;
    margin-bottom: 24rpx;
    font-weight: 500;
}

.font-size-slider {
    display: flex;
    align-items: center;
    gap: 24rpx;
    margin-bottom: 24rpx;
}

.size-label {
    font-size: 28rpx;
    color: #999;
    font-weight: 500;
}

.size-label.large {
    font-size: 36rpx;
}

.slider {
    flex: 1;
    margin: 0 8rpx;
}


.font-size-value {
    text-align: center;
    font-size: 24rpx;
    color: #333333;
    font-weight: 500;
}

/* 字体选择部分 */
.font-family-section {
    margin-bottom: 40rpx;
    flex: 1;
    display: flex;
    flex-direction: column;
}

.font-options-scroll {
    flex: 1;
    max-height: 300rpx;
}

.font-options {
    display: flex;
    flex-direction: column;
    gap: 8rpx;
    padding: 0 4rpx;
}

.font-option {
    background: #F8F8F8;
    border-radius: 8rpx;
    padding: 20rpx 24rpx;
    position: relative;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 80rpx;
}

.font-option-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8rpx;
}

.font-option-meta {
    display: flex;
    align-items: center;
    gap: 12rpx;
}

.font-option:active {
    background: #E8E8E8;
}

.font-option.selected {
    background: #F0F0F0;
    border: 2rpx solid #333333;
}

.font-option.downloading {
    background: #F0F0F0;
    border: 2rpx solid #333333;
}


.font-option-text {
    font-size: 26rpx;
    color: #333;
    font-weight: 500;
}

.font-check {
    font-size: 24rpx;
    color: #333;
    font-weight: bold;
}

.font-size-text {
    font-size: 20rpx;
    color: #999;
    background: #F0F0F0;
    padding: 4rpx 8rpx;
    border-radius: 4rpx;
}

.font-status-text {
    font-size: 20rpx;
    padding: 4rpx 8rpx;
    border-radius: 4rpx;
    font-weight: 500;
    color: #999;
    background: #F0F0F0;
}

/* 下载进度条样式 */
.download-progress {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8rpx;
    min-width: 80rpx;
}

.progress-bar {
    width: 60rpx;
    height: 6rpx;
    background: #F0F0F0;
    border-radius: 3rpx;
    overflow: hidden;
}

.progress-fill {
    height: 100%;
    background: #999;
    border-radius: 3rpx;
    transition: width 0.1s ease;
}

.progress-text {
    font-size: 20rpx;
    color: #999;
    font-weight: 500;
}

/* 操作按钮 */
.font-actions {
    display: flex;
    gap: 24rpx;
    margin-top: 8rpx;
}

.action-btn {
    flex: 1;
    height: 88rpx;
    border-radius: 12rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 32rpx;
    font-weight: 500;
    transition: all 0.2s ease;
}

.cancel-btn {
    background: #F5F5F5;
    color: #666;
}

.cancel-btn:active {
    background: #E8E8E8;
}

.confirm-btn {
    background: #333333;
    color: #FFFFFF;
}

.confirm-btn:active {
    background: #222222;
}

@keyframes slideUp {
    from {
        opacity: 0;
        transform: translateY(100%);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

@keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
}

.font-option.downloading .font-option-text {
    animation: pulse 1.5s infinite;
}
</style>
