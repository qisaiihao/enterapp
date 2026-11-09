<template>
  <view class="community-page">
    <view class="row"><text class="grow">{{ item.title }}</text><button class="text-button" @tap="$emit('switch')">切换</button></view>
    <view class="muted">截止 {{ date(item.deadline) }}　已收稿{{ item.submissionCount || 0 }}篇</view>
    <community-state v-if="loading || error" :loading="loading" :error="error" @action="load(retryMore)" />
    <template v-if="current">
      <view v-if="current.post" class="review-poem">
        <view class="review-poem-title"><text selectable :user-select="true">{{ current.post.title || '未命名作品' }}</text></view>
        <view v-if="current.post.authorName" class="review-poem-author"><text selectable :user-select="true">{{ current.post.authorName }}</text></view>
        <view v-if="current.post.seriesBlocks && current.post.seriesBlocks.length" class="review-series">
          <view v-for="(block, blockIndex) in current.post.seriesBlocks" :key="blockIndex" class="review-series-block">
            <view v-if="block.subtitle" class="review-series-subtitle"><text selectable :user-select="true">{{ block.subtitle }}</text></view>
            <view class="review-poem-content"><text selectable :user-select="true">{{ block.content }}</text></view>
          </view>
        </view>
        <view v-else-if="current.post.content" class="review-poem-content"><text selectable :user-select="true">{{ current.post.content }}</text></view>
      </view>
      <view v-else class="review-poem review-poem-unavailable">作品不可用</view>
      <text v-if="current.changed" class="muted changed-note">原作已修改</text>
      <view class="actions review-actions"><button :disabled="busy || !current.post || current.changed" class="approve" @tap="review('approved')">通过</button><button :disabled="busy" class="defer" @tap="defer">待定</button><button :disabled="busy" class="reject" @tap="review('rejected')">退回</button></view>
    </template>
    <view v-else-if="!loading && !error" class="muted review-empty">{{ records.length ? '本轮评审已结束' : '暂无待审稿件' }}</view>
  </view>
</template>
<script>
import CommunityState from './CommunityState.vue';
import { societyRequest } from '@/api-cache/societies.js';
import { societyDate, showSocietyError } from '@/pages-community/utils/society.js';
export default {
  components: { CommunityState }, props: { item: Object, societyId: String }, emits: ['switch', 'reviewed'],
  data: () => ({ records: [], index: 0, pendingSkip: 0, deferredSkip: 0, nextStatus: 'pending', hasMore: true, loading: false, error: '', busy: false, retryMore: false, sequence: 0 }),
  computed: {
    current() { return this.records[this.index]; }
  },
  mounted() { this.load(false); },
  methods: {
    date: societyDate,
    async load(more) { const sequence = ++this.sequence; this.loading = true; this.error = ''; this.retryMore = more;
      if (!more) { this.records = []; this.index = 0; this.pendingSkip = 0; this.deferredSkip = 0; this.nextStatus = 'pending'; this.hasMore = true; }
      try {
        while (this.hasMore && this.index >= this.records.length) {
          const status = this.nextStatus;
          const skip = status === 'pending' ? this.pendingSkip : this.deferredSkip;
          const result = await societyRequest('submissions', { societyId: this.societyId, id: this.item._id, status, skip, limit: 20 }, this);
          if (sequence !== this.sequence) return;
          this.records.push(...result.records);
          if (status === 'pending') this.pendingSkip += result.records.length;
          else this.deferredSkip += result.records.length;
          if (!result.hasMore) { if (status === 'pending') this.nextStatus = 'deferred'; else this.hasMore = false; }
        }
      } catch (error) { if (sequence === this.sequence) this.error = error.message; } finally { if (sequence === this.sequence) this.loading = false; } },
    async advance(removeCurrent) {
      if (removeCurrent) {
        const status = this.current.status;
        this.records.splice(this.index, 1);
        if (status === 'pending') this.pendingSkip = Math.max(0, this.pendingSkip - 1);
        else this.deferredSkip = Math.max(0, this.deferredSkip - 1);
      }
      else this.index++;
      if (this.index >= this.records.length && this.hasMore) await this.load(true);
    },
    async defer() { if (this.busy || !this.current) return; this.busy = true; try { await this.advance(false); } finally { this.busy = false; } },
    async review(decision) { if (this.busy || !this.current) return; this.busy = true; try {
      await societyRequest('reviewWork', { societyId: this.societyId, id: this.current._id, revision: this.current.revision, decision }, this);
      await this.advance(true); this.$emit('reviewed');
    } catch (error) { showSocietyError(error); } finally { this.busy = false; } }
  }
};
</script>
<style scoped>
@import '@/styles/society.css';
.review-empty { display: block; margin: 52rpx 0; text-align: center; }
.review-poem { margin-top: 28rpx; padding: 28rpx 0; }
.review-poem-title { font-size: 36rpx; line-height: 1.4; font-weight: 700; word-break: break-word; }
.review-poem-author { margin: 10rpx 0 15rpx; font-size: 28rpx; font-weight: 700; letter-spacing: 2rpx; }
.review-poem-content { margin-bottom: 20rpx; font-size: 28rpx; line-height: 1.6; white-space: pre-wrap; word-break: break-word; color: var(--app-post-content-color, #666); }
.review-series { margin-top: 16rpx; }
.review-series-block { margin-bottom: 60rpx; }
.review-series-block:last-child { margin-bottom: 0; }
.review-series-subtitle { margin-bottom: 20rpx; font-size: 28rpx; font-weight: 600; color: var(--app-secondary-text, #666); opacity: .8; }
.review-poem-unavailable { color: var(--app-muted-text, #8a807b); }
.changed-note { display: block; margin: 10rpx 20rpx 0; }
.review-actions button { color: #fff; padding: 16rpx 10rpx; border-radius: 13rpx; }.approve { background: #506541; }.defer { background: #ad9849; }.reject { background: #855c50; }
</style>
