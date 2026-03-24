<template>
  <view class="activity-list-page">
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
          <text class="placeholder-text">活动</text>
        </view>

        <view class="activity-content">
          <view class="title-row">
            <text class="activity-title">{{ item.title }}</text>
            <text :class="['status-tag', isOngoing(item) ? 'ongoing' : 'ended']">
              {{ isOngoing(item) ? '进行中' : '已结束' }}
            </text>
          </view>

          <text v-if="item.summary" class="activity-summary">{{ item.summary }}</text>

          <view class="meta-row">
            <text class="meta-text">{{ formatRange(item.startTime, item.endTime) }}</text>
            <text class="meta-text">{{ getDisplayPostCount(item) }} 帖</text>
          </view>
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
</template>

<script>
import { getRecentActivities, invalidateRecentActivities } from '@/api-cache/activities.js';
import activityBadge from '@/cache/stores/activity-badge.js';
const {
  isActivityOngoing,
  formatRange: formatActivityRange
} = require('@/utils/activity.js');

export default {
  data() {
    return {
      activities: [],
      page: 0,
      pageSize: 10,
      hasMore: true,
      loading: false,
      loadingMore: false
    };
  },
  onLoad() {
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
        `postCount=${encodeURIComponent(String(this.getDisplayPostCount(item)))}`
      ].join('&');

      uni.navigateTo({
        url: `/pages-content/activity-detail/activity-detail?${query}`
      });
    },

    isOngoing(item) {
      if (typeof item.isOngoing === 'boolean') return item.isOngoing;
      return isActivityOngoing(item && item.startTime, item && item.endTime);
    },

    formatRange(startTime, endTime) {
      return formatActivityRange(startTime, endTime);
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
  background: #f5f6f8;
  padding: 24rpx;
  box-sizing: border-box;
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
  gap: 20rpx;
}

.activity-card {
  background: #fff;
  border-radius: 20rpx;
  overflow: hidden;
  box-shadow: 0 8rpx 24rpx rgba(0, 0, 0, 0.05);
}

.activity-cover {
  width: 100%;
  height: 260rpx;
  background: #eceff3;
}

.activity-cover.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
}

.placeholder-text {
  font-size: 36rpx;
  color: #9aa3ad;
}

.activity-content {
  padding: 24rpx;
}

.title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.activity-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #222;
  flex: 1;
}

.status-tag {
  font-size: 22rpx;
  padding: 6rpx 14rpx;
  border-radius: 999rpx;
}

.status-tag.ongoing {
  background: #e8f8ef;
  color: #1f9d55;
}

.status-tag.ended {
  background: #f2f4f7;
  color: #667085;
}

.activity-summary {
  display: block;
  margin-top: 14rpx;
  font-size: 26rpx;
  color: #666;
  line-height: 1.5;
}

.meta-row {
  margin-top: 16rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.meta-text {
  font-size: 24rpx;
  color: #8a8a8a;
}

.footer-tip {
  text-align: center;
  color: #999;
  font-size: 24rpx;
  padding: 28rpx 0 20rpx;
}
</style>
