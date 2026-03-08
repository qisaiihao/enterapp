<template>
  <view class="activity-detail-page">
    <view class="activity-header">
      <image
        v-if="activityCover"
        class="header-cover"
        :src="activityCover"
        mode="aspectFill"
      />
      <view v-else class="header-cover placeholder">
        <text class="placeholder-text">活动详情</text>
      </view>
      <view class="header-mask"></view>
      <view class="header-content">
        <text class="header-title">{{ activityTitle || '活动详情' }}</text>
        <text v-if="activitySummary" class="header-summary">{{ activitySummary }}</text>
        <view class="header-meta">
          <text class="meta-item">{{ formatRange(activityStartTime, activityEndTime) }}</text>
          <text class="meta-item">{{ postCount }} 帖</text>
          <text :class="['status-tag', isOngoing ? 'ongoing' : 'ended']">
            {{ isOngoing ? '进行中' : '已结束' }}
          </text>
        </view>
      </view>
    </view>

    <view v-if="activityRules" class="rules-card">
      <view class="rules-head">
        <text class="rules-title">活动细则</text>
        <text
          v-if="showRulesToggle"
          class="rules-toggle"
          @tap="toggleRulesExpanded"
        >
          {{ rulesExpanded ? '收起' : '展开' }}
        </text>
      </view>
      <text :class="['rules-text', (!rulesExpanded && showRulesToggle) ? 'collapsed' : '']">{{ activityRules }}</text>
    </view>

    <view v-if="isLoading && postList.length === 0" class="state-box">
      <text class="state-text">加载帖子中...</text>
    </view>

    <view v-else-if="postList.length === 0" class="state-box">
      <text class="state-title">活动里还没有帖子</text>
      <text class="state-subtitle">参与活动后的帖子会显示在这里</text>
    </view>

    <view v-else class="post-list">
      <view v-for="(item, index) in postList" :key="item._id || index">
        <activity-poem-card
          v-if="isPoemCard(item)"
          :item="item"
          :index="index"
          @vote="handleVote"
          @comment-click="handleCommentClick"
        />
        <post-item
          v-else
          :item="item"
          :index="index"
          :show-vote-section="true"
          list-type="activity"
          @avatar-error="onAvatarError"
          @navigate-to-user="handleNavigateToUser"
          @preview-image="handlePreviewImage"
          @image-error="onImageError"
          @tag-click="handleTagClick"
          @vote="handleVote"
          @comment-click="handleCommentClick"
        />
      </view>
    </view>

    <view v-if="isLoadingMore" class="footer-tip">
      <text>加载中...</text>
    </view>
    <view v-if="!hasMore && postList.length > 0" class="footer-tip">
      <text>没有更多帖子了</text>
    </view>
  </view>
</template>

<script>
import PostItem from '@/components/PostItem.vue';
import ActivityPoemCard from '@/components/activity/ActivityPoemCard.vue';
import { getActivityPosts, getActivityDetail, invalidateActivityPosts } from '@/api-cache/activities.js';
import fileUrlCache from '@/_utils/file-url-cache';
const { previewImage } = require('@/utils/imagePreview.js');
const likeIcon = require('@/utils/likeIcon.js');
const { togglePostLike } = require('@/utils/likeService.js');
const {
  decodeParamSafe,
  formatRange: formatActivityRange,
  isActivityOngoing
} = require('@/utils/activity.js');

export default {
  components: {
    PostItem,
    ActivityPoemCard
  },
  data() {
    return {
      activityId: '',
      activityTitle: '',
      activitySummary: '',
      activityRules: '',
      activityCover: '',
      activityStartTime: '',
      activityEndTime: '',
      postCount: 0,
      isOngoing: false,
      rulesExpanded: false,
      showRulesToggle: false,
      postList: [],
      page: 0,
      pageSize: 10,
      hasMore: true,
      isLoading: false,
      isLoadingMore: false,
      votingInProgress: {},
      poemBackgroundColors: ['#a4c4bd', '#c9cfcf', '#906161', '#909388']
    };
  },
  onLoad(options) {
    options = options || {};
    this.activityId = decodeParamSafe(options.activityId);
    if (!this.activityId) {
      uni.showToast({ title: '活动参数错误', icon: 'none' });
      uni.navigateBack();
      return;
    }

    this.activityTitle = decodeParamSafe(options.title);
    this.activitySummary = decodeParamSafe(options.summary);
    this.activityCover = decodeParamSafe(options.coverImage);
    this.activityStartTime = decodeParamSafe(options.startTime);
    this.activityEndTime = decodeParamSafe(options.endTime);
    this.postCount = Number(decodeParamSafe(options.postCount)) || 0;
    this.isOngoing = isActivityOngoing(this.activityStartTime, this.activityEndTime);

    this.hydrateActivityCover();
    this.loadActivityDetail({ forceRefresh: true });
    this.refreshPosts();
  },
  onShow() {
    const shouldRefreshList = !!uni.getStorageSync('shouldRefreshActivityList');
    const refreshActivityId = uni.getStorageSync('shouldRefreshActivityDetailId');
    if (shouldRefreshList || (refreshActivityId && refreshActivityId === this.activityId)) {
      uni.removeStorageSync('shouldRefreshActivityList');
      uni.removeStorageSync('shouldRefreshActivityDetailId');
      this.loadActivityDetail({ forceRefresh: true });
      this.refreshPosts();
    }
  },
  onPullDownRefresh() {
    this.loadActivityDetail({ forceRefresh: true });
    this.refreshPosts(true);
  },
  onReachBottom() {
    this.loadMore();
  },
  methods: {
    async hydrateActivityCover() {
      const cover = String(this.activityCover || '').trim();
      if (!cover || !cover.startsWith('cloud://')) return;
      try {
        const tempUrl = await fileUrlCache.getTempUrl(cover);
        if (tempUrl) {
          this.activityCover = tempUrl;
        }
      } catch (error) {
        console.warn('[activity-detail] cover hydrate failed:', error);
      }
    },

    shouldShowRulesToggle(text) {
      const normalized = String(text || '').trim();
      if (!normalized) return false;
      const lineCount = normalized.split('\n').length;
      return lineCount > 4 || normalized.length > 80;
    },

    toggleRulesExpanded() {
      if (!this.showRulesToggle) return;
      this.rulesExpanded = !this.rulesExpanded;
    },

    async loadActivityDetail({ forceRefresh = false } = {}) {
      if (!this.activityId) return;
      try {
        const result = await getActivityDetail({
          activityId: this.activityId,
          context: this,
          forceRefresh
        });
        const activity = result && result.activity ? result.activity : null;
        if (!activity) return;

        this.activityTitle = activity.title || this.activityTitle;
        this.activitySummary = activity.summary || '';
        this.activityRules = typeof activity.rules === 'string' ? activity.rules : '';
        this.rulesExpanded = false;
        this.showRulesToggle = this.shouldShowRulesToggle(this.activityRules);
        this.activityCover = activity.coverImage || this.activityCover;
        this.activityStartTime = activity.startTime || this.activityStartTime;
        this.activityEndTime = activity.endTime || this.activityEndTime;
        this.isOngoing = isActivityOngoing(this.activityStartTime, this.activityEndTime);

        const nextPostCount = Number(activity.postCount) || 0;
        this.postCount = Math.max(this.postCount, nextPostCount);

        this.hydrateActivityCover();
      } catch (error) {
        console.warn('[activity-detail] load activity detail failed:', error);
      }
    },

    async refreshPosts(fromPullDown = false) {
      invalidateActivityPosts({ activityId: this.activityId });
      this.page = 0;
      this.hasMore = true;
      this.postList = [];
      await this.fetchPosts({ refresh: true, fromPullDown });
    },

    async loadMore() {
      if (!this.hasMore || this.isLoading || this.isLoadingMore) return;
      await this.fetchPosts({ refresh: false, fromPullDown: false });
    },

    async fetchPosts({ refresh = false, fromPullDown = false } = {}) {
      const targetPage = this.page;
      if (targetPage === 0) {
        this.isLoading = true;
      } else {
        this.isLoadingMore = true;
      }

      try {
        const result = await getActivityPosts({
          activityId: this.activityId,
          page: targetPage,
          pageSize: this.pageSize,
          context: this,
          forceRefresh: refresh && targetPage === 0
        });

        const incoming = (result.posts || []).map((post, idx) => {
          const absoluteIndex = targetPage * this.pageSize + idx;
          return this.normalizePost(post, absoluteIndex);
        });
        if (targetPage === 0) {
          this.postList = incoming;
        } else {
          const existingIds = new Set(this.postList.map(item => item && item._id).filter(Boolean));
          const uniquePosts = incoming.filter(item => item && item._id && !existingIds.has(item._id));
          this.postList = this.postList.concat(uniquePosts);
        }

        this.hasMore = typeof result.hasMore === 'boolean' ? result.hasMore : incoming.length === this.pageSize;
        this.page = targetPage + 1;
        this.postCount = Math.max(this.postCount, this.postList.length);
      } catch (error) {
        console.error('[activity-detail] 加载帖子失败:', error);
        uni.showToast({
          title: '加载帖子失败',
          icon: 'none'
        });
      } finally {
        this.isLoading = false;
        this.isLoadingMore = false;
        if (fromPullDown) {
          uni.stopPullDownRefresh();
        }
      }
    },

    normalizePost(post, absoluteIndex = 0) {
      const votes = Number(post.votes) || 0;
      const isVoted = !!post.isVoted;
      const highlightLines = Array.isArray(post.highlightLines)
        ? post.highlightLines.filter(line => (line || '').trim())
        : [];
      const defaultBg = this.poemBackgroundColors[absoluteIndex % this.poemBackgroundColors.length];
      return {
        ...post,
        votes,
        isVoted,
        highlightLines,
        backgroundColor: post.backgroundColor || defaultBg,
        textColor: post.textColor || '#222',
        likeIcon: likeIcon.getLikeIcon(votes, isVoted)
      };
    },

    isPoemCard(item) {
      if (!item) return false;
      if (item.isDiscussion) return false;
      return item.isPoem === true || item.publishMode === 'poem' || item.isSeries === true;
    },

    handlePreviewImage(data) {
      previewImage({ src: data.src, urls: data.urls });
    },

    handleTagClick(data) {
      if (!data || !data.tag) return;
      uni.navigateTo({
        url: `/pages-tools/tag-filter/tag-filter?tag=${encodeURIComponent(data.tag)}`
      });
    },

    handleCommentClick(data) {
      if (!data || !data.postId) return;
      uni.navigateTo({
        url: `/pages/post-detail/post-detail?id=${data.postId}`
      });
    },

    handleNavigateToUser(data) {
      if (!data || !data.userId || data.isAnonymous) return;
      const app = getApp();
      const currentOpenid = app && app.globalData ? app.globalData.openid : '';
      if (data.userId === currentOpenid) {
        uni.switchTab({ url: '/pages/profile/profile' });
        return;
      }
      uni.navigateTo({
        url: `/pages-user/user-profile/user-profile?userId=${data.userId}`
      });
    },

    handleVote(data) {
      const postId = data && data.postId;
      if (!postId) return;
      if (this.votingInProgress[postId]) return;
      this.$set(this.votingInProgress, postId, true);

      const index = this.postList.findIndex(item => item && item._id === postId);
      if (index < 0) {
        this.$set(this.votingInProgress, postId, false);
        return;
      }

      const current = this.postList[index];
      const originalVotes = Number(current.votes) || 0;
      const originalIsVoted = !!current.isVoted;
      const optimisticVotes = originalIsVoted ? Math.max(0, originalVotes - 1) : originalVotes + 1;

      const next = this.postList.slice();
      next[index] = {
        ...current,
        votes: optimisticVotes,
        isVoted: !originalIsVoted,
        likeIcon: likeIcon.getLikeIcon(optimisticVotes, !originalIsVoted)
      };
      this.postList = next;

      togglePostLike(postId, {
        pageTag: 'activity-detail',
        context: this,
        currentVotes: originalVotes,
        currentIsLiked: originalIsVoted,
        requireAuth: true
      }).then((result) => {
        if (!result || !result.success) {
          throw new Error('点赞失败');
        }

        const currentIndex = this.postList.findIndex(item => item && item._id === postId);
        if (currentIndex < 0) return;
        const updated = this.postList.slice();
        updated[currentIndex] = {
          ...updated[currentIndex],
          votes: result.votes,
          isVoted: result.isLiked,
          likeIcon: result.likeIcon
        };
        this.postList = updated;
      }).catch(() => {
        const rollbackIndex = this.postList.findIndex(item => item && item._id === postId);
        if (rollbackIndex >= 0) {
          const rollback = this.postList.slice();
          rollback[rollbackIndex] = {
            ...rollback[rollbackIndex],
            votes: originalVotes,
            isVoted: originalIsVoted,
            likeIcon: likeIcon.getLikeIcon(originalVotes, originalIsVoted)
          };
          this.postList = rollback;
        }
      }).finally(() => {
        this.$set(this.votingInProgress, postId, false);
      });
    },

    onAvatarError(error) {
      console.warn('[activity-detail] avatar error:', error);
    },

    onImageError(error) {
      console.warn('[activity-detail] image error:', error);
    },

    formatRange(startTime, endTime) {
      return formatActivityRange(startTime, endTime);
    }
  }
};
</script>

<style scoped>
.activity-detail-page {
  min-height: 100vh;
  background: #f5f6f8;
}

.activity-header {
  position: relative;
  height: 360rpx;
  overflow: hidden;
}

.header-cover {
  width: 100%;
  height: 100%;
  background: #e8ebef;
}

.header-cover.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
}

.placeholder-text {
  color: #a6adbb;
  font-size: 34rpx;
}

.header-mask {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.2) 0%, rgba(0, 0, 0, 0.55) 100%);
}

.header-content {
  position: absolute;
  left: 24rpx;
  right: 24rpx;
  bottom: 24rpx;
  color: #fff;
}

.header-title {
  display: block;
  font-size: 38rpx;
  font-weight: 600;
}

.header-summary {
  display: block;
  margin-top: 10rpx;
  font-size: 24rpx;
  opacity: 0.95;
  line-height: 1.5;
}

.header-meta {
  margin-top: 14rpx;
  display: flex;
  align-items: center;
  gap: 14rpx;
  flex-wrap: wrap;
}

.meta-item {
  font-size: 22rpx;
  opacity: 0.95;
}

.status-tag {
  font-size: 20rpx;
  padding: 6rpx 12rpx;
  border-radius: 999rpx;
}

.status-tag.ongoing {
  background: rgba(31, 157, 85, 0.22);
  color: #d6ffe7;
}

.status-tag.ended {
  background: rgba(255, 255, 255, 0.24);
  color: #e6e7ea;
}

.rules-card {
  margin: 20rpx 24rpx 0;
  padding: 22rpx 24rpx;
  background: #fff;
  border-radius: 16rpx;
}

.rules-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
}

.rules-title {
  font-size: 30rpx;
  color: #1f2937;
  font-weight: 600;
}

.rules-toggle {
  font-size: 24rpx;
  color: #1f9d55;
  padding: 4rpx 0 4rpx 12rpx;
}

.rules-text {
  display: block;
  margin-top: 14rpx;
  font-size: 26rpx;
  line-height: 1.75;
  color: #2f3a4a;
  white-space: pre-wrap;
  word-break: break-word;
}

.rules-text.collapsed {
  max-height: 280rpx;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 4;
  overflow: hidden;
}

.state-box {
  text-align: center;
  padding: 120rpx 40rpx;
  color: #999;
}

.state-title {
  display: block;
  font-size: 32rpx;
  color: #333;
  margin-bottom: 10rpx;
}

.state-subtitle,
.state-text {
  font-size: 26rpx;
}

.post-list {
  margin-top: 16rpx;
  background: #fff;
}

.footer-tip {
  text-align: center;
  color: #999;
  font-size: 24rpx;
  padding: 26rpx 0;
}
</style>
