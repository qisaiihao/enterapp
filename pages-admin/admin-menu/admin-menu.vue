<template>
    <view class="admin-menu-container">
        <view class="admin-header">
            <view class="admin-back-btn" @tap="goBack" aria-label="返回">
                <image class="admin-back-icon" src="/static/images/left_exit.png" mode="aspectFit"></image>
            </view>
            <text class="admin-title">管理中心</text>
        </view>

        <view class="menu-list">
            <view class="menu-item" @tap="navigateTo" data-url="/pages-admin/admin-list/admin-list">
                <view class="menu-icon">👤</view>
                <view class="menu-info">
                    <text class="menu-title">管理员管理</text>
                    <text class="menu-desc">查看和添加管理员</text>
                </view>
                <text class="menu-arrow">→</text>
            </view>

            <view class="menu-item" @tap="navigateTo" data-url="/pages-admin/admin-posts/admin-posts">
                <view class="menu-icon">📝</view>
                <view class="menu-info">
                    <text class="menu-title">管理帖子</text>
                    <text class="menu-desc">查看、删除和修改帖子类型</text>
                </view>
                <text class="menu-arrow">→</text>
            </view>

            <view class="menu-item" @tap="navigateTo" data-url="/pages-admin/post-reports/post-reports">
                <view class="menu-icon">🚩</view>
                <view class="menu-info">
                    <text class="menu-title">举报与复核</text>
                    <text class="menu-desc">处理举报和被拦截内容的人工复核</text>
                </view>
                <text class="menu-arrow">→</text>
            </view>

            <view class="menu-item" @tap="navigateTo" data-url="/pages-admin/posting-ban/posting-ban">
                <view class="menu-icon">⛔</view>
                <view class="menu-info">
                    <text class="menu-title">发帖限制</text>
                    <text class="menu-desc">按诗号查找用户，限制或恢复发帖</text>
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

            <view class="menu-item" @tap="navigateTo" data-url="/pages-community/review/review">
                <view class="menu-icon">校</view>
                <view class="menu-info">
                    <text class="menu-title">诗社入驻审核</text>
                    <text class="menu-desc">审核高校诗社资料，开通诗社主页</text>
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

            <view class="menu-item" @tap="navigateTo" data-url="/pages-admin/activity-notice-management/activity-notice-management">
                <view class="menu-icon">📣</view>
                <view class="menu-info">
                    <text class="menu-title">活动公告</text>
                    <text class="menu-desc">管理活动页顶部公告轮播</text>
                </view>
                <text class="menu-arrow">→</text>
            </view>

            <view class="menu-item" @tap="navigateTo" data-url="/pages-admin/weekly-management/weekly-management">
                <view class="menu-icon">🗞️</view>
                <view class="menu-info">
                    <text class="menu-title">周刊管理</text>
                    <text class="menu-desc">发布周刊、主题精选和热榜快照</text>
                </view>
                <text class="menu-arrow">→</text>
            </view>

            <view class="menu-item" @tap="navigateTo" data-url="/pages-admin/collage-material-management/collage-material-management">
                <view class="menu-icon">🧩</view>
                <view class="menu-info">
                    <text class="menu-title">拼贴素材</text>
                    <text class="menu-desc">上传和管理拼贴诗官方纸片、背景</text>
                </view>
                <text class="menu-arrow">→</text>
            </view>

            <view class="menu-item" @tap="navigateTo" data-url="/pages-admin/square-bubble-management/square-bubble-management">
                <view class="menu-icon">💬</view>
                <view class="menu-info">
                    <text class="menu-title">广场气泡</text>
                    <text class="menu-desc">设置乌鸦的文案和跳转页面</text>
                </view>
                <text class="menu-arrow">→</text>
            </view>

            <view class="menu-item" @tap="navigateTo" data-url="/pages-admin/contact-management/contact-management">
                <view class="menu-icon">✉️</view>
                <view class="menu-info">
                    <text class="menu-title">联系我们</text>
                    <text class="menu-desc">上传微信群二维码和修改联系方式</text>
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
    <app-overlay-host />
</template>

<script>
export default {
    methods: {
        goBack() {
            try {
                const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
                if (pages.length > 1) {
                    uni.navigateBack({ delta: 1 });
                    return;
                }
            } catch (_) {}
            uni.switchTab({ url: '/pages/profile/profile' });
        },
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
    display: flex;
    align-items: center;
    min-height: 80rpx;
    margin-bottom: 20rpx;
}

.admin-back-btn {
    width: 72rpx;
    height: 72rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 12rpx;
}

.admin-back-icon {
    width: 22rpx;
    height: 38rpx;
}

.admin-title {
    font-size: 40rpx;
    font-weight: bold;
    color: #333;
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
