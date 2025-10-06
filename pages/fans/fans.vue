<template>
    ﻿
    <view class="container">
        <view v-if="isLoading && fans.length === 0" class="loading">
            <text>加载中...</text>
        </view>

        <block v-else-if="fans.length > 0">
            <view class="list">
                <view class="fan-item" v-for="(item, index) in fans" :key="index">
                    <view class="user-info" :data-openid="item._openid" @tap="openUserProfile">
                        <image class="avatar" :src="item.avatarUrl || defaultAvatar" mode="aspectFill" @error="onAvatarError" :data-index="index"></image>
                        <view class="info-text">
                            <text class="name">{{ item.nickName || '微信用户' }}</text>
                            <text class="bio">{{ item.bio || '这个人很懒，什么都没留下~' }}</text>
                            <text v-if="item.followedAtText" class="follow-time">关注于 {{ item.followedAtText }}</text>
                            <view v-if="item.isMutual" class="mutual-label">互相关注</view>
                        </view>
                    </view>

                    <button
                        class="follow-btn"
                        size="mini"
                        @tap.stop.prevent="onToggleFollow"
                        :data-openid="item._openid"
                        :data-index="index"
                        :loading="pendingOpenid === item._openid"
                        :disabled="pendingOpenid === item._openid"
                    >
                        {{ item.isMutual ? '取消关注' : '关注' }}
                    </button>
                </view>
            </view>
        </block>

        <view v-else class="empty">
            <text>还没有粉丝，快去多发点内容吧~</text>
        </view>

        <view v-if="fans.length > 0" class="footer-hint">
            <view v-if="isLoading" class="loading-more">加载中...</view>
            <view v-else-if="!hasMore" class="loading-more">已经到底啦</view>
        </view>
    </view>
</template>

<script>
export default {
    data() {
        return {
            fans: [],
            isLoading: false,
            hasMore: true,
            page: 0,
            PAGE_SIZE: 20,
            pendingOpenid: null,
            defaultAvatar: '/static/images/avatar.png',
            total: ''
        };
    },
    onLoad() {
        this.markFollowNotificationsRead();
        this.loadFans(true);
    },
    onPullDownRefresh() {
        this.loadFans(true);
    },
    onReachBottom() {
        if (!this.hasMore || this.isLoading) {
            return;
        }
        this.loadFans();
    },
    methods: {
        // 兼容性云函数调用方法
        callCloudFunction(name, data = {}) {
            console.log(`🔍 [粉丝页] 调用云函数: ${name}`, data);
            
            return new Promise((resolve, reject) => {
                // 使用新的平台检测工具
                const { getCurrentPlatform, getCloudFunctionMethod } = require('../../utils/platformDetector.js');
                
                const platform = getCurrentPlatform();
                const method = getCloudFunctionMethod();
                
                console.log(`🔍 [粉丝页] 运行环境检测 - 平台: ${platform}, 方法: ${method}`);
                
                if (method === 'tcb') {
                    // 使用TCB调用云函数（H5和App环境）
                    if (this.$tcb && this.$tcb.callFunction) {
                        console.log(`🔍 [粉丝页] TCB环境调用云函数: ${name}`);
                        this.$tcb.callFunction({
                            name: name,
                            data: data
                        }).then(resolve).catch(reject);
                    } else {
                        console.error(`❌ [粉丝页] TCB实例不可用`);
                        reject(new Error('TCB实例不可用'));
                    }
                } else if (method === 'wx-cloud') {
                    // 使用微信云开发调用云函数（小程序环境）
                    if (wx.cloud && wx.cloud.callFunction) {
                        console.log(`🔍 [粉丝页] 小程序环境调用云函数: ${name}`);
                        wx.cloud.callFunction({
                            name: name,
                            data: data,
                            success: (res) => {
                                console.log(`✅ [粉丝页] 云函数调用成功: ${name}`, res);
                                resolve(res);
                            },
                            fail: (err) => {
                                console.error(`❌ [粉丝页] 云函数调用失败: ${name}`, err);
                                reject(err);
                            }
                        });
                    } else {
                        console.error(`❌ [粉丝页] 微信云开发不可用`);
                        reject(new Error('微信云开发不可用'));
                    }
                } else {
                    console.error(`❌ [粉丝页] 不支持的云函数调用方式: ${method}`);
                    reject(new Error(`不支持的云函数调用方式: ${method}`));
                }
            });
        },
        loadFans(reset = false) {
            if (this.isLoading) {
                return;
            }
            if (reset) {
                this.setData({
                    page: 0,
                    hasMore: true
                });
                this.markFollowNotificationsRead();
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
                        const formatted = list.map((item) => ({
                            ...item,
                            followedAtText: item.followedAt ? this.formatTime(item.followedAt) : ''
                        }));
                        const newList = reset ? formatted : this.fans.concat(formatted);
                        this.setData({
                            fans: newList,
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

        markFollowNotificationsRead() {
            this.callCloudFunction('follow', {
                action: 'markFollowNotificationsRead'
            }).catch((err) => {
                console.error('标记关注消息已读失败:', err);
            });
        },

        onToggleFollow(e) {
            const openid = e.currentTarget.dataset.openid;
            const index = e.currentTarget.dataset.index;
            if (!openid || index === undefined || this.pendingOpenid) {
                return;
            }
            this.setData({
                pendingOpenid: openid
            });
            this.callCloudFunction('follow', {
                    action: 'toggleFollow',
                    targetOpenid: openid
                }).then((res) => {
                    if (res.result && res.result.success) {
                        const isFollowing = !!res.result.isFollowing;
                        this.setData({
                            [`fans[${index}].isMutual`]: isFollowing
                        });
                        uni.showToast({
                            title: isFollowing ? '关注成功' : '已取消关注',
                            icon: 'success'
                        });
                        this.refreshFanStatus(openid, index);
                    } else {
                        uni.showToast({
                            title: res.result && res.result.message ? res.result.message : '操作失败',
                            icon: 'none'
                        });
                    }
                }).catch((err) => {
                    console.error('操作粉丝关注状态失败:', err);
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

        refreshFanStatus(openid, index) {
            this.callCloudFunction('follow', {
                    action: 'checkFollow',
                    targetOpenid: openid
                }).then((res) => {
                    if (res.result && res.result.success) {
                        this.setData({
                            [`fans[${index}].isMutual`]: !!res.result.isMutual
                        });
                    }
                }).catch((err) => {
                    console.error('刷新粉丝状态失败:', err);
                });
        },

        onAvatarError(e) {
            const index = e.currentTarget.dataset.index;
            if (index === undefined) {
                return;
            }
            this.setData({
                [`fans[${index}].avatarUrl`]: this.defaultAvatar
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

        formatTime(time) {
            try {
                const date = new Date(time);
                if (Number.isNaN(date.getTime())) {
                    return '';
                }
                const diff = Date.now() - date.getTime();
                const minute = 60000;
                const hour = 60 * minute;
                const day = 24 * hour;
                if (diff < minute) {
                    return '刚刚';
                }
                if (diff < hour) {
                    return `${Math.floor(diff / minute)}分钟前`;
                }
                if (diff < day) {
                    return `${Math.floor(diff / hour)}小时前`;
                }
                if (diff < day * 7) {
                    return `${Math.floor(diff / day)}天前`;
                }
                const month = `${date.getMonth() + 1}`.padStart(2, '0');
                const dayText = `${date.getDate()}`.padStart(2, '0');
                return `${date.getFullYear()}-${month}-${dayText}`;
            } catch (error) {
                console.log('CatchClause', error);
                console.log('CatchClause', error);
                console.error('格式化时间失败:', error);
                return '';
            }
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

.fan-item {
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
    gap: 20rpx;
    overflow: hidden;
}

.avatar {
    width: 88rpx;
    height: 88rpx;
    border-radius: 50%;
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

.follow-time {
    font-size: 22rpx;
    color: #b0b0b0;
}

.mutual-label {
    display: inline-block;
    margin-top: 4rpx;
    padding: 4rpx 16rpx;
    border-radius: 999rpx;
    font-size: 24rpx;
    background-color: #e6f4ff;
    color: #1f6fd2;
}

.follow-btn {
    margin-left: 24rpx;
    border: none;
    background-color: #9ed7ee;
    color: #ffffff;
    border-radius: 999rpx;
    padding: 0 28rpx;
    height: 64rpx !important;
    line-height: 64rpx !important;
}

.follow-btn.following {
    background-color: #f0f0f0;
    color: #666666;
}

.follow-btn::after {
    border: none;
}

.follow-btn[disabled] {
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
</style>
