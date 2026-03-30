<template>
  <view class="activity-list-page">
    <view class="header-bar" :style="{ paddingTop: safeAreaTop + 'px' }">
      <view class="header-inner">
        <view class="back-btn" @tap="goBack"></view>
        <text class="header-title">全部活动</text>
      </view>
    </view>

    <view class="page-content" :style="{ paddingTop: (safeAreaTop + 64) + 'px' }">
      <view class="announce-card">
        <swiper
          class="announce-swiper"
          :current="noticeIndex"
          autoplay
          circular
          :interval="4200"
          :duration="320"
          @change="onNoticeChange"
        >
          <swiper-item v-for="(item, index) in notices" :key="index">
            <view class="announce-text-wrap">
              <text class="announce-text">{{ item }}</text>
            </view>
          </swiper-item>
        </swiper>
        <view class="notice-dots">
          <view
            v-for="(item, index) in notices"
            :key="'dot-' + index"
            :class="['dot', noticeIndex === index ? 'active' : '']"
          ></view>
        </view>
      </view>

      <view class="shortcut-row">
        <view v-for="item in shortcuts" :key="item.text" class="shortcut-item">
          <text class="shortcut-text">{{ item.text }}</text>
        </view>
      </view>

      <view v-if="loading && activities.length === 0" class="state-box">
        <text class="state-text">加载中...</text>
      </view>

      <view v-else-if="activities.length === 0" class="state-box">
        <text class="state-title">暂无近期活动</text>
        <text class="state-subtitle">这里会展示进行中和近30天结束的活动</text>
      </view>

      <view v-else class="activity-list">
        <view
          v-for="item in activities"
          :key="item._id"
          class="activity-card"
          @tap="openActivity(item)"
        >
          <image
            v-if="item.coverImage"
            class="activity-cover"
            :src="item.coverImage"
            mode="aspectFill"
          />
          <view v-else class="activity-cover placeholder">
            <text class="placeholder-text">海报</text>
          </view>

          <text :class="['status-tag', isOngoing(item) ? 'ongoing' : 'ended']">
            {{ isOngoing(item) ? '进行中' : '已结束' }}
          </text>

          <view class="card-foot">
            <text class="activity-title">{{ item.title || '活动标题。' }}</text>
          </view>
        </view>
      </view>

      <view v-if="loadingMore" class="footer-tip">
        <text>加载中...</text>
      </view>
      <view v-if="!hasMore && activities.length > 0" class="footer-tip">
        <text>没有更多活动了</text>
      </view>
    </view>
  </view>
</template>

<script>
import { getRecentActivities, invalidateRecentActivities } from '@/api-cache/activities.js';
import activityBadge from '@/cache/stores/activity-badge.js';
const {
  isActivityOngoing
} = require('@/utils/activity.js');

export default {
  data() {
    return {
      activities: [],
      page: 0,
      pageSize: 10,
      hasMore: true,
      loading: false,
      loadingMore: false,
      safeAreaTop: 0,
      notices: [
        '起一个公告栏的作用，合作联系、周刊上新和后续商品上新通知。',
        '翻页公告栏，非入口，下面四个模块可按主题持续扩展。',
        '活动会持续更新，欢迎投稿参与，支持原创与组诗编辑。'
      ],
      noticeIndex: 0,
      shortcuts: [
        { text: '周刊' },
        { text: '高校诗社' },
        { text: '商城' },
        { text: '出版？暂时没想到' }
      ]
    };
  },
  onLoad() {
    this.initSafeArea();
    try { activityBadge.markActivitySeen(); } catch (_) {}
    this.refresh();
  },
  onPullDownRefresh() {
    this.refresh(true);
  },
  onReachBottom() {
    this.loadMore();
  },
  methods: {
    initSafeArea() {
      try {
        const info = uni.getSystemInfoSync();
        this.safeAreaTop = Number(info.statusBarHeight) || 0;
      } catch (error) {
        console.warn('[activity-list] init safe area failed:', error);
        this.safeAreaTop = 0;
      }
    },

    goBack() {
      uni.navigateBack({
        fail: () => {
          uni.switchTab({ url: '/pages/poem-square/poem-square' });
        }
      });
    },

    onNoticeChange(event) {
      const current = event && event.detail ? Number(event.detail.current) : 0;
      this.noticeIndex = Number.isFinite(current) ? current : 0;
    },

    async refresh(fromPullDown = false) {
      invalidateRecentActivities();
      this.page = 0;
      this.hasMore = true;
      this.activities = [];
      await this.fetchActivities({ refresh: true, fromPullDown });
    },

    async loadMore() {
      if (!this.hasMore || this.loading || this.loadingMore) return;
      await this.fetchActivities({ refresh: false, fromPullDown: false });
    },

    async fetchActivities({ refresh = false, fromPullDown = false } = {}) {
      const targetPage = this.page;
      if (targetPage === 0) {
        this.loading = true;
      } else {
        this.loadingMore = true;
      }

      try {
        const result = await getRecentActivities({
          page: targetPage,
          pageSize: this.pageSize,
          context: this,
          forceRefresh: refresh && targetPage === 0
        });

        const list = Array.isArray(result.activities) ? result.activities : [];
        if (targetPage === 0) {
          this.activities = list;
        } else {
          const existingIds = new Set(this.activities.map(item => item && item._id).filter(Boolean));
          const uniqueList = list.filter(item => item && item._id && !existingIds.has(item._id));
          this.activities = this.activities.concat(uniqueList);
        }

        this.hasMore = typeof result.hasMore === 'boolean' ? result.hasMore : list.length === this.pageSize;
        this.page = targetPage + 1;
      } catch (error) {
        console.error('[activity-list] 加载失败:', error);
        uni.showToast({
          title: '加载活动失败',
          icon: 'none'
        });
      } finally {
        this.loading = false;
        this.loadingMore = false;
        if (fromPullDown) {
          uni.stopPullDownRefresh();
        }
      }
    },

    openActivity(item) {
      const query = [
        `activityId=${encodeURIComponent(item._id || '')}`,
        `title=${encodeURIComponent(item.title || '')}`,
        `summary=${encodeURIComponent(item.summary || '')}`,
        `coverImage=${encodeURIComponent(item.coverImage || '')}`,
        `startTime=${encodeURIComponent(item.startTime || '')}`,
        `endTime=${encodeURIComponent(item.endTime || '')}`,
        `postCount=${encodeURIComponent(String(this.getDisplayPostCount(item)))}`,
        `allowUserSubmission=${encodeURIComponent(String(item.allowUserSubmission !== false))}`
      ].join('&');

      uni.navigateTo({
        url: `/pages-content/activity-detail/activity-detail?${query}`
      });
    },

    isOngoing(item) {
      if (typeof item.isOngoing === 'boolean') return item.isOngoing;
      return isActivityOngoing(item && item.startTime, item && item.endTime);
    },

    getDisplayPostCount(item) {
      if (item && item.allowUserSubmission === false) {
        const visiblePostCount = Number(item.visiblePostCount);
        if (Number.isFinite(visiblePostCount) && visiblePostCount >= 0) {
          return visiblePostCount;
        }
      }
      return Number(item && item.postCount) || 0;
    }
  }
};
</script>

<style scoped>
.activity-list-page {
  min-height: 100vh;
  background: #f6f6f6;
}

.header-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 20;
  background: #fff;
}

.header-inner {
  height: 96rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.back-btn {
  position: absolute;
  left: 26rpx;
  top: 50%;
  width: 22rpx;
  height: 22rpx;
  border-left: 4rpx solid #111;
  border-bottom: 4rpx solid #111;
  transform: translateY(-50%) rotate(45deg);
}

.header-title {
  font-size: 34rpx;
  font-weight: 600;
  color: #111;
}

.page-content {
  padding: 24rpx 24rpx 36rpx;
  box-sizing: border-box;
}

.announce-card {
  background: #7d6669;
  border-radius: 12rpx;
  overflow: hidden;
  margin-bottom: 20rpx;
}

.announce-swiper {
  height: 214rpx;
}

.announce-text-wrap {
  height: 100%;
  display: flex;
  align-items: center;
  padding: 28rpx;
  box-sizing: border-box;
}

.announce-text {
  color: #fff;
  font-size: 22rpx;
  line-height: 1.6;
}

.notice-dots {
  display: flex;
  justify-content: center;
  gap: 12rpx;
  padding: 0 0 12rpx;
}

.dot {
  width: 10rpx;
  height: 10rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.3);
}

.dot.active {
  background: rgba(255, 255, 255, 0.86);
}

.shortcut-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14rpx;
  margin-bottom: 18rpx;
}

.shortcut-item {
  min-height: 78rpx;
  border-radius: 10rpx;
  background: #bebbbb;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 8rpx;
  box-sizing: border-box;
}

.shortcut-text {
  font-size: 20rpx;
  line-height: 1.2;
  color: #222;
}

.state-box {
  padding: 140rpx 40rpx;
  text-align: center;
  color: #999;
}

.state-title {
  display: block;
  font-size: 32rpx;
  color: #333;
  margin-bottom: 16rpx;
}

.state-subtitle,
.state-text {
  font-size: 26rpx;
}

.activity-list {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}

.activity-card {
  position: relative;
  border-radius: 10rpx;
  overflow: hidden;
  background: #d9d9d9;
}

.activity-cover {
  width: 100%;
  height: 290rpx;
  background: #d9d9d9;
}

.activity-cover.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
}

.placeholder-text {
  font-size: 72rpx;
  color: #3b3b3b;
}

.activity-title {
  font-size: 22rpx;
  color: #111;
  line-height: 1.4;
}

.status-tag {
  position: absolute;
  top: 14rpx;
  right: 14rpx;
  font-size: 16rpx;
  line-height: 1;
  padding: 8rpx 12rpx;
  border-radius: 999rpx;
  color: #fff;
}

.status-tag.ongoing {
  background: rgba(91, 167, 98, 0.82);
}

.status-tag.ended {
  background: rgba(167, 91, 101, 0.82);
}

.card-foot {
  min-height: 52rpx;
  background: rgba(6, 6, 6, 0.15);
  padding: 0 24rpx;
  display: flex;
  align-items: center;
}

.footer-tip {
  text-align: center;
  color: #999;
  font-size: 24rpx;
  padding: 28rpx 0 20rpx;
}
</style>
