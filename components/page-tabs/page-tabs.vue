<template>
  <view class="page-tabs-wrapper">
    <!-- 复用 top-bar 组件，传入不同的左侧图标 -->
    <top-bar ref="topBar" left-icon="/static/images/newicons/write_poem.png" @safe-area-ready="onSafeAreaReady" />

    <!-- 页面切换标签栏 - 定位在 top-bar 下方 -->
    <view class="tabs-container" :style="{ top: (safeAreaTop + 60) + 'px' }">
      <view class="tabs-list">
        <view
          v-for="(tab, index) in tabs"
          :key="index"
          :class="['tab-item', { active: currentTab === tab.value }]"
          @tap="switchTab(tab.value)"
        >
          <text class="tab-text">{{ tab.label }}</text>
        </view>
        <!-- 滑动指示器，通过 transform 实现平移动画 -->
        <view class="tab-indicator" :style="indicatorStyle"></view>
      </view>
    </view>
  </view>
</template>

<script>
import topBar from '@/components/top-bar/top-bar.vue';

export default {
  name: 'PageTabs',
  components: {
    topBar
  },
  props: {
    currentTab: {
      type: String,
      default: 'square'
    }
  },
  data() {
    return {
      safeAreaTop: 0,
      tabs: [
        { label: '广场', value: 'square' },
        { label: '关注', value: 'following' },
        { label: '讨论', value: 'discussion' }
      ]
    };
  },
  computed: {
    // 计算指示器的位置
    indicatorStyle() {
      const index = this.tabs.findIndex(tab => tab.value === this.currentTab);
      // 每个 tab 占 1/3 宽度，指示器在 tab 中心
      const translateX = (index * 100 / 3) + (100 / 6); // 移动到对应 tab 的中心
      return `left: calc(${translateX}% - 30rpx);`; // 30rpx 是指示器宽度的一半
    }
  },
  methods: {
    // 切换标签页
    switchTab(tabValue) {
      if (tabValue !== this.currentTab) {
        this.$emit('tab-change', tabValue);
      }
    },

    // 接收 top-bar 传递的安全区域高度
    onSafeAreaReady(height) {
      this.safeAreaTop = height;
    }
  }
};
</script>

<style>
/* 包裹容器 */
.page-tabs-wrapper {
  /* 无需特殊样式，top-bar 和 tabs-container 各自 fixed */
}

/* 标签栏样式 - 固定在 top-bar 下方 */
.tabs-container {
  position: fixed;
  left: 0;
  right: 0;
  height: 88rpx;
  background: #ffffff;
  z-index: 999; /* 比 top-bar 低一层 */
}

.tabs-list {
  display: flex;
  height: 100%;
  align-items: center;
}

.tab-item {
  flex: 1;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  position: relative;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.tab-item:active {
  background-color: rgba(0, 0, 0, 0.03);
  transform: scale(0.97);
}

.tab-text {
  font-size: 30rpx;
  color: #333;
  font-weight: 500;
  transition: color 0.2s ease, transform 0.2s ease;
}

.tab-item.active .tab-text {
  color: #000;
  font-weight: 600;
  transform: scale(1.02);
}

.tab-indicator {
  position: absolute;
  bottom: 8rpx;
  width: 60rpx;
  height: 6rpx;
  background: #333;
  border-radius: 3rpx;
  z-index: 10;
  /* 使用更丝滑的缓动函数 */
  transition: left 0.28s cubic-bezier(0.4, 0, 0.2, 1);
}
</style>
