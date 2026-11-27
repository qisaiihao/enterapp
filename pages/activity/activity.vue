<template>
  <!-- #ifdef MP-WEIXIN -->
  <page-meta :page-style="'background-color: ' + appThemeVars['--app-page-bg'] + ';'" />
  <!-- #endif -->
  <view class="activity-list-page" :class="{ 'app-tab-page-wide': hasLeftNavRail, 'activity-list-page--wide': isWideLayout }" :data-app-theme="appThemeMode" :style="appThemeVars">
    <top-bar reserve-space compact :show-left="false" :show-actions="false" />

    <view class="activity-page-inner">
      <activity-notice-carousel :notices="displayNoticeItems" :active="isPageActive" @select="openNotice" />

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
    <!-- #ifndef MP-WEIXIN -->
    <app-tab-bar ref="customTabBar" />
    <!-- #endif -->
  </view>
    <app-overlay-host />
</template>

<script>
// #ifndef MP-WEIXIN
import AppTabBar from '@/custom-tab-bar/index.vue';
// #endif
import { updateTabBarStatus } from '@/utils/tabBarCompatibility.js';
import TopBar from '@/components/top-bar/top-bar.vue';
import ActivityCategoryBar from '@/components/activity/ActivityCategoryBar.vue';
import ActivityNoticeCarousel from '@/components/activity/ActivityNoticeCarousel.vue';
import ActivityPosterCard from '@/components/activity/ActivityPosterCard.vue';
import { getActivityNotices, invalidateActivityNotices } from '@/api-cache/activity-notices.js';
import { getRecentActivities, invalidateRecentActivities } from '@/api-cache/activities.js';
import activityBadge from '@/cache/stores/activity-badge.js';
import { openActivityNoticeLink } from '@/utils/activityNoticeLink.js';

const MARKET_PAGE = '/pages-content/market/market';

export default {
  components: {
    // #ifndef MP-WEIXIN
    AppTabBar,
    // #endif
    TopBar,
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
      activeCategory: 'publish',
      isPageActive: true,
      noticeItems: [],
      openingNotice: false,
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
          kicker: '商城',
          title: '我们做了一些文创',
          summary: '看看回车键的明信片和软盘',
          linkUrl: MARKET_PAGE,
          mark: '物',
          tone: 'market'
        }
      ],
      activityCategories: [
        { value: 'weekly', label: '周刊', icon: '/static/images/activity/weekly.png' },
        { value: 'campus', label: '高校诗社', icon: '/static/images/activity/campus.png' },
        { value: 'market', label: '商城', icon: '/static/images/activity/market.png' },
        { value: 'publish', label: '待开发', icon: '/static/images/activity/coming-soon.png' }
      ]
    };
  },
  computed: {
    displayNoticeItems() {
      return this.noticeItems.length > 0 ? this.noticeItems : this.defaultNoticeItems;
    },
    viewportFillWatchKey() {
      const layout = this.appLayout || {};
      return `${layout.activityColumns || 1}:${layout.windowWidth || 0}:${layout.windowHeight || 0}`;
    }
  },
  onLoad() {
    try { activityBadge.markActivitySeen(); } catch (_) {}
    this.refresh();
  },
  onPullDownRefresh() {
    this.refresh(true);
  },
  onShow() {
    this.isPageActive = true;
    // #ifndef MP-WEIXIN
    try { uni.hideTabBar({ animation: false }); } catch (_) {}
    // #endif
    updateTabBarStatus(this, 2);
    try { activityBadge.markActivitySeen(); } catch (_) {}
    if (this._hasShownActivityNotices) this.fetchNotices(true);
    this._hasShownActivityNotices = true;
  },
  onHide() {
    this.isPageActive = false;
  },
  onUnload() {
    if (this._viewportFillTimer) {
      clearTimeout(this._viewportFillTimer);
      this._viewportFillTimer = null;
    }
  },
  onReachBottom() {
    this.loadMore();
  },
  watch: {
    viewportFillWatchKey() {
      if (!this.loading && !this.loadingMore && this.hasMore && this.activities.length > 0) {
        this.scheduleViewportFillCheck({ resetCounter: true });
      }
    }
  },
  methods: {
    async openNotice(notice) {
      if (this.openingNotice || !notice || !notice.linkUrl) return;
      this.openingNotice = true;
      try {
        await openActivityNoticeLink(notice.linkUrl);
      } finally {
        this.openingNotice = false;
      }
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

    areNoticesEqual(prevList = [], nextList = []) {
      if (!Array.isArray(prevList) || !Array.isArray(nextList) || prevList.length !== nextList.length) {
        return false;
      }
      for (let i = 0; i < prevList.length; i++) {
        const a = prevList[i] || {};
        const b = nextList[i] || {};
        if (
          a.value !== b.value ||
          a.title !== b.title ||
          a.summary !== b.summary ||
          a.kicker !== b.kicker ||
          a.mark !== b.mark ||
          a.image !== b.image ||
          a.linkUrl !== b.linkUrl ||
          a.tone !== b.tone
        ) {
          return false;
        }
      }
      return true;
    },

    async fetchNotices(forceRefresh = false) {
      try {
        const result = await getActivityNotices({
          limit: 6,
          context: this,
          forceRefresh
        });
        const notices = Array.isArray(result && result.notices) ? result.notices : [];
        if (!this.areNoticesEqual(this.noticeItems, notices)) {
          this.noticeItems = notices;
        }
      } catch (error) {
        console.warn('[activity-list] load notices failed:', error);
      }
    },

    getViewportHeight() {
      if (typeof window !== 'undefined' && Number(window.innerHeight) > 0) {
        return window.innerHeight;
      }
      if (this.appLayout && Number(this.appLayout.windowHeight) > 0) {
        return this.appLayout.windowHeight;
      }
      return 0;
    },

    scheduleViewportFillCheck({ resetCounter = false } = {}) {
      if (resetCounter) {
        this._viewportAutoFillCount = 0;
      }
      if (this._viewportFillTimer) {
        clearTimeout(this._viewportFillTimer);
        this._viewportFillTimer = null;
      }
      if (!this.hasMore || this.loading || this.loadingMore) return;
      if (!Array.isArray(this.activities) || this.activities.length === 0) return;
      if ((this._viewportAutoFillCount || 0) >= 3) return;

      this.$nextTick(() => {
        this._viewportFillTimer = setTimeout(() => {
          this._viewportFillTimer = null;
          this.checkViewportFill();
        }, 100);
      });
    },

    checkViewportFill() {
      if (!this.hasMore || this.loading || this.loadingMore) return;
      if (!Array.isArray(this.activities) || this.activities.length === 0) return;
      if ((this._viewportAutoFillCount || 0) >= 3) return;

      try {
        const winH = this.getViewportHeight();
        if (!winH) return;
        uni.createSelectorQuery().in(this).select('.activity-list').boundingClientRect((rect) => {
          if (!rect || !rect.height) return;
          if (!this.hasMore || this.loading || this.loadingMore) return;
          const rectBottom = Number.isFinite(rect.bottom) ? rect.bottom : ((rect.top || 0) + rect.height);
          if (rectBottom <= winH + 120) {
            this._viewportAutoFillCount = (this._viewportAutoFillCount || 0) + 1;
            this.loadMore();
          }
        }).exec();
      } catch (_) {}
    },

    async loadMore() {
      if (!this.hasMore || this.loading || this.loadingMore) return;
      await this.fetchActivities({ refresh: false, fromPullDown: false });
    },

    async fetchActivities({ refresh = false, fromPullDown = false } = {}) {
      const targetPage = this.page;
      const prevLength = Array.isArray(this.activities) ? this.activities.length : 0;
      if (targetPage === 0) {
        this.loading = true;
      } else {
        this.loadingMore = true;
      }

      let hadGrowth = false;
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
          hadGrowth = list.length > 0;
        } else {
          const existingIds = new Set(this.activities.map(item => item && item._id).filter(Boolean));
          const uniqueList = list.filter(item => item && item._id && !existingIds.has(item._id));
          this.activities = this.activities.concat(uniqueList);
          hadGrowth = this.activities.length > prevLength;
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
        if (this.hasMore && hadGrowth) {
          this.scheduleViewportFillCheck({ resetCounter: targetPage === 0 });
        }
      }
    },

    handleCategoryChange(value) {
      if (value === 'campus') {
        uni.navigateTo({ url: '/pages-community/home/home' });
        return;
      }
      if (value === 'weekly') {
        uni.navigateTo({
          url: '/pages-content/weekly-home/weekly-home'
        });
        return;
      }
      if (value === 'market') {
        uni.navigateTo({ url: MARKET_PAGE });
        return;
      }
      if (value === 'publish') {
        uni.showModal({
          title: '待开发',
          content: '更多功能正在陆续开发中，您有什么好建议吗？',
          cancelText: '取消',
          confirmText: '去建议',
          success: ({ confirm }) => {
            if (confirm) uni.navigateTo({ url: '/pages-tools/feedback/feedback' });
          }
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
  padding: 0 0 calc(160rpx + env(safe-area-inset-bottom, var(--safe-area-inset-bottom, 0px)));
  /* #ifdef APP-PLUS */
  padding: 0 0 calc(160rpx + var(--safe-area-inset-bottom, 0px));
  /* #endif */
  box-sizing: border-box;
  color: var(--app-primary-text, #333);
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

.activity-list-page.app-tab-page-wide {
  padding-bottom: calc(36px + var(--app-safe-area-bottom, 0px));
}

.activity-list-page--wide .activity-page-inner {
  max-width: 1120px;
  margin: 0 auto;
  padding: 12px 20px 0;
  box-sizing: border-box;
}

.activity-list-page--wide .content-area {
  padding: 0 4px;
}

.activity-list-page--wide .activity-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
}

@media screen and (min-width: 840px) {
  .activity-list-page--wide .activity-list {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 22px;
  }
}
</style>
