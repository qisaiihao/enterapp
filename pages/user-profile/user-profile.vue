<template>
    ﻿
    <!-- pages/user-profile/user-profile.wxml -->
    <view class="container">

        <!-- 主要内容 -->
        <view class="main-content">
            <!-- User Profile Card -->
            <view class="profile-card profile-card-center">
                <view class="profile-avatar-large">
                    <image :src="userInfo.avatarUrl || '/static/images/avatar.png'" mode="aspectFill" @error="onAvatarError"></image>
                </view>
                <view class="profile-info-center">
                    <text class="profile-name-center">{{ userInfo.nickName || '微信用户' }}</text>
                    <text class="profile-poemid">poemid：{{ userInfo.poemId || '未知' }}</text>
                    <text class="profile-bio-center">{{ userInfo.bio || '这个用户很懒,什么都没留下...' }}</text>
                    <view class="profile-bottom-row">
                        <text class="profile-followers">被关注数：{{ followerCount }}</text>
                        <view class="profile-buttons">
                            <button
                                v-if="showFollowButton"
                                :class="'follow-btn ' + (isFollowing ? 'following' : '')"
                                @tap="onFollowTap"
                                :loading="followPending"
                                :disabled="followPending"
                            >
                                {{ isFollowing ? '已关注' : '关注' }}
                            </button>
                            <view v-if="isMutualFollow" class="mutual-indicator">互相关注</view>
                            <view v-else-if="isFollowedByTarget" class="followed-indicator">TA关注了你</view>
                        </view>
                    </view>
                </view>
            </view>

            <!-- 帖子列表 -->
            <!-- <view class="profile-detail-card"> -->
                <!-- <text class="detail-item-inline">职业:{{ userInfo.occupation ? userInfo.occupation : '未设置' }}</text> -->
                <!-- <text class="detail-item-inline">地区:{{ userInfo.region ? userInfo.region : '未设置' }}</text> -->
            <!-- </view> -->

            <!-- 切换栏：帖子 / 作品集 / 收藏 -->
            <view class="tab-navigation">
                <view :class="'tab-item ' + (currentTab === 'posts' ? 'active' : '')" data-tab="posts" @tap="switchTab">
                    <image class="tab-icon" src="/static/images/my_posts.png" mode="aspectFit"></image>
                </view>
                <view :class="'tab-item ' + (currentTab === 'portfolio' ? 'active' : '')" data-tab="portfolio" @tap="switchTab">
                    <image class="tab-icon" src="/static/images/portfolio.png" mode="aspectFit"></image>
                </view>
                <view :class="'tab-item ' + (currentTab === 'favorites' ? 'active' : '')" data-tab="favorites" @tap="switchTab">
                    <image class="tab-icon" src="/static/images/my_favorites.png" mode="aspectFit"></image>
                </view>
            </view>

            <!-- 他人帖子（与个人主页一致的样式） -->
            <view class="my-posts-section" v-if="currentTab === 'posts'">
                <block v-if="userPosts.length > 0">
                    <view :class="'post-item-wrapper ' + (item.isOriginal ? 'original-post' : '')" v-for="(item, index) in userPosts" :key="index">
                        <view class="author-info-outside">
                            <image
                                v-if="item.authorAvatar"
                                class="author-avatar"
                                :src="item.authorAvatar"
                                mode="aspectFill"
                                @error="onAvatarError"
                                :data-postindex="index"
                                @tap.stop.prevent="navigateToUserProfile"
                                :data-user-id="item._openid"
                            ></image>
                            <text class="author-name">{{ item.authorName }}</text>
                        </view>

                        <navigator class="post-content-navigator" :url="'/pages/post-detail/post-detail?id=' + item._id" hover-class="navigator-hover">
                            <view class="post-item">
                                <view class="post-title">{{ item.title }}</view>
                                <view
                                    v-if="item.imageUrls && item.imageUrls.length > 0"
                                    class="image-container-wrapper"
                                    :style="item.imageStyle"
                                    @tap.stop.prevent="handlePreview"
                                    :data-src="item.imageUrls[0]"
                                    :data-original-image-urls="item.originalImageUrls || item.imageUrls"
                                >
                                    <block v-if="item.imageUrls.length === 1">
                                        <image
                                            :id="'single-image-' + item._id"
                                            class="post-image"
                                            :src="item.imageUrls[0]"
                                            mode="aspectFill"
                                            :lazy-load="true"
                                            @error="onImageError"
                                            @load="onImageLoad"
                                            :data-postid="item._id"
                                            :data-postindex="index"
                                            data-imgindex="0"
                                            data-type="single"
                                        />
                                    </block>
                                    <block v-else-if="item.imageUrls.length > 1">
                                        <swiper
                                            :id="'swiper-' + item._id"
                                            class="image-swiper"
                                            :indicator-dots="true"
                                            :circular="true"
                                            :style="'height: ' + (swiperHeights[index] ? swiperHeights[index] + 'px' : '220px') + ';'"
                                        >
                                            <block v-for="(img, imgindex) in item.imageUrls" :key="imgindex">
                                                <swiper-item>
                                                    <image
                                                        class="post-image"
                                                        :src="img"
                                                        mode="aspectFill"
                                                        :lazy-load="true"
                                                        @error="onImageError"
                                                        @load="onImageLoad"
                                                        @tap.stop.prevent="handlePreview"
                                                        :data-src="img"
                                                        :data-original-image-urls="item.originalImageUrls || item.imageUrls"
                                                        :data-postid="item._id"
                                                        :data-postindex="index"
                                                        :data-imgindex="imgindex"
                                                        data-type="multi"
                                                    />
                                                </swiper-item>
                                            </block>
                                        </swiper>
                                    </block>
                                </view>
                                <view class="post-content" v-if="item.content" style="white-space: pre-wrap">{{ item.content }}</view>
                                <view v-if="item.tags && item.tags.length > 0" class="post-tags">
                                    <text class="post-tag" @tap.stop.prevent="onTagClick" :data-tag="item" v-for="(item, index1) in item.tags" :key="index1">#{{ item }}</text>
                                </view>
                            </view>
                        </navigator>
                        <view class="delete-section">
                            <view class="time-left">
                                <text class="post-time">发布于{{ item.formattedCreateTime || '未知时间' }}</text>
                            </view>
                        </view>
                    </view>
                    <view class="loading-footer">
                        <block v-if="!hasMore && userPosts.length > 0">
                            <text>--- 我是有底线的 ---</text>
                        </block>
                    </view>
                    <view style="height: 200rpx"></view>
                </block>
                <view v-else class="empty-tip"><text>TA还没有发布内容哦～</text></view>
            </view>

            <!-- 他人作品集 -->
            <view class="portfolio-section" v-if="currentTab === 'portfolio'">
                <block v-if="portfolioList.length > 0">
                    <view class="portfolio-grid">
                        <view class="portfolio-item" v-for="(portfolio, index) in portfolioList" :key="index" @tap="openPortfolio" :data-portfolio="portfolio">
                            <view class="portfolio-cover">
                                <image
                                    v-if="portfolio.coverImage"
                                    :src="portfolio.coverImage"
                                    mode="aspectFill"
                                    @error="onImageError"
                                ></image>
                                <view v-else class="portfolio-placeholder">
                                    <text class="portfolio-icon">📁</text>
                                </view>
                            </view>
                            <view class="portfolio-info">
                                <text class="portfolio-name">{{ portfolio.name || '未命名作品集' }}</text>
                                <text class="portfolio-count">{{ portfolio.postCount || 0 }} 个作品</text>
                            </view>
                        </view>
                    </view>
                    <view style="height: 200rpx"></view>
                </block>
                <view v-else-if="!portfolioLoading" class="empty-tip">
                    <text>TA还没有创建作品集</text>
                </view>
                <view v-if="portfolioLoading" class="loading-tip">
                    <text>加载中...</text>
                </view>
            </view>

            <!-- 他人收藏 -->
            <view class="favorites-section" v-if="currentTab === 'favorites'">
                <block v-if="favoriteList.length > 0">
                    <view :class="'post-item-wrapper'" v-for="(item, index) in favoriteList" :key="index">
                        <view class="author-info-outside">
                            <image
                                v-if="item.authorAvatar"
                                class="author-avatar"
                                :src="item.authorAvatar"
                                mode="aspectFill"
                                @error="onAvatarError"
                                :data-postindex="index"
                                @tap.stop.prevent="navigateToUserProfile"
                                :data-user-id="item._openid"
                            ></image>
                            <text class="author-name">{{ item.authorName }}</text>
                        </view>

                        <navigator class="post-content-navigator" :url="'/pages/post-detail/post-detail?id=' + item.postId" hover-class="navigator-hover">
                            <view class="post-item">
                                <view class="post-title">{{ item.title }}</view>
                                <view
                                    v-if="item.imageUrls && item.imageUrls.length > 0"
                                    class="image-container-wrapper"
                                    :style="item.imageStyle"
                                    @tap.stop.prevent="handlePreview"
                                    :data-src="item.imageUrls[0]"
                                    :data-original-image-urls="item.originalImageUrls || item.imageUrls"
                                >
                                    <block v-if="item.imageUrls.length === 1">
                                        <image
                                            class="post-image"
                                            :src="item.imageUrls[0]"
                                            mode="aspectFill"
                                            :lazy-load="true"
                                            @error="onImageError"
                                            @load="onImageLoad"
                                        />
                                    </block>
                                    <block v-else-if="item.imageUrls.length > 1">
                                        <swiper
                                            class="image-swiper"
                                            :indicator-dots="true"
                                            :circular="true"
                                            :style="'height: 220px;'"
                                        >
                                            <block v-for="(img, imgindex) in item.imageUrls" :key="imgindex">
                                                <swiper-item>
                                                    <image
                                                        class="post-image"
                                                        :src="img"
                                                        mode="aspectFill"
                                                        :lazy-load="true"
                                                        @error="onImageError"
                                                        @load="onImageLoad"
                                                        @tap.stop.prevent="handlePreview"
                                                        :data-src="img"
                                                        :data-original-image-urls="item.originalImageUrls || item.imageUrls"
                                                    />
                                                </swiper-item>
                                            </block>
                                        </swiper>
                                    </block>
                                </view>
                                <view class="post-content" v-if="item.content" style="white-space: pre-wrap">{{ item.content }}</view>
                                <view v-if="item.tags && item.tags.length > 0" class="post-tags">
                                    <text class="post-tag" @tap.stop.prevent="onTagClick" :data-tag="item" v-for="(item, index1) in item.tags" :key="index1">#{{ item }}</text>
                                </view>
                            </view>
                        </navigator>
                        <view class="delete-section">
                            <view class="time-left">
                                <text class="post-time">收藏于{{ item.formattedFavoriteTime || '未知时间' }}</text>
                            </view>
                        </view>
                    </view>
                    <view class="loading-footer">
                        <block v-if="!favoriteHasMore && favoriteList.length > 0">
                            <text>--- 我是有底线的 ---</text>
                        </block>
                    </view>
                    <view style="height: 200rpx"></view>
                </block>
                <view v-else-if="!favoriteLoading" class="empty-tip">
                    <text>TA还没有收藏内容</text>
                </view>
                <view v-if="favoriteLoading" class="loading-tip">
                    <text>加载中...</text>
                </view>
            </view>

            <view class="posts-section" v-if="false">
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


                    <!-- 占位空白，便于触发 onReachBottom -->
                    <view style="height: 100rpx"></view>
                </block>

                <view v-else class="empty-tip">
                    <text>TA还没有发布过帖子</text>
                </view>
            </view>
        </view>
    </view>
</template>

<script>
import { getUserInfo, getUserPosts, getUserPortfolios, getUserFavorites, invalidateUserInfo, invalidateUserPosts, invalidateUserPortfolios, invalidateUserFavorites } from '@/api-cache/user-profile.js';
import { hydrateTempUrls, warmTempUrlsFromPosts } from '../../_utils/hydrate-temp-urls';
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
            imageUrl: '',

            // 关注数统计
            followingCount: 0,
            followerCount: 0,

            // 切换栏
            currentTab: 'posts',
            portfolioList: [],
            favoriteList: [],

            // 作品集和收藏相关状态
            portfolioLoading: false,
            favoriteLoading: false,
            favoritePage: 0,
            favoriteHasMore: true
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
        console.log('【用户主页】下拉刷新触发');
        
        // 清除用户信息缓存
        invalidateUserInfo(this.targetUserId);
        // 清除用户帖子缓存
        invalidateUserPosts(this.targetUserId);
        // 清除用户作品集缓存
        invalidateUserPortfolios(this.targetUserId);
        // 清除用户收藏缓存
        invalidateUserFavorites(this.targetUserId);

        this.setData({
            userPosts: [],
            page: 0,
            hasMore: true,
            swiperHeights: {},
            imageClampHeights: {},
            portfolioList: [],
            favoriteList: [],
            favoritePage: 0,
            favoriteHasMore: true
        });
        this.loadUserProfile(() => {
            uni.stopPullDownRefresh();
        });
    },
    onReachBottom: function () {
        switch (this.currentTab) {
            case 'posts':
                if (!this.hasMore || this.isLoading) return;
                this.loadUserPosts();
                break;
            case 'favorites':
                if (!this.favoriteHasMore || this.favoriteLoading) return;
                this.loadUserFavorites();
                break;
        }
    },
    methods: {
        // 标签切换（他人主页）
        switchTab: function (e) {
            const tab = e && e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.tab;
            if (!tab || tab === this.currentTab) return;
            this.setData({ currentTab: tab });

            // 根据切换的标签加载相应数据
            switch (tab) {
                case 'portfolio':
                    if (this.portfolioList.length === 0 && !this.portfolioLoading) {
                        try { invalidateUserPortfolios && invalidateUserPortfolios(this.targetUserId); } catch (_) {}
                        this.loadUserPortfolios();
                    }
                    break;
                case 'favorites':
                    if (this.favoriteList.length === 0 && !this.favoriteLoading) {
                        this.setData({ favoritePage: 0 });
                        try { invalidateUserFavorites && invalidateUserFavorites(this.targetUserId); } catch (_) {}
                        this.loadUserFavorites();
                    }
                    break;
            }
        },
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
            ]).then(async ([userInfo, posts]) => {
                posts.forEach((post) => { if (post.createTime) post.formattedCreateTime = this.formatTime(post.createTime); });
                
                // 处理cloud://协议的URL转换
                posts = await hydrateTempUrls(posts);
                warmTempUrlsFromPosts(posts);
                
                this.setData({
                    userInfo,
                    userPosts: posts,
                    page: 1,
                    hasMore: posts.length === this.PAGE_SIZE
                });
                avatarCache.updateUserAvatar(this.targetUserId, userInfo);
                this.prepareFollowStateWithCache();
                this.fetchFollowCounts();
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
                .then(async (posts) => {
                    posts.forEach((post) => { if (post.createTime) post.formattedCreateTime = this.formatTime(post.createTime); });
                    
                    // 处理cloud://协议的URL转换
                    posts = await hydrateTempUrls(posts);
                    warmTempUrlsFromPosts(posts);
                    
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
        },

        // 打开他人主页（用于头像点击）
        navigateToUserProfile: function (e) {
            try {
                const dataset = (e && e.currentTarget && e.currentTarget.dataset) || {};
                const userId = dataset.userId || dataset.userid || dataset.user || '';
                if (!userId) {
                    uni.showToast({ title: '用户ID缺失', icon: 'none' });
                    return;
                }
                const url = `/pages/user-profile/user-profile?userId=${userId}`;
                uni.navigateTo({ url });
            } catch (err) {
                console.error('[navigateToUserProfile] failed:', err);
                uni.showToast({ title: '跳转失败', icon: 'none' });
            }
        },

        onTagClick: function () {
            console.log('占位：函数 onTagClick 未声明');
        },

        // 加载用户作品集
        async loadUserPortfolios(cb) {
            try {
                this.setData({ portfolioLoading: true });
                let portfolios = await getUserPortfolios(this.targetUserId, this);
                try { console.log('[user-profile] getUserPortfolios ->', (portfolios || []).length); } catch (_) {}
                // 兼容服务端命名差异：postsCount vs postCount
                portfolios = (portfolios || []).map((p) => {
                    if (typeof p.postCount === 'number') return p;
                    const postCount = typeof p.postsCount === 'number' ? p.postsCount : 0;
                    return Object.assign({}, p, { postCount });
                });
                this.setData({ portfolioList: portfolios });
                try { console.log('[user-profile] portfolioList set ->', this.portfolioList.length); } catch (_) {}
            } catch (error) {
                console.error('加载用户作品集失败:', error);
            } finally {
                this.setData({ portfolioLoading: false });
                if (typeof cb === 'function') cb();
            }
        },

        // 打开作品集
        openPortfolio(e) {
            try {
                const dataset = (e && e.currentTarget && e.currentTarget.dataset) || {};
                const portfolio = dataset.portfolio;
                if (!portfolio || !portfolio._id) {
                    uni.showToast({ title: '作品集信息获取失败', icon: 'none' });
                    return;
                }
                console.log('打开他人作品集:', portfolio);
                // 跳转到作品集详情页面
                uni.navigateTo({
                    url: `/pages/portfolio-detail/portfolio-detail?folderId=${portfolio._id}&folderName=${encodeURIComponent(portfolio.name || '未命名作品集')}`
                });
            } catch (err) {
                console.error('[openPortfolio] failed:', err);
                uni.showToast({ title: '跳转失败', icon: 'none' });
            }
        },

        // 加载用户收藏
        loadUserFavorites: function (cb) {
            if (this.favoriteLoading) return;

            const { favoritePage, PAGE_SIZE } = this;
            console.log('【用户主页】请求收藏分页参数:', {
                favoritePage,
                PAGE_SIZE,
                skip: favoritePage * PAGE_SIZE,
                limit: PAGE_SIZE
            });

            this.setData({ favoriteLoading: true });

            getUserFavorites({ userId: this.targetUserId, page: favoritePage, pageSize: PAGE_SIZE, context: this })
                .then(async (favorites) => {
                    // 将 { postId, favoriteTime, post: {...} } 规范化为贴合模板的数据结构
                    let normalized = (favorites || []).map((fav) => {
                        const post = fav && fav.post ? fav.post : {};
                        const mapped = Object.assign({}, post, {
                            postId: fav.postId,
                            favoriteTime: fav.favoriteTime,
                            authorName: post.authorName || post.author || '',
                            authorAvatar: post.authorAvatar || '',
                            _openid: post._openid || '',
                            imageUrls: Array.isArray(post.imageUrls) ? post.imageUrls : [],
                            originalImageUrls: Array.isArray(post.originalImageUrls) ? post.originalImageUrls : (Array.isArray(post.imageUrls) ? post.imageUrls : []),
                            tags: Array.isArray(post.tags) ? post.tags : [],
                            title: post.title || '',
                            content: post.content || ''
                        });
                        if (mapped.favoriteTime) mapped.formattedFavoriteTime = this.formatTime(mapped.favoriteTime);
                        if (mapped.imageUrls && mapped.imageUrls.length > 0) mapped.imageStyle = `height: 0; padding-bottom: 75%;`;
                        return mapped;
                    });

                    // cloud:// 临时链接水合
                    try {
                        normalized = await hydrateTempUrls(normalized);
                        warmTempUrlsFromPosts(normalized);
                    } catch (_) {}

                    const newFavoriteList = favoritePage === 0 ? normalized : this.favoriteList.concat(normalized || []);
                    this.setData({
                        favoriteList: newFavoriteList,
                        favoritePage: favoritePage + 1,
                        favoriteHasMore: (favorites || []).length === PAGE_SIZE
                    });
                })
                .catch((err) => {
                    console.error('【用户主页】获取收藏失败:', err);
                    uni.showToast({ title: '网络异常', icon: 'none' });
                })
                .finally(() => {
                    this.setData({ favoriteLoading: false });
                    if (typeof cb === 'function') cb();
                });
        },

        // 获取关注数统计
        fetchFollowCounts: function () {
            if (!this.targetUserId) {
                return;
            }

            this.callCloudFunction('follow', {
                action: 'getFollowCounts',
                targetOpenid: this.targetUserId
            }).then((res) => {
                if (res.result && res.result.success) {
                    this.setData({
                        followingCount: res.result.followingCount || 0,
                        followerCount: res.result.followerCount || 0
                    });
                } else {
                    console.warn('获取关注数失败', res.result);
                    this.setData({
                        followingCount: 0,
                        followerCount: 0
                    });
                }
            }).catch((err) => {
                console.error('获取关注数调用失败:', err);
                this.setData({
                    followingCount: 0,
                    followerCount: 0
                });
            });
        }
    }
};
</script>
<style>
/* pages/user-profile/user-profile.wxss */
.container {
    min-height: 100vh;
    background-color: #ffffff;
}

/* Main Content */
.main-content {
    width: 100%;
    min-height: 100vh;
    background-color: #ffffff;
}

/* User Profile Card */
.profile-card {
    margin: 30rpx;
    padding: 40rpx;
    background-color: #fff;
    border-radius: 16rpx;
    box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.05);
    display: flex;
    align-items: flex-start;
    transition: box-shadow 0.2s ease;
}

.profile-card:active {
    box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.1);
}

.profile-card-center {
    position: relative;
    margin: 0;
    padding: 40rpx 40rpx 20rpx 40rpx;
    background-color: transparent;
    border-radius: 0;
    box-shadow: none;
    display: flex;
    flex-direction: column;
    align-items: center;
    overflow: visible;
}

.profile-avatar-large {
    display: flex;
    justify-content: center;
    align-items: center;
    margin: 70rpx 0 40rpx 0;
}

.profile-avatar-large image {
    width: 175rpx;
    height: 175rpx;
    border-radius: 50%;
    display: block;
}

.profile-info-center {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    margin-top: 20rpx;
    width: 100%;
}

.profile-name-center {
    font-family: 'Inter', sans-serif;
    font-weight: 600;
    font-size: 30rpx;
    line-height: 36rpx;
    color: #000000;
    margin-bottom: 20rpx;
    text-align: left;
}

.profile-poemid {
    font-family: 'Inter', sans-serif;
    font-weight: 300;
    font-size: 20rpx;
    line-height: 24rpx;
    color: #989090;
    margin-bottom: 20rpx;
}

.profile-bio-center {
    font-family: 'Inter', sans-serif;
    font-weight: 600;
    font-size: 24rpx;
    line-height: 30rpx;
    color: #000000;
    text-align: left;
    margin-bottom: 20rpx;
}

.profile-bottom-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    margin-bottom: 10rpx;
}

.profile-buttons {
    display: flex;
    align-items: center;
    gap: 10rpx;
}

.profile-followers {
    font-family: 'Inter', sans-serif;
    font-weight: 400;
    font-size: 24rpx;
    line-height: 30rpx;
    color: #666666;
}

.follow-btn {
    padding: 8rpx 24rpx;
    background-color: #007aff;
    color: #ffffff;
    border: none;
    border-radius: 20rpx;
    font-size: 24rpx;
    font-weight: 500;
    min-width: 80rpx;
}

.follow-btn.following {
    background-color: #f0f0f0;
    color: #666666;
}

.follow-btn::after {
    border: none;
}

.follow-btn[disabled] {
    opacity: 0.7;
}

.mutual-indicator,
.followed-indicator {
    padding: 8rpx 20rpx;
    border-radius: 20rpx;
    font-size: 22rpx;
    background-color: #f0f8ff;
    color: #007aff;
}

/* 帖子部分 */
.posts-section {
    margin: 20rpx 30rpx 30rpx 30rpx;
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

/* —— 与个人主页统一的切换栏与帖子展示样式 —— */
.tab-navigation {
    margin: 0 30rpx 20rpx 30rpx;
    display: flex;
    background: #fff;
    border: 1rpx solid #fff;
    border-radius: 16rpx;
    overflow: hidden;
}
.tab-item {
    flex: 1;
    padding: 20rpx 10rpx;
    text-align: center;
    background: #fff;
    transition: all 0.3s ease;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
}
.tab-item.active::after {
    content: '';
    position: absolute;
    bottom: 8rpx;
    left: 50%;
    transform: translateX(-50%);
    width: 200rpx;
    height: 6rpx;
    background: #333;
    border-radius: 3rpx;
}
.tab-item:active { background: #f5f5f5; }
.tab-icon { width: 110rpx; height: 110rpx; filter: grayscale(1) brightness(0.5); opacity: 0.7; }
.tab-item.active .tab-icon { filter: grayscale(0) brightness(1); opacity: 1; }

.my-posts-section, .portfolio-section, .favorites-section { margin: 0 0 30rpx 0; }

.post-item-wrapper { background: #fff; margin-bottom: 20rpx; padding: 0; box-shadow: none; border-radius: 0; border-bottom: 1rpx solid #f0f0f0; }
.post-item-wrapper.original-post { background: linear-gradient(90deg, rgba(235,200,141,0.05) 0%, rgba(255,255,255,0) 100%); border-left: 3rpx solid #ebc88d; position: relative; }
.post-content-navigator { display: block; background: transparent; }
.navigator-hover { background-color: rgba(0,0,0,0.02); }

.author-info-outside { display: flex; align-items: center; padding: 20rpx 40rpx 10rpx 40rpx; background: #fff; }
.author-info-outside .author-avatar { width: 60rpx; height: 60rpx; border-radius: 50%; margin-right: 15rpx; background-color: #f5f5f5; }
.author-info-outside .author-name { font-size: 28rpx; color: #333; font-weight: 500; }

.post-item { width: 100%; background: #fff; border-radius: 0; box-shadow: none; box-sizing: border-box; padding: 20rpx 40rpx 30rpx 40rpx; }
.post-title { font-size: 36rpx; font-weight: bold; color: #333333; margin-bottom: 15rpx; line-height: 1.4; word-break: break-word; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; }
.poem-author { font-size: 32rpx; color: #000; text-align: center; margin: 5rpx 0 15rpx 0; letter-spacing: 2rpx; }

.image-container-wrapper { position: relative; width: 100%; background-color: #f0f0f0; overflow: hidden; border-radius: 8px; margin: 20rpx 0; }
.image-container-wrapper .post-image, .image-container-wrapper .image-swiper { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }
.image-swiper { width: 100%; background-color: #fff; }
.post-image { width: 100%; height: 100%; display: block; object-fit: contain; }

.post-content { font-size: 28rpx; color: #666666; line-height: 1.6; margin-top: 15rpx; word-break: break-word; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 3; line-clamp: 3; -webkit-box-orient: vertical; }
.delete-section { display: flex; justify-content: space-between; align-items: center; margin-top: 20rpx; padding: 0 40rpx 0 40rpx; }
.time-left .post-time { font-size: 24rpx; color: #999; }
.post-tags { margin-top: 30rpx; margin-bottom: 10rpx; line-height: 1.5; }
.post-tag { color: #24375f; font-size: 26rpx; margin-right: 10rpx; transition: all 0.2s ease; }
.loading-footer { text-align: center; padding: 20rpx 0; color: #999; font-size: 14px; }

/* 作品集样式 */
.portfolio-grid {
    padding: 20rpx 30rpx;
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 20rpx;
}

.portfolio-item {
    background: #fff;
    border-radius: 16rpx;
    overflow: hidden;
    box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.05);
    transition: transform 0.2s ease;
}

.portfolio-item:active {
    transform: translateY(2rpx);
}

.portfolio-cover {
    width: 100%;
    height: 200rpx;
    background: #f0f0f0;
    position: relative;
}

.portfolio-cover image {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.portfolio-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f8f9fa;
}

.portfolio-icon {
    font-size: 60rpx;
    opacity: 0.5;
}

.portfolio-info {
    padding: 20rpx;
}

.portfolio-name {
    font-size: 28rpx;
    font-weight: 600;
    color: #333;
    display: block;
    margin-bottom: 8rpx;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.portfolio-count {
    font-size: 24rpx;
    color: #999;
    display: block;
}

.loading-tip {
    text-align: center;
    color: #999;
    font-size: 28rpx;
    margin: 40rpx 0;
    padding: 60rpx 0;
    background-color: #fff;
    border-radius: 16rpx;
    box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.05);
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
