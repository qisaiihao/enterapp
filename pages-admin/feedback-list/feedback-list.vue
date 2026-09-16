<template>
    <view class="feedback-container" :data-app-theme="appThemeMode" :style="appThemeVars">
        <view class="feedback-header">
            <text class="feedback-title">反馈建议</text>
        </view>

        <!-- 反馈列表 -->
        <view class="feedback-list" v-if="feedbackList.length > 0">
            <view class="feedback-item" v-for="(item, index) in feedbackList" :key="item._id">
                <view class="feedback-header-row">
                    <view class="user-info">
                        <text class="user-name">{{ item.userName || '匿名用户' }}</text>
                        <text class="feedback-time">{{ formatTime(item.createTime) }}</text>
                    </view>
                    <view class="status-badge" :class="item.isProcessed ? 'processed' : 'pending'">
                        {{ feedbackStatusLabel(item) }}
                    </view>
                </view>

                <view class="feedback-content">{{ item.content }}</view>
                <view v-if="item.lastReply" class="feedback-content">最新回复：{{ item.lastReply }}</view>

                <!-- 反馈图片 -->
                <view v-if="item.imageUrls && item.imageUrls.length > 0" class="feedback-images">
                    <image 
                        v-for="(img, imgIndex) in item.imageUrls" 
                        :key="imgIndex"
                        class="feedback-image"
                        :src="item.displayImages[imgIndex]"
                        mode="aspectFill"
                        @tap="previewImage"
                        :data-urls="item.displayImages"
                        :data-current="item.displayImages[imgIndex]"
                    />
                </view>

                <view class="feedback-actions">
                    <button 
                        class="action-btn process-btn" 
                        @tap="openDetail(item._id)"
                        :data-id="item._id"
                        :data-index="index"
                    >
                        查看与回复
                    </button>
                    <button 
                        class="action-btn delete-btn" 
                        @tap="confirmDelete" 
                        :data-id="item._id"
                        :data-index="index"
                    >
                        删除
                    </button>
                </view>
            </view>
        </view>

        <view v-else-if="loading" class="loading-tip">
            <text>加载中...</text>
        </view>

        <view v-else class="empty-tip">
            <text>暂无反馈</text>
        </view>

        <view v-if="!hasMore && feedbackList.length > 0" class="loading-footer">
            <text>--- 我是有底线的 ---</text>
        </view>
    </view>
    <app-overlay-host />
</template>

<script>
import { getFeedbackList, deleteFeedback } from '../../api-cache/feedback.js';
import { feedbackStatusLabel, feedbackDetailUrl } from '../../utils/feedback.js';
import fileUrlCache from '../../cache/core/file-url.js';

export default {
    data() {
        return {
            feedbackList: [],
            loading: false,
            skip: 0,
            limit: 20,
            hasMore: true
        };
    },
    onShow() {
        this.refreshFeedback();
    },
    onReachBottom() {
        if (this.hasMore && !this.loading) {
            this.loadFeedback();
        }
    },
    onPullDownRefresh() {
        this.refreshFeedback();
    },
    methods: {
        feedbackStatusLabel,
        openDetail(id) { uni.navigateTo({ url: feedbackDetailUrl(id) }); },
        refreshFeedback() {
            if (this.loading) { uni.stopPullDownRefresh(); return; }
            this.skip = 0;
            this.hasMore = true;
            return this.loadFeedback(() => uni.stopPullDownRefresh());
        },
        async loadFeedback(callback) {
            if (this.loading) return;
            
            this.loading = true;
            try {
                const result = await getFeedbackList({
                    skip: this.skip,
                    limit: this.limit,
                    context: this
                });
                const newFeedback = result.feedbackList || [];
                const imageMap = await fileUrlCache.getTempUrls(newFeedback.flatMap(item => item.imageUrls || []));
                newFeedback.forEach(item => { item.displayImages = (item.imageUrls || []).map(id => imageMap[id] || id); });
                this.feedbackList = this.skip === 0 ? newFeedback : [...this.feedbackList, ...newFeedback];
                this.skip += newFeedback.length;
                this.hasMore = newFeedback.length === this.limit;
            } catch (err) {
                console.error('加载反馈失败:', err);
                uni.showToast({
                    title: err.message || '加载失败',
                    icon: 'none'
                });
            } finally {
                this.loading = false;
                if (callback) callback();
            }
        },

        previewImage(e) {
            const urls = e.currentTarget.dataset.urls;
            const current = e.currentTarget.dataset.current;
            uni.previewImage({
                urls: urls,
                current: current
            });
        },

        confirmDelete(e) {
            const feedbackId = e.currentTarget.dataset.id;
            const index = e.currentTarget.dataset.index;

            uni.showModal({
                title: '确认删除',
                content: '确定要删除这条反馈吗？删除后无法恢复。',
                confirmText: '确认删除',
                cancelText: '取消',
                confirmColor: '#f56c6c',
                success: (res) => {
                    if (res.confirm) {
                        this.deleteFeedback(feedbackId, index);
                    }
                }
            });
        },

        async deleteFeedback(feedbackId, index) {
            uni.showLoading({ title: '删除中...' });

            try {
                await deleteFeedback(feedbackId, {
                    context: this
                });
                this.refreshFeedback();
                uni.showToast({
                    title: '删除成功',
                    icon: 'success'
                });
            } catch (err) {
                console.error('删除反馈失败:', err);
                uni.showToast({
                    title: err.message || '删除失败',
                    icon: 'none'
                });
            } finally {
                uni.hideLoading();
            }
        },

        formatTime(timestamp) {
            if (!timestamp) return '未知时间';
            const date = new Date(timestamp);
            const now = new Date();
            const diff = now - date;
            
            // 小于1分钟
            if (diff < 60000) {
                return '刚刚';
            }
            // 小于1小时
            if (diff < 3600000) {
                return `${Math.floor(diff / 60000)}分钟前`;
            }
            // 小于24小时
            if (diff < 86400000) {
                return `${Math.floor(diff / 3600000)}小时前`;
            }
            // 小于7天
            if (diff < 604800000) {
                return `${Math.floor(diff / 86400000)}天前`;
            }
            // 超过7天显示日期
            return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        }
    }
};
</script>

<style scoped>
.feedback-container {
    min-height: 100vh;
    background-color: #f5f5f5;
    padding: 20rpx;
}

.feedback-header {
    background: white;
    padding: 30rpx;
    margin-bottom: 20rpx;
    border-radius: 10rpx;
}

.feedback-title {
    font-size: 36rpx;
    font-weight: bold;
    color: #333;
}

.feedback-list {
    display: flex;
    flex-direction: column;
    gap: 20rpx;
}

.feedback-item {
    background: white;
    padding: 30rpx;
    border-radius: 10rpx;
}

.feedback-header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20rpx;
}

.user-info {
    display: flex;
    flex-direction: column;
    gap: 8rpx;
}

.user-name {
    font-size: 28rpx;
    font-weight: bold;
    color: #333;
}

.feedback-time {
    font-size: 24rpx;
    color: #999;
}

.status-badge {
    padding: 8rpx 16rpx;
    border-radius: 8rpx;
    font-size: 24rpx;
    color: white;
}

.status-badge.pending {
    background-color: #e6a23c;
}

.status-badge.processed {
    background-color: #67c23a;
}

.feedback-content {
    font-size: 28rpx;
    color: #666;
    line-height: 1.6;
    margin-bottom: 20rpx;
    white-space: pre-wrap;
}

.feedback-images {
    display: flex;
    flex-wrap: wrap;
    gap: 10rpx;
    margin-bottom: 20rpx;
}

.feedback-image {
    width: 200rpx;
    height: 200rpx;
    border-radius: 8rpx;
}

.feedback-actions {
    display: flex;
    gap: 20rpx;
}

.action-btn {
    flex: 1;
    height: 60rpx;
    line-height: 60rpx;
    font-size: 28rpx;
    border-radius: 8rpx;
    border: none;
}

.process-btn {
    background-color: #67c23a;
    color: white;
}

.delete-btn {
    background-color: #f56c6c;
    color: white;
}

.loading-tip, .empty-tip {
    text-align: center;
    padding: 60rpx;
    color: #999;
}

.loading-footer {
    text-align: center;
    padding: 40rpx;
    color: #999;
    font-size: 24rpx;
}
.feedback-container { background: var(--app-page-bg, #f5f5f5); color: var(--app-primary-text, #333); }
.feedback-header, .feedback-item { background: var(--app-surface-bg, #fff); }
.feedback-title, .user-name { color: var(--app-primary-text, #333); }
.feedback-content { color: var(--app-secondary-text, #666); }
</style>
