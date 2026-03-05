<template>
    <!-- components/skeleton/skeleton.wxml -->
    <view class="skeleton-wrapper">
        <!-- 根据页面类型显示不同的骨架屏 -->
        
        <!-- 诗歌广场/山页面骨架屏 - 简洁卡片样式 -->
        <view v-if="pageType === 'poem' || pageType === 'mountain'" class="skeleton-poem-square-container">
            <!-- 第一个诗歌卡片骨架 -->
            <view :class="['skeleton-poem-card', { 'mountain-card': pageType === 'mountain' }]">
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
            <view :class="['skeleton-poem-card', 'skeleton-secondary', { 'mountain-card': pageType === 'mountain' }]">
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
            <view :class="['skeleton-poem-card', 'skeleton-tertiary', { 'mountain-card': pageType === 'mountain' }]">
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

        <!-- 首页帖子列表骨架屏 -->
        <view v-else-if="pageType === 'index'" class="skeleton-index-container">
            <!-- 第一个帖子骨架 -->
            <view class="skeleton-post-card">
                <!-- 作者信息骨架 -->
                <view class="skeleton-author-info">
                    <view class="skeleton-avatar skeleton-animate"></view>
                    <view class="skeleton-author-name skeleton-animate"></view>
                </view>
                
                <!-- 帖子内容骨架 -->
                <view class="skeleton-post-content">
                    <view class="skeleton-title skeleton-animate"></view>
                    <view class="skeleton-title skeleton-animate" style="width: 80%"></view>
                    
                    <!-- 图片骨架 -->
                    <view class="skeleton-image skeleton-animate"></view>
                    
                    <!-- 内容骨架 -->
                    <view class="skeleton-content-line skeleton-animate"></view>
                    <view class="skeleton-content-line skeleton-animate"></view>
                    <view class="skeleton-content-line skeleton-animate" style="width: 70%"></view>
                    
                    <!-- 标签骨架 -->
                    <view class="skeleton-tags">
                        <view class="skeleton-tag skeleton-animate"></view>
                        <view class="skeleton-tag skeleton-animate"></view>
                    </view>
                </view>
                
                <!-- 交互区域骨架 -->
                <view class="skeleton-post-actions">
                    <view class="skeleton-action-button skeleton-animate"></view>
                    <view class="skeleton-action-button skeleton-animate"></view>
                </view>
            </view>

            <!-- 第二个帖子骨架 -->
            <view class="skeleton-post-card">
                <view class="skeleton-author-info">
                    <view class="skeleton-avatar skeleton-animate"></view>
                    <view class="skeleton-author-name skeleton-animate"></view>
                </view>
                
                <view class="skeleton-post-content">
                    <view class="skeleton-title skeleton-animate"></view>
                    <view class="skeleton-title skeleton-animate" style="width: 85%"></view>
                    
                    <view class="skeleton-content-line skeleton-animate"></view>
                    <view class="skeleton-content-line skeleton-animate" style="width: 60%"></view>
                    
                    <view class="skeleton-tags">
                        <view class="skeleton-tag skeleton-animate"></view>
                        <view class="skeleton-tag skeleton-animate"></view>
                        <view class="skeleton-tag skeleton-animate"></view>
                    </view>
                </view>
                
                <view class="skeleton-post-actions">
                    <view class="skeleton-action-button skeleton-animate"></view>
                    <view class="skeleton-action-button skeleton-animate"></view>
                </view>
            </view>
        </view>

               <!-- 个人主页骨架屏 -->
               <view v-else-if="pageType === 'profile'" class="skeleton-profile-container">
                   <!-- 用户信息卡片骨架 -->
                   <view class="skeleton-profile-card">
                       <!-- 成长统计骨架 -->
                       <view class="skeleton-growth-stats">
                           <view class="skeleton-growth-item skeleton-animate"></view>
                           <view class="skeleton-growth-item skeleton-animate"></view>
                           <view class="skeleton-growth-item skeleton-animate"></view>
                       </view>
                       
                       <!-- 头像骨架 -->
                       <view class="skeleton-avatar-large skeleton-animate"></view>
                       
                       <!-- 用户信息骨架 -->
                       <view class="skeleton-user-info">
                           <view class="skeleton-username skeleton-animate"></view>
                           <view class="skeleton-poemid skeleton-animate"></view>
                           <view class="skeleton-bio skeleton-animate"></view>
                           <view class="skeleton-bio skeleton-animate" style="width: 80%"></view>
                           <view class="skeleton-follow-info">
                               <view class="skeleton-follow-text skeleton-animate"></view>
                               <view class="skeleton-follow-button skeleton-animate"></view>
                           </view>
                       </view>
                   </view>

                   <!-- 年龄生日卡片骨架 -->
                   <view class="skeleton-detail-card">
                       <view class="skeleton-detail-item skeleton-animate"></view>
                       <view class="skeleton-detail-item skeleton-animate"></view>
                   </view>

                   <!-- 切换栏骨架 -->
                   <view class="skeleton-tab-navigation">
                       <view class="skeleton-tab-item skeleton-animate"></view>
                       <view class="skeleton-tab-item skeleton-animate"></view>
                       <view class="skeleton-tab-item skeleton-animate"></view>
                   </view>

                   <!-- 帖子列表骨架 -->
                   <view class="skeleton-posts-section">
                       <view class="skeleton-post-item">
                           <view class="skeleton-author-info">
                               <view class="skeleton-avatar skeleton-animate"></view>
                               <view class="skeleton-author-name skeleton-animate"></view>
                           </view>
                           
                           <view class="skeleton-post-content">
                               <view class="skeleton-title skeleton-animate"></view>
                               <view class="skeleton-title skeleton-animate" style="width: 75%"></view>
                               
                               <view class="skeleton-content-line skeleton-animate"></view>
                               <view class="skeleton-content-line skeleton-animate" style="width: 85%"></view>
                           </view>
                           
                           <view class="skeleton-post-time skeleton-animate"></view>
                       </view>
                   </view>
               </view>

               <!-- 用户主页骨架屏 -->
               <view v-else-if="pageType === 'user-profile'" class="skeleton-user-profile-container">
            <!-- 用户信息卡片骨架 -->
            <view class="skeleton-profile-card">
                <!-- 成长统计骨架 -->
                <view class="skeleton-growth-stats">
                    <view class="skeleton-growth-item skeleton-animate"></view>
                    <view class="skeleton-growth-item skeleton-animate"></view>
                    <view class="skeleton-growth-item skeleton-animate"></view>
                </view>
                
                <!-- 头像骨架 -->
                <view class="skeleton-avatar-large skeleton-animate"></view>
                
                <!-- 用户信息骨架 -->
                <view class="skeleton-user-info">
                    <view class="skeleton-username skeleton-animate"></view>
                    <view class="skeleton-poemid skeleton-animate"></view>
                    <view class="skeleton-bio skeleton-animate"></view>
                    <view class="skeleton-bio skeleton-animate" style="width: 80%"></view>
                    <view class="skeleton-follow-info">
                        <view class="skeleton-follow-text skeleton-animate"></view>
                        <view class="skeleton-follow-button skeleton-animate"></view>
                    </view>
                </view>
            </view>

            <!-- 切换栏骨架 -->
            <view class="skeleton-tab-navigation">
                <view class="skeleton-tab-item skeleton-animate"></view>
                <view class="skeleton-tab-item skeleton-animate"></view>
                <view class="skeleton-tab-item skeleton-animate"></view>
            </view>

            <!-- 帖子列表骨架 -->
            <view class="skeleton-posts-section">
                <view class="skeleton-post-item">
                    <view class="skeleton-author-info">
                        <view class="skeleton-avatar skeleton-animate"></view>
                        <view class="skeleton-author-name skeleton-animate"></view>
                    </view>
                    
                    <view class="skeleton-post-content">
                        <view class="skeleton-title skeleton-animate"></view>
                        <view class="skeleton-title skeleton-animate" style="width: 75%"></view>
                        
                        <view class="skeleton-content-line skeleton-animate"></view>
                        <view class="skeleton-content-line skeleton-animate" style="width: 85%"></view>
                    </view>
                    
                    <view class="skeleton-post-time skeleton-animate"></view>
                </view>
            </view>
        </view>

        <!-- 帖子详情页骨架屏 -->
        <view v-else-if="pageType === 'post-detail'" class="skeleton-post-detail-container">
            <!-- 帖子内容骨架 -->
            <view class="skeleton-detail-wrapper">
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
            <!-- 评论区骨架 -->
            <view class="skeleton-section-title skeleton-animate"></view>
            <view class="skeleton-comment-list">
                <view class="skeleton-comment-item" v-for="n in 3" :key="n">
                    <view class="skeleton-avatar skeleton-animate"></view>
                    <view class="skeleton-comment-body">
                        <view class="skeleton-line medium skeleton-animate"></view>
                        <view class="skeleton-line short skeleton-animate"></view>
                    </view>
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
    props: {
        pageType: {
            type: String,
            default: 'poem' // 默认诗歌广场样式
        }
    },
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

/* mountain页面卡片样式 - 匹配mountain页面设计 */
.skeleton-poem-card.mountain-card {
    padding: 40rpx;
    border-radius: 20rpx;
    margin-bottom: 30rpx;
    box-shadow: 0 4rpx 4rpx rgba(0, 0, 0, 0.25);
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

/* 动画效果 - 更柔和的微光效果 */
.skeleton-animate {
    background: linear-gradient(90deg, 
        rgba(255, 255, 255, 0.1) 0%, 
        rgba(255, 255, 255, 0.3) 20%, 
        rgba(255, 255, 255, 0.5) 50%, 
        rgba(255, 255, 255, 0.3) 80%, 
        rgba(255, 255, 255, 0.1) 100%);
    background-size: 400% 100%;
    animation: skeleton-shimmer 1.8s ease-in-out infinite;
}

@keyframes skeleton-shimmer {
    0% {
        background-position: 100% 0;
    }
    100% {
        background-position: -100% 0;
    }
}

/* ========== 首页帖子列表骨架屏样式 ========== */
.skeleton-index-container {
    width: 100%;
    max-width: 750rpx;
    display: flex;
    flex-direction: column;
    padding: 0 40rpx;
}

.skeleton-post-card {
    background: #fff;
    margin-bottom: 20rpx;
    border-radius: 0;
    border-bottom: 1rpx solid #f0f0f0;
    padding: 0;
}

.skeleton-author-info {
    display: flex;
    align-items: center;
    padding: 20rpx 40rpx 10rpx 40rpx;
    background: #fff;
}

.skeleton-avatar {
    width: 60rpx;
    height: 60rpx;
    border-radius: 50%;
    margin-right: 15rpx;
    background: #f0f0f0;
}

.skeleton-author-name {
    height: 28rpx;
    width: 120rpx;
    border-radius: 14rpx;
    background: #f0f0f0;
}

.skeleton-post-content {
    padding: 20rpx 40rpx 30rpx 40rpx;
    background: #fff;
}

.skeleton-title {
    height: 36rpx;
    width: 100%;
    border-radius: 18rpx;
    background: #f0f0f0;
    margin-bottom: 15rpx;
}

.skeleton-image {
    height: 200rpx;
    width: 100%;
    border-radius: 8rpx;
    background: #f0f0f0;
    margin: 20rpx 0;
}

.skeleton-content-line {
    height: 28rpx;
    width: 100%;
    border-radius: 14rpx;
    background: #f0f0f0;
    margin-bottom: 10rpx;
}

.skeleton-tags {
    display: flex;
    gap: 10rpx;
    margin-top: 20rpx;
}

.skeleton-tag {
    height: 26rpx;
    width: 60rpx;
    border-radius: 13rpx;
    background: #f0f0f0;
}

.skeleton-post-actions {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 30rpx;
    padding: 10rpx 60rpx 15rpx 60rpx;
    background: #fff;
}

.skeleton-action-button {
    width: 40rpx;
    height: 40rpx;
    border-radius: 50%;
    background: #f0f0f0;
}

/* ========== 个人主页骨架屏样式 ========== */
.skeleton-profile-container {
    width: 100%;
    min-height: 100vh;
    background: #fff;
}

.skeleton-profile-card {
    position: relative;
    padding: 40rpx 40rpx 20rpx 40rpx;
    background: transparent;
    display: flex;
    flex-direction: column;
    align-items: center;
}

.skeleton-growth-stats {
    position: absolute;
    top: 120rpx;
    right: 40rpx;
    display: flex;
    flex-direction: column;
    gap: 18rpx;
}

.skeleton-growth-item {
    width: 48rpx;
    height: 48rpx;
    border-radius: 24rpx;
    background: #f0f0f0;
}

.skeleton-avatar-large {
    width: 175rpx;
    height: 175rpx;
    border-radius: 50%;
    background: #f0f0f0;
    margin: 70rpx 0 40rpx 0;
}

.skeleton-user-info {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    width: 100%;
    margin-top: 20rpx;
}

.skeleton-username {
    height: 30rpx;
    width: 200rpx;
    border-radius: 15rpx;
    background: #f0f0f0;
    margin-bottom: 20rpx;
}

.skeleton-poemid {
    height: 20rpx;
    width: 150rpx;
    border-radius: 10rpx;
    background: #f0f0f0;
    margin-bottom: 20rpx;
}

.skeleton-bio {
    height: 24rpx;
    width: 100%;
    border-radius: 12rpx;
    background: #f0f0f0;
    margin-bottom: 10rpx;
}

.skeleton-follow-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    margin-top: 20rpx;
}

.skeleton-follow-text {
    height: 24rpx;
    width: 120rpx;
    border-radius: 12rpx;
    background: #f0f0f0;
}

.skeleton-follow-button {
    height: 40rpx;
    width: 80rpx;
    border-radius: 20rpx;
    background: #f0f0f0;
}

.skeleton-detail-card {
    margin: 0 30rpx 30rpx 30rpx;
    padding: 30rpx 40rpx;
    background: #fff;
    border-radius: 16rpx;
    display: flex;
    gap: 40rpx;
}

.skeleton-detail-item {
    height: 28rpx;
    width: 120rpx;
    border-radius: 14rpx;
    background: #f0f0f0;
}

.skeleton-tab-navigation {
    margin: 0 30rpx 20rpx 30rpx;
    display: flex;
    background: #fff;
    border-radius: 16rpx;
    overflow: hidden;
}

.skeleton-tab-item {
    flex: 1;
    height: 80rpx;
    background: #f0f0f0;
    margin: 1rpx;
}

.skeleton-posts-section {
    margin: 0 0 30rpx 0;
}

.skeleton-post-item {
    background: #fff;
    margin-bottom: 20rpx;
    border-bottom: 1rpx solid #f0f0f0;
}

.skeleton-post-time {
    height: 24rpx;
    width: 120rpx;
    border-radius: 12rpx;
    background: #f0f0f0;
    margin: 20rpx 40rpx;
}

/* ========== 用户主页骨架屏样式 ========== */
.skeleton-user-profile-container {
    width: 100%;
    min-height: 100vh;
    background: #fff;
}

.skeleton-profile-card {
    position: relative;
    padding: 40rpx 40rpx 20rpx 40rpx;
    background: transparent;
    display: flex;
    flex-direction: column;
    align-items: center;
}

.skeleton-growth-stats {
    position: absolute;
    top: 120rpx;
    right: 40rpx;
    display: flex;
    flex-direction: column;
    gap: 18rpx;
}

.skeleton-growth-item {
    width: 48rpx;
    height: 48rpx;
    border-radius: 24rpx;
    background: #f0f0f0;
}

.skeleton-avatar-large {
    width: 175rpx;
    height: 175rpx;
    border-radius: 50%;
    background: #f0f0f0;
    margin: 70rpx 0 40rpx 0;
}

.skeleton-user-info {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    width: 100%;
    margin-top: 20rpx;
}

.skeleton-username {
    height: 30rpx;
    width: 200rpx;
    border-radius: 15rpx;
    background: #f0f0f0;
    margin-bottom: 20rpx;
}

.skeleton-poemid {
    height: 20rpx;
    width: 150rpx;
    border-radius: 10rpx;
    background: #f0f0f0;
    margin-bottom: 20rpx;
}

.skeleton-bio {
    height: 24rpx;
    width: 100%;
    border-radius: 12rpx;
    background: #f0f0f0;
    margin-bottom: 10rpx;
}

.skeleton-follow-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    margin-top: 20rpx;
}

.skeleton-follow-text {
    height: 24rpx;
    width: 120rpx;
    border-radius: 12rpx;
    background: #f0f0f0;
}

.skeleton-follow-button {
    height: 40rpx;
    width: 80rpx;
    border-radius: 20rpx;
    background: #f0f0f0;
}

.skeleton-tab-navigation {
    margin: 0 30rpx 20rpx 30rpx;
    display: flex;
    background: #fff;
    border-radius: 16rpx;
    overflow: hidden;
}

.skeleton-tab-item {
    flex: 1;
    height: 80rpx;
    background: #f0f0f0;
    margin: 1rpx;
}

.skeleton-posts-section {
    margin: 0 0 30rpx 0;
}

.skeleton-post-item {
    background: #fff;
    margin-bottom: 20rpx;
    border-bottom: 1rpx solid #f0f0f0;
}

.skeleton-post-time {
    height: 24rpx;
    width: 120rpx;
    border-radius: 12rpx;
    background: #f0f0f0;
    margin: 20rpx 40rpx;
}

/* 帖子详情页骨架屏样式 */
.skeleton-post-detail-container {
    padding: 30rpx;
}

.skeleton-detail-wrapper {
    background: #fff;
    padding: 30rpx;
    border-radius: 16rpx;
    margin-bottom: 30rpx;
}

.skeleton-section-title {
    height: 36rpx;
    width: 150rpx;
    border-radius: 8rpx;
    background: #f0f0f0;
    margin-bottom: 20rpx;
}

.skeleton-comment-list {
    background: #fff;
    padding: 20rpx 30rpx;
    border-radius: 16rpx;
}

.skeleton-comment-item {
    display: flex;
    padding: 20rpx 0;
    border-bottom: 1rpx solid #f5f5f5;
}

.skeleton-comment-item:last-child {
    border-bottom: none;
}

.skeleton-comment-body {
    flex: 1;
    margin-left: 15rpx;
}
</style>
