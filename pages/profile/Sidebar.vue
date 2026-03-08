<template>
    <view>
        <!-- Sidebar Mask -->
        <view class="sidebar-mask" v-if="isVisible" @tap="handleMaskTap"></view>

        <!-- Sidebar -->
        <view :class="'sidebar ' + (isVisible ? 'open' : '')">
            <view class="sidebar-header">
                <image class="sidebar-avatar" :src="userInfo.avatarUrl || '/static/images/avatar.png'" mode="aspectFill" @error="onAvatarError"></image>
                <text class="sidebar-nickname">{{ userInfo.nickName || '微信用户' }}</text>
            </view>
            <view class="sidebar-menu">
                <view class="sidebar-item" @tap="navigateToMyLikes">
                    <text>我的点赞</text>
                </view>
                <view class="sidebar-item" @tap="navigateToPortfolio">
                    <text>作品集</text>
                </view>
                <view class="sidebar-item" @tap="navigateToDraftBox">
                    <text>草稿箱</text>
                </view>
                <view class="sidebar-item" @tap="navigateToFeedback">
                    <text>意见反馈</text>
                </view>
                <view class="sidebar-item" @tap="navigateToCollage">
                    <text>拼贴诗</text>
                </view>
                <view class="sidebar-item" @tap="navigateToBlockedUsers">
                    <text>黑名单</text>
                </view>
                <!-- 管理入口：仅对管理员poemId显示 -->
                <view v-if="isAdmin" class="sidebar-item" @tap="navigateToAdmin">
                    <text>管理</text>
                </view>
                <view class="sidebar-item logout-item" @tap="showLogoutConfirm">
                    <text>退出登录</text>
                </view>
            </view>
        </view>
    </view>
</template>

<script>
export default {
    name: 'Sidebar',
    props: {
        isVisible: {
            type: Boolean,
            default: false
        },
        userInfo: {
            type: Object,
            default: () => ({
                avatarUrl: '',
                nickName: '',
                poemId: ''
            })
        }
    },
    computed: {
        // 判断是否为管理员
        isAdmin() {
            const adminPoemIds = ['qisaihao', 'jingmikun'];
            return this.userInfo && adminPoemIds.includes(this.userInfo.poemId);
        }
    },
    methods: {
        // 处理遮罩点击
        handleMaskTap() {
            this.$emit('close');
        },

        // 头像加载错误处理
        onAvatarError(e) {
            this.$emit('avatar-error', e);
        },

        // 跳转到我的点赞页面
        navigateToMyLikes() {
            this.$emit('close');
            uni.navigateTo({
                url: '/pages-user/my-likes/my-likes'
            });
        },

        // 跳转到作品集页面
        navigateToPortfolio() {
            this.$emit('close');
            uni.navigateTo({
                url: '/pages-content/portfolio/portfolio'
            });
        },


        // 跳转到草稿箱页面
        navigateToDraftBox() {
            this.$emit('close');
            uni.navigateTo({
                url: '/pages-content/draft-box/draft-box'
            });
        },

        // 跳转到意见反馈页面
        navigateToFeedback() {
            this.$emit('close');
            uni.navigateTo({
                url: '/pages-tools/feedback/feedback'
            });
        },

        // 跳转到拼贴诗页面
        navigateToCollage() {
            this.$emit('close');
            uni.navigateTo({
                url: '/pages-collage/collage-main/collage-main'
            });
        },

        // 跳转到黑名单页面
        navigateToBlockedUsers() {
            this.$emit('close');
            uni.navigateTo({
                url: '/pages-user/blocked-users/blocked-users'
            });
        },

        // 跳转到管理页面
        navigateToAdmin() {
            this.$emit('close');
            uni.navigateTo({
                url: '/pages-admin/admin-menu/admin-menu'
            });
        },

        // 显示退出登录确认对话框
        showLogoutConfirm() {
            // 先关闭侧边栏，避免遮挡确认对话框
            this.$emit('close');

            // 延迟显示对话框，确保侧边栏关闭动画完成
            setTimeout(() => {
                this.$emit('logout-confirm');
            }, 100);
        }
    }
};
</script>

<style scoped>
/* 侧边栏遮罩 */
.sidebar-mask {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    z-index: 999;
}

/* 侧边栏 */
.sidebar {
    position: fixed;
    top: 0;
    left: -70%; /* Start off-screen */
    width: 70%;
    height: 100%;
    background-color: #ffffff;
    box-shadow: 2px 0 5px rgba(0, 0, 0, 0.1);
    transition: left 0.3s ease;
    z-index: 1000;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
}

.sidebar.open {
    left: 0; /* Slide in */
}

/* 侧边栏头部 */
.sidebar-header {
    padding: 40rpx 30rpx;
    border-bottom: 1rpx solid #eee;
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-top: 80rpx;
}

.sidebar-avatar {
    width: 120rpx;
    height: 120rpx;
    border-radius: 50%;
    margin-bottom: 20rpx;
}

.sidebar-nickname {
    font-size: 32rpx;
    font-weight: bold;
}

/* 侧边栏菜单 */
.sidebar-menu {
    margin-top: 40rpx;
    display: flex;
    flex-direction: column;
    height: 100%;
}

.sidebar-item {
    padding: 30rpx;
    border-bottom: 1rpx solid #f0f0f0;
    font-size: 32rpx;
    color: #333;
    position: relative;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.sidebar-item:active {
    background-color: #f5f5f5;
}

/* 退出登录项特殊样式 */
.logout-item {
    border-top: 2rpx solid #f0f0f0;
    margin-top: 20rpx;
    color: #ff6b6b !important;
    font-weight: 500;
}

.logout-item:active {
    background-color: #fff5f5 !important;
}
</style>
