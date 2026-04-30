<template>
    <view>
        <!-- 自定义返回按钮 -->
        <view class="custom-back-btn" @tap="goBack">
            <image class="back-icon" src="/static/images/left_exit.png" mode="aspectFit"></image>
        </view>
        
        <view class="container">
            <!-- 分段控制器 -->
            <view class="segmented-control">
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
            :pending-openid="pendingOpenid"
            :default-avatar="defaultAvatar"
            empty-text="还没有关注任何人，去广场看看吧～"
            action-text="取消关注"
            action-class="unfollow-btn"
            @user-tap="openUserProfile"
            @action-tap="onToggleFollow"
            @avatar-error="onAvatarError"
        />

        <!-- 粉丝列表 -->
        <relation-user-list
            v-if="currentTab === 'followers'"
            :users="displayFollowers"
            :pending-openid="pendingOpenid"
            :default-avatar="defaultAvatar"
            default-bio="这个人很懒，什么都没留下~"
            empty-text="还没有粉丝，快去多发点内容吧~"
            @user-tap="openUserProfile"
            @action-tap="onToggleFollow"
            @avatar-error="onAvatarError"
        />

            <!-- 底部提示 -->
            <view v-if="getCurrentList().length > 0" class="footer-hint">
                <view v-if="!hasMore" class="loading-more">已经到底了</view>
            </view>
        </view>
    </view>
</template>

<script>
import RelationUserList from '@/components/relation/user-list.vue';
import {
    getFollowingList,
    getFollowerList,
    toggleFollowRelation
} from '../../api-cache/relation.js';

export default {
    components: {
        RelationUserList
    },
    data() {
        return {
            currentTab: 'following', // 当前选中的标签页
            followings: [],
            followers: [],
            isLoading: false,
            hasMore: true,
            page: 0,
            PAGE_SIZE: 20,
            pendingOpenid: null,
            defaultAvatar: '/images/avatar.png',
            total: ''
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
    onLoad() {
        this.loadFollowings(true);
    },
    onPullDownRefresh() {
        if (this.currentTab === 'following') {
            this.loadFollowings(true);
        } else {
            this.loadFollowers(true);
        }
    },
    onReachBottom() {
        if (!this.hasMore || this.isLoading) {
            return;
        }
        if (this.currentTab === 'following') {
            this.loadFollowings();
        } else {
            this.loadFollowers();
        }
    },
    methods: {
        async loadFollowings(reset = false) {
            if (this.isLoading) {
                return;
            }
            if (reset) {
                this.setData({
                    page: 0,
                    hasMore: true
                });
            }
            const page = reset ? 0 : this.page;
            this.setData({
                isLoading: true
            });
            try {
                const result = await getFollowingList({
                    page,
                    pageSize: this.PAGE_SIZE,
                    context: this
                });
                const list = result.list || [];
                const newList = reset ? list : this.followings.concat(list);
                this.setData({
                    followings: newList,
                    page: page + 1,
                    hasMore: !!result.hasMore,
                    total: result.total || newList.length
                });
            } catch (err) {
                console.error('获取关注列表失败:', err);
                uni.showToast({
                    title: err.message || '加载失败',
                    icon: 'none'
                });
            } finally {
                this.setData({
                    isLoading: false
                });
                if (reset) {
                    uni.stopPullDownRefresh();
                }
            }
        },

        async onToggleFollow(payload) {
            const openid = payload && payload.openid;
            const index = payload && payload.index;
            if (!openid || this.pendingOpenid) {
                return;
            }
            this.setData({
                pendingOpenid: openid
            });
            try {
                const { isFollowing } = await toggleFollowRelation({
                    targetOpenid: openid,
                    context: this,
                    pageTag: 'following:toggle-follow'
                });
                if (this.currentTab === 'following') {
                    if (!isFollowing) {
                        const list = this.followings.filter((item, idx) => idx !== index);
                        this.setData({
                            followings: list
                        });
                        uni.showToast({
                            title: '已取消关注',
                            icon: 'success'
                        });
                        if (this.hasMore && list.length < this.PAGE_SIZE) {
                            this.loadFollowings();
                        }
                        if (list.length === 0 && !this.hasMore) {
                            this.setData({
                                page: 0
                            });
                        }
                    } else {
                        uni.showToast({
                            title: '已关注',
                            icon: 'success'
                        });
                    }
                } else {
                    const listKey = 'followers';
                    this.setData({
                        [`${listKey}[${index}].isMutual`]: isFollowing
                    });
                    uni.showToast({
                        title: isFollowing ? '关注成功' : '已取消关注',
                        icon: 'success'
                    });
                }
            } catch (err) {
                console.error('取消关注失败:', err);
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

        onAvatarError(payload) {
            const index = payload && payload.index;
            if (index === undefined) {
                return;
            }
            const listKey = this.currentTab === 'following' ? 'followings' : 'followers';
            const avatarKey = `${listKey}[${index}].avatarUrl`;
            this.setData({
                [avatarKey]: this.defaultAvatar
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

        // 切换标签页
        switchTab(tab) {
            if (this.currentTab === tab) {
                return;
            }
            this.setData({
                currentTab: tab,
                page: 0,
                hasMore: true
            });
            
            if (tab === 'following') {
                this.loadFollowings(true);
            } else {
                this.loadFollowers(true);
            }
        },

        // 加载粉丝列表
        async loadFollowers(reset = false) {
            if (this.isLoading) {
                return;
            }
            if (reset) {
                this.setData({
                    page: 0,
                    hasMore: true
                });
            }
            const page = reset ? 0 : this.page;
            this.setData({
                isLoading: true
            });
            try {
                const result = await getFollowerList({
                    page,
                    pageSize: this.PAGE_SIZE,
                    context: this
                });
                const list = result.list || [];
                const newList = reset ? list : this.followers.concat(list);
                this.setData({
                    followers: newList,
                    page: page + 1,
                    hasMore: !!result.hasMore,
                    total: result.total || newList.length
                });
            } catch (err) {
                console.error('获取粉丝列表失败:', err);
                uni.showToast({
                    title: err.message || '加载失败',
                    icon: 'none'
                });
            } finally {
                this.setData({
                    isLoading: false
                });
                if (reset) {
                    uni.stopPullDownRefresh();
                }
            }
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
    top: calc(90rpx + env(safe-area-inset-top, var(--safe-area-inset-top, 0px)));
    left: 40rpx;
    width: 100rpx;
    height: 100rpx;
    z-index: 999;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--app-elevated-bg, rgba(255, 255, 255, 0.9));
    border-radius: 50%;
    box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.1);
    transition: all 0.3s ease;
}

.custom-back-btn:active {
    transform: scale(0.95);
}

.custom-back-btn .back-icon {
    width: 22rpx;
    height: 38rpx;
    display: block;
    object-fit: contain;
    filter: var(--app-icon-filter, none);
}

.container {
    background-color: var(--app-page-bg, #fff);
    color: var(--app-primary-text, #111111);
    min-height: 100vh;
    padding-top: calc(120rpx + env(safe-area-inset-top, var(--safe-area-inset-top, 0px)));
}

/* 分段控制器 */
.segmented-control {
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
    padding: 40rpx 30rpx;
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
    border-radius: 8rpx;
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
    background-color: var(--app-subtle-surface-bg, #f5f5f5);
    color: var(--app-primary-text, #333);
}

.unfollow-btn {
    background-color: var(--app-subtle-surface-bg, #f5f5f5);
    color: var(--app-primary-text, #333);
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
