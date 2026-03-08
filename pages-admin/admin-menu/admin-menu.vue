<template>
    <view class="admin-menu-container">
        <view class="admin-header">
            <text class="admin-title">管理中心</text>
        </view>

        <view class="menu-list">
            <view class="menu-item" @tap="navigateTo" data-url="/pages-admin/admin-posts/admin-posts">
                <view class="menu-icon">📝</view>
                <view class="menu-info">
                    <text class="menu-title">管理帖子</text>
                    <text class="menu-desc">查看、删除和修改帖子类型</text>
                </view>
                <text class="menu-arrow">→</text>
            </view>

            <view class="menu-item" @tap="navigateTo" data-url="/pages-admin/poet-management/poet-management">
                <view class="menu-icon">✍️</view>
                <view class="menu-info">
                    <text class="menu-title">管理诗人</text>
                    <text class="menu-desc">清理错误创建的诗人主页</text>
                </view>
                <text class="menu-arrow">→</text>
            </view>

            <view class="menu-item" @tap="navigateTo" data-url="/pages-admin/feedback-list/feedback-list">
                <view class="menu-icon">💬</view>
                <view class="menu-info">
                    <text class="menu-title">反馈建议</text>
                    <text class="menu-desc">查看用户反馈和建议</text>
                </view>
                <text class="menu-arrow">→</text>
            </view>

            <view class="menu-item" @tap="navigateTo" data-url="/pages-admin/activity-management/activity-management">
                <view class="menu-icon">🎯</view>
                <view class="menu-info">
                    <text class="menu-title">活动管理</text>
                    <text class="menu-desc">创建活动并发布活动帖</text>
                </view>
                <text class="menu-arrow">→</text>
            </view>

            <view class="menu-item" @tap="navigateTo" data-url="/pages-admin/password-recovery/password-recovery">
                <view class="menu-icon">🔑</view>
                <view class="menu-info">
                    <text class="menu-title">找回密码</text>
                    <text class="menu-desc">查询用户密码信息</text>
                </view>
                <text class="menu-arrow">→</text>
            </view>
        </view>
    </view>
</template>

<script>
export default {
    methods: {
        navigateTo(e) {
            const url = e.currentTarget.dataset.url;
            uni.navigateTo({ url });
        }
    }
};
</script>

<style scoped>
.admin-menu-container {
    min-height: 100vh;
    background-color: #f5f5f5;
    padding: 20rpx;
}

.admin-header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    padding: 40rpx 30rpx;
    margin-bottom: 20rpx;
    border-radius: 10rpx;
}

.admin-title {
    font-size: 40rpx;
    font-weight: bold;
    color: white;
}

.menu-list {
    display: flex;
    flex-direction: column;
    gap: 20rpx;
}

.menu-item {
    background: white;
    padding: 30rpx;
    border-radius: 10rpx;
    display: flex;
    align-items: center;
    gap: 20rpx;
}

.menu-icon {
    font-size: 48rpx;
    width: 80rpx;
    text-align: center;
}

.menu-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 10rpx;
}

.menu-title {
    font-size: 32rpx;
    font-weight: bold;
    color: #333;
}

.menu-desc {
    font-size: 24rpx;
    color: #999;
}

.menu-arrow {
    font-size: 36rpx;
    color: #ccc;
}
</style>
