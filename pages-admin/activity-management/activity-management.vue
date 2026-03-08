<template>
  <view class="activity-admin-page">
    <view class="top-actions">
      <button class="action-btn create-btn" @tap="openCreate">新建活动</button>
      <button class="action-btn refresh-btn" @tap="refreshList">刷新</button>
    </view>

    <view v-if="loading && activities.length === 0" class="state-box">
      <text>加载中...</text>
    </view>

    <view v-else-if="activities.length === 0" class="state-box">
      <text>还没有活动，先创建一个吧</text>
    </view>

    <view v-else class="activity-list">
      <view v-for="item in activities" :key="item._id" class="activity-card">
        <view class="card-title-row">
          <text class="card-title">{{ item.title }}</text>
          <text :class="['status-tag', item.status || 'draft']">{{ statusText(item.status) }}</text>
        </view>

        <text v-if="item.summary" class="card-summary">{{ item.summary }}</text>

        <view class="card-meta">
          <text>时间：{{ formatRange(item.startTime, item.endTime) }}</text>
          <text>帖子：{{ item.postCount || 0 }}</text>
          <text>权重：{{ item.sortWeight || 0 }}</text>
        </view>

        <view class="card-actions">
          <button class="mini-btn posts-btn" @tap="openPosts(item)">活动帖子</button>
          <button class="mini-btn edit-btn" @tap="openEdit(item)">编辑</button>
          <button class="mini-btn status-btn" @tap="changeStatus(item)">状态</button>
          <button class="mini-btn danger" @tap="removeActivity(item)">删除</button>
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
import { invalidateRecentActivities, invalidateActivityPosts } from '@/api-cache/activities.js';
const {
  listAdminActivities,
  setAdminActivityStatus,
  deleteAdminActivity
} = require('@/api-cache/admin-activities.js');
const {
  ACTIVITY_STATUS_OPTIONS,
  getActivityStatusLabel,
  formatRange: formatActivityRange
} = require('@/utils/activity.js');

export default {
  data() {
    return {
      activities: [],
      page: 0,
      pageSize: 20,
      hasMore: true,
      loading: false,
      loadingMore: false,
      hasMounted: false
    };
  },
  onLoad() {
    this.refreshList();
  },
  onShow() {
    if (!this.hasMounted) {
      this.hasMounted = true;
      return;
    }

    const shouldRefresh = uni.getStorageSync('shouldRefreshAdminActivities');
    if (shouldRefresh) {
      uni.removeStorageSync('shouldRefreshAdminActivities');
      this.refreshList();
    }
  },
  onPullDownRefresh() {
    this.refreshList(true);
  },
  onReachBottom() {
    this.loadMore();
  },
  methods: {
    async refreshList(fromPullDown = false) {
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
        const result = await listAdminActivities({
          skip: targetPage * this.pageSize,
          limit: this.pageSize,
          includeDeleted: false,
          context: this
        });

        const incoming = Array.isArray(result.activities) ? result.activities : [];
        if (targetPage === 0) {
          this.activities = incoming;
        } else {
          const existingIds = new Set(this.activities.map(item => item && item._id).filter(Boolean));
          const unique = incoming.filter(item => item && item._id && !existingIds.has(item._id));
          this.activities = this.activities.concat(unique);
        }

        this.hasMore = typeof result.hasMore === 'boolean' ? result.hasMore : incoming.length === this.pageSize;
        this.page = targetPage + 1;
      } catch (error) {
        console.error('[activity-management] load failed:', error);
        uni.showToast({
          title: error.message || '加载失败',
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

    openCreate() {
      uni.navigateTo({
        url: '/pages-admin/activity-editor/activity-editor'
      });
    },

    openEdit(item) {
      if (!item || !item._id) return;
      uni.navigateTo({
        url: `/pages-admin/activity-editor/activity-editor?activityId=${encodeURIComponent(item._id)}`
      });
    },

    openPosts(item) {
      if (!item || !item._id) return;
      const query = [
        `activityId=${encodeURIComponent(item._id)}`,
        `title=${encodeURIComponent(item.title || '')}`
      ].join('&');
      uni.navigateTo({
        url: `/pages-admin/activity-posts/activity-posts?${query}`
      });
    },

    changeStatus(item) {
      if (!item || !item._id) return;
      uni.showActionSheet({
        itemList: ACTIVITY_STATUS_OPTIONS.map(option => option.label),
        success: async ({ tapIndex }) => {
          const selected = ACTIVITY_STATUS_OPTIONS[tapIndex];
          if (!selected) return;

          try {
            await setAdminActivityStatus({
              activityId: item._id,
              status: selected.value,
              context: this
            });

            invalidateRecentActivities();
            const index = this.activities.findIndex(row => row && row._id === item._id);
            if (index >= 0) {
              const next = this.activities.slice();
              next[index] = {
                ...next[index],
                status: selected.value
              };
              this.activities = next;
            }

            uni.showToast({
              title: '状态已更新',
              icon: 'success'
            });
          } catch (error) {
            uni.showToast({
              title: error.message || '更新失败',
              icon: 'none'
            });
          }
        }
      });
    },

    removeActivity(item) {
      if (!item || !item._id) return;
      uni.showModal({
        title: '删除活动',
        content: '确认删除该活动吗？删除后活动将不再对外展示。',
        confirmColor: '#f56c6c',
        success: async ({ confirm }) => {
          if (!confirm) return;
          try {
            await deleteAdminActivity({
              activityId: item._id,
              context: this
            });

            invalidateRecentActivities();
            invalidateActivityPosts({ activityId: item._id });
            this.activities = this.activities.filter(row => row && row._id !== item._id);
            uni.showToast({
              title: '已删除',
              icon: 'success'
            });
          } catch (error) {
            uni.showToast({
              title: error.message || '删除失败',
              icon: 'none'
            });
          }
        }
      });
    },

    statusText(status) {
      return getActivityStatusLabel(status);
    },

    formatRange(startTime, endTime) {
      return formatActivityRange(startTime, endTime);
    }
  }
};
</script>

<style scoped>
.activity-admin-page {
  min-height: 100vh;
  background: #f5f5f5;
  padding: 20rpx;
  box-sizing: border-box;
}

.top-actions {
  display: flex;
  gap: 16rpx;
  margin-bottom: 20rpx;
}

.action-btn {
  flex: 1;
  height: 72rpx;
  line-height: 72rpx;
  border-radius: 12rpx;
  font-size: 28rpx;
  border: none;
}

.create-btn {
  background: #1f9d55;
  color: #fff;
}

.refresh-btn {
  background: #409eff;
  color: #fff;
}

.state-box {
  text-align: center;
  color: #999;
  padding: 120rpx 40rpx;
}

.activity-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.activity-card {
  background: #fff;
  border-radius: 12rpx;
  padding: 20rpx;
  box-shadow: 0 4rpx 14rpx rgba(0, 0, 0, 0.05);
}

.card-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
}

.card-title {
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

.status-tag.draft {
  background: #f2f4f7;
  color: #667085;
}

.status-tag.published {
  background: #e8f8ef;
  color: #1f9d55;
}

.status-tag.archived {
  background: #fef3f2;
  color: #d92d20;
}

.card-summary {
  display: block;
  margin-top: 10rpx;
  font-size: 26rpx;
  color: #666;
  line-height: 1.5;
}

.card-meta {
  margin-top: 14rpx;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
  font-size: 24rpx;
  color: #8a8a8a;
}

.card-actions {
  margin-top: 18rpx;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10rpx;
}

.mini-btn {
  width: 100%;
  min-width: 0;
  margin: 0;
  height: 64rpx;
  line-height: 64rpx;
  border-radius: 999rpx;
  font-size: 24rpx;
  font-weight: 500;
  background: #f2f4f7;
  color: #344054;
  border: 1rpx solid #e4e7ec;
  padding: 0;
}

.mini-btn::after {
  border: none;
}

.mini-btn.posts-btn {
  background: #ecfdf3;
  color: #027a48;
  border-color: #abefc6;
}

.mini-btn.edit-btn {
  background: #eff8ff;
  color: #175cd3;
  border-color: #b2ddff;
}

.mini-btn.status-btn {
  background: #fffaeb;
  color: #b54708;
  border-color: #fedf89;
}

.mini-btn.danger {
  background: #fef3f2;
  color: #d92d20;
  border-color: #fecdca;
}

.footer-tip {
  text-align: center;
  color: #999;
  font-size: 24rpx;
  padding: 24rpx 0;
}
</style>
