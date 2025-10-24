<template>
    <!-- components/skeleton/skeleton.wxml -->
    <view class="skeleton-wrapper">
        <!-- 诗歌广场骨架屏 - 简洁卡片样式 -->
        <view class="skeleton-poem-square-container">
            <!-- 第一个诗歌卡片骨架 -->
            <view class="skeleton-poem-card">
                <!-- 诗歌内容骨架 -->
                <view class="skeleton-poem-content">
                    <view class="skeleton-poem-line skeleton-animate"></view>
                    <view class="skeleton-poem-line skeleton-animate"></view>
                    <view class="skeleton-poem-line skeleton-animate" style="width: 75%"></view>
                </view>
                <!-- 交互按钮骨架 -->
                <view class="skeleton-interaction">
                    <view class="skeleton-button skeleton-animate"></view>
                    <view class="skeleton-button skeleton-animate"></view>
                </view>
            </view>

            <!-- 第二个诗歌卡片骨架 -->
            <view class="skeleton-poem-card skeleton-secondary">
                <view class="skeleton-poem-content">
                    <view class="skeleton-poem-line skeleton-animate"></view>
                    <view class="skeleton-poem-line skeleton-animate" style="width: 85%"></view>
                    <view class="skeleton-poem-line skeleton-animate" style="width: 60%"></view>
                </view>
                <view class="skeleton-interaction">
                    <view class="skeleton-button skeleton-animate"></view>
                    <view class="skeleton-button skeleton-animate"></view>
                </view>
            </view>

            <!-- 第三个诗歌卡片骨架 -->
            <view class="skeleton-poem-card skeleton-tertiary">
                <view class="skeleton-poem-content">
                    <view class="skeleton-poem-line skeleton-animate"></view>
                    <view class="skeleton-poem-line skeleton-animate"></view>
                    <view class="skeleton-poem-line skeleton-animate" style="width: 70%"></view>
                </view>
                <view class="skeleton-interaction">
                    <view class="skeleton-button skeleton-animate"></view>
                    <view class="skeleton-button skeleton-animate"></view>
                </view>
            </view>
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
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 250rpx 20rpx 40rpx 20rpx; /* 增加上边距，避免被tab挡住 */
    box-sizing: border-box;
    background: #fff;
}

/* 诗歌广场骨架屏容器 */
.skeleton-poem-square-container {
    width: 100%;
    max-width: 750rpx;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 40rpx;
    padding: 0 40rpx; /* 与真实内容保持一致的左右边距 */
}

/* 诗歌卡片骨架样式 - 匹配poem-square页面设计 */
.skeleton-poem-card {
    width: calc(100% - 80rpx);
    max-width: 670rpx;
    display: flex;
    flex-direction: column;
    padding: 30rpx 60rpx 30rpx 80rpx;
    box-sizing: border-box;
    background: #a4c4bd;
    border-radius: 30rpx;
    box-shadow: 0 8rpx 8rpx rgba(0, 0, 0, 0.25);
    position: relative;
    margin-bottom: 40rpx;
}

/* 第二个卡片样式 */
.skeleton-poem-card.skeleton-secondary {
    background: #c9cfcf;
    opacity: 0.8;
    transform: scale(0.98);
}

/* 第三个卡片样式 */
.skeleton-poem-card.skeleton-tertiary {
    background: #906161;
    opacity: 0.6;
    transform: scale(0.96);
}

/* 诗歌内容骨架 */
.skeleton-poem-content {
    margin: 30rpx 0;
    display: flex;
    flex-direction: column;
    gap: 15rpx;
}

/* 诗歌行骨架 */
.skeleton-poem-line {
    height: 28rpx;
    border-radius: 14rpx;
    width: 100%;
}

/* 交互按钮区域骨架 */
.skeleton-interaction {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 30rpx;
    padding: 35rpx 50rpx;
    margin-top: auto;
}

/* 按钮骨架 */
.skeleton-button {
    width: 60rpx;
    height: 60rpx;
    border-radius: 50%;
}

/* 动画效果 */
.skeleton-animate {
    background: linear-gradient(90deg, 
        rgba(255, 255, 255, 0.2) 25%, 
        rgba(255, 255, 255, 0.4) 50%, 
        rgba(255, 255, 255, 0.2) 75%);
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
