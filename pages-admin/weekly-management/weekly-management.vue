<template>
  <view class="weekly-admin-page" :style="pageInlineStyle">
    <view class="header">
      <view class="back-btn" @tap="goBack">
        <text class="back-arrow">←</text>
      </view>
      <text class="title">周刊管理</text>
      <button class="refresh-btn" @tap="refreshAll">刷新</button>
    </view>

    <view class="tab-row">
      <view :class="['tab-item', activeTab === 'issues' ? 'active' : '']" @tap="activeTab = 'issues'">周刊期刊</view>
      <view :class="['tab-item', activeTab === 'topics' ? 'active' : '']" @tap="activeTab = 'topics'">主题管理</view>
    </view>

    <view v-if="activeTab === 'issues'" class="panel">
      <view class="panel-actions">
        <button class="primary-btn" @tap="openIssueForm">新建周刊</button>
      </view>

      <view v-if="issueFormVisible" class="form-card">
        <text class="form-title">{{ issueForm.issueId ? '编辑周刊' : '新建周刊' }}</text>
        <view class="form-grid">
          <view class="form-item full">
            <text class="label">标题</text>
            <input v-model="issueForm.title" class="input" placeholder="回车键诗歌精选1期" />
          </view>
          <view class="form-item half">
            <text class="label">书架小标题</text>
            <input v-model="issueForm.shelfTitle" class="input" placeholder="如 第7期 / 春分" />
          </view>
          <view class="form-item half">
            <text class="label">开始日期</text>
            <input v-model="issueForm.periodStart" class="input" placeholder="2026-06-01" />
          </view>
          <view class="form-item half">
            <text class="label">结束日期</text>
            <input v-model="issueForm.periodEnd" class="input" placeholder="2026-06-14" />
          </view>
          <view class="form-item half">
            <text class="label">排序权重</text>
            <input v-model="issueForm.sortWeight" type="number" class="input" placeholder="0" />
          </view>
          <view class="form-item half">
            <text class="label">状态</text>
            <input v-model="issueForm.status" class="input" placeholder="draft / published / archived" />
          </view>
          <view class="form-item full">
            <text class="label">首页轮播</text>
            <textarea v-model="issueForm.heroItemsText" class="textarea" placeholder="每行一个文案" />
          </view>
          <view class="form-item full">
            <text class="label">精选作品 ID</text>
            <textarea v-model="issueForm.featuredPostIdsText" class="textarea" placeholder="每行或逗号一个 postId" />
          </view>
          <view class="form-item full">
            <text class="label">主题 ID</text>
            <textarea v-model="issueForm.topicIdsText" class="textarea" placeholder="每行或逗号一个 topicId" />
          </view>
        </view>
        <view class="form-actions">
          <button class="primary-btn" @tap="saveIssue">保存</button>
          <button class="secondary-btn" @tap="generateRanking">生成热榜</button>
          <button class="secondary-btn" @tap="publishIssue">发布</button>
          <button class="secondary-btn" @tap="archiveIssue">归档</button>
          <button class="danger-btn" @tap="deleteIssue">删除</button>
        </view>
      </view>

      <view class="card-list">
        <view v-for="item in issues" :key="item._id" class="data-card" @tap="openIssueForm(item)">
          <view class="card-head">
            <text class="card-title">{{ item.title }}</text>
            <text class="status-tag">{{ statusText(item.status) }}</text>
          </view>
          <text class="card-meta">周期：{{ item.dateRange || '-' }}</text>
          <text class="card-meta">精选：{{ (item.featuredPostIds && item.featuredPostIds.length) || 0 }}  主题：{{ (item.topicIds && item.topicIds.length) || 0 }}</text>
          <text class="card-meta">权重：{{ item.sortWeight || 0 }}  发布时间：{{ formatDate(item.publishedAt) }}</text>
        </view>
      </view>
    </view>

    <view v-else class="panel">
      <view class="panel-actions">
        <button class="primary-btn" @tap="openTopicForm">新建主题</button>
      </view>

      <view v-if="topicFormVisible" class="form-card">
        <text class="form-title">{{ topicForm.topicId ? '编辑主题' : '新建主题' }}</text>
        <view class="form-grid">
          <view class="form-item full">
            <text class="label">标题</text>
            <input v-model="topicForm.title" class="input" placeholder="主题xxx" />
          </view>
          <view class="form-item full">
            <text class="label">摘要</text>
            <textarea v-model="topicForm.summary" class="textarea" placeholder="主题说明" />
          </view>
          <view class="form-item half">
            <text class="label">开始日期</text>
            <input v-model="topicForm.periodStart" class="input" placeholder="2026-06-01" />
          </view>
          <view class="form-item half">
            <text class="label">结束日期</text>
            <input v-model="topicForm.periodEnd" class="input" placeholder="2026-06-14" />
          </view>
          <view class="form-item half">
            <text class="label">排序权重</text>
            <input v-model="topicForm.sortWeight" type="number" class="input" placeholder="0" />
          </view>
          <view class="form-item half">
            <text class="label">状态</text>
            <input v-model="topicForm.status" class="input" placeholder="draft / published / archived" />
          </view>
          <view class="form-item full">
            <text class="label">作品 ID</text>
            <textarea v-model="topicForm.selectedPostIdsText" class="textarea" placeholder="每行或逗号一个 postId" />
          </view>
        </view>
        <view class="form-actions">
          <button class="primary-btn" @tap="saveTopic">保存</button>
          <button class="secondary-btn" @tap="publishTopic">发布</button>
          <button class="danger-btn" @tap="deleteTopic">归档</button>
        </view>
      </view>

      <view class="card-list">
        <view v-for="item in topics" :key="item._id" class="data-card" @tap="openTopicForm(item)">
          <view class="card-head">
            <text class="card-title">{{ item.title }}</text>
            <text class="status-tag">{{ statusText(item.status) }}</text>
          </view>
          <text class="card-meta">{{ item.summary || '暂无摘要' }}</text>
          <text class="card-meta">周期：{{ item.dateRange || '-' }}</text>
          <text class="card-meta">作品：{{ (item.selectedPostIds && item.selectedPostIds.length) || 0 }}  发布时间：{{ formatDate(item.publishedAt) }}</text>
        </view>
      </view>
    </view>

    <view class="candidate-card">
      <view class="candidate-head">
        <text class="candidate-title">候选作品</text>
        <button class="mini-btn" @tap="searchCandidates">搜索</button>
      </view>
      <view class="candidate-search">
        <input v-model="candidateKeyword" class="input" placeholder="输入标题关键词" />
      </view>
      <view class="candidate-list">
        <view v-for="post in candidatePosts" :key="post.postId" class="candidate-item">
          <view class="candidate-copy">
            <text class="candidate-post-title">{{ post.title }}</text>
            <text class="candidate-post-meta">ID：{{ post.postId }}</text>
          </view>
          <view class="candidate-actions">
            <button class="mini-btn" @tap="copyId(post.postId)">复制</button>
            <button class="mini-btn" @tap="appendToIssue(post.postId)">精选</button>
            <button class="mini-btn" @tap="appendToTopic(post.postId)">主题</button>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { getSystemInfoCompat } from '@/utils/system-info.js';
import {
  listAdminWeeklyIssues,
  createAdminWeeklyIssue,
  updateAdminWeeklyIssue,
  publishAdminWeeklyIssue,
  archiveAdminWeeklyIssue,
  deleteAdminWeeklyIssue,
  generateAdminWeeklyRanking,
  listAdminWeeklyCandidatePosts,
  listAdminWeeklyTopics,
  createAdminWeeklyTopic,
  updateAdminWeeklyTopic,
  publishAdminWeeklyTopic,
  archiveAdminWeeklyTopic
} from '@/api-cache/admin-weekly.js';
import { invalidateWeeklyContent } from '@/api-cache/weekly.js';

function splitLines(value) {
  return String(value || '')
    .split(/[\n,，]+/)
    .map(item => item.trim())
    .filter(Boolean);
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function createIssueForm() {
  return {
    issueId: '',
    title: '',
    shelfTitle: '',
    periodStart: '',
    periodEnd: '',
    sortWeight: 0,
    status: 'draft',
    heroItemsText: '',
    featuredPostIdsText: '',
    topicIdsText: '',
    rankingSnapshot: []
  };
}

function createTopicForm() {
  return {
    topicId: '',
    title: '',
    summary: '',
    periodStart: '',
    periodEnd: '',
    sortWeight: 0,
    status: 'draft',
    selectedPostIdsText: ''
  };
}

export default {
  data() {
    return {
      pageInlineStyle: {},
      activeTab: 'issues',
      issues: [],
      topics: [],
      issueFormVisible: false,
      topicFormVisible: false,
      issueForm: createIssueForm(),
      topicForm: createTopicForm(),
      candidateKeyword: '',
      candidatePosts: [],
      candidateLoading: false
    };
  },
  onLoad() {
    this.setupHeaderLayout();
    this.refreshAll();
  },
  methods: {
    setupHeaderLayout() {
      try {
        const systemInfo = getSystemInfoCompat();
        const safeAreaTop = (systemInfo.safeAreaInsets && systemInfo.safeAreaInsets.top) || systemInfo.statusBarHeight || 0;
        if (safeAreaTop > 0) {
          this.pageInlineStyle = { '--weekly-admin-safe-area-top': `${safeAreaTop}px` };
        }
      } catch (error) {
        console.warn('[weekly-management] setup header layout failed:', error);
      }
    },

    async refreshAll() {
      await Promise.all([this.loadIssues(), this.loadTopics(), this.searchCandidates()]);
    },

    async loadIssues() {
      try {
        const result = await listAdminWeeklyIssues({ context: this, limit: 50 });
        this.issues = Array.isArray(result.issues) ? result.issues : [];
      } catch (error) {
        uni.showToast({ title: error.message || '加载周刊失败', icon: 'none' });
      }
    },

    async loadTopics() {
      try {
        const result = await listAdminWeeklyTopics({ context: this, limit: 50 });
        this.topics = Array.isArray(result.topics) ? result.topics : [];
      } catch (error) {
        uni.showToast({ title: error.message || '加载主题失败', icon: 'none' });
      }
    },

    async searchCandidates() {
      this.candidateLoading = true;
      try {
        const result = await listAdminWeeklyCandidatePosts({
          context: this,
          limit: 20,
          keyword: this.candidateKeyword
        });
        this.candidatePosts = Array.isArray(result.posts) ? result.posts : [];
      } catch (error) {
        uni.showToast({ title: error.message || '加载候选作品失败', icon: 'none' });
      } finally {
        this.candidateLoading = false;
      }
    },

    openIssueForm(item) {
      if (!item) {
        this.issueForm = createIssueForm();
      } else {
        this.issueForm = {
          issueId: item._id || '',
          title: item.title || '',
          shelfTitle: item.shelfTitle || '',
          periodStart: formatDate(item.periodStart),
          periodEnd: formatDate(item.periodEnd),
          sortWeight: item.sortWeight || 0,
          status: item.status || 'draft',
          heroItemsText: Array.isArray(item.heroItems) ? item.heroItems.map(entry => entry.text || '').join('\n') : '',
          featuredPostIdsText: Array.isArray(item.featuredPostIds) ? item.featuredPostIds.join('\n') : '',
          topicIdsText: Array.isArray(item.topicIds) ? item.topicIds.join('\n') : '',
          rankingSnapshot: Array.isArray(item.rankingSnapshot) ? item.rankingSnapshot : []
        };
      }
      this.issueFormVisible = true;
      this.activeTab = 'issues';
    },

    openTopicForm(item) {
      if (!item) {
        this.topicForm = createTopicForm();
      } else {
        this.topicForm = {
          topicId: item._id || '',
          title: item.title || '',
          summary: item.summary || '',
          periodStart: formatDate(item.periodStart),
          periodEnd: formatDate(item.periodEnd),
          sortWeight: item.sortWeight || 0,
          status: item.status || 'draft',
          selectedPostIdsText: Array.isArray(item.selectedPostIds) ? item.selectedPostIds.join('\n') : ''
        };
      }
      this.topicFormVisible = true;
      this.activeTab = 'topics';
    },

    buildIssuePayload() {
      return {
        issueId: this.issueForm.issueId,
        title: this.issueForm.title,
        shelfTitle: this.issueForm.shelfTitle,
        periodStart: this.issueForm.periodStart,
        periodEnd: this.issueForm.periodEnd,
        sortWeight: Number(this.issueForm.sortWeight) || 0,
        status: this.issueForm.status || 'draft',
        heroItems: splitLines(this.issueForm.heroItemsText).map((text, index) => ({ value: `hero-${index + 1}`, text })),
        featuredPostIds: splitLines(this.issueForm.featuredPostIdsText),
        topicIds: splitLines(this.issueForm.topicIdsText),
        rankingSnapshot: this.issueForm.rankingSnapshot || []
      };
    },

    buildTopicPayload() {
      return {
        topicId: this.topicForm.topicId,
        title: this.topicForm.title,
        summary: this.topicForm.summary,
        periodStart: this.topicForm.periodStart,
        periodEnd: this.topicForm.periodEnd,
        sortWeight: Number(this.topicForm.sortWeight) || 0,
        status: this.topicForm.status || 'draft',
        selectedPostIds: splitLines(this.topicForm.selectedPostIdsText)
      };
    },

    async saveIssue() {
      try {
        const payload = this.buildIssuePayload();
        if (payload.issueId) {
          await updateAdminWeeklyIssue(payload, { context: this });
        } else {
          await createAdminWeeklyIssue(payload, { context: this });
        }
        invalidateWeeklyContent();
        await this.loadIssues();
        uni.showToast({ title: '已保存', icon: 'success' });
      } catch (error) {
        uni.showToast({ title: error.message || '保存失败', icon: 'none' });
      }
    },

    async saveTopic() {
      try {
        const payload = this.buildTopicPayload();
        if (payload.topicId) {
          await updateAdminWeeklyTopic(payload, { context: this });
        } else {
          await createAdminWeeklyTopic(payload, { context: this });
        }
        invalidateWeeklyContent();
        await this.loadTopics();
        uni.showToast({ title: '已保存', icon: 'success' });
      } catch (error) {
        uni.showToast({ title: error.message || '保存失败', icon: 'none' });
      }
    },

    async generateRanking() {
      if (!this.issueForm.issueId) {
        uni.showToast({ title: '请先保存周刊', icon: 'none' });
        return;
      }
      try {
        await generateAdminWeeklyRanking({
          context: this,
          issueId: this.issueForm.issueId,
          periodStart: this.issueForm.periodStart,
          periodEnd: this.issueForm.periodEnd
        });
        invalidateWeeklyContent();
        await this.loadIssues();
        uni.showToast({ title: '热榜已生成', icon: 'success' });
      } catch (error) {
        uni.showToast({ title: error.message || '生成失败', icon: 'none' });
      }
    },

    async publishIssue() {
      if (!this.issueForm.issueId) {
        uni.showToast({ title: '请先保存周刊', icon: 'none' });
        return;
      }
      try {
        await publishAdminWeeklyIssue({ issueId: this.issueForm.issueId, context: this });
        invalidateWeeklyContent();
        await this.loadIssues();
        uni.showToast({ title: '已发布', icon: 'success' });
      } catch (error) {
        uni.showToast({ title: error.message || '发布失败', icon: 'none' });
      }
    },

    async archiveIssue() {
      if (!this.issueForm.issueId) return;
      try {
        await archiveAdminWeeklyIssue({ issueId: this.issueForm.issueId, context: this });
        invalidateWeeklyContent();
        await this.loadIssues();
        uni.showToast({ title: '已归档', icon: 'success' });
      } catch (error) {
        uni.showToast({ title: error.message || '归档失败', icon: 'none' });
      }
    },

    async deleteIssue() {
      if (!this.issueForm.issueId) return;
      try {
        await deleteAdminWeeklyIssue({ issueId: this.issueForm.issueId, context: this });
        invalidateWeeklyContent();
        this.issueFormVisible = false;
        this.issueForm = createIssueForm();
        await this.loadIssues();
        uni.showToast({ title: '已删除', icon: 'success' });
      } catch (error) {
        uni.showToast({ title: error.message || '归档失败', icon: 'none' });
      }
    },

    async publishTopic() {
      if (!this.topicForm.topicId) {
        uni.showToast({ title: '请先保存主题', icon: 'none' });
        return;
      }
      try {
        await publishAdminWeeklyTopic({ topicId: this.topicForm.topicId, context: this });
        invalidateWeeklyContent();
        await this.loadTopics();
        uni.showToast({ title: '已发布', icon: 'success' });
      } catch (error) {
        uni.showToast({ title: error.message || '发布失败', icon: 'none' });
      }
    },

    async deleteTopic() {
      if (!this.topicForm.topicId) return;
      try {
        await archiveAdminWeeklyTopic({ topicId: this.topicForm.topicId, context: this });
        invalidateWeeklyContent();
        this.topicFormVisible = false;
        this.topicForm = createTopicForm();
        await this.loadTopics();
        uni.showToast({ title: '已归档', icon: 'success' });
      } catch (error) {
        uni.showToast({ title: error.message || '删除失败', icon: 'none' });
      }
    },

    appendToIssue(postId) {
      if (!postId) return;
      const next = splitLines(this.issueForm.featuredPostIdsText);
      if (!next.includes(postId)) {
        next.push(postId);
        this.issueForm.featuredPostIdsText = next.join('\n');
      }
    },

    appendToTopic(postId) {
      if (!postId) return;
      const next = splitLines(this.topicForm.selectedPostIdsText);
      if (!next.includes(postId)) {
        next.push(postId);
        this.topicForm.selectedPostIdsText = next.join('\n');
      }
    },

    copyId(text) {
      if (!text) return;
      if (uni.setClipboardData) {
        uni.setClipboardData({ data: text, success: () => uni.showToast({ title: '已复制', icon: 'none' }) });
      }
    },

    statusText(status) {
      if (status === 'published') return '已发布';
      if (status === 'archived') return '已归档';
      return '草稿';
    },

    goBack() {
      try {
        const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
        if (pages && pages.length > 1) {
          uni.navigateBack({ delta: 1 });
          return;
        }
      } catch (_) {}
      uni.navigateTo({ url: '/pages-admin/admin-menu/admin-menu' });
    },

    formatDate
  }
};
</script>

<style scoped>
.weekly-admin-page {
  min-height: 100vh;
  background: #f5f5f5;
  padding: 20rpx;
  box-sizing: border-box;
}

.header {
  height: calc(var(--weekly-admin-safe-area-top, 0px) + 80rpx);
  padding-top: var(--weekly-admin-safe-area-top, 0px);
  display: flex;
  align-items: center;
  gap: 20rpx;
  box-sizing: border-box;
}

.back-btn {
  width: 60rpx;
  height: 60rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #ffffff;
}

.back-arrow {
  font-size: 28rpx;
  color: #333333;
}

.title {
  flex: 1;
  font-size: 36rpx;
  font-weight: 700;
  color: #111111;
}

.refresh-btn,
.primary-btn,
.secondary-btn,
.danger-btn,
.mini-btn {
  border-radius: 10rpx;
  font-size: 24rpx;
  line-height: 1;
  padding: 18rpx 24rpx;
}

.refresh-btn,
.secondary-btn,
.mini-btn {
  background: #ffffff;
  color: #333333;
}

.primary-btn {
  background: #111111;
  color: #ffffff;
}

.danger-btn {
  background: #c94d4d;
  color: #ffffff;
}

.tab-row {
  display: flex;
  gap: 16rpx;
  margin: 10rpx 0 18rpx;
}

.tab-item {
  flex: 1;
  padding: 20rpx 0;
  text-align: center;
  background: #ffffff;
  border-radius: 12rpx;
  color: #666666;
}

.tab-item.active {
  color: #111111;
  font-weight: 600;
}

.panel {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.panel-actions {
  display: flex;
  justify-content: flex-start;
}

.form-card,
.data-card,
.candidate-card {
  background: #ffffff;
  border-radius: 14rpx;
  padding: 24rpx;
  box-sizing: border-box;
}

.form-title,
.candidate-title {
  font-size: 30rpx;
  font-weight: 700;
  color: #111111;
}

.form-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 18rpx;
  margin-top: 18rpx;
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.form-item.full {
  width: 100%;
}

.form-item.half {
  width: calc(50% - 9rpx);
}

.label {
  color: #666666;
  font-size: 22rpx;
}

.input,
.textarea {
  width: 100%;
  padding: 18rpx 20rpx;
  box-sizing: border-box;
  border-radius: 10rpx;
  background: #f6f6f6;
  color: #111111;
  font-size: 26rpx;
}

.textarea {
  min-height: 120rpx;
}

.form-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 14rpx;
  margin-top: 18rpx;
}

.card-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.card-head {
  display: flex;
  justify-content: space-between;
  gap: 18rpx;
  margin-bottom: 12rpx;
}

.card-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #111111;
}

.status-tag {
  color: #666666;
  font-size: 22rpx;
}

.card-meta {
  display: block;
  color: #888888;
  font-size: 22rpx;
  line-height: 32rpx;
}

.candidate-card {
  margin-top: 20rpx;
}

.candidate-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 18rpx;
}

.candidate-search {
  margin-top: 16rpx;
}

.candidate-list {
  margin-top: 16rpx;
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}

.candidate-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16rpx;
  padding: 18rpx;
  background: #f8f8f8;
  border-radius: 10rpx;
}

.candidate-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.candidate-post-title {
  font-size: 26rpx;
  color: #111111;
}

.candidate-post-meta {
  font-size: 20rpx;
  color: #888888;
}

.candidate-actions {
  display: flex;
  gap: 10rpx;
  flex-shrink: 0;
}
</style>
