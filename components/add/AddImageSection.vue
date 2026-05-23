<template>
    <view class="image-section" :class="{ 'image-section--dark': isDark }">
        <scroll-view class="image-preview-scroll" :scroll-x="true" :show-scrollbar="false">
            <view class="image-preview-container">
                <view class="image-preview-item" v-for="(item, index) in imageList" :key="index">
                    <image class="preview-image" :src="item.previewUrl" mode="aspectFill" @error="$emit('error', index)" />
                    <view class="image-remove-btn" @tap="$emit('remove', index)">×</view>
                </view>
                <view v-if="canAddMore" class="add-image-btn" @tap="$emit('choose')">
                    <view class="add-icon">+</view>
                </view>
            </view>
        </scroll-view>
    </view>
</template>

<script>
export default {
    name: 'AddImageSection',
    emits: ['error', 'remove', 'choose'],
    props: {
        imageList: {
            type: Array,
            default: () => []
        },
        maxImageCount: {
            type: Number,
            default: 9
        },
        isDark: {
            type: Boolean,
            default: false
        }
    },
    computed: {
        canAddMore() {
            return (this.imageList || []).length < this.maxImageCount;
        }
    }
};
</script>

<style scoped>
.image-section {
    padding: 30rpx;
    background: var(--app-surface-bg, #f8f9fa);
    border-bottom: var(--app-surface-border-line, none);
}

.image-preview-scroll {
    width: 100%;
    white-space: nowrap;
}

.image-preview-container {
    display: flex;
    gap: 20rpx;
    padding: 0 10rpx;
}

.image-preview-item {
    position: relative;
    width: 200rpx;
    height: 200rpx;
    border-radius: 12rpx;
    overflow: hidden;
    flex-shrink: 0;
}

.preview-image {
    width: 100%;
    height: 100%;
    border-radius: 12rpx;
}

.image-remove-btn {
    position: absolute;
    top: -8rpx;
    right: -8rpx;
    width: 40rpx;
    height: 40rpx;
    background: var(--app-danger-strong-color, #ff4444);
    color: #ffffff;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24rpx;
    font-weight: bold;
    box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.2);
}

.add-image-btn {
    width: 200rpx;
    height: 200rpx;
    border: 2rpx dashed var(--app-image-add-border-color, #ddd);
    border-radius: 12rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--app-elevated-bg, #fff);
    transition: all 0.3s ease;
    flex-shrink: 0;
}

.add-image-btn:active {
    background: var(--app-subtle-surface-bg, #f5f5f5);
    border-color: var(--app-link-color, #9ed7ee);
}

.add-icon {
    font-size: 60rpx;
    color: var(--app-muted-text, #999);
}

.image-section--dark {
    background: #171a20;
    border-bottom: 1rpx solid rgba(255, 255, 255, 0.12);
}

.image-section--dark .add-image-btn {
    background: rgba(24, 28, 36, 0.96);
    border-color: rgba(255, 255, 255, 0.22);
}

.image-section--dark .add-image-btn:active {
    background: rgba(255, 255, 255, 0.08);
    border-color: #d8bf82;
}

.image-section--dark .add-icon {
    color: #8e96a3;
}
</style>
