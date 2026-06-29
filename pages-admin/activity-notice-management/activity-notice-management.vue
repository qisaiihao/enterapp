<template>
  <view class="notice-admin-page">
    <view class="top-actions">
      <button class="action-btn create-btn" @tap="openCreate">新建公告</button>
      <button class="action-btn refresh-btn" @tap="refreshList">刷新</button>
    </view>

    <view v-if="editing" class="form-card">
      <view class="form-header">
        <text class="form-title">{{ form.noticeId ? '编辑公告' : '新建公告' }}</text>
        <button class="close-btn" @tap="closeForm">取消</button>
      </view>

      <view class="form-item">
        <text class="label">小标题</text>
        <input class="input" maxlength="12" v-model="form.kicker" placeholder="如：合作联系" />
      </view>

      <view class="form-item">
        <text class="label">主标题 *</text>
        <input class="input" maxlength="32" v-model="form.title" placeholder="公告主标题" />
      </view>

      <view class="form-item">
        <text class="label">摘要</text>
        <textarea class="textarea" maxlength="80" v-model="form.summary" placeholder="公告摘要，最多 80 字" />
      </view>

      <view class="form-row">
        <view class="form-item half">
          <text class="label">右侧标记</text>
          <input class="input" maxlength="2" v-model="form.mark" placeholder="合" />
        </view>

        <view class="form-item half">
          <text class="label">权重</text>
          <input class="input" type="number" :value="String(form.sortWeight)" @input="onSortWeightInput" />
        </view>
      </view>

      <view class="form-row">
        <view class="form-item half">
          <text class="label">色调</text>
          <picker mode="selector" :range="toneLabels" :value="toneIndex" @change="onToneChange">
            <view class="picker-value">{{ toneLabels[toneIndex] }}</view>
          </picker>
        </view>

        <view class="form-item half">
          <text class="label">状态</text>
          <picker mode="selector" :range="statusLabels" :value="statusIndex" @change="onStatusChange">
            <view class="picker-value">{{ statusLabels[statusIndex] }}</view>
          </picker>
        </view>
      </view>

      <button class="submit-btn" :disabled="submitting" @tap="submitForm">
        {{ submitting ? '保存中...' : '保存公告' }}
      </button>
    </view>

    <view v-if="loading && notices.length === 0" class="state-box">
      <text>加载中...</text>
    </view>

    <view v-else-if="notices.length === 0" class="state-box">
      <text>还没有公告，先创建一个吧</text>
    </view>

    <view v-else class="notice-list">
      <view v-for="item in notices" :key="item._id" class="notice-card">
        <view class="card-title-row">
          <text class="card-title">{{ item.title }}</text>
          <text :class="['status-tag', item.status || 'draft']">{{ statusText(item.status) }}</text>
        </view>
        <text v-if="item.summary" class="card-summary">{{ item.summary }}</text>
        <view class="card-meta">
          <text>小标题：{{ item.kicker || '公告' }}</text>
          <text>标记：{{ item.mark || '-' }} / 色调：{{ toneText(item.tone) }}</text>
          <text>权重：{{ item.sortWeight || 0 }}</text>
        </view>
        <view class="card-actions">
          <button class="mini-btn edit-btn" @tap="openEdit(item)">编辑</button>
          <button class="mini-btn status-btn" @tap="changeStatus(item)">状态</button>
          <button class="mini-btn danger" @tap="removeNotice(item)">删除</button>
        </view>
      </view>
    </view>

    <view v-if="loadingMore" class="footer-tip">
      <text>加载中...</text>
    </view>
    <view v-if="!hasMore && notices.length > 0" class="footer-tip">
      <text>没有更多公告了</text>
    </view>
  </view>
</template>

<script>
import {
  listAdminActivityNotices,
  createAdminActivityNotice,
  updateAdminActivityNotice,
  setAdminActivityNoticeStatus,
  deleteAdminActivityNotice
} from '@/api-cache/admin-activity-notices.js';
import { invalidateActivityNotices } from '@/api-cache/activity-notices.js';

const STATUS_OPTIONS = [
  { value: 'draft', label: '草稿' },
  { value: 'published', label: '已发布' },
  { value: 'archived', label: '已归档' }
];

const TONE_OPTIONS = [
  { value: 'cooperation', label: '合作' },
  { value: 'weekly', label: '周刊' },
  { value: 'market', label: '商城' },
  { value: 'default', label: '默认' }
];

function createEmptyForm() {
  return {
    noticeId: '',
    kicker: '',
    title: '',
    summary: '',
    mark: '',
    tone: 'cooperation',
    sortWeight: 0,
    status: 'draft'
  };
}

export default {
  data() {
    return {
      notices: [],
      page: 0,
      pageSize: 20,
      hasMore: true,
      loading: false,
      loadingMore: false,
      editing: false,
      submitting: false,
      form: createEmptyForm(),
      statusIndex: 0,
      toneIndex: 0,
      statusLabels: STATUS_OPTIONS.map(item => item.label),
      toneLabels: TONE_OPTIONS.map(item => item.label)
    };
  },
  onLoad() {
    this.refreshList();
  },
  onPullDownRefresh() {
    this.refreshList(true);
  },
  onReachBottom() {
    this.loadMore();
  },
  methods: {
    async refreshList(fromPullDown = false) {
      this.page = 0;
      this.hasMore = true;
      this.notices = [];
      await this.fetchNotices({ fromPullDown });
    },

    async loadMore() {
      if (!this.hasMore || this.loading || this.loadingMore) return;
      await this.fetchNotices();
    },

    async fetchNotices({ fromPullDown = false } = {}) {
      const targetPage = this.page;
      if (targetPage === 0) this.loading = true;
      else this.loadingMore = true;

      try {
        const result = await listAdminActivityNotices({
          skip: targetPage * this.pageSize,
          limit: this.pageSize,
          includeDeleted: false,
          context: this
        });
        const incoming = Array.isArray(result.notices) ? result.notices : [];
        if (targetPage === 0) {
          this.notices = incoming;
        } else {
          const existingIds = new Set(this.notices.map(item => item && item._id).filter(Boolean));
          this.notices = this.notices.concat(incoming.filter(item => item && !existingIds.has(item._id)));
        }
        this.hasMore = typeof result.hasMore === 'boolean' ? result.hasMore : incoming.length === this.pageSize;
        this.page = targetPage + 1;
      } catch (error) {
        uni.showToast({ title: error.message || '加载失败', icon: 'none' });
      } finally {
        this.loading = false;
        this.loadingMore = false;
        if (fromPullDown) uni.stopPullDownRefresh();
      }
    },

    openCreate() {
      this.form = createEmptyForm();
      this.statusIndex = 0;
      this.toneIndex = 0;
      this.editing = true;
    },

    openEdit(item) {
      if (!item || !item._id) return;
      this.form = {
        noticeId: item._id,
        kicker: item.kicker || '',
        title: item.title || '',
        summary: item.summary || '',
        mark: item.mark || '',
        tone: item.tone || 'default',
        sortWeight: Number(item.sortWeight) || 0,
        status: item.status || 'draft'
      };
      this.statusIndex = Math.max(0, STATUS_OPTIONS.findIndex(option => option.value === this.form.status));
      this.toneIndex = Math.max(0, TONE_OPTIONS.findIndex(option => option.value === this.form.tone));
      this.editing = true;
    },

    closeForm() {
      this.editing = false;
      this.form = createEmptyForm();
    },

    onSortWeightInput(event) {
      const raw = event && event.detail ? event.detail.value : '0';
      this.form = {
        ...this.form,
        sortWeight: Number(raw) || 0
      };
    },

    onStatusChange(event) {
      const index = Number(event && event.detail ? event.detail.value : 0) || 0;
      const option = STATUS_OPTIONS[index] || STATUS_OPTIONS[0];
      this.statusIndex = index;
      this.form = {
        ...this.form,
        status: option.value
      };
    },

    onToneChange(event) {
      const index = Number(event && event.detail ? event.detail.value : 0) || 0;
      const option = TONE_OPTIONS[index] || TONE_OPTIONS[0];
      this.toneIndex = index;
      this.form = {
        ...this.form,
        tone: option.value
      };
    },

    validateForm() {
      if (!String(this.form.title || '').trim()) return '请输入公告标题';
      return '';
    },

    buildPayload() {
      return {
        kicker: String(this.form.kicker || '').trim(),
        title: String(this.form.title || '').trim(),
        summary: String(this.form.summary || '').trim(),
        mark: String(this.form.mark || '').trim(),
        tone: this.form.tone || 'default',
        sortWeight: Number(this.form.sortWeight) || 0,
        status: this.form.status || 'draft'
      };
    },

    async submitForm() {
      if (this.submitting) return;
      const errorMsg = this.validateForm();
      if (errorMsg) {
        uni.showToast({ title: errorMsg, icon: 'none' });
        return;
      }

      this.submitting = true;
      try {
        const payload = this.buildPayload();
        if (this.form.noticeId) {
          await updateAdminActivityNotice({ ...payload, noticeId: this.form.noticeId }, { context: this });
        } else {
          await createAdminActivityNotice(payload, { context: this });
        }
        invalidateActivityNotices();
        uni.showToast({ title: '已保存', icon: 'success' });
        this.closeForm();
        this.refreshList();
      } catch (error) {
        uni.showToast({ title: error.message || '保存失败', icon: 'none' });
      } finally {
        this.submitting = false;
      }
    },

    changeStatus(item) {
      if (!item || !item._id) return;
      uni.showActionSheet({
        itemList: STATUS_OPTIONS.map(option => option.label),
        success: async ({ tapIndex }) => {
          const selected = STATUS_OPTIONS[tapIndex];
          if (!selected) return;
          try {
            await setAdminActivityNoticeStatus({
              noticeId: item._id,
              status: selected.value,
              context: this
            });
            invalidateActivityNotices();
            const index = this.notices.findIndex(row => row && row._id === item._id);
            if (index >= 0) {
              const next = this.notices.slice();
              next[index] = { ...next[index], status: selected.value };
              this.notices = next;
            }
            uni.showToast({ title: '状态已更新', icon: 'success' });
          } catch (error) {
            uni.showToast({ title: error.message || '更新失败', icon: 'none' });
          }
        }
      });
    },

    removeNotice(item) {
      if (!item || !item._id) return;
      uni.showModal({
        title: '删除公告',
        content: '确认删除该公告吗？删除后活动页不再展示。',
        confirmColor: '#f56c6c',
        success: async ({ confirm }) => {
          if (!confirm) return;
          try {
            await deleteAdminActivityNotice({ noticeId: item._id, context: this });
            invalidateActivityNotices();
            this.notices = this.notices.filter(row => row && row._id !== item._id);
            uni.showToast({ title: '已删除', icon: 'success' });
          } catch (error) {
            uni.showToast({ title: error.message || '删除失败', icon: 'none' });
          }
        }
      });
    },

    statusText(status) {
      const option = STATUS_OPTIONS.find(item => item.value === status);
      return option ? option.label : '草稿';
    },

    toneText(tone) {
      const option = TONE_OPTIONS.find(item => item.value === tone);
      return option ? option.label : '默认';
    }
  }
};
</script>

<style scoped>
.notice-admin-page {
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

.form-card,
.notice-card {
  background: #fff;
  border-radius: 12rpx;
  padding: 20rpx;
  box-shadow: 0 4rpx 14rpx rgba(0, 0, 0, 0.05);
}

.form-card {
  margin-bottom: 20rpx;
}

.form-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18rpx;
}

.form-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #222;
}

.close-btn {
  width: auto;
  margin: 0;
  padding: 0 22rpx;
  height: 56rpx;
  line-height: 56rpx;
  border-radius: 999rpx;
  font-size: 24rpx;
  background: #f2f4f7;
  color: #344054;
}

.close-btn::after,
.mini-btn::after {
  border: none;
}

.form-item {
  margin-bottom: 18rpx;
}

.form-row {
  display: flex;
  gap: 16rpx;
}

.form-item.half {
  flex: 1;
  min-width: 0;
}

.label {
  display: block;
  font-size: 26rpx;
  color: #555;
  margin-bottom: 10rpx;
}

.input,
.picker-value,
.textarea {
  width: 100%;
  box-sizing: border-box;
  background: #f7f8fa;
  border-radius: 10rpx;
  padding: 18rpx 20rpx;
  font-size: 28rpx;
  color: #222;
}

.input {
  display: block;
  height: 80rpx;
  line-height: 80rpx;
  padding: 0 20rpx;
}

.textarea {
  min-height: 140rpx;
}

.submit-btn {
  margin-top: 6rpx;
  height: 76rpx;
  line-height: 76rpx;
  border-radius: 12rpx;
  border: none;
  background: #1f9d55;
  color: #fff;
  font-size: 30rpx;
}

.submit-btn[disabled] {
  opacity: 0.7;
}

.state-box {
  text-align: center;
  color: #999;
  padding: 120rpx 40rpx;
}

.notice-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
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
  grid-template-columns: repeat(3, 1fr);
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
