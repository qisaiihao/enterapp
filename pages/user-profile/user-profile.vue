<template>
    ﻿
    <!-- pages/user-profile/user-profile.wxml -->
    <view class="container">
        <!-- 加载状态 -->
        <view v-if="isLoading && userPosts.length === 0" class="loading-container">
            <view class="loading-text">加载中...</view>
        </view>

        <!-- 主要内容 -->
        <view v-else>
            <!-- 用户信息卡片 -->
            <view class="profile-card">
                <view class="profile-avatar">
                    <image :src="userInfo.avatarUrl || '/images/avatar.png'" mode="aspectFill" @error="onAvatarError"></image>
                </view>
                <view class="profile-info">
                    <text class="profile-name">{{ userInfo.nickName || '微信用户' }}</text>
                    <text class="profile-bio">{{ userInfo.bio || '这个用户很懒，什么都没留下...' }}</text>
                    <text class="profile-meta">{{ (userInfo.occupation || '未设置') + ' · ' + (userInfo.region || '未设置') }}</text>
                </view>
                <button
                    v-if="showFollowButton"
                    :class="'profile-follow-btn ' + (isFollowing ? 'following' : '')"
                    @tap="onFollowTap"
                    :loading="followPending"
                    :disabled="followPending"
                >
                    {{ isFollowing ? '已关注' : '关注' }}
                </button>
                <view v-if="isMutualFollow" class="mutual-pill">互相关注</view>
                <view v-else-if="isFollowedByTarget" class="followed-pill">TA关注了你</view>
            </view>

            <!-- 帖子列表 -->
            <!-- <view class="profile-detail-card"> -->
                <!-- <text class="detail-item-inline">职业:{{ userInfo.occupation ? userInfo.occupation : '未设置' }}</text> -->
                <!-- <text class="detail-item-inline">地区:{{ userInfo.region ? userInfo.region : '未设置' }}</text> -->
            <!-- </view> -->

            <view class="posts-section">
                <view class="section-title">TA的帖子</view>
                <block v-if="userPosts.length > 0">
                    <view class="post-card" @tap="navigateToPostDetail" :data-id="item._id" hover-class="post-item-active" v-for="(item, index) in userPosts" :key="index">
                        <view class="post-header">
                            <text class="post-title">{{ item.title }}</text>
                        </view>

                        <!-- 图片显示 -->

                        <view class="image-container" v-if="item.imageUrls && item.imageUrls.length > 0">
                            <!-- 多图轮播 -->
                            <block v-if="item.imageUrls.length > 1">
                                <swiper
                                    :id="'swiper-' + index"
                                    class="image-swiper"
                                    :indicator-dots="true"
                                    :circular="false"
                                    :autoplay="false"
                                    :style="'width: 100%; height: ' + (swiperHeights[index] ? swiperHeights[index] + 'px' : '220px') + ';'"
                                >
                                    <block v-for="(imageUrl, imgindex) in item.imageUrls" :key="imgindex">
                                <swiper-item>
                                    <image
                                        :id="'user-swiper-img-' + index + '-' + imgindex"
                                                class="post-image"
                                                :src="imageUrl"
                                                mode="aspectFill"
                                                @tap.stop.prevent="handlePreview"
                                                :data-src="imageUrl"
                                                :data-original-image-urls="item.originalImageUrls || item.imageUrls"
                                                @error="onImageError"
                                                @load="onImageLoad"
                                                :data-postindex="index"
                                                :data-imgindex="imgindex"
                                                data-type="multi"
                                                :lazy-load="true"
                                                style="width: 100%; height: 100%; object-fit: cover; background-color: #f0f0f0"
                                            ></image>
                                        </swiper-item>
                                    </block>
                                </swiper>
                            </block>

                            <!-- 单图 -->
                            <block v-else-if="item.imageUrls.length === 1">
                                <image
                                    :id="'single-image-' + index"
                                    class="post-image"
                                    :src="item.imageUrls[0]"
                                    :mode="imageClampHeights[index] ? 'aspectFill' : 'widthFix'"
                                    @tap.stop.prevent="handlePreview"
                                    :data-src="item.imageUrls[0]"
                                    :data-original-image-urls="item.originalImageUrls || item.imageUrls"
                                    @error="onImageError"
                                    @load="onImageLoad"
                                    :data-postindex="index"
                                    data-imgindex="0"
                                    data-type="single"
                                    :lazy-load="true"
                                    :style="
                                        'width: 100%; height: ' +
                                        (imageClampHeights[index] ? imageClampHeights[index] + 'px' : 'auto') +
                                        '; object-fit: ' +
                                        (imageClampHeights[index] ? 'cover' : 'contain') +
                                        '; background-color: #f0f0f0;'
                                    "
                                ></image>
                            </block>
                        </view>

                        <view class="post-content" v-if="item.content">{{ item.content }}</view>

                        <!-- 帖子信息 -->

                        <view class="post-footer">
                            <view class="post-stats">
                                <text class="stat-item">❤️ {{ item.votes || 0 }}</text>
                                <text class="stat-item">💬 {{ item.commentCount || 0 }}</text>
                            </view>
                            <view class="post-time">{{ item.formattedCreateTime }}</view>
                        </view>
                    </view>

                    <!-- 加载更多提示 -->
                    <view v-if="isLoading && userPosts.length > 0" class="loading-container">
                        <view class="loading-text">加载中...</view>
                    </view>

                    <!-- 占位空白，便于触发 onReachBottom -->
                    <view style="height: 200rpx"></view>
                </block>

                <view v-else class="empty-tip">
                    <text>TA还没有发布过帖子</text>
                </view>
            </view>
        </view>
    </view>
</template>

<script>
import { getUserInfo, getUserPosts, invalidateUserInfo, invalidateUserPosts } from '@/api-cache/user-profile.js';
const PAGE_SIZE = 5;
const { formatRelativeTime } = require('../../utils/time.js');
const avatarCache = require('../../utils/avatarCache');
const followCache = require('../../utils/followCache');
const { previewImage } = require('../../utils/imagePreview.js');
const { cloudCall } = require('../../utils/cloudCall.js');
const postGalleryMixin = require('../../mixins/postGallery.js');
export default {
    mixins: [postGalleryMixin],
    data() {
        return {
            userInfo: {
                avatarUrl: '',
                nickName: '',
                bio: ''
            },

            isLoading: false,
            userPosts: [],
            page: 0,
            hasMore: true,
            PAGE_SIZE: PAGE_SIZE,
            swiperHeights: {},
            imageClampHeights: {},

            // 目标用户ID
            targetUserId: '',

            showFollowButton: false,
            isFollowing: false,
            isFollowedByTarget: false,
            isMutualFollow: false,
            followPending: false,
            imgindex: 0,
            imageUrl: ''
        };
    },
    onLoad: function (options) {
        console.log('【用户主页】页面加载,options:', options);
        const targetUserId = options.userId;
        if (!targetUserId) {
            uni.showToast({
                title: '用户信息获取失败',
                icon: 'none'
            });
            uni.navigateBack();
            return;
        }
        this.setData({
            targetUserId
        });
        this.loadUserProfile();
        // 可选：监听全局事件以事件驱动失效与刷新（仅命中当前用户时刷新）
        try {
            uni.$on && uni.$on('avatar-updated', (e) => {
                if (e && e.userId === this.targetUserId) {
                    invalidateUserInfo(this.targetUserId);
                    this.loadUserProfile();
                }
            });
            uni.$on && uni.$on('post-created', (e) => {
                if (e && e.userId === this.targetUserId) {
                    invalidateUserPosts(this.targetUserId);
                    this.setData({ userPosts: [], page: 0, hasMore: true });
                    this.loadUserProfile();
                }
            });
            uni.$on && uni.$on('favorite-changed', (e) => {
                if (e && e.userId === this.targetUserId) {
                    invalidateUserPosts(this.targetUserId);
                    this.setData({ userPosts: [], page: 0, hasMore: true });
                    this.loadUserProfile();
                }
            });
        } catch (err) {}
    },
    onPullDownRefresh: function () {
        this.setData({
            userPosts: [],
            page: 0,
            hasMore: true,
            swiperHeights: {},
            imageClampHeights: {}
        });
        this.loadUserProfile(() => {
            uni.stopPullDownRefresh();
        });
    },
    onReachBottom: function () {
        if (!this.hasMore || this.isLoading) {
            return;
        }
        this.loadUserPosts();
    },
    methods: {
        // 统一云函数调用方法
        callCloudFunction(name, data = {}, extraOptions = {}) {
            return cloudCall(name, data, Object.assign({ pageTag: 'user-profile', context: this }, extraOptions));
        },
        // 加载用户信息和帖子
        loadUserProfile: function (cb) {
            this.setData({ isLoading: true });
            Promise.all([
                getUserInfo(this.targetUserId, this),
                getUserPosts({ userId: this.targetUserId, page: 0, pageSize: this.PAGE_SIZE, context: this })
            ]).then(([userInfo, posts]) => {
                posts.forEach((post) => { if (post.createTime) post.formattedCreateTime = this.formatTime(post.createTime); });
                this.setData({
                    userInfo,
                    userPosts: posts,
                    page: 1,
                    hasMore: posts.length === this.PAGE_SIZE
                });
                avatarCache.updateUserAvatar(this.targetUserId, userInfo);
                this.prepareFollowStateWithCache();
                uni.setNavigationBarTitle({ title: userInfo.nickName || '用户主页' });
            }).catch((err) => {
                console.error('【用户主页】缓存加载失败', err);
                uni.showToast({ title: '网络异常，请稍后重试', icon: 'none' });
            }).finally(() => {
                this.setData({ isLoading: false });
                if (typeof cb === 'function') cb();
            });
        },

        // 加载更多帖子
        loadUserPosts: function () {
            if (this.isLoading) return;
            const { page, PAGE_SIZE } = this;
            this.setData({ isLoading: true });
            getUserPosts({ userId: this.targetUserId, page, pageSize: PAGE_SIZE, context: this })
                .then((posts) => {
                    posts.forEach((post) => { if (post.createTime) post.formattedCreateTime = this.formatTime(post.createTime); });
                    const newPosts = this.userPosts.concat(posts);
                    this.setData({ userPosts: newPosts, page: page + 1, hasMore: posts.length === PAGE_SIZE });
                })
                .catch((err) => { console.error('【用户主页】加载更多帖子失败', err); })
                .finally(() => { this.setData({ isLoading: false }); });
        },

        // 准备关注状态
        prepareFollowState: function () {
            const targetUserId = this.targetUserId;
            const currentUserId = this.getCurrentUserId();
            if (!targetUserId || !currentUserId || targetUserId === currentUserId) {
                this.setData({
                    showFollowButton: false,
                    isFollowing: false,
                    isFollowedByTarget: false,
                    isMutualFollow: false
                });
                return;
            }
            this.setData({
                showFollowButton: true,
                isFollowing: false,
                isFollowedByTarget: false,
                isMutualFollow: false
            });
            this.fetchFollowStatusWithCache(targetUserId);
        },

        prepareFollowStateWithCache: function () {
            const targetUserId = this.targetUserId;
            const currentUserId = this.getCurrentUserId();
            if (!targetUserId || !currentUserId || targetUserId === currentUserId) {
                this.setData({
                    showFollowButton: false,
                    isFollowing: false,
                    isFollowedByTarget: false,
                    isMutualFollow: false
                });
                return;
            }
            this.setData({
                showFollowButton: true,
                isFollowing: false,
                isFollowedByTarget: false,
                isMutualFollow: false
            });
            this.fetchFollowStatusWithCache(targetUserId);
        },

        fetchFollowStatusWithCache: function (targetOpenid) {
            if (!targetOpenid) {
                return;
            }
            const currentUserId = this.getCurrentUserId();
            if (!currentUserId) {
                return;
            }

            // 使用缓存获取关注状态
            followCache.getFollowStatus(currentUserId, targetOpenid).then((followData) => {
                if (followData) {
                    this.setData({
                        isFollowing: followData.isFollowing,
                        isFollowedByTarget: followData.isFollowedByAuthor,
                        isMutualFollow: followData.isMutualFollow
                    });
                }
            });
        },

        fetchFollowStatus: function (targetOpenid) {
            if (!targetOpenid) {
                return;
            }
            this.callCloudFunction('follow', {
                    action: 'checkFollow',
                    targetOpenid
                }, { requireAuth: true }).then((res) => {
                    if (res.result && res.result.success) {
                        this.setData({
                            isFollowing: !!res.result.isFollowing,
                            isFollowedByTarget: !!res.result.isFollower,
                            isMutualFollow: !!res.result.isMutual
                        });
                    } else {
                        console.warn('检查关注状态失败', res.result);
                    }
                }).catch((err) => {
                    console.error('检查关注状态调用失败:', err);
                });
        },

        onFollowTap: function () {
            if (this.followPending) {
                return;
            }
            const targetOpenid = this.targetUserId;
            if (!targetOpenid) {
                return;
            }
            const currentUserId = this.getCurrentUserId();
            if (!currentUserId) {
                uni.showToast({
                    title: '请先登录',
                    icon: 'none'
                });
                return;
            }
            this.setData({
                followPending: true
            });

            // 使用缓存切换关注状态
            followCache
                .toggleFollowStatus(currentUserId, targetOpenid)
                .then((followData) => {
                    if (followData) {
                        this.setData({
                            isFollowing: followData.isFollowing,
                            isFollowedByTarget: followData.isFollowedByAuthor,
                            isMutualFollow: followData.isMutualFollow
                        });
                        uni.showToast({
                            title: followData.isFollowing ? '关注成功' : '已取消关注',
                            icon: 'success'
                        });
                    } else {
                        uni.showToast({
                            title: '操作失败',
                            icon: 'none'
                        });
                    }
                })
                .catch((err) => {
                    console.error('切换关注状态失败:', err);
                    uni.showToast({
                        title: '网络错误',
                        icon: 'none'
                    });
                })
                .finally(() => {
                    this.setData({
                        followPending: false
                    });
                });
        },

        getCurrentUserId: function () {
            return getApp().globalData.openid || uni.getStorageSync('openid') || uni.getStorageSync('userOpenId');
        },

        navigateToPostDetail: function (e) {
            const postId = e.currentTarget.dataset.id;
            uni.navigateTo({
                url: `/pages/post-detail/post-detail?id=${postId}`
            });
        },

        // 图片预览
        handlePreview: function (event) {
            return previewImage(event, { fallbackToast: false });
        },

        // 图片加载处理
        // 格式化时间
        formatTime: function (dateString) {
            return formatRelativeTime(dateString);
        },

        onImageError: function (e) {
            console.error('图片加载失败:', e.detail);
        },

        onAvatarError: function (e) {
            console.error('头像加载失败:', e.detail);
        }
    }
};
</script>
<style>
/* pages/user-profile/user-profile.wxss */
.container {
    min-height: 100vh;
    background-color: #f7f8fa;
    padding-bottom: 100rpx;
}

/* 加载状态 */
.loading-container {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 400rpx;
    background-color: #fff;
    border-radius: 16rpx;
    margin: 30rpx;
    box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.05);
}

.loading-text {
    font-size: 28rpx;
    color: #999;
}

/* 用户信息卡片 */
.profile-card {
    margin: 30rpx;
    padding: 40rpx;
    background-color: #fff;
    border-radius: 16rpx;
    box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.05);
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
}

.profile-avatar {
    margin-bottom: 20rpx;
}

.profile-avatar image {
    width: 150rpx;
    height: 150rpx;
    border-radius: 50%;
}

.profile-info {
    display: flex;
    flex-direction: column;
    align-items: center;
}

.profile-name {
    font-size: 36rpx;
    font-weight: bold;
    color: #333;
    margin-bottom: 10rpx;
}

  .profile-bio {
      font-size: 28rpx;
      color: #999;
      line-height: 1.4;
      text-align: center;
  }
  .profile-meta {
      font-size: 26rpx;
      color: #666;
      margin-top: 8rpx;
      text-align: center;
  }

/* 帖子部分 */
.posts-section {
    margin: 0 30rpx 30rpx 30rpx;
}

.section-title {
    font-size: 32rpx;
    font-weight: bold;
    color: #333;
    margin-bottom: 20rpx;
    padding: 0 10rpx;
}

.post-card {
    background: #fff;
    border-radius: 16rpx;
    box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.05);
    margin-bottom: 20rpx;
    box-sizing: border-box;
    padding: 30rpx;
    transition: transform 0.2s ease;
}

.post-card:active {
    transform: translateY(2rpx);
    box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.1);
}

.post-header {
    margin-bottom: 15rpx;
}

.post-title {
    font-size: 32rpx;
    font-weight: bold;
    color: #333;
    line-height: 1.4;
    word-break: break-word;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
}

/* 图片容器 */
.image-container {
    width: 100%;
    margin: 15rpx 0;
}

.image-swiper {
    width: 100%;
    background-color: #fff;
    border-radius: 12rpx;
    overflow: hidden;
}

.post-image {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: contain;
    border-radius: 12rpx;
}

.post-content {
    font-size: 28rpx;
    color: #666;
    line-height: 1.5;
    margin: 15rpx 0;
    word-break: break-word;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
}

.post-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 20rpx;
    padding-top: 20rpx;
    border-top: 1rpx solid #f0f0f0;
}

.post-stats {
    display: flex;
    align-items: center;
    gap: 20rpx;
}

.stat-item {
    font-size: 26rpx;
    color: #999;
}

.post-time {
    font-size: 24rpx;
    color: #ccc;
}

.empty-tip {
    text-align: center;
    color: #bbb;
    font-size: 28rpx;
    margin: 40rpx 0;
    padding: 60rpx 0;
    background-color: #fff;
    border-radius: 16rpx;
    box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.05);
}

.profile-follow-btn {
    margin-top: 24rpx;
    padding: 0 48rpx;
    height: 64rpx;
    line-height: 64rpx;
    background-color: #9ed7ee;
    color: #ffffff;
    border: none;
    border-radius: 999rpx;
    font-size: 28rpx;
}

.profile-follow-btn.following {
    background-color: #f0f0f0;
    color: #666666;
}

.profile-follow-btn::after {
    border: none;
}

.profile-follow-btn[disabled] {
    opacity: 0.7;
}

.mutual-pill,
.followed-pill {
    margin-top: 16rpx;
    padding: 6rpx 24rpx;
    border-radius: 999rpx;
    font-size: 26rpx;
    display: inline-block;
}

.mutual-pill {
    background-color: #e6f4ff;
    color: #1f6fd2;
}

.followed-pill {
    background-color: #f4ebff;
    color: #7c55c7;
}

/* 资料详情（与我的主页风格一致） */
.profile-detail-card {
    margin: 0 30rpx 20rpx 30rpx;
    padding: 20rpx 24rpx;
    background: #fff;
    border-radius: 16rpx;
    box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.05);
    display: flex;
    flex-wrap: wrap;
    gap: 16rpx 24rpx;
}
.detail-item-inline {
    color: #666;
    font-size: 28rpx;
    margin-right: 24rpx;
}
</style>

