<template>
    <view class="tab-bar">
        <view class="tab-bar-item" v-for="(item, index) in list" :key="index" :data-index="index" :data-path="item.pagePath" @tap="switchTab">
            <view :class="['icon-wrap', selected === index ? 'pressed' : '']">
                <view :class="['icon-inner', selected === index ? 'active' : '']">
                    <image class="icon-img" :src="selected === index ? (item.selectedIconPath || item.iconPath) : item.iconPath" mode="aspectFill" />
                </view>
            </view>
            <text class="tab-bar-text">{{ item.text }}</text>
        </view>
    </view>
</template>

<script>
export default {
    data() {
        return {
            selected: 0,
            color: '#999999',
            selectedColor: '#9ed7ee',
            lastTapTime: 0,
            lastTapIndex: -1,
            doubleTapThreshold: 300,
            list: [
                {
                    pagePath: 'pages/index/index',
                    text: '广场',
                    iconPath: '/static/images/market.png',
                    selectedIconPath: '/static/images/marketplus.png'
                },
                {
                    pagePath: 'pages/poem-square/poem-square',
                    text: '·',
                    iconPath: '/static/images/road.png',
                    selectedIconPath: '/static/images/roadplus.png'
                },
                {
                    pagePath: 'pages/mountain/mountain',
                    text: '山',
                    iconPath: '/static/images/mountain.png',
                    selectedIconPath: '/static/images/mountainplus.png'
                },
                {
                    pagePath: 'pages/profile/profile',
                    text: '池',
                    iconPath: '/static/images/pools.png',
                    selectedIconPath: '/static/images/poolsplus.png'
                }
            ]
        };
    },
    created() {
        this.syncSelected();
    },
    methods: {
        syncSelected() {
            try {
                const pages = getCurrentPages();
                const current = pages && pages.length ? pages[pages.length - 1] : null;
                const route = current && (current.route || (current.$page && current.$page.fullPath) || '');
                if (!route) return;
                const idx = this.list.findIndex(i => route.indexOf(i.pagePath.replace(/^\//,'')) >= 0);
                if (idx >= 0) this.setData({ selected: idx });
            } catch (_) {}
        },
        switchTab(e) {
            const data = e.currentTarget.dataset;
            const url = data.path;
            const index = data.index;
            const currentTime = Date.now();

            const isDoubleTap = currentTime - this.lastTapTime < this.doubleTapThreshold && this.lastTapIndex === index && this.selected === index;

            this.setData({ lastTapTime: currentTime, lastTapIndex: index });
            if (isDoubleTap) {
                this.refreshCurrentPage();
                return;
            }

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
  position: fixed;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 120rpx;
  display: flex;
  align-items: center;
  justify-content: space-around;
  z-index: 1000;
  background: #ffffff;
}

.tab-bar-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  height: 100%;
}

.icon-wrap {
  width: 88rpx;
  height: 88rpx;
  border-radius: 24rpx;
  background: #f8f8f8;
  overflow: hidden;
  box-shadow: 0 18rpx 32rpx rgba(0, 0, 0, 0.16);
  transition: box-shadow 0.22s ease;
}

.icon-wrap.pressed {
  box-shadow: 0 6rpx 12rpx rgba(0, 0, 0, 0.08);
}

.icon-inner {
  width: 100%;
  height: 100%;
  background: #ffffff;
  box-shadow: none;
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
}

.tab-bar-text {
  font-size: 22rpx;
  color: transparent;
  height: 0;
  overflow: hidden;
}
</style>

