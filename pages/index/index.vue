<template>
    <view>
        <!-- index.wxml -->
        <view class="container" @touchstart="touchStart" @touchend="touchEnd">
            <!-- 页面切换提示 -->
            <view v-if="showPageIndicator" class="page-indicator">
                <view class="page-indicator-text">{{ pageIndicatorText }}</view>
            </view>

            <!-- 消息图标按钮 -->
            <view class="message-icon-container" @tap="navigateToMessages">
                <view class="message-icon">✉️</view>
                <view v-if="unreadMessageCount > 0" class="unread-dot"></view>
            </view>

            <!-- 搜索框组件 -->
            <view class="search-box-container">
                <view class="search-box" @tap="navigateToSearch">
                    <view class="search-icon">🔍</view>
                    <view class="search-placeholder">搜索帖子...</view>
                </view>
            </view>

            <!-- 骨架屏：当 isLoading 为 true 时显示 -->
            <view v-if="isLoading">
                <skeleton />
            </view>

            <!-- 真实内容：当 isLoading 为 false 时显示 -->
            <view v-else class="square-mode-container">
                <view v-if="postList.length === 0 && !isLoading" class="empty-state">
                    <view class="empty-icon">📝</view>
                    <view class="empty-text">还没有帖子哦～</view>
                    <view class="empty-subtext">快来发布第一条帖子吧！</view>
                </view>
                <!-- 给你的帖子列表循环的父容器添加一个ID -->
                <view id="post-list-container">
                    <!-- 主页帖子列表 -->
                    <view v-if="currentPage === 'home'">
                        <view :class="'post-item-wrapper ' + (item.isOriginal ? 'original-post' : '')" v-for="(item, index) in postList" :key="index">
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
                                        <text class="action-emoji">💬</text>
                                        <text class="action-text">{{ item.commentCount || 0 }}</text>
                                    </view>
                                    <view class="like-icon-container" @tap.stop.prevent="onVote" :data-postid="item._id" :data-index="index">
                                        <image class="like-icon" :src="item.likeIcon || '/static/images/seed.png'" mode="aspectFit" @error="onLikeIconError"></image>
                                    </view>
                                    <view :class="'vote-count ' + (item.isVoted ? 'voted' : '')">
                                        <text class="action-text">{{ item.votes || 0 }}</text>
                                    </view>
                                </view>
                            </view>
                        </view>
                    </view>

                    <!-- 发现页帖子列表 -->
                    <view v-else-if="currentPage === 'discover'">
                        <view v-if="discoverPostList.length === 0 && !isLoading" class="empty-state">
                            <view class="empty-icon">🔍</view>
                            <view class="empty-text">发现页暂无内容</view>
                            <view class="empty-subtext">推荐算法正在学习中...</view>
                        </view>
                        <view :class="'post-item-wrapper ' + (item.isOriginal ? 'original-post' : '')" v-for="(item, index) in discoverPostList" :key="index">
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
                                        <text class="action-emoji">💬</text>
                                        <text class="action-text">{{ item.commentCount || 0 }}</text>
                                    </view>
                                    <view class="like-icon-container" @tap.stop.prevent="onVote" :data-postid="item._id" :data-index="index">
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

                <!-- 在容器外部，页面的最底部添加加载提示 -->
                <view class="loading-footer">
                    <block v-if="isLoadingMore">
                        <text>正在加载...</text>
                    </block>
                    <block v-else-if="currentPage === 'home' && !hasMore && postList.length > 0">
                        <text>--- 我是有底线的 ---</text>
                    </block>
                    <block v-else-if="currentPage === 'discover' && !discoverHasMore && discoverPostList.length > 0">
                        <view class="discover-end-tip">
                            <text class="end-text">--- 没有更多了 ---</text>
                            <view class="refresh-tip">
                                <text class="refresh-text">下拉刷新获取新的推荐</text>
                            </view>
                        </view>
                    </block>
                </view>
            </view>

            <!-- 悬浮的发布按钮 -->
            <navigator url="/pages/add/add" class="add-button">
                <view>+</view>
            </navigator>

        </view>

    </view>
</template>

<script>
import skeleton from '@/components/skeleton/skeleton';
// index.js
// 修复：移除全局数据库实例，改为在方法中动态获取
const PAGE_SIZE = 5;
const dataCache = require('../../utils/dataCache');
const imageOptimizer = require('../../utils/imageOptimizer');
const likeIcon = require('../../utils/likeIcon');
const { togglePostLike } = require('../../utils/likeService.js');
const avatarCache = require('../../utils/avatarCache');
import { getUnreadCount } from '@/api-cache/unread.js';
import { getDiscoverFeed } from '@/api-cache/discover.js';
import { hydrateTempUrls, warmTempUrlsFromPosts } from '@/_utils/hydrate-temp-urls';
const { previewImage } = require('../../utils/imagePreview.js');
const { normalizePostList } = require('../../utils/postNormalizer.js');
const { cloudCall } = require('../../utils/cloudCall.js');
const postGalleryMixin = require('../../mixins/postGallery.js');
export default {
    components: {
        skeleton
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
            unreadMessageCount: 0,

            // 未读消息数量

            // --- 页面切换相关 ---
            currentPage: 'home',

            // 'home' 或 'discover'
            showPageIndicator: false,

            // 是否显示页面切换提示
            pageIndicatorText: '',

            // 切换提示文字
            discoverPostList: [],

            // 发现页的帖子列表
            discoverPage: 0,

            // 发现页的分页
            discoverHasMore: true,

            // 发现页是否还有更多数据
            discoverShownPostIds: [],

            // 发现页已显示的帖子ID，用于防重复
            discoverRefreshTime: 0,

            // 发现页刷新时间戳
            touchStartX: 0,

            // 触摸开始X坐标
            touchStartY: 0,

            // 触摸开始Y坐标
            touchEndX: 0,

            // 触摸结束X坐标
            // 触摸结束Y坐标
            touchEndY: 0,

            selected: 0,
            img: ''
        };
    },
    onLoad: function (options) {
        // 首页只负责广场模式
        this.setData({
            displayMode: 'square'
        });
        this.pageLoadStartTime = Date.now();

        // 初始化 openid
        this.initOpenid();

        // 等待登录完成（openid 覆盖匿名后）再拉取首屏数据
        this.waitForLoginThenInit();
    },
    onShow: function () {
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

        // 检查未读消息数量
        this.checkUnreadMessageCount();
    },
    onPullDownRefresh: function () {
        console.log('🔍 [首页] 下拉刷新触发，当前页面:', this.currentPage);
        // 清除缓存
        dataCache.remove('index_postList_cache');
        if (this.currentPage === 'home') {
            // 主页刷新
            console.log('🔍 [首页] 执行主页刷新');
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
            // 只在首页时处理预加载逻辑，发现页不需要预加载
            if (this.currentPage !== 'home') {
                return;
            }

            // 只有在非加载中且还有更多数据时才进行后续判断
            if (!this.hasMore || this.isLoading || this.isLoadingMore) {
                console.log('【首页】滚动检测被阻止:', {
                    hasMore: this.hasMore,
                    isLoading: this.isLoading,
                    isLoadingMore: this.isLoadingMore
                });
                return;
            }
            
            const windowInfo = uni.getWindowInfo();
            const windowHeight = windowInfo.windowHeight;

            console.log('【首页】滚动检测 - scrollTop:', e.scrollTop, 'windowHeight:', windowHeight);

            // 使用 wx.createSelectorQuery() 获取页面总高度和最后一个元素的位置
            uni.createSelectorQuery()
                .in(this)
                .select('#post-list-container')
                .boundingClientRect((containerRect) => {
                    if (containerRect && containerRect.height > 0) {
                        const scrollHeight = containerRect.height; // 使用容器高度更准确
                        const scrollTop = e.scrollTop;
                        const distanceToBottom = scrollHeight - scrollTop - windowHeight;
                        const preloadThreshold = windowHeight * 1.5; // 提前 1.5 屏预加载

                        console.log('【首页】滚动计算:', {
                            scrollHeight,
                            scrollTop,
                            windowHeight,
                            distanceToBottom,
                            preloadThreshold
                        });

                        if (distanceToBottom < preloadThreshold) {
                            console.log('【首页】触发预加载');
                            this.getPostList();
                        }
                    } else {
                        console.log('【首页】容器高度获取失败');
                    }
                })
                .exec();
        }, 100); // 100ms 防抖
    },
    methods: {
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
            // 检查缓存
            const cachedData = dataCache.get('index_postList_cache');
            if (cachedData) {
                console.log('Index: 使用缓存数据');
                this.setData({
                    postList: cachedData,
                    page: Math.ceil(cachedData.length / PAGE_SIZE),
                    isLoading: false // 关键：数据返回，关闭骨架屏
                });

                return;
            }

            // 如果没有缓存，则加载数据
            this.getPostList();
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
            console.log('【点赞】postId:', postId, 'index:', index);
            if (this.votingInProgress[postId]) {
                console.log('【点赞】正在投票中，跳过');
                return;
            }
            this.setData({
                [`votingInProgress.${postId}`]: true
            });
            let postList = this.postList;
            const originalVotes = postList[index].votes;
            const originalIsVoted = postList[index].isVoted;
            console.log('【点赞】原始状态 - votes:', originalVotes, 'isVoted:', originalIsVoted);

            // 立即更新UI，提供即时反馈
            postList[index].votes = originalIsVoted ? originalVotes - 1 : originalVotes + 1;
            postList[index].isVoted = !originalIsVoted;
            postList[index].likeIcon = likeIcon.getLikeIcon(postList[index].votes, postList[index].isVoted);
            console.log('【点赞】更新后状态 - votes:', postList[index].votes, 'isVoted:', postList[index].isVoted);
            console.log('【点赞】新的likeIcon:', postList[index].likeIcon);
            this.setData({
                postList: postList
            });

            togglePostLike(postId, {
                pageTag: 'index',
                context: this,
                currentVotes: originalVotes,
                currentIsLiked: originalIsVoted,
                requireAuth: true
            }).then((result) => {
                console.log('【点赞】服务返回结果:', result);
                if (result.success) {
                    postList[index].votes = result.votes;
                    postList[index].isVoted = result.isLiked;
                    postList[index].likeIcon = result.likeIcon;
                    this.setData({
                        postList: postList
                    });
                    console.log('【点赞】服务调用成功，数据已同步');
                    return;
                }

                const rollback = result.rollback || {
                    votes: originalVotes,
                    isLiked: originalIsVoted,
                    likeIcon: likeIcon.getLikeIcon(originalVotes, originalIsVoted)
                };
                console.warn('【点赞】服务返回失败，回滚UI');
                postList[index].votes = rollback.votes;
                postList[index].isVoted = rollback.isLiked;
                postList[index].likeIcon = rollback.likeIcon;
                this.setData({
                    postList: postList
                });
            }).catch((err) => {
                console.error('【点赞】调用 likeService 失败:', err);
                postList[index].votes = originalVotes;
                postList[index].isVoted = originalIsVoted;
                postList[index].likeIcon = likeIcon.getLikeIcon(originalVotes, originalIsVoted);
                this.setData({
                    postList: postList
                });
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
            console.log('【头像点击】事件触发', e);
            console.log('【头像点击】dataset:', e.currentTarget.dataset);
            const userId = e.currentTarget.dataset.userId;
            console.log('【头像点击】提取的userId:', userId);
            if (userId) {
                const currentUserOpenid = this.openid;

                // 检查是否点击的是自己的头像
                if (userId === currentUserOpenid) {
                    console.log('【头像点击】点击的是自己头像，切换到我的页面');
                    uni.switchTab({
                        url: '/pages/profile/profile'
                    });
                } else {
                    console.log('【头像点击】点击的是他人头像，跳转到用户主页');
                    uni.navigateTo({
                        url: `/pages/user-profile/user-profile?userId=${userId}`,
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
            } else {
                console.error('【头像点击】userId为空，无法跳转');
                uni.showToast({
                    title: '用户信息获取失败',
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
                        dataCache.set('index_postList_cache', newPostList);
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

        // 检查未读消息数量
        checkUnreadMessageCount: function () {
            getUnreadCount(this).then((n) => {
                this.setData({ unreadMessageCount: n || 0 });
            }).catch(() => {});
        },

        // 同步点赞状态：从缓存中获取最新的点赞状态
        syncLikeStatusFromCache: function () {
            // 已由 CacheManager 接管首页分页，跳过 dataCache 同步
            console.log('【首页】同步点赞状态：CacheManager 接管，跳过 dataCache 同步');
        },

        // 跳转到消息页面
        navigateToMessages: function () {
            uni.navigateTo({
                url: '/pages/messages/messages',
                success: () => {
                    console.log('跳转到消息页面成功');
                },
                fail: (err) => {
                    console.error('跳转到消息页面失败:', err);
                    uni.showToast({
                        title: '跳转失败',
                        icon: 'none'
                    });
                }
            });
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

        // 搜索框点击处理
        navigateToSearch: function () {
            console.log('点击搜索框，跳转到搜索页面');
            uni.navigateTo({
                url: '/pages/search/search',
                success: () => {
                    console.log('跳转到搜索页面成功');
                },
                fail: (err) => {
                    console.error('跳转到搜索页面失败:', err);
                    uni.showToast({
                        title: '跳转失败',
                        icon: 'none'
                    });
                }
            });
        },

        // --- 页面切换相关函数 ---

        // 触摸开始事件
        touchStart: function (e) {
            this.setData({
                touchStartX: e.touches[0].clientX,
                touchStartY: e.touches[0].clientY
            });
        },

        // 触摸结束事件
        touchEnd: function (e) {
            const touchEndX = e.changedTouches[0].clientX;
            const touchEndY = e.changedTouches[0].clientY;
            const diffX = this.touchStartX - touchEndX;
            const diffY = this.touchStartY - touchEndY;

            // 计算滑动距离和角度
            const distance = Math.sqrt(diffX * diffX + diffY * diffY);
            // 修复角度计算：使用绝对值确保角度正确
            const angle = Math.abs((Math.atan2(Math.abs(diffY), Math.abs(diffX)) * 180) / Math.PI);

            // 只有当水平滑动距离足够大，且滑动角度接近水平（小于45度）时才翻页
            if (distance > 80 && Math.abs(diffX) > 50 && angle < 45) {
                if (diffX > 0) {
                    // 左滑：切换回主页
                    console.log('左滑切换回主页');
                    this.switchToHome();
                } else {
                    // 右滑：切换到发现页
                    console.log('右滑切换到发现页');
                    this.switchToDiscover();
                }
            }
        },

        // 切换到发现页
        switchToDiscover: function () {
            if (this.currentPage === 'discover') {
                console.log('已经在发现页，无需切换');
                return;
            }
            console.log('切换到发现页');
            this.setData({
                currentPage: 'discover',
                showPageIndicator: true,
                pageIndicatorText: '发现页'
            });

            // 加载发现页数据（如果还没有）
            if (this.discoverPostList.length === 0) {
                console.log('开始加载发现页数据');
                this.loadDiscoverPosts();
            } else {
                console.log('发现页已有数据，直接切换');
            }

            // 3秒后隐藏提示
            setTimeout(() => {
                this.setData({
                    showPageIndicator: false
                });
            }, 3000);
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
                showPageIndicator: true,
                pageIndicatorText: '主页'
            });

            // 3秒后隐藏提示
            setTimeout(() => {
                this.setData({
                    showPageIndicator: false
                });
            }, 3000);
        },

        // 加载发现页数据 - 使用推荐算法
        loadDiscoverPosts: function () {
            console.log('开始加载发现页推荐数据');

            // 发现页只使用推荐算法，不再加载更多
            this.loadRecommendationPosts();
        },

        // 加载推荐帖子（首次加载，走缓存封装）
        loadRecommendationPosts: async function () {
            console.log('使用推荐算法加载发现页数据（带缓存）');
            try {
                const posts = await getDiscoverFeed({ excludePostIds: this.discoverShownPostIds, context: this });
                console.log('获取推荐数据结果（缓存封装）: 条数=', Array.isArray(posts) ? posts.length : 0);

                let normalizedPosts = normalizePostList(posts || []).map((post) => ({
                    ...post,
                    likeIcon: likeIcon.getLikeIcon(post.votes || 0, post.isVoted || false)
                }));

                // 将 cloud:// 映射为可访问 URL，并预热
                normalizedPosts = await hydrateTempUrls(normalizedPosts);
                warmTempUrlsFromPosts(normalizedPosts);

                // 记录已显示的帖子ID
                const newShownIds = normalizedPosts.map((post) => post._id);
                const updatedShownIds = [...this.discoverShownPostIds, ...newShownIds];
                this.setData({
                    discoverPostList: normalizedPosts,
                    discoverPage: 1,
                    discoverHasMore: false,
                    // 推荐算法只显示5个，没有更多
                    discoverShownPostIds: updatedShownIds,
                    discoverRefreshTime: Date.now()
                });
                console.log('发现页推荐数据设置完成，帖子数量:', normalizedPosts.length);
            } catch (err) {
                console.error('推荐数据请求失败（缓存封装）:', err);
                uni.showToast({
                    title: '推荐加载失败',
                    icon: 'none'
                });
            }
        },

        // 刷新发现页推荐
        refreshDiscoverPosts: function () {
            console.log('刷新发现页推荐');

            // 重置状态
            this.setData({
                discoverPostList: [],
                discoverPage: 0,
                discoverHasMore: true,
                discoverShownPostIds: [],
                discoverRefreshTime: 0
            });

            // 重新加载推荐
            this.loadRecommendationPosts();
        },

        // 刷新广场页数据（发布帖子后调用）
        refreshIndexData: function () {
            console.log('【index】开始刷新广场页数据');

            // 清除缓存
            dataCache.clear('index_postList_cache');

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
        }

    }
};
</script>
<style>
/* index.wxss */
.page-indicator {
    position: fixed;
    top: 100rpx;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.7);
    color: white;
    padding: 20rpx 40rpx;
    border-radius: 50rpx;
    font-size: 28rpx;
    z-index: 9999;
    animation: pageIndicatorFadeIn 0.3s ease-in-out;
}

.page-indicator-text {
    text-align: center;
    font-weight: 500;
}

@keyframes pageIndicatorFadeIn {
    0% {
        opacity: 0;
        transform: translateX(-50%) translateY(-20rpx);
    }
    100% {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
    }
}

.container {
    padding: 20rpx;
    background-color: #f7f8fa;
    min-height: 100vh;
    padding-bottom: 100rpx; /* 为底部tabBar留出空间 */
    position: relative; /* 为消息图标定位做准备 */
}

/* 消息图标容器 */
.message-icon-container {
    position: fixed;
    right: 40rpx;
    bottom: 280rpx; /* 移到发布按钮上面 */
    width: 80rpx;
    height: 80rpx;
    background: rgba(255, 255, 255, 0.9);
    backdrop-filter: blur(20rpx);
    -webkit-backdrop-filter: blur(20rpx);
    border-radius: 50%;
    display: flex;
    justify-content: center;
    align-items: center;
    box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.1);
    border: 1rpx solid rgba(255, 255, 255, 0.3);
    z-index: 1000;
    transition: all 0.2s ease;
}

.message-icon-container:active {
    transform: scale(0.95);
    background: rgba(255, 255, 255, 0.8);
}

.message-icon {
    font-size: 36rpx;
    color: #333;
}

/* 未读消息红点 */
.unread-dot {
    position: absolute;
    top: 8rpx;
    right: 8rpx;
    width: 16rpx;
    height: 16rpx;
    background-color: #ff4757;
    border-radius: 50%;
    border: 2rpx solid #fff;
    animation: pulse 2s infinite;
}

/* 红点脉冲动画 */
@keyframes pulse {
    0% {
        transform: scale(1);
        opacity: 1;
    }
    50% {
        transform: scale(1.2);
        opacity: 0.8;
    }
    100% {
        transform: scale(1);
        opacity: 1;
    }
}

/* 搜索框容器 */
.search-box-container {
    margin-bottom: 20rpx;
}

/* 搜索框样式 */
.search-box {
    background-color: #fff;
    border-radius: 16rpx;
    padding: 24rpx 30rpx;
    display: flex;
    align-items: center;
    box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.05);
    border: 1rpx solid rgba(0, 0, 0, 0.05);
    transition: all 0.2s ease;
}

.search-box:active {
    transform: scale(0.98);
    background-color: #f8f9fa;
}

.search-icon {
    font-size: 32rpx;
    margin-right: 20rpx;
    color: #999;
}

.search-placeholder {
    font-size: 28rpx;
    color: #999;
    flex: 1;
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

.add-button {
    position: fixed;
    right: 40rpx;
    bottom: 160rpx;
    width: 80rpx; /* 从100rpx调整为80rpx */
    height: 80rpx; /* 从100rpx调整为80rpx */
    background: rgba(135, 206, 235, 0.8); /* 改为淡蓝色 */
    backdrop-filter: blur(20rpx);
    -webkit-backdrop-filter: blur(20rpx);
    border-radius: 50%;
    display: flex;
    justify-content: center;
    align-items: center;
    color: white;
    font-size: 48rpx; /* 相应调整字体大小 */
    box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.1);
    border: 1rpx solid rgba(255, 255, 255, 0.2);
    z-index: 100;
    transition: transform 0.2s ease;
}

.add-button:active {
    transform: scale(0.9);
}

.vote-section {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 20rpx;
    padding-top: 20rpx;
    border-top: 1rpx solid #f0f0f0;
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

.vote-count {
    margin-left: 10rpx;
}

.vote-count.voted {
    color: #ff4757;
}

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

.refresh-text {
    font-size: 24rpx;
    color: #ffc107;
    font-weight: 500;
}
</style>

