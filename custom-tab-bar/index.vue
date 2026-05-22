<template>
    <view class="tab-bar">
        <view class="tab-bar-item" v-for="(item, index) in list" :key="index" :data-index="index" :data-path="item.pagePath" @tap="switchTab">
            <view :class="['icon-wrap', selected === index ? 'pressed' : '']">
                <view :class="['icon-inner', selected === index ? 'active' : '']">
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
</template>

<script>
import { lightImpact } from '@/utils/haptics.js';

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
                    selectedIconPath: '/static/images/marketplus.png',
                    darkIconPath: '/static/images/tab-dark/market-dark.png',
                    darkSelectedIconPath: '/static/images/tab-dark/marketplus-dark.png'
                },
                {
                    pagePath: 'pages/poem-square/poem-square',
                    text: '原创',
                    iconPath: '/static/images/road.png',
                    selectedIconPath: '/static/images/roadplus.png',
                    darkIconPath: '/static/images/tab-dark/road-dark.png',
                    darkSelectedIconPath: '/static/images/tab-dark/roadplus-dark.png'
                },
                {
                    pagePath: 'pages/mountain/mountain',
                    text: '读诗',
                    iconPath: '/static/images/mountain.png',
                    selectedIconPath: '/static/images/mountainplus.png',
                    darkIconPath: '/static/images/tab-dark/mountain-dark.png',
                    darkSelectedIconPath: '/static/images/tab-dark/mountainplus-dark.png'
                },
                {
                    pagePath: 'pages/profile/profile',
                    text: '我',
                    iconPath: '/static/images/pools.png',
                    selectedIconPath: '/static/images/poolsplus.png',
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

            if (index === null) return;

            // 【小程序审核优化】点击"我"时检查登录状态
            if (index === 3) { // "我"的索引是3
                const app = getApp();
                const isLoggedIn = app && app.globalData && app.globalData.isLoggedIn;
                
                if (!isLoggedIn) {
                    console.log('⚠️ [TabBar] 用户未登录，提示登录');
                    uni.showModal({
                        title: '需要登录',
                        content: '查看个人主页需要登录，请先登录',
                        confirmText: '去登录',
                        cancelText: '取消',
                        success: (res) => {
                            if (res.confirm) {
                                // 使用 navigateTo 跳转到登录页
                                uni.navigateTo({
                                    url: '/pages/login/login'
                                });
                            }
                        }
                    });
                    return;
                }
            }

            // 触觉反馈
            lightImpact();

            const isDoubleTap = currentTime - this.lastTapTime < this.doubleTapThreshold && this.lastTapIndex === index && this.selected === index;

            this.setData({ lastTapTime: currentTime, lastTapIndex: index });
            if (isDoubleTap) {
                this.refreshCurrentPage();
                return;
            }

            this.updateSelected(index);
            try { uni.setStorageSync('currentTabIndex', index); } catch (_) {}
            const targetUrl = url.startsWith('/') ? url : `/${url}`;
            uni.switchTab({ url: targetUrl });
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
  position: fixed !important;
  bottom: 0 !important;
  left: 0 !important;
  right: 0 !important;
  width: 100% !important;
  height: 120rpx !important;
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
  flex: 1;
  max-width: 88rpx;
}

.icon-wrap {
  width: 88rpx;
  height: 88rpx;
  border-radius: 24rpx;
  background: var(--app-tab-icon-wrap-bg, #f8f8f8);
  border: 1rpx solid var(--app-tab-icon-border-color, transparent);
  overflow: hidden;
  box-shadow: var(--app-tab-icon-wrap-shadow, 0 18rpx 32rpx rgba(0, 0, 0, 0.16));
  transition: border-color 0.22s ease, box-shadow 0.22s ease;
  box-sizing: border-box;
}

.icon-wrap.pressed {
  border-color: var(--app-tab-icon-active-border-color, var(--app-tab-icon-border-color, transparent));
  box-shadow: var(--app-tab-icon-active-shadow, 0 12rpx 24rpx rgba(0, 0, 0, 0.14), 0 3rpx 8rpx rgba(0, 0, 0, 0.08));
}

.icon-inner {
  position: relative;
  width: 100%;
  height: 100%;
  background: var(--app-tab-icon-inner-bg, #ffffff);
  box-shadow: none;
  overflow: hidden;
  transition: transform 0.22s ease, box-shadow 0.22s ease;
}

.icon-inner.active {
  box-shadow: inset 0 10rpx 20rpx rgba(0, 0, 0, 0.22);
  transform: translateY(3rpx) scale(0.97);
}

.icon-img {
  width: 100%;
  height: 100%;
  display: block;
  filter: var(--app-tabbar-icon-filter, none);
  opacity: var(--app-tabbar-icon-opacity, 1);
  transition: filter 0.22s ease, opacity 0.22s ease, transform 0.22s ease;
}

.icon-img--active {
  filter: var(--app-tabbar-icon-active-filter, var(--app-tabbar-icon-filter, none));
  opacity: var(--app-tabbar-icon-active-opacity, var(--app-tabbar-icon-opacity, 1));
  transform: scale(1.02);
}

.tab-bar-text {
  font-size: 22rpx;
  margin-top: 4rpx;
  transition: all 0.3s ease;
  color: var(--app-tab-text-color, #999999);
}

/* 响应式间距调整 */
/* 所有屏幕尺寸：保持按钮间距，但标签栏填满整个宽度 */
@media screen and (max-width: 320px) {
  .tab-bar-item {
    margin: 0 15rpx;
  }
}

@media screen and (min-width: 321px) and (max-width: 375px) {
  .tab-bar-item {
    margin: 0 30rpx;
  }
}

@media screen and (min-width: 376px) and (max-width: 414px) {
  .tab-bar-item {
    margin: 0 35rpx;
  }
}

@media screen and (min-width: 415px) {
  .tab-bar-item {
    margin: 0 40rpx;
  }
}
</style>
