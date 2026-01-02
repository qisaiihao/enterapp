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
                <view class="section-header">
                    <view class="section-title">字体样式</view>
                    <!-- 本地字体功能暂时隐藏，待后续完善
                    <view class="add-font-btn" @tap="onAddCustomFont">
                        <text class="add-font-icon">+</text>
                        <text class="add-font-text">本地字体</text>
                    </view>
                    -->
                </view>
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
                                <text class="font-option-text" :style="{ fontFamily: font.isLoaded ? font.name : 'inherit' }">
                                    {{ font.name }}
                                </text>
                                <view class="font-option-meta">
                                    <text v-if="font.isCustom" class="font-status-text custom">自定义</text>
                                    <text v-if="!font.isDefault" class="font-size-text">{{ font.sizeFormatted }}</text>
                                    <text v-if="font.isCached && !font.isDefault && !font.isCustom" class="font-status-text">已缓存</text>
                                    <text v-else-if="!font.isDefault && !font.isCustom" class="font-status-text">需下载</text>
                                </view>
                            </view>
                            
                            <!-- 下载进度条 -->
                            <view v-if="downloadingFont === font.value" class="download-progress">
                                <view class="progress-bar">
                                    <view class="progress-fill" :style="{ width: downloadProgress + '%' }" style="background-color: #ccc;"></view>
                                </view>
                                <text class="progress-text">{{ downloadProgress }}%</text>
                            </view>
                            
                            <!-- 删除自定义字体按钮 -->
                            <text v-else-if="font.isCustom && currentFontFamily !== font.value" class="font-delete" @tap.stop="onDeleteCustomFont(font.value)">删除</text>
                            
                            <!-- 选中标记 -->
                            <text v-else-if="currentFontFamily === font.value" class="font-check">✓</text>
                        </view>
                    </view>
                </scroll-view>
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
            default: '汇文明朝'
        },
        previewText: {
            type: String,
            default: '示例文字'
        }
    },
    data() {
        return {
            currentFontSize: this.fontSize,
            currentFontFamily: '', // 内部使用 fontFamily ID
            fontOptions: [],
            downloadingFont: '', // 当前正在下载的字体
            downloadProgress: 0, // 下载进度 0-100
            isLoading: false
        };
    },
    async created() {
        await this.loadFontOptions();
        this.initCurrentFont();
    },
    watch: {
        fontSize(val) {
            this.currentFontSize = val;
        },
        fontFamily(val) {
            this.initCurrentFont();
        },
        // 当弹窗关闭时重置状态
        show(val) {
            if (val) {
                this.currentFontSize = this.fontSize;
                this.initCurrentFont();
            }
        }
    },
    methods: {
        // 根据传入的 fontFamily（可能是 displayName）初始化当前字体
        initCurrentFont() {
            // 先尝试直接匹配 fontFamily ID
            let fontOption = this.fontOptions.find(opt => opt.value === this.fontFamily);
            // 如果没找到，尝试匹配 displayName
            if (!fontOption) {
                fontOption = this.fontOptions.find(opt => opt.name === this.fontFamily);
            }
            this.currentFontFamily = fontOption ? fontOption.value : '汇文明朝';
        },
        
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
                // 传递 displayName 用于 CSS 渲染
                this.$emit('font-family-preview', fontOption.name);
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
            // 传递 displayName 用于 CSS 渲染
            this.$emit('font-family-preview', fontOption.name);
        },
        
        onConfirm() {
            const fontOption = this.fontOptions.find(opt => opt.value === this.currentFontFamily);
            // 传递 displayName 用于 CSS 渲染
            this.$emit('confirm', {
                fontSize: this.currentFontSize,
                fontFamily: fontOption ? fontOption.name : this.currentFontFamily
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
                    isCustom: font.isCustom,
                    isCached: font.isCached,
                    isLoaded: font.isLoaded,
                    sizeFormatted: fontManager.formatFileSize(font.size)
                }));
            } catch (error) {
                console.error('加载字体选项失败:', error);
            } finally {
                this.isLoading = false;
            }
        },
        
        async onAddCustomFont() {
            try {
                uni.showLoading({ title: '选择字体文件...' });
                const result = await fontManager.addCustomFont();
                uni.hideLoading();
                
                uni.showToast({
                    title: '字体添加成功',
                    icon: 'success',
                    duration: 1500
                });
                
                // 刷新字体列表并选中新字体
                await this.loadFontOptions();
                this.currentFontFamily = result.fontFamily;
                // 传递 displayName 用于 CSS 渲染
                this.$emit('font-family-preview', result.displayName);
                
            } catch (error) {
                uni.hideLoading();
                console.error('添加自定义字体失败:', error);
                uni.showToast({
                    title: error.message || '添加失败',
                    icon: 'none',
                    duration: 2000
                });
            }
        },
        
        async onDeleteCustomFont(fontFamily) {
            try {
                await fontManager.deleteCustomFont(fontFamily);
                uni.showToast({
                    title: '已删除',
                    icon: 'success',
                    duration: 1000
                });
                
                // 如果删除的是当前选中的字体，切换到默认字体
                if (this.currentFontFamily === fontFamily) {
                    this.currentFontFamily = '汇文明朝';
                    // 传递 displayName
                    this.$emit('font-family-preview', '汇文明朝');
                }
                
                await this.loadFontOptions();
            } catch (error) {
                console.error('删除自定义字体失败:', error);
                uni.showToast({
                    title: '删除失败',
                    icon: 'none',
                    duration: 2000
                });
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
    padding: 32rpx 32rpx env(safe-area-inset-bottom);
    height: 65vh;
    max-height: 65vh;
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
    min-height: 0;
}

.section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24rpx;
}

.add-font-btn {
    display: flex;
    align-items: center;
    gap: 8rpx;
    padding: 12rpx 20rpx;
    background: #F5F5F5;
    border-radius: 8rpx;
    transition: all 0.2s ease;
}

.add-font-btn:active {
    background: #E8E8E8;
}

.add-font-icon {
    font-size: 28rpx;
    color: #333;
    font-weight: bold;
}

.add-font-text {
    font-size: 24rpx;
    color: #333;
}

.font-options-scroll {
    flex: 1;
    min-height: 0;
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

.font-status-text.custom {
    color: #92400e;
    background: #fef3c7;
}

.font-delete {
    font-size: 22rpx;
    color: #ef4444;
    padding: 8rpx 16rpx;
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
