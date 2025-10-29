<template>
    <view>
        <!-- index.wxml -->
        <view class="container">

            <!-- 页面切换栏 -->
        <page-tabs ref="pageTabs" :current-tab="currentTab" @tab-change="onTabChange"></page-tabs>

            <!-- 骨架屏：当 isLoading 为 true 时显示 -->
            <view v-if="isLoading">
                <skeleton pageType="index" />
            </view>

            <!-- 真实内容：当 isLoading 为 false 时显示 -->
            <view v-else class="square-mode-container">
                <!-- 使用swiper实现滑动切换 -->
                <swiper 
                    class="page-swiper" 
                    :current="swiperCurrent" 
                    @change="onSwiperChange"
                    :duration="300"
                    :disable-touch="false"
                    :circular="false"
                    :indicator-dots="false"
                    :autoplay="false"
                >
                    <!-- 广场页 -->
                    <swiper-item>
                        <view class="swiper-page">
                            <view v-if="postList.length === 0 && !isLoading" class="empty-state">
                                <view class="empty-icon">📝</view>
                                <view class="empty-text">还没有帖子哦～</view>
                                <view class="empty-subtext">快来发布第一条帖子吧！</view>
                            </view>
                            <!-- 给你的帖子列表循环的父容器添加一个ID -->
                            <view id="post-list-container">
                                <!-- 主页帖子列表 -->
                                <view :class="'post-item-wrapper ' + (item.isOriginal ? 'original-post' : '')" v-for="(item, index) in postList" :key="index">
                            <!-- 作者信息 -->

                            <view class="author-info-outside">
                                <image
                                    class="author-avatar"
                                    :src="item.isAnonymous ? '/static/images/avatar.png' : (item.authorAvatar || '/static/images/avatar.png')"
                                    mode="aspectFill"
                                    @error="onAvatarError"
                                    @load="onAvatarLoad"
                                    :data-postindex="index"
                                    @tap.stop.prevent="navigateToUserProfile"
                                    :data-user-id="item._openid"
                                    :data-author-name="item.authorName"
                                    :data-is-anonymous="item.isAnonymous"
                                ></image>
                                <text class="author-name">{{ item.isAnonymous ? '匿名用户' : item.authorName }}</text>
                            </view>

                            <!-- 可点击的内容区域 - 跳转到详情页 -->

                            <navigator class="post-content-navigator" :url="'/pages/post-detail/post-detail?id=' + item._id" hover-class="navigator-hover">
                                <view class="post-item">
                                    <view class="post-title">{{ item.title }}</view>

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
                                                class="post-image"
                                                :src="item.imageUrls[0]"
                                                mode="aspectFill"
                                                :lazy-load="true"
                                                @error="onImageError"
                                                @tap.stop.prevent="handlePreview"
                                                :data-src="item.imageUrls[0]"
                                                :data-original-image-urls="item.originalImageUrls || item.imageUrls"
                                            />
                                        </block>

                                        <!-- 多张图片 -->
                                        <block v-else-if="item.imageUrls.length > 1">
                                            <swiper class="image-swiper" :indicator-dots="true" :circular="true">
                                                <block v-for="(img, index1) in item.imageUrls" :key="index1">
                                                    <swiper-item>
                                                        <image
                                                            class="post-image"
                                                            :src="img"
                                                            mode="aspectFill"
                                                            :lazy-load="true"
                                                            @error="onImageError"
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

                                    <!-- 标签显示 -->
                                    <view v-if="item.tags && item.tags.length > 0" class="post-tags">
                                        <text class="post-tag" @tap.stop.prevent="onTagClick" :data-tag="item" v-for="(item, index1) in item.tags" :key="index1">#{{ item }}</text>
                                    </view>
                                </view>
                            </navigator>

                            <!-- 独立的互动区域 - 不触发详情页跳转 -->

                            <view class="vote-section">
                                <view class="actions-left">
                                    <!-- 左侧留空，保持布局平衡 -->
                                </view>
                                <view class="button-group">
                                    <view class="comment-count" @tap.stop.prevent="onCommentClick" :data-postid="item._id">
                                        <image class="comment-icon" src="/static/images/comment.png" mode="aspectFit" />
                                        <text class="action-text">{{ item.commentCount || 0 }}</text>
                                    </view>
                                    <view
                                        class="like-icon-container"
                                        @tap.stop.prevent="onVote"
                                        :data-postid="item._id"
                                        :data-index="index"
                                        data-list-type="home"
                                    >
                                        <image class="like-icon" :src="item.likeIcon || '/static/images/seed.png'" mode="aspectFit" @error="onLikeIconError"></image>
                                    </view>
                                    <view :class="'vote-count ' + (item.isVoted ? 'voted' : '')">
                                        <text class="action-text">{{ item.votes || 0 }}</text>
                                    </view>
                                </view>
                            </view>
                        </view>
                            </view>
                        </view>
                    </swiper-item>

                    <!-- 关注页 -->
                    <swiper-item>
                        <view class="swiper-page">
                            <!-- 关注页骨架屏：当 followingIsLoading 为 true 时显示 -->
                            <view v-if="followingIsLoading">
                                <skeleton pageType="index" />
                            </view>
                            
                            <!-- 真实内容：当 followingIsLoading 为 false 时显示 -->
                            <view v-else>
                            <view id="following-list-container">
                            <view v-if="followingPostList.length === 0" class="empty-state">
                                <view class="empty-icon">👥</view>
                                <view class="empty-text">关注的人还没有发帖</view>
                                <view class="empty-subtext">去关注更多有趣的人吧！</view>
                            </view>
                            <view :class="'post-item-wrapper ' + (item.isOriginal ? 'original-post' : '')" v-for="(item, index) in followingPostList" :key="index">
                                <!-- 作者信息 -->
                                <view class="author-info-outside">
                                    <image
                                        class="author-avatar"
                                        :src="item.isAnonymous ? '/static/images/avatar.png' : (item.authorAvatar || '/static/images/avatar.png')"
                                        mode="aspectFill"
                                        @error="onAvatarError"
                                        @load="onAvatarLoad"
                                        :data-postindex="index"
                                        @tap.stop.prevent="navigateToUserProfile"
                                        :data-user-id="item._openid"
                                        :data-author-name="item.authorName"
                                        :data-is-anonymous="item.isAnonymous"
                                    ></image>
                                    <text class="author-name">{{ item.isAnonymous ? '匿名用户' : item.authorName }}</text>
                                </view>

                                <!-- 可点击的内容区域 - 跳转到详情页 -->
                                <navigator class="post-content-navigator" :url="'/pages/post-detail/post-detail?id=' + item._id" hover-class="navigator-hover">
                                    <view class="post-item">
                                        <view class="post-title">{{ item.title }}</view>

                                        <!-- 图片显示逻辑 -->
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
                                                    class="post-image"
                                                    :src="item.imageUrls[0]"
                                                    mode="aspectFill"
                                                    :lazy-load="true"
                                                    @error="onImageError"
                                                    @tap.stop.prevent="handlePreview"
                                                    :data-src="item.imageUrls[0]"
                                                    :data-original-image-urls="item.originalImageUrls || item.imageUrls"
                                                />
                                            </block>

                                            <!-- 多张图片 -->
                                            <block v-else-if="item.imageUrls.length > 1">
                                                <swiper class="image-swiper" :indicator-dots="true" :circular="true">
                                                    <block v-for="(img, imgIndex) in item.imageUrls" :key="imgIndex">
                                                        <swiper-item>
                                                            <image
                                                                class="post-image"
                                                                :src="img"
                                                                mode="aspectFill"
                                                                :lazy-load="true"
                                                                @error="onImageError"
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

                                        <!-- 标签显示 -->
                                        <view v-if="item.tags && item.tags.length > 0" class="post-tags">
                                            <text class="post-tag" @tap.stop.prevent="onTagClick" :data-tag="item" v-for="(item, index1) in item.tags" :key="index1">#{{ item }}</text>
                                        </view>
                                    </view>
                                </navigator>

                                <!-- 独立的互动区域 -->
                                <view class="vote-section">
                                    <view class="actions-left">
                                        <!-- 左侧留空，保持布局平衡 -->
                                    </view>
                                    <view class="button-group">
                                        <view class="comment-count" @tap.stop.prevent="onCommentClick" :data-postid="item._id">
                                            <image class="comment-icon" src="/static/images/comment.png" mode="aspectFit" />
                                            <text class="action-text">{{ item.commentCount || 0 }}</text>
                                        </view>
                                        <view
                                            class="like-icon-container"
                                            @tap.stop.prevent="onVote"
                                            :data-postid="item._id"
                                            :data-index="index"
                                            data-list-type="following"
                                        >
                                            <image class="like-icon" :src="item.likeIcon || '/static/images/seed.png'" mode="aspectFit" @error="onLikeIconError"></image>
                                        </view>
                                        <view :class="'vote-count ' + (item.isVoted ? 'voted' : '')">
                                            <text class="action-text">{{ item.votes || 0 }}</text>
                                        </view>
                                    </view>
                                </view>
                            </view>
                            </view>
                            </view>
                        </view>
                    </swiper-item>

                    <!-- 讨论页 -->
                    <swiper-item>
                        <view class="swiper-page">
                            <!-- 讨论页骨架屏：当 discussionIsLoading 为 true 时显示 -->
                            <view v-if="discussionIsLoading">
                                <skeleton pageType="index" />
                            </view>
                            
                            <!-- 真实内容：当 discussionIsLoading 为 false 时显示 -->
                            <view v-else>
                            <view id="discussion-list-container">
                            <view v-if="discussionPostList.length === 0" class="empty-state">
                                <view class="empty-icon">💬</view>
                                <view class="empty-text">讨论区暂无内容</view>
                                <view class="empty-subtext">快来发起第一个话题吧！</view>
                            </view>
                            <view :class="'post-item-wrapper ' + (item.isOriginal ? 'original-post' : '')" v-for="(item, index) in discussionPostList" :key="index">
                                <!-- 作者信息 -->
                                <view class="author-info-outside">
                                    <image
                                        class="author-avatar"
                                        :src="item.isAnonymous ? '/static/images/avatar.png' : (item.authorAvatar || '/static/images/avatar.png')"
                                        mode="aspectFill"
                                        @error="onAvatarError"
                                        @load="onAvatarLoad"
                                        :data-postindex="index"
                                        @tap.stop.prevent="navigateToUserProfile"
                                        :data-user-id="item._openid"
                                        :data-author-name="item.authorName"
                                        :data-is-anonymous="item.isAnonymous"
                                    ></image>
                                    <text class="author-name">{{ item.isAnonymous ? '匿名用户' : item.authorName }}</text>
                                </view>

                                <!-- 可点击的内容区域 - 跳转到详情页 -->
                                <navigator class="post-content-navigator" :url="'/pages/post-detail/post-detail?id=' + item._id" hover-class="navigator-hover">
                                    <view class="post-item">
                                        <view class="post-title">{{ item.title }}</view>

                                        <!-- 图片显示逻辑 -->
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
                                                    class="post-image"
                                                    :src="item.imageUrls[0]"
                                                    mode="aspectFill"
                                                    :lazy-load="true"
                                                    @error="onImageError"
                                                    @tap.stop.prevent="handlePreview"
                                                    :data-src="item.imageUrls[0]"
                                                    :data-original-image-urls="item.originalImageUrls || item.imageUrls"
                                                />
                                            </block>

                                            <!-- 多张图片 -->
                                            <block v-else-if="item.imageUrls.length > 1">
                                                <swiper class="image-swiper" :indicator-dots="true" :circular="true">
                                                    <block v-for="(img, imgIndex) in item.imageUrls" :key="imgIndex">
                                                        <swiper-item>
                                                            <image
                                                                class="post-image"
                                                                :src="img"
                                                                mode="aspectFill"
                                                                :lazy-load="true"
                                                                @error="onImageError"
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

                                        <!-- 标签显示 -->
                                        <view v-if="item.tags && item.tags.length > 0" class="post-tags">
                                            <text class="post-tag" @tap.stop.prevent="onTagClick" :data-tag="item" v-for="(item, index1) in item.tags" :key="index1">#{{ item }}</text>
                                        </view>
                                    </view>
                                </navigator>

                                <!-- 独立的互动区域 -->
                                <view class="vote-section">
                                    <view class="actions-left">
                                        <!-- 左侧留空，保持布局平衡 -->
                                    </view>
                                    <view class="button-group">
                                        <view class="comment-count" @tap.stop.prevent="onCommentClick" :data-postid="item._id">
                                            <image class="comment-icon" src="/static/images/comment.png" mode="aspectFit" />
                                            <text class="action-text">{{ item.commentCount || 0 }}</text>
                                        </view>
                                        <view
                                            class="like-icon-container"
                                            @tap.stop.prevent="onVote"
                                            :data-postid="item._id"
                                            :data-index="index"
                                            data-list-type="discussion"
                                        >
                                            <image class="like-icon" :src="item.likeIcon || '/static/images/seed.png'" mode="aspectFit" @error="onLikeIconError"></image>
                                        </view>
                                        <view :class="'vote-count ' + (item.isVoted ? 'voted' : '')">
                                            <text class="action-text">{{ item.votes || 0 }}</text>
                                        </view>
                                    </view>
                                </view>
                            </view>
                            </view>
                            </view>
                        </view>
                    </swiper-item>
                </swiper>

                <!-- 在容器外部，页面的最底部添加加载提示 -->
                <view class="loading-footer">
                    <block v-if="currentPage === 'home' && !hasMore && postList.length > 0">
                        <text>--- 我是有底线的 ---</text>
                    </block>
                    <block v-else-if="currentPage === 'following' && !followingHasMore && followingPostList.length > 0">
                        <view class="discover-end-tip">
                            <text class="end-text">--- 没有更多了 ---</text>
                            <view class="refresh-tip">
                                <text class="refresh-text">下拉刷新获取新的关注内容</text>
                            </view>
                        </view>
                    </block>
                    <block v-else-if="currentPage === 'discussion' && !discussionHasMore && discussionPostList.length > 0">
                        <text>--- 没有更多讨论了 ---</text>
                    </block>
                </view>
            </view>

            <app-tab-bar ref="customTabBar" />

        </view>

    </view>
</template>

<script>
import skeleton from '@/components/skeleton/skeleton';
import pageTabs from '@/components/page-tabs/page-tabs';
// #ifndef MP-WEIXIN
import AppTabBar from '@/custom-tab-bar/index.vue';
// #endif
// index.js
// 修复：移除全局数据库实例，改为在方法中动态获取
  const PAGE_SIZE = 5;
  const DISCOVER_PAGE_SIZE = 5;
  const MAX_DISCOVER_EXCLUDE_IDS = 200;
const imageOptimizer = require('../../utils/imageOptimizer');
const likeIcon = require('../../utils/likeIcon');
const { togglePostLike } = require('../../utils/likeService.js');
const avatarCache = require('../../utils/avatarCache');
const followCache = require('../../utils/followCache');
import { getUnreadCount } from '@/api-cache/unread.js';
import { getDiscoverFeed, invalidateDiscover } from '@/api-cache/discover.js';
import { getHomePosts, invalidateHomePosts } from '@/api-cache/home-posts.js';
import { hydrateTempUrls, warmTempUrlsFromPosts } from '@/_utils/hydrate-temp-urls';
const { previewImage } = require('../../utils/imagePreview.js');
const { normalizePostList } = require('../../utils/postNormalizer.js');
const { cloudCall } = require('../../utils/cloudCall.js');
const postGalleryMixin = require('../../mixins/postGallery.js');
export default {
    components: {
        skeleton,
        pageTabs,
        // #ifndef MP-WEIXIN
        AppTabBar
        // #endif
    },
    mixins: [postGalleryMixin],
    data() {
        return {
            postList: [],
            votingInProgress: {},
            page: 0,
            hasMore: true,
            isLoading: false,
            openid: '', // 添加 openid 字段

            // 恢复线上版本的初始值
            isLoadingMore: false,

            // 新增：专门用于控制底部"加载中"UI的状态
            swiperHeights: {},

            imageClampHeights: {},

            // 新增：单图瘦高图钳制高度
            displayMode: 'square',

            // 首页只负责广场模式
            imageCache: {},

            // 图片缓存
            visiblePosts: new Set(),

            // 可见的帖子ID集合
  
            // --- 页面切换相关 ---
            currentTab: 'square', // 'square', 'discover', 'discussion'
            currentPage: 'home',

            // 'home' 或 'discover'

            // swiper当前页面索引 (0: 广场, 1: 关注, 2: 讨论)
            swiperCurrent: 0,

            // 发现页相关数据（保留但不显示入口）
            discoverPostList: [],
            discoverPage: 0,
            discoverHasMore: true,
            discoverShownPostIds: [],
            discoverRefreshTime: 0,
            discoverIsLoading: false,
            discoverIsLoadingMore: false,

            // 讨论页相关数据
            discussionPostList: [],
            discussionPage: 0,
            discussionHasMore: true,
            discussionIsLoading: false,
            discussionIsLoadingMore: false,

            // 关注页相关数据
            followingPostList: [],
            followingPage: 0,
            followingHasMore: true,
            followingIsLoading: false,
            followingIsLoadingMore: false,

            selected: 0,
            img: '',
            // 安全区域高度
            safeAreaTop: 0,
            // swiper切换防抖定时器
            swiperChangeTimer: null
        };
    },
    onLoad: function (options) {
        // 调试：检查安全区域高度
        this.debugSafeArea();
        
        // 首页只负责广场模式
        this.setData({
            displayMode: 'square'
        });
        this.pageLoadStartTime = Date.now();

        // 初始化 openid
        this.initOpenid();

        // 等待登录完成（openid 覆盖匿名后）再拉取首屏数据
        this.waitForLoginThenInit();

        // 监听全局点赞变更，触发本页的缓存同步
        try { uni.$on && uni.$on('like-changed', this.syncLikeStatusFromCache); } catch (_) {}
        // 监听评论数变更，精确更新对应卡片的评论计数
        try { uni.$on && uni.$on('comment-count-changed', (e) => { try { this.updatePostCommentCount(e.postId, e.commentCount); } catch (_) {} }); } catch (_) {}
    },
    onShow: function () {
        // #ifndef MP-WEIXIN
        try { uni.hideTabBar({ animation: false }); } catch (e) {}
        try { this.$refs.customTabBar && this.$refs.customTabBar.syncSelected && this.$refs.customTabBar.syncSelected(); } catch (e) {}
        // #endif
        // TabBar 状态更新，使用兼容性处理
        const { updateTabBarStatus } = require('../../utils/tabBarCompatibility.js');
        updateTabBarStatus(this, 0);

        // 检查是否需要刷新（发布帖子后）
        try {
            const shouldRefresh = uni.getStorageSync('shouldRefreshIndex');
            if (shouldRefresh) {
                console.log('【index】检测到发布标记，刷新数据');
                uni.removeStorageSync('shouldRefreshIndex');
                this.refreshIndexData();
            }
        } catch (e) {
            console.log('CatchClause', e);
            console.log('CatchClause', e);
            console.error('检查刷新标记失败:', e);
        }

        // 同步点赞状态：从缓存中获取最新的点赞状态
        this.syncLikeStatusFromCache();

            },
    onUnload: function () {
        try { uni.$off && this.syncLikeStatusFromCache && uni.$off('like-changed', this.syncLikeStatusFromCache); } catch (_) {}
        try { uni.$off && uni.$off('comment-count-changed'); } catch (_) {}
        // 清理swiper切换防抖定时器
        if (this.swiperChangeTimer) {
            clearTimeout(this.swiperChangeTimer);
            this.swiperChangeTimer = null;
        }
    },
    onPullDownRefresh: function () {
        console.log('🔍 [首页] 下拉刷新触发，当前页面:', this.currentPage);
        if (this.currentPage === 'home') {
            // 主页刷新 - 清除缓存并强制调用云函数
            console.log('🔍 [首页] 执行主页刷新，清除缓存');
            
            // 清除首页缓存
            try {
                invalidateHomePosts({});
                console.log('✅ [首页] 已清除首页缓存');
            } catch (e) {
                console.error('❌ [首页] 清除首页缓存失败:', e);
            }
            
            this.setData(
                {
                    postList: [],
                    swiperHeights: {},
                    page: 0,
                    hasMore: true
                },
                () => {
                    console.log('🔍 [首页] 状态重置完成，开始获取数据');
                    this.getPostList(() => {
                        console.log('✅ [首页] 下拉刷新完成');
                        uni.stopPullDownRefresh();
                    });
                }
            );
        } else if (this.currentPage === 'discover') {
            // 发现页刷新 - 重新获取推荐
            console.log('🔍 [首页] 执行发现页刷新');
            this.refreshDiscoverPosts();
            uni.stopPullDownRefresh();
        } else if (this.currentPage === 'following') {
            // 关注页刷新
            console.log('🔍 [首页] 执行关注页刷新');
            this.refreshFollowingPosts();
            uni.stopPullDownRefresh();
        } else if (this.currentPage === 'discussion') {
            // 讨论页刷新
            console.log('🔍 [首页] 执行讨论页刷新');
            this.refreshDiscussionPosts();
            uni.stopPullDownRefresh();
        }
    },
    // 移除或禁用 onReachBottom，避免与 onPageScroll 冲突
    /*
onReachBottom: function () {
  console.log('【首页】onReachBottom触发，但主要加载逻辑在onPageScroll');
  if (!this.data.hasMore || this.data.isLoading) {
    return;
  }
  this.getPostList();
},
*/

    // 优化页面滚动监听，使用更简单的防抖，移除 createSelectorQuery 提高性能
    onPageScroll: function (e) {
        if (this.scrollTimer) {
            clearTimeout(this.scrollTimer);
        }
        this.scrollTimer = setTimeout(() => {
            const isHome = this.currentPage === 'home';
            const isDiscover = this.currentPage === 'discover';
            const isFollowing = this.currentPage === 'following';
            const isDiscussion = this.currentPage === 'discussion';
            if (!isHome && !isDiscover && !isFollowing && !isDiscussion) {
                return;
            }

            let hasMore, loadingFlag;
            if (isHome) {
                hasMore = this.hasMore;
                loadingFlag = this.isLoading || this.isLoadingMore;
            } else if (isDiscover) {
                hasMore = this.discoverHasMore;
                loadingFlag = this.discoverIsLoading || this.discoverIsLoadingMore;
            } else if (isFollowing) {
                hasMore = this.followingHasMore;
                loadingFlag = this.followingIsLoading || this.followingIsLoadingMore;
            } else if (isDiscussion) {
                hasMore = this.discussionHasMore;
                loadingFlag = this.discussionIsLoading || this.discussionIsLoadingMore;
            }

            if (!hasMore || loadingFlag) {
                console.log('【首页】滚动检测被阻止:', {
                    page: this.currentPage,
                    hasMore,
                    loadingFlag
                });
                return;
            }
            
            // 使用 createSelectorQuery() 获取容器高度，参考 poem-square.vue 的实现
            try {
                const info = uni.getSystemInfoSync();
                const winH = info.windowHeight;
                
                // 根据当前页面选择不同的容器ID
                let containerId = '';
                if (isHome) {
                    containerId = '#post-list-container';
                } else if (isFollowing) {
                    containerId = '#following-list-container';
                } else if (isDiscussion) {
                    containerId = '#discussion-list-container';
                }
                
                // 发现页暂时不处理（没有对应的模板）
                if (!containerId) {
                    return;
                }
                
                uni.createSelectorQuery()
                    .in(this)
                    .select(containerId)
                    .boundingClientRect((rect) => {
                        if (!rect || !rect.height) {
                            return;
                        }
                        
                        // 参考 poem-square.vue 的计算方式
                        // 使用 rect.bottom 来计算容器底部距离视口底部的距离
                        const rectBottom = rect.top + rect.height;
                        let distanceToBottom = rectBottom - winH;
                        
                        // 如果容器底部已经在视口上方（已经滚动到底部以下），distanceToBottom 会是负数
                        // 这种情况下，距离应该是 0
                        if (distanceToBottom < 0) {
                            distanceToBottom = 0;
                        }
                        
                        // 使用更大的预加载阈值，在更早的时候就触发（4 屏，确保提前足够多）
                        const preloadThreshold = winH * 4;

                        console.log('【首页】滚动计算:', {
                            containerId,
                            rectTop: rect.top,
                            rectHeight: rect.height,
                            rectBottom: rectBottom,
                            scrollTop: e.scrollTop,
                            winH,
                            distanceToBottom: distanceToBottom.toFixed(0),
                            preloadThreshold: preloadThreshold.toFixed(0),
                            shouldLoad: distanceToBottom < preloadThreshold
                        });

                        if (distanceToBottom < preloadThreshold) {
                            console.log('【首页】触发预加载，页面:', this.currentPage, '距离底部:', distanceToBottom.toFixed(0), 'rpx, 阈值:', preloadThreshold.toFixed(0), 'rpx');
                            if (isHome) {
                                this.getPostList();
                            } else if (isFollowing) {
                                this.loadFollowingPosts();
                            } else if (isDiscussion) {
                                this.loadDiscussionPosts();
                            }
                        }
                    })
                    .exec();
            } catch (err) {
                console.error('【首页】滚动检测失败:', err);
            }
        }, 100); // 100ms 防抖
    },
    methods: {
        // 处理匿名头像点击事件的函数
        handleAnonymousAvatarClick(e) {
            console.log('【首页】匿名头像被点击，阻止跳转');
            if (e && e.preventDefault) {
                e.preventDefault();
            }
            if (e && e.stopPropagation) {
                e.stopPropagation();
            }
            // 显示提示信息
            uni.showToast({
                title: '匿名用户无法查看主页',
                icon: 'none'
            });
        },

        // 调试安全区域
        debugSafeArea() {
            try {
                // 获取系统信息
                const systemInfo = uni.getSystemInfoSync();
                console.log('【index】系统信息:', {
                    statusBarHeight: systemInfo.statusBarHeight,
                    safeAreaInsets: systemInfo.safeAreaInsets,
                    safeArea: systemInfo.safeArea,
                    windowHeight: systemInfo.windowHeight,
                    screenHeight: systemInfo.screenHeight,
                    platform: systemInfo.platform
                });

                // 动态设置安全区域 - 使用uni-app兼容方式
                if (systemInfo.statusBarHeight) {
                    const safeAreaTop = systemInfo.statusBarHeight;
                    console.log('【index】使用状态栏高度作为安全区域:', safeAreaTop);
                    
                    // 在uni-app中，我们可以通过设置页面数据来动态调整样式
                    this.setData({
                        safeAreaTop: safeAreaTop
                    });
                    
                    // 尝试设置CSS变量（仅在支持的环境中）
                    try {
                        if (typeof document !== 'undefined' && document.documentElement) {
                            document.documentElement.style.setProperty('--safe-area-inset-top', safeAreaTop + 'px');
                            console.log('【index】CSS变量设置成功');
                        }
                    } catch (cssError) {
                        console.log('【index】CSS变量设置失败，使用数据绑定方式:', cssError);
                    }
                }
            } catch (error) {
                console.error('【index】安全区域调试失败:', error);
            }
        },

        // swiper切换处理
        onSwiperChange(e) {
            const current = e.detail.current;
            console.log('swiper切换到:', current);
            
            // 防抖处理：避免快速滑动时的状态不一致
            if (this.swiperChangeTimer) {
                clearTimeout(this.swiperChangeTimer);
            }
            
            this.swiperChangeTimer = setTimeout(() => {
                this.setData({
                    swiperCurrent: current
                });

                // 根据swiper索引映射到页面类型和标签
                let pageType, tabValue;
                switch(current) {
                    case 0:
                        pageType = 'home';
                        tabValue = 'square';
                        break;
                    case 1:
                        pageType = 'following';
                        tabValue = 'following';
                        break;
                    case 2:
                        pageType = 'discussion';
                        tabValue = 'discussion';
                        break;
                }

                this.setData({
                    currentPage: pageType,
                    currentTab: tabValue
                });

                // 如果页面还没有数据，加载数据
                if (pageType === 'following' && this.followingPostList.length === 0) {
                    this.loadFollowingPosts();
                } else if (pageType === 'discussion' && this.discussionPostList.length === 0) {
                    this.loadDiscussionPosts();
                }
                
                // 切换到关注页时，主动同步点赞状态（参考广场页实现）
                if (pageType === 'following') {
                    try {
                        this.syncLikeStatusFromCache && this.syncLikeStatusFromCache();
                    } catch (e) {
                        console.warn('同步关注页点赞状态失败:', e);
                    }
                }
            }, 10); // 10ms防抖延迟
        },

        // 标签切换处理
        onTabChange(tabValue) {
            console.log('切换标签页:', tabValue);
            
            // 根据标签值映射到swiper索引
            let swiperIndex;
            switch(tabValue) {
                case 'square':
                    swiperIndex = 0;
                    break;
                case 'following':
                    swiperIndex = 1;
                    break;
                case 'discussion':
                    swiperIndex = 2;
                    break;
            }

            this.setData({
                currentTab: tabValue,
                swiperCurrent: swiperIndex
            });

            // 根据标签页映射到内部页面
            switch(tabValue) {
                case 'square':
                    this.setData({
                        currentPage: 'home'
                    });
                    break;
                case 'following':
                    this.setData({
                        currentPage: 'following'
                    });
                    // 如果关注页还没有数据，加载关注页数据
                    if (this.followingPostList.length === 0) {
                        this.loadFollowingPosts();
                    } else {
                        // 如果已有数据，主动同步点赞状态（参考广场页实现）
                        try {
                            this.syncLikeStatusFromCache && this.syncLikeStatusFromCache();
                        } catch (e) {
                            console.warn('同步关注页点赞状态失败:', e);
                        }
                    }
                    break;
                case 'discussion':
                    this.setData({
                        currentPage: 'discussion'
                    });
                    // 如果讨论页还没有数据，加载讨论页数据
                    if (this.discussionPostList.length === 0) {
                        this.loadDiscussionPosts();
                    }
                    break;
            }
        },

        // 等待登录完成再初始化首页数据，避免 isVoted 计算出错
        waitForLoginThenInit: function () {
            const MAX_WAIT_MS = 5000; // 最多等待 5s
            const CHECK_INTERVAL_MS = 100;
            const start = Date.now();
            const checkAndGo = () => {
                try {
                    const appInstance = getApp();
                    const loginDone = appInstance && appInstance.globalData && appInstance.globalData._loginProcessCompleted;
                    const openid = appInstance && appInstance.globalData && appInstance.globalData.openid;
                    if (loginDone && openid) {
                        console.log('🔐 [首页] 检测到登录完成且已获取 openid，开始拉取数据');
                        this.getIndexData();
                        return;
                    }
                } catch (e) {
                    console.log('🔐 [首页] 登录检测异常（忽略继续等待）', e);
                }
                if (Date.now() - start >= MAX_WAIT_MS) {
                    console.log('⏱️ [首页] 登录等待超时，兜底直接拉取数据');
                    this.getIndexData();
                    return;
                }
                setTimeout(checkAndGo, CHECK_INTERVAL_MS);
            };
            checkAndGo();
        },
        getIndexData: function () {
            // 直接走 CacheManager 首页封装
            this.setData({ isLoading: true, postList: [], page: 0, hasMore: true });
            getHomePosts({ page: 0, pageSize: PAGE_SIZE, context: this })
                .then(async (list) => {
                    const postsRaw = Array.isArray(list) ? list : [];
                    let posts = normalizePostList(postsRaw).map((post) => ({
                        ...post,
                        likeIcon: likeIcon.getLikeIcon(post.votes || 0, post.isVoted || false)
                    }));
                    posts = await hydrateTempUrls(posts);
                    warmTempUrlsFromPosts(posts);
                    this.setData({
                        postList: posts,
                        page: 1,
                        isLoading: false,
                        hasMore: posts.length === PAGE_SIZE
                    });
                    const self = this;
                    setTimeout(() => {
                        if (self.preloadUserData && typeof self.preloadUserData === 'function') {
                            self.preloadUserData(posts);
                        }
                    }, 500);
                })
                .catch((err) => {
                    console.error('【首页】getIndexData（缓存封装）失败:', err);
                    this.setData({ isLoading: false });
                    uni.showToast({ title: '网络错误', icon: 'none' });
                });
        },

        refreshData: function () {
            this.setData(
                {
                    postList: [],
                    swiperHeights: {},
                    imageClampHeights: {},
                    page: 0,
                    hasMore: true
                },
                () => {
                    this.getPostList();
                }
            );
        },

        // catch:tap 用于图片预览，并阻止跳转
        handlePreview: function (event) {
            console.log('【图片预览】handlePreview事件触发');
            const dataset = event && event.currentTarget ? event.currentTarget.dataset : {};
            console.log('【图片预览】event.currentTarget.dataset:', dataset);
            const result = previewImage(event);
            if (!result) {
                console.error('【图片预览】预览条件不满足', dataset);
            }
            return result;
        },

        onVote: function (event) {
            // 注意：小程序中不需要手动stopPropagation，因为使用了catch:tap绑定
            console.log('【点赞】onVote事件触发', event.currentTarget.dataset);
            const postId = event.currentTarget.dataset.postid;
            const index = event.currentTarget.dataset.index;
            let listType = event.currentTarget.dataset.listType;
          if (!listType) {
              if (this.currentPage === 'discover') {
                  listType = 'discover';
              } else if (this.currentPage === 'following') {
                  listType = 'following';
              } else if (this.currentPage === 'discussion') {
                  listType = 'discussion';
              } else {
                  listType = 'home';
              }
          }

          const listKey = listType === 'discover' ? 'discoverPostList' :
                         listType === 'following' ? 'followingPostList' :
                         listType === 'discussion' ? 'discussionPostList' : 'postList';
          const pageTag = listType === 'discover' ? 'discover' :
                         listType === 'following' ? 'following' :
                         listType === 'discussion' ? 'discussion' : 'index';
            let list = this[listKey] || [];
            let targetIndex = index;
            if (!list[targetIndex] || list[targetIndex]._id !== postId) {
                targetIndex = list.findIndex((p) => p._id === postId);
            }
            if (targetIndex < 0) {
                console.warn('【点赞】未找到对应的帖子，postId:', postId, 'listType:', listType);
                return;
            }
            console.log('【点赞】postId:', postId, 'index:', index);
            if (this.votingInProgress[postId]) {
                console.log('【点赞】正在投票中，跳过');
                return;
            }
            this.setData({
                [`votingInProgress.${postId}`]: true
            });
            const originalItem = list[targetIndex] || {};
            const originalVotes = Number(originalItem.votes) || 0;
            const originalIsVoted = !!originalItem.isVoted;
            console.log('【点赞】原始状态 - votes:', originalVotes, 'isVoted:', originalIsVoted);

            // 立即更新UI，提供即时反馈
            const optimisticVotes = originalIsVoted ? Math.max(0, originalVotes - 1) : originalVotes + 1;
            const optimisticItem = {
                ...originalItem,
                votes: optimisticVotes,
                isVoted: !originalIsVoted,
                likeIcon: likeIcon.getLikeIcon(optimisticVotes, !originalIsVoted)
            };
            const optimisticList = list.slice();
            optimisticList[targetIndex] = optimisticItem;
            this.setData({
                [listKey]: optimisticList
            });

            togglePostLike(postId, {
                pageTag,
                context: this,
                currentVotes: originalVotes,
                currentIsLiked: originalIsVoted,
                requireAuth: true
            }).then((result) => {
                console.log('【点赞】服务返回结果:', result);
                if (result.success) {
                    const currentList = this[listKey] || [];
                    const currentIndex = currentList.findIndex((p) => p._id === postId);
                    if (currentIndex > -1) {
                        const updatedItem = {
                            ...currentList[currentIndex],
                            votes: result.votes,
                            isVoted: result.isLiked,
                            likeIcon: result.likeIcon
                        };
                        const newList = currentList.slice();
                        newList[currentIndex] = updatedItem;
                        this.setData({
                            [listKey]: newList
                        });
                    }
                    console.log('【点赞】服务调用成功，数据已同步');
                    return;
                }

                const rollback = result.rollback || {
                    votes: originalVotes,
                    isLiked: originalIsVoted,
                    likeIcon: likeIcon.getLikeIcon(originalVotes, originalIsVoted)
                };
                console.warn('【点赞】服务返回失败，回滚UI');
                const currentList = this[listKey] || [];
                const currentIndex = currentList.findIndex((p) => p._id === postId);
                if (currentIndex > -1) {
                    const rollbackItem = {
                        ...currentList[currentIndex],
                        votes: rollback.votes,
                        isVoted: rollback.isLiked,
                        likeIcon: rollback.likeIcon
                    };
                    const newList = currentList.slice();
                    newList[currentIndex] = rollbackItem;
                    this.setData({
                        [listKey]: newList
                    });
                }
            }).catch((err) => {
                console.error('【点赞】调用 likeService 失败:', err);
                const currentList = this[listKey] || [];
                const currentIndex = currentList.findIndex((p) => p._id === postId);
                if (currentIndex > -1) {
                    const fallbackItem = {
                        ...currentList[currentIndex],
                        votes: originalVotes,
                        isVoted: originalIsVoted,
                        likeIcon: likeIcon.getLikeIcon(originalVotes, originalIsVoted)
                    };
                    const newList = currentList.slice();
                    newList[currentIndex] = fallbackItem;
                    this.setData({
                        [listKey]: newList
                    });
                }
            }).finally(() => {
                console.log('【点赞】服务调用完成');
                this.setData({
                    [`votingInProgress.${postId}`]: false
                });
            });
        },

        updatePostCommentCount: function (postId, newCommentCount) {
            const postList = this.postList;
            const postIndex = postList.findIndex((p) => p._id === postId);
            if (postIndex > -1) {
                this.setData({
                    [`postList[${postIndex}].commentCount`]: newCommentCount
                });
            }
        },

        onImageError: function (e) {
            console.error('图片加载失败', e.detail);
        },

        onAvatarError: function (e) {
            console.error('头像加载失败', e.detail);
        },

        onAvatarLoad: function (e) {
            // 头像加载成功，不需要特殊处理
            console.log('头像加载成功', e.detail);
        },

        onLikeIconError: function (e) {
            console.error('点赞图标加载失败', e.detail, '图标路径:', e.currentTarget.dataset.src);
        },

        // 图片预加载
        preloadImages: function (posts) {
            const imageUrls = posts
                .filter((post) => post.imageUrls && post.imageUrls.length > 0)
                .map((post) => post.imageUrls[0])
                .slice(0, 3); // 只预加载前3张图片

            if (imageUrls.length > 0) {
                imageOptimizer.preloadImages(imageUrls, (url, success) => {
                    if (success) {
                        console.log('图片预加载成功:', url);
                    }
                });
            }
        },

        // 预加载用户数据（头像和关注状态）
        preloadUserData: function (posts) {
            if (!posts || posts.length === 0) {
                return;
            }
            const currentUserId = this.getCurrentUserId();
            if (!currentUserId) {
                return;
            }

            // 预加载头像
            avatarCache.preloadAvatarsFromPosts(posts);

            // 预加载关注状态
            followCache.preloadFollowStatusFromPosts(posts, currentUserId);
        },

        // 初始化 openid
        initOpenid: function () {
            const appInstance = getApp();
            const openid = appInstance && appInstance.globalData && appInstance.globalData.openid;
            if (openid) {
                this.setData({ openid });
            } else {
                // 从本地存储获取
                const storedOpenid = uni.getStorageSync('openid') || uni.getStorageSync('userOpenId');
                if (storedOpenid) {
                    this.setData({ openid: storedOpenid });
                }
            }
        },

        // 获取当前用户ID
        getCurrentUserId: function () {
            return this.openid || uni.getStorageSync('openid') || uni.getStorageSync('userOpenId');
        },

        // 新增：跳转到用户个人主页
        navigateToUserProfile: function (e) {
            try {
                console.log('【头像点击】事件触发', e);

                // 更安全的dataset获取方式
                const currentTarget = e.currentTarget || e.target || {};
                const dataset = currentTarget.dataset || {};
                console.log('【头像点击】dataset:', dataset);

                const userId = dataset.userId || dataset.userid || dataset.user || '';
                const authorName = dataset.authorName || '未知用户';
                const isAnonymous = dataset.isAnonymous || false;

                console.log('【头像点击】提取的信息:', { userId, authorName, isAnonymous });

                // 检查是否为匿名帖子
                if (isAnonymous || (authorName === '匿名用户' && userId.includes('anonymous'))) {
                    console.log('【头像点击】匿名帖子，不跳转');
                    uni.showToast({
                        title: '匿名用户无法查看主页',
                        icon: 'none'
                    });
                    return;
                }

                if (!userId) {
                    console.error('【头像点击】userId为空，dataset详情:', dataset);
                    uni.showToast({
                        title: '用户信息获取失败',
                        icon: 'none'
                    });
                    return;
                }

                const currentUserOpenid = this.openid || this.getCurrentUserId();
                console.log('【头像点击】当前用户ID:', currentUserOpenid);

                // 检查是否点击的是自己的头像
                if (userId === currentUserOpenid) {
                    console.log('【头像点击】点击的是自己头像，切换到我的页面');
                    uni.switchTab({
                        url: '/pages/profile/profile',
                        fail: function (err) {
                            console.error('【头像点击】切换到我的页面失败:', err);
                            uni.showToast({
                                title: '页面跳转失败',
                                icon: 'none'
                            });
                        }
                    });
                } else {
                    console.log('【头像点击】点击的是他人头像，跳转到用户主页');
                    uni.navigateTo({
                        url: `/pages/user-profile/user-profile?userId=${encodeURIComponent(userId)}`,
                        success: function () {
                            console.log('【头像点击】跳转成功');
                        },
                        fail: function (err) {
                            console.error('【头像点击】跳转失败:', err);
                            uni.showToast({
                                title: '跳转失败',
                                icon: 'none'
                            });
                        }
                    });
                }
            } catch (err) {
                console.error('【头像点击】函数执行出错:', err);
                uni.showToast({
                    title: '跳转异常',
                    icon: 'none'
                });
            }
        },

        // 优化 getPostList 函数，这是核心
        getPostList: function (cb) {
            console.log('🔍 [首页] getPostList 开始调用');
            console.log('🔍 [首页] 当前状态:', {
                isLoading: this.isLoading,
                isLoadingMore: this.isLoadingMore,
                hasMore: this.hasMore,
                page: this.page,
                postListLength: this.postList.length
            });
            
            // 【修复】同时检查 isLoading 和 isLoadingMore，确保只有一个请求在进行
            if (this.isLoading || this.isLoadingMore || !this.hasMore) {
                console.log('【首页】getPostList被阻止：正在加载中或没有更多数据');
                if (typeof cb === 'function') {
                    cb();
                }
                return;
            }
            const skip = this.page * PAGE_SIZE;
            const isFirstLoad = this.page === 0;
            
            console.log('🔍 [首页] 请求参数:', {
                skip,
                page: this.page,
                isFirstLoad,
                PAGE_SIZE
            });

            // 根据加载类型设置不同的状态
            if (isFirstLoad) {
                // 首次加载：显示骨架屏
                this.setData({
                    isLoading: true
                });
            } else {
                // 滑动加载更多：显示底部加载提示
                this.setData({
                    isLoadingMore: true
                });
            }
            const apiStartTime = Date.now();
            // 使用缓存封装的首页分页数据，SWR + TTL
            getHomePosts({ page: this.page, pageSize: PAGE_SIZE, context: this })
                .then(async (list) => {
                    const postsRaw = Array.isArray(list) ? list : [];
                    console.log('✅ [首页] 获取到帖子数量（缓存封装）:', postsRaw.length);

                    let posts = normalizePostList(postsRaw).map((post) => ({
                        ...post,
                        likeIcon: likeIcon.getLikeIcon(post.votes || 0, post.isVoted || false)
                    }));

                    posts = await hydrateTempUrls(posts);
                    warmTempUrlsFromPosts(posts);

                    const self = this;
                    setTimeout(() => {
                        if (self.preloadUserData && typeof self.preloadUserData === 'function') {
                            self.preloadUserData(posts);
                        }
                    }, 500);

                    const newPostsCount = posts.length;
                    const currentPostList = this.postList;
                    const newPostList = currentPostList.concat(posts);
                    const updateData = {
                        postList: newPostList,
                        page: this.page + 1,
                        hasMore: newPostsCount === PAGE_SIZE
                    };
                    console.log('✅ [首页] 更新数据（缓存封装）:', {
                        newPostListLength: newPostList.length,
                        currentPage: this.page,
                        newPage: this.page + 1,
                        hasMore: updateData.hasMore,
                        newPostsCount
                    });
                    this.setData(updateData);
                    if (isFirstLoad) {
                        this.preloadImages(posts);
                    }
                })
                .catch((err) => {
                    console.error('【首页】getPostList（缓存封装）失败:', err);
                    if (isFirstLoad) {
                        uni.showToast({ title: '网络错误', icon: 'none' });
                    }
                })
                .finally(() => {
                    if (isFirstLoad) {
                        this.setData({ isLoading: false });
                    } else {
                        this.setData({ isLoadingMore: false });
                    }
                    if (typeof cb === 'function') cb();
                });
            return;
        },

        // 模式切换现在通过底部tabBar实现，不再需要手动切换

        // 同步点赞状态：从缓存中获取最新的点赞状态
                // ͬ������״̬���ӻ����л�ȡ���µĵ���״̬ + ���µ�ǰ�б�UI
        syncLikeStatusFromCache: function () {
            try {
                const allPostIds = [];
                const collectIds = (list) => {
                    if (!Array.isArray(list)) return;
                    list.forEach((p) => { if (p && p._id) allPostIds.push(p._id); });
                };
                collectIds(this.postList);
                collectIds(this.discoverPostList);
                collectIds(this.discussionPostList);
                collectIds(this.followingPostList);

                if (allPostIds.length === 0) return;

                const likeSync = require('../../utils/likeStatusSync.js');
                try { likeSync.syncLikeStatusForPosts(allPostIds); } catch (_) {}
                const getLatestLikeStatus = likeSync.getLatestLikeStatus;
                const updates = {};

                const patchList = (key) => {
                    const list = this[key];
                    if (!Array.isArray(list) || list.length === 0) return;
                    let changed = false;
                    const next = list.slice();
                    for (let i = 0; i < next.length; i += 1) {
                        const p = next[i];
                        if (!p || !p._id) continue;
                        const s = getLatestLikeStatus(p._id);
                        if (s && (((Number(p.votes) || 0) !== s.votes) || (!!p.isVoted !== !!s.isVoted))) {
                            p.votes = s.votes;
                            p.isVoted = s.isVoted;
                            const likeIcon = require('../../utils/likeIcon');
                            p.likeIcon = likeIcon.getLikeIcon(s.votes, s.isVoted);
                            changed = true;
                        }
                    }
                    if (changed) updates[key] = next;
                };

                patchList('postList');
                patchList('discoverPostList');
                patchList('discussionPostList');
                patchList('followingPostList');

                if (Object.keys(updates).length > 0) {
                    this.setData(updates);
                }
            } catch (err) {
                console.error('����ҳ��ͬ������״̬ʧ��:', err);
            }
        },

        // 标签点击处理
        onTagClick: function (e) {
            const tag = e.currentTarget.dataset.tag;
            console.log('点击标签:', tag);

            // 跳转到标签筛选页面
            uni.navigateTo({
                url: `/pages/tag-filter/tag-filter?tag=${encodeURIComponent(tag)}`,
                success: () => {
                    console.log('跳转到标签筛选页面成功');
                },
                fail: (err) => {
                    console.error('跳转到标签筛选页面失败:', err);
                    uni.showToast({
                        title: '跳转失败',
                        icon: 'none'
                    });
                }
            });
        },

        // 评论点击处理
        onCommentClick: function (e) {
            const postId = e.currentTarget.dataset.postid;
            console.log('点击评论，跳转到详情页:', postId);
            uni.navigateTo({
                url: `/pages/post-detail/post-detail?id=${postId}`,
                success: () => {
                    console.log('跳转到详情页成功');
                },
                fail: (err) => {
                    console.error('跳转到详情页失败:', err);
                    uni.showToast({
                        title: '跳转失败',
                        icon: 'none'
                    });
                }
            });
        },


        // 切换到关注页
        switchToFollowing: function () {
            if (this.currentPage === 'following') {
                console.log('已经在关注页，无需切换');
                return;
            }
            console.log('切换到关注页');
            this.setData({
                currentPage: 'following',
                currentTab: 'following',
                swiperCurrent: 1  // 关注页对应swiper索引1
            });

            // 如果关注页还没有数据，加载关注页数据
            if (this.followingPostList.length === 0) {
                console.log('开始加载关注页数据');
                this.loadFollowingPosts();
            } else {
                console.log('关注页已有数据，直接切换');
            }
        },

        // 切换回主页
        switchToHome: function () {
            if (this.currentPage === 'home') {
                console.log('已经在主页，无需切换');
                return;
            }
            console.log('切换回主页');
            this.setData({
                currentPage: 'home',
                currentTab: 'square',
                swiperCurrent: 0  // 主页对应swiper索引0
            });
        },

        // 切换到讨论页
        switchToDiscussion: function () {
            if (this.currentPage === 'discussion') {
                console.log('已经在讨论页，无需切换');
                return;
            }
            console.log('切换到讨论页');
            this.setData({
                currentPage: 'discussion',
                currentTab: 'discussion',
                swiperCurrent: 2  // 讨论页对应swiper索引2
            });

            // 如果讨论页还没有数据，加载讨论页数据
            if (this.discussionPostList.length === 0) {
                console.log('开始加载讨论页数据');
                this.loadDiscussionPosts();
            } else {
                console.log('讨论页已有数据，直接切换');
            }
        },

        // 加载发现页数据 - 使用推荐算法
        loadDiscoverPosts: function () {
            console.log('开始加载发现页推荐数据');

            // 发现页只使用推荐算法，不再加载更多
            this.loadRecommendationPosts();
        },

        // 加载推荐帖子（首次加载，走缓存封装）
        loadRecommendationPosts: async function () {
            if (this.discoverIsLoading || this.discoverIsLoadingMore) {
                console.log('发现页正在加载中，跳过重复请求');
                return;
            }

            if (!this.discoverHasMore && this.discoverPage > 0) {
                console.log('发现页已无更多推荐，跳过加载');
                return;
            }

            const isInitialLoad = this.discoverPage === 0 && this.discoverPostList.length === 0;
            this.setData({
                discoverIsLoading: isInitialLoad,
                discoverIsLoadingMore: !isInitialLoad
            });

            try {
                const currentExcludeIds = Array.from(new Set(Array.isArray(this.discoverShownPostIds) ? this.discoverShownPostIds : []));
                const excludeSet = new Set(currentExcludeIds);
                const page = this.discoverPage;

                const result = await getDiscoverFeed({
                    excludePostIds: currentExcludeIds,
                    page,
                    pageSize: DISCOVER_PAGE_SIZE,
                    context: this
                });

                const rawPosts = Array.isArray(result?.posts) ? result.posts : [];
                console.log('获取推荐数据结果（分页）: page=', page, '条数=', rawPosts.length, 'hasMore=', result?.hasMore);

                let normalizedPosts = normalizePostList(rawPosts).map((post) => ({
                    ...post,
                    likeIcon: likeIcon.getLikeIcon(post.votes || 0, post.isVoted || false)
                }));

                // 双重保险去重
                normalizedPosts = normalizedPosts.filter((post) => post && post._id && !excludeSet.has(post._id));

                // 将 cloud:// 映射为可访问 URL，并预热
                normalizedPosts = await hydrateTempUrls(normalizedPosts);
                warmTempUrlsFromPosts(normalizedPosts);

                if (!normalizedPosts.length) {
                    console.log('暂无新的推荐内容');
                    const hasMoreFromServer = !!(result && result.hasMore);
                    this.setData({
                        discoverPostList: page === 0 ? [] : this.discoverPostList,
                        discoverHasMore: hasMoreFromServer,
                        discoverRefreshTime: Date.now(),
                        discoverIsLoading: false,
                        discoverIsLoadingMore: false,
                        discoverPage: hasMoreFromServer ? page + 1 : page
                    });
                    if (hasMoreFromServer) {
                        console.log('服务器提示仍有更多，继续尝试获取下一页');
                        this.loadRecommendationPosts();
                    } else {
                        const toastTitle = isInitialLoad ? '暂时没有新的推荐' : '没有更多推荐了';
                        uni.showToast({
                            title: toastTitle,
                            icon: 'none'
                        });
                    }
                    return;
                }

                const currentList = Array.isArray(this.discoverPostList) ? this.discoverPostList.slice() : [];
                const combined = page === 0 ? normalizedPosts : currentList.concat(normalizedPosts);

                // 记录已显示的帖子ID，并控制上限
                const newShownIds = normalizedPosts.map((post) => post._id).filter(Boolean);
                const mergedSet = new Set(currentExcludeIds);
                newShownIds.forEach((id) => mergedSet.add(id));
                const updatedShownIds = Array.from(mergedSet).slice(-MAX_DISCOVER_EXCLUDE_IDS);

                const hasMoreFromServer = !!(result && result.hasMore);
                const hasMore = (normalizedPosts.length >= DISCOVER_PAGE_SIZE) || hasMoreFromServer;

                this.setData({
                    discoverPostList: combined,
                    discoverPage: page + 1,
                    discoverHasMore: (normalizedPosts.length >= DISCOVER_PAGE_SIZE) || hasMore,
                    discoverShownPostIds: updatedShownIds,
                    discoverRefreshTime: Date.now()
                });
                console.log('发现页推荐数据设置完成，帖子数量:', normalizedPosts.length, '累计:', combined.length, 'hasMore:', hasMore);
            } catch (err) {
                console.error('推荐数据请求失败（分页）:', err);
                uni.showToast({
                    title: '推荐加载失败',
                    icon: 'none'
                });
            } finally {
                this.setData({
                    discoverIsLoading: false,
                    discoverIsLoadingMore: false
                });
            }
        },

        // 刷新发现页推荐
        refreshDiscoverPosts: function () {
            console.log('刷新发现页推荐');

            // 清理缓存，避免返回旧数据
            try {
                invalidateDiscover();
            } catch (e) {
                console.warn('清理发现页缓存失败:', e);
            }

            // 重置状态，但保留已展示过的ID，避免重复推荐
            this.setData({
                discoverPostList: [],
                discoverPage: 0,
                discoverHasMore: true,
                discoverRefreshTime: Date.now(),
                discoverIsLoading: false,
                discoverIsLoadingMore: false
            });

            // 重新加载推荐
            this.loadRecommendationPosts();
        },

        // 加载讨论页数据
        loadDiscussionPosts: function () {
            console.log('开始加载讨论页数据');

            if (this.discussionIsLoading || this.discussionIsLoadingMore) {
                console.log('讨论页正在加载中，跳过重复请求');
                return;
            }

            if (!this.discussionHasMore && this.discussionPage > 0) {
                console.log('讨论页已无更多数据，跳过加载');
                return;
            }

            const isInitialLoad = this.discussionPage === 0 && this.discussionPostList.length === 0;
            this.setData({
                discussionIsLoading: isInitialLoad,
                discussionIsLoadingMore: !isInitialLoad
            });

            const skip = this.discussionPage * PAGE_SIZE;

            this.callCloudFunction('getDiscussionPosts', {
                skip: skip,
                limit: PAGE_SIZE
            }, { requireAuth: false }).then(async (res) => {
                if (res.result && res.result.success && res.result.posts) {
                    let posts = res.result.posts.map((post) => ({
                        ...post,
                        likeIcon: likeIcon.getLikeIcon(post.votes || 0, post.isVoted || false)
                    }));

                    // 将 cloud:// 映射为可访问 URL，并预热
                    posts = await hydrateTempUrls(posts);
                    warmTempUrlsFromPosts(posts);

                    const currentList = this.discussionPage === 0 ? [] : this.discussionPostList;
                    const newList = currentList.concat(posts);

                    this.setData({
                        discussionPostList: newList,
                        discussionPage: this.discussionPage + 1,
                        discussionHasMore: posts.length === PAGE_SIZE,
                        discussionIsLoading: false,
                        discussionIsLoadingMore: false
                    });

                    console.log('讨论页数据加载完成，帖子数量:', posts.length, '累计:', newList.length);

                    // 预加载用户数据
                    if (isInitialLoad) {
                        setTimeout(() => {
                            if (this.preloadUserData && typeof this.preloadUserData === 'function') {
                                this.preloadUserData(posts);
                            }
                        }, 500);
                    }
                } else {
                    this.setData({
                        discussionIsLoading: false,
                        discussionIsLoadingMore: false,
                        discussionHasMore: false
                    });
                    if (isInitialLoad) {
                        uni.showToast({
                            title: '暂无讨论内容',
                            icon: 'none'
                        });
                    }
                }
            }).catch((err) => {
                console.error('加载讨论页数据失败:', err);
                this.setData({
                    discussionIsLoading: false,
                    discussionIsLoadingMore: false
                });
                uni.showToast({
                    title: '加载失败',
                    icon: 'none'
                });
            });
        },

        // 模拟讨论页数据
        getMockDiscussionPosts: function () {
            return [
                {
                    _id: 'discussion_1',
                    _openid: 'user_1',
                    title: '大家觉得现代诗歌应该如何发展？',
                    content: '最近看到很多现代诗作品，感觉风格各异。想听听大家对现代诗歌未来发展的看法。',
                    authorName: '诗友小王',
                    authorAvatar: '/static/images/avatar.png',
                    votes: 15,
                    commentCount: 8,
                    isVoted: false,
                    tags: ['诗歌讨论', '现代诗'],
                    imageUrls: [],
                    createdAt: new Date().toISOString()
                },
                {
                    _id: 'discussion_2',
                    _openid: 'user_2',
                    title: '分享一首最喜欢的古诗',
                    content: '最近重读了李白的《将进酒》，每次读都有新的感悟。大家最喜欢哪首古诗呢？',
                    authorName: '古风爱好者',
                    authorAvatar: '/static/images/avatar.png',
                    votes: 23,
                    commentCount: 12,
                    isVoted: true,
                    tags: ['古诗', '李白', '经典'],
                    imageUrls: [],
                    createdAt: new Date().toISOString()
                },
                {
                    _id: 'discussion_3',
                    _openid: 'user_3',
                    title: '写作灵感枯竭怎么办？',
                    content: '最近一段时间总是感觉写不出东西，灵感好像枯竭了。大家有什么好的建议吗？',
                    authorName: '写作新手',
                    authorAvatar: '/static/images/avatar.png',
                    votes: 8,
                    commentCount: 6,
                    isVoted: false,
                    tags: ['写作', '灵感', '求助'],
                    imageUrls: [],
                    createdAt: new Date().toISOString()
                }
            ];
        },

        // 刷新讨论页数据
        refreshDiscussionPosts: function () {
            console.log('刷新讨论页数据');
            this.setData({
                discussionPostList: [],
                discussionPage: 0,
                discussionHasMore: true,
                discussionIsLoading: false,
                discussionIsLoadingMore: false
            });
            this.loadDiscussionPosts();
        },

        // 刷新广场页数据（发布帖子后调用）
        refreshIndexData: function () {
            console.log('【index】开始刷新广场页数据');

            // 清除首页缓存
            try {
                invalidateHomePosts({});
                console.log('✅ [index] 已清除首页缓存');
            } catch (e) {
                console.error('❌ [index] 清除首页缓存失败:', e);
            }

            // 重置状态
            this.setData({
                postList: [],
                page: 0,
                hasMore: true,
                isLoading: false
            });

            // 重新加载数据
            this.getIndexData();
        },

        // 统一云函数调用方法
        callCloudFunction(name, data = {}, extraOptions = {}) {
            return cloudCall(name, data, Object.assign({ pageTag: 'index', context: this }, extraOptions));
        },

        // 空函数，用于阻止匿名帖子的头像点击事件
        noop() {},

        // 加载关注页数据
        loadFollowingPosts: function () {
            console.log('开始加载关注页数据');

            if (this.followingIsLoading || this.followingIsLoadingMore) {
                console.log('关注页正在加载中，跳过重复请求');
                return;
            }

            if (!this.followingHasMore && this.followingPage > 0) {
                console.log('关注页已无更多数据，跳过加载');
                return;
            }

            const isInitialLoad = this.followingPage === 0 && this.followingPostList.length === 0;
            this.setData({
                followingIsLoading: isInitialLoad,
                followingIsLoadingMore: !isInitialLoad
            });

            const skip = this.followingPage * PAGE_SIZE;

            this.callCloudFunction('getFollowingPosts', {
                skip: skip,
                limit: PAGE_SIZE
            }, { requireAuth: true }).then(async (res) => {
                if (res.result && res.result.success && res.result.posts) {
                    let posts = res.result.posts.map((post) => ({
                        ...post,
                        likeIcon: likeIcon.getLikeIcon(post.votes || 0, post.isVoted || false)
                    }));

                    // 将 cloud:// 映射为可访问 URL，并预热
                    posts = await hydrateTempUrls(posts);
                    warmTempUrlsFromPosts(posts);

                    const currentList = this.followingPage === 0 ? [] : this.followingPostList;
                    const newList = currentList.concat(posts);

                    this.setData({
                        followingPostList: newList,
                        followingPage: this.followingPage + 1,
                        followingHasMore: posts.length === PAGE_SIZE,
                        followingIsLoading: false,
                        followingIsLoadingMore: false
                    });

                    console.log('关注页数据加载完成，帖子数量:', posts.length, '累计:', newList.length);

                    // 数据加载完成后，同步点赞状态（参考广场页实现）
                    try {
                        this.syncLikeStatusFromCache && this.syncLikeStatusFromCache();
                    } catch (e) {
                        console.warn('关注页数据加载后同步点赞状态失败:', e);
                    }

                    // 预加载用户数据
                    if (isInitialLoad) {
                        setTimeout(() => {
                            if (this.preloadUserData && typeof this.preloadUserData === 'function') {
                                this.preloadUserData(posts);
                            }
                        }, 500);
                    }
                } else {
                    this.setData({
                        followingIsLoading: false,
                        followingIsLoadingMore: false,
                        followingHasMore: false
                    });
                    if (isInitialLoad) {
                        uni.showToast({
                            title: '暂无关注的人发帖',
                            icon: 'none'
                        });
                    }
                }
            }).catch((err) => {
                console.error('加载关注页数据失败:', err);
                this.setData({
                    followingIsLoading: false,
                    followingIsLoadingMore: false
                });
                uni.showToast({
                    title: '加载失败',
                    icon: 'none'
                });
            });
        },

        // 刷新关注页数据
        refreshFollowingPosts: function () {
            console.log('刷新关注页数据');
            this.setData({
                followingPostList: [],
                followingPage: 0,
                followingHasMore: true,
                followingIsLoading: false,
                followingIsLoadingMore: false
            });
            this.loadFollowingPosts();
        },


    }
};
</script>
<style>
/* index.wxss */

.container {
    padding: 255rpx 0 100rpx 0; /* 为page-tabs留出空间：188rpx(page-tabs总高度) + 62rpx(额外间距) */
    background-color: #ffffff;
    min-height: 100vh;
    padding-bottom: 100rpx; /* 为底部tabBar留出空间 */
    position: relative;
}


/* 读诗模式容器 */
.poem-mode-container {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    z-index: 100;
    overflow: hidden;
}

/* 滑动指示器 */
.swipe-indicator {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    color: rgba(255, 255, 255, 0.8);
    font-size: 28rpx;
    padding: 20rpx 30rpx;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 50rpx;
    backdrop-filter: blur(10rpx);
}

.swipe-indicator.left {
    left: 30rpx;
}

.swipe-indicator.right {
    right: 30rpx;
}

/* 帖子索引指示器 */
.post-indicator {
    position: absolute;
    bottom: 60rpx;
    left: 50%;
    transform: translateX(-50%);
    color: rgba(255, 255, 255, 0.9);
    font-size: 24rpx;
    padding: 12rpx 24rpx;
    background: rgba(0, 0, 0, 0.4);
    border-radius: 30rpx;
    backdrop-filter: blur(10rpx);
}

/* 列表模式容器 */
.list-mode-container,
.list-content {
    display: block;
}

/* 广场模式容器 */
.square-mode-container {
    display: block;
    padding-top: 40rpx; /* 增加与顶部栏的距离 */
}

/* 新增：帖子项包装器样式 */
.post-item-wrapper {
    background: #fff;
    margin-bottom: 20rpx;
    padding: 0;
    box-shadow: none;
    border-radius: 0;
    border-bottom: 1rpx solid #f0f0f0;
}

/* 原创帖子特殊样式 */
.post-item-wrapper.original-post {
    background: linear-gradient(180deg, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 0) 90%, rgba(235, 200, 141, 0.05) 95%, rgba(235, 200, 141, 0.08) 100%);
    border-left: 3rpx solid #ebc88d;
    position: relative;
}

/* 原创帖子光影效果已移除 */

/* 新增：内容导航器样式 */
.post-content-navigator {
    display: block;
    background: transparent;
}

/* 新增：导航器点击效果 */
.navigator-hover {
    background-color: rgba(0, 0, 0, 0.02);
}

/* 新增：点赞按钮容器样式 */
.like-icon-container {
    padding: 10rpx;
    border-radius: 50%;
    transition: all 0.2s ease;
}

/* 新增：点赞按钮点击效果 */
.like-icon-container:active {
    transform: scale(0.9);
    background-color: rgba(255, 107, 107, 0.1);
}

/* 新增：点赞图标样式 */
.like-icon {
    width: 40rpx;
    height: 40rpx;
    transition: all 0.2s ease;
}

.author-info {
    display: flex;
    align-items: center;
    margin-bottom: 15rpx;
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

/* 新增：图片容器占位样式 */
.image-container-wrapper {
    position: relative;
    width: 100%;
    background-color: #f0f0f0; /* 占位时的背景色，很重要 */
    overflow: hidden;
    border-radius: 8px; /* 可以加个圆角，让占位块更好看 */
    margin: 20rpx 0; /* 图片和下方内容的间距 */
}

/* 新增：让图片或Swiper填充整个占位容器 */
.image-container-wrapper .post-image,
.image-container-wrapper .image-swiper {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
}

/* 多图容器 */
.multi-image-container {
    width: 100%;
    position: relative;
}

/* 单图容器 */
.single-image-container {
    width: 100%;
    position: relative;
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

.post-image.single-image {
    width: 100%;
    height: auto;
    display: block;
    background-color: #f5f5f5;
}

/* 图片数量指示器 */
.image-count-indicator {
    position: absolute;
    top: 20rpx;
    right: 20rpx;
    background-color: rgba(0, 0, 0, 0.6);
    color: white;
    padding: 8rpx 16rpx;
    border-radius: 20rpx;
    font-size: 24rpx;
    z-index: 10;
    backdrop-filter: blur(10rpx);
}

/* 卡片项样式 */
.post-item-wrapper {
    margin-bottom: 20rpx;
}

/* 外部作者信息样式 */
.author-info-outside {
    display: flex;
    align-items: center;
    padding: 20rpx 40rpx 10rpx 40rpx;
    background: #fff;
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
    box-shadow: none;
    box-sizing: border-box;
    padding: 20rpx 40rpx 30rpx 40rpx;
}

/* 定义点击时的样式 - 整个卡片缩小 */
.post-card-active {
    transform: scale(0.98);
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


.vote-section {
    display: flex;
    justify-content: space-between;
    align-items: center;
    /* 上移一点：收紧与内容的垂直间距 */
    margin-top: -8rpx;
    padding: 10rpx 60rpx 15rpx 60rpx;
}

.vote-count,
.comment-count {
    display: flex;
    align-items: center;
    font-size: 28rpx;
    color: #999;
    margin-left: 10rpx;
    transition: color 0.2s ease;
}

.comment-icon {
    width: 40rpx;
    height: 40rpx;
    margin-right: 8rpx;
}

.vote-count {
    margin-left: 10rpx;
}

/* .vote-count.voted {
    color: #ff4757;
} */

.actions-left {
    display: flex;
    align-items: center;
}

.action-emoji {
    font-size: 28rpx;
    margin-right: 8rpx;
}

.action-text {
    font-size: 28rpx;
    color: inherit;
}

.button-group {
    display: flex;
    align-items: center;
}

.like-icon-container {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8rpx;
    border-radius: 8rpx;
    margin-left: 20rpx;
    transition: all 0.2s ease;
}

.like-icon-container:active {
    transform: scale(0.95);
}

.like-icon {
    width: 48rpx;
    height: 48rpx;
}

/* 空状态样式 */
.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 100rpx 40rpx;
    text-align: center;
}

.empty-icon {
    font-size: 120rpx;
    margin-bottom: 30rpx;
    opacity: 0.6;
}

.empty-text {
    font-size: 32rpx;
    color: #666;
    margin-bottom: 15rpx;
}

.empty-subtext {
    font-size: 28rpx;
    color: #999;
}

/* 加载更多样式 */
.loading-more {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 40rpx;
}

.loading-text {
    font-size: 28rpx;
    color: #999;
}

/* 底部加载状态样式 */
.loading-footer {
    text-align: center;
    padding: 20rpx 0;
    color: #999;
    font-size: 14px;
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

/* 发现页推荐相关样式 */
.discover-end-tip {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 40rpx 20rpx;
    color: #999;
}

.end-text {
    font-size: 28rpx;
    margin-bottom: 20rpx;
}

.refresh-tip {
    background: rgba(255, 193, 7, 0.1);
    border: 2rpx solid rgba(255, 193, 7, 0.3);
    border-radius: 20rpx;
    padding: 16rpx 24rpx;
}

/* swiper页面切换样式 */
.page-swiper {
    height: 100vh;
    width: 100%;
}

.swiper-page {
    height: 100%;
    overflow-y: auto;
}

.refresh-text {
    font-size: 24rpx;
    color: #ffc107;
    font-weight: 500;
}
</style>
