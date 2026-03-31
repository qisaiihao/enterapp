<template>
    <view v-if="visible" class="action-menu-overlay" @tap="$emit('close')">
        <view class="action-menu-container" @tap.stop>
            <view class="action-menu-item" @tap="$emit('edit')">
                <text>编辑</text>
            </view>
            <view class="action-menu-item" @tap="$emit('compose-series')">
                <text>组诗合成</text>
            </view>
            <view class="action-menu-item" @tap="$emit('toggle-visibility')">
                <text>{{ isHidden ? '取消隐藏' : '隐藏' }}</text>
            </view>
            <view class="action-menu-item action-menu-item-danger" @tap="$emit('delete')">
                <text>删除该动态</text>
            </view>
            <view class="action-menu-item action-menu-item-cancel" @tap="$emit('close')">
                <text>取消</text>
            </view>
        </view>
    </view>
</template>

<script>
export default {
    name: 'ActionMenu',
    emits: ['close', 'edit', 'compose-series', 'toggle-visibility', 'delete'],
    props: {
        visible: {
            type: Boolean,
            default: false
        },
        isHidden: {
            type: Boolean,
            default: false
        }
    }
};
</script>

<style scoped>
.action-menu-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    z-index: 9999;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
    from {
        opacity: 0;
    }
    to {
        opacity: 1;
    }
}

.action-menu-container {
    width: 100%;
    background-color: #fff;
    border-radius: 24rpx 24rpx 0 0;
    padding-bottom: calc(40rpx + constant(safe-area-inset-bottom));
    padding-bottom: calc(40rpx + env(safe-area-inset-bottom));
    animation: slideUp 0.3s ease;
}

@keyframes slideUp {
    from {
        transform: translateY(100%);
    }
    to {
        transform: translateY(0);
    }
}

.action-menu-item {
    width: 100%;
    height: 100rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 32rpx;
    color: #333;
    border-bottom: 1rpx solid #f0f0f0;
    transition: background-color 0.2s ease;
}

.action-menu-item:active {
    background-color: #f5f5f5;
}

.action-menu-item:last-child {
    border-bottom: none;
}

.action-menu-item-danger {
    color: #ff3b30;
}

.action-menu-item-cancel {
    margin-top: 20rpx;
    border-top: 10rpx solid #f0f0f0;
    border-bottom: none;
    font-weight: 500;
}
</style>
