<template>
    <view class="page" :data-app-theme="appThemeMode" :style="appThemeVars">
        <view class="intro">查看反馈进度，或继续补充信息。</view>
        <view v-for="item in feedbackList" :key="item._id" class="card" @tap="openDetail(item._id)">
            <view class="row"><text class="time">{{ formatTime(item.createTime) }}</text><text class="status">{{ feedbackStatusLabel(item) }}</text></view>
            <text class="content">{{ item.content }}</text>
            <text v-if="item.lastReply" class="latest">最新回复：{{ item.lastReply }}</text>
            <view class="link">查看详情 ›</view>
        </view>
        <view v-if="error" class="hint" @tap="refresh">{{ error }} · 点击重试</view>
        <view v-else-if="loading" class="hint">加载中...</view>
        <view v-else-if="!feedbackList.length" class="hint">还没有提交过反馈</view>
        <view v-else-if="!hasMore" class="hint">没有更多反馈了</view>
    </view>
    <app-overlay-host />
</template>

<script>
import { getMyFeedbackList } from '../../api-cache/feedback.js';
import { feedbackStatusLabel, feedbackDetailUrl } from '../../utils/feedback.js';
import { formatRelativeTime } from '../../utils/time.js';

export default {
    data() { return { feedbackList: [], loading: false, error: '', hasMore: true, skip: 0 }; },
    onShow() { this.refresh(); },
    onPullDownRefresh() { this.refresh(); },
    onReachBottom() { if (this.hasMore) this.load(); },
    methods: {
        feedbackStatusLabel,
        formatTime: formatRelativeTime,
        openDetail(id) { uni.navigateTo({ url: feedbackDetailUrl(id) }); },
        refresh() {
            if (this.loading) { uni.stopPullDownRefresh(); return; }
            this.skip = 0;
            this.hasMore = true;
            return this.load();
        },
        async load() {
            if (this.loading) return;
            this.loading = true;
            this.error = '';
            try {
                const result = await getMyFeedbackList({ skip: this.skip, limit: 20, context: this });
                const rows = result.feedbackList || [];
                this.feedbackList = this.skip === 0 ? rows : this.feedbackList.concat(rows);
                this.skip += rows.length;
                this.hasMore = rows.length === 20;
            } catch (error) { this.error = error.message || '加载失败'; }
            finally { this.loading = false; uni.stopPullDownRefresh(); }
        }
    }
};
</script>

<style scoped>
.page { min-height: 100vh; padding: 28rpx; box-sizing: border-box; background: var(--app-page-bg, #f5f5f5); color: var(--app-primary-text, #333); }
.intro, .hint { padding: 24rpx 0; font-size: 26rpx; color: var(--app-secondary-text, #888); }
.hint { text-align: center; }
.card { padding: 28rpx; margin-bottom: 24rpx; border-radius: 16rpx; background: var(--app-surface-bg, #fff); }
.row { display: flex; justify-content: space-between; gap: 20rpx; margin-bottom: 24rpx; font-size: 24rpx; }
.time, .latest { color: var(--app-secondary-text, #888); }
.status { flex-shrink: 0; }
.content { display: block; white-space: pre-wrap; word-break: break-all; font-size: 30rpx; line-height: 1.7; }
.latest { display: block; margin-top: 20rpx; font-size: 26rpx; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.link { margin-top: 24rpx; text-align: right; font-size: 24rpx; }
</style>
