<template>
    <view v-if="show" class="share-modal-overlay" @tap="onOverlayTap" @touchmove.stop.prevent>
        <view class="share-modal-container">
            <scroll-view 
                class="share-modal" 
                scroll-y 
                :show-scrollbar="false"
                @tap.stop 
                @touchstart="onTouchStart"
                @touchmove="onTouchMove"
                @touchend="onTouchEnd"
            >
                <view class="share-content">
                    <view v-if="!imageUrl" class="share-loading">
                        <text>正在生成图片...</text>
                    </view>
                    <image
                        v-else
                        ref="shareImage"
                        class="share-generated-image"
                        :src="imageUrl"
                        mode="widthFix"
                        @longpress="onImageLongPress"
                        @load="onImageLoad"
                        @error="onImageError"
                        :show-menu-by-longpress="longpressMenuEnabled && !isScrolling"
                        @touchstart="onImageTouchStart"
                        @touchmove="onImageTouchMove"
                        @touchend="onImageTouchEnd"
                    ></image>

                    <!-- 底部工具栏 -->
                    <view v-if="imageUrl" class="share-toolbar">
                        <!-- 字号字体按钮 -->
                        <view class="toolbar-btn" @tap.stop="onFontSettingTap">
                            <text class="toolbar-btn-text">Aa</text>
                        </view>
                        
                        <!-- 颜色按钮 -->
                        <view class="toolbar-btn" @tap.stop="onColorPickerTap">
                            <view class="color-preview" :style="{ backgroundColor: currentBackgroundColor }"></view>
                        </view>
                        
                        <!-- 下载按钮 -->
                        <view class="toolbar-btn" @tap.stop="$emit('save')">
                            <image class="toolbar-icon" src="/static/images/newicons/save_share.png" mode="aspectFit" style="width: 48rpx; height: 48rpx;"></image>
                        </view>
                    </view>
                </view>
            </scroll-view>
        </view>
        
        <!-- 字号字体选择弹窗 -->
        <FontSelectorModal
            :show="showFontSelector"
            :fontSize="shareConfig.fontSize"
            :fontFamily="shareConfig.fontFamily"
            :previewText="previewText"
            @close="onFontSelectorClose"
            @font-size-preview="onFontSizePreview"
            @font-family-preview="onFontFamilyPreview"
            @confirm="onFontSettingsConfirm"
        />
        
        <!-- 颜色选择弹窗 -->
        <ColorPickerModal
            :show="showColorPicker"
            :colorPalettes="colorPalettes"
            :poemLines="poemLines"
            :selectedColorCombination="currentColorCombination"
            @close="onColorPickerClose"
            @select="onColorSelect"
        />
    </view>
</template>

<script>
import FontSelectorModal from './FontSelectorModal.vue';
import ColorPickerModal from './ColorPickerModal.vue';

export default {
    name: 'ShareModal',
    components: {
        FontSelectorModal,
        ColorPickerModal
    },
    props: {
        show: {
            type: Boolean,
            default: false
        },
        imageUrl: {
            type: String,
            default: ''
        },
        longpressMenuEnabled: {
            type: Boolean,
            default: false
        },
        shareConfig: {
            type: Object,
            default: () => ({
                fontSize: 38,
                titleFontSize: 46,
                fontFamily: '汇文明朝',
                backgroundColor: '#FFFFFF',
                textColor: '#000000'
            })
        },
        previewText: {
            type: String,
            default: '春花秋月何时了'
        },
        colorPalettes: {
            type: Array,
            default: () => []
        },
        poemLines: {
            type: Array,
            default: () => []
        }
    },
    data() {
        return {
            isScrolling: false,
            touchStartTime: 0,
            touchStartPos: { x: 0, y: 0 },
            showFontSelector: false,
            showColorPicker: false
        };
    },
    computed: {
        currentBackgroundColor() {
            return this.shareConfig.backgroundColor || '#FFFFFF';
        },
        currentColorCombination() {
            return {
                backgroundColor: this.shareConfig.backgroundColor,
                textColor: this.shareConfig.textColor
            };
        }
    },
    methods: {
        // 点击overlay时的处理
        onOverlayTap() {
            // 如果有子弹窗打开，则关闭子弹窗（不重新生成）
            if (this.showFontSelector) {
                console.log('【ShareModal】关闭字体选择弹窗');
                this.showFontSelector = false;
                return;
            }
            if (this.showColorPicker) {
                console.log('【ShareModal】关闭颜色选择弹窗');
                this.showColorPicker = false;
                this.$nextTick(() => {
                    setTimeout(() => {
                        this.$emit('force-regenerate');
                    }, 200);
                });
                return;
            }
            // 没有子弹窗打开，则关闭整个ShareModal
            this.$emit('hide');
        },
        
        onImageLongPress(e) {
            // 只有在非滑动状态才触发长按
            if (!this.isScrolling) {
                this.$emit('longpress', e);
            }
        },
        onImageLoad(e) {
            this.$emit('load', e);
        },
        onImageError(e) {
            this.$emit('error', e);
        },
        
        // 滚动容器的触摸事件
        onTouchStart(e) {
            this.touchStartTime = Date.now();
            this.touchStartPos = {
                x: e.touches[0].clientX,
                y: e.touches[0].clientY
            };
            this.isScrolling = false;
        },
        onTouchMove(e) {
            const deltaX = Math.abs(e.touches[0].clientX - this.touchStartPos.x);
            const deltaY = Math.abs(e.touches[0].clientY - this.touchStartPos.y);
            
            // 如果移动距离超过阈值，认为是滚动
            if (deltaX > 10 || deltaY > 10) {
                this.isScrolling = true;
            }
        },
        onTouchEnd(e) {
            // 延迟重置滚动状态，避免长按事件被误触
            setTimeout(() => {
                this.isScrolling = false;
            }, 100);
        },
        
        // 图片的触摸事件
        onImageTouchStart(e) {
            this.touchStartTime = Date.now();
            this.touchStartPos = {
                x: e.touches[0].clientX,
                y: e.touches[0].clientY
            };
            this.isScrolling = false;
        },
        onImageTouchMove(e) {
            const deltaX = Math.abs(e.touches[0].clientX - this.touchStartPos.x);
            const deltaY = Math.abs(e.touches[0].clientY - this.touchStartPos.y);
            
            // 如果移动距离超过阈值，认为是滚动，禁用长按
            if (deltaX > 5 || deltaY > 5) {
                this.isScrolling = true;
            }
        },
        onImageTouchEnd(e) {
            // 延迟重置滚动状态
            setTimeout(() => {
                this.isScrolling = false;
            }, 50);
        },
        
        // 字号字体设置按钮
        onFontSettingTap() {
            this.showFontSelector = true;
        },
        
        // 颜色选择按钮
        onColorPickerTap() {
            this.showColorPicker = true;
        },
        
        // 字号变化
        onFontSizeChange(fontSize) {
            this.$emit('font-size-change', fontSize);
        },
        
        // 字体变化
        onFontFamilyChange(fontFamily) {
            this.$emit('font-family-change', fontFamily);
        },
        
        // 颜色变化
        onColorChange(colorConfig) {
            this.$emit('color-change', colorConfig);
        },
        
        // 字号预览（实时预览）
        onFontSizePreview(fontSize) {
            this.$emit('font-size-preview', fontSize);
        },
        
        // 字体预览（实时预览）
        onFontFamilyPreview(fontFamily) {
            this.$emit('font-family-preview', fontFamily);
        },
        
        // 字体设置确认
        onFontSettingsConfirm(settings) {
            this.showFontSelector = false;
            this.$emit('font-settings-change', settings);
            // 延迟触发重绘，确保弹窗完全关闭后再绘制
            this.$nextTick(() => {
                setTimeout(() => {
                    this.$emit('force-regenerate');
                }, 100);
            });
        },
        
        // 颜色选择确认
        onColorSelect(colorConfig) {
            this.showColorPicker = false;
            this.$emit('color-change', colorConfig);
            // 延迟触发重绘，确保弹窗完全关闭后再绘制
            this.$nextTick(() => {
                setTimeout(() => {
                    this.$emit('force-regenerate');
                }, 100);
            });
        },
        
        // 字体选择弹窗关闭（包括点击外部、返回键等）
        onFontSelectorClose() {
            console.log('【ShareModal】字体选择弹窗关闭');
            this.showFontSelector = false;
            // 仅关闭弹窗，不重新生成分享卡片
        },

        // 颜色选择弹窗关闭（包括点击外部、返回键等）
        onColorPickerClose() {
            this.showColorPicker = false;
            // 延迟触发重绘，确保弹窗完全关闭后再绘制
            this.$nextTick(() => {
                setTimeout(() => {
                    this.$emit('force-regenerate');
                }, 100);
            });
        }
    }
};
</script>

<style scoped>
.share-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.7);
    z-index: 9999;
    /* 防止滚动穿透 */
    overflow: hidden;
    touch-action: none;
}

.share-modal-container {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    pointer-events: none; /* 让点击穿透到背景层 */
}

.share-modal {
    width: 80%; /* 减少宽度，增加左右边距 */
    height: 100vh;
    max-height: 100vh;
    pointer-events: auto; /* 恢复滚动区域的交互 */
}

.share-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    /* 添加内边距让内容初始居中，同时允许滑动到顶部和底部 */
    padding: 7.5vh 0;
    min-height: 100vh;
    box-sizing: border-box;
}

.share-loading {
    color: #fff;
    font-size: 32rpx;
    padding: 40rpx;
}

.share-generated-image {
    width: 100%;
    height: auto;
    border-radius: 12rpx;
    box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.15);
    margin-bottom: 32rpx;
}

.share-actions {
    margin-top: 30rpx;
    display: flex;
    justify-content: center;
}

.share-download-image {
    width: 80rpx;
    height: 80rpx;
    opacity: 0.9;
}

.share-download-image:active {
    opacity: 0.6;
}

/* 底部工具栏 */
.share-toolbar {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 32rpx;
    padding: 24rpx 0;
    background: rgba(0, 0, 0, 0.02);
    border-radius: 16rpx;
    margin-top: 16rpx;
}

.toolbar-btn {
    width: 96rpx;
    height: 96rpx;
    background: #d9d9d9;
    border-radius: 48rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.08);
}

.toolbar-btn:active {
    transform: scale(0.95);
    background: #E8E8E8;
}

.toolbar-btn-text {
    font-size: 32rpx;
    font-weight: 600;
    color: #333333;
}

.toolbar-icon {
    width: 48rpx !important;
    height: 48rpx !important;
    min-width: 48rpx;
    min-height: 48rpx;
    display: block;
}

.color-preview {
    width: 48rpx;
    height: 48rpx;
    border-radius: 24rpx;
    border: 4rpx solid rgba(255, 255, 255, 0.8);
    box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.15);
}
</style>
