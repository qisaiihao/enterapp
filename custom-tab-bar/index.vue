<template>
    <view class="tab-bar">
        <view
            class="tab-bar-item"
            v-for="(item, index) in list"
            :key="index"
            :data-index="index"
            :data-path="item.pagePath"
            hover-class="tab-bar-item--touching"
            :hover-start-time="0"
            :hover-stay-time="80"
            @tap="switchTab"
        >
            <view class="tab-bar-content">
                <view :class="['icon-wrap', selected === index ? 'is-selected' : '']">
                    <view class="icon-inner">
                        <image
                            :class="['icon-img', selected === index ? 'icon-img--active' : '']"
                            :src="resolveIconPath(item, index)"
                            mode="aspectFill"
                        />
                    </view>
                </view>
                <text class="tab-bar-text" :style="selected === index ? 'color: var(--app-tab-active-text-color, #000000)' : ''">{{ item.text }}</text>
            </view>
        </view>
    </view>
</template>

<script>
import { lightImpact } from '@/utils/haptics.js';
import { requireLogin } from '@/utils/authHelper.js';
import { switchTabSmooth } from '@/utils/appTabTransition.js';

const DARK_TAB_ICON_VERSION = '20260429-toned-white';

function normalizeRoutePath(path) {
    return String(path || '')
        .split('?')[0]
        .replace(/^\/+/, '')
        .replace(/\/+$/, '');
}

function normalizeTabIndex(index) {
    const nextIndex = typeof index === 'number' ? index : parseInt(index, 10);
    return Number.isNaN(nextIndex) ? null : nextIndex;
}

export default {
    data() {
        return {
            selected: 0,
            color: '#999999',
            selectedColor: '#000000',
            lastTapTime: 0,
            lastTapIndex: -1,
            doubleTapThreshold: 300,
            list: [
                {
                    pagePath: 'pages/index/index',
                    text: '广场',
                    iconPath: '/static/images/market.png',
                    selectedIconPath: '/static/images/market.png',
                    darkIconPath: '/static/images/tab-dark/market-dark.png',
                    darkSelectedIconPath: '/static/images/tab-dark/marketplus-dark.png'
                },
                {
                    pagePath: 'pages/poem-square/poem-square',
                    text: '原创',
                    iconPath: '/static/images/road.png',
                    selectedIconPath: '/static/images/road.png',
                    darkIconPath: '/static/images/tab-dark/road-dark.png',
                    darkSelectedIconPath: '/static/images/tab-dark/roadplus-dark.png'
                },
                {
                    pagePath: 'pages/mountain/mountain',
                    text: '读诗',
                    iconPath: '/static/images/mountain.png',
                    selectedIconPath: '/static/images/mountain.png',
                    darkIconPath: '/static/images/tab-dark/mountain-dark.png',
                    darkSelectedIconPath: '/static/images/tab-dark/mountainplus-dark.png'
                },
                {
                    pagePath: 'pages/profile/profile',
                    text: '我',
                    iconPath: '/static/images/pools.png',
                    selectedIconPath: '/static/images/pools.png',
                    darkIconPath: '/static/images/tab-dark/pools-dark.png',
                    darkSelectedIconPath: '/static/images/tab-dark/poolsplus-dark.png'
                }
            ]
        };
    },
    created() {
        this.syncSelected();
    },
    mounted() {
        this.$nextTick(() => {
            this.syncSelected();
        });
    },
    methods: {
        getCachedSelected() {
            try {
                return normalizeTabIndex(uni.getStorageSync('currentTabIndex'));
            } catch (_) {
                return null;
            }
        },
        updateSelected(index) {
            const nextIndex = normalizeTabIndex(index);
            if (nextIndex === null || this.selected === nextIndex) return;
            this.selected = nextIndex;
        },
        resolveIconPath(item, index) {
            const isSelected = this.selected === index;
            if (this.appThemeMode === 'dark') {
                const iconPath = isSelected
                    ? (item.darkSelectedIconPath || item.darkIconPath || item.selectedIconPath || item.iconPath)
                    : (item.darkIconPath || item.iconPath);
                return this.withDarkIconVersion(iconPath);
            }
            return isSelected ? (item.selectedIconPath || item.iconPath) : item.iconPath;
        },
        withDarkIconVersion(iconPath) {
            if (!iconPath || iconPath.indexOf('/static/images/tab-dark/') !== 0) return iconPath;
            // #ifdef H5
            const separator = iconPath.indexOf('?') >= 0 ? '&' : '?';
            return `${iconPath}${separator}v=${DARK_TAB_ICON_VERSION}`;
            // #endif
            return iconPath;
        },
        syncSelected(options = {}) {
            const cachedIndex = this.getCachedSelected();

            try {
                const pages = getCurrentPages();
                const current = pages && pages.length ? pages[pages.length - 1] : null;
                const route = normalizeRoutePath(current && (current.route || current.__route__ || (current.$page && current.$page.fullPath) || ''));
                if (!route) {
                    if (cachedIndex !== null) this.updateSelected(cachedIndex);
                    if (!options.retry) {
                        setTimeout(() => this.syncSelected({ retry: true }), 0);
                    }
                    return;
                }
                const idx = this.list.findIndex(i => {
                    const pagePath = normalizeRoutePath(i.pagePath);
                    return route === pagePath || route.indexOf(pagePath) >= 0;
                });
                if (idx >= 0) {
                    this.updateSelected(idx);
                    return;
                }
            } catch (_) {}

            if (cachedIndex !== null) this.updateSelected(cachedIndex);
        },
        switchTab(e) {
            const data = e.currentTarget.dataset;
            const url = data.path;
            const index = normalizeTabIndex(data.index);
            const currentTime = Date.now();

            if (index === null || this._switchingTab) return;

            // 【小程序审核优化】点击"我"时检查登录状态
            if (index === 3) { // "我"的索引是3
                const app = getApp();
                const isLoggedIn = app && app.globalData && app.globalData.isLoggedIn;
                
                if (!isLoggedIn) {
                    console.log('⚠️ [TabBar] 用户未登录，提示登录');
                    requireLogin({
                        content: '查看个人主页需要登录，请先登录'
                    });
                    return;
                }
            }

            // 触觉反馈
            lightImpact();

            const isCurrentTab = this.selected === index;
            const isDoubleTap = isCurrentTab && currentTime - this.lastTapTime < this.doubleTapThreshold && this.lastTapIndex === index;

            // 导航本身不计入双击，避免页面尚未切完就触发目标页刷新。
            this.lastTapTime = isCurrentTab ? currentTime : 0;
            this.lastTapIndex = isCurrentTab ? index : -1;
            if (isDoubleTap) {
                this.refreshCurrentPage();
                return;
            }

            if (isCurrentTab) return;
            const previousIndex = this.selected;
            this._switchingTab = true;
            this.updateSelected(index);
            try { uni.setStorageSync('currentTabIndex', index); } catch (_) {}
            const targetUrl = url.startsWith('/') ? url : `/${url}`;
            const restoreSelected = () => {
                this._switchingTab = false;
                this.updateSelected(previousIndex);
                try { uni.setStorageSync('currentTabIndex', previousIndex); } catch (_) {}
            };
            try {
                if (switchTabSmooth({
                    url: targetUrl,
                    success: () => { this._switchingTab = false; },
                    fail: restoreSelected
                }) === false) restoreSelected();
            } catch (_) {
                restoreSelected();
            }
        },
        refreshCurrentPage() {
            const currentPage = this.list[this.selected];
            const pages = getCurrentPages();
            const currentPageInstance = pages[pages.length - 1];
            if (!currentPageInstance) return;
            switch (currentPage.pagePath) {
                case 'pages/index/index':
                    this.refreshIndexPage(currentPageInstance);
                    break;
                case 'pages/poem-square/poem-square':
                    this.refreshPoemPage(currentPageInstance);
                    break;
                case 'pages/mountain/mountain':
                    this.refreshMountainPage(currentPageInstance);
                    break;
                case 'pages/profile/profile':
                    this.refreshProfilePage(currentPageInstance);
                    break;
                default:
                    this.refreshGenericPage(currentPageInstance);
            }
        },
        refreshIndexPage(pageInstance) { if (pageInstance.refreshData) pageInstance.refreshData(); else if (pageInstance.onPullDownRefresh) { /* noop */ } else { uni.startPullDownRefresh(); } },
        refreshPoemPage(pageInstance) { if (pageInstance.refreshPoemData) pageInstance.refreshPoemData(); else if (pageInstance.onPullDownRefresh) { /* noop */ } else { uni.startPullDownRefresh(); } },
        refreshMountainPage(pageInstance) { if (pageInstance.refreshMountainData) pageInstance.refreshMountainData(); else if (pageInstance.onPullDownRefresh) { /* noop */ } else { uni.startPullDownRefresh(); } },
        refreshProfilePage(pageInstance) { if (pageInstance.onPullDownRefresh) { /* noop */ } else { uni.startPullDownRefresh(); } },
        refreshGenericPage(pageInstance) { if (pageInstance.onPullDownRefresh) { /* noop */ } else { uni.startPullDownRefresh(); } }
    }
};
</script>

<style>
.tab-bar {
  --tab-outer-center: 222rpx;
  --tab-inner-center: 74rpx;
  position: fixed !important;
  bottom: 0 !important;
  left: 0 !important;
  right: 0 !important;
  width: 100% !important;
  height: 120rpx !important;
  height: calc(120rpx + constant(safe-area-inset-bottom)) !important;
  height: calc(120rpx + env(safe-area-inset-bottom, var(--safe-area-inset-bottom, 0px))) !important;
  padding-bottom: constant(safe-area-inset-bottom) !important;
  padding-bottom: env(safe-area-inset-bottom, var(--safe-area-inset-bottom, 0px)) !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  z-index: 1000 !important;
  background: var(--app-fixed-bar-bg, #ffffff) !important;
  box-sizing: border-box !important;
}

.tab-bar-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  flex: 1 1 25%;
  min-width: 0;
}

/* 热区覆盖整栏，内容仍保持原先居中的图标间距。 */
.tab-bar-content {
  position: relative;
  z-index: 1;
  width: 88rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.tab-bar-item:nth-child(1) .tab-bar-content {
  transform: translateX(calc(37.5vw - var(--tab-outer-center)));
}

.tab-bar-item:nth-child(2) .tab-bar-content {
  transform: translateX(calc(12.5vw - var(--tab-inner-center)));
}

.tab-bar-item:nth-child(3) .tab-bar-content {
  transform: translateX(calc(var(--tab-inner-center) - 12.5vw));
}

.tab-bar-item:nth-child(4) .tab-bar-content {
  transform: translateX(calc(var(--tab-outer-center) - 37.5vw));
}

.icon-wrap {
  position: relative;
  width: 88rpx;
  height: 88rpx;
  border-radius: 24rpx;
  background: var(--app-tab-icon-wrap-bg, #f8f8f8);
  border: 1rpx solid var(--app-tab-icon-border-color, transparent);
  overflow: visible;
  transform: translateY(0) scale(1);
  transform-origin: center;
  transition: transform 200ms cubic-bezier(0.2, 0.8, 0.2, 1);
  box-sizing: border-box;
}

.icon-wrap.is-selected {
  border-color: var(--app-tab-icon-active-border-color, var(--app-tab-icon-border-color, transparent));
}

/* 两层外阴影只切换透明度；选中保持浮起，触摸时才压低。 */
.icon-wrap::before,
.icon-wrap::after {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: -1;
  border-radius: inherit;
  pointer-events: none;
  transition: opacity 200ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.icon-wrap::before {
  box-shadow: var(--app-tab-icon-wrap-shadow, 0 18rpx 32rpx rgba(0, 0, 0, 0.16));
  opacity: 1;
}

.icon-wrap::after {
  box-shadow: var(--app-tab-icon-active-shadow, 0 12rpx 24rpx rgba(0, 0, 0, 0.14), 0 3rpx 8rpx rgba(0, 0, 0, 0.08));
  opacity: 0;
}

.tab-bar-item--touching .icon-wrap {
  transform: translateY(4rpx) scale(0.96);
  transition-duration: 80ms;
}

.tab-bar-item--touching .icon-wrap::before {
  opacity: 0;
  transition-duration: 80ms;
}

.tab-bar-item--touching .icon-wrap::after {
  opacity: 1;
  transition-duration: 80ms;
}

.icon-inner {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: inherit;
  background: var(--app-tab-icon-inner-bg, #ffffff);
  overflow: hidden;
  transition: none;
}

.icon-img {
  width: 100%;
  height: 100%;
  display: block;
  filter: var(--app-tabbar-icon-filter, none);
  opacity: var(--app-tabbar-icon-opacity, 1);
  transition: opacity 180ms ease, transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.icon-img--active {
  filter: var(--app-tabbar-icon-active-filter, var(--app-tabbar-icon-filter, none));
  opacity: var(--app-tabbar-icon-active-opacity, var(--app-tabbar-icon-opacity, 1));
  transform: scale(1.02);
}

.tab-bar-text {
  font-size: 22rpx;
  margin-top: 4rpx;
  transition: color 150ms ease;
  color: var(--app-tab-text-color, #999999);
}

@media screen and (max-width: 320px) {
  .tab-bar {
    --tab-outer-center: 177rpx;
    --tab-inner-center: 59rpx;
  }
}

@media screen and (min-width: 321px) and (max-width: 375px) {
  .tab-bar {
    --tab-outer-center: 222rpx;
    --tab-inner-center: 74rpx;
  }
}

@media screen and (min-width: 376px) and (max-width: 414px) {
  .tab-bar {
    --tab-outer-center: 237rpx;
    --tab-inner-center: 79rpx;
  }
}

@media screen and (min-width: 415px) {
  .tab-bar {
    --tab-outer-center: 252rpx;
    --tab-inner-center: 84rpx;
  }
}

@media (prefers-reduced-motion: reduce) {
  .icon-wrap,
  .icon-wrap::before,
  .icon-wrap::after,
  .icon-img,
  .tab-bar-text {
    transition: none;
  }

  .tab-bar-item--touching .icon-wrap {
    transform: none;
  }
}
</style>
