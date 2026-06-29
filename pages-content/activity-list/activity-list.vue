<template>
  <view class="activity-list-page" :style="pageInlineStyle">
    <view class="custom-activity-header">
      <view class="activity-back-btn" @tap="goBack">
        <image class="back-icon" src="/static/images/left_exit.png" mode="aspectFit"></image>
      </view>
      <text class="activity-header-title">全部活动</text>
    </view>

    <activity-notice-carousel :notices="displayNoticeItems" />

    <activity-category-bar
      :categories="activityCategories"
      :active-value="activeCategory"
      @change="handleCategoryChange"
    />

    <view class="content-area">
      <view v-if="loading && activities.length === 0" class="state-box">
        <text class="state-text">加载中...</text>
      </view>

      <view v-else-if="activities.length === 0" class="state-box">
        <text class="state-title">暂无近期活动</text>
        <text class="state-subtitle">这里会展示进行中和近期结束的活动</text>
      </view>

      <view v-else class="activity-list">
        <activity-poster-card
          v-for="item in activities"
          :key="item._id"
          :item="item"
          @select="openActivity"
        />
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
import ActivityCategoryBar from '@/components/activity/ActivityCategoryBar.vue';
import ActivityNoticeCarousel from '@/components/activity/ActivityNoticeCarousel.vue';
import ActivityPosterCard from '@/components/activity/ActivityPosterCard.vue';
import { getActivityNotices, invalidateActivityNotices } from '@/api-cache/activity-notices.js';
import { getRecentActivities, invalidateRecentActivities } from '@/api-cache/activities.js';
import activityBadge from '@/cache/stores/activity-badge.js';
import { getSystemInfoCompat } from '@/utils/system-info.js';

export default {
  components: {
    ActivityCategoryBar,
    ActivityNoticeCarousel,
    ActivityPosterCard
  },
  data() {
    return {
      activities: [],
      page: 0,
      pageSize: 10,
      hasMore: true,
      loading: false,
      loadingMore: false,
      pageInlineStyle: {},
      activeCategory: 'publish',
      noticeItems: [],
      defaultNoticeItems: [
        {
          value: 'cooperation',
          kicker: '合作联系',
          title: '活动与出版合作',
          summary: '诗社联名、征稿共创、刊物推荐开放联系',
          mark: '合',
          tone: 'cooperation'
        },
        {
          value: 'weekly',
          kicker: '周刊上新',
          title: '本周诗歌周刊',
          summary: '新一期精选内容整理中，敬请期待',
          mark: '刊',
          tone: 'weekly'
        },
        {
          value: 'market',
          kicker: '商城上新',
          title: '出版与周边预告',
          summary: '刊物、诗集与周边商品后续将在这里通知',
          mark: '新',
          tone: 'market'
        }
      ],
      activityCategories: [
        { value: 'weekly', label: '周刊' },
        { value: 'campus', label: '高校诗社' },
        { value: 'market', label: '商城' },
        { value: 'publish', label: '出版？暂没想到' }
      ]
    };
  },
  computed: {
    displayNoticeItems() {
      return this.noticeItems.length > 0 ? this.noticeItems : this.defaultNoticeItems;
    }
  },
  onLoad() {
    this.setupHeaderLayout();
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
    setupHeaderLayout() {
      try {
        const systemInfo = getSystemInfoCompat();
        let safeAreaTop = 0;

        if (systemInfo.safeAreaInsets && systemInfo.safeAreaInsets.top > 0) {
          safeAreaTop = systemInfo.safeAreaInsets.top;
        } else if (systemInfo.statusBarHeight) {
          safeAreaTop = systemInfo.statusBarHeight;
        }

        if (safeAreaTop > 0) {
          this.pageInlineStyle = {
            '--activity-safe-area-top': `${safeAreaTop}px`
          };
        }
      } catch (error) {
        console.warn('[activity-list] setup header layout failed:', error);
      }
    },

    goBack() {
      try {
        const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
        if (pages && pages.length > 1) {
          uni.navigateBack({
            delta: 1,
            fail: () => {
              uni.switchTab({ url: '/pages/poem-square/poem-square' });
            }
          });
          return;
        }
      } catch (_) {}

      uni.switchTab({ url: '/pages/poem-square/poem-square' });
    },

    async refresh(fromPullDown = false) {
      invalidateRecentActivities();
      invalidateActivityNotices();
      this.page = 0;
      this.hasMore = true;
      this.activities = [];
      this.fetchNotices(true);
      await this.fetchActivities({ refresh: true, fromPullDown });
    },

    async fetchNotices(forceRefresh = false) {
      try {
        const result = await getActivityNotices({
          limit: 6,
          context: this,
          forceRefresh
        });
        const notices = Array.isArray(result && result.notices) ? result.notices : [];
        if (notices.length > 0) {
          this.noticeItems = notices;
        }
      } catch (error) {
        console.warn('[activity-list] load notices failed:', error);
      }
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

    handleCategoryChange(value) {
      if (value === 'weekly') {
        uni.navigateTo({
          url: '/pages-content/weekly-home/weekly-home'
        });
        return;
      }
      this.activeCategory = value;
    },

    openActivity(item) {
      if (!item) return;
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
  background: var(--app-page-bg, #ffffff);
  padding: 0 0 24rpx;
  box-sizing: border-box;
  color: var(--app-primary-text, #333);
}

.custom-activity-header {
  position: relative;
  height: calc(var(--activity-safe-area-top, 0px) + 88rpx);
  padding-top: var(--activity-safe-area-top, 0px);
  background: var(--app-surface-bg, #ffffff);
  box-sizing: border-box;
}

.activity-back-btn {
  position: absolute;
  left: 30rpx;
  bottom: 16rpx;
  width: 56rpx;
  height: 56rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  z-index: 2;
  transition: transform 0.2s ease;
}

.activity-back-btn:active {
  transform: scale(0.95);
}

.back-icon {
  width: 22rpx;
  height: 38rpx;
  display: block;
  filter: var(--app-icon-filter, none);
}

.activity-header-title {
  position: absolute;
  left: 120rpx;
  right: 120rpx;
  bottom: 24rpx;
  font-size: 30rpx;
  line-height: 40rpx;
  font-weight: 600;
  color: var(--app-primary-text, #000000);
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.content-area {
  margin-top: 38rpx;
  padding: 0 24rpx;
  box-sizing: border-box;
}

.state-box {
  padding: 120rpx 40rpx;
  text-align: center;
  color: var(--app-muted-text, #999);
}

.state-title {
  display: block;
  font-size: 32rpx;
  color: var(--app-primary-text, #333);
  margin-bottom: 16rpx;
}

.state-subtitle,
.state-text {
  font-size: 26rpx;
}

.activity-list {
  display: flex;
  flex-direction: column;
  gap: 48rpx;
}

.footer-tip {
  text-align: center;
  color: var(--app-muted-text, #999);
  font-size: 24rpx;
  padding: 28rpx 0 20rpx;
}
</style>
