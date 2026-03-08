<template>
    <view>
        <view class="container">
            <!-- 顶部导航栏 -->
            <view class="header">
                <view class="header-left" @tap="goBack">
                    <image class="back-icon-image" src="/static/images/back_to_edit.png" mode="aspectFit"></image>
                </view>
                <text class="header-title">黑名单</text>
            </view>

            <!-- 黑名单列表 -->
            <relation-user-list
                :users="blockedUsers"
                :pending-openid="pendingOpenid"
                :default-avatar="defaultAvatar"
                empty-text="黑名单为空，快去屏蔽那些讨厌的用户吧～"
                action-text="解除屏蔽"
                action-class="unblock-btn"
                @user-tap="openUserProfile"
                @action-tap="onUnblock"
                @avatar-error="onAvatarError"
            />

            <!-- 底部提示 -->
            <view v-if="blockedUsers.length > 0" class="footer-hint">
                <view v-if="!hasMore" class="loading-more">已经到底了</view>
            </view>
        </view>
    </view>
</template>

<script>
import RelationUserList from '@/components/relation/user-list.vue';
const {
    getBlockedList,
    toggleBlockRelation
} = require('../../api-cache/relation.js');
export default {
    components: {
        RelationUserList
    },
    data() {
        return {
            blockedUsers: [],
            isLoading: false,
            hasMore: true,
            page: 0,
            PAGE_SIZE: 20,
            pendingOpenid: null,
            defaultAvatar: '/images/avatar.png'
        };
    },
    onLoad() {
        this.loadBlockedUsers(true);
    },
    onPullDownRefresh() {
        this.loadBlockedUsers(true);
    },
    onReachBottom() {
        if (!this.hasMore || this.isLoading) {
            return;
        }
        this.loadBlockedUsers();
    },
    methods: {
        // 加载黑名单列表
        async loadBlockedUsers(reset = false) {
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
                const result = await getBlockedList({
                    page,
                    pageSize: this.PAGE_SIZE,
                    context: this
                });
                const list = result.list || [];
                const newList = reset ? list : this.blockedUsers.concat(list);
                this.setData({
                    blockedUsers: newList,
                    page: page + 1,
                    hasMore: !!result.hasMore
                });
            } catch (err) {
                console.error('获取黑名单列表失败:', err);
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

        // 解除屏蔽
        onUnblock(payload) {
            const openid = payload && payload.openid;
            const index = payload && payload.index;
            if (!openid || this.pendingOpenid) {
                return;
            }
            
            // 确认对话框
            uni.showModal({
                title: '确认操作',
                content: '确定要解除屏蔽该用户吗？解除后可以重新看到该用户的帖子和诗歌。',
                success: (modalRes) => {
                    if (modalRes.confirm) {
                        this.setData({
                            pendingOpenid: openid
                        });
                        toggleBlockRelation({
                            targetOpenid: openid,
                            context: this,
                            pageTag: 'blocked-users:toggle-block'
                        }).then((result) => {
                            const stillBlocked = !!result.isBlocked;
                            if (!stillBlocked) {
                                // 从列表中移除
                                const list = this.blockedUsers.filter((item, idx) => idx !== index);
                                this.setData({
                                    blockedUsers: list
                                });
                                uni.showToast({
                                    title: '已解除屏蔽',
                                    icon: 'success'
                                });
                                // 如果列表为空且还有更多数据，尝试加载
                                if (list.length === 0 && this.hasMore) {
                                    this.loadBlockedUsers();
                                }
                                // 清除相关缓存
                                try {
                                    const { invalidateHomePosts } = require('../../api-cache/home-posts.js');
                                    const { clearDiscoverCache } = require('../../api-cache/discover.js');
                                    invalidateHomePosts({});
                                    clearDiscoverCache();
                                } catch (cacheError) {
                                    console.error('清除缓存失败:', cacheError);
                                }
                            } else {
                                uni.showToast({
                                    title: '操作失败',
                                    icon: 'none'
                                });
                            }
                        }).catch((err) => {
                            console.error('解除屏蔽失败:', err);
                            uni.showToast({
                                title: err.message || '操作失败',
                                icon: 'none'
                            });
                        }).finally(() => {
                            this.setData({
                                pendingOpenid: null
                            });
                        });
                    }
                }
            });
        },

        onAvatarError(payload) {
            const index = payload && payload.index;
            if (index === undefined) {
                return;
            }
            const avatarKey = `blockedUsers[${index}].avatarUrl`;
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
.container {
    background-color: #fff;
    min-height: 100vh;
}

.header {
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    padding: 20rpx 30rpx;
    background: #fff;
    border-bottom: 1rpx solid #e9ecef;
}

.header-left {
    position: absolute;
    left: 30rpx;
    width: 60rpx;
    height: 60rpx;
    display: flex;
    align-items: center;
    justify-content: center;
}

.back-icon-image {
    width: 72rpx;
    height: 72rpx;
    margin-top: 4rpx;
}

.header-title {
    font-size: 36rpx;
    font-weight: 600;
    color: #333;
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

.unblock-btn {
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
