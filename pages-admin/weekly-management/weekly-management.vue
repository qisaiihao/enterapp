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
      <view :class="['tab-item', activeTab === 'featured' ? 'active' : '']" @tap="switchToFeaturedTab">精选设置</view>
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
          <view class="form-item full">
            <text class="label">封面图（自动裁剪为 3:4 竖版）</text>
            <view class="cover-upload-row">
              <view v-if="issueCoverPreview" class="cover-upload-thumb" @tap="chooseCoverImage">
                <image class="cover-thumb-image" :src="issueCoverPreview" mode="aspectFill"></image>
                <view class="cover-thumb-edit">更换</view>
              </view>
              <view v-else class="cover-upload-placeholder" @tap="chooseCoverImage">
                <text class="cover-upload-plus">+</text>
                <text class="cover-upload-tip">上传封面图</text>
              </view>
              <text v-if="issueCoverPreview" class="cover-remove-btn" @tap="clearCoverImage">移除</text>
            </view>
          </view>
          <view class="form-item full">
            <text class="label">书架小标题</text>
            <input v-model="issueForm.shelfTitle" class="input" placeholder="如 第7期 / 春分" />
          </view>
          <view class="form-item full">
            <text class="label">开始日期</text>
            <view class="date-input-row">
              <input v-model="issueForm.periodStart" class="input date-input" placeholder="2026-06-01" @blur="onPeriodDateInputBlur" />
              <picker mode="date" :value="issueForm.periodStart" @change="onPeriodStartChange">
                <view class="date-picker-icon">📅</view>
              </picker>
            </view>
          </view>
          <view class="form-item full">
            <text class="label">结束日期</text>
            <view class="date-input-row">
              <input v-model="issueForm.periodEnd" class="input date-input" placeholder="2026-06-14" @blur="onPeriodDateInputBlur" />
              <picker mode="date" :value="issueForm.periodEnd" @change="onPeriodEndChange">
                <view class="date-picker-icon">📅</view>
              </picker>
            </view>
          </view>
          <view class="form-item full">
            <text class="label">状态</text>
            <picker mode="selector" :range="statusOptions" range-key="label" :value="issueStatusIndex" @change="onIssueStatusChange">
              <view class="input picker-input">
                <text>{{ statusText(issueForm.status) }}</text>
                <text class="picker-arrow">▼</text>
              </view>
            </picker>
          </view>
          <view class="form-item full">
            <text class="label">首页轮播</text>
            <textarea v-model="issueForm.heroItemsText" class="textarea" placeholder="每行一个文案" />
          </view>
          <view class="form-item full poem-select-panel">
            <view class="poem-select-head">
              <view class="poem-select-title-group">
                <text class="label">选择精选诗歌</text>
                <text v-if="issueForm.featuredPostIds && issueForm.featuredPostIds.length" class="badge-count">已选 {{ issueForm.featuredPostIds.length }} 首</text>
              </view>
              <view class="poem-select-ops">
                <button class="text-op-btn" @tap="selectAllPeriodPosts" :disabled="!filteredPeriodPosts.length">全选当期</button>
                <button class="text-op-btn" @tap="clearSelectedPosts" :disabled="!issueForm.featuredPostIds || !issueForm.featuredPostIds.length">清空</button>
                <button class="text-op-btn" @tap="loadPeriodPosts">刷新</button>
              </view>
            </view>

            <view v-if="periodPosts.length" class="poem-search-box">
              <input v-model="periodKeyword" class="input poem-search-input" placeholder="按诗歌标题或作者快速过滤" />
              <text v-if="periodKeyword" class="clear-search-btn" @tap="periodKeyword = ''">×</text>
            </view>

            <!-- 提示与状态 -->
            <view v-if="periodPostsLoading" class="poem-loading-box">
              <text class="hint-text">正在筛选此时间段内的诗歌...</text>
            </view>
            <view v-else-if="!issueForm.periodStart || !issueForm.periodEnd" class="poem-empty-box">
              <text class="hint-text">📅 请先设置上方「开始日期」和「结束日期」，系统将自动筛选该周期内的原创诗歌供勾选</text>
            </view>
            <view v-else-if="!periodPosts.length" class="poem-empty-box">
              <text class="hint-text">该周期内（{{ issueForm.periodStart }} ~ {{ issueForm.periodEnd }}）暂无发布的原创诗歌</text>
            </view>
            <scroll-view v-else class="poem-scroll-list" scroll-y="true">
              <view class="poem-cards-grid">
                <view
                  v-for="post in filteredPeriodPosts"
                  :key="post.postId"
                  class="poem-pick-card"
                  :class="{ selected: isPostSelected(post.postId) }"
                >
                  <view class="poem-pick-body" @tap="viewPostDetail(post.postId)">
                    <view class="poem-pick-header">
                      <text class="poem-pick-title">{{ post.title || '无标题' }}</text>
                      <text class="poem-pick-author">· {{ post.authorName || '匿名' }}</text>
                    </view>
                    <view class="poem-pick-meta">
                      <text class="poem-pick-date">{{ formatDate(post.createTime) }}</text>
                      <text class="poem-pick-stats">👍 {{ post.votes || 0 }} · 💬 {{ post.comments || 0 }} · 👁️ {{ post.views || 0 }}</text>
                    </view>
                    <text v-if="post.copy" class="poem-pick-snippet">{{ post.copy }}</text>
                  </view>
                  <view class="poem-pick-checkbox" :class="{ checked: isPostSelected(post.postId) }" @tap.stop="togglePostSelection(post)">
                    <text v-if="isPostSelected(post.postId)">✓</text>
                  </view>
                </view>
              </view>
            </scroll-view>

            <!-- 已选诗歌汇总抽屉/标签 -->
            <view v-if="issueForm.featuredPostIds && issueForm.featuredPostIds.length" class="selected-summary-box">
              <view class="selected-summary-head" @tap="showSelectedDrawer = !showSelectedDrawer">
                <text class="selected-summary-title">已选作品清单 ({{ issueForm.featuredPostIds.length }}) {{ showSelectedDrawer ? '▲ 收起' : '▼ 展开' }}</text>
              </view>
              <view v-if="showSelectedDrawer" class="selected-tags-container">
                <view v-for="id in issueForm.featuredPostIds" :key="id" class="selected-pill">
                  <text class="selected-pill-name" @tap="viewPostDetail(id)">{{ getPostTitle(id) }}</text>
                  <text class="selected-pill-remove" @tap.stop="removeSelectedPost(id)">×</text>
                </view>
              </view>
            </view>
          </view>
        </view>
        <view class="form-actions">
          <button class="primary-btn" @tap="saveIssue">保存</button>
          <button class="secondary-btn" @tap="generateRanking">生成热榜</button>
          <button class="secondary-btn" @tap="publishIssue">发布</button>
          <button class="secondary-btn" @tap="archiveIssue">隐藏</button>
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
          <text class="card-meta">发布时间：{{ formatDate(item.publishedAt) }}</text>
        </view>
      </view>
    </view>

    <view v-else-if="activeTab === 'featured'" class="panel">
      <view class="featured-tip-box">
        <text class="featured-tip-text">从已发布的期刊中选择若干作为「往期精选」，顺序即为前端展示顺序。保存后立即生效。</text>
      </view>

      <view v-if="featuredLoading" class="form-card">
        <text class="hint-text">加载中...</text>
      </view>

      <template v-else>
        <view v-if="featuredSelectedIds.length" class="form-card">
          <text class="form-title">精选期刊（{{ featuredSelectedIds.length }} 期）</text>
          <view class="featured-order-list">
            <view v-for="(id, index) in featuredSelectedIds" :key="id" class="featured-order-row">
              <text class="featured-order-index">{{ index + 1 }}.</text>
              <text class="featured-order-title">{{ getFeaturedTitle(id) }}</text>
              <view class="featured-order-ops">
                <text v-if="index > 0" class="featured-order-op" @tap.stop="moveFeaturedIssue(index, -1)">↑</text>
                <text v-if="index < featuredSelectedIds.length - 1" class="featured-order-op" @tap.stop="moveFeaturedIssue(index, 1)">↓</text>
                <text class="featured-order-op" @tap.stop="removeFeaturedIssue(id)">移除</text>
              </view>
            </view>
          </view>
        </view>

        <view v-if="featuredIssues.length" class="form-card">
          <text class="form-title">已发布期刊列表</text>
          <view class="featured-pick-list">
            <view
              v-for="issue in featuredIssues"
              :key="issue._id"
              :class="['featured-pick-row', { selected: featuredSelectedIds.includes(issue._id) }]"
              @tap="toggleFeaturedIssue(issue)"
            >
              <view class="featured-pick-copy">
                <text class="featured-pick-title">{{ issue.title }}</text>
                <text class="featured-pick-meta">周期：{{ issue.dateRange || '-' }} · {{ formatDate(issue.publishedAt) }}</text>
              </view>
              <view class="featured-pick-check" :class="{ checked: featuredSelectedIds.includes(issue._id) }">
                <text v-if="featuredSelectedIds.includes(issue._id)">✓</text>
              </view>
            </view>
          </view>
        </view>

        <view class="form-actions">
          <button class="primary-btn" @tap="saveFeaturedIssues">保存精选</button>
        </view>
      </template>
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
          <view class="form-item full">
            <text class="label">开始日期</text>
            <input v-model="topicForm.periodStart" class="input" placeholder="2026-06-01" />
          </view>
          <view class="form-item full">
            <text class="label">结束日期</text>
            <input v-model="topicForm.periodEnd" class="input" placeholder="2026-06-14" />
          </view>
          <view class="form-item full">
            <text class="label">状态</text>
            <picker mode="selector" :range="statusOptions" range-key="label" :value="topicStatusIndex" @change="onTopicStatusChange">
              <view class="input picker-input">
                <text>{{ statusText(topicForm.status) }}</text>
                <text class="picker-arrow">▼</text>
              </view>
            </picker>
          </view>
        </view>
        <view class="form-actions">
          <button class="primary-btn" @tap="saveTopic">保存</button>
          <button class="secondary-btn" @tap="publishTopic">发布</button>
          <button class="danger-btn" @tap="deleteTopic">隐藏</button>
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
  </view>
</template>

<script>
import { getSystemInfoCompat } from '@/utils/system-info.js';
import { uploadFile } from '@/utils/uploader.js';
import fileUrlCache from '@/_utils/file-url-cache';
import {
  listAdminWeeklyIssues,
  createAdminWeeklyIssue,
  updateAdminWeeklyIssue,
  publishAdminWeeklyIssue,
  archiveAdminWeeklyIssue,
  deleteAdminWeeklyIssue,
  generateAdminWeeklyRanking,
  listAdminWeeklyCandidatePosts,
  listAdminWeeklyFeaturedIssues,
  updateAdminWeeklyFeaturedIssues,
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
    coverImage: '',
    shelfTitle: '',
    periodStart: '',
    periodEnd: '',
    status: 'draft',
    heroItemsText: '',
    featuredPostIds: [],
    topicIds: [],
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
    status: 'draft',
    selectedPostIds: []
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
      periodPosts: [],
      periodPostsLoading: false,
      periodKeyword: '',
      showSelectedDrawer: true,
      postTitleMap: {},
      featuredLoading: false,
      featuredSaving: false,
      featuredIssues: [],
      featuredSelectedIds: [],
      issueCoverPreview: '',
      issueCoverPendingPath: '',
      statusOptions: [
        { value: 'draft', label: '草稿' },
        { value: 'published', label: '已发布' },
        { value: 'archived', label: '已隐藏' }
      ]
    };
  },
  computed: {
    issueStatusIndex() {
      const idx = this.statusOptions.findIndex(item => item.value === this.issueForm.status);
      return idx > -1 ? idx : 0;
    },
    topicStatusIndex() {
      const idx = this.statusOptions.findIndex(item => item.value === this.topicForm.status);
      return idx > -1 ? idx : 0;
    },
    filteredPeriodPosts() {
      const list = Array.isArray(this.periodPosts) ? this.periodPosts : [];
      const kw = String(this.periodKeyword || '').trim().toLowerCase();
      if (!kw) return list;
      return list.filter(p => {
        const title = String(p.title || '').toLowerCase();
        const author = String(p.authorName || '').toLowerCase();
        const copy = String(p.copy || '').toLowerCase();
        return title.includes(kw) || author.includes(kw) || copy.includes(kw);
      });
    }
  },
  onLoad() {
    this.setupHeaderLayout();
    this.restoreDraftFromStorage();
    this.refreshAll();
    uni.$on('weekly-cover-cropped', this.onWeeklyCoverCropped);
  },
  onShow() {
    this.restoreDraftFromStorage();
  },
  onUnload() {
    uni.$off('weekly-cover-cropped', this.onWeeklyCoverCropped);
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
      await Promise.all([this.loadIssues(), this.loadTopics()]);
    },

    async loadIssues() {
      try {
        const result = await listAdminWeeklyIssues({ context: this, limit: 50 });
        this.issues = Array.isArray(result.issues) ? result.issues : [];
        this.issues.forEach(issue => {
          if (Array.isArray(issue.featuredSnapshots)) {
            issue.featuredSnapshots.forEach(snap => {
              const pid = snap.postId || snap._id;
              if (pid && snap.title) {
                this.postTitleMap[pid] = snap.title;
              }
            });
          }
        });
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

    openIssueForm(item) {
      if (!item) {
        this.issueForm = createIssueForm();
        this.periodPosts = [];
        this.periodKeyword = '';
        this.issueCoverPendingPath = '';
        this.issueCoverPreview = '';
      } else {
        const featuredPostIds = Array.isArray(item.featuredPostIds)
          ? [...item.featuredPostIds]
          : splitLines(item.featuredPostIdsText || '');

        if (Array.isArray(item.featuredSnapshots)) {
          item.featuredSnapshots.forEach(snap => {
            const pid = snap.postId || snap._id;
            if (pid && snap.title) {
              this.postTitleMap[pid] = snap.title;
            }
          });
        }

        this.issueForm = {
          issueId: item._id || '',
          title: item.title || '',
          coverImage: item.coverImage || '',
          shelfTitle: item.shelfTitle || '',
          periodStart: formatDate(item.periodStart),
          periodEnd: formatDate(item.periodEnd),
          status: item.status || 'draft',
          heroItemsText: Array.isArray(item.heroItems) ? item.heroItems.map(entry => entry.text || '').join('\n') : '',
          featuredPostIds,
          topicIds: Array.isArray(item.topicIds) ? [...item.topicIds] : [],
          rankingSnapshot: Array.isArray(item.rankingSnapshot) ? item.rankingSnapshot : []
        };
        this.periodKeyword = '';
        this.issueCoverPendingPath = '';
        this.loadCoverPreview(item.coverImage || '');
        if (this.issueForm.periodStart && this.issueForm.periodEnd) {
          this.loadPeriodPosts();
        } else {
          this.periodPosts = [];
        }
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
          status: item.status || 'draft',
          selectedPostIds: Array.isArray(item.selectedPostIds) ? [...item.selectedPostIds] : []
        };
      }
      this.topicFormVisible = true;
      this.activeTab = 'topics';
    },

    buildIssuePayload() {
      return {
        issueId: this.issueForm.issueId,
        title: this.issueForm.title,
        coverImage: this.issueForm.coverImage || '',
        shelfTitle: this.issueForm.shelfTitle,
        periodStart: this.issueForm.periodStart,
        periodEnd: this.issueForm.periodEnd,
        status: this.issueForm.status || 'draft',
        heroItems: splitLines(this.issueForm.heroItemsText).map((text, index) => ({ value: `hero-${index + 1}`, text })),
        featuredPostIds: this.issueForm.featuredPostIds || [],
        topicIds: Array.isArray(this.issueForm.topicIds) ? this.issueForm.topicIds : [],
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
        status: this.topicForm.status || 'draft',
        selectedPostIds: Array.isArray(this.topicForm.selectedPostIds) ? this.topicForm.selectedPostIds : []
      };
    },

    async saveIssue() {
      try {
        const payload = this.buildIssuePayload();
        if (this.issueCoverPendingPath) {
          uni.showLoading({ title: '上传封面中...' });
          try {
            const cloudPath = `weekly-covers/${Date.now()}_${Math.floor(Math.random() * 100000)}.jpg`;
            const fileID = await uploadFile(cloudPath, this.issueCoverPendingPath, { context: this });
            if (!fileID) {
              throw new Error('封面图上传失败');
            }
            this.issueForm.coverImage = fileID;
            payload.coverImage = fileID;
            this.issueCoverPendingPath = '';
            await this.loadCoverPreview(fileID);
          } catch (uploadError) {
            uni.hideLoading();
            uni.showToast({ title: uploadError.message || '封面图上传失败', icon: 'none' });
            return;
          }
        }
        let res;
        if (payload.issueId) {
          res = await updateAdminWeeklyIssue(payload, { context: this });
        } else {
          res = await createAdminWeeklyIssue(payload, { context: this });
          if (res && res.issueId) {
            this.issueForm.issueId = res.issueId;
          }
        }
        invalidateWeeklyContent();
        this.clearDraftFromStorage();
        await this.loadIssues();
        uni.showToast({ title: '已保存', icon: 'success' });
      } catch (error) {
        uni.showToast({ title: error.message || '保存失败', icon: 'none' });
      }
    },

    onIssueStatusChange(e) {
      const option = this.statusOptions[e.detail.value];
      if (option) {
        this.issueForm.status = option.value;
        this.saveDraftToStorage();
      }
    },

    onTopicStatusChange(e) {
      const option = this.statusOptions[e.detail.value];
      if (option) {
        this.topicForm.status = option.value;
      }
    },

    onPeriodStartChange(e) {
      this.issueForm.periodStart = e.detail.value;
      this.onPeriodDatesChanged();
    },

    onPeriodEndChange(e) {
      this.issueForm.periodEnd = e.detail.value;
      this.onPeriodDatesChanged();
    },

    chooseCoverImage() {
      uni.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
        success: (res) => {
          const path = (res && res.tempFilePaths && res.tempFilePaths[0]) || '';
          if (!path) return;
          uni.navigateTo({
            url: `/pages-admin/activity-notice-management/notice-cropper?src=${encodeURIComponent(path)}&ratio=3/4&event=weekly-cover-cropped`
          });
        }
      });
    },

    onWeeklyCoverCropped({ path } = {}) {
      if (!path) return;
      this.issueCoverPendingPath = path;
      this.issueCoverPreview = path;
    },

    async loadCoverPreview(fileID) {
      if (!fileID) {
        this.issueCoverPreview = '';
        return;
      }
      if (String(fileID).startsWith('cloud://')) {
        try {
          const url = await fileUrlCache.getTempUrl(fileID);
          if (url && !String(url).startsWith('cloud://')) {
            this.issueCoverPreview = url;
            return;
          }
        } catch (_) {}
        this.issueCoverPreview = '';
        return;
      }
      this.issueCoverPreview = fileID;
    },

    clearCoverImage() {
      this.issueForm.coverImage = '';
      this.issueCoverPendingPath = '';
      this.issueCoverPreview = '';
    },

    onPeriodDateInputBlur() {
      this.onPeriodDatesChanged();
    },

    onPeriodDatesChanged() {
      const start = String(this.issueForm.periodStart || '').trim();
      const end = String(this.issueForm.periodEnd || '').trim();
      if (start && end && /^\d{4}-\d{2}-\d{2}$/.test(start) && /^\d{4}-\d{2}-\d{2}$/.test(end)) {
        this.loadPeriodPosts();
      }
      this.saveDraftToStorage();
    },

    async loadPeriodPosts() {
      const start = String(this.issueForm.periodStart || '').trim();
      const end = String(this.issueForm.periodEnd || '').trim();
      if (!start || !end) {
        this.periodPosts = [];
        return;
      }
      this.periodPostsLoading = true;
      try {
        const result = await listAdminWeeklyCandidatePosts({
          context: this,
          limit: 100,
          periodStart: start,
          periodEnd: end
        });
        const posts = Array.isArray(result.posts) ? result.posts : [];
        this.periodPosts = posts;
        posts.forEach(post => {
          if (post && post.postId) {
            this.postTitleMap[post.postId] = post.title || '无标题';
          }
        });
      } catch (error) {
        console.error('loadPeriodPosts error:', error);
        uni.showToast({ title: error.message || '筛选周期诗歌失败', icon: 'none' });
      } finally {
        this.periodPostsLoading = false;
      }
    },

    isPostSelected(postId) {
      if (!postId) return false;
      return Array.isArray(this.issueForm.featuredPostIds) && this.issueForm.featuredPostIds.includes(postId);
    },

    togglePostSelection(post) {
      if (!post || !post.postId) return;
      const postId = post.postId;
      this.postTitleMap[postId] = post.title || '无标题';
      if (!Array.isArray(this.issueForm.featuredPostIds)) {
        this.issueForm.featuredPostIds = [];
      }
      const idx = this.issueForm.featuredPostIds.indexOf(postId);
      if (idx > -1) {
        this.issueForm.featuredPostIds.splice(idx, 1);
      } else {
        this.issueForm.featuredPostIds.push(postId);
      }
      this.saveDraftToStorage();
    },

    selectAllPeriodPosts() {
      const candidates = this.filteredPeriodPosts;
      if (!candidates.length) return;
      if (!Array.isArray(this.issueForm.featuredPostIds)) {
        this.issueForm.featuredPostIds = [];
      }
      const currentSet = new Set(this.issueForm.featuredPostIds);
      candidates.forEach(post => {
        if (post && post.postId) {
          currentSet.add(post.postId);
          this.postTitleMap[post.postId] = post.title || '无标题';
        }
      });
      this.issueForm.featuredPostIds = Array.from(currentSet);
      this.saveDraftToStorage();
    },

    clearSelectedPosts() {
      this.issueForm.featuredPostIds = [];
      this.saveDraftToStorage();
    },

    removeSelectedPost(postId) {
      if (!Array.isArray(this.issueForm.featuredPostIds)) return;
      const idx = this.issueForm.featuredPostIds.indexOf(postId);
      if (idx > -1) {
        this.issueForm.featuredPostIds.splice(idx, 1);
      }
      this.saveDraftToStorage();
    },

    getPostTitle(postId) {
      return this.postTitleMap[postId] || postId;
    },

    viewPostDetail(postId) {
      if (!postId) return;
      this.saveDraftToStorage();
      uni.navigateTo({
        url: `/pages/post-detail/post-detail?id=${postId}`
      });
    },

    saveDraftToStorage() {
      try {
        const draft = {
          issueFormVisible: this.issueFormVisible,
          issueForm: JSON.parse(JSON.stringify(this.issueForm)),
          periodKeyword: this.periodKeyword,
          postTitleMap: this.postTitleMap
        };
        uni.setStorageSync('WEEKLY_ADMIN_ISSUE_DRAFT', draft);
      } catch (e) {
        console.warn('[weekly-management] saveDraftToStorage error:', e);
      }
    },

    restoreDraftFromStorage() {
      try {
        const draft = uni.getStorageSync('WEEKLY_ADMIN_ISSUE_DRAFT');
        if (draft && draft.issueForm) {
          this.issueForm = draft.issueForm;
          this.issueFormVisible = !!draft.issueFormVisible;
          if (draft.periodKeyword) {
            this.periodKeyword = draft.periodKeyword;
          }
          if (draft.postTitleMap) {
            this.postTitleMap = { ...this.postTitleMap, ...draft.postTitleMap };
          }
          if (this.issueForm.coverImage && !this.issueCoverPendingPath && !this.issueCoverPreview) {
            this.loadCoverPreview(this.issueForm.coverImage);
          }
          const start = String(this.issueForm.periodStart || '').trim();
          const end = String(this.issueForm.periodEnd || '').trim();
          if (start && end && !this.periodPosts.length && !this.periodPostsLoading) {
            this.loadPeriodPosts();
          }
        }
      } catch (e) {
        console.warn('[weekly-management] restoreDraftFromStorage error:', e);
      }
    },

    clearDraftFromStorage() {
      try {
        uni.removeStorageSync('WEEKLY_ADMIN_ISSUE_DRAFT');
      } catch (_) {}
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
        this.clearDraftFromStorage();
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

    switchToFeaturedTab() {
      this.activeTab = 'featured';
      this.loadFeaturedPanel();
    },

    async loadFeaturedPanel() {
      this.featuredLoading = true;
      try {
        const [issuesResult, featuredResult] = await Promise.all([
          listAdminWeeklyIssues({ context: this, limit: 50, status: 'published' }),
          listAdminWeeklyFeaturedIssues({ context: this })
        ]);
        this.featuredIssues = Array.isArray(issuesResult.issues) ? issuesResult.issues : [];
        const savedIds = Array.isArray(featuredResult && featuredResult.issueIds)
          ? featuredResult.issueIds
          : [];
        this.featuredSelectedIds = savedIds;
      } catch (error) {
        console.warn('[weekly-management] load featured panel failed:', error);
        uni.showToast({ title: '加载精选设置失败', icon: 'none' });
      } finally {
        this.featuredLoading = false;
      }
    },

    getFeaturedTitle(issueId) {
      const issue = this.featuredIssues.find(item => item._id === issueId);
      return (issue && issue.title) ? issue.title : issueId;
    },

    toggleFeaturedIssue(issue) {
      const issueId = issue && issue._id;
      if (!issueId) return;
      const idx = this.featuredSelectedIds.indexOf(issueId);
      if (idx > -1) {
        this.featuredSelectedIds.splice(idx, 1);
      } else {
        this.featuredSelectedIds.push(issueId);
      }
    },

    moveFeaturedIssue(index, delta) {
      const target = index + delta;
      if (target < 0 || target >= this.featuredSelectedIds.length) return;
      const list = this.featuredSelectedIds.slice();
      const item = list.splice(index, 1)[0];
      list.splice(target, 0, item);
      this.featuredSelectedIds = list;
    },

    removeFeaturedIssue(issueId) {
      const idx = this.featuredSelectedIds.indexOf(issueId);
      if (idx > -1) {
        const list = this.featuredSelectedIds.slice();
        list.splice(idx, 1);
        this.featuredSelectedIds = list;
      }
    },

    async saveFeaturedIssues() {
      if (this.featuredSaving) return;
      this.featuredSaving = true;
      try {
        await updateAdminWeeklyFeaturedIssues(this.featuredSelectedIds, { context: this });
        invalidateWeeklyContent();
        uni.showToast({ title: '精选已保存', icon: 'success' });
      } catch (error) {
        uni.showToast({ title: '保存精选失败', icon: 'none' });
      } finally {
        this.featuredSaving = false;
      }
    },

    statusText(status) {
      if (status === 'published') return '已发布';
      if (status === 'archived') return '已隐藏';
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
.danger-btn {
  border-radius: 10rpx;
  font-size: 24rpx;
  line-height: 1;
  padding: 18rpx 24rpx;
}

.refresh-btn,
.secondary-btn {
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
.data-card {
  background: #ffffff;
  border-radius: 14rpx;
  padding: 24rpx;
  box-sizing: border-box;
}

.form-title {
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

.label {
  color: #666666;
  font-size: 22rpx;
}

.input,
.textarea {
  width: 100%;
  min-height: 84rpx;
  padding: 18rpx 20rpx;
  box-sizing: border-box;
  border-radius: 10rpx;
  background: #f6f6f6;
  color: #111111;
  font-size: 26rpx;
  line-height: 44rpx;
}

.textarea {
  min-height: 120rpx;
}

.date-input-row {
  display: flex;
  align-items: center;
  gap: 10rpx;
  background: #f6f6f6;
  border-radius: 10rpx;
  padding-right: 14rpx;
}

.picker-input {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.picker-arrow {
  color: #999999;
  font-size: 22rpx;
}

.cover-upload-row {
  display: flex;
  align-items: flex-start;
  gap: 20rpx;
}

.cover-upload-thumb {
  position: relative;
  width: 280rpx;
  aspect-ratio: 3 / 4;
  border-radius: 10rpx;
  overflow: hidden;
  background: #f6f6f6;
}

.cover-thumb-image {
  width: 100%;
  height: 100%;
  display: block;
}

.cover-thumb-edit {
  position: absolute;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  color: #ffffff;
  font-size: 20rpx;
  line-height: 1;
  padding: 10rpx 16rpx;
  border-radius: 8rpx 0 0 0;
}

.cover-upload-placeholder {
  width: 280rpx;
  aspect-ratio: 3 / 4;
  border-radius: 10rpx;
  border: 2rpx dashed #cccccc;
  background: #fafafa;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
}

.cover-upload-plus {
  font-size: 44rpx;
  line-height: 1;
  color: #aaaaaa;
}

.cover-upload-tip {
  font-size: 22rpx;
  color: #999999;
}

.cover-remove-btn {
  color: #c94d4d;
  font-size: 24rpx;
  padding: 10rpx 6rpx;
}

.date-input-row .date-input {
  flex: 1;
  background: transparent;
}

.date-picker-icon {
  font-size: 30rpx;
  padding: 6rpx;
  opacity: 0.8;
}

.poem-select-panel {
  margin-top: 10rpx;
  border-top: 1rpx solid #eeeeee;
  padding-top: 20rpx;
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}

.poem-select-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.poem-select-title-group {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.badge-count {
  background: #111111;
  color: #ffffff;
  font-size: 20rpx;
  padding: 4rpx 14rpx;
  border-radius: 20rpx;
  font-weight: 500;
}

.poem-select-ops {
  display: flex;
  gap: 10rpx;
}

.text-op-btn {
  font-size: 22rpx;
  padding: 8rpx 16rpx;
  line-height: 1.2;
  border-radius: 8rpx;
  background: #f0f0f0;
  color: #333333;
}

.text-op-btn[disabled] {
  opacity: 0.4;
}

.poem-search-box {
  position: relative;
  width: 100%;
}

.poem-search-input {
  font-size: 24rpx;
  padding-right: 50rpx;
}

.clear-search-btn {
  position: absolute;
  right: 20rpx;
  top: 50%;
  transform: translateY(-50%);
  font-size: 32rpx;
  color: #999999;
  padding: 0 10rpx;
}

.poem-loading-box,
.poem-empty-box {
  padding: 36rpx 20rpx;
  text-align: center;
  background: #fafafa;
  border-radius: 12rpx;
  border: 1rpx dashed #e0e0e0;
}

.hint-text {
  font-size: 24rpx;
  color: #888888;
  line-height: 1.5;
}

.poem-scroll-list {
  max-height: 520rpx;
}

.poem-cards-grid {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.poem-pick-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  padding: 20rpx;
  border-radius: 12rpx;
  background: #f8f9fa;
  border: 2rpx solid transparent;
  transition: all 0.2s ease;
}

.poem-pick-card.selected {
  border-color: #111111;
  background: #f0f4f8;
}

.poem-pick-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.poem-pick-header {
  display: flex;
  align-items: baseline;
  gap: 10rpx;
}

.poem-pick-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #111111;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 420rpx;
}

.poem-pick-author {
  font-size: 22rpx;
  color: #666666;
  flex-shrink: 0;
}

.poem-pick-meta {
  display: flex;
  align-items: center;
  gap: 16rpx;
  font-size: 20rpx;
  color: #888888;
}

.poem-pick-snippet {
  font-size: 22rpx;
  color: #555555;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.poem-pick-checkbox {
  width: 44rpx;
  height: 44rpx;
  border-radius: 50%;
  border: 2rpx solid #cccccc;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: #ffffff;
  color: #ffffff;
  font-size: 26rpx;
  font-weight: bold;
  transition: all 0.2s ease;
}

.poem-pick-checkbox.checked {
  background: #111111;
  border-color: #111111;
}



.selected-summary-box {
  margin-top: 10rpx;
  background: #fafafa;
  border-radius: 10rpx;
  padding: 16rpx;
}

.selected-summary-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.selected-summary-title {
  font-size: 24rpx;
  font-weight: 600;
  color: #333333;
}

.selected-tags-container {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
  margin-top: 14rpx;
}

.selected-pill {
  display: inline-flex;
  align-items: center;
  gap: 8rpx;
  padding: 6rpx 14rpx;
  background: #ffffff;
  border: 1rpx solid #e0e0e0;
  border-radius: 30rpx;
  font-size: 22rpx;
  color: #333333;
}

.selected-pill-name {
  max-width: 260rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.selected-pill-remove {
  color: #999999;
  font-size: 26rpx;
  padding: 0 4rpx;
  font-weight: bold;
}

.form-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 14rpx;
  margin-top: 18rpx;
}

.featured-tip-box {
  background: #fff8e6;
  border: 1rpx solid #f0d9a8;
  border-radius: 12rpx;
  padding: 18rpx 22rpx;
}

.featured-tip-text {
  font-size: 24rpx;
  color: #8a6d3b;
  line-height: 34rpx;
}

.featured-order-list {
  margin-top: 16rpx;
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.featured-order-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 14rpx 18rpx;
  background: #fafafa;
  border-radius: 10rpx;
}

.featured-order-index {
  width: 36rpx;
  color: #888888;
  font-size: 24rpx;
  flex-shrink: 0;
}

.featured-order-title {
  min-width: 0;
  flex: 1;
  font-size: 26rpx;
  color: #111111;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.featured-order-ops {
  display: flex;
  align-items: center;
  gap: 20rpx;
  flex-shrink: 0;
}

.featured-order-op {
  color: #666666;
  font-size: 26rpx;
  padding: 4rpx;
}

.featured-pick-list {
  margin-top: 16rpx;
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.featured-pick-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 18rpx 20rpx;
  border-radius: 12rpx;
  background: #f8f9fa;
  border: 2rpx solid transparent;
}

.featured-pick-row.selected {
  border-color: #111111;
  background: #f0f4f8;
}

.featured-pick-copy {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.featured-pick-title {
  font-size: 27rpx;
  font-weight: 600;
  color: #111111;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.featured-pick-meta {
  font-size: 22rpx;
  color: #888888;
}

.featured-pick-check {
  width: 44rpx;
  height: 44rpx;
  border-radius: 50%;
  border: 2rpx solid #cccccc;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: #ffffff;
  color: #ffffff;
  font-size: 26rpx;
  font-weight: bold;
}

.featured-pick-check.checked {
  background: #111111;
  border-color: #111111;
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
</style>
