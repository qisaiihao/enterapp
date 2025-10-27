<template>
    <view>
        <!-- 自定义返回按钮 -->
        <view class="custom-back-btn" @tap="goBack">
            <image class="back-icon" src="/static/images/back_to_edit.png" mode="aspectFit"></image>
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
        <view v-if="currentTab === 'following'">
            <block v-if="followings.length > 0">
                <view class="list">
                    <view class="user-item" v-for="(item, index) in followings" :key="index">
                        <view class="user-info" :data-openid="item._openid" @tap="openUserProfile">
                            <image class="avatar" :src="item.avatarUrl || defaultAvatar" mode="aspectFill" @error="onAvatarError" :data-index="index"></image>
                            <view class="info-text">
                                <text class="name">{{ item.nickName || '微信用户' }}</text>
                                <text class="bio">{{ item.bio || '这个用户还没有留下简介~' }}</text>
                            </view>
                        </view>
                        <button
                            class="action-btn unfollow-btn"
                            size="mini"
                            @tap.stop.prevent="onToggleFollow"
                            :data-openid="item._openid"
                            :data-index="index"
                            :loading="pendingOpenid === item._openid"
                            :disabled="pendingOpenid === item._openid"
                        >
                            取消关注
                        </button>
                    </view>
                </view>
            </block>
            <view v-else class="empty">
                <text>还没有关注任何人，去广场看看吧～</text>
            </view>
        </view>

        <!-- 粉丝列表 -->
        <view v-if="currentTab === 'followers'">
            <block v-if="followers.length > 0">
                <view class="list">
                    <view class="user-item" v-for="(item, index) in followers" :key="index">
                        <view class="user-info" :data-openid="item._openid" @tap="openUserProfile">
                            <image class="avatar" :src="item.avatarUrl || defaultAvatar" mode="aspectFill" @error="onAvatarError" :data-index="index"></image>
                            <view class="info-text">
                                <text class="name">{{ item.nickName || '微信用户' }}</text>
                                <text class="bio">{{ item.bio || '这个人很懒，什么都没留下~' }}</text>
                            </view>
                        </view>
                        <button
                            class="action-btn"
                            :class="item.isMutual ? 'unfollow-btn' : 'follow-btn'"
                            size="mini"
                            @tap.stop.prevent="onToggleFollow"
                            :data-openid="item._openid"
                            :data-index="index"
                            :loading="pendingOpenid === item._openid"
                            :disabled="pendingOpenid === item._openid"
                        >
                            {{ getButtonText(item) }}
                        </button>
                    </view>
                </view>
            </block>
            <view v-else class="empty">
                <text>还没有粉丝，快去多发点内容吧~</text>
            </view>
        </view>

            <!-- 底部提示 -->
            <view v-if="getCurrentList().length > 0" class="footer-hint">
                <view v-if="!hasMore" class="loading-more">已经到底了</view>
            </view>
        </view>
    </view>
</template>

<script>
const { cloudCall } = require('../../utils/cloudCall.js');
export default {
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
            total: '',
            avatarKey: ''
        };
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
        // 统一云函数调用方法
        callCloudFunction(name, data = {}, extraOptions = {}) {
            return cloudCall(name, data, Object.assign({ pageTag: 'following', context: this, requireAuth: true }, extraOptions));
        },
        loadFollowings(reset = false) {
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
            const openid = this.$requireOpenid && this.$requireOpenid();
            if (!openid) {
                this.setData({
                    isLoading: false
                });
                if (reset) {
                    uni.stopPullDownRefresh();
                }
                return;
            }
            this.callCloudFunction('follow', {
                    action: 'getFollowingList',
                    skip: page * this.PAGE_SIZE,
                    limit: this.PAGE_SIZE,
                    openid
                }).then((res) => {
                    if (res.result && res.result.success) {
                        const list = res.result.list || [];
                        const newList = reset ? list : this.followings.concat(list);
                        this.setData({
                            followings: newList,
                            page: page + 1,
                            hasMore: !!res.result.hasMore,
                            total: res.result.total || newList.length
                        });
                    } else {
                        uni.showToast({
                            title: res.result && res.result.message ? res.result.message : '加载失败',
                            icon: 'none'
                        });
                    }
                }).catch((err) => {
                    console.error('获取关注列表失败:', err);
                    uni.showToast({
                        title: '网络错误',
                        icon: 'none'
                    });
                }).finally(() => {
                    this.setData({
                        isLoading: false
                    });
                    if (reset) {
                        uni.stopPullDownRefresh();
                    }
                });
        },

        onToggleFollow(e) {
            const openid = e.currentTarget.dataset.openid;
            const index = e.currentTarget.dataset.index;
            if (!openid || this.pendingOpenid) {
                return;
            }
            this.setData({
                pendingOpenid: openid
            });
            const currentOpenid = this.$requireOpenid && this.$requireOpenid();
            if (!currentOpenid) {
                this.setData({
                    pendingOpenid: null
                });
                return;
            }
            this.callCloudFunction('follow', {
                    action: 'toggleFollow',
                    targetOpenid: openid,
                    openid: currentOpenid
                }).then((res) => {
                    if (res.result && res.result.success) {
                        const stillFollowing = !!res.result.isFollowing;
                        if (!stillFollowing) {
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
                        uni.showToast({
                            title: res.result && res.result.message ? res.result.message : '操作失败',
                            icon: 'none'
                        });
                    }
                }).catch((err) => {
                    console.error('取消关注失败:', err);
                    uni.showToast({
                        title: '网络错误',
                        icon: 'none'
                    });
                }).finally(() => {
                    this.setData({
                        pendingOpenid: null
                    });
                });
        },

        onAvatarError(e) {
            const index = e.currentTarget.dataset.index;
            if (index === undefined) {
                return;
            }
            const avatarKey = `followings[${index}].avatarUrl`;
            this.setData({
                [avatarKey]: this.defaultAvatar
            });
        },

        openUserProfile(e) {
            const openid = e.currentTarget.dataset.openid;
            if (!openid) {
                return;
            }
            uni.navigateTo({
                url: `/pages/user-profile/user-profile?userId=${openid}`
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
        loadFollowers(reset = false) {
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
            
            this.callCloudFunction('follow', {
                    action: 'getFollowerList',
                    skip: page * this.PAGE_SIZE,
                    limit: this.PAGE_SIZE
                }).then((res) => {
                    if (res.result && res.result.success) {
                        const list = res.result.list || [];
                        const newList = reset ? list : this.followers.concat(list);
                        this.setData({
                            followers: newList,
                            page: page + 1,
                            hasMore: !!res.result.hasMore,
                            total: res.result.total || newList.length
                        });
                    } else {
                        uni.showToast({
                            title: res.result && res.result.message ? res.result.message : '加载失败',
                            icon: 'none'
                        });
                    }
                }).catch((err) => {
                    console.error('获取粉丝列表失败:', err);
                    uni.showToast({
                        title: '网络错误',
                        icon: 'none'
                    });
                }).finally(() => {
                    this.setData({
                        isLoading: false
                    });
                    if (reset) {
                        uni.stopPullDownRefresh();
                    }
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
    top: calc(90rpx + env(safe-area-inset-top, var(--safe-area-inset-top, 44px)));
    left: 40rpx;
    width: 100rpx;
    height: 100rpx;
    z-index: 999;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.9);
    border-radius: 50%;
    box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.1);
    transition: all 0.3s ease;
}

.custom-back-btn:active {
    transform: scale(0.95);
}

.custom-back-btn .back-icon {
    width: 100rpx;
    height: 100rpx;
    display: block;
    object-fit: contain;
}

.container {
    background-color: #fff;
    min-height: 100vh;
    padding-top: calc(120rpx + env(safe-area-inset-top, var(--safe-area-inset-top, 44px)));
}

/* 分段控制器 */
.segmented-control {
    display: flex;
    background-color: #fff;
    border-bottom: 1rpx solid #f0f0f0;
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
    color: #333;
    font-weight: 600;
}

.segment-item:not(.active) .segment-text {
    color: #999;
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
    border-bottom: 1rpx solid #f0f0f0;
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
    background-color: #f0f0f0;
}

.info-text {
    display: flex;
    flex-direction: column;
    gap: 8rpx;
    overflow: hidden;
}

.name {
    font-size: 30rpx;
    color: #333;
    font-weight: 600;
}

.bio {
    font-size: 26rpx;
    color: #999;
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
    background-color: #f5f5f5;
    color: #333;
}

.unfollow-btn {
    background-color: #f5f5f5;
    color: #333;
}

/* 空状态 */
.empty {
    margin-top: 200rpx;
    text-align: center;
    color: #999;
    font-size: 28rpx;
}

/* 底部提示 */
.footer-hint {
    margin-top: 40rpx;
    padding: 0 30rpx;
}

.loading-more {
    text-align: center;
    color: #999;
    font-size: 26rpx;
    padding: 20rpx 0;
}
</style>
