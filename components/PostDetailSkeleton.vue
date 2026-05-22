<template>
    <view class="post-detail-skeleton">
        <view class="skeleton-wrapper">
            <view class="skeleton-header">
                <view class="skeleton-avatar skeleton-animate"></view>
                <view class="skeleton-header-text">
                    <view class="skeleton-line medium skeleton-animate"></view>
                    <view class="skeleton-line short skeleton-animate"></view>
                </view>
            </view>
            <view class="skeleton-line long skeleton-animate"></view>
            <view class="skeleton-line medium skeleton-animate"></view>
            <view class="skeleton-line short skeleton-animate"></view>
            <view class="skeleton-image skeleton-animate"></view>
            <view class="skeleton-line long skeleton-animate"></view>
            <view class="skeleton-line medium skeleton-animate"></view>
        </view>
        <view class="skeleton-section-title skeleton-animate"></view>
        <view class="comment-skeleton-list">
            <view class="comment-skeleton-item" v-for="n in commentCount" :key="n">
                <view class="skeleton-avatar skeleton-animate"></view>
                <view class="comment-skeleton-body">
                    <view class="skeleton-line medium skeleton-animate"></view>
                    <view class="skeleton-line short skeleton-animate"></view>
                </view>
            </view>
        </view>
    </view>
</template>

<script>
export default {
    name: 'PostDetailSkeleton',
    props: {
        commentCount: {
            type: Number,
            default: 3
        }
    }
};
</script>

<style scoped>
.post-detail-skeleton {
    padding: 0;
    min-height: 100vh;
    background: var(--app-page-bg, transparent);
    color: var(--app-primary-text, #111111);
}

.skeleton-wrapper {
    background: var(--app-post-wrapper-bg, var(--app-surface-bg, #fff));
    padding: 40rpx 40rpx 20rpx 40rpx;
    border-bottom: var(--app-post-wrapper-divider, 1rpx solid var(--app-border-color, #f0f0f0));
    margin-bottom: 0;
}

.skeleton-header {
    display: flex;
    align-items: center;
    margin-bottom: 24rpx;
}

.skeleton-avatar {
    width: 88rpx;
    height: 88rpx;
    border-radius: 50%;
    background-color: var(--app-skeleton-block-bg, var(--app-subtle-surface-bg, #e9edf3));
}

.skeleton-header-text {
    flex: 1;
    margin-left: 24rpx;
}

.skeleton-line {
    height: 24rpx;
    background-color: var(--app-skeleton-block-bg, var(--app-subtle-surface-bg, #e9edf3));
    border-radius: 999rpx;
    margin-bottom: 16rpx;
}

.skeleton-line:last-child {
    margin-bottom: 0;
}

.skeleton-line.long {
    width: 100%;
}

.skeleton-line.medium {
    width: 70%;
}

.skeleton-line.short {
    width: 45%;
}

.skeleton-image {
    width: 100%;
    height: 340rpx;
    border-radius: 20rpx;
    background-color: var(--app-skeleton-block-bg, var(--app-subtle-surface-bg, #e9edf3));
    margin: 30rpx 0;
}

.skeleton-section-title {
    width: 50%;
    height: 28rpx;
    border-radius: 999rpx;
    background-color: var(--app-skeleton-block-bg, var(--app-subtle-surface-bg, #e9edf3));
    margin: 10rpx 40rpx 30rpx 40rpx;
}

.comment-skeleton-list {
    display: flex;
    flex-direction: column;
    gap: 0;
}

.comment-skeleton-item {
    display: flex;
    align-items: flex-start;
    background-color: var(--app-surface-bg, #fff);
    padding: 20rpx 40rpx;
    border-bottom: 1rpx solid var(--app-border-color, #f5f5f5);
}

.comment-skeleton-body {
    flex: 1;
    margin-left: 24rpx;
}

.comment-skeleton-body .skeleton-line {
    height: 20rpx;
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
</style>
