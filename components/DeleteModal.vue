<template>
    <view v-if="visible" class="modal-overlay" @tap="$emit('close')">
        <view class="modal-content" @tap.stop>
            <view class="modal-header">
                <view class="modal-title">{{ title }}</view>
                <view class="close-btn" @tap="$emit('close')">×</view>
            </view>

            <view class="modal-body">
                <view class="modal-text">{{ message }}</view>
            </view>

            <view class="modal-footer">
                <button class="modal-btn cancel-btn" @tap="$emit('close')">取消</button>
                <button v-if="showDraft" class="modal-btn draft-btn" @tap="$emit('save-draft')">保存草稿</button>
                <button class="modal-btn modal-delete-btn" @tap="$emit('confirm')">删除</button>
            </view>
        </view>
    </view>
</template>

<script>
export default {
    name: 'DeleteModal',
    props: {
        visible: {
            type: Boolean,
            default: false
        },
        title: {
            type: String,
            default: '删除帖子'
        },
        message: {
            type: String,
            default: '您确定要删除这条帖子吗？'
        },
        showDraft: {
            type: Boolean,
            default: true
        }
    }
};
</script>

<style scoped>
.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
}

.modal-content {
    background: white;
    border-radius: 16rpx;
    margin: 40rpx;
    width: calc(100% - 80rpx);
    max-width: 600rpx;
    display: flex;
    flex-direction: column;
}

.modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 30rpx 40rpx;
    border-bottom: 1rpx solid #f0f0f0;
}

.modal-title {
    font-size: 36rpx;
    font-weight: 500;
    color: #333;
}

.close-btn {
    font-size: 48rpx;
    color: #999;
    line-height: 1;
    cursor: pointer;
}

.modal-body {
    padding: 40rpx;
}

.modal-text {
    font-size: 32rpx;
    color: #666;
    text-align: center;
    line-height: 1.5;
}

.modal-footer {
    display: flex;
    padding: 0 40rpx 40rpx;
    gap: 20rpx;
}

.modal-btn {
    flex: 1;
    height: 80rpx;
    border-radius: 12rpx;
    font-size: 28rpx;
    font-weight: 500;
    border: none;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.modal-btn:active {
    transform: scale(0.95);
}

.cancel-btn {
    background-color: #f5f5f5;
    color: #666;
}

.draft-btn {
    background-color: #f5f5f5;
    color: #666;
}

.modal-delete-btn {
    background-color: #cc9090;
    color: white;
}
</style>
