<template>
  <view class="weekly-selection-page" :style="pageInlineStyle">
    <view class="header">
      <view class="back-btn" @tap="goBack">
        <image class="back-icon" src="/static/images/left_exit.png" mode="aspectFit"></image>
      </view>
      <text class="title">半月精选</text>
    </view>

    <view class="search-row">
      <view class="search-bar">
        <text class="search-placeholder">搜索</text>
      </view>
      <image class="search-icon" src="/static/images/search.png" mode="aspectFit"></image>
    </view>

    <view v-if="shelfPortfolios.length" class="shelf-section" :style="shelfSectionStyle">
      <view class="shelf-header">
        <text class="shelf-title">往期精选</text>
        <text v-if="issues.length > 6" class="shelf-hint">左右滑动</text>
      </view>
      <view class="shelf-wrap">
        <PortfolioBook
          :portfolio-list="shelfPortfolios"
          :is-loading="false"
          empty-text=""
          variant="inline"
          :interactive="true"
          @open-portfolio="openShelfIssue"
        />
      </view>
    </view>

    <view class="issue-list">
      <view
        v-for="issue in issues"
        :key="issue.id"
        class="issue-card"
        @tap="goIssueDetail(issue)"
      >
        <view class="issue-cover"></view>
        <view class="issue-meta">
          <text class="issue-title">{{ issue.title }}</text>
          <text class="issue-date">{{ issue.dateRange }}</text>
          <text class="issue-stats">浏览 {{ issue.views }}  点赞{{ issue.likes }}  讨论{{ issue.comments }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { getSystemInfoCompat } from '@/utils/system-info.js';
import { getWeeklyIssues } from '@/api-cache/weekly.js';
import PortfolioBook from '@/components/PortfolioBook.vue';

const SHELF_BOOK_WIDTH_RPX = 62;
const SHELF_EXTRA_WIDTH_RPX = 34;
const SHELF_MAX_WIDTH_RPX = 690;

export default {
  components: { PortfolioBook },
  data() {
    return {
      pageInlineStyle: {},
      selectedIssueId: '',
      issues: []
    };
  },
  onLoad() {
    this.setupHeaderLayout();
  },
  onShow() {
    this.loadIssues();
  },
  computed: {
    shelfPortfolios() {
      return this.issues.map((issue, index) => ({
        _id: issue.id,
        name: issue.title,
        spineName: this.buildShelfSpineName(issue, index)
      }));
    },

    shelfSectionStyle() {
      const count = Math.max(this.issues.length, 1);
      const contentWidth = count * SHELF_BOOK_WIDTH_RPX + SHELF_EXTRA_WIDTH_RPX;
      const shelfWidth = Math.min(contentWidth, SHELF_MAX_WIDTH_RPX);

      return {
        '--weekly-shelf-width': `${shelfWidth}rpx`,
        '--weekly-shelf-line-width': `${contentWidth}rpx`
      };
    }
  },
  methods: {
    async loadIssues() {
      const result = await getWeeklyIssues({ context: this, limit: 30, forceRefresh: true });
      const issues = Array.isArray(result.issues) ? result.issues : [];
      this.issues = issues.map((item, index) => ({
        id: item.id || item._id || '',
        title: item.title || `半月精选 ${index + 1}`,
        shelfTitle: item.shelfTitle || '',
        dateRange: item.dateRange || '',
        views: Number(item.views) || 0,
        likes: Number(item.likes) || 0,
        comments: Number(item.comments) || 0
      })).filter(item => item.id);
      this.selectedIssueId = this.issues[0] ? this.issues[0].id : '';
    },

    buildShelfSpineName(issue, index) {
      if (issue && issue.shelfTitle) {
        return String(issue.shelfTitle).trim();
      }
      const title = issue && issue.title ? String(issue.title) : '';
      const testMatch = title.match(/滚动测试精选\s*(\d{1,2})$/);
      if (testMatch) {
        return `测试${testMatch[1].padStart(2, '0')}`;
      }
      if (title.includes('前端预览')) {
        return '预览精选';
      }
      const issueMatch = title.match(/第\s*(\d{1,2})\s*期/);
      if (issueMatch) {
        return `第${issueMatch[1]}期`;
      }
      return index === 0 ? '本期精选' : `精选${String(index + 1).padStart(2, '0')}`;
    },

    setupHeaderLayout() {
      try {
        const systemInfo = getSystemInfoCompat();
        const safeAreaTop = (systemInfo.safeAreaInsets && systemInfo.safeAreaInsets.top) || systemInfo.statusBarHeight || 0;
        if (safeAreaTop > 0) {
          this.pageInlineStyle = { '--weekly-selection-safe-area-top': `${safeAreaTop}px` };
        }
      } catch (error) {
        console.warn('[weekly-selection] setup header layout failed:', error);
      }
    },

    goBack() {
      try {
        const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
        if (pages && pages.length > 1) {
          uni.navigateBack({ delta: 1 });
          return;
        }
      } catch (_) {}
      uni.navigateTo({ url: '/pages-content/weekly-home/weekly-home' });
    },

    goIssueDetail(issue) {
      const id = issue && issue.id ? issue.id : '';
      if (!id) return;
      uni.navigateTo({
        url: `/pages-content/weekly-selection-detail/weekly-selection-detail?id=${encodeURIComponent(id)}`
      });
    },

    openShelfIssue(payload) {
      const id = payload && payload.folderId ? payload.folderId : '';
      const issue = this.issues.find(item => item.id === id);
      if (!issue) return;
      this.selectedIssueId = issue.id;
      this.goIssueDetail(issue);
    }
  }
};
</script>

<style scoped>
.weekly-selection-page {
  min-height: 100vh;
  box-sizing: border-box;
  background: #ffffff;
  color: #111111;
}

.header {
  position: relative;
  height: calc(var(--weekly-selection-safe-area-top, 0px) + 88rpx);
  padding-top: var(--weekly-selection-safe-area-top, 0px);
  box-sizing: border-box;
  background: #ffffff;
}

.back-btn {
  position: absolute;
  left: 30rpx;
  bottom: 16rpx;
  width: 56rpx;
  height: 56rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.back-icon {
  width: 22rpx;
  height: 38rpx;
  display: block;
  filter: var(--app-icon-filter, none);
}

.title {
  position: absolute;
  left: 120rpx;
  right: 120rpx;
  bottom: 24rpx;
  text-align: center;
  font-size: 30rpx;
  line-height: 40rpx;
  font-weight: 600;
  color: #111111;
}

.search-row {
  padding: 16rpx 30rpx 0;
  display: flex;
  align-items: center;
  gap: 18rpx;
  box-sizing: border-box;
}

.search-bar {
  flex: 1;
  min-width: 0;
  height: 58rpx;
  padding: 0 28rpx;
  border-radius: 999rpx;
  background: #eeeeee;
  display: flex;
  align-items: center;
  box-sizing: border-box;
}

.search-placeholder {
  color: #9a9a9a;
  font-size: 26rpx;
  line-height: 1;
}

.search-icon {
  width: 42rpx;
  height: 42rpx;
  flex: 0 0 auto;
}

.shelf-section {
  width: var(--weekly-shelf-width, 344rpx);
  max-width: calc(100vw - 60rpx);
  margin-left: auto;
  padding: 18rpx 30rpx 0 0;
  box-sizing: content-box;
}

.shelf-header {
  display: none;
}

.shelf-title {
  font-size: 22rpx;
  line-height: 28rpx;
  font-weight: 600;
  color: #111111;
}

.shelf-hint {
  font-size: 18rpx;
  line-height: 24rpx;
  color: #9a9a9a;
}

.shelf-wrap {
  width: 100%;
  height: 190rpx;
  overflow: hidden;
}

.shelf-wrap :deep(.books-container-inline) {
  width: 100%;
  max-width: 100%;
}

.shelf-wrap :deep(.books-container-inline .books-shelf) {
  min-height: 190rpx;
  padding-bottom: 10rpx;
}

.shelf-wrap :deep(.books-container-inline .shelf-line) {
  width: var(--weekly-shelf-line-width, 344rpx) !important;
  height: 9rpx;
}

.shelf-wrap :deep(.books-container-inline .book-spine) {
  width: 62rpx;
  height: 178rpx !important;
  min-height: 0;
  padding: 10rpx 0;
}

.shelf-wrap :deep(.books-container-inline .spine-text) {
  font-size: 19rpx;
  line-height: 1.22;
  letter-spacing: 0;
}

.issue-list {
  padding: 24rpx 24rpx 60rpx 28rpx;
  box-sizing: border-box;
}

.issue-card {
  min-height: 168rpx;
  display: flex;
  align-items: flex-start;
  gap: 38rpx;
  padding: 24rpx 24rpx 26rpx 0;
  margin-bottom: 28rpx;
  background: #ffffff;
  box-shadow: 6rpx 6rpx 6rpx rgba(0, 0, 0, 0.2);
  border-right: 1rpx solid rgba(0, 0, 0, 0.08);
  border-bottom: 1rpx solid rgba(0, 0, 0, 0.08);
}

.issue-cover {
  width: 136rpx;
  height: 172rpx;
  margin-left: 0;
  flex: 0 0 auto;
  background: #d9d9d9;
}

.issue-meta {
  flex: 1;
  min-width: 0;
  padding-top: 4rpx;
  display: flex;
  flex-direction: column;
}

.issue-title {
  font-size: 30rpx;
  line-height: 40rpx;
  font-weight: 600;
  color: #111111;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.issue-date {
  margin-top: 24rpx;
  font-size: 26rpx;
  line-height: 34rpx;
  color: #8a8a8a;
}

.issue-stats {
  margin-top: 26rpx;
  font-size: 24rpx;
  line-height: 32rpx;
  color: #8a8a8a;
}
</style>
