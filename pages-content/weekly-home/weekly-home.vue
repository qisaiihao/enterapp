<template>
  <view class="weekly-page" :style="pageInlineStyle">
    <view class="weekly-header">
      <view class="weekly-back-btn" @tap="goBack">
        <image class="back-icon" src="/static/images/left_exit.png" mode="aspectFit"></image>
      </view>
      <text class="weekly-header-title">什么周刊</text>
    </view>

    <view v-if="heroSlides.length" class="weekly-hero">
      <swiper
        class="hero-swiper"
        :autoplay="heroSlides.length > 1"
        :interval="4200"
        :duration="450"
        :circular="heroSlides.length > 1"
        :current="heroIndex"
        @change="handleHeroChange"
      >
        <swiper-item v-for="item in heroSlides" :key="item.value">
          <view class="hero-slide" @tap="handleHeroTap(item)">
            <text class="hero-title">{{ item.title }}</text>
            <text v-if="item.text" class="hero-copy">{{ item.text }}</text>
          </view>
        </swiper-item>
      </swiper>

      <view v-if="heroSlides.length > 1" class="hero-dots">
        <view
          v-for="(item, index) in heroSlides"
          :key="`${item.value}-dot`"
          :class="['hero-dot', heroIndex === index ? 'active' : '']"
        ></view>
      </view>
    </view>

    <view class="weekly-content">
      <view v-if="issues.length" class="weekly-section">
        <view class="section-header">
          <text class="section-title">往期精选</text>
          <text class="section-action" @tap="goWeeklySelection">更多</text>
        </view>
        <view class="past-grid">
          <view
            v-for="issue in displayIssues"
            :key="issue.id"
            class="past-card"
            @tap="goIssueDetail(issue)"
          >
            <view class="past-cover">
              <image
                v-if="issue.coverImage"
                class="past-cover-image"
                :src="issue.coverImage"
                mode="aspectFill"
              ></image>
            </view>
          </view>
        </view>
      </view>

      <view v-if="rankingItems.length" class="weekly-section ranking-section">
        <view class="section-header">
          <text class="section-title">本周热榜</text>
          <text class="section-action" @tap="goWeeklyRanking">查看详细榜单</text>
        </view>
        <view class="rank-list">
          <view
            v-for="item in displayRanks"
            :key="item.postId || item.rank"
            class="rank-row"
            @tap="goPostDetail(item)"
          >
            <text class="rank-index">{{ item.rank }}.</text>
            <text class="rank-title">{{ item.title }}</text>
          </view>
        </view>
      </view>

      <view v-if="topics.length" class="weekly-section topic-section">
        <view class="section-header">
          <text class="section-title">主题精选</text>
          <text class="section-action" @tap="goWeeklyTopicSubmission">查看往期主题</text>
        </view>
        <view class="topic-list">
          <view
            v-for="topic in displayTopics"
            :key="topic.id"
            class="topic-row"
            @tap="goTopicDetail(topic)"
          >
            <text class="topic-title">{{ topic.title }}</text>
            <text v-if="topic.dateRange" class="topic-date">{{ topic.dateRange }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { getSystemInfoCompat } from '@/utils/system-info.js';
import { getWeeklyHome } from '@/api-cache/weekly.js';
import { navigateToPostDetail } from '@/utils/navigation.js';

function toArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  return value ? [value] : [];
}

function pickIssueCover(item = {}) {
  const imageUrls = toArray(item.imageUrls);
  const originalImageUrls = toArray(item.originalImageUrls);
  return item.coverImage ||
    item.imageUrl ||
    imageUrls[0] ||
    item.poemBgImage ||
    item.originalImageUrl ||
    originalImageUrls[0] ||
    '';
}

export default {
  data() {
    return {
      heroIndex: 0,
      pageInlineStyle: {},
      currentIssue: null,
      heroItems: [],
      issues: [],
      rankingItems: [],
      topics: []
    };
  },
  computed: {
    heroSlides() {
      const explicitSlides = this.heroItems
        .map((item, index) => ({
          value: item.value || item.id || `hero-${index + 1}`,
          title: item.title || '',
          text: item.text || item.summary || '',
          issueId: item.issueId || item.id || ''
        }))
        .filter(item => item.title || item.text);

      if (explicitSlides.length) return explicitSlides;
      if (!this.currentIssue) return [];

      return [{
        value: this.currentIssue.id || this.currentIssue._id || 'current-issue',
        title: this.currentIssue.title || '本期精选',
        text: this.currentIssue.summary || this.currentIssue.dateRange || '',
        issueId: this.currentIssue.id || this.currentIssue._id || ''
      }];
    },

    displayIssues() {
      return this.issues.slice(0, 3);
    },

    displayRanks() {
      return this.rankingItems.slice(0, 10);
    },

    displayTopics() {
      return this.topics.slice(0, 5);
    }
  },
  onLoad() {
    this.setupHeaderLayout();
  },
  onShow() {
    this.loadWeeklyHome();
  },
  methods: {
    async loadWeeklyHome() {
      const result = await getWeeklyHome({ context: this, forceRefresh: true });
      this.currentIssue = result.currentIssue || null;
      this.heroItems = Array.isArray(result.heroItems) ? result.heroItems : [];
      this.issues = this.normalizeIssues(result.issues);
      this.rankingItems = this.normalizeRanks(result.rankingItems);
      this.topics = this.normalizeTopics(result.topics);
    },

    normalizeIssues(items = []) {
      return (Array.isArray(items) ? items : [])
        .map((item, index) => ({
          id: item.id || item._id || '',
          title: item.title || `精选 ${index + 1}`,
          coverImage: pickIssueCover(item),
          imageUrl: item.imageUrl || '',
          imageUrls: toArray(item.imageUrls),
          dateRange: item.dateRange || '',
          views: Number(item.views) || 0,
          likes: Number(item.likes) || 0,
          comments: Number(item.comments) || 0
        }))
        .filter(item => item.id);
    },

    normalizeRanks(items = []) {
      return (Array.isArray(items) ? items : [])
        .map((item, index) => ({
          postId: item.postId || item._id || item.id || '',
          rank: Number(item.rank) || index + 1,
          title: item.title || '未命名作品'
        }))
        .filter(item => item.title);
    },

    normalizeTopics(items = []) {
      return (Array.isArray(items) ? items : [])
        .map((item, index) => ({
          id: item.id || item._id || '',
          title: item.title || item.summary || `主题 ${index + 1}`,
          dateRange: item.dateRange || ''
        }))
        .filter(item => item.id || item.title);
    },

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
          this.pageInlineStyle = { '--weekly-safe-area-top': `${safeAreaTop}px` };
        }
      } catch (error) {
        console.warn('[weekly-home] setup header layout failed:', error);
      }
    },

    handleHeroChange(event) {
      const current = event && event.detail ? Number(event.detail.current) : 0;
      this.heroIndex = Number.isFinite(current) ? current : 0;
    },

    handleHeroTap(item) {
      if (item && item.issueId) {
        this.goIssueDetail({ id: item.issueId });
      }
    },

    goWeeklySelection() {
      uni.navigateTo({ url: '/pages-content/weekly-selection/weekly-selection' });
    },

    goIssueDetail(issue) {
      const id = issue && issue.id ? issue.id : '';
      if (!id) return;
      uni.navigateTo({
        url: `/pages-content/weekly-selection-detail/weekly-selection-detail?id=${encodeURIComponent(id)}`
      });
    },

    goWeeklyRanking() {
      uni.navigateTo({ url: '/pages-content/weekly-ranking/weekly-ranking' });
    },

    goPostDetail(item) {
      const postId = item && item.postId ? item.postId : '';
      if (postId) navigateToPostDetail(postId);
    },

    goWeeklyTopicSubmission() {
      uni.navigateTo({ url: '/pages-content/weekly-topic-submission/weekly-topic-submission' });
    },

    goTopicDetail(topic) {
      const id = topic && topic.id ? topic.id : '';
      if (!id) return;
      uni.navigateTo({
        url: `/pages-content/weekly-topic-detail/weekly-topic-detail?id=${encodeURIComponent(id)}`
      });
    },

    goBack() {
      try {
        const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
        if (pages && pages.length > 1) {
          uni.navigateBack({ delta: 1 });
          return;
        }
      } catch (_) {}
      uni.navigateTo({ url: '/pages-content/activity-list/activity-list' });
    }
  }
};
</script>

<style scoped>
.weekly-page {
  min-height: 100vh;
  background: var(--app-page-bg, #ffffff);
  color: var(--app-primary-text, #111111);
  box-sizing: border-box;
}

.weekly-header {
  position: relative;
  height: calc(var(--weekly-safe-area-top, 0px) + 88rpx);
  padding-top: var(--weekly-safe-area-top, 0px);
  background: var(--app-surface-bg, #ffffff);
  box-sizing: border-box;
}

.weekly-back-btn {
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
}

.back-icon {
  width: 22rpx;
  height: 38rpx;
  display: block;
  filter: var(--app-icon-filter, none);
}

.weekly-header-title {
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

.weekly-hero {
  position: relative;
  height: 286rpx;
  background: #6f6f6f;
}

.hero-swiper {
  width: 100%;
  height: 100%;
}

.hero-slide {
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 0 48rpx;
  box-sizing: border-box;
}

.hero-title {
  color: #111111;
  font-size: 28rpx;
  line-height: 38rpx;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hero-copy {
  width: 82%;
  margin-top: 14rpx;
  color: #111111;
  font-size: 22rpx;
  line-height: 30rpx;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.hero-dots {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 14rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24rpx;
  pointer-events: none;
}

.hero-dot {
  width: 14rpx;
  height: 14rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.35);
}

.hero-dot.active {
  background: rgba(255, 255, 255, 0.72);
}

.weekly-content {
  padding: 46rpx 34rpx 64rpx;
  box-sizing: border-box;
}

.weekly-section + .weekly-section {
  margin-top: 58rpx;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24rpx;
}

.section-title {
  color: #111111;
  font-size: 34rpx;
  line-height: 44rpx;
  font-weight: 700;
}

.section-action {
  color: #333333;
  font-size: 22rpx;
  line-height: 30rpx;
  white-space: nowrap;
}

.past-grid {
  margin-top: 24rpx;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 46rpx;
  align-items: start;
}

.past-card {
  width: 100%;
  aspect-ratio: 0.76;
  box-sizing: border-box;
  display: flex;
  align-items: stretch;
}

.past-cover {
  width: 100%;
  height: 100%;
  background: #d9d9d9;
  overflow: hidden;
}

.past-cover-image {
  width: 100%;
  height: 100%;
  display: block;
}

.rank-list {
  margin-top: 18rpx;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-template-rows: repeat(5, minmax(34rpx, auto));
  grid-auto-flow: column;
  column-gap: 54rpx;
  row-gap: 2rpx;
}

.topic-list {
  margin-top: 18rpx;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.rank-row,
.topic-row {
  min-height: 38rpx;
  display: flex;
  align-items: center;
}

.rank-index {
  width: 40rpx;
  color: #9a9a9a;
  font-size: 28rpx;
  line-height: 36rpx;
  flex-shrink: 0;
}

.rank-title {
  min-width: 0;
  flex: 1;
  color: #9a9a9a;
  font-size: 28rpx;
  line-height: 36rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.topic-row {
  justify-content: space-between;
  gap: 24rpx;
}

.topic-title {
  min-width: 0;
  flex: 1;
  color: #9a9a9a;
  font-size: 28rpx;
  line-height: 36rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.topic-date {
  color: #9a9a9a;
  font-size: 22rpx;
  line-height: 30rpx;
  white-space: nowrap;
}
</style>
