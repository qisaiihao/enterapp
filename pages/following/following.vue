<template>
    ﻿
    <view class="container">
        <view v-if="isLoading && followings.length === 0" class="loading">
            <text>加载中...</text>
        </view>

        <block v-else-if="followings.length > 0">
            <view class="list">
                <view class="following-item" v-for="(item, index) in followings" :key="index">
                    <view class="user-info" :data-openid="item._openid" @tap="openUserProfile">
                        <image class="avatar" :src="item.avatarUrl || defaultAvatar" mode="aspectFill" @error="onAvatarError" :data-index="index"></image>
                        <view class="info-text">
                            <text class="name">{{ item.nickName || '微信用户' }}</text>
                            <text class="bio">{{ item.bio || '这个用户还没有留下简介~' }}</text>
                        </view>
                    </view>

                    <button
                        class="unfollow-btn"
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

        <view v-if="followings.length > 0" class="footer-hint">
            <view v-if="isLoading" class="loading-more">加载中...</view>
            <view v-else-if="!hasMore" class="loading-more">已经到底了</view>
        </view>
    </view>
</template>

<script>
export default {
    data() {
        return {
            followings: [],
            isLoading: false,
            hasMore: true,
            page: 0,
            PAGE_SIZE: 20,
            pendingOpenid: null,
            defaultAvatar: '/static/images/avatar.png',
            total: '',
            avatarKey: ''
        };
    },
    onLoad() {
        this.loadFollowings(true);
    },
    onPullDownRefresh() {
        this.loadFollowings(true);
    },
    onReachBottom() {
        if (!this.hasMore || this.isLoading) {
            return;
        }
        this.loadFollowings();
    },
    methods: {
        // 兼容性云函数调用方法
        callCloudFunction(name, data = {}) {
            console.log(`🔍 [关注页] 调用云函数: ${name}`, data);
            
            return new Promise((resolve, reject) => {
                // 使用新的平台检测工具
                const { getCurrentPlatform, getCloudFunctionMethod } = require('../../utils/platformDetector.js');
                
                const platform = getCurrentPlatform();
                const method = getCloudFunctionMethod();
                
                console.log(`🔍 [关注页] 运行环境检测 - 平台: ${platform}, 方法: ${method}`);
                
                if (method === 'tcb') {
                    // 使用TCB调用云函数（H5和App环境）
                    if (this.$tcb && this.$tcb.callFunction) {
                        console.log(`🔍 [关注页] TCB环境调用云函数: ${name}`);
                        this.$tcb.callFunction({
                            name: name,
                            data: data
                        }).then(resolve).catch(reject);
                    } else {
                        console.error(`❌ [关注页] TCB实例不可用`);
                        reject(new Error('TCB实例不可用'));
                    }
                } else if (method === 'wx-cloud') {
                    // 使用微信云开发调用云函数（小程序环境）
                    if (wx.cloud && wx.cloud.callFunction) {
                        console.log(`🔍 [关注页] 小程序环境调用云函数: ${name}`);
                        wx.cloud.callFunction({
                            name: name,
                            data: data,
                            success: (res) => {
                                console.log(`✅ [关注页] 云函数调用成功: ${name}`, res);
                                resolve(res);
                            },
                            fail: (err) => {
                                console.error(`❌ [关注页] 云函数调用失败: ${name}`, err);
                                reject(err);
                            }
                        });
                    } else {
                        console.error(`❌ [关注页] 微信云开发不可用`);
                        reject(new Error('微信云开发不可用'));
                    }
                } else {
                    console.error(`❌ [关注页] 不支持的云函数调用方式: ${method}`);
                    reject(new Error(`不支持的云函数调用方式: ${method}`));
                }
            });
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
        }
    }
};
</script>
<style>
.container {
    padding: 32rpx;
    background-color: #f7f8fa;
    min-height: 100vh;
}

.list {
    display: flex;
    flex-direction: column;
    gap: 24rpx;
}

.following-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background-color: #ffffff;
    border-radius: 16rpx;
    padding: 24rpx 28rpx;
    box-shadow: 0 6rpx 18rpx rgba(0, 0, 0, 0.05);
}

.user-info {
    display: flex;
    align-items: center;
    flex: 1;
    overflow: hidden;
}

.avatar {
    width: 88rpx;
    height: 88rpx;
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
    color: #333333;
    font-weight: 600;
}

.bio {
    font-size: 24rpx;
    color: #888888;
    line-height: 1.4;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 420rpx;
}

.unfollow-btn {
    margin-left: 24rpx;
    border: 2rpx solid #ff8f8f;
    color: #ff6b6b;
    background-color: #ffffff;
    border-radius: 999rpx;
    padding: 0 28rpx;
    height: 64rpx !important;
    line-height: 64rpx !important;
}

.unfollow-btn::after {
    border: none;
}

.unfollow-btn[disabled] {
    opacity: 0.6;
}

.loading,
.loading-more {
    margin-top: 32rpx;
    text-align: center;
    color: #999999;
    font-size: 26rpx;
}

.empty {
    margin-top: 120rpx;
    text-align: center;
    color: #999999;
    font-size: 28rpx;
}

.footer-hint {
    margin-top: 24rpx;
}

.mutual-label {
    margin-top: 8rpx;
    display: inline-block;
    padding: 4rpx 16rpx;
    background-color: #e6f4ff;
    color: #1f6fd2;
    border-radius: 999rpx;
    font-size: 24rpx;
}
</style>
