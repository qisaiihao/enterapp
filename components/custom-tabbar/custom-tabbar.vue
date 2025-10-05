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
            console.log('=== tabBar点击事件 ===');
            console.log('点击的tab索引:', index);
            console.log('目标页面路径:', url);
            console.log('当前tabBar selected状态:', this.selected);

            // 跳转到对应页面，状态更新完全交给页面的onShow处理
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
    background: rgba(255, 255, 255, 0.8);
    backdrop-filter: blur(20rpx);
    -webkit-backdrop-filter: blur(20rpx);
    border-radius: 50rpx;
    display: flex;
    align-items: center;
    justify-content: space-around;
    box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.1);
    border: 1rpx solid rgba(255, 255, 255, 0.2);
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
