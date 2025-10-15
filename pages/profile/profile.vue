<template>
    <view>
        ﻿
        <!-- pages/profile/profile.wxml -->
        <view class="container">
            <!-- 骨架屏：当 isLoading 为 true 时，显示骨架屏，其他所有内容都不渲染 -->
            <view v-if="isLoading">
                <skeleton />
            </view>

            <!-- 真实内容：当 isLoading 为 false 时，显示真实页面 -->
            <scroll-view wx:else class="scroll-container" :scroll-y="true" @scrolltolower="onScrollToLower" lower-threshold="100" :enhanced="true" :show-scrollbar="false">
                <!-- Sidebar Mask -->
                <view class="sidebar-mask" v-if="isSidebarOpen" @tap="toggleSidebar"></view>

                <!-- Sidebar -->
                <view :class="'sidebar ' + (isSidebarOpen ? 'open' : '')">
                    <view class="sidebar-header">
                        <image class="sidebar-avatar" :src="userInfo.avatarUrl || '/static/images/avatar.png'" mode="aspectFill" @error="onAvatarError"></image>
                        <text class="sidebar-nickname">{{ userInfo.nickName || '微信用户' }}</text>
                    </view>
                    <view class="sidebar-menu">
                        <view class="sidebar-item" @tap="navigateToEditProfile">
                            <text>修改资料</text>
                        </view>
                        <view class="sidebar-item" v-if="isAdmin" @tap="navigateToImageManager">
                            <text>图片管理</text>
                        </view>
                        <view class="sidebar-item" @tap="navigateToMessages">
                            <text>消息通知</text>
                            <view v-if="unreadCount > 0" class="unread-badge">{{ unreadCount }}</view>
                        </view>
                        <view class="sidebar-item" @tap="navigateToMyLikes">
                            <text>我的点赞</text>
                        </view>
                        <view class="sidebar-item" @tap="navigateToFollowing">
                            <text>我关注的</text>
                        </view>
                        <view class="sidebar-item" @tap="navigateToFans">
                            <text>我的粉丝</text>
                            <view v-if="newFollowerCount > 0" class="unread-dot"></view>
                        </view>
                        <view class="sidebar-item" @tap="navigateToFavoriteFolders">
                            <text>我的收藏夹</text>
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
                        <view class="sidebar-item" v-if="isAdmin" @tap="navigateToFeedbackAdmin">
                            <text>反馈管理</text>
                        </view>
                        <view class="sidebar-item logout-item" @tap="showLogoutConfirm">
                            <text>退出登录</text>
                        </view>
                        <!-- 关注/被关注统计（放在资料卡内，签名下方） -->
                        <view class="follow-stats">
                            <view class="stat-item" @tap="navigateToFollowing">
                                <text class="stat-number">{{ followingCount }}</text>
                                <text class="stat-label">关注</text>
                            </view>
                            <view class="stat-divider"></view>
                            <view class="stat-item" @tap="navigateToFans">
                                <text class="stat-number">{{ followerCount }}</text>
                                <text class="stat-label">被关注</text>
                            </view>
                        </view>
                    </view>
                </view>

                <!-- Main Content -->
                <view class="main-content">
                    <!-- User Profile Card -->
                    <view class="profile-card profile-card-center">
                        <!-- 菜单按钮 -->
                        <image src="/static/images/icons/menu-icon.svg" class="menu-btn-large" @tap="toggleSidebar" style="z-index: 101"></image>
                        <view class="profile-avatar-large">
                            <image :src="userInfo.avatarUrl || '/static/images/avatar.png'" mode="aspectFill" @error="onAvatarError"></image>
                        </view>
                        <view class="profile-info-center">
                            <text class="profile-name-center">{{ userInfo.nickName || '微信用户' }}</text>
                            <text class="profile-bio-center">{{ userInfo.bio || '这个用户很懒,什么都没留下...' }}</text>
                            <text class="profile-meta-center" v-if="userInfo.occupation || userInfo.region">
                                {{ (userInfo.occupation || '') + (userInfo.occupation && userInfo.region ? ' · ' : '') + (userInfo.region || '') }}
                            </text>
                        </view>
                    </view>
                    <!-- 年龄和生日卡片 -->
                    <view v-if="isViewingSelf" class="profile-detail-card">
                        <text class="detail-item-inline">生日:{{ userInfo.birthday ? userInfo.birthday : '未设置' }}</text>
                        <text class="detail-item-inline">年龄:{{ userInfo.age ? userInfo.age + '岁' : '未知' }}</text>
                    </view>
                    <!-- Tab Navigation -->
                    <view class="tab-navigation">
                        <view :class="'tab-item ' + (currentTab === 'posts' ? 'active' : '')" data-tab="posts" @tap="switchTab">
                            <text>我发布的帖子</text>
                        </view>
                        <view :class="'tab-item ' + (currentTab === 'favorites' ? 'active' : '')" data-tab="favorites" @tap="switchTab">
                            <text>收藏</text>
                        </view>
                    </view>

                    <!-- My Posts Section -->
                    <view class="my-posts-section" v-if="currentTab === 'posts'">
                        <block v-if="myPosts.length > 0">
                            <!-- ... 你的帖子循环代码保持不变 ... -->
                            <view :class="'post-item-wrapper ' + (item.isOriginal ? 'original-post' : '')" v-for="(item, index) in myPosts" :key="index">
                                <!-- 作者信息 -->

                                <view class="author-info-outside">
                                    <image
                                        v-if="item.authorAvatar"
                                        class="author-avatar"
                                        :src="item.authorAvatar"
                                        mode="aspectFill"
                                        @error="onAvatarError"
                                        @load="onAvatarLoad"
                                        :data-postindex="index"
                                        @tap.stop.prevent="navigateToUserProfile"
                                        :data-user-id="item._openid"
                                    ></image>
                                    <text class="author-name">{{ item.authorName }}</text>
                                </view>

                                <!-- 可点击的内容区域 - 跳转到详情页 -->

                                <navigator class="post-content-navigator" :url="'/pages/post-detail/post-detail?id=' + item._id" hover-class="navigator-hover">
                                    <view class="post-item">
                                        <view class="post-title">{{ item.title }}</view>
                                        <!-- 诗歌作者信息 -->
                                        <view v-if="item.isPoem && item.author" class="poem-author">{{ item.author }}</view>

                                        <!-- 图片显示逻辑 (已优化，使用 imageStyle 占位) -->
                                        <view
                                            v-if="item.imageUrls && item.imageUrls.length > 0"
                                            class="image-container-wrapper"
                                            :style="item.imageStyle"
                                            @tap.stop.prevent="handlePreview"
                                            :data-src="item.imageUrls[0]"
                                            :data-original-image-urls="item.originalImageUrls || item.imageUrls"
                                        >
                                            <!-- 单张图片 -->
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

                                            <!-- 多张图片 -->
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

                                        <!-- 标签显示 -->
                                        <view v-if="item.tags && item.tags.length > 0" class="post-tags">
                                            <text class="post-tag" @tap.stop.prevent="onTagClick" :data-tag="item" v-for="(item, index1) in item.tags" :key="index1">
                                                #{{ item }}
                                            </text>
                                        </view>
                                    </view>
                                </navigator>

                                <!-- 删除按钮区域 -->

                                <view class="delete-section">
                                    <view class="time-left">
                                        <text class="post-time">发布于{{ item.formattedCreateTime || '未知时间' }}</text>
                                    </view>
                                    <view class="button-group">
                                        <button class="delete-btn" size="mini" @tap.stop.prevent="onDelete" :data-postid="item._id" :data-index="index">删除</button>
                                    </view>
                                </view>
                            </view>
                            <!-- 加载更多提示 -->
                            <view class="loading-footer">
                                <block v-if="isLoadingMore">
                                    <text>正在加载...</text>
                                </block>
                                <block v-else-if="!hasMore && myPosts.length > 0">
                                    <text>--- 我是有底线的 ---</text>
                                </block>
                            </view>
                            <view style="height: 200rpx"></view>
                        </block>
                        <view v-else class="empty-tip">
                            <text>你还没有发布过帖子哦～</text>
                        </view>
                    </view>

                    <!-- Favorites Section -->
                    <view class="favorites-section" v-if="currentTab === 'favorites'">
                        <block v-if="favoriteList.length > 0">
                            <view :class="'post-item-wrapper ' + (item.isOriginal ? 'original-post' : '')" v-for="(item, index) in favoriteList" :key="index">
                                <!-- 作者信息 -->

                                <view class="author-info-outside">
                                    <image
                                        v-if="item.authorAvatar"
                                        class="author-avatar"
                                        :src="item.authorAvatar"
                                        mode="aspectFill"
                                        @error="onAvatarError"
                                        @load="onAvatarLoad"
                                        :data-postindex="index"
                                        @tap.stop.prevent="navigateToUserProfile"
                                        :data-user-id="item._openid"
                                    ></image>
                                    <text class="author-name">{{ item.authorName }}</text>
                                </view>

                                <!-- 可点击的内容区域 - 跳转到详情页 -->

                                <navigator class="post-content-navigator" :url="'/pages/post-detail/post-detail?id=' + item._id" hover-class="navigator-hover">
                                    <view class="post-item">
                                        <view class="post-title">{{ item.title }}</view>
                                        <!-- 诗歌作者信息 -->
                                        <view v-if="item.isPoem && item.author" class="poem-author">{{ item.author }}</view>

                                        <!-- 图片显示逻辑 (已优化，使用 imageStyle 占位) -->
                                        <view
                                            v-if="item.imageUrls && item.imageUrls.length > 0"
                                            class="image-container-wrapper"
                                            :style="item.imageStyle"
                                            @tap.stop.prevent="handlePreview"
                                            :data-src="item.imageUrls[0]"
                                            :data-original-image-urls="item.originalImageUrls || item.imageUrls"
                                        >
                                            <!-- 单张图片 -->
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

                                            <!-- 多张图片 -->
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

                                        <!-- 标签显示 -->
                                        <view v-if="item.tags && item.tags.length > 0" class="post-tags">
                                            <text class="post-tag" @tap.stop.prevent="onTagClick" :data-tag="item" v-for="(item, index1) in item.tags" :key="index1">
                                                #{{ item }}
                                            </text>
                                        </view>
                                    </view>
                                </navigator>

                                <!-- 取消收藏按钮区域 -->

                                <view class="delete-section">
                                    <view class="time-left">
                                        <text class="favorite-time">收藏于{{ item.formattedFavoriteTime || '未知时间' }}</text>
                                    </view>
                                    <view class="button-group">
                                        <button class="remove-favorite-btn" size="mini" @tap.stop.prevent="removeFavorite" :data-favorite-id="item.favoriteId" :data-index="index">
                                            取消收藏
                                        </button>
                                    </view>
                                </view>
                            </view>
                            <!-- 加载更多提示 -->
                            <view class="loading-footer">
                                <block v-if="favoriteLoading">
                                    <text>正在加载...</text>
                                </block>
                                <block v-else-if="!favoriteHasMore && favoriteList.length > 0">
                                    <text>--- 我是有底线的 ---</text>
                                </block>
                            </view>
                            <view style="height: 200rpx"></view>
                        </block>
                        <view v-else class="empty-tip">
                            <text>你还没有收藏过内容哦～</text>
                        </view>
                    </view>
                </view>
            </scroll-view>
        </view>
        <!-- 这是一个<view class="container"> 添加的结束标签 -->

        <!-- #ifndef MP-WEIXIN -->
        <app-tab-bar ref="customTabBar" />
        <!-- #endif -->
    </view>

</template>

<script>
// #ifndef MP-WEIXIN
import AppTabBar from '@/custom-tab-bar/index.vue';
// #endif
import { getMyPosts, getMyFavorites, invalidateMyFavorites, invalidateMyPosts, invalidateMyInfo, getMyInfo } from '@/api-cache/my.js';
import { resetAllCachesOnAccountChange } from '@/utils/accountCacheReset.js';
const app = getApp();
const { formatRelativeTime } = require('../../utils/time.js');
const { previewImage } = require('../../utils/imagePreview.js');
const { cloudCall } = require('../../utils/cloudCall.js');
const postGalleryMixin = require('../../mixins/postGallery.js');
const PAGE_SIZE = 5;
export default {
    components: {
        // #ifndef MP-WEIXIN
        AppTabBar
        // #endif
    },
    mixins: [postGalleryMixin],
    data() {
        return {
            isLoading: true,

            // 默认显示骨架屏
            userInfo: {
                avatarUrl: '',
                nickName: '',
                bio: '',
                birthday: false,
                age: false
            },

            isSidebarOpen: false,
            myPosts: [],
            page: 0,
            hasMore: true,
            PAGE_SIZE: PAGE_SIZE,
            swiperHeights: {},

            // 多图swiper高度
            imageClampHeights: {},

            // 单图限制高度
            hasFirstShow_var: false,

            // 新增：标记是否首次进入
            unreadCount: 0,

            // 未读消息数量

            // 新增：标签切换相关
            currentTab: 'posts',

            // 'posts' | 'favorites'
            favoriteList: [],

            // 收藏列表
            favoritePage: 0,

            // 收藏分页
            favoriteHasMore: true,

            // 收藏是否有更多
            favoriteLoading: false,

            // 收藏加载状态

            // 新增：权限控制
            currentUserOpenid: '',

            // 当前用户openid
            // 是否为管理员（只有你能看到图片管理入口）
            isAdmin: false,

            swiperFixedHeight: '',
            selected: 0,
            newFollowerCount: '',
            isLoadingMore: false,
            isViewingSelf: false,
            imgindex: 0,
            img: '',
            // 关注统计
            followingCount: 0,
            followerCount: 0
        };
    },
    onLoad: function (options) {
        // 计算3:4比例高度（宽3高4，竖屏）
        const windowWidth = uni.getSystemInfoSync().windowWidth;
        const fixedHeight = Math.round((windowWidth * 4) / 3);
        this.setData({
            swiperFixedHeight: fixedHeight
        });

        // onLoad 只负责触发异步请求，然后立即结束
        this.getProfileData();
    },
    onShow: function () {
        // #ifndef MP-WEIXIN
        try { uni.hideTabBar({ animation: false }); } catch (e) {}
        try { this.$refs.customTabBar && this.$refs.customTabBar.syncSelected && this.$refs.customTabBar.syncSelected(); } catch (e) {}
        // #endif
        // TabBar 状态更新，使用兼容性处理
        const { updateTabBarStatus } = require('../../utils/tabBarCompatibility.js');
        updateTabBarStatus(this, 3);

        // 每次进入页面时主动刷新数据（但避免首次加载时重复调用）
        if (this._hasFirstShow) {
            console.log('【profile】onShow触发,开始刷新数据');
            this.refreshProfileData();
        } else {
            console.log('【profile】首次显示,标记已显示');
            this.setData({
                hasFirstShow_var: true
            });
        }
    },
    onPullDownRefresh: function () {
        console.log('【profile】下拉刷新触发，当前标签:', this.currentTab);
        if (this.currentTab === 'posts') {
            this.setData({
                myPosts: [],
                page: 0,
                hasMore: true,
                swiperHeights: {},
                imageClampHeights: {}
            });
            this.loadMyPosts(() => {
                uni.stopPullDownRefresh();
                console.log('【profile】下拉刷新结束');
            });
        } else if (this.currentTab === 'favorites') {
            this.setData({
                favoriteList: [],
                favoritePage: 0,
                favoriteHasMore: true,
                swiperHeights: {},
                imageClampHeights: {}
            });
            this.loadFavorites(() => {
                uni.stopPullDownRefresh();
                console.log('【profile】收藏下拉刷新结束');
            });
        }
    },
    onReachBottom: function () {
        console.log('【profile】触底加载触发, currentTab:', this.currentTab);
        if (this.currentTab === 'posts') {
            console.log('【profile】触底加载我的帖子, hasMore:', this.hasMore, 'isLoading:', this.isLoading, '当前页:', this.page);
            if (!this.hasMore || this.isLoading) {
                return;
            }
            this.loadMyPosts();
        } else if (this.currentTab === 'favorites') {
            console.log('【profile】触底加载收藏, favoriteHasMore:', this.favoriteHasMore, 'favoriteLoading:', this.favoriteLoading);
            if (!this.favoriteHasMore || this.favoriteLoading) {
                return;
            }
            this.loadFavorites();
        }
    },
    methods: {
        getProfileData: function () {
            // 获取用户信息和帖子数据
            this.checkLoginAndFetchData();
        },

        // 新增：刷新个人资料数据的方法（使用与下拉刷新相同的逻辑）
        refreshProfileData: function () {
            console.log('【profile】开始刷新个人资料数据，当前标签:', this.currentTab);

            // 检查是否需要刷新首页数据
            const shouldRefreshIndex = uni.getStorageSync('shouldRefreshIndex');
            if (shouldRefreshIndex) {
                console.log('【profile】检测到首页需要刷新标记，清除缓存');
                uni.removeStorageSync('shouldRefreshIndex');
            }

            // 刷新用户信息（只在有用户信息时刷新，避免重复调用）
            if (this.userInfo && this.userInfo._openid) {
                this.fetchUserProfileFast();
                this.fetchFollowCounts();
            }

            // 使用与下拉刷新完全相同的逻辑
            if (this.currentTab === 'posts') {
                this.setData({
                    myPosts: [],
                    page: 0,
                    hasMore: true,
                    swiperHeights: {},
                    imageClampHeights: {}
                });
                this.loadMyPosts(() => {
                    console.log('【profile】onShow刷新帖子数据完成');
                });
            } else if (this.currentTab === 'favorites') {
                this.setData({
                    favoriteList: [],
                    favoritePage: 0,
                    favoriteHasMore: true,
                    swiperHeights: {},
                    imageClampHeights: {}
                });
                this.loadFavorites(() => {
                    console.log('【profile】onShow刷新收藏数据完成');
                });
            }

            // 检查未读消息数量
            this.checkUnreadMessages();
            try { this.fetchFollowCounts && this.fetchFollowCounts(); } catch (_) {}
        },

        // 强制刷新数据
        forceRefresh: function () {
            console.log('强制刷新数据');
            // 清除缓存
            this.setData({
                userInfo: {},
                myPosts: [],
                isLoading: true,
                swiperHeights: {},
                imageClampHeights: {}
            });
            // 重新获取数据
            this.checkLoginAndFetchData();
        },

        checkLoginAndFetchData: function () {
            // 绑定缓存事件（我的主页）：头像更换/发帖/收藏时失效对应缓存
            if (!this._cacheEventsBound) {
                this._cacheEventsBound = true;
                try {
                    uni.$on && uni.$on('avatar-updated', (e) => {
                        const app = getApp();
                        const oid = app && app.globalData && app.globalData.openid;
                        if (e && e.userId === oid) {
                            invalidateMyInfo();
                            getMyInfo(this).then((info) => this.setData({ userInfo: info || {} })).catch(() => {});
                        }
                    });
                    uni.$on && uni.$on('post-created', (e) => {
                        const app = getApp();
                        const oid = app && app.globalData && app.globalData.openid;
                        if (e && e.userId === oid) {
                            invalidateMyPosts();
                            this.setData({ myPosts: [], page: 0, hasMore: true });
                            this.loadMyPosts();
                        }
                    });
                    uni.$on && uni.$on('favorite-changed', (e) => {
                        const app = getApp();
                        const oid = app && app.globalData && app.globalData.openid;
                        if (e && e.userId === oid) {
                            invalidateMyFavorites();
                            if (this.currentTab === 'favorites') {
                                this.setData({ favoriteList: [], favoritePage: 0, favoriteHasMore: true });
                                this.loadFavorites();
                            }
                        }
                    });
                } catch (err) {}
            }
            // 检查登录状态
            const app = getApp();
            const userInfo = app.globalData && app.globalData.userInfo;
            const loginProcessCompleted = app.globalData && app.globalData._loginProcessCompleted;
            
            console.log('🔍 [profile] 检查登录状态:', {
                hasUserInfo: !!userInfo,
                hasOpenid: !!(userInfo && userInfo._openid),
                loginProcessCompleted: loginProcessCompleted
            });
            
            if (userInfo && userInfo._openid) {
                this.fetchUserProfileFast();
                // 首次加载时也要加载帖子数据
                this.loadMyPosts();
            } else if (loginProcessCompleted) {
                // 登录流程已完成但没有用户信息，说明用户未登录
                this.setData({
                    isLoading: false
                });
                console.log('⚠️ [profile] 登录流程已完成但无用户信息，用户未登录');
                // 移除登录提示，让用户自然进入登录流程
            } else {
                // 登录流程未完成，等待登录流程完成
                console.log('⏳ [profile] 登录流程未完成，等待中...');
                this.waitForLoginProcess();
            }
        },

        // 等待登录流程完成
        waitForLoginProcess: function () {
            const checkInterval = setInterval(() => {
                const app = getApp();
                const loginProcessCompleted = app.globalData && app.globalData._loginProcessCompleted;
                
                if (loginProcessCompleted) {
                    clearInterval(checkInterval);
                    console.log('✅ [profile] 登录流程已完成，重新检查登录状态');
                    this.checkLoginAndFetchData();
                }
            }, 100); // 每100ms检查一次
            
            // 设置超时，避免无限等待
            setTimeout(() => {
                clearInterval(checkInterval);
                console.log('⚠️ [profile] 等待登录流程超时，继续执行');
                this.checkLoginAndFetchData();
            }, 5000); // 5秒超时
        },

        // 新增：使用缓存封装的资料拉取，显著降低头像/签名首屏等待
        fetchUserProfileFast: function () {
            getMyInfo(this)
                .then((user) => {
                    if (user && user.birthday) user.age = this.calculateAge(user.birthday); else if (user) user.age = '';
                    this.setData({ userInfo: user || {}, isLoading: false });
                })
                .catch((err) => {
                    console.error('获取用户资料失败（缓存封装）:', err);
                    this.setData({ isLoading: false });
                    const storedUserInfo = uni.getStorageSync('userInfo');
                    if (storedUserInfo) {
                        if (storedUserInfo.birthday) storedUserInfo.age = this.calculateAge(storedUserInfo.birthday);
                        this.setData({ userInfo: storedUserInfo });
                    } else {
                        uni.showToast({ title: '获取数据失败', icon: 'none' });
                    }
                });
        },

        loadMyPosts: function (cb) {
            const { page, PAGE_SIZE } = this;
            console.log('【profile】请求分页参数:', {
                page,
                PAGE_SIZE,
                skip: page * PAGE_SIZE,
                limit: PAGE_SIZE
            });

            // 只有在首次加载时才显示骨架屏
            if (page === 0) {
                this.setData({
                    isLoading: true
                });
            }
            // 使用统一缓存封装（仅事件触发时失效）
            try {
                return getMyPosts({ page, pageSize: PAGE_SIZE, context: this })
                    .then((posts) => {
                        posts.forEach((post) => {
                            if (post.createTime) post.formattedCreateTime = this.formatTime(post.createTime);
                            if (post.imageUrls && post.imageUrls.length > 0) post.imageStyle = `height: 0; padding-bottom: 75%;`;
                        });
                        const newMyPosts = page === 0 ? posts : this.myPosts.concat(posts);
                        this.setData({ myPosts: newMyPosts, page: page + 1, hasMore: posts.length === PAGE_SIZE });
                    })
                    .catch((err) => {
                        console.error('profile 获取帖子失败:', err);
                        uni.showToast({ title: '网络异常', icon: 'none' });
                    })
                    .finally(() => {
                        this.setData({ isLoading: false });
                        if (typeof cb === 'function') cb();
                    });
            } catch (e) {}
            // 传递当前用户的openid给云函数
            const app = getApp();
            const currentOpenid = app && app.globalData && app.globalData.openid;
            
            this.$tcb.callFunction({
                name: 'getMyProfileData',
                data: {
                    skip: page * PAGE_SIZE,
                    limit: PAGE_SIZE,
                    openid: currentOpenid
                }
            }).then((res) => {
                if (res.result && res.result.success) {
                    const posts = res.result.posts || [];
                    console.log('【profile】本次返回帖子数量:', posts.length);
                    posts.forEach((post) => {
                        if (post.createTime) {
                            post.formattedCreateTime = this.formatTime(post.createTime);
                        }
                        // 为每个帖子设置默认的图片样式
                        if (post.imageUrls && post.imageUrls.length > 0) {
                            post.imageStyle = `height: 0; padding-bottom: 75%;`; // 4:3 宽高比占位
                        }
                    });

                    const newMyPosts = page === 0 ? posts : this.myPosts.concat(posts);
                    console.log('【profile】更新后 myPosts 长度:', newMyPosts.length, 'hasMore:', posts.length === PAGE_SIZE, 'page:', page + 1);
                    this.setData({
                        myPosts: newMyPosts,
                        page: page + 1,
                        hasMore: posts.length === PAGE_SIZE
                    });
                }
            }).catch((err) => {
                console.error('【profile】获取帖子失败:', err);
                uni.showToast({
                    title: '网络错误',
                    icon: 'none'
                });
            }).finally(() => {
                this.setData({
                    isLoading: false
                });
                if (typeof cb === 'function') {
                    cb();
                }
            });
        },

        // 根据生日计算年龄
        calculateAge: function (birthday) {
            if (!birthday) {
                return '';
            }
            try {
                const birth = new Date(birthday);
                if (isNaN(birth.getTime())) {
                    return '';
                }
                const now = new Date();
                let age = now.getFullYear() - birth.getFullYear();
                const m = now.getMonth() - birth.getMonth();
                if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
                    age--;
                }
                return age > 0 ? age : '';
            } catch (e) {
                console.log('CatchClause', e);
                console.log('CatchClause', e);
                console.error('计算年龄失败:', e);
                return '';
            }
        },

        // 格式化时间
        formatTime: function (dateString) {
            return formatRelativeTime(dateString);
        },

        // 点击帖子跳转详情
        navigateToPostDetail: function (e) {
            const postId = e.currentTarget.dataset.id;
            uni.navigateTo({
                url: `/pages/post-detail/post-detail?id=${postId}`
            });
        },

        // 删除帖子
        onDelete: function (event) {
            const postId = event.currentTarget.dataset.postid;
            const index = event.currentTarget.dataset.index;
            const that = this;
            uni.showModal({
                title: '删除帖子',
                content: '您确定要删除这条帖子吗？',
                confirmText: '删除',
                cancelText: '保存草稿',
                confirmColor: '#ff4d4f',
                success: function (res) {
                    if (res.confirm) {
                        // 直接删除
                        that.deletePost(postId, index);
                    } else {
                        // 保存草稿
                        that.saveToDraftBox(postId, index);
                    }
                }
            });
        },

        // 直接删除帖子
        deletePost: function (postId, index) {
            const that = this;
            uni.showLoading({
                title: '删除中...'
            });
            this.$tcb.callFunction({
                name: 'deletePost',
                data: {
                    postId: postId
                }
            }).then((res) => {
                uni.hideLoading();
                if (res.result && res.result.success) {
                    uni.showToast({
                        title: '删除成功'
                    });
                    const newList = that.myPosts.filter((post) => post._id !== postId);
                    that.setData({
                        myPosts: newList
                    });
                    // 新增：删除成功后设置首页需要刷新标记
                    try {
                        uni.setStorageSync('shouldRefreshIndex', true);
                    } catch (e) {
                        console.log('CatchClause', e);
                        console.log('CatchClause', e);
                    }
                } else {
                    uni.showToast({
                        title: '删除失败',
                        icon: 'none'
                    });
                }
            }).catch((err) => {
                uni.hideLoading();
                uni.showToast({
                    title: '调用失败',
                    icon: 'none'
                });
            });
        },

        // 保存到草稿箱
        saveToDraftBox: function (postId, index) {
            const that = this;
            uni.showLoading({
                title: '保存中...'
            });

            // 先获取帖子详情
            this.$tcb.callFunction({
                name: 'getPostDetail',
                data: {
                    postId: postId
                }
            }).then((res) => {
                if (res.result && res.result.post) {
                    const post = res.result.post;
                    const draftData = {
                        title: post.title || '',
                        content: post.content || '',
                        imageList: post.imageUrls
                            ? post.imageUrls.map((url) => ({
                                  previewUrl: url,
                                  compressedPath: url,
                                  originalPath: url,
                                  needCompression: false
                              }))
                            : [],
                        publishMode: post.isPoem ? 'poem' : 'normal',
                        isOriginal: post.isOriginal || false,
                        selectedTags: post.tags || [],
                        customTag: '',
                        author: post.author || '',
                        saveTime: new Date()
                    };

                    // 保存到草稿箱
                    const app = getApp();
                    const currentOpenid = app && app.globalData && app.globalData.openid;
                    
                    return this.$tcb.callFunction({
                        name: 'getMyProfileData',
                        data: {
                            action: 'saveDraft',
                            draftData: draftData,
                            openid: currentOpenid
                        }
                    });
                } else {
                    uni.hideLoading();
                    uni.showToast({
                        title: '获取帖子信息失败',
                        icon: 'none'
                    });
                    return Promise.reject('获取帖子信息失败');
                }
            }).then((draftRes) => {
                uni.hideLoading();
                if (draftRes.result && draftRes.result.success) {
                    uni.showToast({
                        title: '已保存到草稿箱',
                        icon: 'success'
                    });
                    // 删除原帖子
                    that.deletePost(postId, index);
                } else {
                    uni.showToast({
                        title: draftRes.result?.message || '保存草稿失败',
                        icon: 'none'
                    });
                }
            }).catch((err) => {
                uni.hideLoading();
                console.error('保存草稿失败:', err);
                uni.showToast({
                    title: '保存草稿失败',
                    icon: 'none'
                });
            });
        },

        updatePostCommentCount: function (postId, newCommentCount) {
            const postIndex = this.myPosts.findIndex((p) => p._id === postId);
            if (postIndex > -1) {
                this.setData({
                    [`myPosts[${postIndex}].commentCount`]: newCommentCount
                });
            }
        },

        // 图片预览
        handlePreview: function (event) {
            return previewImage(event);
        },

        // 阻止事件冒泡
        stopPropagation: function () {
            // 空函数，用于阻止事件冒泡
        },

        // 头像加载错误处理
        onAvatarError: function (e) {
            console.error('头像加载失败:', e);
            // 可以在这里设置默认头像
        },

        // 图片加载错误处理
        onImageError: function (e) {
            console.error('图片加载失败:', e.detail);
            const { src } = e.detail;
            console.error('失败的图片URL:', src);
            const { postindex, imgindex } = e.currentTarget.dataset;
            if (postindex !== undefined && imgindex !== undefined) {
                const post = this.myPosts[postindex];
                console.error('图片加载失败的上下文:', {
                    postId: post ? post._id : 'unknown',
                    postTitle: post ? post.title : 'unknown',
                    imageIndex: imgindex,
                    imageUrl: src
                });
            }
            // 不显示toast，避免频繁弹窗，但记录错误
            console.error('图片加载失败详情:', {
                error: e.detail,
                src: src,
                dataset: e.currentTarget.dataset
            });
        },

        // 测试图片URL有效性
        testImageUrls: function () {
            console.log('=== 开始测试图片URL有效性 ===');
            this.myPosts.forEach((post, index) => {
                console.log(`帖子${index + 1} (${post._id}):`);
                console.log('  - 标题:', post.title);
                console.log('  - 作者头像:', post.authorAvatar);
                console.log('  - 图片URLs:', post.imageUrls);
                console.log('  - 原图URLs:', post.originalImageUrls);
                if (post.imageUrls && post.imageUrls.length > 0) {
                    post.imageUrls.forEach((url, imgIndex) => {
                        console.log(`  - 图片${imgIndex + 1}:`, url);
                        // 检查URL格式
                        if (url && url.startsWith('http')) {
                            console.log(`    ✅ 格式正确 (HTTP URL)`);
                        } else if (url && url.startsWith('cloud://')) {
                            console.log(`    ⚠️ 格式为cloud:// (需要转换)`);
                        } else if (!url) {
                            console.log(`    ❌ URL为空`);
                        } else {
                            console.log(`    ? 未知格式: ${url}`);
                        }
                    });
                } else {
                    console.log('  - 无图片');
                }
                console.log('---');
            });
            console.log('=== 图片URL测试完成 ===');
        },

        // 切换侧边栏显示/隐藏
        toggleSidebar: function () {
            this.setData({
                isSidebarOpen: !this.isSidebarOpen
            });
        },

        // 跳转到我的点赞页面
        navigateToMyLikes: function () {
            uni.navigateTo({
                url: '/pages/my-likes/my-likes'
            });
        },

        navigateToFollowing: function () {
            uni.navigateTo({
                url: '/pages/following/following'
            });
        },

        navigateToFans: function () {
            uni.navigateTo({
                url: '/pages/fans/fans'
            });
        },

        // 跳转到编辑资料页面
        navigateToEditProfile: function () {
            uni.navigateTo({
                url: '/pages/profile-edit/profile-edit'
            });
        },

        // 跳转到收藏夹页面
        navigateToFavoriteFolders: function () {
            uni.navigateTo({
                url: '/pages/favorite-folders/favorite-folders'
            });
        },

        // 跳转到作品集页面
        navigateToPortfolio: function () {
            uni.navigateTo({
                url: '/pages/portfolio/portfolio'
            });
        },

        // 跳转到草稿箱页面
        navigateToDraftBox: function () {
            uni.navigateTo({
                url: '/pages/draft-box/draft-box'
            });
        },

        // 跳转到消息通知页面
        navigateToMessages: function () {
            uni.navigateTo({
                url: '/pages/messages/messages'
            });
        },

        // 检查未读消息数量
        checkUnreadMessages: function () {
            this.$tcb.callFunction({
                name: 'getUnreadMessageCount'
            }).then((res) => {
                if (res.result && res.result.success) {
                    this.setData({
                        unreadCount: res.result.count || 0
                    });
                }
            }).catch((err) => {
                console.error('获取未读消息失败:', err);
            });
            
            this.$tcb.callFunction({
                name: 'follow',
                data: {
                    action: 'getNewFollowerCount'
                }
            }).then((res) => {
                if (res.result && res.result.success) {
                    this.setData({
                        newFollowerCount: res.result.count || 0
                    });
                }
            }).catch((err) => {
                console.error('获取新粉丝数量失败:', err);
            });
        },

        // fetch follow/fan counters for current user
        fetchFollowCounts: function () {
            try {
                const p1 = this.$tcb.callFunction({ name: 'follow', data: { action: 'getFollowingList', skip: 0, limit: 1 } });
                const p2 = this.$tcb.callFunction({ name: 'follow', data: { action: 'getFollowerList', skip: 0, limit: 1 } });
                Promise.all([p1, p2])
                    .then(([res1, res2]) => {
                        const followingTotal = (res1 && res1.result && res1.result.total) || 0;
                        const followerTotal = (res2 && res2.result && res2.result.total) || 0;
                        this.setData({ followingCount: followingTotal, followerCount: followerTotal });
                    })
                    .catch((err) => { console.error('fetch follow stats failed:', err); });
            } catch (e) {
                console.error('fetchFollowCounts error:', e);
            }
        },

        // 新增：标签切换方法
        switchTab: function (e) {
            const tab = e.currentTarget.dataset.tab;
            console.log('【profile】切换到标签:', tab);
            if (tab === this.currentTab) {
                return;
            } // 如果是当前标签，不做任何操作

            this.setData({
                currentTab: tab
            });
            if (tab === 'favorites' && this.favoriteList.length === 0) {
                // 首次加载收藏数据
                this.loadFavorites();
            }
        },

        // 新增：加载收藏列表
        loadFavorites: function (cb) {
            // 移除阻止重复调用的条件判断，允许在onShow时刷新数据
            // if (this.data.favoriteLoading) return;

            const { favoritePage, PAGE_SIZE } = this;
            console.log('【profile】请求收藏分页参数:', {
                favoritePage,
                PAGE_SIZE,
                skip: favoritePage * PAGE_SIZE,
                limit: PAGE_SIZE
            });
            this.setData({
                favoriteLoading: true
            });
            // 使用统一缓存封装我的收藏，仅在收藏变更事件时失效
            try {
                return getMyFavorites({ page: favoritePage, pageSize: PAGE_SIZE, context: this })
                    .then((favorites) => {
                        (favorites || []).forEach((favorite) => {
                            if (favorite.favoriteTime) favorite.formattedFavoriteTime = this.formatTime(favorite.favoriteTime);
                            if (favorite.imageUrls && favorite.imageUrls.length > 0) favorite.imageStyle = `height: 0; padding-bottom: 75%;`;
                        });
                        const newFavoriteList = favoritePage === 0 ? favorites : this.favoriteList.concat(favorites || []);
                        this.setData({
                            favoriteList: newFavoriteList,
                            favoritePage: favoritePage + 1,
                            favoriteHasMore: (favorites || []).length === PAGE_SIZE
                        });
                    })
                    .catch((err) => {
                        console.error('profile 获取收藏失败:', err);
                        uni.showToast({ title: '网络异常', icon: 'none' });
                    })
                    .finally(() => {
                        this.setData({ favoriteLoading: false });
                        if (typeof cb === 'function') cb();
                    });
            } catch (e) {}
            // 传递当前用户的openid给云函数
            const app = getApp();
            const currentOpenid = app && app.globalData && app.globalData.openid;
            
            this.$tcb.callFunction({
                name: 'getMyProfileData',
                data: {
                    action: 'getAllFavorites',
                    skip: favoritePage * PAGE_SIZE,
                    limit: PAGE_SIZE,
                    openid: currentOpenid
                }
            }).then((res) => {
                console.log('【profile】获取收藏返回:', res);
                if (res.result && res.result.success) {
                    const favorites = res.result.favorites || [];
                    console.log('【profile】本次返回收藏数量:', favorites.length);

                    // 格式化时间和设置图片样式
                    favorites.forEach((favorite) => {
                        if (favorite.favoriteTime) {
                            favorite.formattedFavoriteTime = this.formatTime(favorite.favoriteTime);
                        }
                        // 为每个收藏的帖子设置默认的图片样式
                        if (favorite.imageUrls && favorite.imageUrls.length > 0) {
                            favorite.imageStyle = `height: 0; padding-bottom: 75%;`; // 4:3 宽高比占位
                        }
                    });

                    const newFavoriteList = favoritePage === 0 ? favorites : this.favoriteList.concat(favorites);
                    console.log(
                        '【profile】更新后收藏列表长度:',
                        newFavoriteList.length,
                        'favoriteHasMore:',
                        favorites.length === PAGE_SIZE,
                        'favoritePage:',
                        favoritePage + 1
                    );
                    this.setData({
                        favoriteList: newFavoriteList,
                        favoritePage: favoritePage + 1,
                        favoriteHasMore: favorites.length === PAGE_SIZE
                    });
                } else {
                    uni.showToast({
                        title: res.result?.message || '加载收藏失败',
                        icon: 'none'
                    });
                }
            }).catch((err) => {
                console.error('【profile】获取收藏失败:', err);
                uni.showToast({
                    title: '网络错误',
                    icon: 'none'
                });
            }).finally(() => {
                this.setData({
                    favoriteLoading: false
                });
                if (typeof cb === 'function') {
                    cb();
                }
            });
        },

        // 新增：收藏项跳转到帖子详情
        navigateToFavoriteDetail: function (e) {
            const postId = e.currentTarget.dataset.id;
            uni.navigateTo({
                url: `/pages/post-detail/post-detail?id=${postId}`
            });
        },

        // 新增：取消收藏
        removeFavorite: function (e) {
            const favoriteId = e.currentTarget.dataset.favoriteId;
            const index = e.currentTarget.dataset.index;
            const that = this;
            uni.showModal({
                title: '确认取消收藏',
                content: '确定要取消收藏这个内容吗？',
                success: function (res) {
                    if (res.confirm) {
                        uni.showLoading({
                            title: '取消收藏中...'
                        });
                        // 传递当前用户的openid给云函数
                        const app = getApp();
                        const currentOpenid = app && app.globalData && app.globalData.openid;
                        
                        that.callCloudFunction('getMyProfileData', {
                            action: 'removeFromFavorite',
                            favoriteId: favoriteId,
                            openid: currentOpenid
                        }).then((res) => {
                            uni.hideLoading();
                            if (res.result && res.result.success) {
                                uni.showToast({
                                    title: '已取消收藏'
                                });
                                // 从列表中移除该项
                                const newList = that.favoriteList.filter((item, i) => i !== index);
                                that.setData({
                                    favoriteList: newList
                                });
                                try {
                                    const appInstance = getApp();
                                    const userId = appInstance && appInstance.globalData && appInstance.globalData.openid;
                                    const removed = that.favoriteList[index];
                                    const postId = removed && (removed._id || removed.postId);
                                    const { emitFavoriteChanged } = require('@/utils/events.js');
                                    emitFavoriteChanged({ userId, postId, favored: false });
                                } catch (e) {}
                            } else {
                                uni.showToast({
                                    title: '取消收藏失败',
                                    icon: 'none'
                                });
                            }
                        }).catch((err) => {
                            uni.hideLoading();
                            uni.showToast({
                                title: '操作失败',
                                icon: 'none'
                            });
                        });
                    }
                }
            });
        },

        // 新增：返回上一页
        navigateBack: function () {
            uni.navigateBack();
        },

        // 新增：跳转到图片管理页面
        navigateToImageManager: function () {
            uni.navigateTo({
                url: '/pages/image-manager/image-manager'
            });
        },

        // 跳转到意见反馈页面
        navigateToFeedback: function () {
            uni.navigateTo({
                url: '/pages/feedback/feedback'
            });
        },

        // 跳转到反馈管理页面（管理员）
        navigateToFeedbackAdmin: function () {
            uni.navigateTo({
                url: '/pages/feedback-admin/feedback-admin'
            });
        },

        // 显示退出登录确认对话框
        showLogoutConfirm: function () {
            // 先关闭侧边栏，避免遮挡确认对话框
            if (this.isSidebarOpen) {
                this.isSidebarOpen = false;
            }
            
            // 延迟显示对话框，确保侧边栏关闭动画完成
            setTimeout(() => {
                uni.showModal({
                    title: '退出登录',
                    content: '确定要退出登录吗？',
                    confirmText: '退出',
                    cancelText: '取消',
                    confirmColor: '#ff6b6b',
                    success: (res) => {
                        if (res.confirm) {
                            this.performLogout();
                        }
                    }
                });
            }, 100);
        },

        // 执行退出登录
        performLogout: async function () {
            console.log('🔍 [退出登录] 开始执行退出登录流程');
            
            try {
                // 先清空所有缓存（包含 me:favorites 等命名空间与 fileUrlCache）
                try { await resetAllCachesOnAccountChange({}); } catch (e) { console.warn('cache reset on logout failed', e); }
                // 清除本地存储的用户信息
                uni.removeStorageSync('userInfo');
                uni.removeStorageSync('userOpenId');
                
                // 清除全局数据
                const app = getApp();
                if (app && app.globalData) {
                    app.globalData.userInfo = null;
                    app.globalData.openid = null;
                    app.globalData._loginProcessCompleted = false; // 重置登录流程标记
                }
                
                // 清除当前页面的用户数据
                this.setData({
                    userInfo: null,
                    myPosts: [],
                    favoriteList: [],
                    isLoading: false,
                    isSidebarOpen: false
                });
                
                console.log('✅ [退出登录] 本地数据清除完成');
                
                // 重新初始化匿名openid，确保用户可以重新登录
                this.reinitializeAnonymousOpenid();
                
                // 显示退出成功提示
                uni.showToast({
                    title: '已退出登录',
                    icon: 'success',
                    duration: 1500
                });
                
                // 延迟跳转到登录页面
                setTimeout(() => {
                    uni.redirectTo({
                        url: '/pages/login/login'
                    });
                }, 1500);
                
            } catch (error) {
                console.error('❌ [退出登录] 退出登录失败:', error);
                uni.showToast({
                    title: '退出失败，请重试',
                    icon: 'none'
                });
            }
        },

        // 重新初始化匿名openid
        reinitializeAnonymousOpenid: function () {
            console.log('🔄 [退出登录] 重新初始化匿名openid');
            
            // 调用login云函数获取新的匿名openid
            this.$tcb.callFunction({
                name: 'login'
            }).then((loginRes) => {
                console.log('✅ [退出登录] 匿名openid初始化成功:', loginRes);
                
                // 获取openid
                let openid = null;
                if (loginRes.result && loginRes.result.openid) {
                    openid = loginRes.result.openid;
                } else if (loginRes.openid) {
                    openid = loginRes.openid;
                } else if (loginRes.result && loginRes.result.uid) {
                    openid = loginRes.result.uid;
                }
                
                if (openid) {
                    // 更新全局数据
                    const app = getApp();
                    if (app && app.globalData) {
                        app.globalData.openid = openid;
                        console.log('✅ [退出登录] 匿名openid已设置:', openid);
                    }
                    
                    // 缓存openid
                    uni.setStorageSync('userOpenId', openid);
                } else {
                    console.error('❌ [退出登录] 无法获取匿名openid');
                }
            }).catch((error) => {
                console.error('❌ [退出登录] 匿名openid初始化失败:', error);
                // 即使失败也不影响退出登录流程
            });
        },

        // 滚动到底部触发加载更多
        onScrollToLower: function () {
            console.log('【profile】滚动到底部，当前标签:', this.currentTab);
            if (this.currentTab === 'posts') {
                // 我的帖子标签页
                if (this.hasMore && !this.isLoadingMore && !this.isLoading) {
                    console.log('【profile】开始加载更多帖子');
                    this.setData({
                        isLoadingMore: true
                    });
                    this.loadMyPosts(() => {
                        this.setData({
                            isLoadingMore: false
                        });
                        console.log('【profile】加载更多帖子完成');
                    });
                }
            } else if (this.currentTab === 'favorites') {
                // 收藏标签页
                if (this.favoriteHasMore && !this.favoriteLoading) {
                    console.log('【profile】开始加载更多收藏');
                    this.loadFavorites(() => {
                        console.log('【profile】加载更多收藏完成');
                    });
                }
            }
        },

        onAvatarLoad() {
            console.log('占位：函数 onAvatarLoad 未声明');
        },

        navigateToUserProfile() {
            console.log('占位：函数 navigateToUserProfile 未声明');
        },

        onTagClick() {
            console.log('占位：函数 onTagClick 未声明');
        },

        // 统一云函数调用方法
        callCloudFunction(name, data = {}, extraOptions = {}) {
            return cloudCall(name, data, Object.assign({ pageTag: 'profile', context: this, requireAuth: true }, extraOptions));
        }
    }
};
</script>
<style>
/* pages/profile/profile.wxss */
.container {
    width: 100%;
    height: 100vh;
    background-color: #ffffff;
}

.scroll-container {
    width: 100%;
    height: 100%;
}

.sidebar-mask {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    z-index: 999;
}

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

.sidebar-menu {
    margin-top: 40rpx;
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

/* 未读消息标记 */
.unread-badge {
    background-color: #ff6b6b;
    color: #fff;
    font-size: 20rpx;
    padding: 4rpx 10rpx;
    border-radius: 20rpx;
    min-width: 32rpx;
    text-align: center;
    font-weight: bold;
}

/* 退出登录按钮特殊样式 */
.logout-item {
    border-top: 2rpx solid #f0f0f0;
    margin-top: 20rpx;
    color: #ff6b6b !important;
    font-weight: 500;
}

.logout-item:active {
    background-color: #fff5f5 !important;
}

.main-content {
    width: 100%;
    /* height: 100vh; */
    background-color: #ffffff;
    /* overflow-y: auto; */
    padding-bottom: 100rpx; /* 为底部TabBar留出空间 */
}

.header {
    display: flex;
    align-items: center;
    padding: 20rpx 30rpx;
    background-color: #fff;
    border-bottom: 1rpx solid #eee;
    padding-top: calc(20rpx + var(--status-bar-height, 0px));
}

.menu-btn {
    width: 48rpx;
    height: 48rpx;
    padding: 10rpx;
    transition: opacity 0.2s ease;
}

.menu-btn:active {
    opacity: 0.7;
}

.header-title {
    flex: 1;
    text-align: center;
    font-size: 34rpx;
    font-weight: 500;
    margin-right: 68rpx; /* to balance the menu button */
}

/* Loading State */
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

.profile-avatar {
    margin-right: 30rpx;
}

.profile-avatar image {
    width: 120rpx;
    height: 120rpx;
    border-radius: 50%;
}

.profile-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0; /* 防止flex子元素溢出 */
}

.profile-name {
    font-size: 36rpx;
    font-weight: bold;
    color: #333;
    margin-bottom: 10rpx;
    word-break: break-word;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.profile-bio {
    font-size: 28rpx;
    color: #999;
    margin-bottom: 20rpx;
    line-height: 1.4;
    word-break: break-word;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
}

.profile-details {
    display: flex;
    flex-direction: column;
    gap: 8rpx;
}

.detail-item {
    font-size: 26rpx;
    color: #666;
    word-break: break-word;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

/* Tab Navigation */
.tab-navigation {
    margin: 0 30rpx 20rpx 30rpx;
    display: flex;
    background: #fff;
    border-radius: 16rpx;
    box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.05);
    overflow: hidden;
}

.tab-item {
    flex: 1;
    padding: 30rpx 20rpx;
    text-align: center;
    font-size: 28rpx;
    color: #666;
    background: #fff;
    transition: all 0.3s ease;
    position: relative;
}

.tab-item.active {
    color: #9ed7ee;
    font-weight: 500;
    background: #f8fffe;
}

.tab-item.active::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 20%;
    right: 20%;
    height: 4rpx;
    background: #9ed7ee;
    border-radius: 2rpx;
}

.tab-item:active {
    background: #f5f5f5;
}

/* My Posts Section */
.my-posts-section {
    margin: 0 30rpx 30rpx 30rpx;
}

/* Favorites Section */
.favorites-section {
    margin: 0 30rpx 30rpx 30rpx;
}

.section-title {
    font-size: 32rpx;
    font-weight: bold;
    color: #333;
    margin-bottom: 20rpx;
    padding: 0 10rpx;
}

/* 新增：帖子项包装器样式 */
.post-item-wrapper {
    background: #fff;
    border-radius: 16rpx;
    margin-bottom: 20rpx;
    padding: 30rpx;
    box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);
}

/* 原创帖子特殊样式 */
.post-item-wrapper.original-post {
    border: 3rpx solid #ebc88d;
    box-shadow: 0 4rpx 20rpx rgba(235, 200, 141, 0.3), 0 2rpx 12rpx rgba(0, 0, 0, 0.06);
    position: relative;
}

/* 原创帖子光影效果 */
.post-item-wrapper.original-post::before {
    content: '';
    position: absolute;
    top: -2rpx;
    left: -2rpx;
    right: -2rpx;
    bottom: -2rpx;
    background: linear-gradient(45deg, #ebc88d, #f4d03f, #ebc88d);
    border-radius: 18rpx;
    z-index: -1;
    opacity: 0.6;
    filter: blur(8rpx);
}

/* 新增：内容导航器样式 */
.post-content-navigator {
    display: block;
    background: transparent;
}

/* 新增：导航器点击效果 */
.navigator-hover {
    background-color: rgba(0, 0, 0, 0.02);
}

/* 外部作者信息样式 */
.author-info-outside {
    display: flex;
    align-items: center;
    padding: 20rpx 30rpx 10rpx 30rpx;
    background: #fff;
    border-radius: 16rpx 16rpx 0 0;
    box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.05);
}

.author-info-outside .author-avatar {
    width: 60rpx;
    height: 60rpx;
    border-radius: 50%;
    margin-right: 15rpx;
    background-color: #f5f5f5;
    cursor: pointer;
}

.author-info-outside .author-name {
    font-size: 28rpx;
    color: #333;
    font-weight: 500;
}

.post-item {
    width: 100%;
    background: #fff;
    border-radius: 0 0 16rpx 16rpx;
    box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.05);
    box-sizing: border-box;
    padding: 20rpx 30rpx 30rpx 30rpx;
}

.post-title {
    font-size: 36rpx;
    font-weight: bold;
    color: #333333;
    margin-bottom: 15rpx;
    line-height: 1.4;
    word-break: break-word;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
}

/* 诗歌作者样式 */
.poem-author {
    font-size: 32rpx;
    color: #000;
    text-align: center;
    margin: 5rpx 0 15rpx 0;
    letter-spacing: 2rpx;
}

/* 新增：图片容器占位样式 */
.image-container-wrapper {
    position: relative;
    width: 100%;
    background-color: #f0f0f0; /* 占位时的背景色，很重要 */
    overflow: hidden;
    border-radius: 8px; /* 可以加个圆角，让占位块更好看 */
    margin: 20rpx 0; /* 图片和下方内容的间距 */
}

/* 新增：让图片或swiper填充整个占位容器 */
.image-container-wrapper .post-image,
.image-container-wrapper .image-swiper {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
}

/* 多张图片的swiper样式 */
.image-swiper {
    width: 100%;
    background-color: #fff;
    /* 高度由 style 绑定动态设置 */
}

.swiper-item {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
}

.post-image {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: contain;
}

.post-image:active {
    transform: scale(1.05);
}

.post-content {
    font-size: 28rpx;
    color: #666666;
    line-height: 1.6;
    margin-top: 15rpx;
    word-break: break-word;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
}

/* 删除按钮区域样式 */
.delete-section {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 20rpx;
    padding-top: 20rpx;
    border-top: 1rpx solid #f0f0f0;
}

/* 左侧时间区域，保持原有样式 */

.button-group {
    display: flex;
    align-items: center;
}

.favorite-time,
.post-time {
    font-size: 24rpx;
    color: #999;
}

/* 标签样式 */
.post-tags {
    margin-top: 30rpx;
    margin-bottom: 10rpx;
    line-height: 1.5;
}

.post-tag {
    color: #24375f;
    font-size: 26rpx;
    margin-right: 10rpx;
    transition: all 0.2s ease;
    cursor: pointer;
}

.post-tag:active {
    color: #1a2a4a;
    opacity: 0.8;
}

.delete-btn {
    background-color: #ff4757;
    color: #fff;
    border: none;
    border-radius: 8rpx;
    font-size: 24rpx;
    padding: 8rpx 16rpx;
    line-height: 1.2;
    min-width: 80rpx;
    transition: background-color 0.2s ease;
}

.delete-btn:active {
    background-color: #e63946;
}

.delete-btn::after {
    border: none;
}

.remove-favorite-btn {
    background-color: #f39c12;
    color: #fff;
    border: none;
    border-radius: 8rpx;
    font-size: 24rpx;
    padding: 8rpx 16rpx;
    line-height: 1.2;
    min-width: 100rpx;
    transition: background-color 0.2s ease;
}

.remove-favorite-btn:active {
    background-color: #e67e22;
}

.remove-favorite-btn::after {
    border: none;
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

.author-info {
    display: flex;
    align-items: center;
    /* margin-bottom: 15rpx;  // 移除多余的间距 */
}

.author-avatar {
    width: 60rpx;
    height: 60rpx;
    border-radius: 50%;
    margin-right: 15rpx;
    background-color: #f5f5f5;
}

.author-name {
    font-size: 28rpx;
    color: #333;
    font-weight: 500;
}

.profile-card-center {
    position: relative;
    margin: 30rpx;
    padding: 60rpx 40rpx 40rpx 40rpx;
    background-color: #fff;
    border-radius: 16rpx;
    box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.05);
    display: flex;
    flex-direction: column;
    align-items: center;
    overflow: visible;
}
.menu-btn-large {
    position: absolute;
    top: 24rpx;
    left: 24rpx;
    width: 56rpx;
    height: 56rpx;
    z-index: 100;
    background: none;
    filter: grayscale(1) brightness(0.5);
    opacity: 0.7;
}

.back-btn {
    position: absolute;
    top: 24rpx;
    left: 24rpx;
    width: 56rpx;
    height: 56rpx;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.1);
    border-radius: 50%;
    font-size: 36rpx;
    color: #333;
    transition: background-color 0.2s ease;
}

.back-btn:active {
    background: rgba(0, 0, 0, 0.2);
}
.profile-avatar-large image {
    width: 150rpx;
    height: 150rpx;
    border-radius: 50%;
    display: block;
    margin: 0 auto;
}
.profile-info-center {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-top: 20rpx;
}
.profile-name-center {
    font-size: 40rpx;
    font-weight: bold;
    color: #333;
    margin-bottom: 10rpx;
    text-align: center;
}
  .profile-bio-center {
      font-size: 28rpx;
      color: #999;
      text-align: center;
      margin-bottom: 0;
  }
  .profile-meta-center {
      font-size: 26rpx;
      color: #666;
      margin-top: 8rpx;
      text-align: center;
  }
.profile-detail-card {
    margin: 0 30rpx 30rpx 30rpx;
    padding: 30rpx 40rpx;
    background-color: #fff;
    border-radius: 16rpx;
    box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.05);
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    gap: 40rpx;
}
.detail-item-inline {
    font-size: 28rpx;
    color: #666;
    margin-right: 20rpx;
    white-space: nowrap;
}

/* 底部加载状态样式 */
.loading-footer {
    text-align: center;
    padding: 20rpx 0;
    color: #999;
    font-size: 14px;
}

.unread-dot {
    width: 16rpx;
    height: 16rpx;
    background-color: #ff6b6b;
    border-radius: 50%;
    margin-left: 12rpx;
}

/* Follow stats under bio */
.follow-stats {
    margin-top: 16rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 40rpx;
}
.stat-item {
    display: flex;
    flex-direction: column;
    align-items: center;
}
.stat-number {
    font-size: 36rpx;
    font-weight: 600;
    color: #333;
}
.stat-label {
    margin-top: 4rpx;
    font-size: 24rpx;
    color: #888;
}
.stat-divider {
    width: 1rpx;
    height: 36rpx;
    background-color: #eee;
}
</style>
