<template>
    <view class="page" :data-app-theme="appThemeMode" :style="appThemeVars">
        <view v-if="feedback" class="card">
            <view class="row"><text>{{ feedback.userName || '用户' }}</text><text class="status">{{ feedbackStatusLabel(feedback) }}</text></view>
            <text class="time">{{ formatTime(feedback.createTime) }}</text>
            <text class="content">{{ feedback.content }}</text>
            <view class="images"><image v-for="(url, i) in feedback.displayImages" :key="i" :src="url" mode="aspectFill" @tap="preview(feedback.displayImages, i)" /></view>
            <text v-if="isClosed && feedback.processedTime" class="time">办结时间：{{ formatTime(feedback.processedTime) }}</text>
        </view>

        <view v-if="feedback && !isClosed" class="card composer">
            <text class="title">{{ isAdmin ? '回复与处理' : '补充信息' }}</text>
            <text v-if="!isAdmin && feedback.status === 'waiting_user'" class="tip">管理员需要更多细节，请查看下方回复后补充。</text>
            <textarea v-model="content" :disabled="sending" maxlength="500" :show-confirm-bar="false" placeholder="请输入具体说明，可附上相关截图" />
            <view class="count">{{ content.length }}/500</view>
            <view class="images attachments">
                <view v-for="(item, i) in images" :key="item.path" class="attachment">
                    <image :src="item.path" mode="aspectFill" @tap="preview(images.map(image => image.path), i)" />
                    <view v-if="!sending" class="remove" @tap="removeImage(i)">×</view>
                </view>
                <button v-if="images.length < 3" class="add" :disabled="sending" @tap="chooseImages">添加图片</button>
            </view>
            <view v-if="isAdmin" class="status-options">
                <view v-for="option in statusOptions" :key="option.value" class="option" :class="{ selected: selectedStatus === option.value }" @tap="selectStatus(option.value)">{{ option.label }}</view>
            </view>
            <text v-if="isAdmin && selectedStatus === 'closed'" class="tip">请填写处理结果，发送后反馈将办结。</text>
            <button class="send" :disabled="sending || loading || !content.trim()" @tap="send">{{ sending ? '发送中...' : isAdmin && selectedStatus === 'closed' ? '回复并办结' : '发送' }}</button>
        </view>
        <view v-else-if="feedback" class="closed-tip">此反馈已办结。如有新问题，可以提交新的反馈。</view>

        <view v-if="feedback" class="section-title">沟通记录 · 最新在前</view>
        <view v-for="reply in replies" :key="reply._id" class="card">
            <view class="row"><text>{{ reply.role === 'admin' ? '管理员 · ' : '' }}{{ reply.senderName }}</text><text class="status">{{ feedbackStatusLabel(reply) }}</text></view>
            <text class="time">{{ formatTime(reply.createTime) }}</text>
            <text class="content">{{ reply.content }}</text>
            <view class="images"><image v-for="(url, i) in reply.displayImages" :key="i" :src="url" mode="aspectFill" @tap="preview(reply.displayImages, i)" /></view>
        </view>
        <view v-if="error" class="hint" @tap="refresh">{{ error }} · 点击重试</view>
        <view v-else-if="loading" class="hint">加载中...</view>
        <view v-else-if="feedback && !replies.length" class="hint">暂无回复</view>
        <button v-else-if="hasMore" class="more" @tap="load(false)">加载更早的记录</button>
    </view>
    <app-overlay-host />
</template>

<script>
import { getFeedbackDetail, replyFeedback } from '../../api-cache/feedback.js';
import { feedbackStatusLabel, feedbackStatus } from '../../utils/feedback.js';
import { uploadFileCompat } from '../../utils/upload-compat.js';
import { previewImage } from '../../utils/imagePreview.js';
import { formatRelativeTime } from '../../utils/time.js';
import fileUrlCache from '../../cache/core/file-url.js';
import { invalidateMessages } from '../../api-cache/messages.js';
import { invalidateUnread } from '../../api-cache/unread.js';

export default {
    data() {
        return {
            feedbackId: '', feedback: null, replies: [], isAdmin: false, hasMore: false, loading: false, error: '',
            content: '', images: [], sending: false, selectedStatus: 'processing', pendingRequest: null,
            statusOptions: [{ value: 'processing', label: '继续处理' }, { value: 'waiting_user', label: '要求补充细节' }, { value: 'closed', label: '办结' }]
        };
    },
    computed: { isClosed() { return this.feedback && feedbackStatus(this.feedback) === 'closed'; } },
    onLoad(options) { this.feedbackId = options.id || ''; },
    onShow() { if (this.feedbackId) this.refresh(); else this.error = '反馈链接无效'; },
    onPullDownRefresh() { this.refresh(); },
    onReachBottom() { if (this.hasMore) this.load(false); },
    methods: {
        feedbackStatusLabel,
        formatTime: formatRelativeTime,
        refresh() { return this.load(true); },
        async load(reset = true) {
            if (this.loading) { uni.stopPullDownRefresh(); return; }
            this.loading = true;
            this.error = '';
            try {
                const result = await getFeedbackDetail(this.feedbackId, { skip: reset ? 0 : this.replies.length, limit: 20, context: this });
                const records = [result.feedback, ...result.replies];
                const urls = await fileUrlCache.getTempUrls(records.flatMap(item => item.imageUrls || []));
                records.forEach(item => { item.displayImages = (item.imageUrls || []).map(id => urls[id] || id); });
                this.feedback = result.feedback;
                this.isAdmin = result.isAdmin;
                const rows = reset ? result.replies : this.replies.concat(result.replies);
                this.replies = rows.filter((item, index) => rows.findIndex(other => other._id === item._id) === index);
                this.hasMore = result.hasMore;
            } catch (error) {
                this.error = error.message || '加载失败';
                // 失去访问权限或反馈删除后不继续显示旧内容。
                if (/无权|不存在|已删除/.test(this.error)) { this.feedback = null; this.replies = []; }
            } finally { this.loading = false; uni.stopPullDownRefresh(); }
        },
        selectStatus(status) { if (!this.sending) this.selectedStatus = status; },
        removeImage(index) { if (!this.sending) this.images.splice(index, 1); },
        chooseImages() {
            if (this.sending) return;
            uni.chooseImage({
                count: 3 - this.images.length, sizeType: ['compressed'], sourceType: ['album', 'camera'],
                success: result => { this.images = this.images.concat(result.tempFilePaths.map(path => ({ path, fileID: '' }))).slice(0, 3); }
            });
        },
        preview(urls, index) { return previewImage({ urls, current: urls[index] }, { fallbackToast: false }); },
        async send() {
            if (this.sending || this.loading || this.isClosed || !this.content.trim()) return;
            this.sending = true;
            try {
                // 上传结果和请求标识保留到成功；网络重试不会重复创建回复。
                for (let i = 0; i < this.images.length; i++) {
                    const item = this.images[i];
                    if (!item.fileID) {
                        const result = await uploadFileCompat({ cloudPath: `feedback/${Date.now()}_${Math.random().toString(36).slice(2)}_${i}.jpg`, filePath: item.path, context: this, pageTag: 'feedback-detail', requireAuth: true });
                        item.fileID = result.fileID;
                    }
                }
                const payload = { feedbackId: this.feedbackId, content: this.content.trim(), imageUrls: this.images.map(item => item.fileID) };
                if (this.isAdmin) payload.status = this.selectedStatus;
                const signature = JSON.stringify(payload);
                if (!this.pendingRequest || this.pendingRequest.signature !== signature) {
                    this.pendingRequest = { signature, id: `reply_${Date.now()}_${Math.random().toString(36).slice(2)}` };
                }
                await replyFeedback({ ...payload, requestId: this.pendingRequest.id }, { context: this });
                this.content = '';
                this.images = [];
                this.pendingRequest = null;
                invalidateMessages();
                invalidateUnread();
                uni.showToast({ title: '发送成功', icon: 'success' });
                await this.refresh();
            } catch (error) { uni.showToast({ title: error.message || '发送失败，请重试', icon: 'none' }); }
            finally { this.sending = false; }
        }
    }
};
</script>

<style scoped>
.page { min-height: 100vh; padding: 28rpx 28rpx calc(40rpx + env(safe-area-inset-bottom)); box-sizing: border-box; background: var(--app-page-bg, #f5f5f5); color: var(--app-primary-text, #333); }
.card { background: var(--app-surface-bg, #fff); padding: 28rpx; border-radius: 16rpx; margin-bottom: 24rpx; }
.row { display: flex; justify-content: space-between; gap: 20rpx; font-size: 28rpx; margin-bottom: 12rpx; }
.status { font-size: 24rpx; flex-shrink: 0; }
.time, .tip, .hint, .count, .closed-tip { font-size: 24rpx; color: var(--app-secondary-text, #888); }
.content { display: block; font-size: 30rpx; line-height: 1.7; white-space: pre-wrap; word-break: break-all; margin: 24rpx 0; }
.images { display: flex; flex-wrap: wrap; gap: 16rpx; }
.images image { width: 160rpx; height: 160rpx; border-radius: 8rpx; }
.title { display: block; font-size: 30rpx; margin-bottom: 20rpx; }
.tip { display: block; line-height: 1.7; margin: 16rpx 0; }
textarea { box-sizing: border-box; width: 100%; height: 220rpx; padding: 20rpx; font-size: 28rpx; background: var(--app-subtle-surface-bg, #f8f8f8); border-radius: 8rpx; }
.count { text-align: right; padding: 12rpx 0; }
.attachment { position: relative; }
.remove { position: absolute; right: 0; top: 0; background: #555; color: #fff; width: 44rpx; height: 44rpx; line-height: 44rpx; text-align: center; border-radius: 50%; }
.add { margin: 0; height: 160rpx; width: 160rpx; line-height: 160rpx; padding: 0; font-size: 24rpx; }
.status-options { display: flex; flex-wrap: wrap; gap: 12rpx; margin: 28rpx 0; }
.option { font-size: 24rpx; padding: 14rpx 18rpx; border: 1px solid var(--app-border-color, #ddd); border-radius: 10rpx; }
.option.selected { color: var(--app-surface-bg, #fff); background: var(--app-primary-text, #333); }
.send { margin-top: 24rpx; background: var(--app-primary-text, #333); color: var(--app-surface-bg, #fff); font-size: 28rpx; }
.send[disabled] { opacity: .45; }
.section-title, .closed-tip { padding: 20rpx 0; }
.section-title { font-size: 26rpx; }
.hint { text-align: center; padding: 32rpx 0; }
.more, .add { background: var(--app-subtle-surface-bg, #eee); color: var(--app-primary-text, #333); }
</style>
