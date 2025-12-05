<template>
    <view v-if="show" class="share-modal-overlay" @tap="$emit('hide')" @touchmove.stop.prevent>
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

                    <!-- 显式的保存按钮：H5/APP 显示 -->
                    <!-- #ifdef H5 || APP-PLUS -->
                    <view v-if="imageUrl" class="share-actions">
                        <image class="share-download-image" src="/static/images/download.png" mode="widthFix" @tap.stop="$emit('save')"></image>
                    </view>
                    <!-- #endif -->
                </view>
            </scroll-view>
        </view>
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
    data() {
        return {
            isScrolling: false,
            touchStartTime: 0,
            touchStartPos: { x: 0, y: 0 }
        };
    },
    methods: {
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
    border-radius: 20rpx;
    box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.3);
    /* 确保图片在滚动容器中正确显示 */
    flex-shrink: 0;
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
