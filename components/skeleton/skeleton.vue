<template>
    <!-- components/skeleton/skeleton.wxml -->
    <view class="skeleton-wrapper">
        <!-- 读诗页骨架屏 - 单个大卡片样式 -->
        <view class="skeleton-poem-card">
            <!-- 原创标识骨架 -->
            <view class="skeleton-original-badge skeleton-animate"></view>

            <!-- 作者信息骨架 -->
            <view class="skeleton-author-info">
                <view class="skeleton-avatar skeleton-animate"></view>
                <view class="skeleton-name skeleton-animate"></view>
            </view>

            <!-- 居中标题骨架 -->
            <view class="skeleton-title skeleton-animate"></view>

            <!-- 大内容区域骨架 -->
            <view class="skeleton-content-large skeleton-animate"></view>
            <view class="skeleton-content-large skeleton-animate"></view>
            <view class="skeleton-content-large skeleton-animate" style="width: 70%"></view>
        </view>

        <!-- 额外的卡片用于显示加载效果 -->
        <view class="skeleton-poem-card skeleton-secondary">
            <view class="skeleton-author-info">
                <view class="skeleton-avatar skeleton-animate"></view>
                <view class="skeleton-name skeleton-animate"></view>
            </view>
            <view class="skeleton-title skeleton-animate"></view>
            <view class="skeleton-content-large skeleton-animate"></view>
            <view class="skeleton-content-large skeleton-animate" style="width: 80%"></view>
        </view>
    </view>
</template>

<script>
// components/skeleton/skeleton.js
export default {
    data() {
        return {};
    },
    /**
     * 组件的属性列表
     */
    props: {},
    /**
     * 组件的方法列表
     */
    methods: {},
    created: function () {}
};
</script>
<style>
/* components/skeleton/skeleton.wxss */
.skeleton-wrapper {
    width: 100%;
    height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 20rpx;
    box-sizing: border-box;
}

/* 读诗页骨架屏卡片样式 - 匹配读诗页设计 */
.skeleton-poem-card {
    width: calc(100% - 40rpx);
    height: calc(100% - 80rpx);
    display: flex;
    flex-direction: column;
    padding: 40rpx 20rpx;
    box-sizing: border-box;
    background: rgba(255, 255, 255, 0.95);
    margin: 40rpx 20rpx;
    border-radius: 24rpx;
    box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.1);
    position: relative;
}

/* 第二个卡片透明度降低 */
.skeleton-poem-card.skeleton-secondary {
    opacity: 0.6;
    position: absolute;
    top: 20rpx;
    left: 20rpx;
    right: 20rpx;
    bottom: 20rpx;
    z-index: -1;
    transform: scale(0.95);
}

/* 原创标识骨架 */
.skeleton-original-badge {
    position: absolute;
    top: 20rpx;
    right: 20rpx;
    width: 80rpx;
    height: 40rpx;
    border-radius: 20rpx;
}

/* 作者信息骨架 */
.skeleton-author-info {
    display: flex;
    align-items: center;
    margin-bottom: 15rpx;
    padding-bottom: 10rpx;
}

.skeleton-avatar {
    width: 80rpx;
    height: 80rpx;
    border-radius: 50%;
    margin-right: 20rpx;
}

.skeleton-name {
    width: 200rpx;
    height: 32rpx;
    border-radius: 16rpx;
}

/* 居中标题骨架 */
.skeleton-title {
    width: 60%;
    height: 40rpx;
    margin: 0 auto 20rpx auto; /* 居中并增加下边距 */
    border-radius: 20rpx;
    text-align: center;
}

/* 大内容区域骨架 */
.skeleton-content-large {
    width: 100%;
    height: 40rpx;
    margin-bottom: 20rpx;
    border-radius: 20rpx;
}

.skeleton-animate {
    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
    background-size: 200% 100%;
    animation: skeleton-loading 1.5s infinite linear;
}

@keyframes skeleton-loading {
    0% {
        background-position: 200% 0;
    }
    100% {
        background-position: -200% 0;
    }
}
</style>
