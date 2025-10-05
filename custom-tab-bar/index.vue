<template>
    <view class="tab-bar">
        <view class="tab-bar-item" :data-index="index" :data-path="item.pagePath" @tap="switchTab" v-for="(item, index) in list" :key="index">
            <image class="tab-bar-icon" :src="selected === index ? item.selectedIconPath : item.iconPath"></image>

            <text class="tab-bar-text" :style="'color: ' + (selected === index ? selectedColor : color)">{{ item.text }}</text>
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
            // 双击检测相关数据
            lastTapTime: 0,
            lastTapIndex: -1,
            doubleTapThreshold: 300,
            // 双击间隔阈值（毫秒）
            list: [
                {
                    pagePath: 'pages/index/index',
                    text: '广场',
                    iconPath: '/static/images/market.png',
                    selectedIconPath: '/static/images/marketplus.png'
                },
                {
                    pagePath: 'pages/poem/poem',
                    text: '路',
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
                    text: '湖',
                    iconPath: '/static/images/pools.png',
                    selectedIconPath: '/static/images/poolsplus.png'
                }
            ]
        };
    },
    methods: {
        switchTab(e) {
            const data = e.currentTarget.dataset;
            const url = data.path;
            const index = data.index;
            const currentTime = Date.now();
            console.log('=== tabBar点击事件 ===');
            console.log('点击的tab索引:', index);
            console.log('目标页面路径:', url);
            console.log('当前tabBar selected状态:', this.selected);

            // 检查是否为双击
            const isDoubleTap = currentTime - this.lastTapTime < this.doubleTapThreshold && this.lastTapIndex === index && this.selected === index; // 只有点击当前选中的tab才算双击
            console.log('双击检测:', {
                isDoubleTap,
                currentTime,
                lastTapTime: this.lastTapTime,
                timeDiff: currentTime - this.lastTapTime,
                lastTapIndex: this.lastTapIndex,
                currentIndex: index,
                isCurrentTab: this.selected === index
            });

            // 更新点击记录
            this.setData({
                lastTapTime: currentTime,
                lastTapIndex: index
            });
            if (isDoubleTap) {
                // 双击当前tab，触发刷新
                console.log('检测到双击，触发页面刷新');
                this.refreshCurrentPage();
                return;
            }

            // 单次点击，正常切换页面
            const targetUrl = url.startsWith('/') ? url : `/${url}`;
            uni.switchTab({
                url: targetUrl,
                success: () => {
                    console.log('tabBar切换成功:', targetUrl);
                },
                fail: (err) => {
                    console.error('tabBar切换失败:', err);
                }
            });
        },
        // 刷新当前页面
        refreshCurrentPage() {
            const currentPage = this.list[this.selected];
            console.log('刷新页面:', currentPage.pagePath);

            // 获取当前页面实例
            const pages = getCurrentPages();
            const currentPageInstance = pages[pages.length - 1];
            if (!currentPageInstance) {
                console.error('无法获取当前页面实例');
                return;
            }

            // 根据页面路径执行相应的刷新逻辑
            switch (currentPage.pagePath) {
                case 'pages/index/index':
                    this.refreshIndexPage(currentPageInstance);
                    break;
                case 'pages/poem/poem':
                    this.refreshPoemPage(currentPageInstance);
                    break;
                case 'pages/mountain/mountain':
                    this.refreshMountainPage(currentPageInstance);
                    break;
                case 'pages/profile/profile':
                    this.refreshProfilePage(currentPageInstance);
                    break;
                default:
                    console.log('未知页面，执行通用刷新');
                    this.refreshGenericPage(currentPageInstance);
            }
        },
        // 刷新广场页面
        refreshIndexPage(pageInstance) {
            console.log('刷新广场页面');
            if (pageInstance.refreshData) {
                pageInstance.refreshData();
            } else if (pageInstance.onPullDownRefresh) {
                null;
            } else {
                // 通用刷新方法
                uni.startPullDownRefresh();
            }
        },
        // 刷新路页面
        refreshPoemPage(pageInstance) {
            console.log('刷新路页面');
            if (pageInstance.refreshPoemData) {
                pageInstance.refreshPoemData();
            } else if (pageInstance.onPullDownRefresh) {
                null;
            } else {
                uni.startPullDownRefresh();
            }
        },
        // 刷新山页面
        refreshMountainPage(pageInstance) {
            console.log('刷新山页面');
            if (pageInstance.refreshMountainData) {
                pageInstance.refreshMountainData();
            } else if (pageInstance.onPullDownRefresh) {
                null;
            } else {
                uni.startPullDownRefresh();
            }
        },
        // 刷新湖页面
        refreshProfilePage(pageInstance) {
            console.log('刷新湖页面');
            if (pageInstance.onPullDownRefresh) {
                null;
            } else {
                uni.startPullDownRefresh();
            }
        },
        // 通用刷新方法
        refreshGenericPage(pageInstance) {
            console.log('执行通用刷新');
            if (pageInstance.onPullDownRefresh) {
                null;
            } else {
                uni.startPullDownRefresh();
            }
        }
    },
    created: function () {}
};
</script>
<style>
.tab-bar {
    position: fixed;
    bottom: 20rpx;
    left: 50%;
    transform: translateX(-50%);
    width: 90%;
    height: 100rpx;
    background: rgba(255, 255, 255, 0.5);
    backdrop-filter: blur(20rpx);
    -webkit-backdrop-filter: blur(20rpx);
    border-radius: 50rpx;
    display: flex;
    align-items: center;
    justify-content: space-around;
    box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.1);
    border: 1rpx solid rgba(255, 255, 255, 0.3);
    z-index: 1000;
}

.tab-bar-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    height: 100%;
    transition: all 0.3s ease;
}

.tab-bar-item:active {
    transform: scale(0.95);
}

.tab-bar-icon {
    width: 48rpx;
    height: 48rpx;
    margin-bottom: 8rpx;
    transition: all 0.3s ease;
}

.tab-bar-text {
    font-size: 24rpx;
    font-weight: 500;
    transition: all 0.3s ease;
}
</style>
