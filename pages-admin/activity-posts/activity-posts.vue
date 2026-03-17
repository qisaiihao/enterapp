<template>
  <view class="activity-posts-page">
    <view class="activity-head">
      <text class="activity-title">{{ activity.title || fallbackTitle || '活动帖子' }}</text>
      <text v-if="activity.summary" class="activity-summary">{{ activity.summary }}</text>
      <view class="activity-meta">
        <text>{{ formatRange(activity.startTime, activity.endTime) }}</text>
        <text>状态：{{ statusText(activity.status) }}</text>
        <text>帖子：{{ activity.postCount || postList.length }}</text>
      </view>
    </view>

    <view class="publish-bar">
      <button class="publish-btn" @tap="goPublishActivityPost">发布活动帖子</button>
    </view>

    <view v-if="isLoading && postList.length === 0" class="state-box">
      <text>加载中...</text>
    </view>

    <view v-else-if="postList.length === 0" class="state-box">
      <text>当前活动还没有帖子</text>
    </view>

    <view v-else class="post-list">
      <post-item
        v-for="(item, index) in postList"
        :key="item._id || index"
        :item="item"
        :index="index"
        :show-vote-section="true"
        list-type="admin-activity"
        @avatar-error="onAvatarError"
        @navigate-to-user="handleNavigateToUser"
        @preview-image="handlePreviewImage"
        @image-error="onImageError"
        @tag-click="handleTagClick"
        @vote="handleVote"
        @comment-click="handleCommentClick"
      />
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
import { getActivityPosts, invalidateActivityPosts } from '@/api-cache/activities.js';
const { getAdminActivityDetail } = require('@/api-cache/admin-activities.js');
const { previewImage } = require('@/utils/imagePreview.js');
const likeIcon = require('@/utils/likeIcon.js');
const { togglePostLike } = require('@/utils/likeService.js');
const {
  decodeParamSafe,
  formatRange: formatActivityRange,
  getActivityStatusLabel
} = require('@/utils/activity.js');

export default {
  components: {
    PostItem
  },
  data() {
    return {
      activityId: '',
      fallbackTitle: '',
      activity: {},
      postList: [],
      page: 0,
      pageSize: 10,
      hasMore: true,
      isLoading: false,
      isLoadingMore: false,
      votingInProgress: {},
      hasMounted: false
    };
  },
  onLoad(options) {
    options = options || {};
    this.activityId = decodeParamSafe(options.activityId);
    this.fallbackTitle = decodeParamSafe(options.title);
    if (!this.activityId) {
      uni.showToast({ title: '活动参数错误', icon: 'none' });
      uni.navigateBack();
      return;
    }
    this.loadActivityDetail();
    this.refreshPosts();
  },
  onShow() {
    if (!this.hasMounted) {
      this.hasMounted = true;
      return;
    }

    const shouldRefresh = uni.getStorageSync('shouldRefreshAdminActivityPosts');
    if (shouldRefresh) {
      uni.removeStorageSync('shouldRefreshAdminActivityPosts');
      this.loadActivityDetail();
      this.refreshPosts();
    }
  },
  onPullDownRefresh() {
    this.loadActivityDetail();
    this.refreshPosts(true);
  },
  onReachBottom() {
    this.loadMore();
  },
  methods: {
    async loadActivityDetail() {
      try {
        const result = await getAdminActivityDetail({
          activityId: this.activityId,
          context: this
        });
        if (result.activity) {
          this.activity = result.activity;
        }
      } catch (error) {
        console.warn('[activity-posts] load detail failed:', error);
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

        const incoming = (result.posts || []).map(this.normalizePost);
        if (targetPage === 0) {
          this.postList = incoming;
        } else {
          const existingIds = new Set(this.postList.map(item => item && item._id).filter(Boolean));
          const uniqueList = incoming.filter(item => item && item._id && !existingIds.has(item._id));
          this.postList = this.postList.concat(uniqueList);
        }

        this.hasMore = typeof result.hasMore === 'boolean' ? result.hasMore : incoming.length === this.pageSize;
        this.page = targetPage + 1;
      } catch (error) {
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

    normalizePost(post) {
      const votes = Number(post.votes) || 0;
      const isVoted = !!post.isVoted;
      return {
        ...post,
        votes,
        isVoted,
        likeIcon: likeIcon.getLikeIcon(votes, isVoted)
      };
    },

    goPublishActivityPost() {
      const title = (this.activity && this.activity.title) || this.fallbackTitle || '';
      const query = [
        `activityId=${encodeURIComponent(this.activityId)}`,
        `activityTitle=${encodeURIComponent(title)}`,
        'fromAdminActivity=1'
      ].join('&');

      uni.navigateTo({
        url: `/pages-publish/add/add?${query}`
      });
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
        pageTag: 'admin-activity-posts',
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
      console.warn('[activity-posts] avatar error:', error);
    },

    onImageError(error) {
      console.warn('[activity-posts] image error:', error);
    },

    formatRange(startTime, endTime) {
      return formatActivityRange(startTime, endTime);
    },

    statusText(status) {
      return getActivityStatusLabel(status, '草稿');
    }
  }
};
</script>

<style scoped>
.activity-posts-page {
  min-height: 100vh;
  background: #f5f6f8;
}

.activity-head {
  background: #fff;
  padding: 24rpx;
  border-bottom: 1rpx solid #eee;
}

.activity-title {
  display: block;
  font-size: 34rpx;
  font-weight: 600;
  color: #222;
}

.activity-summary {
  display: block;
  margin-top: 10rpx;
  font-size: 26rpx;
  color: #666;
  line-height: 1.5;
}

.activity-meta {
  margin-top: 12rpx;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
  font-size: 24rpx;
  color: #8a8a8a;
}

.publish-bar {
  padding: 16rpx 20rpx;
  background: #fff;
  border-bottom: 1rpx solid #f0f0f0;
}

.publish-btn {
  width: 100%;
  height: 72rpx;
  line-height: 72rpx;
  border: none;
  border-radius: 12rpx;
  background: #1f9d55;
  color: #fff;
  font-size: 28rpx;
}

.post-list {
  margin-top: 14rpx;
  background: #fff;
}

.state-box {
  text-align: center;
  color: #999;
  padding: 120rpx 40rpx;
}

.footer-tip {
  text-align: center;
  color: #999;
  font-size: 24rpx;
  padding: 24rpx 0;
}
</style>
