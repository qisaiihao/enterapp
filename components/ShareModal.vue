<template>
    <view v-if="show" class="share-modal-overlay" @tap="$emit('hide')">
        <scroll-view class="share-modal" scroll-y @tap.stop>
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
                :show-menu-by-longpress="longpressMenuEnabled"
            ></image>

            <!-- 显式的保存按钮：H5/APP 显示 -->
            <!-- #ifdef H5 || APP-PLUS -->
            <view v-if="imageUrl" class="share-actions">
                <image class="share-download-image" src="/static/images/download.png" mode="widthFix" @tap.stop="$emit('save')"></image>
            </view>
            <!-- #endif -->
        </scroll-view>
    </view>
</template>

<script>
export default {
    name: 'ShareModal',
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
        }
    },
    methods: {
        onImageLongPress(e) {
            this.$emit('longpress', e);
        },
        onImageLoad(e) {
            this.$emit('load', e);
        },
        onImageError(e) {
            this.$emit('error', e);
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
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 9999;
}

.share-modal {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 90%;
    max-height: 85vh;
}

.share-loading {
    color: #fff;
    font-size: 32rpx;
    padding: 40rpx;
}

.share-generated-image {
    width: 100%;
    border-radius: 20rpx;
    box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.3);
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
</style>
