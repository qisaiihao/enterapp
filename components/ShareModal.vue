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
                    <view v-if="!hasImages" class="share-loading">
                        <text>正在生成图片...</text>
                    </view>

                    <view v-else class="share-images">
                        <view v-if="isMultipleImages" class="share-page-count">
                            共 {{ normalizedImageUrls.length }} 页
                        </view>

                        <image
                            v-if="!isMultipleImages"
                            ref="shareImage"
                            class="share-generated-image"
                            :src="normalizedImageUrls[0]"
                            mode="widthFix"
                            @longpress="onImageLongPress"
                            @load="onImageLoad($event, 0)"
                            @error="onImageError($event, 0)"
                            :show-menu-by-longpress="longpressMenuEnabled && !isScrolling"
                            @touchstart="onImageTouchStart"
                            @touchmove="onImageTouchMove"
                            @touchend="onImageTouchEnd"
                        ></image>

                        <image
                            v-for="(src, index) in normalizedImageUrls"
                            v-else
                            :key="`${src}-${index}`"
                            class="share-generated-image"
                            :class="{ 'share-generated-image--multi': isMultipleImages }"
                            :src="src"
                            mode="widthFix"
                            @longpress="onImageLongPress"
                            @load="onImageLoad($event, index)"
                            @error="onImageError($event, index)"
                            :show-menu-by-longpress="longpressMenuEnabled && !isScrolling"
                            @touchstart="onImageTouchStart"
                            @touchmove="onImageTouchMove"
                            @touchend="onImageTouchEnd"
                        ></image>
                    </view>

                    <view v-if="hasImages" class="share-toolbar">
                        <view class="toolbar-btn" @tap.stop="onFontSettingTap">
                            <text class="toolbar-btn-text">Aa</text>
                        </view>

                        <view class="toolbar-btn" @tap.stop="onColorPickerTap">
                            <view class="color-preview" :style="{ backgroundColor: currentBackgroundColor }"></view>
                        </view>

                        <view class="toolbar-btn" @tap.stop="$emit('save')">
                            <image
                                class="toolbar-icon"
                                src="/static/images/newicons/save_share.png"
                                mode="aspectFit"
                            ></image>
                        </view>
                    </view>
                </view>
            </scroll-view>
        </view>

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
    emits: ['save', 'force-regenerate', 'hide', 'longpress', 'load', 'error', 'font-size-preview', 'font-family-preview', 'font-settings-change', 'color-change'],
    props: {
        show: {
            type: Boolean,
            default: false
        },
        imageUrl: {
            type: String,
            default: ''
        },
        imageUrls: {
            type: Array,
            default: () => []
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
            touchStartPos: { x: 0, y: 0 },
            showFontSelector: false,
            showColorPicker: false
        };
    },
    computed: {
        normalizedImageUrls() {
            const list = Array.isArray(this.imageUrls)
                ? this.imageUrls.filter((item) => typeof item === 'string' && item.trim())
                : [];

            if (list.length > 0) {
                return list;
            }

            return this.imageUrl ? [this.imageUrl] : [];
        },
        hasImages() {
            return this.normalizedImageUrls.length > 0;
        },
        isMultipleImages() {
            return this.normalizedImageUrls.length > 1;
        },
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
        onOverlayTap() {
            if (this.showFontSelector) {
                this.showFontSelector = false;
                return;
            }

            if (this.showColorPicker) {
                this.showColorPicker = false;
                this.$nextTick(() => {
                    setTimeout(() => {
                        this.$emit('force-regenerate');
                    }, 200);
                });
                return;
            }

            this.$emit('hide');
        },
        onImageLongPress(e) {
            if (!this.isScrolling) {
                this.$emit('longpress', e);
            }
        },
        onImageLoad(e, index) {
            this.$emit('load', { event: e, index });
        },
        onImageError(e, index) {
            this.$emit('error', { event: e, index });
        },
        onTouchStart(e) {
            this.touchStartPos = {
                x: e.touches[0].clientX,
                y: e.touches[0].clientY
            };
            this.isScrolling = false;
        },
        onTouchMove(e) {
            const deltaX = Math.abs(e.touches[0].clientX - this.touchStartPos.x);
            const deltaY = Math.abs(e.touches[0].clientY - this.touchStartPos.y);
            if (deltaX > 10 || deltaY > 10) {
                this.isScrolling = true;
            }
        },
        onTouchEnd() {
            setTimeout(() => {
                this.isScrolling = false;
            }, 100);
        },
        onImageTouchStart(e) {
            this.touchStartPos = {
                x: e.touches[0].clientX,
                y: e.touches[0].clientY
            };
            this.isScrolling = false;
        },
        onImageTouchMove(e) {
            const deltaX = Math.abs(e.touches[0].clientX - this.touchStartPos.x);
            const deltaY = Math.abs(e.touches[0].clientY - this.touchStartPos.y);
            if (deltaX > 5 || deltaY > 5) {
                this.isScrolling = true;
            }
        },
        onImageTouchEnd() {
            setTimeout(() => {
                this.isScrolling = false;
            }, 50);
        },
        onFontSettingTap() {
            this.showFontSelector = true;
        },
        onColorPickerTap() {
            this.showColorPicker = true;
        },
        onFontSizePreview(fontSize) {
            this.$emit('font-size-preview', fontSize);
        },
        onFontFamilyPreview(fontFamily) {
            this.$emit('font-family-preview', fontFamily);
        },
        onFontSettingsConfirm(settings) {
            this.showFontSelector = false;
            this.$emit('font-settings-change', settings);
            this.$nextTick(() => {
                setTimeout(() => {
                    this.$emit('force-regenerate');
                }, 100);
            });
        },
        onColorSelect(colorConfig) {
            this.showColorPicker = false;
            this.$emit('color-change', colorConfig);
            this.$nextTick(() => {
                setTimeout(() => {
                    this.$emit('force-regenerate');
                }, 100);
            });
        },
        onFontSelectorClose() {
            this.showFontSelector = false;
        },
        onColorPickerClose() {
            this.showColorPicker = false;
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
    overflow: hidden;
    touch-action: none;
}

.share-modal-container {
    position: absolute;
    inset: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    pointer-events: none;
}

.share-modal {
    width: 80%;
    height: 100vh;
    max-height: 100vh;
    pointer-events: auto;
}

.share-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 7.5vh 0;
    min-height: 100vh;
    box-sizing: border-box;
}

.share-loading {
    color: #fff;
    font-size: 32rpx;
    padding: 40rpx;
}

.share-images {
    width: 100%;
}

.share-page-count {
    margin-bottom: 16rpx;
    text-align: center;
    font-size: 24rpx;
    color: rgba(255, 255, 255, 0.78);
}

.share-generated-image {
    width: 100%;
    height: auto;
    border-radius: 12rpx;
    box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.15);
    margin-bottom: 32rpx;
}

.share-generated-image--multi {
    display: block;
}

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
    background: #e8e8e8;
}

.toolbar-btn-text {
    font-size: 32rpx;
    font-weight: 600;
    color: #333333;
}

.toolbar-icon {
    width: 48rpx;
    height: 48rpx;
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
