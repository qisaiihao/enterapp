<template>
    <view class="page-wrapper" :class="{ 'is-scrolling': isTouchScrolling }">
        <view class="container">
            <page-tabs ref="pageTabs" :current-tab="currentTab" @tab-change="onTabChange" @tabs-ready="onTabsReady"></page-tabs>

            <view class="square-mode-container" :style="{ paddingTop: totalHeaderHeight + 'px' }">
                <swiper 
                    class="page-swiper" 
                    :current="swiperCurrent" 
                    @change="onSwiperChange"
                    @touchstart="onSwiperTouchStart"
                    @touchmove="onSwiperTouchMove"
                    @touchend="onSwiperTouchEnd"
                    :duration="300"
                    :disable-touch="false"
                    :circular="false"
                    :indicator-dots="false"
                    :autoplay="false"
                    :skip-hidden-item-layout="true"
                    :easing-function="easeOutCubic"
                >
                    <swiper-item>
                        <feed-list
                            class="swiper-page"
                            :posts="homeFeedPosts"
                            :is-loading="homeFeedIsLoading"
                            :is-loading-more="homeFeedIsLoadingMore"
                            :has-more="homeFeedHasMore"
                            :has-ever-loaded="homeFeedHasEverLoaded"
                            :refresher-triggered="isRefreshing"
                            :swiper-heights="swiperHeights"
                            :show-poem-author="false"
                            :list-type="homeFeedListType"
                            container-id="post-list-container"
                            empty-icon="📝"
                            empty-text="还没有帖子哦～"
                            empty-subtext="快来发布第一条帖子吧！"
                            end-text="--- 我是有底线的 ---"
                            :scroll-enabled="!isSwiping"
                            :refresher-enabled="!isSwiping"
                            @refresh="onHomeRefresh"
                            @load-more="loadHomeMore"
                            @avatar-error="onAvatarError"
                            @avatar-load="onAvatarLoad"
                            @navigate-to-user="handleNavigateToUser"
                            @preview-image="handlePreviewImage"
                            @image-error="onImageError"
                            @image-load="onImageLoad"
                            @tag-click="handleTagClick"
                            @vote="handleVote"
                            @comment-click="handleCommentClick"
                            @like-icon-error="onLikeIconError"
                            @touch-start="onTouchStart"
                            @touch-move="onTouchMove"
                            @touch-end="onTouchEnd"
                        >
                            <template #filter>
                                <view class="filter-toggle-container">
                                    <view
                                        :class="'filter-toggle-btn ' + (showNormalPostsOnly ? 'active' : '')"
                                        @tap="toggleNormalPostsFilter"
                                    >
                                        <text class="filter-toggle-text">{{ showNormalPostsOnly ? '显示全部' : '只看普通帖子' }}</text>
                                    </view>
                                    <view
                                        :class="'filter-toggle-btn ' + (useRecommendFeed ? 'active' : '')"
                                        @tap="toggleRecommendFeed"
                                    >
                                        <text class="filter-toggle-text">{{ useRecommendFeed ? '推荐中' : '推荐' }}</text>
                                    </view>
                                </view>
                            </template>
                        </feed-list>
                    </swiper-item>

                    <swiper-item>
                        <feed-list
                            class="swiper-page"
                            :posts="followingPostList"
                            :is-loading="followingIsLoading"
                            :is-loading-more="followingIsLoadingMore"
                            :has-more="followingHasMore"
                            :has-ever-loaded="followingHasEverLoaded"
                            :refresher-triggered="isRefreshing"
                            :swiper-heights="swiperHeights"
                            :show-poem-author="false"
                            list-type="following"
                            container-id="following-list-container"
                            empty-icon="👥"
                            empty-text="关注的人还没有发帖"
                            empty-subtext="去关注更多有趣的人吧！"
                            end-text="--- 没有更多了 ---"
                            :scroll-enabled="!isSwiping"
                            :refresher-enabled="!isSwiping"
                            @refresh="onFollowingRefresh"
                            @load-more="loadFollowingPosts"
                            @avatar-error="onAvatarError"
                            @avatar-load="onAvatarLoad"
                            @navigate-to-user="handleNavigateToUser"
                            @preview-image="handlePreviewImage"
                            @image-error="onImageError"
                            @image-load="onImageLoad"
                            @tag-click="handleTagClick"
                            @vote="handleVote"
                            @comment-click="handleCommentClick"
                            @like-icon-error="onLikeIconError"
                            @touch-start="onTouchStart"
                            @touch-move="onTouchMove"
                            @touch-end="onTouchEnd"
                        >
                            <template #filter>
                                <following-avatar-bar
                                    ref="followingAvatarBar"
                                    :selected-user-id="followingSelectedUserId"
                                    @select-user="onFollowingUserSelect"
                                    @back="onFollowingAvatarBarBack"
                                />
                            </template>
                        </feed-list>
                    </swiper-item>

                    <swiper-item>
                        <feed-list
                            class="swiper-page"
                            :posts="discussionPostList"
                            :is-loading="discussionIsLoading"
                            :is-loading-more="discussionIsLoadingMore"
                            :has-more="discussionHasMore"
                            :has-ever-loaded="discussionHasEverLoaded"
                            :refresher-triggered="isRefreshing"
                            :swiper-heights="swiperHeights"
                            list-type="discussion"
                            container-id="discussion-list-container"
                            empty-icon="💬"
                            empty-text="讨论区暂无内容"
                            empty-subtext="快来发起第一个话题吧！"
                            end-text="--- 没有更多讨论了 ---"
                            :scroll-enabled="!isSwiping"
                            :refresher-enabled="!isSwiping"
                            @refresh="onDiscussionRefresh"
                            @load-more="loadDiscussionPosts"
                            @avatar-error="onAvatarError"
                            @avatar-load="onAvatarLoad"
                            @navigate-to-user="handleNavigateToUser"
                            @preview-image="handlePreviewImage"
                            @image-error="onImageError"
                            @image-load="onImageLoad"
                            @tag-click="handleTagClick"
                            @vote="handleVote"
                            @comment-click="handleCommentClick"
                            @like-icon-error="onLikeIconError"
                            @touch-start="onTouchStart"
                            @touch-move="onTouchMove"
                            @touch-end="onTouchEnd"
                        />
                    </swiper-item>
                </swiper>
            </view>

            <app-tab-bar ref="customTabBar" />

        </view>

    </view>
</template>

<script>
// 组件导入
import skeleton from '@/components/skeleton/skeleton';
import pageTabs from '@/components/page-tabs/page-tabs';
import PostItem from '@/components/PostItem.vue';
import FeedList from '@/components/FeedList.vue';
import FollowingAvatarBar from '@/components/following-avatar-bar/following-avatar-bar.vue';
// #ifndef MP-WEIXIN
import AppTabBar from '@/custom-tab-bar/index.vue';
// #endif

// API 缓存导入
import { getUnreadCount } from '@/api-cache/unread.js';
import { getContentPoemFeed, invalidateContentPoemFeed } from '@/api-cache/poem-reco.js';
import { getHomePosts, invalidateHomePosts } from '@/api-cache/home-posts.js';
import { getFollowingPosts, invalidateFollowingPosts } from '@/api-cache/following.js';
import { getDiscussionPosts, invalidateDiscussionPosts } from '@/api-cache/discussion.js';

// 工具函数导入
import { hydrateTempUrls, warmTempUrlsFromPosts } from '@/_utils/hydrate-temp-urls';
import { navigateToTagFilter, navigateToPostDetail, navigateToUserProfile as navigateToUserProfileUtil, extractDataset } from '@/utils/navigation.js';
import { updateTabBarStatus } from '@/utils/tabBarCompatibility.js';
import { syncLikeStatusForPosts, getLatestLikeStatus } from '@/utils/likeStatusSync.js';
import imageOptimizer from '@/utils/imageOptimizer';
import likeIcon from '@/utils/likeIcon';
import { togglePostLike } from '@/utils/likeService.js';
import avatarCache from '@/utils/avatarCache';
import followCache from '@/utils/followCache';
import { previewImage } from '@/utils/imagePreview.js';
import { normalizePostList } from '@/utils/postNormalizer.js';
import { processPostList } from '@/utils/postProcessor.js';
import { cloudCall } from '@/utils/cloudCall.js';
import postGalleryMixin from '@/mixins/postGallery.js';
import cacheManager from '@/_utils/cache-manager.js';

// 常量定义
const PAGE_SIZE = 10;
const DISCOVER_PAGE_SIZE = 5;
const MAX_DISCOVER_EXCLUDE_IDS = 200;
export default {
    components: {
        skeleton,
        pageTabs,
        PostItem,
        FeedList,
        FollowingAvatarBar,
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
            isLoading: true,
            openid: '',
            isRefreshing: false,
            isLoadingMore: false,
            swiperHeights: {},
            imageClampHeights: {},
            displayMode: 'square',
            imageCache: {},
            visiblePosts: new Set(),
            currentTab: 'square',
            currentPage: 'home',
            swiperCurrent: 0,
            discoverPostList: [],
            discoverPage: 0,
            discoverHasMore: true,
            discoverShownPostIds: [],
            discoverRefreshTime: 0,
            discoverIsLoading: false,
            discoverIsLoadingMore: false,
            discoverHasEverLoaded: false,
            discussionPostList: [],
            discussionPage: 0,
            discussionHasMore: true,
            discussionIsLoading: false,
            discussionIsLoadingMore: false,
            followingPostList: [],
            followingPage: 0,
            followingHasMore: true,
            followingIsLoading: false,
            followingIsLoadingMore: false,
            followingSelectedUserId: null,
            // 各个页面的加载完成标识符
            homeHasEverLoaded: false,
            followingHasEverLoaded: false,
            discussionHasEverLoaded: false,
            selected: 0,
            img: '',
            safeAreaTop: 0,
            swiperChangeTimer: null,
            swiperTouchStartX: null,
            swiperTouchStartY: null,
            swiperTouchStartTime: null,
            easeOutCubic: 'cubic-bezier(0.33, 1, 0.68, 1)',
            showNormalPostsOnly: false,
            useRecommendFeed: false,
            isTouchScrolling: false,
            touchStartX: 0,
            touchStartY: 0,
            touchMoved: false,
            hoverResetTimer: null,
            lastScrollTime: 0,
            isSwiping: false,
            swipeDirectionDecided: false
        };
    },
    computed: {
        homeFeedPosts() {
            return this.useRecommendFeed ? this.discoverPostList : this.postList;
        },
        homeFeedIsLoading() {
            return this.useRecommendFeed ? this.discoverIsLoading : this.isLoading;
        },
        homeFeedIsLoadingMore() {
            return this.useRecommendFeed ? this.discoverIsLoadingMore : this.isLoadingMore;
        },
        homeFeedHasMore() {
            return this.useRecommendFeed ? this.discoverHasMore : this.hasMore;
        },
        homeFeedHasEverLoaded() {
            return this.useRecommendFeed ? this.discoverHasEverLoaded : this.homeHasEverLoaded;
        },
        homeFeedListType() {
            return this.useRecommendFeed ? 'discover' : 'home';
        }
    },
    onLoad: function (options) {
        this.debugSafeArea();
        this.setData({
            displayMode: 'square'
        });
        this.pageLoadStartTime = Date.now();
        this.initOpenid();
        this.waitForLoginThenInit();
        try { uni.$on && uni.$on('like-changed', this.syncLikeStatusFromCache); } catch (_) {}
        try { uni.$on && uni.$on('comment-count-changed', (e) => { try { this.updatePostCommentCount(e.postId, e.commentCount); } catch (_) {} }); } catch (_) {}
    },
    onShow: function () {
        // #ifndef MP-WEIXIN
        try { uni.hideTabBar({ animation: false }); } catch (e) {}
        try { this.$refs.customTabBar && this.$refs.customTabBar.syncSelected && this.$refs.customTabBar.syncSelected(); } catch (e) {}
        // #endif
        // TabBar 状态更新，使用兼容性处理
        updateTabBarStatus(this, 0);

        // 检查是否需要刷新（发布帖子后）
        try {
            const shouldRefresh = uni.getStorageSync('shouldRefreshIndex');
            if (shouldRefresh) {
                uni.removeStorageSync('shouldRefreshIndex');
                this.refreshIndexData();
                return; // 强制刷新后不再进行其他检查
            }
        } catch (e) {
            console.error('检查刷新标记失败:', e);
        }

        // 检查缓存新鲜度：从其他页面返回时触发SWR检查
        try {
            if (this.homeHasEverLoaded && this.postList.length > 0) {
                const filterParams = {};
                if (this.showNormalPostsOnly) {
                    filterParams.isPoem = false;
                    filterParams.isDiscussion = false;
                }
                getHomePosts({ 
                    page: 0, 
                    pageSize: PAGE_SIZE, 
                    context: this,
                    ...filterParams,
                    onBackgroundUpdate: async (newPosts) => {
                        if (!Array.isArray(newPosts) || newPosts.length === 0) return;
                        try {
                            const posts = await processPostList(newPosts);
                            if (this.currentPage === 'home' && this.swiperCurrent === 0) {
                                const currentPostIds = this.postList.map(p => p._id).join(',');
                                const newPostIds = posts.map(p => p._id).join(',');
                                if (currentPostIds !== newPostIds) {
                                    this.setData({ postList: posts, hasMore: posts.length === PAGE_SIZE });
                                }
                            }
                        } catch (_) {}
                    }
                }).catch(() => {});
            }
        } catch (_) {}

        // 同步点赞状态：从缓存中获取最新的点赞状态
        this.syncLikeStatusFromCache();

            },
    onUnload: function () {
        try { uni.$off && this.syncLikeStatusFromCache && uni.$off('like-changed', this.syncLikeStatusFromCache); } catch (_) {}
        try { uni.$off && uni.$off('comment-count-changed'); } catch (_) {}
        if (this.swiperChangeTimer) {
            clearTimeout(this.swiperChangeTimer);
            this.swiperChangeTimer = null;
        }
    },

    methods: {
          onRefresherRefresh: function() {
            if (this.currentPage === 'home') {
                if (this.useRecommendFeed) {
                    this.refreshDiscoverPosts();
                    setTimeout(() => {
                        this.isRefreshing = false;
                    }, 100);
                    return;
                }
                try {
                    invalidateHomePosts({});
                } catch (e) {
                    console.error('清除首页缓存失败:', e);
                }
                this.setData({
                    page: 0,
                    hasMore: true,
                    postList: []
                }, () => {
                    this.getPostList(() => {
                        setTimeout(() => {
                            this.isRefreshing = false;
                        }, 100);
                    });
                });
            } else if (this.currentPage === 'discover') {
                this.refreshDiscoverPosts();
                setTimeout(() => {
                    this.isRefreshing = false;
                }, 100);
            } else if (this.currentPage === 'following') {
                this.refreshFollowingPosts(() => {
                    setTimeout(() => {
                        this.isRefreshing = false;
                    }, 100);
                });
            } else if (this.currentPage === 'discussion') {
                this.refreshDiscussionPosts(() => {
                    setTimeout(() => {
                        this.isRefreshing = false;
                    }, 100);
                });
            }
        },

        // 首页刷新（FeedList 组件触发）
        onHomeRefresh: function () {
            this.isRefreshing = true;
            if (this.useRecommendFeed) {
                this.refreshDiscoverPosts();
                return;
            }
            try {
                invalidateHomePosts({});
            } catch (e) {
                console.error('清除首页缓存失败:', e);
            }
            this.setData({
                page: 0,
                hasMore: true,
                postList: []
            }, () => {
                this.getPostList(() => {
                    this.isRefreshing = false;
                });
            });
        },

        // 首页加载更多（根据推荐开关走不同逻辑）
        loadHomeMore: function () {
            if (this.useRecommendFeed) {
                this.loadRecommendationPosts();
                return;
            }
            this.getPostList();
        },

        // 关注页刷新（FeedList 组件触发）
        onFollowingRefresh: function () {
            this.isRefreshing = true;
            this.refreshFollowingPosts(() => {
                this.isRefreshing = false;
            });
        },

        // 讨论页刷新（FeedList 组件触发）
        onDiscussionRefresh: function () {
            this.isRefreshing = true;
            this.refreshDiscussionPosts(() => {
                this.isRefreshing = false;
            });
        },

            handleScroll: function (e) {
            if (typeof this.kickScrollGuard === 'function') {
                this.kickScrollGuard();
            }
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
                    return;
                }
                
                try {
                    const info = uni.getSystemInfoSync();
                    const winH = info.windowHeight;
                    
                    let containerId = '';
                    if (isHome) {
                        containerId = '#post-list-container';
                    } else if (isFollowing) {
                        containerId = '#following-list-container';
                    } else if (isDiscussion) {
                        containerId = '#discussion-list-container';
                    }
                    
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
                            
                            const rectBottom = rect.top + rect.height;
                            let distanceToBottom = rectBottom - winH;
                            
                            if (distanceToBottom < 0) {
                                distanceToBottom = 0;
                            }
                            
                            const preloadThreshold = winH * 2;

                            if (distanceToBottom < preloadThreshold) {
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
                    console.error('滚动检测失败:', err);
                }
            }, 100);
        },

            handleAnonymousAvatarClick(e) {
            if (e && e.preventDefault) {
                e.preventDefault();
            }
            if (e && e.stopPropagation) {
                e.stopPropagation();
            }
              uni.showToast({
                title: '匿名用户无法查看主页',
                icon: 'none'
            });
        },

            debugSafeArea() {
            try {
                const systemInfo = uni.getSystemInfoSync();
                if (systemInfo.statusBarHeight) {
                    const safeAreaTop = systemInfo.statusBarHeight;
                    this.setData({
                        safeAreaTop: safeAreaTop
                    });
                    try {
                        if (typeof document !== 'undefined' && document.documentElement) {
                            document.documentElement.style.setProperty('--safe-area-inset-top', safeAreaTop + 'px');
                        }
                    } catch (cssError) {
                        console.log('CSS变量设置失败，使用数据绑定方式:', cssError);
                    }
                }
            } catch (error) {
                console.error('安全区域调试失败:', error);
                console.error('【index】安全区域调试失败:', error);
            }
        },

                onSwiperTouchStart(e) {
            this.swiperTouchStartX = e.touches[0].clientX;
            this.swiperTouchStartY = e.touches[0].clientY;
            this.swiperTouchStartTime = Date.now();
            this.isSwiping = false;
            this.swipeDirectionDecided = false;
        },

        onSwiperTouchMove(e) {
            // 如果已经确定方向，不再判断
            if (this.swipeDirectionDecided) return;
            if (!this.swiperTouchStartX || !this.swiperTouchStartY) return;
            
            const touchX = e.touches[0].clientX;
            const touchY = e.touches[0].clientY;
            const deltaX = Math.abs(touchX - this.swiperTouchStartX);
            const deltaY = Math.abs(touchY - this.swiperTouchStartY);
            
            // 移动超过 3px 就判断方向
            if (deltaX > 3 || deltaY > 3) {
                this.swipeDirectionDecided = true;
                // 如果是水平滑动，禁用上下滚动和刷新
                if (deltaX > deltaY) {
                    this.isSwiping = true;
                }
            }
        },

                onSwiperTouchEnd(e) {
            if (!this.swiperTouchStartX) return;
            
            const touchEndX = e.changedTouches[0].clientX;
            const deltaX = touchEndX - this.swiperTouchStartX;
            const deltaTime = Date.now() - this.swiperTouchStartTime;
            
            this.swiperTouchStartX = null;
            this.swiperTouchStartY = null;
            this.swiperTouchStartTime = null;
            this.isSwiping = false;
            this.swipeDirectionDecided = false;
            if (Math.abs(deltaX) < 30 || deltaTime < 50) {
                return;
            }
            
            const currentIndex = this.swiperCurrent;
            const isLeftSwipe = deltaX < 0;
            const isRightSwipe = deltaX > 0;

            if (isLeftSwipe && currentIndex >= 2) {
                console.log('已到达右边界，禁止继续向左滑动');
                this.setData({
                    swiperCurrent: 2
                });
                return;
            }

            if (isRightSwipe && currentIndex <= 0) {
                console.log('已到达左边界，禁止继续向右滑动');
                this.setData({
                    swiperCurrent: 0
                });
                return;
            }
        },

              onSwiperChange(e) {
            const current = e.detail.current;
            console.log('swiper切换到:', current);
            
              if (this.swiperChangeTimer) {
                clearTimeout(this.swiperChangeTimer);
            }
            
            this.swiperChangeTimer = setTimeout(() => {
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

                // 批量更新状态，减少渲染次数
                this.setData({
                    swiperCurrent: current,
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
            
            // 根据标签值映射到swiper索引和页面类型
            let swiperIndex, pageType;
            switch(tabValue) {
                case 'square':
                    swiperIndex = 0;
                    pageType = 'home';
                    break;
                case 'following':
                    swiperIndex = 1;
                    pageType = 'following';
                    break;
                case 'discussion':
                    swiperIndex = 2;
                    pageType = 'discussion';
                    break;
            }

            // 批量更新状态，减少渲染次数
            this.setData({
                currentTab: tabValue,
                swiperCurrent: swiperIndex,
                currentPage: pageType
            });

            // 后续操作（数据加载、状态同步）
            if (tabValue === 'following') {
                if (this.followingPostList.length === 0) {
                    this.loadFollowingPosts();
                } else {
                    try {
                        this.syncLikeStatusFromCache && this.syncLikeStatusFromCache();
                    } catch (e) {
                        console.warn('同步关注页点赞状态失败:', e);
                    }
                }
            } else if (tabValue === 'discussion') {
                if (this.discussionPostList.length === 0) {
                    this.loadDiscussionPosts();
                }
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
            // 清理永不过期缓存（修复旧的错误缓存）
            try {
                const ns = cacheManager.namespace('posts:list', { persistent: true, maxItems: 256 });
                if (ns.clearInfiniteCache) ns.clearInfiniteCache();
            } catch (_) {}
            
            this.setData({ isLoading: true, postList: [], page: 0, hasMore: true, homeHasEverLoaded: false });
            // 根据showNormalPostsOnly状态决定筛选参数
            const filterParams = {};
            if (this.showNormalPostsOnly) {
                // 只看普通帖子：排除诗歌和讨论
                filterParams.isPoem = false;
                filterParams.isDiscussion = false;
            }
            getHomePosts({ 
                page: 0, 
                pageSize: PAGE_SIZE, 
                context: this,
                ...filterParams,
                // SWR后台更新回调
                onBackgroundUpdate: async (newPosts) => {
                    if (!Array.isArray(newPosts) || newPosts.length === 0) return;
                    try {
                        const posts = await processPostList(newPosts);
                        if (this.currentPage === 'home' && this.swiperCurrent === 0) {
                            const currentPostIds = this.postList.map(p => p._id).join(',');
                            const newPostIds = posts.map(p => p._id).join(',');
                            if (currentPostIds !== newPostIds) {
                                this.setData({ postList: posts, hasMore: posts.length === PAGE_SIZE });
                            }
                        }
                    } catch (_) {}
                }
            })
                .then(async (list) => {
                    const postsRaw = Array.isArray(list) ? list : [];
                    const posts = await processPostList(postsRaw);
                    this.setData({
                        postList: posts,
                        page: 1,
                        isLoading: false,
                        hasMore: posts.length === PAGE_SIZE,
                        homeHasEverLoaded: true
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
                    this.setData({ isLoading: false, homeHasEverLoaded: true });
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
                        if (this.tapDisabled && this.tapDisabled()) { return; }
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
                        if (this.tapDisabled && this.tapDisabled()) { return; }
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
            // 批量更新：标记投票进行中 + 乐观更新列表
            this.setData({
                [`votingInProgress.${postId}`]: true,
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
            if (this.tapDisabled && this.tapDisabled()) { return; }
            try {
                console.log('【头像点击】事件触发', e);
                const dataset = extractDataset(e);
                console.log('【头像点击】dataset:', dataset);

                navigateToUserProfileUtil({
                    userId: dataset.userId || dataset.userid || dataset.user || '',
                    authorName: dataset.authorName || '未知用户',
                    isAnonymous: dataset.isAnonymous || false,
                    currentUserId: this.openid || this.getCurrentUserId()
                });
            } catch (err) {
                console.error('【头像点击】处理失败:', err);
                uni.showToast({
                    title: '跳转失败',
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
            // 根据showNormalPostsOnly状态决定筛选参数
            const filterParams = {};
            if (this.showNormalPostsOnly) {
                // 只看普通帖子：排除诗歌和讨论
                filterParams.isPoem = false;
                filterParams.isDiscussion = false;
            }
            // 使用缓存封装的首页分页数据，SWR + TTL
            getHomePosts({ 
                page: this.page, 
                pageSize: PAGE_SIZE, 
                context: this,
                // 首次加载强制刷新，确保最新的组诗分块
                forceRefresh: isFirstLoad,
                ...filterParams
            })
                .then(async (list) => {
                    const postsRaw = Array.isArray(list) ? list : [];
                    console.log('✅ [首页] 获取到帖子数量（缓存封装）:', postsRaw.length);

                    const posts = await processPostList(postsRaw);

                    const self = this;
                    setTimeout(() => {
                        if (self.preloadUserData && typeof self.preloadUserData === 'function') {
                            self.preloadUserData(posts);
                        }
                    }, 500);

                    const newPostsCount = posts.length;
                    // 【修复】首次加载时应该直接替换列表，而不是合并，避免数据重复
                    const currentPostList = this.postList;
                    // 【修复】加载更多时去重，避免重复key警告
                    const existingIds = new Set(currentPostList.map(p => p._id));
                    const uniqueNewPosts = posts.filter(p => !existingIds.has(p._id));
                    const newPostList = isFirstLoad ? posts : currentPostList.concat(uniqueNewPosts);
                    const updateData = {
                        postList: newPostList,
                        page: this.page + 1,
                        hasMore: newPostsCount === PAGE_SIZE
                    };
                    console.log('✅ [首页] 更新数据（缓存封装）:', {
                        isFirstLoad,
                        newPostListLength: newPostList.length,
                        currentPostListLength: currentPostList.length,
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

                try { syncLikeStatusForPosts(allPostIds); } catch (_) {}
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

        // 切换只看普通帖子模式
        toggleNormalPostsFilter: function () {
                        if (this.tapDisabled && this.tapDisabled()) { return; }
            const newMode = !this.showNormalPostsOnly;
            console.log('【首页】切换只看普通帖子模式:', newMode);
            
            // 清除新模式的缓存，确保强制从云端刷新
            try {
                if (newMode) {
                    // 切换到"只看普通帖子"模式，清除普通帖子模式的缓存
                    invalidateHomePosts({ isPoem: false, isDiscussion: false });
                } else {
                    // 切换到"显示全部"模式，清除全部模式的缓存
                    invalidateHomePosts({});
                }
                console.log('✅ [首页] 已清除新模式缓存，准备强制刷新');
            } catch (e) {
                console.error('❌ [首页] 清除缓存失败:', e);
            }
            
            // 准备筛选参数（基于新状态）
            const filterParams = newMode ? {
                isPoem: false,
                isDiscussion: false
            } : {};
            
            // 先更新状态，使用setData的回调确保状态更新后再加载数据
            // 注意：不要设置 isLoading: true，让 getPostList 自己设置，否则会被防重入检查阻止
            this.setData({
                showNormalPostsOnly: newMode,
                postList: [],
                page: 0,
                hasMore: true,
                isLoading: false,
                isLoadingMore: false
            }, () => {
                // 状态更新完成后再强制从云端刷新数据
                this.getPostList();
            });
        },

        // 切换推荐流
        toggleRecommendFeed: function () {
            if (this.tapDisabled && this.tapDisabled()) { return; }
            const newMode = !this.useRecommendFeed;
            console.log('【首页】切换推荐流:', newMode);

            this.setData({
                useRecommendFeed: newMode
            }, () => {
                if (newMode) {
                    this.refreshDiscoverPosts();
                } else if (this.postList.length === 0) {
                    this.setData({
                        page: 0,
                        hasMore: true,
                        isLoading: false,
                        isLoadingMore: false
                    }, () => {
                        this.getPostList();
                    });
                }
            });
        },

        // 标签点击处理
        onTagClick: function (e) {
            const tag = e.currentTarget.dataset.tag;
            navigateToTagFilter(tag);
        },

        // 评论点击处理
        onCommentClick: function (e) {
            const postId = e.currentTarget.dataset.postid;
            navigateToPostDetail(postId);
        },

        // ========== PostItem 组件事件适配方法 ==========
        
        // 处理用户头像点击（适配 PostItem 组件）
        handleNavigateToUser: function (data) {
            if (this.tapDisabled && this.tapDisabled()) { return; }
            navigateToUserProfileUtil({
                userId: data.userId,
                authorName: data.authorName || '未知用户',
                isAnonymous: data.isAnonymous || false,
                currentUserId: this.openid || this.getCurrentUserId()
            });
        },

        // 处理图片预览（适配 PostItem 组件）
        handlePreviewImage: function (data) {
            console.log('【index】处理图片预览:', {
                current: data.src,
                urls: data.urls,
                urlsLength: data.urls ? data.urls.length : 0
            });
            previewImage({
                current: data.src,
                urls: data.urls
            });
        },

        // 处理标签点击（适配 PostItem 组件）
        handleTagClick: function (data) {
            navigateToTagFilter(data.tag);
        },

        // 处理点赞（适配 PostItem 组件）
        handleVote: function (data) {
            // 构造兼容原 onVote 方法的事件对象
            const fakeEvent = {
                currentTarget: {
                    dataset: {
                        postid: data.postId,
                        index: data.index,
                        listType: data.listType
                    }
                }
            };
            this.onVote(fakeEvent);
        },

        // 处理评论点击（适配 PostItem 组件）
        handleCommentClick: function (data) {
            navigateToPostDetail(data.postId);
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

                const result = await getContentPoemFeed({
                    excludePostIds: currentExcludeIds,
                    page,
                    pageSize: DISCOVER_PAGE_SIZE,
                    context: this,
                    debugEmbedding: true
                });

                const rawPosts = Array.isArray(result) ? result : (Array.isArray(result?.posts) ? result.posts : []);
                const embeddingDebug = result && result.debug && result.debug.embedding;
                if (embeddingDebug) {
                    console.log('[poem-content-reco] embedding debug', embeddingDebug);
                } else {
                    console.log('[poem-content-reco] embedding debug missing', {
                        hasResult: !!result,
                        hasDebug: !!(result && result.debug)
                    });
                }
                console.log('获取推荐数据结果（分页）: page=', page, '条数=', rawPosts.length, 'hasMore=', result?.hasMore);

                // 使用统一的处理函数
                let normalizedPosts = await processPostList(rawPosts);

                // 双重保险去重
                normalizedPosts = normalizedPosts.filter((post) => post && post._id && !excludeSet.has(post._id));

                if (!normalizedPosts.length) {
                    console.log('暂无新的推荐内容');
                    const hasMoreFromServer = !!(result && result.hasMore);
                    this.setData({
                        discoverPostList: page === 0 ? [] : this.discoverPostList,
                        discoverHasMore: hasMoreFromServer,
                        discoverRefreshTime: Date.now(),
                        discoverIsLoading: false,
                        discoverIsLoadingMore: false,
                        discoverPage: hasMoreFromServer ? page + 1 : page,
                        discoverHasEverLoaded: true
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
                // 处理分页数据，避免重复
                const combined = page === 0 ? normalizedPosts : (() => {
                    const existingIds = new Set(currentList.map(p => p._id));
                    const uniqueNewList = normalizedPosts.filter(p => p && p._id && !existingIds.has(p._id));
                    return currentList.concat(uniqueNewList);
                })();

                // 记录已显示的帖子ID，并控制上限
                const newShownIds = normalizedPosts.map((post) => post._id).filter(Boolean);
                const mergedSet = new Set(currentExcludeIds);
                newShownIds.forEach((id) => mergedSet.add(id));
                const updatedShownIds = Array.from(mergedSet).slice(-MAX_DISCOVER_EXCLUDE_IDS);

                const hasMoreFromServer = !!(result && result.hasMore);
                const hasMore = (normalizedPosts.length > 0) || hasMoreFromServer;

                this.setData({
                    discoverPostList: combined,
                    discoverPage: page + 1,
                    discoverHasMore: (normalizedPosts.length >= DISCOVER_PAGE_SIZE) || hasMore,
                    discoverShownPostIds: updatedShownIds,
                    discoverRefreshTime: Date.now(),
                    discoverHasEverLoaded: true
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
                    discoverIsLoadingMore: false,
                    discoverHasEverLoaded: true,
                    isRefreshing: false
                });
            }
        },

        // 刷新发现页推荐
        refreshDiscoverPosts: function () {
            console.log('刷新发现页推荐');

            // 清理缓存，避免返回旧数据
            try {
                invalidateContentPoemFeed();
            } catch (e) {
                console.warn('清理发现页缓存失败:', e);
            }

            // 重置状态，并清空已展示ID，避免推荐流被旧排除列表“卡住”
            this.setData({
                discoverPostList: [],
                discoverPage: 0,
                discoverHasMore: true,
                discoverShownPostIds: [],
                discoverRefreshTime: Date.now(),
                discoverIsLoading: false,
                discoverIsLoadingMore: false,
                discoverHasEverLoaded: false
            });

            // 重新加载推荐
            this.loadRecommendationPosts();
        },

        // 加载讨论页数据
        loadDiscussionPosts: function (callback, forceRefresh = false) {
            console.log('开始加载讨论页数据', forceRefresh ? '(强制刷新)' : '');

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

            getDiscussionPosts({
                page: this.discussionPage,
                pageSize: PAGE_SIZE,
                context: this,
                forceRefresh: forceRefresh,
                // SWR后台更新回调：讨论页后台更新完成时调用
                onBackgroundUpdate: async (newPosts) => {
                    console.log('🔄 [SWR-Discussion] 后台更新完成', newPosts?.length);
                    if (Array.isArray(newPosts) && newPosts.length > 0 && this.currentPage === 'discussion') {
                        try {
                            const processedPosts = await processPostList(newPosts);
                            // 只在数据有变化时更新
                            const currentPostIds = this.discussionPostList.slice(0, PAGE_SIZE).map(p => p._id).join(',');
                            const newPostIds = processedPosts.map(p => p._id).join(',');
                            if (currentPostIds !== newPostIds) {
                                const existingLaterPosts = this.discussionPostList.slice(PAGE_SIZE);
                                this.setData({
                                    discussionPostList: [...processedPosts, ...existingLaterPosts]
                                });
                                console.log('✨ [SWR-Discussion] 页面数据已后台更新');
                            }
                        } catch (error) {
                            console.error('❌ [SWR-Discussion] 处理后台更新数据失败:', error);
                        }
                    }
                }
            }).then(async (posts) => {
                if (posts && posts.length > 0) {
                    const processedPosts = await processPostList(posts);

                    // 处理分页数据，避免重复
                    const currentList = this.discussionPage === 0 ? [] : this.discussionPostList;
                    const existingIds = new Set(currentList.map(p => p._id));
                    const uniqueNewList = processedPosts.filter(p => p && p._id && !existingIds.has(p._id));
                    const newList = currentList.concat(uniqueNewList);

                    this.setData({
                        discussionPostList: newList,
                        discussionPage: this.discussionPage + 1,
                        discussionHasMore: processedPosts.length === PAGE_SIZE,
                        discussionIsLoading: false,
                        discussionIsLoadingMore: false,
                        discussionHasEverLoaded: true
                    });

                    console.log('讨论页数据加载完成，帖子数量:', processedPosts.length, '累计:', newList.length);

                    // 预加载用户数据
                    if (isInitialLoad) {
                        setTimeout(() => {
                            if (this.preloadUserData && typeof this.preloadUserData === 'function') {
                                this.preloadUserData(processedPosts);
                            }
                        }, 500);
                    }

                    // 调用回调函数（用于刷新完成通知）
                    if (callback && typeof callback === 'function') {
                        callback();
                    }
                } else {
                    this.setData({
                        discussionIsLoading: false,
                        discussionIsLoadingMore: false,
                        discussionHasMore: false,
                        discussionHasEverLoaded: true
                    });
                    if (isInitialLoad) {
                        uni.showToast({
                            title: '暂无讨论内容',
                            icon: 'none'
                        });
                    }
                    // 调用回调函数（用于刷新完成通知）
                    if (callback && typeof callback === 'function') {
                        callback();
                    }
                }
            }).catch((err) => {
                console.error('加载讨论页数据失败:', err);
                this.setData({
                    discussionIsLoading: false,
                    discussionIsLoadingMore: false,
                    discussionHasEverLoaded: true
                });
                uni.showToast({
                    title: '加载失败',
                    icon: 'none'
                });
                // 调用回调函数（用于刷新完成通知）
                if (callback && typeof callback === 'function') {
                    callback();
                }
            });
        },

        // 刷新讨论页数据
        refreshDiscussionPosts: function (callback) {
            console.log('刷新讨论页数据');

            // 清理缓存
            try {
                invalidateDiscussionPosts();
            } catch (e) {
                console.warn('清理讨论页缓存失败:', e);
            }

            this.setData({
                discussionPostList: [],
                discussionPage: 0,
                discussionHasMore: true,
                discussionIsLoading: false,
                discussionIsLoadingMore: false
            });

            // 强制刷新
            this.loadDiscussionPosts(callback, true);
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

        
        // 空函数，用于阻止匿名帖子的头像点击事件
        noop() {},

        // 关注用户选择处理
        onFollowingUserSelect: function (userId) {
            console.log('选择关注用户:', userId);

            // 如果选择的用户没变，不做处理
            if (this.followingSelectedUserId === userId) {
                return;
            }

            // 更新选中状态并重新加载帖子
            this.setData({
                followingSelectedUserId: userId,
                followingPostList: [],
                followingPage: 0,
                followingHasMore: true,
                followingIsLoading: false,
                followingIsLoadingMore: false,
                followingHasEverLoaded: false
            }, () => {
                // 移除强制刷新参数，让缓存机制生效
                this.loadFollowingPosts(null, false);
            });
        },

        // 关注头像栏返回按钮点击（取消用户筛选，回到全部）
        onFollowingAvatarBarBack: function () {
            console.log('关注头像栏返回按钮点击');

            // 如果已经是全部状态，不做处理
            if (!this.followingSelectedUserId) {
                return;
            }

            // 取消用户筛选
            this.setData({
                followingSelectedUserId: null,
                followingPostList: [],
                followingPage: 0,
                followingHasMore: true,
                followingIsLoading: false,
                followingIsLoadingMore: false,
                followingHasEverLoaded: false
            }, () => {
                // 移除强制刷新参数，让缓存机制生效
                this.loadFollowingPosts(null, false);
            });
        },

        // 加载关注页数据
        loadFollowingPosts: function (callback, forceRefresh = false) {
            console.log('开始加载关注页数据', forceRefresh ? '(强制刷新)' : '', this.followingSelectedUserId ? `(筛选用户: ${this.followingSelectedUserId})` : '');

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

            getFollowingPosts({
                page: this.followingPage,
                pageSize: PAGE_SIZE,
                context: this,
                forceRefresh: forceRefresh,
                filterByUserId: this.followingSelectedUserId || undefined,
                // SWR后台更新回调：关注页后台更新完成时调用
                onBackgroundUpdate: async (newPosts) => {
                    console.log('🔄 [SWR-Following] 后台更新完成', newPosts?.length);
                    if (Array.isArray(newPosts) && newPosts.length > 0 && this.currentPage === 'following' && this.swiperCurrent === 1) {
                        try {
                            // 使用统一处理函数，启用缓存点赞状态
                            const processedPosts = await processPostList(newPosts, { useCachedLikeStatus: true });
                            // 只在数据有变化时更新
                            const currentPostIds = this.followingPostList.slice(0, PAGE_SIZE).map(p => p._id).join(',');
                            const newPostIds = processedPosts.map(p => p._id).join(',');
                            if (currentPostIds !== newPostIds) {
                                const existingLaterPosts = this.followingPostList.slice(PAGE_SIZE);
                                this.setData({
                                    followingPostList: [...processedPosts, ...existingLaterPosts]
                                });
                                console.log('✨ [SWR-Following] 页面数据已后台更新');
                            }
                        } catch (error) {
                            console.error('❌ [SWR-Following] 处理后台更新数据失败:', error);
                        }
                    }
                }
            }).then(async (posts) => {
                if (posts && posts.length > 0) {
                    // 使用统一处理函数，优先使用本地缓存中的点赞状态
                    const processedPosts = await processPostList(posts, { useCachedLikeStatus: true });

                    // 处理分页数据，避免重复
                    const currentList = this.followingPage === 0 ? [] : this.followingPostList;
                    const existingIds = new Set(currentList.map(p => p._id));
                    const uniqueNewList = processedPosts.filter(p => p && p._id && !existingIds.has(p._id));
                    const newList = currentList.concat(uniqueNewList);

                    this.setData({
                        followingPostList: newList,
                        followingPage: this.followingPage + 1,
                        followingHasMore: processedPosts.length === PAGE_SIZE,
                        followingIsLoading: false,
                        followingIsLoadingMore: false,
                        followingHasEverLoaded: true
                    });

                    console.log('关注页数据加载完成，帖子数量:', processedPosts.length, '累计:', newList.length);

                    // 将云函数返回的点赞状态更新到缓存中
                    try {
                        const updateLikeStatus = likeSync.updateLikeStatus;
                        posts.forEach((post) => {
                            if (post._id && (post.isVoted !== undefined || post.votes !== undefined)) {
                                updateLikeStatus(post._id, post.votes || 0, post.isVoted || false);
                            }
                        });
                    } catch (e) {
                        console.warn('关注页更新点赞状态到缓存失败:', e);
                    }

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
                                this.preloadUserData(processedPosts);
                            }
                        }, 500);
                    }

                    // 调用回调函数（用于刷新完成通知）
                    if (callback && typeof callback === 'function') {
                        callback();
                    }
                } else {
                    this.setData({
                        followingIsLoading: false,
                        followingIsLoadingMore: false,
                        followingHasMore: false,
                        followingHasEverLoaded: true
                    });
                    if (isInitialLoad) {
                        uni.showToast({
                            title: '暂无关注的人发帖',
                            icon: 'none'
                        });
                    }
                    // 调用回调函数（用于刷新完成通知）
                    if (callback && typeof callback === 'function') {
                        callback();
                    }
                }
            }).catch((err) => {
                console.error('加载关注页数据失败:', err);
                this.setData({
                    followingIsLoading: false,
                    followingIsLoadingMore: false,
                    followingHasEverLoaded: true
                });
                uni.showToast({
                    title: '加载失败',
                    icon: 'none'
                });
                // 调用回调函数（用于刷新完成通知）
                if (callback && typeof callback === 'function') {
                    callback();
                }
            });
        },

        // 刷新关注页数据
        refreshFollowingPosts: function (callback) {
            console.log('刷新关注页数据');

            // 清理缓存
            try {
                invalidateFollowingPosts();
            } catch (e) {
                console.warn('清理关注页缓存失败:', e);
            }

            // 刷新时重置用户筛选，回到全部状态
            this.setData({
                followingPostList: [],
                followingPage: 0,
                followingHasMore: true,
                followingIsLoading: false,
                followingIsLoadingMore: false,
                followingSelectedUserId: null
            });

            // 刷新头像栏
            try {
                if (this.$refs.followingAvatarBar && this.$refs.followingAvatarBar.refresh) {
                    this.$refs.followingAvatarBar.refresh();
                }
            } catch (e) {
                console.warn('刷新头像栏失败:', e);
            }

            // 强制刷新
            this.loadFollowingPosts(callback, true);
        },


        // --- touch / scroll guards ---
        onTouchStart(e) {
            try {
                const t = (e && e.touches && e.touches[0]) || (e && e.changedTouches && e.changedTouches[0]);
                if (!t) return;
                this.touchStartX = t.clientX || t.pageX || 0;
                this.touchStartY = t.clientY || t.pageY || 0;
                this.touchMoved = false;
            } catch (_) {}
        },
        onTouchMove(e) {
            try {
                const t = (e && e.touches && e.touches[0]) || (e && e.changedTouches && e.changedTouches[0]);
                if (!t) return;
                const dx = (t.clientX || t.pageX || 0) - (this.touchStartX || 0);
                const dy = (t.clientY || t.pageY || 0) - (this.touchStartY || 0);
                if (Math.abs(dx) + Math.abs(dy) > 8) {
                    this.touchMoved = true;
                    if (typeof this.kickScrollGuard === 'function') this.kickScrollGuard();
                }
            } catch (_) {}
        },
        onTouchEnd() {
            if (this.touchMoved || this.isTouchScrolling) {
                if (typeof this.kickScrollGuard === 'function') this.kickScrollGuard();
            }
        },
        tapDisabled() {
            try {
                if (this.isTouchScrolling) return true;
                if (this.lastScrollTime && (Date.now() - this.lastScrollTime) < 300) return true;
            } catch (_) {}
            return false;
        },
        // Centralized guard to mark scrolling and clear after a quiet period
        kickScrollGuard() {
            try {
                this.isTouchScrolling = true;
                this.lastScrollTime = Date.now();
                if (this.hoverResetTimer) {
                    clearTimeout(this.hoverResetTimer);
                    this.hoverResetTimer = null;
                }
                this.hoverResetTimer = setTimeout(() => {
                    this.isTouchScrolling = false;
                }, 350);
            } catch (_) {}
        }
    }
};
</script>
<style>
.page-wrapper {
    height: 100vh;
    width: 100vw;
    overflow: hidden;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
}

.container {
    /* #ifdef APP-PLUS */
    padding-top: 276rpx;
    /* #endif */
    /* #ifdef H5 */
    padding-top: 200rpx;
    /* #endif */
    padding-bottom: 100rpx;
    background-color: #ffffff;
    min-height: 100vh;
    position: relative;
    overflow: hidden;
    overscroll-behavior: none;
    height: 100vh;
    box-sizing: border-box;
}


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

.list-mode-container,
.list-content {
    display: block;
}

.square-mode-container {
    display: block;
    /* padding-top 通过内联样式动态设置 */
    height: 100%;
    overflow: hidden;
    position: relative;
    z-index: 1;
}

#post-list-container,
#following-list-container,
#discussion-list-container {
    padding-top: 0;
    box-sizing: border-box;
}

.swiper-page .empty-state {
    /* #ifdef APP-PLUS */
    margin-top: 160rpx;
    /* #endif */
    /* #ifdef H5 */
    margin-top: 100rpx;
    /* #endif */
}

.post-item-wrapper {
    background: #fff;
    margin-bottom: 20rpx;
    padding: 0;
    box-shadow: none;
    border-radius: 0;
    border-bottom: 1rpx solid #f0f0f0;
}

.post-item-wrapper.original-post {
    background: linear-gradient(180deg, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 0) 90%, rgba(235, 200, 141, 0.05) 95%, rgba(235, 200, 141, 0.08) 100%);
    border-left: 3rpx solid #ebc88d;
    position: relative;
}

.post-content-navigator {
    display: block;
    background: transparent;
}

.navigator-hover {
    background-color: rgba(0, 0, 0, 0.02);
}

.is-scrolling .navigator-hover {
    background-color: transparent !important;
}
.is-scrolling .post-image:active,
.is-scrolling .post-tag:active,
.is-scrolling .filter-toggle-btn:active,
.is-scrolling .like-icon-container:active {
    transform: none !important;
    opacity: 1 !important;
    background: transparent !important;
}
.is-scrolling .post-item-wrapper :active {
    transform: none !important;
    opacity: 1 !important;
    background: transparent !important;
}
.is-scrolling .post-image,
.is-scrolling .like-icon,
.is-scrolling .like-icon-container,
.is-scrolling .filter-toggle-btn,
.is-scrolling .post-item-wrapper,
.is-scrolling .post-content-navigator {
    transition: none !important;
}

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

.loading-footer {
    text-align: center;
    padding: 20rpx 0;
    color: #999;
    font-size: 14px;
}

.filter-toggle-container {
    padding: 20rpx 30rpx;
    position: relative;
    z-index: 1;
    display: flex;
    justify-content: flex-end;
    gap: 16rpx;
}

.filter-toggle-btn {
    padding: 12rpx 32rpx;
    border-radius: 50rpx;
    background: transparent;
    border: 2rpx solid #e0e0e0;
    transition: all 0.3s ease;
    cursor: pointer;
    box-shadow: none;
    min-width: 140rpx;
    text-align: center;
    display: inline-block;
}

.filter-toggle-btn:active {
    transform: scale(0.95);
}

.filter-toggle-btn.active {
    background: transparent;
    border: 2rpx solid #e0e0e0;
    box-shadow: none;
}

.filter-toggle-text {
    font-size: 26rpx;
    color: #666;
    font-weight: 600;
    line-height: 1.2;
}

.filter-toggle-btn.active .filter-toggle-text {
    color: #666;
}

.end-tip {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40rpx 20rpx;
    color: #999;
}

.end-text {
    font-size: 28rpx;
    color: #999;
    text-align: center;
}

.page-swiper {
    /* #ifdef APP-PLUS */
    height: calc(100vh - 276rpx - 100rpx);
    /* #endif */
    /* #ifdef H5 */
    height: calc(100vh - 188rpx - 100rpx);
    /* #endif */
    width: 100%;
    overflow: hidden;
    overscroll-behavior: none;
    position: relative;
    /* 低于 tabs，但保留自身事件 */
    z-index: 2;
}

.swiper-page {
    height: 100%;
    position: relative;
    z-index: 2;
}

.swiper-page > view:first-child {
    /* #ifdef APP-PLUS */
    margin-top: 40rpx;
    /* #endif */
    /* #ifdef H5 */
    margin-top: 10rpx;
    /* #endif */
}

.refresh-text {
    font-size: 24rpx;
    color: #ffc107;
    font-weight: 500;
}

.swiper-page .uni-pull-refresh-spinner,
.swiper-page .wx-pull-refresh-spinner {
    color: #999999 !important;
    border-color: #999999 !important;
}

.swiper-page .uni-pull-refresh,
.swiper-page .wx-pull-refresh {
    background: transparent;
}
</style>
