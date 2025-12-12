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
                            :class="{ 'selected': currentFontFamily === font.value }"
                            @tap="onFontFamilyChange(font.value)"
                        >
                            <text class="font-option-text" :style="{ fontFamily: font.value }">
                                {{ font.name }}
                            </text>
                            <text v-if="currentFontFamily === font.value" class="font-check">✓</text>
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
            fontOptions: [
                { name: '汇文明朝', value: 'Huiwen-mincho' },
                { name: '文楷', value: '文楷' },
                { name: '蒲瓜正楷体', value: '蒲瓜正楷体' },
                { name: '龙藏体', value: '龙藏体' },
                { name: '小小皓体', value: '小小皓体' }
            ]
        };
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
        
        onFontFamilyChange(fontFamily) {
            this.currentFontFamily = fontFamily;
            // 实时预览
            this.$emit('font-family-preview', this.currentFontFamily);
        },
        
        onConfirm() {
            this.$emit('confirm', {
                fontSize: this.currentFontSize,
                fontFamily: this.currentFontFamily
            });
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
    min-height: 60rpx;
}

.font-option:active {
    background: #E8E8E8;
}

.font-option.selected {
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
    color: #333333;
    font-weight: bold;
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
</style>
