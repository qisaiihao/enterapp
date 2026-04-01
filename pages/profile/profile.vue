<template>
    <view
        class="profile-page-root"
        :class="{ 'profile-page-root--with-background': isFullBackground || isHeaderBackground }"
        :style="profileForegroundStyle"
    >
        <!-- 主页背景图层 - 全屏模式 -->
        <view
            v-if="isFullBackground"
            class="profile-bg-image"
            :style="appBackgroundPageStyle"
        ></view>
        <view v-if="isFullBackground" class="profile-bg-overlay"></view>

        <!-- 主页背景图层 - 顶部图片模式 -->
        <view
            v-if="isHeaderBackground"
            class="profile-bg-image profile-bg-image--header"
            :style="appBackgroundPageStyle"
        ></view>
        <view v-if="isHeaderBackground" class="profile-bg-overlay profile-bg-overlay--header"></view>

        <!-- pages/profile/profile.wxml -->
        <view :class="['container', { 'container--with-background': isFullBackground || isHeaderBackground }]">
            <!-- 骨架屏：当 isLoading 为 true 时，显示骨架屏，其他所有内容都不渲染 -->
            <view v-if="!hasInitialSnapshot && isLoading">
                <skeleton pageType="profile" />
            </view>

            <!-- 真实内容：当 isLoading 为 false 时，显示真实页面 -->
            <view
                v-else
                :class="['scroll-container', { 'scroll-container--with-background': isFullBackground || isHeaderBackground }]"
            >
                <!-- Sidebar Component -->
                <Sidebar
                    :isVisible="isSidebarOpen"
                    :userInfo="userInfo"
                    @close="toggleSidebar"
                    @avatar-error="onAvatarError"
                    @logout-confirm="showLogoutConfirm"
                />

                <!-- Main Content -->
                <view
                    class="main-content"
                    :class="{
                        'main-content--with-background': isFullBackground,
                        'main-content--header-background': isHeaderBackground
                    }"
                >
                    <view
                        class="profile-hero-section"
                        :class="{ 'profile-hero-section--with-background': isHeaderBackground }"
                        :style="profileHeroStyle"
                    >
                        <view v-if="isHeaderBackground" class="profile-hero-bg-image"></view>
                        <view v-if="isHeaderBackground" class="profile-hero-bg-overlay"></view>
                        <ProfileCard
                            :user-info="userInfo"
                            :follower-count="followerCount"
                            :growth-stats="growthStats"
                            :is-self="isViewingSelf"
                            :show-growth-stats="false"
                            @avatar-error="onAvatarError"
                            @edit-profile="navigateToEditProfile"
                            @toggle-sidebar="toggleSidebar"
                            @navigate-fans="navigateToFans"
                            @manage-background="handleManageBackground"
                        />
                    </view>
                    <view v-if="isHeaderBackground" class="profile-body-shell-cap"></view>
                    <view
                        class="profile-body-shell"
                        :class="{ 'profile-body-shell--header-background': isHeaderBackground }"
                    >
                    <!-- Tab Navigation -->
                    <view class="tab-navigation">
                        <view :class="'tab-item ' + (currentTab === 'posts' ? 'active' : '')" data-tab="posts" @tap="switchTab">
                            <image class="tab-icon tab-icon--writing" src="/static/images/writing.png" mode="aspectFit"></image>
                        </view>
                        <view :class="'tab-item ' + (currentTab === 'portfolio' ? 'active' : '')" data-tab="portfolio" @tap="switchTab">
                            <image class="tab-icon" src="/static/images/newicons/library.png" mode="aspectFit"></image>
                        </view>
                        <view :class="'tab-item ' + (currentTab === 'favorites' ? 'active' : '')" data-tab="favorites" @tap="switchTab">
                            <image class="tab-icon" src="/static/images/newicons/collection.png" mode="aspectFit"></image>
                        </view>
                    </view>

                    <!-- My Posts Section -->
                    <view class="my-posts-section" v-if="currentTab === 'posts'">
                        <block v-if="myPosts.length > 0">
                            <PostItem
                                v-for="(item, index) in myPosts"
                                :key="index"
                                :item="item"
                                :index="index"
                                :swiper-height="swiperHeights[index]"
                                :show-menu="true"
                                :show-poem-author="false"
                                time-label="发布于"
                                time-field="formattedCreateTime"
                                @show-action-menu="handlePostActionMenu"
                                @avatar-error="onAvatarError"
                                @avatar-load="onAvatarLoad"
                                @navigate-to-user="handleNavigateToUser"
                                @preview-image="handlePreviewImage"
                                @image-error="onImageError"
                                @image-load="onImageLoad"
                                @tag-click="handleTagClick"
                            />
                            <!-- 加载更多提示 -->
                            <view class="loading-footer">
                                <block v-if="!hasMore && myPosts.length > 0">
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
                            <PostItem
                                v-for="(item, index) in favoriteList"
                                :key="index"
                                :item="item"
                                :index="index"
                                :swiper-height="swiperHeights[index]"
                                :show-menu="false"
                                :show-poem-author="true"
                                time-label="收藏于"
                                time-field="formattedFavoriteTime"
                                :show-remove-favorite-btn="true"
                                @avatar-error="onAvatarError"
                                @avatar-load="onAvatarLoad"
                                @navigate-to-user="handleNavigateToUser"
                                @preview-image="handlePreviewImage"
                                @image-error="onImageError"
                                @image-load="onImageLoad"
                                @tag-click="handleTagClick"
                                @remove-favorite="handleRemoveFavorite"
                            />
                            <!-- 加载更多提示 -->
                            <view class="loading-footer">
                                <block v-if="!favoriteHasMore && favoriteList.length > 0">
                                    <text>--- 我是有底线的 ---</text>
                                </block>
                            </view>
                            <view style="height: 200rpx"></view>
                        </block>
                        <view v-else class="empty-tip">
                            <text>你还没有收藏过内容哦～</text>
                        </view>
                    </view>

                    <!-- Portfolio Section -->
                    <view class="portfolio-section" v-if="currentTab === 'portfolio'">
                        <!-- 作品集书籍组件 -->
                        <PortfolioBook
                            :portfolio-list="portfolioList"
                            :is-loading="portfolioLoading"
                            @navigate-to-portfolio="navigateToPortfolio"
                            @open-portfolio="openPortfolio"
                        />

                        <!-- 时间轴视图组件 -->
                        <TimelineView
                            :timeline-posts="timelinePosts"
                            :timeline-groups="timelineGroups"
                            :collapsed-months="collapsedMonths"
                            :is-loading="timelineLoading"
                            :has-error="timelineError"
                            :show-export-button="true"
                            export-button-text="导出卡片"
                            @update:collapsed-months="updateCollapsedMonths"
                            @navigate-to-post="navigateToPostDetail"
                            @retry="loadTimelineData"
                            @export="onTimelineExport"
                        />
                    </view>
                    </view>
                </view>
            </view>
        </view>
        <!-- 这是一个<view class="container"> 添加的结束标签 -->

        <view
            v-if="backgroundActionSheet.visible"
            class="background-action-sheet-mask"
            @tap="handleBackgroundActionSheetCancel"
        ></view>
        <view
            v-if="backgroundActionSheet.visible"
            class="background-action-sheet-panel"
            @tap.stop
        >
            <view
                v-for="(item, index) in backgroundActionSheet.items"
                :key="`${item}-${index}`"
                class="background-action-sheet-item"
                @tap="handleBackgroundActionSheetSelect(index)"
            >
                <text class="background-action-sheet-text">{{ item }}</text>
            </view>
        </view>

        <!-- #ifndef MP-WEIXIN -->
        <app-tab-bar ref="customTabBar" :style="tabBarStyle" />
        <!-- #endif -->

        <!-- 底部操作菜单 -->
        <ActionMenu
            :visible="isActionMenuVisible"
            :is-hidden="actionMenuData.isHidden"
            @close="hideActionMenu"
            @edit="handleEditPost"
            @toggle-visibility="handleToggleVisibility"
            @delete="handleDeleteFromMenu"
            @compose-series="handleComposeSeries"
        />

        <!-- 删除帖子弹窗 -->
        <DeleteModal
            :visible="showDeleteModal"
            title="删除帖子"
            message="您确定要删除这条帖子吗？"
            @close="hideDeleteModal"
            @save-draft="saveToDraft"
            @confirm="confirmDelete"
        />

        <share-modal
            :show="showTimelineShareModal"
            :image-urls="timelineShareImageUrls"
            :longpress-menu-enabled="timelineShareLongpressMenuEnabled"
            :share-config="timelineShareConfig"
            :preview-text="timelineSharePreviewText"
            :color-palettes="colorPalettes"
            :poem-lines="poemLines"
            @hide="hideTimelineShareModal"
            @save="saveTimelineShareImages"
            @longpress="saveTimelineShareImages"
            @font-size-preview="onTimelineFontSizePreview"
            @font-family-preview="onTimelineFontFamilyPreview"
            @font-settings-change="onTimelineFontSettingsChange"
            @color-change="onTimelineColorChange"
            @force-regenerate="forceRegenerateTimelineCanvas"
        />

        <!-- #ifdef APP-PLUS -->
        <view
            v-if="showTimelineShareModal && (timelineShareConfig.fontFamily || '汇文明朝') === '汇文明朝'"
            style="position: fixed; top: -9999px; left: -9999px; opacity: 0; pointer-events: none;"
        >
            <text>汇文明朝Aa</text>
        </view>
        <!-- #endif -->

        <!-- #ifdef MP-WEIXIN -->
        <canvas
            id="timelineShareCanvas"
            type="2d"
            style="position: fixed; top: -9999px; left: -9999px; width: 750px; overflow: hidden;"
            :style="{ height: timelineShareCanvasHeight + 'px' }"
        ></canvas>
        <!-- #endif -->
        <!-- #ifndef MP-WEIXIN -->
        <canvas
            id="timelineShareCanvas"
            canvas-id="timelineShareCanvas"
            style="position: fixed; top: -9999px; left: -9999px; width: 750px; overflow: hidden;"
            :style="{ height: timelineShareCanvasHeight + 'px' }"
        ></canvas>
        <!-- #endif -->
    </view>

</template>

<script>
// #ifndef MP-WEIXIN
import AppTabBar from '@/custom-tab-bar/index.vue';
// #endif
import Sidebar from './Sidebar.vue';
import TimelineView from '@/components/TimelineView.vue';
import PortfolioBook from '@/components/PortfolioBook.vue';
import PostItem from '@/components/PostItem.vue';
import ProfileCard from '@/components/ProfileCard.vue';
import ActionMenu from '@/components/ActionMenu.vue';
import DeleteModal from '@/components/DeleteModal.vue';
import ShareModal from '@/components/ShareModal.vue';
import { getMyPosts, getMyFavorites, invalidateMyFavorites, invalidateMyPosts, invalidateMyInfo, getMyInfo } from '@/api-cache/my.js';
import { togglePostVisibility, deletePost as deletePostApi, saveDraft, getPostDetail, removeFavorite as removeFavoriteApi, getFollowerCount, updateUserInfo, logout } from '@/api-cache/profile-actions.js';
import { getPortfolioFolders, notifyPortfolioUpdated, invalidatePortfolioCache } from '@/api-cache/portfolio.js';
import { resetAllCachesOnAccountChange } from '@/utils/accountCacheReset.js';
import { navigateToUserProfile } from '@/utils/navigation.js';
import { calculateAge } from '@/utils/ageCalculator.js';
import { fetchTimelineData } from '@/utils/profileTimeline.js';
import { checkLoginOrPrompt } from '@/utils/authHelper.js';
import {
  groupPostsByMonth as groupPostsByMonthUtil,
  processPostsForTimeline as processPostsForTimelineUtil,
  formatDateLabel as formatDateLabelUtil,
  formatMonthLabel as formatMonthLabelUtil,
  toggleMonthCollapse as toggleMonthCollapseUtil
} from '@/utils/timeline.js';
import { calcBookHeight as calcBookHeightUtil } from '@/utils/bookLayout.js';
import { extractGrowthStats } from '@/utils/growthStats.js';
import { formatRelativeTime } from '@/utils/time.js';
import { previewImage } from '@/utils/imagePreview.js';
import postGalleryMixin from '@/mixins/postGallery.js';
import appBackgroundPageMixin from '@/mixins/appBackgroundPage.js';
import { updateTabBarStatus } from '@/utils/tabBarCompatibility.js';
import { invalidateMyProfile } from '@/api-cache/profile.js';
import { emitPostVisibilityChanged, emitFavoriteChanged } from '@/utils/events.js';
import { getShareAppMessageConfig, getShareTimelineConfig } from '@/utils/shareHelper.js';
import { applyUserInfoWithAppBackground, normalizeAppBackgroundMode } from '@/utils/appBackground.js';
import { clearUserSession, getAppState, getOpenid, patchAppState } from '@/utils/app-state.js';
import { getUserAvatarSeed, resolveUserAvatar } from '@/utils/defaultAvatar.js';
import { colorPalettes } from '@/utils/colorPalettes.js';
import { poemLines } from '@/utils/poemLines.js';
import fontManager from '@/utils/fontManager.js';
import { getWindowInfoCompat } from '@/utils/system-info.js';
import { uploadFile } from '../../utils/uploader.js';
import { cloudCall } from '../../utils/cloudCall.js';
import { getCurrentPlatform } from '../../utils/platformDetector.js';
import { saveImagesToAlbum } from '../../utils/shareImage.js';
import { generateTimelineShareImages } from '../../utils/timelineShareCanvas.js';

const PAGE_SIZE = 5;
const PROFILE_BACKGROUND_THEME_VARS = Object.freeze({
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
    '--app-post-discussion-quote-bg': 'transparent',
    '--app-post-author-color': 'rgba(17, 17, 17, 0.92)',
    '--app-post-title-color': 'rgba(17, 17, 17, 0.98)',
    '--app-post-content-color': 'rgba(17, 17, 17, 0.86)',
    '--app-post-time-color': 'rgba(17, 17, 17, 0.70)',
    '--app-post-discussion-color': 'rgba(17, 17, 17, 0.80)',
    '--app-post-meta-color': 'rgba(17, 17, 17, 0.70)',
    '--app-post-poem-author-color': 'rgba(17, 17, 17, 0.92)',
    '--app-post-menu-dot-color': 'rgba(17, 17, 17, 0.50)',
    '--app-post-original-accent-color': 'rgba(17, 17, 17, 0.90)',
    '--profile-poemid-color': 'rgba(17, 17, 17, 0.70)',
    '--profile-meta-color': 'rgba(17, 17, 17, 0.74)',
    '--profile-name-color': 'rgba(17, 17, 17, 0.98)',
    '--profile-bio-color': 'rgba(17, 17, 17, 0.92)',
    '--app-fixed-bar-bg': 'rgba(255, 255, 255, 0.78)',
    '--app-fixed-bar-shadow': '0 -6rpx 20rpx rgba(0, 0, 0, 0.08)',
    '--app-tab-icon-wrap-bg': 'rgba(255, 255, 255, 0.66)',
    '--app-tab-icon-inner-bg': 'rgba(255, 255, 255, 0.88)',
    '--app-tab-icon-wrap-shadow': '0 12rpx 24rpx rgba(0, 0, 0, 0.12)',
    '--profile-button-bg': 'transparent',
    '--profile-button-active-bg': 'rgba(255, 255, 255, 0.90)',
    '--profile-button-border': '1.5rpx solid rgba(17, 17, 17, 0.35)',
    '--profile-button-shadow': '0 6rpx 18rpx rgba(0, 0, 0, 0.08)',
    '--profile-button-text-color': '#111111',
    '--profile-icon-button-bg': 'transparent',
    '--profile-icon-button-active-bg': 'transparent',
    '--profile-icon-button-border': 'none',
    '--profile-icon-button-shadow': 'none',
    '--profile-upload-icon-opacity': '1',
    '--profile-upload-icon-filter': 'grayscale(1) brightness(0.12)',
    '--profile-menu-icon-opacity': '1',
    '--profile-menu-icon-filter': 'grayscale(1) brightness(0.16)',
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
const PROFILE_HEADER_THEME_VARS = Object.freeze({
    '--profile-poemid-color': 'rgba(255, 255, 255, 0.76)',
    '--profile-meta-color': 'rgba(255, 255, 255, 0.82)',
    '--profile-name-color': '#ffffff',
    '--profile-bio-color': 'rgba(255, 255, 255, 0.92)',
    '--profile-button-bg': 'rgba(255, 255, 255, 0.16)',
    '--profile-button-active-bg': 'rgba(255, 255, 255, 0.24)',
    '--profile-button-border': '1.5rpx solid rgba(255, 255, 255, 0.34)',
    '--profile-button-shadow': '0 10rpx 24rpx rgba(0, 0, 0, 0.18)',
    '--profile-button-text-color': '#ffffff',
    '--profile-icon-button-bg': 'rgba(255, 255, 255, 0.12)',
    '--profile-icon-button-active-bg': 'rgba(255, 255, 255, 0.20)',
    '--profile-icon-button-border': '1.5rpx solid rgba(255, 255, 255, 0.28)',
    '--profile-icon-button-shadow': '0 10rpx 24rpx rgba(0, 0, 0, 0.12)',
    '--profile-upload-icon-opacity': '1',
    '--profile-upload-icon-filter': 'brightness(0) invert(1)',
    '--profile-menu-icon-opacity': '0.94',
    '--profile-menu-icon-filter': 'brightness(0) invert(1)'
});

const TIMELINE_SHARE_FONT_SCALE_MAP = Object.freeze({
    '汇文明朝': 1.0,
    '文艺体': 1.0,
    '龙藏体': 1.0,
    '小小的楷体': 1.0,
    '南西雅致黑': 1.0,
    '字体圈欣意吉祥宋': 1.0,
    system: 1.0
});

function updateCanvas2DFontSize(ctx, fontSize) {
    if (!ctx || !fontSize) return;

    const currentFont = String(ctx.font || '').trim();
    const familyMatch = currentFont.match(/\d+(?:\.\d+)?px\s+(.+)$/);
    const family = familyMatch && familyMatch[1] ? familyMatch[1] : 'sans-serif';
    ctx.font = `${fontSize}px ${family}`;
}

function createCanvas2DCompatContext(nativeCtx) {
    if (!nativeCtx) return null;

    return {
        get font() {
            return nativeCtx.font;
        },
        set font(value) {
            nativeCtx.font = value;
        },
        clearRect(...args) {
            return nativeCtx.clearRect(...args);
        },
        drawImage(...args) {
            return nativeCtx.drawImage(...args);
        },
        measureText(...args) {
            return nativeCtx.measureText(...args);
        },
        fillText(...args) {
            return nativeCtx.fillText(...args);
        },
        beginPath(...args) {
            return nativeCtx.beginPath(...args);
        },
        moveTo(...args) {
            return nativeCtx.moveTo(...args);
        },
        lineTo(...args) {
            return nativeCtx.lineTo(...args);
        },
        arcTo(...args) {
            return nativeCtx.arcTo(...args);
        },
        quadraticCurveTo(...args) {
            return nativeCtx.quadraticCurveTo(...args);
        },
        closePath(...args) {
            return nativeCtx.closePath(...args);
        },
        fill(...args) {
            return nativeCtx.fill(...args);
        },
        stroke(...args) {
            return nativeCtx.stroke(...args);
        },
        save(...args) {
            return nativeCtx.save(...args);
        },
        restore(...args) {
            return nativeCtx.restore(...args);
        },
        clip(...args) {
            return nativeCtx.clip(...args);
        },
        setFillStyle(value) {
            nativeCtx.fillStyle = value;
        },
        setStrokeStyle(value) {
            nativeCtx.strokeStyle = value;
        },
        setLineWidth(value) {
            nativeCtx.lineWidth = value;
        },
        setTextAlign(value) {
            nativeCtx.textAlign = value;
        },
        setFontSize(value) {
            updateCanvas2DFontSize(nativeCtx, value);
        },
        draw(reserve, callback) { // eslint-disable-line no-unused-vars
            if (typeof callback === 'function') {
                callback();
            }
        }
    };
}

export default {
    components: {
        Sidebar,
        TimelineView,
        PortfolioBook,
        PostItem,
        ProfileCard,
        ActionMenu,
        DeleteModal,
        ShareModal,
        // #ifndef MP-WEIXIN
        AppTabBar
        // #endif
    },
    mixins: [postGalleryMixin, appBackgroundPageMixin],
    data() {
        return {
            isLoading: true,
            hasInitialSnapshot: false,
            isAtomicRefreshing: false,
            pendingRefreshToken: 0,

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

            currentTab: 'posts',
            timelinePosts: [],
            timelineGroups: {},
            timelineLoading: false,
            timelineError: false,
            collapsedMonths: {},
            showTimelineShareModal: false,
            timelineShareGenerating: false,
            timelineShareCanvasHeight: 1200,
            timelineShareImagePages: [],
            timelineShareRenderToken: 0,
            timelineShareRenderFontFamily: '汇文明朝',
            timelineShareRenderFontScale: 1.0,
            timelineShareConfig: {
                fontSize: 38,
                titleFontSize: 46,
                fontFamily: '汇文明朝',
                backgroundColor: '#FFFFFF',
                textColor: '#000000',
                fontScale: 1.0
            },
            timelineShareRegenerateTimeout: null,
            timelineShareLongpressMenuEnabled: false,
            colorPalettes,
            poemLines,
            timelineFontManager: fontManager,

            // 'posts' | 'favorites'
            favoriteList: [],
            favoritePage: 0,
            favoriteHasMore: true,
            favoriteLoading: false,

            currentUserOpenid: '',

            swiperFixedHeight: '',
            selected: 0,
            isLoadingMore: false,
            isViewingSelf: false,
            imgindex: 0,
            img: '',

            followerCount: 0,
            portfolioList: [],
            portfolioLoading: false,  // 作品集加载状态
            img: '',
            // 关注统计
            followerCount: 0,
            // 作品集数据
            portfolioList: [],

            // 删除弹窗相关状态
            showDeleteModal: false,
            deletePostId: '',
            deletePostIndex: -1,
            // 底部操作菜单相关状态
            isActionMenuVisible: false,
            actionMenuData: {
                postId: '',
                index: -1,
                isHidden: false
            },
            // 花草成长统计
            backgroundActionSheet: {
                visible: false,
                items: []
            },
            growthStats: {
                seed: 0,
                leaf: 0,
                flower: 0,
                peach: 0
            },

            // 时间轴相关数据
        };
    },
    computed: {
        profileForegroundStyle() {
            return this.isFullBackground ? PROFILE_BACKGROUND_THEME_VARS : {};
        },
        profileHeroStyle() {
            return this.isHeaderBackground ? { ...PROFILE_HEADER_THEME_VARS, ...this.appBackgroundPageStyle } : {};
        },
        timelineShareImageUrls() {
            return (this.timelineShareImagePages || [])
                .map((item) => item && item.imageUrl)
                .filter(Boolean);
        },
        timelineSharePreviewText() {
            const firstPost = (this.timelinePosts || [])[0] || {};
            const firstSeriesBlock = Array.isArray(firstPost.seriesBlocks) ? firstPost.seriesBlocks[0] : null;
            const excerpt = (firstPost.content || (firstSeriesBlock && firstSeriesBlock.content) || firstPost.title || '').trim();
            return excerpt || '我的创作时间轴';
        },
        tabBarStyle() {
            if (!this.isFullBackground) {
                return {};
            }
            return {
                '--app-fixed-bar-bg': '#ffffff',
                '--app-fixed-bar-shadow': 'none',
                '--app-tab-icon-wrap-bg': '#f8f8f8',
                '--app-tab-icon-inner-bg': '#ffffff',
                '--app-tab-icon-wrap-shadow': '0 18rpx 32rpx rgba(0, 0, 0, 0.16)',
                '--app-tab-text-color': 'rgba(17, 17, 17, 0.65)'
            };
        }
    },
    async onLoad(options) {
        // 使用新的登录检查工具
        const isLoggedIn = await checkLoginOrPrompt({
            content: '查看个人主页需要登录，请先登录',
            onCancel: () => {
                // 返回到首页
                uni.switchTab({
                    url: '/pages/index/index'
                });
            }
        });

        if (!isLoggedIn) {
            return;
        }

        // 计算3:4比例高度（宽3高4，竖屏）
        const windowWidth = getWindowInfoCompat().windowWidth;
        const fixedHeight = Math.round((windowWidth * 4) / 3);
        this.setData({
            swiperFixedHeight: fixedHeight
        });
        try {
            // #ifdef MP-WEIXIN
            this.timelineShareLongpressMenuEnabled = true;
            // #endif
        } catch (_) {}

        this.ensureGlobalEventBindings();

        // onLoad 只负责触发异步请求，然后立即结束
        this.getProfileData();
    },
    onShow: function () {
        // #ifndef MP-WEIXIN
        try { uni.hideTabBar({ animation: false }); } catch (e) {}
        // #endif
        // TabBar 状态更新，使用兼容性处理
        updateTabBarStatus(this, 3);

        // 每次进入页面时主动刷新数据（但避免首次加载时重复调用）
        if (this.hasInitialSnapshot) {
            const shouldForce = !!(
                uni.getStorageSync('shouldRefreshIndex') ||
                uni.getStorageSync('shouldRefreshProfile') ||
                uni.getStorageSync('shouldRefreshPoem') ||
                uni.getStorageSync('shouldRefreshMountain')
            );
            if (shouldForce) {
                uni.removeStorageSync('shouldRefreshIndex');
                uni.removeStorageSync('shouldRefreshProfile');
                uni.removeStorageSync('shouldRefreshPoem');
                uni.removeStorageSync('shouldRefreshMountain');
            }
            this.refreshProfileAtomically({ reason: 'onShow', forceRefresh: shouldForce }).catch(() => {});
        }
    },
    onPullDownRefresh: function () {
        // 超时保护：最多10秒后自动停止刷新动画
        const refreshTimeout = setTimeout(() => {
            console.warn('【profile】下拉刷新超时，强制停止');
            uni.stopPullDownRefresh();
        }, 10000);

        const stopRefresh = () => {
            clearTimeout(refreshTimeout);
            uni.stopPullDownRefresh();
        };
        this.refreshProfileAtomically({
            reason: 'pull-down',
            forceRefresh: true
        }).finally(stopRefresh);
    },
    onReachBottom: function () {
        if (this.isAtomicRefreshing) {
            return;
        }
        if (this.currentTab === 'posts') {
            if (!this.hasMore || this.isLoading) {
                return;
            }
            this.loadMyPosts();
        } else if (this.currentTab === 'favorites') {
            if (!this.favoriteHasMore || this.favoriteLoading) {
                return;
            }
            this.loadFavorites();
        }
    },
    onUnload: function () {
        this.releaseGlobalEventBindings();
        this.clearLoginWaitTimers();
        if (this.timelineShareRegenerateTimeout) {
            clearTimeout(this.timelineShareRegenerateTimeout);
            this.timelineShareRegenerateTimeout = null;
        }
        this.timelineShareRenderToken += 1;
        this._timelineShareCanvasRuntime = null;
        this.finishBackgroundActionSheet({ cancelled: true, silent: true });
    },
    methods: {
        ensureGlobalEventBindings: function () {
            if (this._globalEventsBound) {
                return;
            }
            if (!this._commentCountChangedHandler) {
                this._commentCountChangedHandler = (e = {}) => {
                    try {
                        if (e.postId) {
                            this.updatePostCommentCount(e.postId, e.commentCount);
                        }
                    } catch (_) {}
                };
            }
            if (!this._portfolioUpdatedHandler) {
                this._portfolioUpdatedHandler = () => {
                    try { invalidatePortfolioCache(); } catch (_) {}
                    if (this.currentTab === 'portfolio' && this.hasInitialSnapshot) {
                        this.refreshProfileAtomically({ reason: 'portfolio-updated', forceRefresh: true }).catch(() => {});
                    }
                };
            }
            if (!this._avatarUpdatedHandler) {
                this._avatarUpdatedHandler = (e = {}) => {
                    const openid = getOpenid();
                    if (e && e.userId === openid) {
                        invalidateMyInfo();
                        this.fetchUserProfileFast();
                    }
                };
            }
            if (!this._postCreatedHandler) {
                this._postCreatedHandler = (e = {}) => {
                    const openid = getOpenid();
                    if (e && e.userId === openid) {
                        invalidateMyPosts();
                        this.refreshProfileAtomically({ reason: 'post-created', forceRefresh: true }).catch(() => {});
                    }
                };
            }
            if (!this._favoriteChangedHandler) {
                this._favoriteChangedHandler = (e = {}) => {
                    const openid = getOpenid();
                    if (e && e.userId === openid) {
                        invalidateMyFavorites();
                        if (this.currentTab === 'favorites') {
                            this.refreshProfileAtomically({ reason: 'favorite-changed', forceRefresh: true }).catch(() => {});
                        }
                    }
                };
            }
            try { uni.$on && uni.$on('comment-count-changed', this._commentCountChangedHandler); } catch (_) {}
            try { uni.$on && uni.$on('portfolio-updated', this._portfolioUpdatedHandler); } catch (_) {}
            try { uni.$on && uni.$on('avatar-updated', this._avatarUpdatedHandler); } catch (_) {}
            try { uni.$on && uni.$on('post-created', this._postCreatedHandler); } catch (_) {}
            try { uni.$on && uni.$on('favorite-changed', this._favoriteChangedHandler); } catch (_) {}
            this._globalEventsBound = true;
        },
        releaseGlobalEventBindings: function () {
            if (!this._globalEventsBound) {
                return;
            }
            try { uni.$off && this._commentCountChangedHandler && uni.$off('comment-count-changed', this._commentCountChangedHandler); } catch (_) {}
            try { uni.$off && this._portfolioUpdatedHandler && uni.$off('portfolio-updated', this._portfolioUpdatedHandler); } catch (_) {}
            try { uni.$off && this._avatarUpdatedHandler && uni.$off('avatar-updated', this._avatarUpdatedHandler); } catch (_) {}
            try { uni.$off && this._postCreatedHandler && uni.$off('post-created', this._postCreatedHandler); } catch (_) {}
            try { uni.$off && this._favoriteChangedHandler && uni.$off('favorite-changed', this._favoriteChangedHandler); } catch (_) {}
            this._globalEventsBound = false;
        },
        clearLoginWaitTimers: function () {
            if (this._loginWaitInterval) {
                clearInterval(this._loginWaitInterval);
                this._loginWaitInterval = null;
            }
            if (this._loginWaitTimeout) {
                clearTimeout(this._loginWaitTimeout);
                this._loginWaitTimeout = null;
            }
        },
        createTimelineShareMeasureContext(logicalWidth = 750) {
            // #ifdef MP-WEIXIN
            if (typeof wx !== 'undefined' && typeof wx.createOffscreenCanvas === 'function') {
                try {
                    const measureCanvas = wx.createOffscreenCanvas({
                        type: '2d',
                        width: Math.max(1, Math.round(logicalWidth)),
                        height: 64
                    });
                    const measureCtx = measureCanvas && measureCanvas.getContext && measureCanvas.getContext('2d');
                    if (measureCtx) {
                        return measureCtx;
                    }
                } catch (error) {
                    console.warn('[timeline-share] offscreen measure canvas unavailable', error);
                }
            }
            // #endif

            return uni.createCanvasContext('timelineShareCanvas', this);
        },
        getTimelineShareCanvasRuntime(logicalWidth, logicalHeight) {
            return new Promise((resolve, reject) => {
                // #ifdef MP-WEIXIN
                try {
                    const query = (typeof wx !== 'undefined' && wx.createSelectorQuery
                        ? wx.createSelectorQuery()
                        : uni.createSelectorQuery()
                    ).in(this);

                    query.select('#timelineShareCanvas').fields({ node: true, size: true }, (res) => {
                        const canvas = res && res.node;
                        if (!canvas) {
                            reject(new Error('timeline share canvas node unavailable'));
                            return;
                        }

                        const nativeCtx = canvas.getContext && canvas.getContext('2d');
                        if (!nativeCtx) {
                            reject(new Error('timeline share canvas 2d context unavailable'));
                            return;
                        }

                        const systemInfo = getWindowInfoCompat();
                        const pixelRatio = Math.max(1, Number(systemInfo.pixelRatio || 1));
                        canvas.width = Math.max(1, Math.round(logicalWidth * pixelRatio));
                        canvas.height = Math.max(1, Math.round(logicalHeight * pixelRatio));
                        if (typeof nativeCtx.setTransform === 'function') {
                            nativeCtx.setTransform(1, 0, 0, 1, 0, 0);
                        }
                        if (typeof nativeCtx.scale === 'function') {
                            nativeCtx.scale(pixelRatio, pixelRatio);
                        }

                        const runtime = {
                            canvas,
                            nativeCtx,
                            ctx: createCanvas2DCompatContext(nativeCtx),
                            logicalWidth,
                            logicalHeight,
                            pixelRatio
                        };
                        this._timelineShareCanvasRuntime = runtime;
                        resolve(runtime);
                    }).exec();
                    return;
                } catch (error) {
                    reject(error);
                    return;
                }
                // #endif

                resolve(null);
            });
        },
        updateTimelineShareCanvasHeight: async function (height) {
            const nextHeight = Math.max(800, Math.round(height || 1200));
            try {
                this.setData && this.setData({ timelineShareCanvasHeight: nextHeight });
            } catch (_) {
                this.timelineShareCanvasHeight = nextHeight;
            }
            this.timelineShareCanvasHeight = nextHeight;
            if (this.$nextTick) {
                await new Promise((resolve) => this.$nextTick(resolve));
            }
            await new Promise((resolve) => setTimeout(resolve, 80));
        },
        onTimelineExport: function () {
            if (!Array.isArray(this.timelinePosts) || this.timelinePosts.length === 0) {
                uni.showToast({
                    title: '暂无可导出的时间轴',
                    icon: 'none'
                });
                return;
            }

            if (this.timelineShareGenerating) {
                uni.showToast({
                    title: '正在生成中',
                    icon: 'none'
                });
                return;
            }

            this.showTimelineShareModal = true;
            this.timelineShareImagePages = [];
            this.timelineShareGenerating = true;
            this.timelineShareCanvasHeight = 1200;
            this.timelineShareRenderToken += 1;

            const renderToken = this.timelineShareRenderToken;
            this.$nextTick(() => {
                setTimeout(() => {
                    if (!this.showTimelineShareModal || renderToken !== this.timelineShareRenderToken) return;
                    this.generateTimelineShareCard(renderToken);
                }, getCurrentPlatform() === 'app' ? 180 : 0);
            });
        },
        hideTimelineShareModal: function () {
            this.timelineShareRenderToken += 1;
            this.timelineShareGenerating = false;
            this.timelineShareImagePages = [];
            this._timelineShareCanvasRuntime = null;
            if (this.timelineShareRegenerateTimeout) {
                clearTimeout(this.timelineShareRegenerateTimeout);
                this.timelineShareRegenerateTimeout = null;
            }
            this.showTimelineShareModal = false;
        },
        ensureTimelineShareFont: async function (renderToken) {
            const requestedFontFamily = this.timelineShareConfig.fontFamily || '汇文明朝';
            const platform = getCurrentPlatform();

            if (requestedFontFamily === 'system') {
                this.timelineShareRenderFontFamily = 'system';
                this.timelineShareRenderFontScale = 1.0;
                return true;
            }

            try {
                await this.timelineFontManager.ensureFontAvailable(requestedFontFamily);
                if (renderToken !== this.timelineShareRenderToken) return false;

                const fontReadyDelay = platform === 'app'
                    ? 220
                    : (platform === 'mp-weixin' ? 180 : 100);
                await new Promise((resolve) => setTimeout(resolve, fontReadyDelay));
                if (renderToken !== this.timelineShareRenderToken) return false;

                this.timelineShareRenderFontFamily = requestedFontFamily;
                this.timelineShareRenderFontScale = TIMELINE_SHARE_FONT_SCALE_MAP[requestedFontFamily] || 1.0;
                return true;
            } catch (error) {
                console.warn('[timeline-share] font fallback to system', { requestedFontFamily, error });
                this.timelineShareRenderFontFamily = 'system';
                this.timelineShareRenderFontScale = 1.0;
                uni.showToast({
                    title: '字体加载失败，已回退默认字体',
                    icon: 'none'
                });
                return renderToken === this.timelineShareRenderToken;
            }
        },
        generateTimelineShareCard: async function (renderToken) {
            const activeToken = typeof renderToken === 'number'
                ? renderToken
                : (++this.timelineShareRenderToken);

            this.timelineShareGenerating = true;
            this.timelineShareImagePages = [];

            try {
                const fontReady = await this.ensureTimelineShareFont(activeToken);
                if (!fontReady || activeToken !== this.timelineShareRenderToken) {
                    return;
                }

                const effectiveShareConfig = {
                    ...this.timelineShareConfig,
                    fontFamily: this.timelineShareRenderFontFamily || this.timelineShareConfig.fontFamily || '汇文明朝',
                    fontScale: this.timelineShareRenderFontScale || this.timelineShareConfig.fontScale || 1.0
                };

                const pages = await generateTimelineShareImages({
                    posts: this.timelinePosts,
                    userInfo: this.userInfo,
                    shareConfig: effectiveShareConfig,
                    canvasRuntime: {
                        context: this,
                        canvasId: 'timelineShareCanvas',
                        createMeasureContext: (logicalWidth) => this.createTimelineShareMeasureContext(logicalWidth),
                        ensureCanvasRuntime: (logicalWidth, logicalHeight) => this.getTimelineShareCanvasRuntime(logicalWidth, logicalHeight),
                        setCanvasHeight: (height) => this.updateTimelineShareCanvasHeight(height)
                    }
                });

                if (activeToken !== this.timelineShareRenderToken) {
                    return;
                }

                this.timelineShareImagePages = Array.isArray(pages) ? pages : [];
            } catch (error) {
                console.error('[timeline-share] generate failed', error);
                if (activeToken === this.timelineShareRenderToken) {
                    uni.showToast({
                        title: '时间轴卡片生成失败',
                        icon: 'none'
                    });
                }
            } finally {
                if (activeToken === this.timelineShareRenderToken) {
                    this.timelineShareGenerating = false;
                }
            }
        },
        saveTimelineShareImages: async function () {
            const imagePaths = (this.timelineShareImagePages || [])
                .map((item) => item && (item.filePath || item.imageUrl))
                .filter(Boolean);

            if (!imagePaths.length) {
                uni.showToast({
                    title: this.timelineShareGenerating ? '正在生成图片' : '暂无可保存图片',
                    icon: 'none'
                });
                return;
            }

            try {
                await saveImagesToAlbum(imagePaths, {
                    fileNamePrefix: 'timeline_share'
                });
            } catch (error) {
                console.error('[timeline-share] save failed', error);
                uni.showToast({
                    title: error && error.message ? error.message : '保存失败',
                    icon: 'none'
                });
            }
        },
        onTimelineFontSizePreview: function (fontSize) {
            const fontFamily = this.timelineShareConfig.fontFamily || '汇文明朝';
            this.debouncedRegenerateTimelineShareImages({
                ...this.timelineShareConfig,
                fontSize,
                titleFontSize: Math.round(fontSize * 1.21),
                fontScale: TIMELINE_SHARE_FONT_SCALE_MAP[fontFamily] || 1.0
            });
        },
        onTimelineFontFamilyPreview: function (fontFamily) {
            this.debouncedRegenerateTimelineShareImages({
                ...this.timelineShareConfig,
                fontFamily,
                fontScale: TIMELINE_SHARE_FONT_SCALE_MAP[fontFamily] || 1.0
            });
        },
        onTimelineFontSettingsChange: function (settings) {
            this.timelineShareConfig = {
                ...this.timelineShareConfig,
                fontSize: settings.fontSize,
                titleFontSize: Math.round(settings.fontSize * 1.21),
                fontFamily: settings.fontFamily,
                fontScale: TIMELINE_SHARE_FONT_SCALE_MAP[settings.fontFamily] || 1.0
            };
            this.regenerateTimelineShareImages();
        },
        onTimelineColorChange: function (colorConfig) {
            this.timelineShareConfig = {
                ...this.timelineShareConfig,
                backgroundColor: colorConfig.backgroundColor,
                textColor: colorConfig.textColor
            };
            this.regenerateTimelineShareImages();
        },
        debouncedRegenerateTimelineShareImages: function (nextConfig) {
            if (this.timelineShareRegenerateTimeout) {
                clearTimeout(this.timelineShareRegenerateTimeout);
            }
            this.timelineShareRegenerateTimeout = setTimeout(() => {
                this.timelineShareConfig = nextConfig;
                this.regenerateTimelineShareImages();
            }, 300);
        },
        regenerateTimelineShareImages: function () {
            if (!this.showTimelineShareModal) return;
            this.timelineShareImagePages = [];
            this.timelineShareCanvasHeight = 1200;
            this.timelineShareRenderToken += 1;
            const renderToken = this.timelineShareRenderToken;
            this.$nextTick(() => {
                setTimeout(() => {
                    if (!this.showTimelineShareModal || renderToken !== this.timelineShareRenderToken) return;
                    this.generateTimelineShareCard(renderToken);
                }, 60);
            });
        },
        forceRegenerateTimelineCanvas: function () {
            if (!this.showTimelineShareModal) return;
            this.timelineShareImagePages = [];
            this.timelineShareCanvasHeight = 1200;
            this.timelineShareRenderToken += 1;
            const renderToken = this.timelineShareRenderToken;
            this.$nextTick(() => {
                setTimeout(() => {
                    if (!this.showTimelineShareModal || renderToken !== this.timelineShareRenderToken) return;
                    this.generateTimelineShareCard(renderToken);
                }, 200);
            });
        },
        calcBookHeight(name) {
          return calcBookHeightUtil(name);
        },
        showBackgroundActionSheet: function (items = []) {
            this.finishBackgroundActionSheet({ cancelled: true, silent: true });
            this.backgroundActionSheet = {
                visible: true,
                items: Array.isArray(items) ? items.slice() : []
            };
            return new Promise((resolve, reject) => {
                this._backgroundActionSheetResolve = resolve;
                this._backgroundActionSheetReject = reject;
            });
        },
        finishBackgroundActionSheet: function ({ tapIndex = -1, cancelled = false, silent = false } = {}) {
            const resolve = this._backgroundActionSheetResolve;
            const reject = this._backgroundActionSheetReject;
            this._backgroundActionSheetResolve = null;
            this._backgroundActionSheetReject = null;
            this.backgroundActionSheet = {
                visible: false,
                items: []
            };
            if (cancelled) {
                if (!silent && typeof reject === 'function') {
                    reject({ errMsg: 'showActionSheet:fail cancel' });
                }
                return;
            }
            if (typeof resolve === 'function') {
                resolve({ tapIndex });
            }
        },
        handleBackgroundActionSheetSelect: function (index) {
            this.finishBackgroundActionSheet({ tapIndex: index });
        },
        handleBackgroundActionSheetCancel: function () {
            this.finishBackgroundActionSheet({ cancelled: true });
        },
        // 处理匿名头像点击事件的函数
        handleAnonymousAvatarClick(e) {
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

        // 显示底部操作菜单
        showActionMenu: function (e) {
            const postId = e.currentTarget.dataset.postid;
            const index = parseInt(e.currentTarget.dataset.index);
            const isHidden = !!e.currentTarget.dataset.hidden;

            if (!postId || typeof index === 'undefined') {
                console.error('【profile】showActionMenu: 参数缺失', { postId, index });
                return;
            }

            this.setData({
                isActionMenuVisible: true,
                actionMenuData: {
                    postId: postId,
                    index: index,
                    isHidden: isHidden
                }
            });
        },

        // 隐藏底部操作菜单
        hideActionMenu: function () {
            this.setData({
                isActionMenuVisible: false,
                actionMenuData: {
                    postId: '',
                    index: -1,
                    isHidden: false
                }
            });
        },

        // 从菜单中处理隐藏/取消隐藏
        handleToggleVisibility: function () {
            const { postId, index, isHidden } = this.actionMenuData;
            if (!postId || typeof index === 'undefined') {
                console.error('【profile】handleToggleVisibility: 参数缺失');
                this.hideActionMenu();
                return;
            }

            const targetHidden = !isHidden;

            uni.showLoading({ title: targetHidden ? '隐藏中...' : '取消隐藏中...' });

            togglePostVisibility(postId, this)
                .then((result) => {
                    const path = `myPosts[${index}].isHidden`;
                    const updates = {};
                    updates[path] = result.isHidden;
                    this.setData(updates);

                    try {
                        emitPostVisibilityChanged({ postId, isHidden: result.isHidden });
                    } catch (_) {}

                    uni.showToast({
                        title: result.isHidden ? '已隐藏' : '已取消隐藏',
                        icon: 'success'
                    });
                })
                .catch((err) => {
                    console.error('【profile】切换帖子可见性失败:', err);
                    uni.showToast({
                        title: err.message || '操作失败',
                        icon: 'none'
                    });
                })
                .finally(() => {
                    uni.hideLoading();
                    this.hideActionMenu();
                });
        },

        // 从菜单中处理编辑
        handleEditPost: function () {
            const { postId, index } = this.actionMenuData;
            if (!postId || typeof index === 'undefined') {
                console.error('【profile】handleEditPost: 参数缺失');
                this.hideActionMenu();
                return;
            }

            // 获取当前帖子数据
            const post = this.myPosts[index];
            if (!post) {
                console.error('【profile】handleEditPost: 帖子不存在');
                this.hideActionMenu();
                return;
            }

            this.hideActionMenu();

            // 跳转到编辑页面，传递帖子ID
            uni.navigateTo({
                url: `/pages-publish/add/add?mode=edit&postId=${postId}`,
                success: () => {
                    console.log('【profile】跳转到编辑页面成功');
                },
                fail: (err) => {
                    console.error('【profile】跳转到编辑页面失败:', err);
                    uni.showToast({
                        title: '跳转失败',
                        icon: 'none'
                    });
                }
            });
        },

        // 从菜单中处理删除
        handleDeleteFromMenu: function () {
            const { postId, index } = this.actionMenuData;
            if (!postId || typeof index === 'undefined') {
                console.error('【profile】handleDeleteFromMenu: 参数缺失');
                this.hideActionMenu();
                return;
            }

            this.hideActionMenu();
            this.setData({
                showDeleteModal: true,
                deletePostId: postId,
                deletePostIndex: index
            });
        },

        // 隐藏/取消隐藏帖子（使用API封装）
        onToggleVisibility: function (e) {
            const postId = e.currentTarget.dataset.postid;
            const index = e.currentTarget.dataset.index;
            const currentlyHidden = !!e.currentTarget.dataset.hidden;
            if (!postId || typeof index === 'undefined') return;
            const targetHidden = !currentlyHidden;

            togglePostVisibility(postId, this).then(() => {
                const path = `myPosts[${index}].isHidden`;
                const updates = {};
                updates[path] = targetHidden;
                this.setData(updates);
                try { emitPostVisibilityChanged({ postId, isHidden: targetHidden }); } catch (_) {}
                uni.showToast({ title: targetHidden ? '已隐藏' : '已取消隐藏', icon: 'success' });
            }).catch((err) => {
                console.error('updatePostVisibility failed', err);
                uni.showToast({ title: '操作失败', icon: 'none' });
            });
        },
        getProfileData: function () {
            // 获取用户信息和帖子数据
            this.checkLoginAndFetchData();
        },

        // 新增：清除个人主页缓存并重新加载
        invalidateProfileCacheAndReload: function () {
            console.log('【profile】🧹 开始清除个人主页缓存');
            console.log('【profile】📊 当前标签页:', this.currentTab);
            console.log('【profile】📋 当前myPosts长度:', this.myPosts.length);

            try {
                // 清除个人主页相关缓存
                console.log('【profile】🗑️ 调用invalidateMyPosts()');
                invalidateMyPosts();
                console.log('【profile】🗑️ 调用invalidateMyInfo()');
                invalidateMyInfo();

                // 如果当前在收藏标签页，也清除收藏缓存
                if (this.currentTab === 'favorites') {
                    console.log('【profile】🗑️ 调用invalidateMyFavorites()');
                    invalidateMyFavorites();
                }

                console.log('【profile】✅ 个人主页缓存清除完成');

                // 验证缓存是否真的被清除了
                console.log('【profile】🔍 缓存清除后myPosts长度:', this.myPosts.length);
            } catch (e) {
                console.warn('【profile】❌ 清除缓存失败:', e);
            }
        },

        // 新增：刷新个人资料数据的方法（使用与下拉刷新相同的逻辑）
        getCurrentProfileOpenid: function () {
            return (
                getOpenid() ||
                (this.userInfo && (this.userInfo._openid || this.userInfo.openid)) ||
                ''
            );
        },

        normalizeProfileUserInfo: function (user) {
            const state = getAppState();
            const sessionUser =
                state.userInfo ||
                this.userInfo ||
                {};
            const nextUser = user ? { ...sessionUser, ...user } : { ...sessionUser };
            nextUser.avatarUrl = resolveUserAvatar(nextUser.avatarUrl, getUserAvatarSeed(nextUser));
            nextUser.appBackgroundMode = normalizeAppBackgroundMode(nextUser.appBackgroundMode, nextUser.appBackgroundUrl);
            if (nextUser && nextUser.birthday) {
                nextUser.age = this.calculateAge(nextUser.birthday);
            } else if (nextUser) {
                nextUser.age = '';
            }
            return nextUser;
        },

        formatPostsForDisplay: function (posts = [], currentUserInfo = {}, openid = '') {
            return (posts || []).map((post = {}, index) => {
                const nextPost = { ...post };
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
                    nextPost.authorName = nextPost.authorNameSnapshot || '我';
                }
                if (currentUserInfo.avatarUrl) {
                    nextPost.authorAvatar = currentUserInfo.avatarUrl;
                } else if (!nextPost.authorAvatar || !String(nextPost.authorAvatar).trim()) {
                    nextPost.authorAvatar = resolveUserAvatar(nextPost.authorAvatar || nextPost.authorAvatarSnapshot || '', openid || nextPost._openid);
                }
                console.log(`【profile】📦 原子刷新帖子${index + 1}:`, {
                    id: nextPost._id,
                    _openid: nextPost._openid,
                    authorName: nextPost.authorName
                });
                return nextPost;
            });
        },

        formatFavoritesForDisplay: function (favorites = []) {
            return (favorites || []).map((favorite = {}) => {
                const nextFavorite = { ...favorite };
                if (nextFavorite.favoriteTime) {
                    nextFavorite.formattedFavoriteTime = this.formatTime(nextFavorite.favoriteTime);
                }
                if (nextFavorite.imageUrls && nextFavorite.imageUrls.length > 0) {
                    nextFavorite.imageStyle = 'height: 0; padding-bottom: 75%;';
                }
                return nextFavorite;
            });
        },

        buildTimelineCollapsedMonths: function (groups = {}) {
            const nextCollapsed = {};
            const currentCollapsed = this.collapsedMonths || {};
            Object.keys(groups || {}).forEach((key) => {
                if (currentCollapsed[key]) {
                    nextCollapsed[key] = true;
                }
            });
            return nextCollapsed;
        },

        async fetchProfileHeaderSnapshot({ forceRefresh = false } = {}) {
            if (forceRefresh) {
                try {
                    invalidateMyInfo();
                    invalidateMyProfile();
                } catch (_) {}
            }

            const [user, followerCount] = await Promise.all([
                getMyInfo(this),
                getFollowerCount(this).catch((error) => {
                    console.warn('[profile] follower count refresh failed', error);
                    return this.followerCount || 0;
                })
            ]);

            const nextUser = this.normalizeProfileUserInfo(user);
            return {
                userInfo: nextUser,
                followerCount,
                growthStats: extractGrowthStats(nextUser),
                appBackgroundResolvedUrl: (nextUser && nextUser.appBackgroundUrl) || '',
                appBackgroundMode: (nextUser && nextUser.appBackgroundMode) || ''
            };
        },

        async fetchPostsTabRaw({ forceRefresh = false } = {}) {
            if (forceRefresh) {
                try { invalidateMyPosts(); } catch (_) {}
            }
            return await getMyPosts({
                page: 0,
                pageSize: PAGE_SIZE,
                context: this,
                forceRefresh
            });
        },

        async fetchFavoritesTabRaw({ forceRefresh = false } = {}) {
            if (forceRefresh) {
                try { invalidateMyFavorites(); } catch (_) {}
            }
            return await getMyFavorites({
                page: 0,
                pageSize: PAGE_SIZE,
                context: this
            });
        },

        async fetchPortfolioTabRaw({ forceRefresh = false, openid = '' } = {}) {
            const [portfolioList, timeline] = await Promise.all([
                getPortfolioFolders({ context: this, forceRefresh }),
                fetchTimelineData(this.$tcb, {
                    openid,
                    formatTimeFn: this.formatTime
                })
            ]);

            return {
                portfolioList: portfolioList || [],
                timeline: timeline || { posts: [], groups: {} }
            };
        },

        async buildAtomicSnapshot({ tab = this.currentTab, forceRefresh = false } = {}) {
            const openid = this.getCurrentProfileOpenid();
            if (!openid) {
                throw new Error('无法获取用户openid');
            }

            const headerPromise = this.fetchProfileHeaderSnapshot({ forceRefresh });
            let tabPromise;

            if (tab === 'favorites') {
                tabPromise = this.fetchFavoritesTabRaw({ forceRefresh });
            } else if (tab === 'portfolio') {
                if (forceRefresh) {
                    try { invalidatePortfolioCache(); } catch (_) {}
                }
                tabPromise = this.fetchPortfolioTabRaw({ forceRefresh, openid });
            } else {
                tabPromise = this.fetchPostsTabRaw({ forceRefresh });
            }

            const [header, tabRaw] = await Promise.all([headerPromise, tabPromise]);
            const updates = {
                userInfo: header.userInfo || {},
                followerCount: header.followerCount,
                growthStats: header.growthStats,
                appBackgroundResolvedUrl: header.appBackgroundResolvedUrl,
                appBackgroundMode: header.appBackgroundMode,
                hasInitialSnapshot: true,
                isLoading: false
            };

            if (tab === 'favorites') {
                const favoriteList = this.formatFavoritesForDisplay(tabRaw);
                Object.assign(updates, {
                    favoriteList,
                    favoritePage: 1,
                    favoriteHasMore: favoriteList.length === PAGE_SIZE,
                    favoriteLoading: false,
                    swiperHeights: {},
                    imageClampHeights: {}
                });
            } else if (tab === 'portfolio') {
                const timelinePosts = (tabRaw && tabRaw.timeline && tabRaw.timeline.posts) || [];
                const timelineGroups = (tabRaw && tabRaw.timeline && tabRaw.timeline.groups) || {};
                Object.assign(updates, {
                    portfolioList: (tabRaw && tabRaw.portfolioList) || [],
                    portfolioLoading: false,
                    timelinePosts,
                    timelineGroups,
                    timelineLoading: false,
                    timelineError: false,
                    collapsedMonths: this.buildTimelineCollapsedMonths(timelineGroups)
                });
            } else {
                const myPosts = this.formatPostsForDisplay(tabRaw, header.userInfo, openid);
                Object.assign(updates, {
                    myPosts,
                    page: 1,
                    hasMore: myPosts.length === PAGE_SIZE,
                    swiperHeights: {},
                    imageClampHeights: {},
                    growthStats: extractGrowthStats(header.userInfo, myPosts)
                });
            }

            return {
                updates,
                userInfo: header.userInfo
            };
        },

        syncAtomicUserSession: async function (userInfo) {
            if (!userInfo) {
                return;
            }
            try {
                await applyUserInfoWithAppBackground(userInfo, {
                    emit: false,
                    writeStorage: true,
                    writeGlobal: true
                });
            } catch (error) {
                console.warn('[profile] sync atomic user session failed', error);
            }
        },

        refreshProfileAtomically: async function ({ reason = 'manual', forceRefresh = false } = {}) {
            const token = (this.pendingRefreshToken || 0) + 1;
            this.pendingRefreshToken = token;
            this.isAtomicRefreshing = true;

            const isInitialLoad = !this.hasInitialSnapshot;
            if (isInitialLoad) {
                this.setData({ isLoading: true });
            }

            try {
                console.log('【profile】⚡ 开始原子刷新:', { reason, forceRefresh, tab: this.currentTab, token });
                const snapshot = await this.buildAtomicSnapshot({
                    tab: this.currentTab,
                    forceRefresh
                });

                if (token !== this.pendingRefreshToken) {
                    return false;
                }

                await this.syncAtomicUserSession(snapshot.userInfo);

                if (token !== this.pendingRefreshToken) {
                    return false;
                }

                this.setData(snapshot.updates);
                this._hasFirstShow = true;
                return true;
            } catch (error) {
                if (token !== this.pendingRefreshToken) {
                    return false;
                }

                console.error('【profile】❌ 原子刷新失败:', reason, error);

                if (isInitialLoad) {
                    const storedUserInfo = uni.getStorageSync('userInfo');
                    if (storedUserInfo) {
                        const nextUser = this.normalizeProfileUserInfo(storedUserInfo);
                        await this.syncAtomicUserSession(nextUser);
                        if (token === this.pendingRefreshToken) {
                            this.setData({
                                userInfo: nextUser,
                                followerCount: this.followerCount || 0,
                                growthStats: extractGrowthStats(nextUser),
                                appBackgroundResolvedUrl: nextUser.appBackgroundUrl || '',
                                appBackgroundMode: nextUser.appBackgroundMode || '',
                                hasInitialSnapshot: true,
                                isLoading: false
                            });
                        }
                    } else {
                        this.setData({
                            hasInitialSnapshot: true,
                            isLoading: false
                        });
                        uni.showToast({ title: '获取数据失败', icon: 'none' });
                    }
                } else {
                    uni.showToast({ title: '刷新失败', icon: 'none' });
                }

                return false;
            } finally {
                if (token === this.pendingRefreshToken) {
                    this.isAtomicRefreshing = false;
                    if (!this.hasInitialSnapshot && !this.isLoading) {
                        this.hasInitialSnapshot = true;
                    }
                }
            }
        },

        refreshProfileData: function () {
            this.refreshProfileAtomically({ reason: 'refresh', forceRefresh: true }).catch(() => {});
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
            this.updateGrowthStats([]);
            // 重新获取数据
            this.checkLoginAndFetchData();
        },

        checkLoginAndFetchData: function () {
            this.ensureGlobalEventBindings();
            const state = getAppState();
            const userInfo = state.userInfo;
            const currentOpenid = (userInfo && (userInfo._openid || userInfo.openid)) || state.openid;
            const loginProcessCompleted = !!state._loginProcessCompleted;

            if (currentOpenid && state.openid !== currentOpenid) {
                patchAppState({ openid: currentOpenid });
            }

            console.log('🔍 [profile] 检查登录状态:', {
                hasUserInfo: !!userInfo,
                hasOpenid: !!currentOpenid,
                loginProcessCompleted: loginProcessCompleted
            });

            if (userInfo && currentOpenid) {
                this.setData({ isViewingSelf: true });
                this.refreshProfileAtomically({ reason: 'initial', forceRefresh: false }).catch(() => {});
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
            this.clearLoginWaitTimers();
            this._loginWaitInterval = setInterval(() => {
                const loginProcessCompleted = !!getAppState()._loginProcessCompleted;

                if (loginProcessCompleted) {
                    this.clearLoginWaitTimers();
                    console.log('✅ [profile] 登录流程已完成，重新检查登录状态');
                    this.checkLoginAndFetchData();
                }
            }, 100); // 每100ms检查一次

            // 设置超时，避免无限等待
            this._loginWaitTimeout = setTimeout(() => {
                this.clearLoginWaitTimers();
                console.log('⚠️ [profile] 等待登录流程超时，继续执行');
                this.checkLoginAndFetchData();
            }, 5000); // 5秒超时
        },

        // 新增：使用缓存封装的资料拉取，显著降低头像/签名首屏等待
        fetchUserProfileFast: function () {
            getMyInfo(this)
                .then((user) => {
                    console.log('【profile】获取到的用户数据:', user);
                    console.log('【profile】growthCounts数据:', user?.growthCounts);
                    const nextUser = this.normalizeProfileUserInfo(user);
                    this.appBackgroundResolvedUrl = (nextUser && nextUser.appBackgroundUrl) || '';
                    this.appBackgroundMode = (nextUser && nextUser.appBackgroundMode) || '';
                    this.setData({ userInfo: nextUser || {}, isLoading: false });
                    // 立即更新成长统计
                    this.updateGrowthStats();
                })
                .catch((err) => {
                    console.error('获取用户资料失败（缓存封装）:', err);
                    this.setData({ isLoading: false });
                    const storedUserInfo = uni.getStorageSync('userInfo');
                    if (storedUserInfo) {
                        storedUserInfo.appBackgroundMode = normalizeAppBackgroundMode(storedUserInfo.appBackgroundMode, storedUserInfo.appBackgroundUrl);
                        if (storedUserInfo.birthday) storedUserInfo.age = this.calculateAge(storedUserInfo.birthday);
                        this.appBackgroundResolvedUrl = storedUserInfo.appBackgroundUrl || '';
                        this.appBackgroundMode = storedUserInfo.appBackgroundMode || '';
                        this.setData({ userInfo: storedUserInfo });
                    } else {
                        uni.showToast({ title: '获取数据失败', icon: 'none' });
                    }
                });
        },


        loadMyPosts: function (cb, forceRefresh = false) {
            const { page, PAGE_SIZE } = this;
            console.log('【profile】🔍 开始loadMyPosts, 页面信息:', {
                page,
                PAGE_SIZE,
                skip: page * PAGE_SIZE,
                limit: PAGE_SIZE,
                isPullDownRefresh: page === 0,
                forceRefresh: forceRefresh,
                currentMyPostsLength: this.myPosts.length
            });

            // 只有在首次加载时才显示骨架屏
            if (page === 0) {
                console.log('【profile】📱 重置数据状态', forceRefresh ? '(强制刷新模式)' : '(正常模式)');
                this.setData({
                    isLoading: true
                });
            }

            // 获取当前用户openid用于调试
            const currentOpenid = getOpenid();
            console.log('【profile】👤 当前用户openid:', currentOpenid);

            // 如果是下拉刷新（page === 0）或强制刷新，直接从云端获取数据
            if (page === 0 || forceRefresh) {
                console.log('【profile】🔥 下拉刷新/强制刷新，直接从云端获取最新数据');
                return this.loadMyPostsDirectly(page, PAGE_SIZE, currentOpenid, cb);
            }

            // 否则使用缓存API
            console.log('【profile】🚀 使用缓存API获取帖子（分页加载）');
            try {
                return getMyPosts({ page, pageSize: PAGE_SIZE, context: this, forceRefresh: forceRefresh })
                    .then((posts) => {
                        console.log('【profile】✅ 缓存API成功返回帖子数量:', posts.length);
                        console.log('【profile】📋 缓存API返回的帖子ID列表:', posts.map(p => p._id));

                        // 格式化帖子数据并确保使用个人资料昵称
                        const currentUserInfo = this.userInfo || {};
                        posts.forEach((post, index) => {
                            if (post.createTime) post.formattedCreateTime = this.formatTime(post.createTime);
                            if (post.imageUrls && post.imageUrls.length > 0) post.imageStyle = `height: 0; padding-bottom: 75%;`;

                            // 【关键修复】确保帖子有 _openid 字段（我的帖子都是当前用户的）
                            if (!post._openid && currentOpenid) {
                                post._openid = currentOpenid;
                            }

                            // 【关键修复】直接使用个人资料的昵称填充帖子的authorName
                            if (currentUserInfo.nickName) {
                                post.authorName = currentUserInfo.nickName;
                            } else if (!post.authorName || post.authorName.trim() === '') {
                                post.authorName = post.authorNameSnapshot || '我';
                            }

                            // 同样处理头像
                            if (currentUserInfo.avatarUrl) {
                                post.authorAvatar = currentUserInfo.avatarUrl;
                            } else if (!post.authorAvatar || post.authorAvatar.trim() === '') {
                                post.authorAvatar = resolveUserAvatar(post.authorAvatar || post.authorAvatarSnapshot || '', currentOpenid || post._openid);
                            }

                            console.log(`【profile】📝 缓存帖子${index + 1}:`, {
                                id: post._id,
                                _openid: post._openid,
                                title: post.title,
                                createTime: post.createTime,
                                formattedTime: post.formattedCreateTime,
                                authorName: post.authorName
                            });
                        });

                        // 处理分页数据，避免重复
                        const newMyPosts = page === 0 ? posts : (() => {
                            const existingIds = new Set(this.myPosts.map(p => p._id));
                            const uniqueNewList = posts.filter(p => p && p._id && !existingIds.has(p._id));
                            return this.myPosts.concat(uniqueNewList);
                        })();
                        console.log('【profile】📊 缓存API更新myPosts数据:', {
                            beforeLength: this.myPosts.length,
                            afterLength: newMyPosts.length,
                            page: page + 1,
                            hasMore: posts.length === PAGE_SIZE
                        });

                        this.setData({
                            myPosts: newMyPosts,
                            page: page + 1,
                            hasMore: posts.length === PAGE_SIZE
                        });
                        this.updateGrowthStats(newMyPosts);

                        console.log('【profile】✅ 缓存API加载完成');
                        return posts;
                    })
                    .catch((err) => {
                        console.error('【profile】❌ 缓存API获取帖子失败，回退到云函数:', err);
                        // 回退到云函数
                        return this.loadMyPostsDirectly(page, PAGE_SIZE, currentOpenid, cb);
                    })
                    .finally(() => {
                        this.setData({ isLoading: false });
                        if (typeof cb === 'function') {
                            console.log('【profile】🎯 缓存API loadMyPosts完成，调用回调');
                            cb();
                        }
                    });
            } catch (e) {
                console.error('【profile】❌ 缓存API调用异常，回退到云函数:', e);
                return this.loadMyPostsDirectly(page, PAGE_SIZE, currentOpenid, cb);
            }
        },

        // 新增：直接使用API封装加载帖子的方法
        loadMyPostsDirectly: function (page, pageSize, openid, cb) {
            console.log('【profile】🔥 使用API封装getMyPosts');
            getMyPosts({
                page,
                pageSize,
                context: this,
                forceRefresh: true
            }).then((posts) => {
                console.log('【profile】✅ API封装成功返回帖子数量:', posts.length);
                console.log('【profile】📋 API封装返回的帖子ID列表:', posts.map(p => p._id));

                // 格式化帖子数据并确保作者信息完整
                const currentOpenid = getOpenid();
                posts.forEach((post, index) => {
                    if (post.createTime) {
                        post.formattedCreateTime = this.formatTime(post.createTime);
                    }
                    // 为每个帖子设置默认的图片样式
                    if (post.imageUrls && post.imageUrls.length > 0) {
                        post.imageStyle = `height: 0; padding-bottom: 75%;`; // 4:3 宽高比占位
                    }

                    // 【关键修复】确保帖子有 _openid 字段（我的帖子都是当前用户的）
                    if (!post._openid && currentOpenid) {
                        post._openid = currentOpenid;
                    }

                    // 【关键修复】直接使用个人资料的昵称（userInfo.nickName）填充帖子的authorName
                    // 个人资料页面显示的昵称就是 userInfo.nickName，这里也直接用这个
                    const currentUserInfo = this.userInfo || {};
                    if (currentUserInfo.nickName) {
                        post.authorName = currentUserInfo.nickName;
                        console.log(`【profile】✅ 帖子${index + 1}使用个人资料昵称:`, post.authorName);
                    } else if (!post.authorName || post.authorName.trim() === '') {
                        post.authorName = post.authorNameSnapshot || '我';
                        console.log(`【profile】⚠️ 帖子${index + 1}个人资料无昵称，使用备选:`, post.authorName);
                    }

                    // 同样处理头像
                    if (currentUserInfo.avatarUrl) {
                        post.authorAvatar = currentUserInfo.avatarUrl;
                    } else if (!post.authorAvatar || post.authorAvatar.trim() === '') {
                        post.authorAvatar = resolveUserAvatar(post.authorAvatar || post.authorAvatarSnapshot || '', currentOpenid || post._openid);
                        console.log(`【profile】⚠️ 帖子${index + 1}个人资料无头像，使用备选`);
                    }

                    console.log(`【profile】📝 API封装帖子${index + 1}:`, {
                        id: post._id,
                        _openid: post._openid,
                        title: post.title,
                        createTime: post.createTime,
                        formattedTime: post.formattedCreateTime,
                        authorName: post.authorName, // 使用个人资料昵称
                        userInfoNickName: currentUserInfo.nickName, // 个人资料中的昵称
                        hasAuthorAvatar: !!post.authorAvatar
                    });
                });

                // 处理分页数据，避免重复
                const newMyPosts = page === 0 ? posts : (() => {
                    const existingIds = new Set(this.myPosts.map(p => p._id));
                    const uniqueNewList = posts.filter(p => p && p._id && !existingIds.has(p._id));
                    return this.myPosts.concat(uniqueNewList);
                })();
                console.log('【profile】📊 API封装更新myPosts数据:', {
                    beforeLength: this.myPosts.length,
                    afterLength: newMyPosts.length,
                    page: page + 1,
                    hasMore: posts.length === pageSize
                });

                this.setData({
                    myPosts: newMyPosts,
                    page: page + 1,
                    hasMore: posts.length === pageSize
                });
                this.updateGrowthStats(newMyPosts);
            }).catch((err) => {
                console.error('【profile】❌ API封装调用失败:', err);
                uni.showToast({
                    title: '网络错误',
                    icon: 'none'
                });
            }).finally(() => {
                this.setData({
                    isLoading: false
                });
                if (typeof cb === 'function') {
                    console.log('【profile】🎯 API封装loadMyPosts完成，调用回调');
                    cb();
                }
            });
        },

        updateGrowthStats(postList = this.myPosts) {
            try {
                // 使用工具函数提取成长统计（优先使用后端数据，否则前端计算）
                const growthStats = extractGrowthStats(this.userInfo, postList);
                console.log('【profile】使用工具函数计算成长统计:', growthStats);
                this.setData({ growthStats });
            } catch (e) {
                console.error('【profile】计算成长统计失败:', e);
                this.setData({ growthStats: { seed: 0, leaf: 0, flower: 0, peach: 0 } });
            }
        },

        // 根据生日计算年龄（使用工具函数）
        calculateAge: function (birthday) {
            return calculateAge(birthday);
        },

        // 格式化时间
        formatTime: function (dateString) {
            return formatRelativeTime(dateString);
        },

        // 点击帖子跳转详情
        navigateToPostDetail: function (postId) {
            // 支持直接传入postId或从事件中获取
            const id = typeof postId === 'string' ? postId : postId.currentTarget.dataset.id;
            uni.navigateTo({
                url: `/pages/post-detail/post-detail?id=${id}`
            });
        },


        // 格式化帖子时间
        formatPostTime: function (createTime) {
            if (!createTime) return '';
            const date = new Date(createTime);
            return `${date.getMonth() + 1}月${date.getDate()}日`;
        },

        // 更新时间轴数据
        updateTimelineData: function () {
            // 只显示诗歌类型的帖子
            const poemPosts = this.myPosts.filter(post => post.isPoem === true);
            this.setData({
                timelinePosts: poemPosts,
                timelineGroups: groupPostsByMonthUtil(poemPosts)
            });
        },

        // 切换月份折叠状态
        // 更新折叠状态（由TimelineView组件调用）
        updateCollapsedMonths: function (newCollapsed) {
            this.setData({
                collapsedMonths: newCollapsed
            });
        },

        // 独立加载时间轴数据
        loadTimelineData: function () {
            console.log('【profile】开始加载时间轴数据');
            this.setData({
                timelineLoading: true,
                timelineError: false
            });

            const currentOpenid = getOpenid();

            if (!currentOpenid) {
                console.error('【profile】时间轴加载失败：无法获取用户openid');
                this.setData({
                    timelineLoading: false,
                    timelineError: true
                });
                return;
            }

            fetchTimelineData(this.$tcb, { openid: currentOpenid, formatTimeFn: this.formatTime })
                .then(({ posts, groups }) => {
                    this.setData({
                        timelinePosts: posts,
                        timelineGroups: groups,
                        timelineLoading: false,
                        timelineError: false
                    });
                })
                .catch((err) => {
                    console.error('【profile】时间轴数据加载失败:', err);
                    this.setData({
                        timelineLoading: false,
                        timelineError: true
                    });
                });
        },

        // 删除帖子
        onDelete: function (event) {
            const postId = event.currentTarget.dataset.postid;
            const index = event.currentTarget.dataset.index;

            console.log('【profile】onDelete调用:', { postId, index, event: event.currentTarget.dataset });

            if (!postId) {
                console.error('【profile】onDelete: postId未定义');
                uni.showToast({
                    title: '删除失败：帖子ID未找到',
                    icon: 'none'
                });
                return;
            }

            this.setData({
                showDeleteModal: true,
                deletePostId: postId,
                deletePostIndex: index
            });
        },

        // 隐藏删除弹窗
        hideDeleteModal: function () {
            this.setData({
                showDeleteModal: false,
                deletePostId: '',
                deletePostIndex: -1
            });
        },

        // 确认删除帖子
        confirmDelete: function () {
            console.log('【profile】confirmDelete调用开始');
            console.log('【profile】this对象:', this);
            console.log('【profile】this.data:', this.data);
            console.log('【profile】this.$data:', this.$data);

            // 使用最安全的方式获取数据
            const postId = (this && this.data && this.data.deletePostId) ||
                          (this && this.$data && this.$data.deletePostId) ||
                          (this && this.deletePostId);
            const index = (this && this.data && this.data.deletePostIndex) ||
                         (this && this.$data && this.$data.deletePostIndex) ||
                         (this && this.deletePostIndex);

            console.log('【profile】最终获取的数据:', { postId, index });

            if (!postId) {
                console.error('【profile】deletePostId未定义');
                uni.showToast({
                    title: '删除失败：帖子ID未找到',
                    icon: 'none'
                });
                this.hideDeleteModal();
                return;
            }

            this.hideDeleteModal();
            this.deletePost(postId, index);
        },

        // 保存到草稿箱
        saveToDraft: function () {
            console.log('【profile】saveToDraft调用开始');

            // 使用最安全的方式获取数据
            const postId = (this && this.data && this.data.deletePostId) ||
                          (this && this.$data && this.$data.deletePostId) ||
                          (this && this.deletePostId);
            const index = (this && this.data && this.data.deletePostIndex) ||
                         (this && this.$data && this.$data.deletePostIndex) ||
                         (this && this.deletePostIndex);

            console.log('【profile】saveToDraft最终获取的数据:', { postId, index });

            if (!postId) {
                console.error('【profile】saveToDraft: deletePostId未定义');
                uni.showToast({
                    title: '保存失败：帖子ID未找到',
                    icon: 'none'
                });
                this.hideDeleteModal();
                return;
            }

            this.hideDeleteModal();
            this.saveToDraftBox(postId, index);
        },

        // 直接删除帖子
        deletePost: function (postId, index) {
            const that = this;
            uni.showLoading({
                title: '删除中...'
            });

            deletePostApi(postId, this)
                .then(() => {
                    uni.showToast({
                        title: '删除成功'
                    });
                    const newList = that.myPosts.filter((post) => post._id !== postId);
                    that.setData({
                        myPosts: newList
                    });
                    notifyPortfolioUpdated({
                        source: 'profile:delete-post',
                        postId: postId
                    });
                    // 新增：删除成功后设置首页需要刷新标记
                    try {
                        uni.setStorageSync('shouldRefreshIndex', true);
                        uni.setStorageSync('shouldRefreshProfile', true);
                    } catch (e) {
                        console.log('CatchClause', e);
                        console.log('CatchClause', e);
                    }
                })
                .catch((err) => {
                    console.error('【profile】删除帖子失败:', err);
                    uni.showToast({
                        title: err.message || '删除失败',
                        icon: 'none'
                    });
                })
                .finally(() => {
                    uni.hideLoading();
                });
        },

        // 保存到草稿箱（使用API封装）
        saveToDraftBox: function (postId, index) {
            const that = this;
            uni.showLoading({
                title: '保存中...'
            });

            getPostDetail(postId, this).then((result) => {
                const post = result.post;
                if (post) {
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

                    // 保存到草稿箱（使用API封装）
                    return saveDraft(draftData, this);
                } else {
                    uni.hideLoading();
                    uni.showToast({
                        title: '获取帖子信息失败',
                        icon: 'none'
                    });
                    return Promise.reject('获取帖子信息失败');
                }
            }).then(() => {
                uni.hideLoading();
                uni.showToast({
                    title: '已保存到草稿箱',
                    icon: 'success'
                });
                // 删除原帖子
                that.deletePost(postId, index);
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


        navigateToFollowing: function () {
            uni.navigateTo({
                url: '/pages-user/following/following'
            });
        },

        navigateToFans: function () {
            uni.navigateTo({
                url: '/pages-user/fans/fans'
            });
        },

        // 跳转到编辑资料页面
        navigateToEditProfile: function () {
            uni.navigateTo({
                url: '/pages-user/profile-edit/profile-edit'
            });
        },

        // 主页背景管理菜单
        handleManageBackground: async function () {
            const hasBackground = !!(this.appBackgroundResolvedUrl || (this.userInfo && this.userInfo.appBackgroundUrl));
            const itemList = hasBackground
                ? ['\u66f4\u6362\u80cc\u666f', '\u79fb\u9664\u80cc\u666f']
                : ['\u4e0a\u4f20\u80cc\u666f', '\u79fb\u9664\u80cc\u666f'];
            try {
                const { tapIndex } = await this.showBackgroundActionSheet(itemList);
                if (tapIndex === 0) {
                    setTimeout(() => this.handleReplaceBackground(), 120);
                    return;
                }
                if (tapIndex === 1) {
                    this.handleClearBackground();
                }
            } catch (err) {
                if (!err || err.errMsg !== 'showActionSheet:fail cancel') {
                    console.warn('[profile] background action sheet failed', err);
                }
            }
        },
        selectBackgroundMode: async function () {
            try {
                const { tapIndex } = await this.showBackgroundActionSheet([
                    '\u5168\u5c4f\u80cc\u666f',
                    '\u56fe\u7247\u80cc\u666f'
                ]);
                return tapIndex === 1 ? 'header' : 'full';
            } catch (err) {
                if (err && err.errMsg === 'showActionSheet:fail cancel') {
                    return '';
                }
                throw err;
            }
        },
        handleReplaceBackground: async function () {
            let backgroundMode = '';
            try {
                backgroundMode = await this.selectBackgroundMode();
            } catch (err) {
                console.warn('[profile] background mode action sheet failed', err);
                return;
            }
            if (!backgroundMode) {
                return;
            }
            uni.chooseImage({
                count: 1,
                sizeType: ['compressed'],
                sourceType: ['album', 'camera'],
                success: async (res) => {
                    const filePath = res.tempFilePaths[0];
                    uni.showLoading({ title: '上传中...' });
                    try {
                        const fileID = await uploadFile(
                            `user_backgrounds/${Date.now()}_${Math.floor(Math.random() * 1000)}.jpg`,
                            filePath
                        );
                        await cloudCall('updateUserProfile', {
                            appBackgroundUrl: fileID,
                            appBackgroundMode: backgroundMode
                        });
                        invalidateMyInfo();
                        await this.refreshProfileAtomically({ reason: 'background-changed', forceRefresh: true });
                        await this.refreshAppBackground();
                        uni.showToast({ title: '背景已更新', icon: 'success' });
                    } catch (err) {
                        console.error('[profile] background upload failed', err);
                        uni.showToast({ title: '上传失败', icon: 'none' });
                    } finally {
                        uni.hideLoading();
                    }
                }
            });
        },
        handleClearBackground: function () {
            const hasBackground = !!(this.appBackgroundResolvedUrl || (this.userInfo && this.userInfo.appBackgroundUrl));
            if (!hasBackground) {
                uni.showToast({ title: '当前没有背景图', icon: 'none' });
                return;
            }

            uni.showModal({
                title: '移除背景',
                content: '确定要移除当前背景图吗？',
                success: async (res) => {
                    if (!res.confirm) {
                        return;
                    }

                    uni.showLoading({ title: '移除中...' });
                    try {
                        await cloudCall('updateUserProfile', { clearAppBackground: true });
                        invalidateMyInfo();
                        await this.refreshProfileAtomically({ reason: 'background-cleared', forceRefresh: true });
                        uni.showToast({ title: '背景已移除', icon: 'success' });
                    } catch (err) {
                        console.error('[profile] clear background failed', err);
                        uni.showToast({ title: '移除失败', icon: 'none' });
                    } finally {
                        uni.hideLoading();
                    }
                }
            });
        },
        goToSeriesCompose: function () {
            uni.navigateTo({ url: '/pages-publish/series-compose/series-compose' });
        },

        // 从菜单中处理组诗合成
        handleComposeSeries: function () {
            this.hideActionMenu();
            this.goToSeriesCompose();
        },

        // 跳转到收藏夹页面
        navigateToFavoriteFolders: function () {
            uni.navigateTo({
                url: '/pages-content/favorite-folders/favorite-folders'
            });
        },


        // 跳转到消息通知页面
        navigateToMessages: function () {
            uni.navigateTo({
                url: '/pages-tools/messages/messages'
            });
        },

        // 检查未读消息数量

        // fetch follow/fan counters for current user (使用API封装)
        fetchFollowCounts: function () {
            getFollowerCount(this).then((followerTotal) => {
                this.setData({ followerCount: followerTotal });
            }).catch((e) => {});
        },

        // 新增：标签切换方法
        switchTab: function (e) {
            const tab = e.currentTarget.dataset.tab;
            console.log('【profile】切换到标签:', tab);

            // 如果点击的是收藏页且当前已经在收藏页，则跳转到收藏夹页面
            if (tab === 'favorites' && this.currentTab === 'favorites') {
                console.log('【profile】已在收藏页，跳转到收藏夹页面');
                this.navigateToFavoriteFolders();
                return;
            }

            // 如果点击的是作品集页且当前已经在作品集页，则跳转到作品集管理页面
            if (tab === 'portfolio' && this.currentTab === 'portfolio') {
                console.log('【profile】已在作品集页，跳转到作品集管理页面');
                this.navigateToPortfolio();
                return;
            }

            if (tab === this.currentTab) {
                return;
            } // 如果是当前标签，不做任何操作

            this.setData({
                currentTab: tab
            });
            if (tab === 'favorites' && this.favoriteList.length === 0) {
                // 首次加载收藏数据
                this.loadFavorites();
            } else if (tab === 'portfolio') {
                // 切换到作品集标签页时加载作品集数据
                this.loadPortfolios();
                // 同时加载时间轴数据
                if (this.timelinePosts.length === 0 && !this.timelineLoading) {
                    this.loadTimelineData();
                }
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
                        // 处理分页数据，避免重复
                        const newFavoriteList = favoritePage === 0 ? favorites : (() => {
                            const existingIds = new Set(this.favoriteList.map(p => p._id));
                            const uniqueNewList = (favorites || []).filter(p => p && p._id && !existingIds.has(p._id));
                            return this.favoriteList.concat(uniqueNewList);
                        })();
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
                        removeFavoriteApi(favoriteId, that).then(() => {
                            uni.hideLoading();
                            uni.showToast({
                                title: '已取消收藏'
                            });
                            // 从列表中移除该项
                            const newList = that.favoriteList.filter((item, i) => i !== index);
                            that.setData({
                                favoriteList: newList
                            });
                            try {
                                const userId = getOpenid();
                                const removed = that.favoriteList[index];
                                const postId = removed && (removed._id || removed.postId);
                                emitFavoriteChanged({ userId, postId, favored: false });
                            } catch (e) {}
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
                url: '/pages-tools/image-manager/image-manager'
            });
        },


        // 跳转到反馈管理页面（管理员）
        navigateToFeedbackAdmin: function () {
            uni.navigateTo({
                url: '/pages-tools/feedback-admin/feedback-admin'
            });
        },

        // 显示退出登录确认对话框
        showLogoutConfirm: function () {
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
        performLogout: function () {
            console.log('🔍 [退出登录] 开始执行退出登录流程');

            // 先清空所有缓存（包含 me:favorites 等命名空间与 fileUrlCache）
            resetAllCachesOnAccountChange({}).then(() => {
                // 清除本地存储的用户信息
                uni.removeStorageSync('userInfo');
                uni.removeStorageSync('userOpenId');
                uni.removeStorageSync('openid');
                clearUserSession();

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
            }).catch((error) => {
                console.error('❌ [退出登录] 退出登录失败:', error);
                uni.showToast({
                    title: '退出失败，请重试',
                    icon: 'none'
                });
            });
        },

        // 重新初始化匿名openid
        reinitializeAnonymousOpenid: function () {
            console.log('🔄 [退出登录] 重新初始化匿名openid');

            logout(this).then((loginRes) => {
                console.log('✅ [退出登录] 匿名openid初始化成功:', loginRes);

                // 获取openid
                let openid = null;
                if (loginRes.anonymousOpenid) {
                    openid = loginRes.anonymousOpenid;
                } else if (loginRes.result && loginRes.result.openid) {
                    openid = loginRes.result.openid;
                } else if (loginRes.openid) {
                    openid = loginRes.openid;
                } else if (loginRes.result && loginRes.result.uid) {
                    openid = loginRes.result.uid;
                }

                if (openid) {
                    patchAppState({ openid: openid });
                    console.log('✅ [退出登录] 匿名openid已设置:', openid);

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

        onAvatarLoad() {
            console.log('占位：函数 onAvatarLoad 未声明');
        },

        navigateToUserProfile(e) {
            navigateToUserProfile(e);
        },

        onTagClick() {
            console.log('占位：函数 onTagClick 未声明');
        },

        // === PostItem 组件事件处理方法 ===

        // 处理帖子操作菜单
        handlePostActionMenu(data) {
            this.setData({
                isActionMenuVisible: true,
                actionMenuData: {
                    postId: data.postId,
                    index: data.index,
                    isHidden: data.isHidden
                }
            });
        },

        // 处理跳转用户主页
        handleNavigateToUser(data) {
            // 获取当前用户ID
            const currentUserId = getOpenid();
            // 直接调用 navigateToUserProfile，传入正确的参数格式
            navigateToUserProfile({
                userId: data.userId,
                authorName: data.authorName || '未知用户',
                isAnonymous: data.isAnonymous || false,
                currentUserId: currentUserId
            });
        },

        // 处理预览图片
        handlePreviewImage(data) {
            previewImage({
                current: data.src,
                urls: data.urls
            });
        },

        // 处理标签点击
        handleTagClick(data) {
            console.log('标签点击:', data.tag);
            // 可以跳转到标签搜索页面
            // uni.navigateTo({
            //     url: `/pages-tools/search/search?tag=${encodeURIComponent(data.tag)}`
            // });
        },

        // 处理取消收藏
        handleRemoveFavorite(data) {
            // 构造兼容原有 removeFavorite 方法的事件对象
            const fakeEvent = {
                currentTarget: {
                    dataset: {
                        favoriteId: data.favoriteId,
                        index: data.index
                    }
                }
            };
            this.removeFavorite(fakeEvent);
        },

        // 打开作品集
        openPortfolio(portfolio = {}) {
            const folderId = portfolio.folderId || portfolio._id || '';
            const folderName = portfolio.folderName || portfolio.name || '';
            console.log('打开作品集:', { folderId, folderName, portfolio });
            if (!folderId) {
                uni.showToast({
                    title: '作品集信息缺失',
                    icon: 'none'
                });
                return;
            }
            uni.navigateTo({
                url: `/pages-content/portfolio-detail/portfolio-detail?folderId=${folderId}&folderName=${encodeURIComponent(folderName)}`,
                fail: (error) => {
                    console.error('打开作品集详情失败:', error);
                    uni.showToast({
                        title: '打开作品集失败',
                        icon: 'none'
                    });
                }
            });
        },

        // 跳转到作品集管理页面
        navigateToPortfolio() {
            uni.navigateTo({
                url: '/pages-content/portfolio/portfolio',
                fail: (error) => {
                    console.error('跳转作品集管理页面失败:', error);
                    uni.showToast({
                        title: '打开作品集失败',
                        icon: 'none'
                    });
                }
            });
        },

        // 加载作品集列表
        loadPortfolios(cb, forceRefresh = false) {
            this.setData({ portfolioLoading: true });
            getPortfolioFolders({ context: this, forceRefresh })
                .then((folders) => {
                    this.setData({
                        portfolioList: folders,
                        portfolioLoading: false
                    });
                })
                .catch((error) => {
                    console.error('加载作品集失败:', error);
                    uni.showToast({ title: '作品集加载失败', icon: 'none' });
                    this.setData({ portfolioLoading: false });
                })
                .finally(() => {
                    if (typeof cb === 'function') {
                        cb();
                    }
                });
        },

        // 分享到好友/群聊
        onShareAppMessage(res) {
            return getShareAppMessageConfig({
                title: 'poementer',
                path: '/pages/profile/profile'
            });
        },

        // 分享到朋友圈
        onShareTimeline() {
            return getShareTimelineConfig({
                title: 'poementer'
            });
        }

    }
};
</script>
<style>
/* pages/profile/profile.wxss */
.profile-page-root {
    position: relative;
    min-height: 100vh;
    background-color: #ffffff;
}

.profile-page-root--with-background {
    background-color: transparent;
}

.profile-bg-image {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-image: var(--app-background-image);
    background-size: cover;
    background-position: center top;
    z-index: 0;
    pointer-events: none;
}

.profile-bg-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(255, 255, 255, 0.1);
    z-index: 1;
    pointer-events: none;
}

.profile-bg-image--header {
    height: 44vh;
    position: fixed;
}

.profile-bg-overlay--header {
    height: 44vh;
    background: linear-gradient(to bottom, rgba(255, 255, 255, 0.10) 0%, rgba(255, 255, 255, 0.20) 50%, rgba(255, 255, 255, 0.92) 85%, rgba(255, 255, 255, 1) 100%);
}

.container {
    width: 100%;
    height: 100vh;
    position: relative;
    z-index: 2;
    background-color: #ffffff;
}

.container--with-background {
    min-height: 100vh;
    height: auto;
    background-color: transparent;
}

.scroll-container {
    width: 100%;
    height: 100%;
    background-color: #ffffff;
}

.scroll-container--with-background {
    min-height: 100vh;
    height: auto;
    background-color: transparent;
}


.main-content {
    width: 100%;
    /* height: 100vh; */
    background-color: #ffffff;
    /* overflow-y: auto; */
    padding-bottom: 100rpx; /* 为底部TabBar留出空间 */
}

.main-content--with-background {
    background-color: transparent;
    --app-post-discussion-quote-bg: transparent;
    --app-post-wrapper-margin: 0 24rpx 20rpx 24rpx;
    --app-post-wrapper-border: none;
    --app-post-wrapper-divider: none;
}

.main-content--header-background {
    background-color: transparent;
}

.main-content--with-background .discussion-content .discussion-sentence-card {
    background: transparent !important;
}

.main-content--with-background .profile-name-center,
.main-content--with-background .profile-poemid,
.main-content--with-background .profile-bio-center,
.main-content--with-background .profile-followers,
.main-content--with-background .growth-count,
.main-content--with-background .edit-profile-btn text {
    text-shadow: 0 2rpx 12rpx rgba(255, 255, 255, 0.45);
}

.profile-hero-section {
    position: relative;
    overflow: hidden;
}

.profile-hero-section--with-background {
    min-height: 560rpx;
    background-color: #0f0f0f;
}

.profile-hero-bg-image,
.profile-hero-bg-overlay {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    pointer-events: none;
}

.profile-hero-bg-image {
    background-image: var(--app-background-image);
    background-size: cover;
    background-position: center top;
    z-index: 0;
}

.profile-hero-bg-overlay {
    background: linear-gradient(180deg, rgba(0, 0, 0, 0.16) 0%, rgba(0, 0, 0, 0.42) 100%);
    z-index: 1;
}

.profile-hero-section .profile-card-center {
    position: relative;
    z-index: 2;
}

.profile-body-shell {
    width: 100%;
}

.profile-body-shell-cap {
    position: relative;
    height: 0;
    z-index: 2;
    pointer-events: none;
}

.profile-body-shell-cap::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 16rpx;
    transform: translateY(-14rpx);
    background-color: #ffffff;
    border-radius: 68rpx 68rpx 0 0;
}

.profile-body-shell--header-background {
    position: relative;
    background-color: #ffffff;
    margin-top: 0;
    border-radius: 0;
    padding-top: 0;
    overflow: hidden;
    z-index: 2;
}

.profile-body-shell--header-background .tab-item {
    padding: 8rpx 10rpx 12rpx;
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
    background: var(--profile-tab-nav-bg, #fff);
    border: 1rpx solid var(--profile-tab-nav-border, #fff);
    border-radius: 16rpx;
    overflow: hidden;
    box-shadow: var(--profile-tab-nav-shadow, none);
}

.tab-item {
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

.tab-item.active::after {
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

.tab-item:active {
    background: var(--profile-tab-item-active-bg, #f5f5f5);
}

.tab-icon {
    width: 110rpx;
    height: 110rpx;
    filter: var(--profile-tab-icon-filter, grayscale(1) brightness(0.5));
    opacity: var(--profile-tab-icon-opacity, 0.7);
}

.tab-icon--writing {
    width: 76rpx;
    height: 76rpx;
    transform: translateY(0);
}

.tab-item.active .tab-icon {
    filter: var(--profile-tab-icon-active-filter, grayscale(0) brightness(1));
    opacity: var(--profile-tab-icon-active-opacity, 1);
}

/* My Posts Section */
.my-posts-section {
    margin: 0 0 30rpx 0;
}

/* Portfolio Section */
.portfolio-section {
    margin: 0 0 30rpx 0;
}

/* Favorites Section */
.favorites-section {
    margin: 0 0 30rpx 0;
}

.section-title {
    font-size: 32rpx;
    font-weight: bold;
    color: #333;
    margin-bottom: 20rpx;
    padding: 0 10rpx;
}

/* PostItem 组件样式已封装，此处已清理冗余样式 */


.visibility-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    cursor: pointer;
    padding: 10rpx;
    margin-right: 20rpx;
}

.visibility-btn:active {
    transform: scale(0.9);
}

.visibility-icon {
    width: 100rpx;
    height: 100rpx;
}

/* .remove-favorite-btn 已封装到 PostItem 组件 */

.empty-tip {
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

.series-entry {
    margin: 12rpx 24rpx 0 24rpx;
    display: flex;
    justify-content: flex-end;
}
.series-btn {
    background: #3b7cff;
    color: #fff;
    padding: 12rpx 28rpx;
    border-radius: 12rpx;
    font-size: 26rpx;
}

.author-info {
    display: flex;
    align-items: flex-start;
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
.menu-btn-small {
    width: 40rpx;
    height: 40rpx;
    cursor: pointer;
    transition: transform 0.2s ease;
    filter: grayscale(1) brightness(0.5);
    opacity: 0.7;
}

.menu-btn-small:active {
    transform: scale(0.9);
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

/* 底部加载状态样式 */
.loading-footer {
    text-align: center;
    padding: 20rpx 0;
    color: var(--profile-loading-footer-color, #999);
    font-size: 14px;
}



/* Follow stats under bio */

.stat-divider {
    width: 1rpx;
    height: 36rpx;
    background-color: #eee;
}




.visibility-btn {
    margin-right: 20rpx;
    padding: 10rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    cursor: pointer;
}

.visibility-btn:active {
    transform: scale(0.9);
}

.visibility-icon {
    width: 60rpx;
    height: 60rpx;
}

.hidden-tag {
    font-size: 22rpx;
    color: #ff6b6b;
    margin-left: 8rpx;
    padding: 2rpx 8rpx;
    border: 1rpx solid #ffadb0;
    border-radius: 6rpx;
}


/* 成长统计样式 */
.profile-growth-stats {
    position: absolute;
    top: 120rpx;
    right: 40rpx;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 18rpx;
}

.growth-item {
    display: flex;
    align-items: center;
    gap: 12rpx;
}

.growth-icon {
    width: 48rpx;
    height: 48rpx;
}

.growth-count {
    font-size: 30rpx;
    font-weight: 600;
    color: #333;
}

.background-action-sheet-mask {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    background: rgba(0, 0, 0, 0.18);
    z-index: 1200;
}

.background-action-sheet-panel {
    position: fixed;
    left: 24rpx;
    right: 24rpx;
    bottom: 144rpx;
    bottom: calc(144rpx + constant(safe-area-inset-bottom));
    bottom: calc(144rpx + env(safe-area-inset-bottom));
    background: rgba(255, 255, 255, 0.96);
    border-radius: 24rpx;
    box-shadow: 0 18rpx 40rpx rgba(0, 0, 0, 0.14);
    overflow: hidden;
    z-index: 1201;
    backdrop-filter: blur(14rpx);
}

.background-action-sheet-item {
    min-height: 104rpx;
    padding: 0 36rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    border-bottom: 1rpx solid #f0f0f0;
}

.background-action-sheet-item:last-child {
    border-bottom: none;
}

.background-action-sheet-item:active {
    background: #f5f5f5;
}

.background-action-sheet-text {
    font-size: 32rpx;
    font-weight: 500;
    color: #333;
    line-height: 1.4;
}

</style>
