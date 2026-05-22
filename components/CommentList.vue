<template>
    <view class="comment-section">
        <view class="section-title">共 {{ isLoading ? '--' : commentCount }} 条评论</view>
        
        <!-- 评论骨架屏 -->
        <view v-if="isLoading" class="comment-skeleton-list">
            <view class="comment-skeleton-item" v-for="n in skeletonCount" :key="n">
                <view class="skeleton-avatar skeleton-animate"></view>
                <view class="comment-skeleton-body">
                    <view class="skeleton-line medium skeleton-animate"></view>
                    <view class="skeleton-line short skeleton-animate"></view>
                </view>
            </view>
        </view>
        
        <!-- 评论列表 -->
        <view v-else class="comment-list">
            <block v-if="comments.length > 0">
                <comment-item
                    v-for="(item, commentIndex) in comments"
                    :key="item._id || commentIndex"
                    :item="item"
                    :comment-index="commentIndex"
                    @avatar-error="$emit('avatar-error', $event)"
                    @navigate-to-user="$emit('navigate-to-user', $event)"
                    @reply-click="$emit('reply-click', $event)"
                    @like="$emit('like', $event)"
                    @delete="$emit('delete', $event)"
                    @preview-image="$emit('preview-image', $event)"
                    @toggle-replies="$emit('toggle-replies', $event)"
                />
            </block>
            <block v-else>
                <view class="no-comment-tip">
                    <view class="empty-icon">💬</view>
                    <view class="empty-text">{{ emptyText }}</view>
                </view>
            </block>
        </view>
    </view>
</template>

<script>
import CommentItem from './CommentItem.vue';

export default {
    name: 'CommentList',
    components: {
        CommentItem
    },
    emits: ['avatar-error', 'navigate-to-user', 'reply-click', 'like', 'delete', 'preview-image', 'toggle-replies'],
    props: {
        comments: {
            type: Array,
            default: () => []
        },
        commentCount: {
            type: Number,
            default: 0
        },
        isLoading: {
            type: Boolean,
            default: false
        },
        skeletonCount: {
            type: Number,
            default: 3
        },
        emptyText: {
            type: String,
            default: '暂无评论，快来抢沙发吧！'
        }
    }
};
</script>

<style scoped>
.comment-section {
    background: var(--app-post-section-bg, var(--app-post-wrapper-bg, var(--app-surface-bg, #fff)));
    padding: 30rpx 40rpx;
    margin-top: 20rpx;
}

.section-title {
    font-size: 32rpx;
    font-weight: bold;
    color: var(--app-primary-text, #333);
    margin-bottom: 20rpx;
}

.comment-list {
    margin-top: 20rpx;
}

/* 评论骨架屏 */
.comment-skeleton-list {
    display: flex;
    flex-direction: column;
    gap: 0;
}

.comment-skeleton-item {
    display: flex;
    align-items: flex-start;
    background-color: var(--app-post-section-bg, var(--app-post-wrapper-bg, var(--app-surface-bg, #fff)));
    padding: 20rpx 0;
    border-bottom: 1rpx solid var(--app-border-color, #f5f5f5);
}

.comment-skeleton-item:last-child {
    border-bottom: none;
}

.skeleton-avatar {
    width: 60rpx;
    height: 60rpx;
    border-radius: 50%;
    background-color: var(--app-subtle-surface-bg, #e9edf3);
    flex-shrink: 0;
}

.comment-skeleton-body {
    flex: 1;
    margin-left: 15rpx;
}

.skeleton-line {
    height: 20rpx;
    background-color: var(--app-subtle-surface-bg, #e9edf3);
    border-radius: 999rpx;
    margin-bottom: 12rpx;
}

.skeleton-line:last-child {
    margin-bottom: 0;
}

.skeleton-line.medium {
    width: 70%;
}

.skeleton-line.short {
    width: 45%;
}

.skeleton-animate {
    position: relative;
    overflow: hidden;
}

.skeleton-animate::after {
    content: '';
    position: absolute;
    top: 0;
    left: -150%;
    width: 150%;
    height: 100%;
    background: var(--app-skeleton-shimmer-bg, linear-gradient(90deg, rgba(233, 237, 243, 0) 0%, rgba(255, 255, 255, 0.9) 50%, rgba(233, 237, 243, 0) 100%));
    animation: skeletonPulse 1.2s ease-in-out infinite;
}

@keyframes skeletonPulse {
    0% {
        left: -150%;
    }
    100% {
        left: 100%;
    }
}

/* 空状态 */
.no-comment-tip {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60rpx 40rpx;
    text-align: center;
}

.empty-icon {
    font-size: 80rpx;
    margin-bottom: 20rpx;
    opacity: 0.6;
}

.empty-text {
    font-size: 28rpx;
    color: var(--app-muted-text, #999);
}
</style>
