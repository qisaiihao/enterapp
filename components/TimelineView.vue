<template>
    <view>
        <view class="timeline-container" v-if="timelinePosts.length > 0">
            <view class="timeline-heading">
                <view class="timeline-title">{{ title }}</view>
                <view
                    v-if="showExportButton && timelinePosts.length > 0"
                    class="timeline-export-btn"
                    @tap.stop="onExport"
                >
                    {{ exportButtonText }}
                </view>
            </view>

            <view class="timeline-wrapper">
                <view class="timeline-vertical-line"></view>
                <view class="timeline-content">
                    <view
                        v-for="(group, monthKey, index) in timelineGroups"
                        :key="monthKey"
                        class="timeline-month-group"
                    >
                        <view class="timeline-month-header" @tap="toggleMonthCollapse(monthKey)">
                            <view class="timeline-month-marker" :class="{ 'first-month': index === 0 }"></view>
                            <view class="timeline-month-label">
                                {{ formatMonthLabel(monthKey) }}
                            </view>
                        </view>

                        <view class="timeline-posts" v-if="!collapsedMonths[monthKey]">
                            <view
                                v-for="post in group"
                                :key="post._id"
                                class="timeline-post-item"
                                @tap="navigateToPostDetail(post._id)"
                            >
                                <view v-if="post.showDate" class="timeline-post-date">
                                    {{ formatDateLabel(post.dateStr) }}
                                </view>
                                <view class="timeline-post-content">
                                    <view class="timeline-post-title">{{ post.title }}</view>
                                </view>
                            </view>
                        </view>
                    </view>
                </view>
            </view>
        </view>

        <view class="timeline-loading" v-if="showLoading">
            <view class="timeline-loading-icon">⏳</view>
            <view class="timeline-loading-text">正在加载时间轴...</view>
        </view>

        <view class="timeline-error" v-if="showError">
            <view class="timeline-error-icon">⚠️</view>
            <view class="timeline-error-text">加载失败</view>
            <view class="timeline-error-subtext">请检查网络连接后重试</view>
            <view class="timeline-retry-btn" @tap="onRetry">重试</view>
        </view>

        <view class="timeline-empty" v-if="showEmpty">
            <view class="timeline-empty-icon">📝</view>
            <view class="timeline-empty-text">还没有发布原创诗歌</view>
            <view class="timeline-empty-subtext">发布原创诗歌后，这里会显示创作时间轴</view>
        </view>
    </view>
</template>

<script>
import { formatMonthLabel, formatDateLabel, toggleMonthCollapse } from '@/utils/timeline.js';

export default {
    name: 'TimelineView',
    emits: ['update:collapsed-months', 'navigate-to-post', 'retry', 'export'],
    props: {
        timelinePosts: {
            type: Array,
            default: () => []
        },
        timelineGroups: {
            type: Object,
            default: () => ({})
        },
        collapsedMonths: {
            type: Object,
            default: () => ({})
        },
        isLoading: {
            type: Boolean,
            default: false
        },
        hasError: {
            type: Boolean,
            default: false
        },
        title: {
            type: String,
            default: '创作时间轴'
        },
        showExportButton: {
            type: Boolean,
            default: false
        },
        exportButtonText: {
            type: String,
            default: '导出'
        }
    },
    computed: {
        showLoading() {
            return this.isLoading && this.timelinePosts.length === 0;
        },
        showError() {
            return this.hasError && !this.isLoading;
        },
        showEmpty() {
            return !this.isLoading && !this.hasError && this.timelinePosts.length === 0;
        }
    },
    methods: {
        formatMonthLabel(monthKey) {
            return formatMonthLabel(monthKey);
        },
        formatDateLabel(dateKey) {
            return formatDateLabel(dateKey);
        },
        toggleMonthCollapse(monthKey) {
            const newCollapsed = toggleMonthCollapse(this.collapsedMonths, monthKey);
            this.$emit('update:collapsed-months', newCollapsed);
        },
        navigateToPostDetail(postId) {
            this.$emit('navigate-to-post', postId);
        },
        onRetry() {
            this.$emit('retry');
        },
        onExport() {
            this.$emit('export');
        }
    }
};
</script>

<style scoped>
.timeline-container {
    margin: 30rpx;
    background: var(--app-surface-bg, #fff);
    border-radius: 16rpx;
    box-shadow: var(--app-surface-shadow, 0 4rpx 12rpx rgba(0, 0, 0, 0.05));
    border: var(--app-surface-border-line, none);
    padding: 30rpx;
}

.timeline-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20rpx;
    margin-bottom: 30rpx;
}

.timeline-title {
    font-size: 32rpx;
    font-weight: 600;
    color: var(--app-surface-title-color, #333);
    text-align: center;
    flex: 1;
}

.timeline-export-btn {
    flex-shrink: 0;
    padding: 10rpx 24rpx;
    border-radius: 999rpx;
    font-size: 24rpx;
    line-height: 1.2;
    color: #ffffff;
    background: var(--app-surface-accent-color, #809076);
}

.timeline-wrapper {
    position: relative;
    display: flex;
}

.timeline-vertical-line {
    position: absolute;
    left: 20rpx;
    top: 20rpx;
    bottom: 0;
    width: 4rpx;
    background: var(--app-surface-accent-color, #809076);
    z-index: 1;
}

.timeline-content {
    flex: 1;
    padding-left: 65rpx;
    padding-right: 20rpx;
    position: relative;
    z-index: 2;
}

.timeline-month-group {
    margin-bottom: 40rpx;
}

.timeline-month-group:last-child {
    margin-bottom: 0;
}

.timeline-month-header {
    display: flex;
    align-items: center;
    margin-bottom: 20rpx;
    position: relative;
    cursor: pointer;
}

.timeline-month-marker {
    position: absolute;
    left: -45rpx;
    width: 20rpx;
    height: 4rpx;
    background: var(--app-surface-accent-color, #809076);
}

.timeline-month-marker.first-month {
    height: 4rpx;
    width: 25rpx;
}

.timeline-month-label {
    font-size: 28rpx;
    font-weight: 600;
    color: var(--app-surface-accent-color, #809076);
    flex-shrink: 0;
    -webkit-user-select: none;
    user-select: none;
}

.timeline-posts {
    margin-left: 10rpx;
}

.timeline-post-item {
    padding: 20rpx 0;
    border-bottom: 1rpx solid var(--app-surface-divider, #f8f8f8);
    transition: background-color 0.2s ease;
    position: relative;
}

.timeline-post-item:last-child {
    border-bottom: none;
}

.timeline-post-item:active {
    background-color: #f8f8f8;
}

.timeline-post-date {
    font-size: 24rpx;
    color: var(--app-surface-meta-color, #999);
    margin-bottom: 10rpx;
}

.timeline-post-title {
    font-size: 28rpx;
    color: var(--app-surface-text-color, #333);
    line-height: 1.5;
    word-break: break-word;
}

@media (max-width: 750rpx) {
    .timeline-container {
        margin: 20rpx;
    }

    .timeline-title {
        font-size: 28rpx;
    }

    .timeline-month-label {
        font-size: 26rpx;
    }

    .timeline-post-title {
        font-size: 26rpx;
    }
}

.timeline-empty,
.timeline-loading,
.timeline-error {
    margin: 30rpx;
    background: var(--app-surface-bg, #fff);
    border-radius: 16rpx;
    box-shadow: var(--app-surface-shadow, 0 4rpx 12rpx rgba(0, 0, 0, 0.05));
    border: var(--app-surface-border-line, none);
    padding: 60rpx 30rpx;
    text-align: center;
}

.timeline-empty-icon {
    font-size: 80rpx;
    margin-bottom: 20rpx;
}

.timeline-empty-text,
.timeline-loading-text,
.timeline-error-text {
    font-size: 28rpx;
}

.timeline-empty-text,
.timeline-loading-text {
    color: var(--app-surface-text-color, #666);
}

.timeline-empty-subtext,
.timeline-error-subtext {
    font-size: 24rpx;
    color: var(--app-surface-meta-color, #999);
    line-height: 1.4;
}

.timeline-empty-subtext,
.timeline-error-subtext {
    margin-top: 10rpx;
}

.timeline-loading-icon,
.timeline-error-icon {
    font-size: 60rpx;
    margin-bottom: 20rpx;
}

.timeline-loading-icon {
    animation: rotate 2s linear infinite;
}

@keyframes rotate {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}

.timeline-error-text {
    color: #ff6b6b;
}

.timeline-retry-btn {
    display: inline-block;
    margin-top: 30rpx;
    padding: 20rpx 40rpx;
    background: var(--app-surface-accent-color, #809076);
    color: #fff;
    border-radius: 8rpx;
    font-size: 26rpx;
}

.timeline-retry-btn:active {
    background-color: var(--app-surface-accent-color, #6d7a64);
}
</style>
