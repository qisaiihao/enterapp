<template>
  <view class="reports-page" :data-app-theme="appThemeMode" :style="appThemeVars">
    <view class="tabs">
      <view v-for="tab in tabs" :key="tab.value" class="tab" :class="{ active: status === tab.value }" @tap="switchStatus(tab.value)">{{ tab.label }}</view>
    </view>

    <view v-for="report in reports" :key="report._id" class="report-card">
      <view class="card-heading">
        <text class="reason">{{ categoryLabel(report.category) }} · {{ report.reason }}</text>
        <text class="status" :class="report.status">{{ statusLabel(report.status) }}</text>
      </view>
      <view class="meta">举报人：{{ report.reporterName || '用户' }} · {{ formatTime(report.createTime) }}</view>
      <view class="post-preview" @tap="toggleDetail(report._id)">
        <view class="post-title">{{ report.postSnapshot && report.postSnapshot.title || '无标题帖子' }}</view>
        <view class="post-author">作者：{{ report.postSnapshot && report.postSnapshot.authorName || '未知' }}</view>
        <text class="expand-label">{{ expandedId === report._id ? '收起详情 ⌃' : '查看帖子及举报详情 ⌄' }}</text>
      </view>

      <view v-if="expandedId === report._id" class="detail">
        <view class="detail-title">帖子内容</view>
        <view class="post-content">{{ report.postSnapshot && report.postSnapshot.content || '无文字内容' }}</view>
        <view v-if="report.displayPostImages && report.displayPostImages.length" class="image-list">
          <image v-for="(url, index) in report.displayPostImages" :key="index" :src="url" mode="aspectFill" @tap="preview(report.displayPostImages, index)" />
        </view>
        <view class="open-post" @tap="openPost(report.postId)">打开原帖 →</view>
        <view class="detail-title">举报信息</view>
        <view class="detail-line">类型：{{ categoryLabel(report.category) }}</view>
        <view class="detail-line">原因：{{ report.reason }}</view>
        <view class="detail-line">补充：{{ report.description || '未填写' }}</view>
        <view v-if="report.displayEvidence && report.displayEvidence.length">
          <view class="detail-title evidence-heading">图片证据</view>
          <view class="image-list">
            <image v-for="(url, index) in report.displayEvidence" :key="index" :src="url" mode="aspectFill" @tap="preview(report.displayEvidence, index)" />
          </view>
        </view>
      </view>

      <view v-if="report.status === 'pending' || canRetry(report)" class="actions">
        <button v-if="report.status === 'pending' || report.processingDecision === 'dismiss'" class="dismiss-button" :disabled="!!busyId" @tap="confirmDecision(report, 'dismiss')">{{ report.status === 'pending' ? '不处理' : '重试不处理' }}</button>
        <button v-if="report.status === 'pending' || report.processingDecision === 'delete'" class="delete-button" :disabled="!!busyId" @tap="confirmDecision(report, 'delete')">{{ report.status === 'pending' ? '删帖并处理' : '重试删帖' }}</button>
      </view>
      <view v-else-if="report.status === 'processing'" class="decision-info">处理中，稍后刷新可重试</view>
      <view v-else class="decision-info">{{ report.decision === 'delete' ? '已删帖' : '未处理帖子' }} · {{ formatTime(report.handledAt) }}</view>
    </view>

    <view v-if="loading" class="list-tip">加载中...</view>
    <view v-else-if="error" class="list-tip retry" @tap="load(true)">{{ error }}，点击重试</view>
    <view v-else-if="!reports.length" class="list-tip">暂无{{ currentTabLabel }}举报</view>
    <view v-else-if="!hasMore" class="list-tip">没有更多举报了</view>
    <app-overlay-host />
  </view>
</template>

<script>
import { listPostReports, getPostReport, resolvePostReport } from '@/api-cache/post-report.js';
import fileUrlCache from '@/cache/core/file-url.js';

export default {
  computed: {
    currentTabLabel() {
      const tab = this.tabs.find(item => item.value === this.status);
      return tab ? tab.label : '';
    }
  },
  data() {
    return {
      tabs: [
        { value: 'pending', label: '待受理' },
        { value: 'handled', label: '已删帖' },
        { value: 'dismissed', label: '不处理' },
        { value: 'all', label: '全部' }
      ],
      status: 'pending', reports: [], skip: 0, hasMore: true,
      loading: false, error: '', expandedId: '', busyId: '', requestVersion: 0
    };
  },
  onLoad(options) {
    if (options && options.reportId) this.openTargetReport(options.reportId);
    else this.load(true);
  },
  onReachBottom() { if (this.hasMore && !this.loading) this.load(); },
  onPullDownRefresh() { this.load(true); },
  onUnload() { this.requestVersion++; },
  methods: {
    categoryLabel(category) { return category === 'rights' ? '权益侵害' : '困扰或危害'; },
    statusLabel(status) {
      return ({ pending: '待受理', processing: '处理中', handled: '已删帖', dismissed: '不处理' })[status] || status;
    },
    canRetry(report) {
      return report.status === 'processing' && report.processingDecision &&
        Date.now() - new Date(report.processingAt).getTime() > 2 * 60 * 1000;
    },
    formatTime(value) {
      if (!value) return '未知时间';
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return '未知时间';
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    },
    switchStatus(value) {
      if (value === this.status) return;
      this.status = value;
      this.load(true);
    },
    toggleDetail(id) { this.expandedId = this.expandedId === id ? '' : id; },
    async decorateReports(reports) {
      const ids = reports.flatMap(item => [
        ...(item.evidenceImages || []),
        ...((item.postSnapshot && item.postSnapshot.imageUrls) || [])
      ]);
      const urls = ids.length ? await fileUrlCache.getTempUrls(ids) : {};
      return reports.map(item => ({
        ...item,
        displayEvidence: (item.evidenceImages || []).map(id => urls[id] || id),
        displayPostImages: ((item.postSnapshot && item.postSnapshot.imageUrls) || []).map(id => urls[id] || id)
      }));
    },
    async openTargetReport(reportId) {
      try {
        const result = await getPostReport({ reportId, context: this });
        const report = result.report;
        this.status = report.status === 'processing' ? 'pending' : report.status;
        await this.load(true);
        if (!this.reports.some(item => item._id === reportId)) {
          const [display] = await this.decorateReports([report]);
          this.reports = [display, ...this.reports];
        }
        this.expandedId = reportId;
      } catch (error) {
        uni.showToast({ title: error.message || '加载举报详情失败', icon: 'none' });
        this.load(true);
      }
    },
    async load(reset = false) {
      if (this.loading && !reset) return;
      if (reset) {
        this.reports = []; this.skip = 0; this.hasMore = true; this.expandedId = '';
      }
      const version = ++this.requestVersion;
      const status = this.status;
      this.loading = true;
      this.error = '';
      try {
        const result = await listPostReports({ status, skip: this.skip, limit: 20, context: this });
        const incoming = result.reports || [];
        const display = await this.decorateReports(incoming);
        if (version !== this.requestVersion) return;
        this.reports = reset ? display : [...this.reports, ...display];
        this.skip += incoming.length;
        this.hasMore = !!result.hasMore;
      } catch (error) {
        if (version === this.requestVersion) this.error = error.message || '加载失败';
      } finally {
        if (version === this.requestVersion) {
          this.loading = false;
          uni.stopPullDownRefresh();
        }
      }
    },
    preview(urls, index) { uni.previewImage({ current: urls[index], urls }); },
    openPost(id) { if (id) uni.navigateTo({ url: `/pages/post-detail/post-detail?id=${encodeURIComponent(id)}` }); },
    confirmDecision(report, decision) {
      if (this.busyId) return;
      const deleting = decision === 'delete';
      uni.showModal({
        title: deleting ? '确认删帖' : '确认不处理',
        content: deleting ? '将删除这篇帖子及相关评论、收藏，并将举报标记为已处理。此操作无法撤销。' : '将此举报标记为不处理，帖子仍会保留。',
        confirmText: deleting ? '删除帖子' : '不处理',
        confirmColor: deleting ? '#c43d3d' : '#333333',
        success: result => { if (result.confirm) this.resolve(report._id, decision); }
      });
    },
    async resolve(reportId, decision) {
      if (this.busyId) return;
      this.busyId = reportId;
      uni.showLoading({ title: '处理中...' });
      try {
        await resolvePostReport({ reportId, decision, context: this });
        await this.load(true);
        uni.hideLoading();
        uni.showToast({ title: decision === 'delete' ? '已删帖并处理' : '已标记不处理', icon: 'none' });
      } catch (error) {
        uni.hideLoading();
        uni.showToast({ title: error.message || '处理失败', icon: 'none' });
      } finally {
        this.busyId = '';
      }
    }
  }
};
</script>

<style scoped>
.reports-page { min-height: 100vh; background: var(--app-subtle-surface-bg, #f5f5f5); padding: 20rpx; box-sizing: border-box; color: var(--app-primary-text, #222); }
.tabs { display: flex; gap: 12rpx; overflow-x: auto; margin-bottom: 20rpx; }
.tab { flex: 1; min-width: 116rpx; text-align: center; padding: 18rpx 6rpx; border-radius: 12rpx; background: var(--app-surface-bg, #fff); color: var(--app-secondary-text, #666); font-size: 25rpx; }
.tab.active { background: #303030; color: #fff; }
.report-card { background: var(--app-surface-bg, #fff); border-radius: 16rpx; padding: 28rpx; margin-bottom: 20rpx; }
.card-heading { display: flex; justify-content: space-between; align-items: flex-start; gap: 16rpx; }
.reason { flex: 1; font-size: 30rpx; font-weight: 600; line-height: 1.4; }
.status { font-size: 22rpx; color: #9a6920; background: #fff3db; border-radius: 8rpx; padding: 6rpx 10rpx; }
.status.handled { color: #307656; background: #e9f5ee; }
.status.dismissed { color: #777; background: #eee; }
.meta { margin: 16rpx 0 20rpx; color: var(--app-muted-text, #888); font-size: 23rpx; }
.post-preview { padding: 20rpx; border-radius: 12rpx; background: var(--app-subtle-surface-bg, #f7f7f7); }
.post-title { font-size: 28rpx; font-weight: 600; line-height: 1.5; }
.post-author { color: var(--app-muted-text, #888); font-size: 23rpx; margin-top: 8rpx; }
.expand-label { display: block; text-align: right; color: #596c89; font-size: 23rpx; margin-top: 10rpx; }
.detail { padding-top: 24rpx; font-size: 26rpx; line-height: 1.6; }
.detail-title { font-size: 27rpx; font-weight: 600; margin: 14rpx 0; }
.detail-line, .post-content { white-space: pre-wrap; overflow-wrap: anywhere; margin-bottom: 12rpx; }
.image-list { display: flex; flex-wrap: wrap; gap: 12rpx; margin: 14rpx 0; }
.image-list image { width: 154rpx; height: 154rpx; border-radius: 10rpx; }
.open-post { color: #596c89; margin: 15rpx 0 28rpx; }
.evidence-heading { margin-top: 18rpx; }
.actions { display: flex; gap: 18rpx; margin-top: 24rpx; }
.actions button { flex: 1; height: 78rpx; line-height: 78rpx; border-radius: 12rpx; font-size: 25rpx; margin: 0; padding: 0; }
.dismiss-button { background: #ececec; color: #333; }
.delete-button { background: #bd3b3b; color: #fff; }
.decision-info { margin-top: 20rpx; font-size: 23rpx; color: var(--app-muted-text, #888); }
.list-tip { text-align: center; padding: 55rpx 10rpx; color: var(--app-muted-text, #888); font-size: 26rpx; }
.retry { color: #596c89; }
</style>
