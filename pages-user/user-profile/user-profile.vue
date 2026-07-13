<template>
    <!-- pages/user-profile/user-profile.wxml -->
    <view
        class="user-profile-page-root"
        :class="{ 'user-profile-page-root--with-background': isFullBackground }"
        :style="userProfileRootStyle"
        :data-layout-recovery-tick="layoutRecoveryTick"
    >
        <view v-if="isFullBackground" class="user-profile-bg-image"></view>
        <view v-if="isFullBackground" class="user-profile-bg-overlay"></view>
        <view class="container" :class="{ 'container--with-background': hasAppBackground }">

        <!-- 骨架屏：当 isLoading 为 true 时显示 -->
        <view v-if="isLoading" class="user-profile-loading-state">
            <skeleton pageType="user-profile" />
        </view>

        <!-- 主要内容 -->
        <view
            v-else
            class="main-content"
            :class="{
                'main-content--with-background': isFullBackground,
                'main-content--header-background': isHeaderBackground
            }"
        >
            <!-- User Profile Card -->
            <view
                class="profile-hero-section"
                :class="{ 'profile-hero-section--with-background': isHeaderBackground }"
                :style="profileHeroStyle"
            >
                <view v-if="isHeaderBackground" class="profile-hero-bg-image"></view>
                <view v-if="isHeaderBackground" class="profile-hero-bg-overlay"></view>
                <view class="profile-back-btn" @tap="navigateBack">
                    <text class="profile-back-icon">‹</text>
                </view>
            <view class="profile-card profile-card-center">
                <view v-if="userInfo && userInfo.showGrowthStats === true" class="profile-growth-stats">
                    <view class="growth-item">
                        <image class="growth-icon" src="/static/images/seedplus.png" mode="aspectFit" alt="种子" title="种子"></image>
                        <text class="growth-count">{{ growthStats.seed }}</text>
                    </view>
                    <view class="growth-item">
                        <image class="growth-icon" src="/static/images/leafplus.png" mode="aspectFit" alt="叶子" title="叶子"></image>
                        <text class="growth-count">{{ growthStats.leaf }}</text>
                    </view>
                    <view class="growth-item">
                        <image class="growth-icon" src="/static/images/flowerplus.png" mode="aspectFit" alt="花" title="花"></image>
                        <text class="growth-count">{{ growthStats.flower }}</text>
                    </view>
                    <view class="growth-item">
                        <image class="growth-icon" src="/static/images/peachplus.png" mode="aspectFit" alt="桃子" title="桃子"></image>
                        <text class="growth-count">{{ growthStats.peach }}</text>
	                </view>
	            </view>
	                <view class="profile-avatar-large">
                    <image
                        :src="getProfileAvatar(userInfo)"
                        mode="aspectFill"
                        :alt="(userInfo.nickName || '用户') + '头像'"
                        :title="(userInfo.nickName || '用户') + '头像'"
                        @error="onAvatarError"
                    ></image>
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
                                :class="['follow-btn', isMutualFollow ? 'mutual' : (isFollowing ? 'following' : '')]"
                                @tap="onFollowTap"
                                :loading="followPending"
                                :disabled="followPending"
                            >
                                {{ isMutualFollow ? '互相关注' : (isFollowing ? '已关注' : '关注') }}
                            </button>
                            <view v-if="!showFollowButton && isMutualFollow" class="mutual-indicator">互相关注</view>
                            <view v-else-if="!showFollowButton && isFollowedByTarget" class="followed-indicator">TA关注了你</view>
                            <button
                                v-if="showBlockButton"
                                :class="['block-btn', isBlocked ? 'blocked' : '']"
                                @tap="onBlockTap"
                                :loading="blockPending"
                                :disabled="blockPending"
                            >
                                {{ isBlocked ? '已屏蔽' : '屏蔽' }}
                            </button>
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
            </view>
            <view v-if="isHeaderBackground" class="profile-body-shell-cap"></view>
            <view
                class="profile-body-shell"
                :class="{
                    'profile-body-shell--header-background': isHeaderBackground,
                    'profile-body-shell--full-background': isFullBackground
                }"
            >
            <view class="tab-navigation">
                <view :class="'tab-item ' + (currentTab === 'posts' ? 'active' : '')" data-tab="posts" @tap="switchTab">
                    <image class="tab-icon tab-icon--writing" src="/static/images/writing.png" mode="aspectFit" alt="帖子" title="帖子"></image>
                </view>
                <view :class="'tab-item ' + (currentTab === 'portfolio' ? 'active' : '')" data-tab="portfolio" @tap="switchTab">
                    <image class="tab-icon" src="/static/images/newicons/library.png" mode="aspectFit" alt="作品集" title="作品集"></image>
                </view>
                <view :class="'tab-item ' + (currentTab === 'favorites' ? 'active' : '')" data-tab="favorites" @tap="switchTab">
                    <image class="tab-icon" src="/static/images/newicons/collection.png" mode="aspectFit" alt="收藏" title="收藏"></image>
                </view>
            </view>

            <!-- 他人帖子（与个人主页一致的样式） -->
            <view class="my-posts-section" v-if="currentTab === 'posts'">
                <block v-if="userPosts.length > 0">
                    <PostItem
                        v-for="(item, index) in userPosts"
                        :key="item._id || index"
                        :item="item"
                        :index="index"
                        :swiper-height="swiperHeights[item._id] || swiperHeights[index]"
                        :show-menu="false"
                        :show-poem-author="false"
                        :profile-preview="true"
                        time-label="发布于"
                        time-field="formattedCreateTime"
                        @avatar-error="onAvatarError"
                        @avatar-load="onAvatarLoad"
                        @navigate-to-user="handleNavigateToUser"
                        @preview-image="handlePreview"
                        @image-error="onImageError"
                        @image-load="onImageLoad"
                        @tag-click="onTagClick"
                    />
                    <view class="loading-footer">
                        <block v-if="!hasMore && userPosts.length > 0">
                            <text>--- 我是有底线的 ---</text>
                        </block>
                    </view>
                    <view style="height: 200rpx"></view>
                </block>
                <!-- 骨架屏：数据未加载完成时显示 -->
                <view v-else-if="!postsHasEverLoaded">
                    <skeleton pageType="user-posts" />
                </view>
                <!-- 真正的空状态 -->
                <view v-else class="empty-tip"><text>TA还没有发布内容哦～</text></view>
            </view>

            <!-- 他人作品集 -->
            <view class="portfolio-section" v-if="currentTab === 'portfolio'">
                <!-- 作品集书籍组件 -->
                <PortfolioBook
                    :portfolioList="portfolioList"
                    :emptyText="'TA还没有创建作品集'"
                    @open-portfolio="openPortfolio"
                    @navigate-to-portfolio="navigateToPortfolio"
                />

                <!-- 加载状态 -->
                <view v-if="portfolioLoading" class="loading-tip">
                    <text>加载中...</text>
                </view>
  
                <!-- 时间轴组件 -->
                <TimelineView
                    :timelinePosts="timelinePosts"
                    :timelineGroups="timelineGroups"
                    v-model:collapsed-months="collapsedMonths"
                    :isLoading="timelineLoading"
                    :hasError="timelineError"
                    :title="'TA的创作时间轴'"
                    @navigate-to-post="navigateToPostDetail"
                    @retry="loadTimelineData"
                />
            </view>

            <!-- 他人收藏 -->
            <view class="favorites-section" v-if="currentTab === 'favorites'">
                <block v-if="favoriteList.length > 0">
                    <PostItem
                        v-for="(item, index) in favoriteList"
                        :key="item._id || item.postId || index"
                        :item="item"
                        :index="index"
                        :swiper-height="swiperHeights[item._id] || swiperHeights[index]"
                        :show-menu="false"
                        :show-poem-author="true"
                        :profile-preview="true"
                        time-label="收藏于"
                        time-field="formattedFavoriteTime"
                        @avatar-error="onAvatarError"
                        @avatar-load="onAvatarLoad"
                        @navigate-to-user="handleNavigateToUser"
                        @preview-image="handlePreview"
                        @image-error="onImageError"
                        @image-load="onImageLoad"
                        @tag-click="onTagClick"
                    />
                    <view class="loading-footer">
                        <block v-if="!favoriteHasMore && favoriteList.length > 0">
                            <text>--- 我是有底线的 ---</text>
                        </block>
                    </view>
                    <view style="height: 200rpx"></view>
                </block>
                <!-- 骨架屏：数据未加载完成时显示 -->
                <view v-else-if="!favoritesHasEverLoaded">
                    <skeleton pageType="user-favorites" />
                </view>
                <!-- 真正的空状态 -->
                <view v-else-if="!favoriteLoading" class="empty-tip">
                    <text>TA还没有收藏内容</text>
                </view>
                <!-- 加载更多时显示 -->
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
                                                :alt="item.title || item.content || '帖子图片'"
                                                :title="item.title || item.content || '帖子图片'"
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
                                    :alt="item.title || item.content || '帖子图片'"
                                    :title="item.title || item.content || '帖子图片'"
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
	    </view>
    </view>
</template>

<script>
import { getUserInfo, getUserPosts, getUserPortfolios, getUserFavorites, invalidateUserInfo, invalidateUserPosts, invalidateUserPortfolios, invalidateUserFavorites } from '@/api-cache/user-profile.js';
import { hydrateTempUrls, warmTempUrlsFromPosts } from '../../_utils/hydrate-temp-urls';
import { groupPostsByMonth, processPostsForTimeline, formatMonthLabel, formatDateLabel, toggleMonthCollapse } from '@/utils/timeline.js';
import { calcBookHeight, calcShelfLineWidth } from '@/utils/bookLayout.js';
import { extractGrowthStats } from '@/utils/growthStats.js';
import skeleton from '@/components/skeleton/skeleton';
import TimelineView from '@/components/TimelineView.vue';
import PortfolioBook from '@/components/PortfolioBook.vue';
import PostItem from '@/components/PostItem.vue';
import { normalizeAppBackgroundMode, normalizeAppBackgroundUrl } from '@/utils/appBackground.js';
import { resolvePostAuthorAvatar, resolveUserObjectAvatar } from '@/utils/defaultAvatar.js';
import {
    checkFollowRelation,
    checkBlockRelation,
    toggleBlockRelation,
    getFollowCounts
} from '@/api-cache/relation.js';
import { formatRelativeTime } from '../../utils/time.js';
import avatarCache from '../../cache/stores/avatar.js';
import followCache from '../../cache/stores/follow.js';
import { previewImage } from '../../utils/imagePreview.js';
import postGalleryMixin from '../../mixins/postGallery.js';
import fileUrlCache from '../../_utils/file-url-cache.js';
import { invalidateHomePosts } from '../../api-cache/home-posts.js';
import { clearDiscoverCache } from '../../api-cache/discover.js';
const PAGE_SIZE = 5;
const USER_PROFILE_FULL_BACKGROUND_THEME_VARS = Object.freeze({
    '--app-post-wrapper-bg': 'linear-gradient(90deg, rgba(235, 200, 141, 0.05) 0%, rgba(255, 255, 255, 0) 100%)',
    '--app-post-wrapper-shadow': '0 8rpx 24rpx rgba(0, 0, 0, 0.10)',
    '--app-post-wrapper-radius': '20rpx',
    '--app-post-section-bg': 'transparent',
    '--app-subtle-surface-bg': 'rgba(255, 255, 255, 0.58)',
    '--app-surface-bg': 'transparent',
    '--app-surface-divider': 'rgba(17, 17, 17, 0.18)',
    '--app-surface-shadow': '0 8rpx 24rpx rgba(0, 0, 0, 0.08)',
    '--app-surface-border-line': '1rpx solid rgba(255, 255, 255, 0.30)',
    '--app-surface-title-color': 'rgba(17, 17, 17, 0.96)',
    '--app-surface-text-color': 'rgba(17, 17, 17, 0.84)',
    '--app-surface-meta-color': 'rgba(17, 17, 17, 0.70)',
    '--app-surface-accent-color': '#6f8065',
    '--app-post-author-color': 'rgba(17, 17, 17, 0.92)',
    '--app-post-title-color': 'rgba(17, 17, 17, 0.98)',
    '--app-post-content-color': 'rgba(17, 17, 17, 0.86)',
    '--app-post-time-color': 'rgba(17, 17, 17, 0.70)',
    '--app-post-poem-author-color': 'rgba(17, 17, 17, 0.92)',
    '--app-post-menu-dot-color': 'rgba(17, 17, 17, 0.50)',
    '--profile-poemid-color': 'rgba(17, 17, 17, 0.70)',
    '--profile-meta-color': 'rgba(17, 17, 17, 0.74)',
    '--profile-name-color': 'rgba(17, 17, 17, 0.98)',
    '--profile-bio-color': 'rgba(17, 17, 17, 0.92)',
    '--profile-tab-nav-bg': 'transparent',
    '--profile-tab-nav-border': 'transparent',
    '--profile-tab-nav-shadow': 'none',
    '--profile-tab-item-bg': 'transparent',
    '--profile-tab-item-active-bg': 'transparent',
    '--profile-tab-indicator-color': 'rgba(17, 17, 17, 0.88)',
    '--profile-tab-icon-filter': 'grayscale(0.35) brightness(0.60)',
    '--profile-tab-icon-opacity': '0.96',
    '--profile-tab-icon-active-filter': 'grayscale(0) brightness(0.98) contrast(1.02)',
    '--profile-tab-icon-active-opacity': '1',
    '--profile-empty-surface-bg': 'rgba(255, 255, 255, 0.72)',
    '--profile-empty-surface-border': '1rpx solid rgba(255, 255, 255, 0.30)',
    '--profile-empty-surface-shadow': '0 8rpx 24rpx rgba(0, 0, 0, 0.08)',
    '--profile-empty-text-color': 'rgba(17, 17, 17, 0.70)',
    '--profile-loading-footer-color': 'rgba(17, 17, 17, 0.70)'
});
const USER_PROFILE_BACKGROUND_THEME_VARS = Object.freeze({
    '--profile-poemid-color': 'rgba(255, 255, 255, 0.76)',
    '--profile-meta-color': 'rgba(255, 255, 255, 0.82)',
    '--profile-name-color': '#ffffff',
    '--profile-bio-color': 'rgba(255, 255, 255, 0.92)',
    '--user-profile-name-color': '#ffffff',
    '--user-profile-poemid-color': 'rgba(255, 255, 255, 0.78)',
    '--user-profile-bio-color': 'rgba(255, 255, 255, 0.92)',
    '--user-profile-meta-color': 'rgba(255, 255, 255, 0.82)',
    '--user-profile-pill-bg': 'rgba(255, 255, 255, 0.18)',
    '--user-profile-pill-text': '#ffffff',
    '--user-profile-pill-border': '1rpx solid rgba(255, 255, 255, 0.32)',
    '--user-profile-pill-shadow': '0 10rpx 24rpx rgba(0, 0, 0, 0.14)',
    '--user-profile-muted-pill-bg': 'rgba(255, 255, 255, 0.14)',
    '--user-profile-muted-pill-text': 'rgba(255, 255, 255, 0.86)',
    '--user-profile-muted-pill-border': '1rpx solid rgba(255, 255, 255, 0.28)',
    '--user-profile-accent-pill-bg': 'rgba(255, 255, 255, 0.16)',
    '--user-profile-accent-pill-text': '#ffffff',
    '--user-profile-accent-pill-border': '1rpx solid rgba(255, 255, 255, 0.3)'
});

function escapeCssUrl(url) {
    return String(url || '').replace(/"/g, '\\"');
}
export default {
    components: {
        skeleton,
        TimelineView,
        PortfolioBook,
        PostItem
    },
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
            
            // 屏蔽相关状态
            showBlockButton: false,
            isBlocked: false,
            blockPending: false,
            
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
            favoriteHasMore: true,

            // 成长统计
            growthStats: {
                seed: 0,
                leaf: 0,
                flower: 0,
                peach: 0
            },
            
            // 时间轴相关数据
            timelinePosts: [],
            timelineGroups: {},
            timelineLoading: false,
            timelineError: false,
            collapsedMonths: {}, // 存储每个月份的折叠状态
            
            // 各个部分的加载完成标识符
            postsHasEverLoaded: false,
            portfolioHasEverLoaded: false,
            favoritesHasEverLoaded: false,

            // 返回恢复与异步请求保护
            hasReturnedFromChildPage: false,
            layoutRecoveryTick: 0,
            activeLoadToken: 0,
            postsLoadToken: 0,
            portfolioLoadToken: 0,
            favoritesLoadToken: 0,
            timelineLoadToken: 0,
            followStatusToken: 0,
            blockStatusToken: 0,
            followCountsToken: 0
        };
    },
    computed: {
        resolvedAppBackgroundUrl() {
            return normalizeAppBackgroundUrl(this.userInfo && this.userInfo.appBackgroundUrl);
        },
        backgroundMode() {
            return normalizeAppBackgroundMode(this.userInfo && this.userInfo.appBackgroundMode, this.resolvedAppBackgroundUrl);
        },
        hasAppBackground() {
            return !!this.resolvedAppBackgroundUrl && !!this.backgroundMode;
        },
        isFullBackground() {
            return this.hasAppBackground && this.backgroundMode === 'full';
        },
        isHeaderBackground() {
            return this.hasAppBackground && this.backgroundMode === 'header';
        },
        userProfileRootStyle() {
            const baseStyle = {
                ...(this.appThemeVars || {}),
                '--user-profile-layout-recovery-tick': String(this.layoutRecoveryTick || 0)
            };
            if (!this.isFullBackground) {
                return baseStyle;
            }
            return {
                ...baseStyle,
                ...USER_PROFILE_FULL_BACKGROUND_THEME_VARS,
                '--user-profile-background-image': `url("${escapeCssUrl(this.resolvedAppBackgroundUrl)}")`
            };
        },
        profileHeroStyle() {
            return this.isHeaderBackground
                ? {
                    ...USER_PROFILE_BACKGROUND_THEME_VARS,
                    '--user-profile-background-image': `url("${escapeCssUrl(this.resolvedAppBackgroundUrl)}")`
                }
                : {};
        }
    },
    onLoad: function (options) {
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
        this.recoverUserProfileLayout({ resetGallery: false });
        this.loadUserProfile();
    },
    onShow: function () {
        const shouldResetGallery = this.hasReturnedFromChildPage && (this.postsHasEverLoaded || this.favoritesHasEverLoaded);
        this.recoverUserProfileLayout({ resetGallery: shouldResetGallery });
        this.hasReturnedFromChildPage = false;
    },
    onHide: function () {
        this.hasReturnedFromChildPage = true;
    },
    onUnload: function () {
        this.cancelGuardedRequests();
        this.clearH5PageShellRecoveryTimers();
    },
    onPullDownRefresh: function () {
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
            favoriteHasMore: true,
            growthStats: {
                seed: 0,
                leaf: 0,
                flower: 0,
                peach: 0
            }
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
        beginGuardedRequest(tokenKey, targetUserId = this.targetUserId) {
            const token = (Number(this[tokenKey]) || 0) + 1;
            this[tokenKey] = token;
            return {
                token,
                targetUserId
            };
        },
        isGuardedRequestCurrent(tokenKey, request) {
            return !!request && this[tokenKey] === request.token && this.targetUserId === request.targetUserId;
        },
        cancelGuardedRequests() {
            [
                'activeLoadToken',
                'postsLoadToken',
                'portfolioLoadToken',
                'favoritesLoadToken',
                'timelineLoadToken',
                'followStatusToken',
                'blockStatusToken',
                'followCountsToken'
            ].forEach((tokenKey) => {
                this[tokenKey] = (Number(this[tokenKey]) || 0) + 1;
            });
        },
        cancelChildContentRequests() {
            [
                'postsLoadToken',
                'portfolioLoadToken',
                'favoritesLoadToken',
                'timelineLoadToken',
                'followStatusToken',
                'blockStatusToken',
                'followCountsToken'
            ].forEach((tokenKey) => {
                this[tokenKey] = (Number(this[tokenKey]) || 0) + 1;
            });
        },
        recoverUserProfileLayout({ resetGallery = false } = {}) {
            const nextState = {
                layoutRecoveryTick: (Number(this.layoutRecoveryTick) || 0) + 1
            };
            if (resetGallery) {
                nextState.swiperHeights = {};
                nextState.imageClampHeights = {};
                this.__galleryImageMeta = {};
                this.imageCache = {};
            }
            this.setData(nextState);
            this.scheduleH5PageShellRecovery();
        },
        clearH5PageShellRecoveryTimers() {
            if (!Array.isArray(this._h5PageShellRecoveryTimers)) {
                this._h5PageShellRecoveryTimers = [];
                return;
            }
            this._h5PageShellRecoveryTimers.forEach((timer) => {
                clearTimeout(timer);
            });
            this._h5PageShellRecoveryTimers = [];
        },
        scheduleH5PageShellRecovery() {
            this.clearH5PageShellRecoveryTimers();
            if (typeof document === 'undefined') {
                return;
            }
            this.recoverH5PageShell();
            this._h5PageShellRecoveryTimers = [0, 80, 240].map((delay) => {
                return setTimeout(() => {
                    this.recoverH5PageShell();
                }, delay);
            });
        },
        recoverH5PageShell() {
            if (typeof document === 'undefined') {
                return;
            }
            const rootEl = this.$el && this.$el.nodeType === 1
                ? this.$el
                : document.querySelector('.user-profile-page-root');
            if (!rootEl) {
                return;
            }

            let pageEl = null;
            if (typeof rootEl.closest === 'function') {
                pageEl = rootEl.closest('uni-page');
            }
            if (!pageEl) {
                const pages = Array.from(document.querySelectorAll('uni-page'));
                pageEl = pages.find((page) => page && page.contains && page.contains(rootEl)) || null;
            }

            const resetShellEl = (el) => {
                if (!el || !el.style) {
                    return;
                }
                el.style.width = '100%';
                el.style.minWidth = '0';
                el.style.maxWidth = 'none';
                el.style.margin = '0';
                el.style.paddingTop = '0';
                el.style.borderRadius = '0';
                el.style.boxShadow = 'none';
                el.style.overflowX = 'hidden';
            };

            resetShellEl(pageEl);
            resetShellEl(rootEl);
            const containerEl = rootEl.querySelector && rootEl.querySelector('.container');
            const mainContentEl = rootEl.querySelector && rootEl.querySelector('.main-content');
            resetShellEl(containerEl);
            resetShellEl(mainContentEl);
            if (containerEl && containerEl.style) {
                containerEl.style.display = 'block';
                containerEl.style.flexDirection = '';
                containerEl.style.paddingBottom = '0';
            }
            if (mainContentEl && mainContentEl.style) {
                mainContentEl.style.display = 'block';
                mainContentEl.style.paddingTop = '0';
            }

            if (pageEl) {
                const pageBody = pageEl.querySelector('uni-page-body');
                const pageWrapper = pageEl.querySelector('.uni-page-wrapper, uni-page-wrapper');
                const pageHead = pageEl.querySelector('.uni-page-head, uni-page-head');

                resetShellEl(pageBody);
                resetShellEl(pageWrapper);

                if (pageEl.style) {
                    pageEl.style.background = 'var(--app-page-bg, #ffffff)';
                }
                if (pageBody && pageBody.style) {
                    pageBody.style.background = 'var(--app-page-bg, #ffffff)';
                    pageBody.style.minHeight = '100vh';
                    pageBody.style.paddingTop = '0';
                }
                if (pageWrapper && pageWrapper.style) {
                    pageWrapper.style.top = '0';
                    pageWrapper.style.paddingTop = '0';
                }
                if (pageHead && pageHead.style) {
                    pageHead.style.display = 'none';
                    pageHead.style.height = '0';
                    pageHead.style.minHeight = '0';
                    pageHead.style.padding = '0';
                    pageHead.style.margin = '0';
                    pageHead.style.opacity = '0';
                    pageHead.style.overflow = 'hidden';
                    pageHead.style.pointerEvents = 'none';
                }
            }
        },
        setUserProfileNavigationTitle(title) {
            if (typeof document !== 'undefined') {
                return;
            }
            if (typeof uni !== 'undefined' && typeof uni.setNavigationBarTitle === 'function') {
                uni.setNavigationBarTitle({ title });
            }
        },
        getProfileAvatar(user = {}) {
            return resolveUserObjectAvatar(user);
        },
        getPostAvatar(post = {}) {
            return resolvePostAuthorAvatar(post);
        },
        normalizeDisplayText(value) {
            if (value === undefined || value === null) {
                return '';
            }
            return String(value).trim();
        },
        isGeneratedDiscussionTitle(title) {
            const normalizedTitle = this.normalizeDisplayText(title);
            return /^关于[「"][\s\S]+[」"]的讨论$/.test(normalizedTitle) || /^关于[\s\S]+的讨论$/.test(normalizedTitle);
        },
        isTitleDuplicatedByContent(title, content) {
            const normalizedTitle = this.normalizeDisplayText(title);
            const normalizedContent = this.normalizeDisplayText(content);
            if (!normalizedTitle || !normalizedContent) {
                return false;
            }
            const firstLine = this.normalizeDisplayText(normalizedContent.split(/\r?\n/).find(line => this.normalizeDisplayText(line)) || '');
            return normalizedTitle === firstLine;
        },
        normalizePostListDisplayFields(post = {}) {
            const nextPost = { ...post };
            nextPost.title = this.normalizeDisplayText(nextPost.title);
            nextPost.content = this.normalizeDisplayText(nextPost.content);
            if (nextPost.isDiscussion && this.isGeneratedDiscussionTitle(nextPost.title)) {
                nextPost.title = '';
            }
            if (nextPost.isPoem && this.isTitleDuplicatedByContent(nextPost.title, nextPost.content)) {
                nextPost.title = '';
            }
            return nextPost;
        },
        formatPostsForDisplay: function (posts = [], currentUserInfo = {}, openid = '') {
            return (posts || []).map((post = {}) => {
                const nextPost = this.normalizePostListDisplayFields(post);
                if (nextPost.createTime) {
                    nextPost.formattedCreateTime = this.formatTime(nextPost.createTime);
                }
                if (nextPost.imageUrls && nextPost.imageUrls.length > 0) {
                    nextPost.imageStyle = 'height: 0; padding-bottom: 75%;';
                }
                if (!nextPost._openid && openid) {
                    nextPost._openid = openid;
                }
                if (currentUserInfo.nickName) {
                    nextPost.authorName = currentUserInfo.nickName;
                } else if (!nextPost.authorName || !String(nextPost.authorName).trim()) {
                    nextPost.authorName = nextPost.authorNameSnapshot || '';
                }
                if (currentUserInfo.avatarUrl) {
                    nextPost.authorAvatar = currentUserInfo.avatarUrl;
                } else if (!nextPost.authorAvatar || !String(nextPost.authorAvatar).trim()) {
                    nextPost.authorAvatar = resolvePostAuthorAvatar(nextPost);
                }
                return nextPost;
            });
        },
        // 标签切换（他人主页）
        switchTab: function (e) {
            const tab = e && e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.tab;
            if (!tab || tab === this.currentTab) return;
            this.setData({ currentTab: tab });

            // 根据切换的标签加载相应数据
            switch (tab) {
                case 'portfolio':
                    if (!this.portfolioLoading) {
                        this.loadUserPortfolios();
                    }
                    // 加载时间轴数据
                    if (this.timelinePosts.length === 0 && !this.timelineLoading) {
                        this.loadTimelineData();
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
        // 加载用户信息和帖子
        loadUserProfile: function (cb) {
            this.cancelChildContentRequests();
            const request = this.beginGuardedRequest('activeLoadToken');
            this.setData({
                isLoading: true,
                portfolioLoading: true,
                favoriteLoading: false,
                timelineLoading: false
            });
            const infoPromise = getUserInfo(request.targetUserId, this);
            const postsPromise = getUserPosts({ userId: request.targetUserId, page: 0, pageSize: this.PAGE_SIZE, context: this });
            const portfolioPromise = getUserPortfolios(request.targetUserId, this).catch((error) => {
                return [];
            });
            Promise.all([infoPromise, postsPromise, portfolioPromise]).then(async ([userInfo, posts, portfolios]) => {
                if (!this.isGuardedRequestCurrent('activeLoadToken', request)) {
                    return;
                }
                userInfo.appBackgroundMode = normalizeAppBackgroundMode(userInfo.appBackgroundMode, userInfo.appBackgroundUrl);
                posts.forEach((post) => { if (post.createTime) post.formattedCreateTime = this.formatTime(post.createTime); });

                // 处理cloud://协议的URL转换
                posts = await hydrateTempUrls(posts);
                if (!this.isGuardedRequestCurrent('activeLoadToken', request)) {
                    return;
                }
                warmTempUrlsFromPosts(posts);

                posts = this.formatPostsForDisplay(posts, userInfo, request.targetUserId);
                const growthStats = extractGrowthStats(userInfo, posts);
                const normalizedPortfolios = await this.transformPortfolioList(portfolios);
                if (!this.isGuardedRequestCurrent('activeLoadToken', request)) {
                    return;
                }
                this.setData({
                    userInfo,
                    userPosts: posts,
                    page: 1,
                    hasMore: posts.length === this.PAGE_SIZE,
                    growthStats,
                    portfolioList: normalizedPortfolios,
                    portfolioLoading: false,
                    postsHasEverLoaded: true,
                    portfolioHasEverLoaded: true
                });
                avatarCache.updateUserAvatar(request.targetUserId, userInfo);
                this.prepareFollowStateWithCache();
                this.prepareBlockState();
                this.fetchFollowCounts();
                this.setUserProfileNavigationTitle(userInfo.nickName || '用户主页');
            }).catch((err) => {
                if (!this.isGuardedRequestCurrent('activeLoadToken', request)) {
                    return;
                }
                uni.showToast({ title: '网络异常，请稍后重试', icon: 'none' });
                this.setData({ 
                    postsHasEverLoaded: true,
                    portfolioHasEverLoaded: true
                });
            }).finally(() => {
                if (!this.isGuardedRequestCurrent('activeLoadToken', request)) {
                    if (typeof cb === 'function') cb();
                    return;
                }
                this.setData({ isLoading: false, portfolioLoading: false });
                if (typeof cb === 'function') cb();
            });
        },

        // 加载更多帖子
        loadUserPosts: function () {
            if (this.isLoading) return;
            const { page, PAGE_SIZE } = this;
            const request = this.beginGuardedRequest('postsLoadToken');
            // 只在首次加载时显示全屏加载状态，触底加载时不显示
            if (page === 0) {
                this.setData({ isLoading: true });
            }
            getUserPosts({ userId: request.targetUserId, page, pageSize: PAGE_SIZE, context: this })
                .then(async (posts) => {
                    if (!this.isGuardedRequestCurrent('postsLoadToken', request)) {
                        return;
                    }
                    posts.forEach((post) => { if (post.createTime) post.formattedCreateTime = this.formatTime(post.createTime); });
                    
                    // 处理cloud://协议的URL转换
                    posts = await hydrateTempUrls(posts);
                    if (!this.isGuardedRequestCurrent('postsLoadToken', request)) {
                        return;
                    }
                    warmTempUrlsFromPosts(posts);
                    
                    // 处理分页数据，避免重复
                    posts = this.formatPostsForDisplay(posts, this.userInfo, request.targetUserId);
                    const existingIds = new Set(this.userPosts.map(p => p._id));
                    const uniqueNewList = posts.filter(p => p && p._id && !existingIds.has(p._id));
                    const newPosts = this.userPosts.concat(uniqueNewList);
                    this.setData({
                        userPosts: newPosts,
                        page: page + 1,
                        hasMore: posts.length === PAGE_SIZE,
                        growthStats: extractGrowthStats(this.userInfo, newPosts)
                    });
                })
                .catch((err) => {
                    if (this.isGuardedRequestCurrent('postsLoadToken', request)) {
                        console.error('加载更多帖子失败', err);
                    }
                })
                .finally(() => { 
                    if (!this.isGuardedRequestCurrent('postsLoadToken', request)) {
                        return;
                    }
                    // 只在首次加载时隐藏全屏加载状态
                    if (page === 0) {
                        this.setData({ isLoading: false }); 
                    }
                });
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
            const request = this.beginGuardedRequest('followStatusToken', targetOpenid);
            const currentUserId = this.getCurrentUserId();
            if (!currentUserId) {
                return;
            }

            // 使用缓存获取关注状态
            followCache.getFollowStatus(currentUserId, targetOpenid).then((followData) => {
                if (!this.isGuardedRequestCurrent('followStatusToken', request) || targetOpenid !== request.targetUserId) {
                    return;
                }
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
            const request = this.beginGuardedRequest('followStatusToken', targetOpenid);
            checkFollowRelation({
                targetOpenid,
                context: this,
                pageTag: 'user-profile:check-follow'
            }).then((result) => {
                if (!this.isGuardedRequestCurrent('followStatusToken', request) || targetOpenid !== request.targetUserId) {
                    return;
                }
                this.setData({
                    isFollowing: !!result.isFollowing,
                    isFollowedByTarget: !!result.isFollower,
                    isMutualFollow: !!result.isMutual
                });
            }).catch((err) => {
                if (this.isGuardedRequestCurrent('followStatusToken', request)) {
                    console.error('检查关注状态调用失败:', err);
                }
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

        // 准备屏蔽状态
        prepareBlockState: function () {
            const targetUserId = this.targetUserId;
            const currentUserId = this.getCurrentUserId();
            if (!targetUserId || !currentUserId || targetUserId === currentUserId) {
                this.setData({
                    showBlockButton: false,
                    isBlocked: false
                });
                return;
            }
            this.setData({
                showBlockButton: true,
                isBlocked: false
            });
            this.fetchBlockStatus(targetUserId);
        },

        // 获取屏蔽状态
        fetchBlockStatus: function (targetOpenid) {
            if (!targetOpenid) {
                return;
            }
            const request = this.beginGuardedRequest('blockStatusToken', targetOpenid);
            const currentUserId = this.getCurrentUserId();
            if (!currentUserId) {
                return;
            }

            checkBlockRelation({
                targetOpenid,
                context: this,
                pageTag: 'user-profile:check-block'
            }).then((result) => {
                if (!this.isGuardedRequestCurrent('blockStatusToken', request) || targetOpenid !== request.targetUserId) {
                    return;
                }
                this.setData({
                    isBlocked: !!result.isBlocked
                });
            }).catch((err) => {
                if (this.isGuardedRequestCurrent('blockStatusToken', request)) {
                    console.error('检查屏蔽状态调用失败:', err);
                }
            });
        },

        // 切换屏蔽状态
        onBlockTap: function () {
            if (this.blockPending) {
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

            // 确认对话框
            const action = this.isBlocked ? '取消屏蔽' : '屏蔽';
            uni.showModal({
                title: '确认操作',
                content: `确定要${action}该用户吗？${this.isBlocked ? '' : '屏蔽后将无法看到该用户的帖子和诗歌。'}`,
                success: (modalRes) => {
                    if (modalRes.confirm) {
                        this.setData({
                            blockPending: true
                        });

                        toggleBlockRelation({
                            targetOpenid,
                            context: this,
                            pageTag: 'user-profile:toggle-block'
                        })
                            .then((result) => {
                                this.setData({
                                    isBlocked: !!result.isBlocked
                                });
                                uni.showToast({
                                    title: result.isBlocked ? '屏蔽成功，请刷新广场页面' : '已取消屏蔽',
                                    icon: 'success',
                                    duration: 2000
                                });

                                // 屏蔽/取消屏蔽后，清除相关缓存
                                try {
                                    invalidateHomePosts({}); // 清除首页缓存
                                    clearDiscoverCache(); // 清除发现页缓存

                                    // 如果屏蔽成功，延迟提示用户刷新
                                    if (result.isBlocked) {
                                        setTimeout(() => {
                                            uni.showModal({
                                                title: '屏蔽成功',
                                                content: '该用户的帖子和诗歌将不再显示。请下拉刷新广场页面查看效果。',
                                                showCancel: false,
                                                confirmText: '知道了'
                                            });
                                        }, 500);
                                    }
                                } catch (cacheError) {
                                    console.error('清除缓存失败:', cacheError);
                                }

                                // 如果取消屏蔽，刷新页面数据
                                if (!result.isBlocked) {
                                    this.loadUserProfile();
                                }
                            })
                            .catch((err) => {
                                console.error('切换屏蔽状态失败:', err);
                                console.error('错误详情:', {
                                    message: err.message,
                                    code: err.code,
                                    errCode: err.errCode
                                });
                                uni.showToast({
                                    title: err.message || '网络错误，请稍后重试',
                                    icon: 'none',
                                    duration: 3000
                                });
                            })
                            .finally(() => {
                                this.setData({
                                    blockPending: false
                                });
                            });
                    }
                }
            });
        },

        navigateToPostDetail: function (e) {
            const postId = typeof e === 'string' ? e : (e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.id);
            if (!postId) {
                console.error('navigateToPostDetail: postId未定义');
                return;
            }
            uni.navigateTo({
                url: `/pages/post-detail/post-detail?id=${postId}`
            });
        },

        // 图片预览
        handlePreview: function (event) {
            return previewImage(event, { fallbackToast: false });
        },

        onAvatarLoad: function () {
        },

        navigateBack: function () {
            const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
            if (pages.length > 1) {
                uni.navigateBack();
                return;
            }
            uni.switchTab({
                url: '/pages/index/index',
                fail: () => {
                    uni.reLaunch({ url: '/pages/index/index' });
                }
            });
        },

        handleNavigateToUser: function (payload = {}) {
            if (payload.isAnonymous) {
                uni.showToast({ title: '匿名用户不可查看主页', icon: 'none' });
                return;
            }
            const userId = payload.userId || payload._openid || '';
            if (!userId) {
                uni.showToast({ title: '用户ID缺失', icon: 'none' });
                return;
            }
            if (userId === this.targetUserId) {
                return;
            }
            uni.navigateTo({
                url: `/pages-user/user-profile/user-profile?userId=${encodeURIComponent(userId)}`
            });
        },

        // 图片加载处理
        // 格式化时间
        formatTime: function (dateString) {
            return formatRelativeTime(dateString);
        },

        // 处理组件事件的方法
        navigateToPortfolio() {
            // PortfolioBook组件容器点击事件处理（暂时为空实现）
            console.log('Navigate to portfolio container clicked');
        },

        updateCollapsedMonths(newCollapsed) {
            this.setData({
                collapsedMonths: newCollapsed
            });
        },

        // 独立加载时间轴数据
        loadTimelineData: function () {
            const request = this.beginGuardedRequest('timelineLoadToken');
            this.setData({
                timelineLoading: true,
                timelineError: false
            });

            const targetUserId = request.targetUserId;

            if (!targetUserId) {
                this.setData({
                    timelineLoading: false,
                    timelineError: true
                });
                return;
            }

            // 通过 API 层加载，页面不再解析 res.result 协议
            getUserPosts({
                userId: targetUserId,
                page: 0,
                pageSize: 1000,
                context: this
            }).then((allPosts) => {
                if (!this.isGuardedRequestCurrent('timelineLoadToken', request)) {
                    return;
                }
                const posts = Array.isArray(allPosts) ? allPosts : [];

                // 只筛选原创诗歌类型的帖子
                const originalPoemPosts = posts.filter(post => post.isPoem === true && post.isOriginal === true);

                // 格式化时间
                originalPoemPosts.forEach(post => {
                    if (post.createTime) {
                        post.formattedCreateTime = this.formatTime(post.createTime);
                    }
                });

                // 使用工具函数处理数据
                const processedPosts = processPostsForTimeline(originalPoemPosts);

                this.setData({
                    timelinePosts: processedPosts,
                    timelineGroups: groupPostsByMonth(processedPosts),
                    timelineLoading: false,
                    timelineError: false
                });
            }).catch((err) => {
                if (!this.isGuardedRequestCurrent('timelineLoadToken', request)) {
                    return;
                }
                this.setData({
                    timelineLoading: false,
                    timelineError: true
                });
            });
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
                const url = `/pages-user/user-profile/user-profile?userId=${userId}`;
                uni.navigateTo({ url });
            } catch (err) {
                console.error('[navigateToUserProfile] failed:', err);
                uni.showToast({ title: '跳转失败', icon: 'none' });
            }
        },

        onTagClick: function () {
        },

        // 加载用户作品集
        async loadUserPortfolios(cb) {
            const request = this.beginGuardedRequest('portfolioLoadToken');
            try {
                this.setData({ portfolioLoading: true });
                let portfolios = await getUserPortfolios(request.targetUserId, this);
                if (!this.isGuardedRequestCurrent('portfolioLoadToken', request)) {
                    return;
                }
                portfolios = await this.transformPortfolioList(portfolios);
                if (!this.isGuardedRequestCurrent('portfolioLoadToken', request)) {
                    return;
                }
                this.setData({ portfolioList: portfolios });
            } catch (error) {
                if (this.isGuardedRequestCurrent('portfolioLoadToken', request)) {
                    console.error('加载用户作品集失败:', error);
                }
            } finally {
                if (!this.isGuardedRequestCurrent('portfolioLoadToken', request)) {
                    if (typeof cb === 'function') cb();
                    return;
                }
                this.setData({ portfolioLoading: false });
                if (typeof cb === 'function') cb();
            }
        },

        async transformPortfolioList(portfolios = []) {
            try {
                const list = Array.isArray(portfolios) ? portfolios : [];
                const normalized = list.map((item) => {
                    const copy = { ...item };
                    if (typeof copy.postCount !== 'number') {
                        copy.postCount = typeof copy.postsCount === 'number' ? copy.postsCount : 0;
                    }
                    if (!copy.coverImage && typeof copy.cover === 'string') {
                        copy.coverImage = copy.cover;
                    }
                    return copy;
                });
                const cloudIds = normalized
                    .map((item) => item.coverImage)
                    .filter((src) => typeof src === 'string' && src.startsWith('cloud://'));
                if (cloudIds.length > 0) {
                    try {
                        const map = await fileUrlCache.getTempUrls(cloudIds);
                        normalized.forEach((item) => {
                            if (typeof item.coverImage === 'string' && map[item.coverImage]) {
                                item.coverImage = map[item.coverImage];
                            }
                        });
                    } catch (err) {
                        console.error('转换作品集封面失败:', err);
                    }
                }
                return normalized;
            } catch (err) {
                console.error('处理作品集数据失败:', err);
                return [];
            }
        },

        // 打开作品集
        openPortfolio(portfolio = {}) {
            try {
                const folderId = portfolio.folderId || portfolio._id || '';
                const folderName = portfolio.folderName || portfolio.name || '未命名作品集';
                const ownerId = portfolio._openid || this.targetUserId || '';
                console.log('Opening portfolio:', { folderId, folderName, ownerId, portfolio });
                if (!folderId) {
                    uni.showToast({ title: '作品集信息获取失败', icon: 'none' });
                    return;
                }
                if (!ownerId) {
                    uni.showToast({ title: '用户信息获取失败', icon: 'none' });
                    return;
                }
                uni.navigateTo({
                    url: `/pages-content/other-portfolio/other-portfolio?folderId=${folderId}&folderName=${encodeURIComponent(folderName)}&userId=${ownerId}`,
                    fail: (error) => {
                        console.error('[openPortfolio] navigate failed:', error);
                        uni.showToast({ title: '跳转失败', icon: 'none' });
                    }
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
            const request = this.beginGuardedRequest('favoritesLoadToken');
            this.setData({ favoriteLoading: true });
            // 调用云函数获取收藏数据
            getUserFavorites({ userId: request.targetUserId, page: favoritePage, pageSize: PAGE_SIZE, context: this })
                .then(async (favorites) => {
                    if (!this.isGuardedRequestCurrent('favoritesLoadToken', request)) {
                        return;
                    }
                    // 将 { postId, favoriteTime, post: {...} } 规范化为贴合模板的数据结构
                    let normalized = (favorites || []).map((fav) => {
                        const post = fav && fav.post ? fav.post : (fav || {});
                        const mapped = Object.assign({}, post, {
                            _id: post._id || fav.postId,
                            postId: fav.postId,
                            favoriteTime: fav.favoriteTime || fav.createTime,
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
                        return this.normalizePostListDisplayFields(mapped);
                    });

                    // cloud:// 临时链接水合
                    try {
                        normalized = await hydrateTempUrls(normalized);
                        if (!this.isGuardedRequestCurrent('favoritesLoadToken', request)) {
                            return;
                        }
                        warmTempUrlsFromPosts(normalized);
                    } catch (_) {}

                    // 处理分页数据，避免重复
                    const newFavoriteList = favoritePage === 0 ? normalized : (() => {
                        const existingIds = new Set(this.favoriteList.map(p => p._id));
                        const uniqueNewList = (normalized || []).filter(p => p && p._id && !existingIds.has(p._id));
                        return this.favoriteList.concat(uniqueNewList);
                    })();
                    this.setData({
                        favoriteList: newFavoriteList,
                        favoritePage: favoritePage + 1,
                        favoriteHasMore: (favorites || []).length === PAGE_SIZE,
                        favoritesHasEverLoaded: true
                    });
                })
                .catch((err) => {
                    if (this.isGuardedRequestCurrent('favoritesLoadToken', request)) {
                        console.error('【用户主页】获取收藏失败:', err);
                        uni.showToast({ title: '网络异常', icon: 'none' });
                        this.setData({ favoritesHasEverLoaded: true });
                    }
                })
                .finally(() => {
                    if (!this.isGuardedRequestCurrent('favoritesLoadToken', request)) {
                        if (typeof cb === 'function') cb();
                        return;
                    }
                    this.setData({ favoriteLoading: false });
                    if (typeof cb === 'function') cb();
                });
        },

        // 获取关注数统计
        fetchFollowCounts: function () {
            if (!this.targetUserId) {
                return;
            }
            const request = this.beginGuardedRequest('followCountsToken');

            getFollowCounts({
                targetOpenid: request.targetUserId,
                context: this,
                pageTag: 'user-profile:follow-counts'
            }).then((result) => {
                if (!this.isGuardedRequestCurrent('followCountsToken', request)) {
                    return;
                }
                this.setData({
                    followingCount: result.followingCount || 0,
                    followerCount: result.followerCount || 0
                });
            }).catch((err) => {
                if (this.isGuardedRequestCurrent('followCountsToken', request)) {
                    console.error('获取关注数调用失败:', err);
                    this.setData({
                        followingCount: 0,
                        followerCount: 0
                    });
                }
            });
        }
    }
};
</script>
<style>
/* pages/user-profile/user-profile.wxss */
.user-profile-page-root {
    position: relative;
    min-height: 100vh;
    width: 100%;
    max-width: none;
    margin: 0;
    background-color: var(--app-page-bg, #ffffff);
    border-radius: 0;
    box-shadow: none;
    overflow-x: hidden;
}

.user-profile-page-root--with-background {
    background-color: transparent;
}

/* #ifdef H5 */
uni-page:has(.user-profile-page-root),
uni-page:has(.user-profile-page-root) uni-page-body,
uni-page:has(.user-profile-page-root) .uni-page-wrapper {
    width: 100% !important;
    max-width: none !important;
    margin: 0 !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    overflow-x: hidden !important;
    background: var(--app-page-bg, #ffffff) !important;
}

uni-page:has(.user-profile-page-root) uni-page-body,
uni-page:has(.user-profile-page-root) .uni-page-wrapper {
    min-height: 100vh !important;
    padding-top: 0 !important;
    top: 0 !important;
}

uni-page:has(.user-profile-page-root) .uni-page-head {
    display: none !important;
    height: 0 !important;
    min-height: 0 !important;
    padding: 0 !important;
    margin: 0 !important;
    opacity: 0 !important;
    overflow: hidden !important;
    pointer-events: none !important;
}
/* #endif */

.user-profile-bg-image,
.user-profile-bg-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
}

.user-profile-bg-image {
    background-image: var(--user-profile-background-image);
    background-size: cover;
    background-position: center top;
    z-index: 0;
}

.user-profile-bg-overlay {
    background: rgba(0, 0, 0, 0.16);
    z-index: 1;
}

.user-profile-page-root .container {
    min-height: 100vh;
    background-color: var(--app-page-bg, #ffffff);
    position: relative;
    z-index: 2;
    display: block;
    padding-top: 0;
    padding-bottom: 0;
    flex-direction: initial;
    box-sizing: border-box;
}

.user-profile-page-root .container--with-background {
    background-color: transparent;
}

/* #ifdef H5 */
uni-page:has(.user-profile-page-root) .user-profile-page-root .container {
    display: block !important;
    padding-top: 0 !important;
    padding-bottom: 0 !important;
    flex-direction: initial !important;
}
/* #endif */

.user-profile-page-root .user-profile-loading-state .skeleton-wrapper {
    padding: 0 0 40rpx 0;
    align-items: stretch;
    background: transparent;
}

.user-profile-page-root .user-profile-loading-state .skeleton-wrapper :deep(.skeleton-user-profile-container) {
    width: 100%;
    min-height: 100vh;
    background: transparent;
    background-color: transparent;
}

.user-profile-page-root .user-profile-loading-state .skeleton-wrapper :deep(.skeleton-profile-card) {
    width: 100%;
    box-sizing: border-box;
}

/* Main Content */
.user-profile-page-root .main-content {
    width: 100%;
    min-height: 100vh;
    background-color: var(--app-page-bg, #ffffff);
}

.user-profile-page-root .main-content--with-background {
    background-color: transparent;
    --app-post-discussion-quote-bg: transparent;
    --app-post-wrapper-margin: 0 24rpx 20rpx 24rpx;
    --app-post-wrapper-border: none;
    --app-post-wrapper-divider: none;
}

.user-profile-page-root .main-content--header-background {
    background-color: var(--app-page-bg, #ffffff);
}

.user-profile-page-root .main-content--with-background .profile-name-center,
.user-profile-page-root .main-content--with-background .profile-poemid,
.user-profile-page-root .main-content--with-background .profile-bio-center,
.user-profile-page-root .main-content--with-background .profile-followers,
.user-profile-page-root .main-content--with-background .growth-count {
    text-shadow: 0 2rpx 12rpx rgba(255, 255, 255, 0.45);
}

.user-profile-page-root .profile-hero-section {
    position: relative;
    overflow: hidden;
}

.user-profile-page-root .profile-hero-section--with-background {
    min-height: 0;
    background-color: #0f0f0f;
}

.user-profile-page-root .profile-hero-bg-image,
.user-profile-page-root .profile-hero-bg-overlay {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    pointer-events: none;
}

.user-profile-page-root .profile-hero-bg-image {
    background-image: var(--user-profile-background-image);
    background-size: cover;
    background-position: center top;
    z-index: 0;
}

.user-profile-page-root .profile-hero-bg-overlay {
    background: linear-gradient(180deg, rgba(0, 0, 0, 0.18) 0%, rgba(0, 0, 0, 0.44) 100%);
    z-index: 1;
}

.user-profile-page-root .profile-hero-section .profile-card-center {
    position: relative;
    z-index: 2;
}

.user-profile-page-root .profile-back-btn {
    position: absolute;
    top: calc(24rpx + env(safe-area-inset-top, var(--safe-area-inset-top, 0px)));
    left: 24rpx;
    z-index: 6;
    width: 64rpx;
    height: 64rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: var(--user-profile-back-bg, rgba(0, 0, 0, 0.08));
    color: var(--user-profile-back-color, #333333);
    transition: transform 0.2s ease, background-color 0.2s ease;
}

.user-profile-page-root .profile-back-btn:active {
    transform: scale(0.94);
    background: rgba(0, 0, 0, 0.16);
}

.user-profile-page-root .profile-hero-section--with-background .profile-back-btn {
    background: rgba(0, 0, 0, 0.18);
    color: #ffffff;
}

.user-profile-page-root .main-content--with-background .profile-back-btn {
    background: rgba(0, 0, 0, 0.18);
    color: #ffffff;
}

.user-profile-page-root .profile-back-icon {
    font-size: 56rpx;
    line-height: 56rpx;
    transform: translateY(-2rpx);
}

.user-profile-page-root .profile-body-shell {
    width: 100%;
}

.user-profile-page-root .profile-body-shell-cap {
    position: relative;
    height: 0;
    z-index: 2;
    pointer-events: none;
}

.user-profile-page-root .profile-body-shell-cap::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 16rpx;
    transform: translateY(-14rpx);
    background-color: var(--app-page-bg, #ffffff);
    border-radius: 68rpx 68rpx 0 0;
}

.user-profile-page-root .profile-body-shell--header-background {
    position: relative;
    background-color: var(--app-page-bg, #ffffff);
    margin-top: 0;
    border-radius: 0;
    padding-top: 0;
    overflow: visible;
    z-index: 2;
}

.user-profile-page-root .profile-body-shell--header-background .tab-item {
    padding: 8rpx 10rpx 12rpx;
}

.user-profile-page-root .profile-body-shell--full-background {
    background-color: transparent;
}

/* User Profile Card */
.user-profile-page-root .profile-card {
    margin: 30rpx;
    padding: 40rpx;
    background-color: var(--profile-empty-surface-bg, var(--app-surface-bg, #fff));
    border-radius: 16rpx;
    box-shadow: var(--profile-empty-surface-shadow, 0 4rpx 12rpx rgba(0, 0, 0, 0.05));
    border: var(--profile-empty-surface-border, none);
    display: flex;
    align-items: flex-start;
    transition: box-shadow 0.2s ease;
}

.user-profile-page-root .profile-card:active {
    box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.1);
}

.user-profile-page-root .profile-card-center {
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


.user-profile-page-root .profile-avatar-large {
    display: flex;
    justify-content: center;
    align-items: center;
    margin: 70rpx 0 40rpx 0;
}

.user-profile-page-root .profile-avatar-large image {
    width: 175rpx;
    height: 175rpx;
    border-radius: 50%;
    display: block;
}

.user-profile-page-root .profile-info-center {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    margin-top: 20rpx;
    width: 100%;
}

.user-profile-page-root .profile-name-center {
    font-family: 'Inter', sans-serif;
    font-weight: 600;
    font-size: 30rpx;
    line-height: 36rpx;
    color: var(--user-profile-name-color, var(--profile-name-color, #000000));
    margin-bottom: 20rpx;
    text-align: left;
}

.user-profile-page-root .profile-poemid {
    font-family: 'Inter', sans-serif;
    font-weight: 300;
    font-size: 20rpx;
    line-height: 24rpx;
    color: var(--user-profile-poemid-color, var(--profile-poemid-color, #989090));
    margin-bottom: 20rpx;
}

.user-profile-page-root .profile-bio-center {
    font-family: 'Inter', sans-serif;
    font-weight: 600;
    font-size: 24rpx;
    line-height: 30rpx;
    color: var(--user-profile-bio-color, var(--profile-bio-color, #000000));
    text-align: left;
    margin-bottom: 20rpx;
}

.user-profile-page-root .profile-bottom-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    margin-bottom: 10rpx;
}

.user-profile-page-root .profile-buttons {
    display: flex;
    align-items: center;
    gap: 10rpx;
}

.user-profile-page-root .profile-followers {
    font-family: 'Inter', sans-serif;
    font-weight: 400;
    font-size: 24rpx;
    line-height: 30rpx;
    color: var(--user-profile-meta-color, var(--profile-meta-color, #666666));
}

.user-profile-page-root .follow-btn {
    padding: 0 28rpx;
    height: 60rpx;
    line-height: 60rpx;
    background-color: #4a4a4a;
    color: #ffffff;
    border: none;
    border-radius: 999rpx;
    font-size: 26rpx;
    flex-shrink: 0;
    min-width: 96rpx;
}

.user-profile-page-root .follow-btn.following {
    background-color: var(--app-subtle-surface-bg, #f0f0f0);
    color: var(--app-secondary-text, #666666);
}

.user-profile-page-root .follow-btn.mutual {
    background-color: var(--app-subtle-surface-bg, #f0f0f0);
    color: var(--app-secondary-text, #666666);
}

.user-profile-page-root .follow-btn::after {
    border: none;
}

.user-profile-page-root .follow-btn[disabled] {
    opacity: 0.7;
}

.user-profile-page-root .block-btn {
    padding: 0 28rpx;
    height: 60rpx;
    line-height: 60rpx;
    background-color: var(--app-subtle-surface-bg, #f5f5f5);
    color: var(--app-secondary-text, #666666);
    border: 1rpx solid var(--app-border-color, #e0e0e0);
    border-radius: 999rpx;
    font-size: 26rpx;
    flex-shrink: 0;
    min-width: 96rpx;
}

.user-profile-page-root .block-btn.blocked {
    background-color: var(--user-profile-accent-pill-bg, rgba(255, 92, 92, 0.14));
    color: var(--user-profile-accent-pill-text, #ff6b6b);
    border: var(--user-profile-accent-pill-border, 1rpx solid rgba(255, 92, 92, 0.38));
}

.user-profile-page-root .block-btn::after {
    border: none;
}

.user-profile-page-root .block-btn[disabled] {
    opacity: 0.7;
}


.user-profile-page-root .mutual-indicator {
    padding: 8rpx 20rpx;
    border-radius: 20rpx;
    font-size: 22rpx;
    background-color: var(--app-subtle-surface-bg, #f0f0f0);
    color: var(--app-secondary-text, #666666);
    border: 1rpx solid var(--app-border-color, transparent);
}

.user-profile-page-root .followed-indicator {
    padding: 8rpx 20rpx;
    border-radius: 20rpx;
    font-size: 22rpx;
    background-color: var(--app-subtle-surface-bg, #f0f8ff);
    color: var(--app-secondary-text, #007aff);
    border: 1rpx solid var(--app-border-color, transparent);
}

/* 帖子部分 */
.user-profile-page-root .posts-section {
    margin: 20rpx 30rpx 30rpx 30rpx;
}

.user-profile-page-root .section-title {
    font-size: 32rpx;
    font-weight: bold;
    color: var(--app-primary-text, #333);
    margin-bottom: 20rpx;
    padding: 0 10rpx;
}

.user-profile-page-root .post-card {
    background: var(--app-surface-bg, #fff);
    border-radius: 16rpx;
    box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.05);
    margin-bottom: 20rpx;
    box-sizing: border-box;
    padding: 30rpx;
    transition: transform 0.2s ease;
}

.user-profile-page-root .post-card:active {
    transform: translateY(2rpx);
    box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.1);
}

.user-profile-page-root .post-header {
    margin-bottom: 15rpx;
}

.user-profile-page-root .posts-section .post-title {
    font-size: 32rpx;
    font-weight: bold;
    color: var(--app-post-title-color, #333);
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
.user-profile-page-root .image-container {
    width: 100%;
    margin: 15rpx 0;
}

.user-profile-page-root .posts-section .image-swiper {
    width: 100%;
    background-color: var(--app-subtle-surface-bg, #fff);
    border-radius: 12rpx;
    overflow: hidden;
}

.user-profile-page-root .posts-section .post-image {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: contain;
    border-radius: 12rpx;
}

.user-profile-page-root .posts-section .post-content {
    font-size: 28rpx;
    color: var(--app-post-content-color, #666);
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

.user-profile-page-root .post-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 20rpx;
    padding-top: 20rpx;
    border-top: 1rpx solid var(--app-border-color, #f0f0f0);
}

.user-profile-page-root .post-stats {
    display: flex;
    align-items: center;
    gap: 20rpx;
}

.user-profile-page-root .stat-item {
    font-size: 26rpx;
    color: var(--app-muted-text, #999);
}

.user-profile-page-root .posts-section .post-time {
    font-size: 24rpx;
    color: var(--app-muted-text, #ccc);
}

.user-profile-page-root .empty-tip {
    text-align: center;
    color: var(--profile-empty-text-color, #bbb);
    font-size: 28rpx;
    margin: 40rpx 0;
    padding: 60rpx 0;
    background-color: var(--profile-empty-surface-bg, #fff);
    border-radius: 16rpx;
    box-shadow: var(--profile-empty-surface-shadow, 0 4rpx 12rpx rgba(0, 0, 0, 0.05));
    border: var(--profile-empty-surface-border, none);
}

/* —— 与个人主页统一的切换栏与帖子展示样式 —— */
.user-profile-page-root .tab-navigation {
    margin: 0 30rpx 20rpx 30rpx;
    display: flex;
    background: var(--profile-tab-nav-bg, #fff);
    border: 1rpx solid var(--profile-tab-nav-border, #fff);
    border-radius: 16rpx;
    overflow: hidden;
    box-shadow: var(--profile-tab-nav-shadow, none);
}
.user-profile-page-root .tab-item {
    flex: 1;
    padding: 20rpx 10rpx;
    text-align: center;
    background: var(--profile-tab-item-bg, #fff);
    transition: all 0.3s ease;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
}
.user-profile-page-root .tab-item.active::after {
    content: '';
    position: absolute;
    bottom: 8rpx;
    left: 50%;
    transform: translateX(-50%);
    width: 200rpx;
    height: 6rpx;
    background: var(--profile-tab-indicator-color, #333);
    border-radius: 3rpx;
}
.user-profile-page-root .tab-item:active { background: var(--profile-tab-item-active-bg, #f5f5f5); }
.user-profile-page-root .tab-icon { width: 110rpx; height: 110rpx; filter: var(--profile-tab-icon-filter, grayscale(1) brightness(0.5)); opacity: var(--profile-tab-icon-opacity, 0.7); }
.user-profile-page-root .tab-icon--writing { width: 76rpx; height: 76rpx; transform: translateY(0); }
.user-profile-page-root .tab-item.active .tab-icon { filter: var(--profile-tab-icon-active-filter, grayscale(0) brightness(1)); opacity: var(--profile-tab-icon-active-opacity, 1); }

.user-profile-page-root .my-posts-section,
.user-profile-page-root .portfolio-section,
.user-profile-page-root .favorites-section { margin: 0 0 30rpx 0; }
.user-profile-page-root .my-posts-section,
.user-profile-page-root .favorites-section {
    --app-post-wrapper-margin: 0 0 20rpx 0;
    --app-post-wrapper-shadow: none;
    --app-post-wrapper-radius: 0;
    --app-post-wrapper-border: none;
    --app-post-wrapper-divider: 1rpx solid #f0f0f0;
}

.user-profile-page-root .portfolio-section {
    padding-bottom: 220rpx;
    --app-surface-bg: #ffffff;
    --app-surface-shadow: 0 8rpx 24rpx rgba(0, 0, 0, 0.08);
    --app-surface-border-line: none;
}

.user-profile-page-root .main-content--with-background .portfolio-section {
    --app-surface-bg: rgba(255, 255, 255, 0.86);
    --app-surface-shadow: 0 10rpx 28rpx rgba(0, 0, 0, 0.12);
    --app-surface-border-line: 1rpx solid rgba(255, 255, 255, 0.30);
}

.user-profile-page-root .portfolio-section .books-container,
.user-profile-page-root .portfolio-section .timeline-container,
.user-profile-page-root .portfolio-section .timeline-empty,
.user-profile-page-root .portfolio-section .timeline-loading,
.user-profile-page-root .portfolio-section .timeline-error {
    margin: 0 24rpx 24rpx 24rpx;
    border-radius: 20rpx;
    box-shadow: var(--app-surface-shadow, 0 8rpx 24rpx rgba(0, 0, 0, 0.08));
    border: var(--app-surface-border-line, none);
    overflow: hidden;
}

.user-profile-page-root .loading-footer { text-align: center; padding: 20rpx 0; color: var(--profile-loading-footer-color, #999); font-size: 14px; }

/* 作品集样式 */
.user-profile-page-root .loading-tip {
    text-align: center;
    color: var(--profile-loading-footer-color, #999);
    font-size: 28rpx;
    margin: 40rpx 0;
    padding: 60rpx 0;
    background-color: var(--profile-empty-surface-bg, #fff);
    border-radius: 16rpx;
    box-shadow: var(--profile-empty-surface-shadow, 0 4rpx 12rpx rgba(0, 0, 0, 0.05));
    border: var(--profile-empty-surface-border, none);
}


/* 资料详情（与我的主页风格一致） */
.user-profile-page-root .profile-detail-card {
    margin: 0 30rpx 20rpx 30rpx;
    padding: 20rpx 24rpx;
    background: var(--profile-empty-surface-bg, #fff);
    border-radius: 16rpx;
    box-shadow: var(--profile-empty-surface-shadow, 0 4rpx 12rpx rgba(0, 0, 0, 0.05));
    border: var(--profile-empty-surface-border, none);
    display: flex;
    flex-wrap: wrap;
    gap: 16rpx 24rpx;
}
.user-profile-page-root .detail-item-inline {
    color: var(--app-secondary-text, #666);
    font-size: 28rpx;
    margin-right: 24rpx;
}

/* 成长统计样式 */
.user-profile-page-root .profile-growth-stats {
    position: absolute;
    top: 120rpx;
    right: 40rpx;
    z-index: 3;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 18rpx;
}

.user-profile-page-root .growth-item {
    display: flex;
    align-items: center;
    gap: 12rpx;
}

.user-profile-page-root .growth-icon {
    width: 48rpx;
    height: 48rpx;
}

.user-profile-page-root .growth-count {
    font-size: 30rpx;
    font-weight: 600;
    color: var(--user-profile-meta-color, var(--profile-meta-color, #333333));
}

/* 加载提示样式 */
.user-profile-page-root .loading-tip {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 60rpx 40rpx;
    color: var(--profile-loading-footer-color, #999);
    font-size: 28rpx;
}

.user-profile-page-root .empty-tip {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 60rpx 40rpx;
    color: var(--profile-empty-text-color, #666);
    font-size: 28rpx;
}

</style>
