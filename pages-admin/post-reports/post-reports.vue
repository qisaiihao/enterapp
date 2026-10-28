<template>
  <view class="reports-page" :data-app-theme="appThemeMode" :style="appThemeVars">
    <view class="source-tabs">
      <view v-for="tab in sourceTabs" :key="tab.value" class="source-tab" :class="{ active: source === tab.value }" @tap="switchSource(tab.value)">{{ tab.label }}</view>
    </view>
    <view class="tabs">
      <view v-for="tab in tabs" :key="tab.value" class="tab" :class="{ active: queue.status === tab.value }" @tap="switchStatus(tab.value)">{{ tab.label }}</view>
    </view>
    <view v-if="source === 'reviews'" class="review-tip">被拦截的新内容尚未发布，编辑原帖仍保留原内容。核查完整内容后，可决定通过发布或维持拦截。</view>

    <view v-for="record in queue.records" :key="record._id" class="report-card">
      <view class="card-heading">
        <text class="reason">{{ source === 'reports' ? categoryLabel(record.category) + ' · ' + record.reason : reviewKindLabel(record.kind) + ' · ' + auditLabel(record.audit) }}</text>
        <text class="status" :class="record.status">{{ statusLabel(record.status) }}</text>
      </view>
      <view class="meta">{{ source === 'reports' ? '举报人' : '提交人' }}：{{ source === 'reports' ? record.reporterName || '用户' : record.submitterName || '用户' }} · {{ formatTime(record.createTime) }}</view>
      <view class="post-preview" @tap="toggleDetail(record._id)">
        <view class="post-title">{{ record.displaySnapshot.title || (record.kind === 'comment' ? '待复核评论' : '无标题帖子') }}</view>
        <view class="post-author">作者：{{ record.displaySnapshot.authorName || record.submitterName || '未知' }}</view>
        <text class="expand-label">{{ queue.expandedId === record._id ? '收起详情 ⌃' : '查看完整内容及详情 ⌄' }}</text>
      </view>

      <view v-if="queue.expandedId === record._id" class="detail">
        <view class="detail-title">{{ source === 'reports' ? '帖子内容' : '待复核内容' }}</view>
        <view class="post-content">{{ record.displaySnapshot.content || '无文字内容' }}</view>
        <view v-if="record.displaySnapshot.author" class="detail-line">诗歌署名：{{ record.displaySnapshot.author }}</view>
        <view v-if="record.displaySnapshot.anonymousAuthorName" class="detail-line">匿名展示名：{{ record.displaySnapshot.anonymousAuthorName }}</view>
        <view v-if="record.displaySnapshot.authorSignature" class="detail-line">作者签名：{{ record.displaySnapshot.authorSignature }}</view>
        <view v-if="record.displayTags" class="detail-line">标签：{{ record.displayTags }}</view>
        <view v-if="record.displayHighlight" class="detail-line">高光句：{{ record.displayHighlight }}</view>
        <view v-if="record.displaySnapshot.seriesCoverHighlight" class="detail-line">组诗封面句：{{ record.displaySnapshot.seriesCoverHighlight }}</view>
        <view v-for="(block, index) in record.displaySeries" :key="'series-' + index" class="content-block">
          <view class="detail-title">组诗 {{ index + 1 }}{{ block.subtitle ? ' · ' + block.subtitle : '' }}</view>
          <view class="post-content">{{ block.content }}</view>
          <view v-if="block.highlight" class="detail-line">高光句：{{ block.highlight }}</view>
        </view>
        <view v-for="(group, index) in record.displayGroups" :key="'group-' + index" class="content-block">
          <view class="detail-title">讨论句组 {{ index + 1 }}</view>
          <view v-if="group.sentences" class="post-content quoted-content">{{ group.sentences }}</view>
          <view class="post-content">{{ group.comment || '无讨论文字' }}</view>
        </view>
        <view v-if="record.displayPostImages.length" class="image-list">
          <image v-for="(url, index) in record.displayPostImages" :key="index" :src="url" mode="aspectFill" @tap="preview(record.displayPostImages, index)" />
        </view>
        <view v-if="record.postId" class="open-post" @tap="openPost(record.postId)">{{ source === 'reviews' && record.status === 'approved' ? '打开已通过的帖子' : '打开原帖' }} →</view>

        <template v-if="source === 'reports'">
          <view class="detail-title">举报信息</view>
          <view class="detail-line">类型：{{ categoryLabel(record.category) }}</view>
          <view class="detail-line">原因：{{ record.reason }}</view>
          <view class="detail-line">补充：{{ record.description || '未填写' }}</view>
          <view v-if="record.displayEvidence.length">
            <view class="detail-title">图片证据</view>
            <view class="image-list">
              <image v-for="(url, index) in record.displayEvidence" :key="index" :src="url" mode="aspectFill" @tap="preview(record.displayEvidence, index)" />
            </view>
          </view>
        </template>
        <template v-else>
          <view class="detail-title">自动审核信息</view>
          <view class="detail-line">来源：{{ sourceLabel(record.source) }}</view>
          <view class="detail-line">结果：{{ auditLabel(record.audit) }}</view>
          <view v-if="record.audit && record.audit.failedType" class="detail-line">拦截内容：{{ record.audit.failedType === 'image' ? '图片' : '文字' }}</view>
          <view v-if="record.audit && record.audit.message" class="detail-line">说明：{{ record.audit.message }}</view>
          <view v-if="record.audit && record.audit.requestId" class="detail-line">审核请求：{{ record.audit.requestId }}</view>
          <template v-if="record.status === 'pending'">
            <view class="detail-title">处理说明（选填）</view>
            <textarea v-model="record.noteDraft" class="note-input" maxlength="500" placeholder="填写复核说明，最多 500 字" :disabled="!!busyId" />
            <view class="note-count">{{ record.noteDraft.length }}/500</view>
          </template>
        </template>
      </view>

      <view v-if="source === 'reports' && (record.status === 'pending' || canRetry(record))" class="actions">
        <button v-if="record.status === 'pending' || record.processingDecision === 'dismiss'" class="dismiss-button" :disabled="!!busyId" @tap="confirmDecision(record, 'dismiss')">{{ record.status === 'pending' ? '不处理' : '重试不处理' }}</button>
        <button v-if="record.status === 'pending' || record.processingDecision === 'delete'" class="delete-button" :disabled="!!busyId" @tap="confirmDecision(record, 'delete')">{{ record.status === 'pending' ? '删帖并处理' : '重试删帖' }}</button>
      </view>
      <view v-else-if="source === 'reviews' && record.status === 'pending'" class="actions">
        <button class="dismiss-button" :disabled="!!busyId" @tap="confirmReviewDecision(record, 'reject')">维持拦截</button>
        <button class="approve-button" :disabled="!!busyId" @tap="confirmReviewDecision(record, 'approve')">{{ record.kind === 'post_edit' ? '通过并应用修改' : '通过并发布' }}</button>
      </view>
      <view v-else-if="record.status === 'processing'" class="decision-info">处理中，稍后刷新查看结果</view>
      <view v-else class="decision-info">
        <view>{{ source === 'reports' ? (record.decision === 'delete' ? '已删帖' : '未处理帖子') : (record.status === 'approved' ? (record.kind === 'post_edit' ? '修改已生效' : '已通过并发布') : '已维持拦截') }} · {{ formatTime(record.handledAt) }}</view>
        <view v-if="source === 'reviews' && record.handledBy">处理人：{{ record.handledBy }}</view>
        <view v-if="source === 'reviews' && record.note" class="detail-line">说明：{{ record.note }}</view>
      </view>
    </view>

    <view v-if="loading" class="list-tip">加载中...</view>
    <view v-else-if="queue.error" class="list-tip retry" @tap="load(true)">{{ queue.error }}，点击重试</view>
    <view v-else-if="!queue.records.length" class="list-tip">暂无{{ currentTabLabel }}{{ source === 'reports' ? '举报' : '复核内容' }}</view>
    <view v-else-if="!queue.hasMore" class="list-tip">没有更多{{ source === 'reports' ? '举报' : '复核内容' }}了</view>
    <app-overlay-host />
  </view>
</template>

<script>
import {
  listPostReports, getPostReport, resolvePostReport,
  listModerationReviews, getModerationReview, resolveModerationReview
} from '@/api-cache/post-report.js';
import fileUrlCache from '@/cache/core/file-url.js';
import { invalidatePostDetail } from '@/api-cache/post.js';

function createQueue() {
  return { status: 'pending', records: [], skip: 0, hasMore: true, expandedId: '', error: '' };
}

export default {
  data() {
    return {
      source: 'reports',
      sourceTabs: [{ value: 'reports', label: '举报' }, { value: 'reviews', label: '拦截复核' }],
      reportTabs: [
        { value: 'pending', label: '待受理' }, { value: 'handled', label: '已删帖' },
        { value: 'dismissed', label: '不处理' }, { value: 'all', label: '全部' }
      ],
      reviewTabs: [
        { value: 'pending', label: '待复核' }, { value: 'approved', label: '已通过' },
        { value: 'rejected', label: '已拦截' }, { value: 'all', label: '全部' }
      ],
      queues: { reports: createQueue(), reviews: createQueue() },
      loading: false, busyId: '', requestVersion: 0, navigationVersion: 0
    };
  },
  computed: {
    queue() { return this.queues[this.source]; },
    tabs() { return this.source === 'reports' ? this.reportTabs : this.reviewTabs; },
    currentTabLabel() {
      const tab = this.tabs.find(item => item.value === this.queue.status);
      return tab ? tab.label : '';
    }
  },
  onLoad(options) {
    if (options && options.reviewId) this.openTarget('reviews', options.reviewId);
    else if (options && options.reportId) this.openTarget('reports', options.reportId);
    else {
      if (options && options.source === 'reviews') this.source = 'reviews';
      this.load(true);
    }
  },
  onReachBottom() { if (this.queue.hasMore && !this.loading) this.load(); },
  onPullDownRefresh() { this.load(true); },
  onUnload() { this.requestVersion++; this.navigationVersion++; },
  methods: {
    categoryLabel(category) { return category === 'rights' ? '权益侵害' : '困扰或危害'; },
    reviewKindLabel(kind) { return ({ post: '发布帖子', post_edit: '编辑帖子', comment: '发布评论' })[kind] || '发布内容'; },
    statusLabel(status) {
      if (status === 'pending') return this.source === 'reports' ? '待受理' : '待复核';
      return ({ processing: '处理中', handled: '已删帖', dismissed: '不处理', approved: '已通过', rejected: '已拦截' })[status] || status;
    },
    auditLabel(audit) {
      if (!audit) return '自动审核拦截';
      if (audit.suggestion === 'Review' || audit.code === 'REVIEW_REQUIRED') return '建议人工复核';
      if (audit.suggestion === 'Block' || audit.code === 'CONTENT_BLOCKED') return '自动审核拦截';
      return audit.message || audit.code || '自动审核拦截';
    },
    sourceLabel(source) {
      return ({ contentCheck: '发布诗歌', createPost: '发帖', createDiscussionPost: '发布讨论', updatePostContent: '编辑帖子', addComment: '发布评论', uploadCollagePoetry: '发布拼贴诗' })[source] || '内容提交';
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
    switchSource(value) {
      if (value === this.source || this.busyId) return;
      this.navigationVersion++;
      this.source = value;
      this.load(true);
    },
    switchStatus(value) {
      if (value === this.queue.status || this.busyId) return;
      this.navigationVersion++;
      this.queue.status = value;
      this.load(true);
    },
    toggleDetail(id) { this.queue.expandedId = this.queue.expandedId === id ? '' : id; },
    async decorateRecords(records, source) {
      const snapshotFor = item => (source === 'reviews' ? item.snapshot : item.postSnapshot) || {};
      const imagesFor = item => {
        const snapshot = snapshotFor(item);
        return [...new Set([
          ...(Array.isArray(snapshot.imageUrls) ? snapshot.imageUrls : []),
          ...(Array.isArray(snapshot.originalImageUrls) ? snapshot.originalImageUrls : []),
          ...(Array.isArray(snapshot.seriesBlocks) ? snapshot.seriesBlocks.map(block => block && block.imageUrl) : []),
          snapshot.imageUrl, snapshot.originalImageUrl, snapshot.seriesCoverImage, snapshot.poemBgImage
        ].filter(url => typeof url === 'string' && url))];
      };
      const evidenceFor = item => Array.isArray(item.evidenceImages) ? item.evidenceImages.filter(url => typeof url === 'string') : [];
      const ids = records.flatMap(item => [...imagesFor(item), ...evidenceFor(item)]).filter(url => url.startsWith('cloud://'));
      let urls = {};
      if (ids.length) {
        try { urls = await fileUrlCache.getTempUrls([...new Set(ids)]); }
        catch (error) { console.warn('[content-review] image URL conversion failed:', error.message); }
      }
      return records.map(item => {
        const snapshot = snapshotFor(item);
        const groups = [
          ...(Array.isArray(snapshot.sentenceGroups) ? snapshot.sentenceGroups : []),
          ...(Array.isArray(snapshot.discussionSentences) ? snapshot.discussionSentences : [])
        ].filter(Boolean).map(group => ({
          sentences: Array.isArray(group.sentences) ? group.sentences.join('\n') : '', comment: group.comment || ''
        }));
        const seenGroups = new Set();
        return {
          ...item,
          postId: item.resultPostId || item.postId || '',
          displaySnapshot: snapshot,
          displayTags: Array.isArray(snapshot.tags) ? snapshot.tags.join('、') : '',
          displayHighlight: [...new Set([...(Array.isArray(snapshot.highlightLines) ? snapshot.highlightLines : []), snapshot.highlightSentence].filter(Boolean))].join('\n'),
          displayPostImages: imagesFor(item).map(id => urls[id] || id),
          displayEvidence: evidenceFor(item).map(id => urls[id] || id),
          displaySeries: (Array.isArray(snapshot.seriesBlocks) ? snapshot.seriesBlocks : []).filter(Boolean).map(block => ({
            subtitle: block.subtitle || '', content: block.content || '',
            highlight: [...new Set([...(Array.isArray(block.highlightLines) ? block.highlightLines : []), block.highlightSentence].filter(Boolean))].join('\n')
          })),
          displayGroups: groups.filter(group => {
            const key = JSON.stringify(group);
            if (seenGroups.has(key)) return false;
            seenGroups.add(key);
            return true;
          }),
          noteDraft: ''
        };
      });
    },
    async openTarget(source, id) {
      this.source = source;
      const navigationVersion = ++this.navigationVersion;
      this.loading = true;
      try {
        const result = source === 'reviews'
          ? await getModerationReview({ reviewId: id, context: this })
          : await getPostReport({ reportId: id, context: this });
        if (navigationVersion !== this.navigationVersion) return;
        const record = source === 'reviews' ? result.review : result.report;
        if (!record || !record._id) throw new Error('记录不存在');
        const queue = this.queues[source];
        queue.status = record.status === 'processing' ? 'pending' : record.status;
        if (!this.tabs.some(tab => tab.value === queue.status)) queue.status = 'all';
        await this.load(true);
        if (navigationVersion !== this.navigationVersion) return;
        if (!queue.records.some(item => item._id === id)) {
          const [display] = await this.decorateRecords([record], source);
          if (navigationVersion !== this.navigationVersion) return;
          queue.records = [display, ...queue.records];
        }
        queue.expandedId = id;
      } catch (error) {
        if (navigationVersion !== this.navigationVersion) return;
        uni.showToast({ title: error.message || '加载详情失败', icon: 'none' });
        this.load(true);
      }
    },
    async load(reset = false) {
      if (this.loading && !reset) return;
      const source = this.source;
      const queue = this.queues[source];
      if (reset) {
        queue.records = []; queue.skip = 0; queue.hasMore = true; queue.expandedId = '';
      }
      const version = ++this.requestVersion;
      this.loading = true;
      queue.error = '';
      try {
        const args = { status: queue.status, skip: queue.skip, limit: 20, context: this };
        const result = source === 'reviews' ? await listModerationReviews(args) : await listPostReports(args);
        const incoming = (source === 'reviews' ? result.reviews : result.reports) || [];
        const display = await this.decorateRecords(incoming, source);
        if (version !== this.requestVersion) return;
        queue.records = reset ? display : [...queue.records, ...display];
        queue.skip += incoming.length;
        queue.hasMore = !!result.hasMore;
      } catch (error) {
        if (version === this.requestVersion) queue.error = error.message || '加载失败';
      } finally {
        if (version === this.requestVersion) {
          this.loading = false;
          uni.stopPullDownRefresh();
        }
      }
    },
    preview(urls, index) { uni.previewImage({ current: urls[index], urls }); },
    openPost(id) {
      if (!id) return;
      invalidatePostDetail(id);
      uni.navigateTo({ url: `/pages/post-detail/post-detail?id=${encodeURIComponent(id)}` });
    },
    confirmDecision(report, decision) {
      if (this.busyId) return;
      const deleting = decision === 'delete';
      uni.showModal({
        title: deleting ? '确认删帖' : '确认不处理',
        content: deleting ? '将删除这篇帖子及相关评论、收藏，并将举报标记为已处理。此操作无法撤销。' : '将此举报标记为不处理，帖子仍会保留。',
        confirmText: deleting ? '删除帖子' : '不处理',
        confirmColor: deleting ? '#c43d3d' : '#333333',
        success: result => { if (result.confirm) this.resolve(report._id, decision, 'reports'); }
      });
    },
    confirmReviewDecision(review, decision) {
      if (this.busyId) return;
      if (this.queue.expandedId !== review._id) {
        this.queue.expandedId = review._id;
        uni.showToast({ title: '请先核查完整内容，再作出决定', icon: 'none' });
        return;
      }
      const approving = decision === 'approve';
      const kind = review.kind === 'post_edit' ? '更新原帖内容' : review.kind === 'comment' ? '发布这条评论' : '发布这篇帖子';
      const note = review.noteDraft.trim();
      uni.showModal({
        title: approving ? '确认通过复核' : '确认维持拦截',
        content: approving ? `将${kind}，并通知提交人复核已通过。请确认文字、图片及附加内容均已核查。` : (review.kind === 'post_edit' ? '此次修改将不发布，原帖保留原内容，并通知提交人未通过复核。' : '该内容将保持未发布状态，并通知提交人未通过复核。'),
        confirmText: approving ? '确认通过' : '维持拦截',
        confirmColor: approving ? '#307656' : '#c43d3d',
        success: result => { if (result.confirm) this.resolve(review._id, decision, 'reviews', note, review.kind); }
      });
    },
    async resolve(id, decision, source, note = '', reviewKind = '') {
      if (this.busyId) return;
      this.busyId = id;
      uni.showLoading({ title: '处理中...' });
      try {
        const result = source === 'reviews'
          ? await resolveModerationReview({ reviewId: id, decision, note, context: this })
          : await resolvePostReport({ reportId: id, decision, context: this });
        await this.load(true);
        uni.hideLoading();
        const finalDecision = source === 'reviews' ? result.status : decision;
        uni.showToast({ title: ({ approved: reviewKind === 'post_edit' ? '修改已生效' : '已通过并发布', rejected: '已维持拦截', delete: '已删帖并处理', dismiss: '已标记不处理' })[finalDecision] || '处理完成', icon: 'none' });
      } catch (error) {
        uni.hideLoading();
        uni.showToast({ title: error.message || '处理失败', icon: 'none' });
      } finally {
        uni.hideLoading();
        this.busyId = '';
      }
    }
  }
};
</script>

<style scoped>
.reports-page { min-height: 100vh; background: var(--app-subtle-surface-bg, #f5f5f5); padding: 20rpx; box-sizing: border-box; color: var(--app-primary-text, #222); }
.source-tabs { display: flex; gap: 12rpx; margin-bottom: 20rpx; }
.source-tab { flex: 1; padding: 24rpx 12rpx; text-align: center; font-size: 30rpx; font-weight: 600; border-bottom: 4rpx solid transparent; }
.source-tab.active { color: var(--app-primary-text, #222); border-bottom-color: var(--app-primary-text, #222); }
.tabs { display: flex; gap: 12rpx; overflow-x: auto; margin-bottom: 20rpx; }
.tab { flex: 1; min-width: 116rpx; text-align: center; padding: 18rpx 6rpx; border-radius: 12rpx; background: var(--app-surface-bg, #fff); color: var(--app-secondary-text, #666); font-size: 25rpx; }
.tab.active { background: #303030; color: #fff; }
.review-tip { padding: 0 10rpx 20rpx; font-size: 24rpx; line-height: 1.6; color: var(--app-secondary-text, #666); }
.report-card { background: var(--app-surface-bg, #fff); border-radius: 16rpx; padding: 28rpx; margin-bottom: 20rpx; }
.card-heading { display: flex; justify-content: space-between; align-items: flex-start; gap: 16rpx; }
.reason { flex: 1; font-size: 30rpx; font-weight: 600; line-height: 1.4; }
.status { flex-shrink: 0; font-size: 22rpx; color: #9a6920; background: #fff3db; border-radius: 8rpx; padding: 6rpx 10rpx; }
.status.handled, .status.approved { color: #307656; background: #e9f5ee; }
.status.dismissed { color: #777; background: #eee; }
.status.rejected { color: #a63a3a; background: #f9e8e8; }
.meta { margin: 16rpx 0 20rpx; color: var(--app-muted-text, #888); font-size: 23rpx; }
.post-preview { padding: 20rpx; border-radius: 12rpx; background: var(--app-subtle-surface-bg, #f7f7f7); }
.post-title { font-size: 28rpx; font-weight: 600; line-height: 1.5; }
.post-author { color: var(--app-muted-text, #888); font-size: 23rpx; margin-top: 8rpx; }
.expand-label { display: block; text-align: right; color: #596c89; font-size: 23rpx; margin-top: 10rpx; }
.detail { padding-top: 24rpx; font-size: 26rpx; line-height: 1.6; }
.detail-title { font-size: 27rpx; font-weight: 600; margin: 14rpx 0; }
.detail-line, .post-content { white-space: pre-wrap; overflow-wrap: anywhere; margin-bottom: 12rpx; }
.content-block { padding: 10rpx 0; border-top: 1rpx solid var(--app-border-color, #eee); }
.quoted-content { padding-left: 18rpx; border-left: 4rpx solid var(--app-border-color, #ddd); color: var(--app-secondary-text, #666); }
.image-list { display: flex; flex-wrap: wrap; gap: 12rpx; margin: 14rpx 0; }
.image-list image { width: 154rpx; height: 154rpx; border-radius: 10rpx; }
.open-post { color: #596c89; margin: 15rpx 0 28rpx; }
.note-input { width: 100%; min-height: 150rpx; padding: 16rpx; box-sizing: border-box; border-radius: 12rpx; font-size: 25rpx; color: var(--app-primary-text, #222); background: var(--app-subtle-surface-bg, #f7f7f7); }
.note-count { text-align: right; font-size: 22rpx; color: var(--app-muted-text, #888); }
.actions { display: flex; gap: 18rpx; margin-top: 24rpx; }
.actions button { flex: 1; height: 78rpx; line-height: 78rpx; border-radius: 12rpx; font-size: 25rpx; margin: 0; padding: 0; }
.dismiss-button { background: #ececec; color: #333; }
.delete-button { background: #bd3b3b; color: #fff; }
.approve-button { background: #307656; color: #fff; }
.decision-info { margin-top: 20rpx; font-size: 23rpx; line-height: 1.6; color: var(--app-muted-text, #888); }
.list-tip { text-align: center; padding: 55rpx 10rpx; color: var(--app-muted-text, #888); font-size: 26rpx; }
.retry { color: #596c89; }
</style>
