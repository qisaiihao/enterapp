<template>
    <view>
        <!-- 时间轴部分 -->
        <view class="timeline-container" v-if="timelinePosts.length > 0">
            <view class="timeline-title">创作时间轴</view>
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
                                v-for="(post, postIndex) in group"
                                :key="post._id"
                                class="timeline-post-item"
                                @tap="navigateToPostDetail(post._id)"
                            >
                                <!-- 日期显示在帖子上面，同一天只显示一次 -->
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

        <!-- 时间轴加载状态 -->
        <view class="timeline-loading" v-if="showLoading">
            <view class="timeline-loading-icon">⏳</view>
            <view class="timeline-loading-text">正在加载时间轴...</view>
        </view>

        <!-- 时间轴错误状态 -->
        <view class="timeline-error" v-if="showError">
            <view class="timeline-error-icon">⚠️</view>
            <view class="timeline-error-text">加载失败</view>
            <view class="timeline-error-subtext">请检查网络连接后重试</view>
            <view class="timeline-retry-btn" @tap="onRetry">重试</view>
        </view>

        <!-- 时间轴空状态 -->
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
        // 可选的标题配置
        title: {
            type: String,
            default: '创作时间轴'
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
        // 格式化月份标签
        formatMonthLabel(monthKey) {
            return formatMonthLabel(monthKey);
        },

        // 格式化日期标签
        formatDateLabel(dateKey) {
            return formatDateLabel(dateKey);
        },

        // 切换月份折叠状态
        toggleMonthCollapse(monthKey) {
            const newCollapsed = toggleMonthCollapse(this.collapsedMonths, monthKey);
            this.$emit('update:collapsed-months', newCollapsed);
        },

        // 导航到帖子详情
        navigateToPostDetail(postId) {
            this.$emit('navigate-to-post', postId);
        },

        // 重试加载
        onRetry() {
            this.$emit('retry');
        }
    }
};
</script>

<style scoped>
/* 时间轴样式 */
.timeline-container {
    margin: 30rpx;
    background: #fff;
    border-radius: 16rpx;
    box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.05);
    padding: 30rpx;
}

.timeline-title {
    font-size: 32rpx;
    font-weight: 600;
    color: #333;
    margin-bottom: 30rpx;
    text-align: center;
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
    background: #809076;
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
}

.timeline-month-marker {
    position: absolute;
    left: -45rpx;
    width: 20rpx;
    height: 4rpx;
    background: #809076;
}

.timeline-month-marker.first-month {
    height: 4rpx;
    width: 25rpx;
}

.timeline-month-label {
    font-size: 28rpx;
    font-weight: 600;
    color: #809076;
    flex-shrink: 0;
    cursor: pointer;
    -webkit-user-select: none;
    user-select: none;
}

.timeline-month-header {
    cursor: pointer;
}

.timeline-posts {
    margin-left: 10rpx;
}

.timeline-post-item {
    padding: 20rpx 0;
    border-bottom: 1rpx solid #f8f8f8;
    cursor: pointer;
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
    color: #999;
    margin-bottom: 10rpx;
}

.timeline-post-content {
    margin-left: 0;
}

.timeline-post-title {
    font-size: 28rpx;
    color: #333;
    line-height: 1.5;
    word-break: break-word;
}

/* 响应式适配 */
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

    .timeline-post-time {
        font-size: 22rpx;
    }
}

/* 时间轴空状态 */
.timeline-empty {
    margin: 30rpx;
    background: #fff;
    border-radius: 16rpx;
    box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.05);
    padding: 60rpx 30rpx;
    text-align: center;
}

.timeline-empty-icon {
    font-size: 80rpx;
    margin-bottom: 20rpx;
}

.timeline-empty-text {
    font-size: 28rpx;
    color: #666;
    margin-bottom: 10rpx;
}

.timeline-empty-subtext {
    font-size: 24rpx;
    color: #999;
    line-height: 1.4;
}

/* 时间轴加载状态 */
.timeline-loading {
    margin: 30rpx;
    background: #fff;
    border-radius: 16rpx;
    box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.05);
    padding: 60rpx 30rpx;
    text-align: center;
}

.timeline-loading-icon {
    font-size: 60rpx;
    margin-bottom: 20rpx;
    animation: rotate 2s linear infinite;
}

.timeline-loading-text {
    font-size: 28rpx;
    color: #666;
}

@keyframes rotate {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}

/* 时间轴错误状态 */
.timeline-error {
    margin: 30rpx;
    background: #fff;
    border-radius: 16rpx;
    box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.05);
    padding: 60rpx 30rpx;
    text-align: center;
}

.timeline-error-icon {
    font-size: 60rpx;
    margin-bottom: 20rpx;
}

.timeline-error-text {
    font-size: 28rpx;
    color: #ff6b6b;
    margin-bottom: 10rpx;
}

.timeline-error-subtext {
    font-size: 24rpx;
    color: #999;
    margin-bottom: 30rpx;
    line-height: 1.4;
}

.timeline-retry-btn {
    display: inline-block;
    padding: 20rpx 40rpx;
    background: #809076;
    color: #fff;
    border-radius: 8rpx;
    font-size: 26rpx;
    cursor: pointer;
    transition: background-color 0.2s ease;
}

.timeline-retry-btn:active {
    background-color: #6d7a64;
}
</style>