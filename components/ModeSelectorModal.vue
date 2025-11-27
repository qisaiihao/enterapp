<template>
    <!-- 模式选择器弹窗 -->
    <view v-if="show" class="mode-selector-mask" @tap="$emit('close')">
        <view class="mode-selector" @tap.stop>
            <image class="mode-switch-modal-icon" src="/static/images/newicons/switch_publish.png" mode="aspectFit" alt="切换发布模式"></image>
            <view class="mode-title">选择发布模式</view>
            <view class="mode-list">
                <view class="mode-option" @tap="onSelect('poem', true)">
                    <view class="mode-text">原创诗歌</view>
                    <view v-if="publishMode === 'poem' && isOriginal" class="mode-check">✓</view>
                </view>
                <view class="mode-option" @tap="onSelect('poem', false)">
                    <view class="mode-text">非原创诗歌</view>
                    <view v-if="publishMode === 'poem' && !isOriginal" class="mode-check">✓</view>
                </view>
                <view class="mode-option" @tap="onSelect('normal', null)">
                    <view class="mode-text">普通帖子</view>
                    <view v-if="publishMode === 'normal'" class="mode-check">✓</view>
                </view>
                <view class="mode-option" @tap="onSelect('discussion', null)">
                    <view class="mode-text">讨论帖子</view>
                    <view v-if="publishMode === 'discussion'" class="mode-check">✓</view>
                </view>
            </view>
        </view>
    </view>
</template>

<script>
export default {
    name: 'ModeSelectorModal',
    props: {
        show: {
            type: Boolean,
            default: false
        },
        publishMode: {
            type: String,
            default: 'normal'
        },
        isOriginal: {
            type: Boolean,
            default: false
        }
    },
    methods: {
        onSelect(mode, isOriginal) {
            this.$emit('select', { mode, isOriginal });
        }
    }
};
</script>

<style scoped>
/* 模式选择器 */
/* 模式选择器遮罩 */
.mode-selector-mask {
    position: fixed;
    left: 0;
    right: 0;
    top: 0;
    bottom: 0;
    background: rgba(0,0,0,.35);
    z-index: 130;
    display: flex;
    align-items: flex-end;
}

.mode-selector {
    width: 100%;
    background: #fff;
    border-top-left-radius: 24rpx;
    border-top-right-radius: 24rpx;
    padding: 24rpx 28rpx calc(24rpx + env(safe-area-inset-bottom));
}

.mode-switch-modal-icon {
    width: 72rpx;
    height: 72rpx;
    margin: 0 auto 20rpx;
    display: block;
}

.mode-title {
    font-size: 30rpx;
    color: #333;
    text-align: center;
    margin-bottom: 24rpx;
    font-weight: 500;
}

.mode-list {
    display: flex;
    flex-direction: column;
    gap: 0;
}

.mode-option {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 24rpx 0;
    border-bottom: 1rpx solid #f0f0f0;
    transition: all 0.2s ease;
}

.mode-option:last-child {
    border-bottom: none;
}

.mode-option:active {
    background: #f8f9fa;
}

.mode-text {
    font-size: 28rpx;
    color: #333;
    flex: 1;
}

.mode-check {
    color: #1c9bd6;
    font-size: 28rpx;
    font-weight: bold;
}
</style>
