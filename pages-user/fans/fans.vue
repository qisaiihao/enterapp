<template>
    <view class="fans-page" :data-app-theme="appThemeMode" :style="appThemeVars">
        <view class="container app-readable-column">
            <!-- 分段控制器 -->
            <view class="segmented-control">
                <!-- 自定义返回按钮 -->
                <view class="custom-back-btn" @tap="goBack">
                    <image class="back-icon" src="/static/images/left_exit.png" mode="aspectFit"></image>
                </view>
                <view class="segment-item" 
                      :class="{ active: currentTab === 'following' }" 
                      @tap="switchTab('following')">
                    <text class="segment-text">关注</text>
                </view>
                <view class="segment-item" 
                      :class="{ active: currentTab === 'followers' }" 
                      @tap="switchTab('followers')">
                    <text class="segment-text">被关注</text>
                </view>
            </view>

        <!-- 关注列表 -->
        <relation-user-list
            v-if="currentTab === 'following'"
            :users="displayFollowings"
            :load-state="currentListState.status"
            :pending-openid="pendingOpenid"
            :default-avatar="defaultAvatar"
            empty-text="还没有关注任何人，去广场看看吧～"
            action-text="取消关注"
            action-class="unfollow-btn"
            @user-tap="openUserProfile"
            @action-tap="onToggleFollow"
            @avatar-error="onAvatarError"
            @retry="retryFollowList"
        />

        <!-- 粉丝列表 -->
        <relation-user-list
            v-if="currentTab === 'followers'"
            :users="displayFollowers"
            :load-state="currentListState.status"
            :pending-openid="pendingOpenid"
            :default-avatar="defaultAvatar"
            default-bio="这个人很懒，什么都没留下~"
            empty-text="还没有粉丝，快去多发点内容吧~"
            @user-tap="openUserProfile"
            @action-tap="onToggleFollow"
            @avatar-error="onAvatarError"
            @retry="retryFollowList"
        />

            <!-- 底部提示 -->
            <view v-if="getCurrentList().length > 0" class="footer-hint">
                <view v-if="currentListState.status !== 'loading' && !currentListState.hasMore" class="loading-more">已经到底啦</view>
            </view>
        </view>
    </view>
    <app-overlay-host />
</template>

<script>
import RelationUserList from '@/components/relation/user-list.vue';
import followListMixin from '../../mixins/follow-list.js';
import { formatRelativeTime } from '../../utils/time.js';
import {
    toggleFollowRelation,
    checkFollowRelation,
    markFollowNotificationsRead
} from '../../api-cache/relation.js';

export default {
    mixins: [followListMixin],
    components: {
        RelationUserList
    },
    data() {
        return {
            currentTab: 'followers', // 默认显示被关注页面
            pendingOpenid: null,
            defaultAvatar: '/images/avatar.png'
        };
    },
    computed: {
        displayFollowings() {
            return (this.followings || []).map((item) => ({
                _openid: item && item._openid ? item._openid : '',
                nickName: item && item.nickName ? item.nickName : '',
                avatarUrl: item && item.avatarUrl ? item.avatarUrl : '',
                bio: item && item.bio ? item.bio : '',
                _resolvedActionText: '取消关注',
                _resolvedActionClass: 'unfollow-btn'
            }));
        },
        displayFollowers() {
            return (this.followers || []).map((item) => ({
                _openid: item && item._openid ? item._openid : '',
                nickName: item && item.nickName ? item.nickName : '',
                avatarUrl: item && item.avatarUrl ? item.avatarUrl : '',
                bio: item && item.bio ? item.bio : '',
                _resolvedActionText: item && item.isMutual ? '\u4e92\u76f8\u5173\u6ce8' : '\u56de\u5173',
                _resolvedActionClass: item && item.isMutual ? 'unfollow-btn' : 'follow-btn'
            }));
        }
    },
    methods: {
        // 统一时间格式化
        formatTime: undefined,
        markFollowNotificationsRead() {
            markFollowNotificationsRead({
                context: this
            }).catch((err) => {
                console.error('标记关注消息已读失败:', err);
            });
        },

        async onToggleFollow(payload) {
            const openid = payload && payload.openid;
            const index = payload && payload.index;
            if (!openid || index === undefined || this.pendingOpenid) {
                return;
            }
            const listKey = this.currentTab === 'following' ? 'followings' : 'followers';
            this.setData({
                pendingOpenid: openid
            });
            try {
                const { isFollowing } = await toggleFollowRelation({
                    targetOpenid: openid,
                    context: this,
                    pageTag: 'fans:toggle-follow'
                });
                this.setData({
                    [`${listKey}[${index}].isMutual`]: isFollowing
                });
                uni.showToast({
                    title: isFollowing ? '关注成功' : '已取消关注',
                    icon: 'success'
                });
                this.refreshUserStatus(openid, index, listKey);
            } catch (err) {
                console.error('操作关注状态失败:', err);
                uni.showToast({
                    title: err.message || '操作失败',
                    icon: 'none'
                });
            } finally {
                this.setData({
                    pendingOpenid: null
                });
            }
        },

        refreshUserStatus(openid, index, listKey) {
            checkFollowRelation({
                targetOpenid: openid,
                context: this,
                pageTag: 'fans:check-follow'
            }).then((result) => {
                this.setData({
                    [`${listKey}[${index}].isMutual`]: !!result.isMutual
                });
            }).catch((err) => {
                    console.error('刷新用户状态失败:', err);
            });
        },

        onAvatarError(payload) {
            const index = payload && payload.index;
            if (index === undefined) {
                return;
            }
            const listKey = this.currentTab === 'following' ? 'followings' : 'followers';
            this.setData({
                [`${listKey}[${index}].avatarUrl`]: this.defaultAvatar
            });
        },

        openUserProfile(payload) {
            const openid = payload && payload.openid;
            if (!openid) {
                return;
            }
            uni.navigateTo({
                url: `/pages-user/user-profile/user-profile?userId=${openid}`
            });
        },

        // 获取按钮文字
        getButtonText(item) {
            if (item.isMutual) {
                return '互相关注';
            } else {
                return '回关';
            }
        },
        getButtonClass(item) {
            return item && item.isMutual ? 'unfollow-btn' : 'follow-btn';
        },

        // 获取当前列表
        getCurrentList() {
            return this.currentTab === 'following' ? this.followings : this.followers;
        },

        formatTime(time) {
            return formatRelativeTime(time);
        },

        // 返回上一页
        goBack() {
            const pages = getCurrentPages();
            if (pages.length > 1) {
                uni.navigateBack({
                    delta: 1,
                    fail: () => {
                        uni.switchTab({
                            url: '/pages/index/index'
                        });
                    }
                });
            } else {
                uni.switchTab({
                    url: '/pages/index/index'
                });
            }
        }
    }
};
</script>
<style>
/* 自定义返回按钮 */
.custom-back-btn {
    position: absolute;
    top: 50%;
    left: 20rpx;
    transform: translateY(-50%);
    width: 80rpx;
    height: 80rpx;
    z-index: 999;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border-radius: 0;
    box-shadow: none;
}

.custom-back-btn:active {
    transform: translateY(-50%) scale(0.9);
}

.custom-back-btn .back-icon {
    width: 22rpx;
    height: 38rpx;
    display: block;
    object-fit: contain;
    filter: var(--app-icon-filter, none);
}

.fans-page {
    background-color: var(--app-page-bg, #fff);
    min-height: 100vh;
}

.container {
    background-color: var(--app-page-bg, #fff);
    color: var(--app-primary-text, #111111);
    min-height: 100vh;
    padding-top: calc(40rpx + var(--app-safe-area-top, env(safe-area-inset-top, 0px)));
    padding-bottom: calc(32rpx + var(--app-safe-area-bottom, 0px));
    box-sizing: border-box;
}

/* 分段控制器 */
.segmented-control {
    position: relative;
    display: flex;
    background-color: var(--app-fixed-bar-bg, #fff);
    border-bottom: 1rpx solid var(--app-border-color, #f0f0f0);
    padding: 0 40rpx;
}

.segment-item {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 30rpx 0;
    position: relative;
}

.segment-item.active .segment-text {
    color: var(--app-primary-text, #333);
    font-weight: 600;
}

.segment-item:not(.active) .segment-text {
    color: var(--app-muted-text, #999);
    font-weight: 400;
}

.segment-text {
    font-size: 32rpx;
    transition: all 0.3s ease;
}

/* 用户列表 */
.list {
    display: flex;
    flex-direction: column;
}

.user-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 25rpx 30rpx;
    border-bottom: 1rpx solid var(--app-border-color, #f0f0f0);
}

.user-info {
    display: flex;
    align-items: center;
    flex: 1;
    overflow: hidden;
}

.avatar {
    width: 80rpx;
    height: 80rpx;
    border-radius: 50%;
    margin-right: 20rpx;
    background-color: var(--app-subtle-surface-bg, #f0f0f0);
}

.info-text {
    display: flex;
    flex-direction: column;
    gap: 8rpx;
    overflow: hidden;
}

.name {
    font-size: 30rpx;
    color: var(--app-primary-text, #333);
    font-weight: 600;
}

.bio {
    font-size: 26rpx;
    color: var(--app-muted-text, #999);
    line-height: 1.4;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 400rpx;
}

/* 按钮样式 */
.action-btn {
    margin-left: 20rpx;
    border: none;
    border-radius: 10rpx;
    padding: 0 24rpx;
    height: 60rpx !important;
    line-height: 60rpx !important;
    font-size: 26rpx;
    transition: all 0.3s ease;
}

.action-btn::after {
    border: none;
}

.action-btn[disabled] {
    opacity: 0.6;
}

.follow-btn {
    background-color: var(--app-subtle-surface-bg, #D9D9D9);
    color: #fff;
}

.unfollow-btn {
    background-color: var(--app-subtle-surface-bg, #D9D9D9);
    color: #fff;
}

/* 空状态 */
.empty {
    margin-top: 200rpx;
    text-align: center;
    color: var(--app-muted-text, #999);
    font-size: 28rpx;
}

/* 底部提示 */
.footer-hint {
    margin-top: 40rpx;
    padding: 0 30rpx;
}

.loading-more {
    text-align: center;
    color: var(--app-muted-text, #999);
    font-size: 26rpx;
    padding: 20rpx 0;
}
</style>
