<template>
    <scroll-view 
        scroll-y="true" 
        class="feed-list-scroll" 
        @scroll="handleScroll"
        @touchstart="onTouchStart"
        @touchmove="onTouchMove"
        @touchend="onTouchEnd"
        refresher-enabled="true"
        :refresher-triggered="refresherTriggered"
        :refresher-threshold="90"
        refresher-background="#ffffff"
        refresher-default-style="black"
        refresher-background-style="#ffffff"
        @refresherrefresh="onRefresherRefresh"
    >
        <!-- 顶部筛选按钮插槽 -->
        <slot name="filter"></slot>

        <!-- 骨架屏 -->
        <view v-if="isLoading && posts.length === 0">
            <skeleton pageType="index" />
        </view>

        <!-- 空状态 -->
        <view v-else-if="posts.length === 0" class="empty-state">
            <view class="empty-icon">{{ emptyIcon }}</view>
            <view class="empty-text">{{ emptyText }}</view>
            <view class="empty-subtext">{{ emptySubtext }}</view>
        </view>

        <!-- 帖子列表 -->
        <view v-else :id="containerId">
            <post-item
                v-for="(item, index) in posts"
                :key="item._id || index"
                :item="item"
                :index="index"
                :swiper-height="swiperHeights[index]"
                :show-vote-section="true"
                :list-type="listType"
                @avatar-error="$emit('avatar-error', $event)"
                @avatar-load="$emit('avatar-load', $event)"
                @navigate-to-user="$emit('navigate-to-user', $event)"
                @preview-image="$emit('preview-image', $event)"
                @image-error="$emit('image-error', $event)"
                @image-load="$emit('image-load', $event)"
                @tag-click="$emit('tag-click', $event)"
                @vote="$emit('vote', $event)"
                @comment-click="$emit('comment-click', $event)"
                @like-icon-error="$emit('like-icon-error', $event)"
            />
        </view>

        <!-- 加载更多提示 -->
        <view v-if="isLoadingMore" class="loading-more">
            <text class="loading-text">加载中...</text>
        </view>

        <!-- 底部提示 -->
        <view v-if="!hasMore && posts.length > 0" class="end-tip">
            <text class="end-text">{{ endText }}</text>
        </view>
    </scroll-view>
</template>

<script>
import skeleton from '@/components/skeleton/skeleton';
import PostItem from '@/components/PostItem.vue';

export default {
    name: 'FeedList',
    components: {
        skeleton,
        PostItem
    },
    props: {
        // 帖子列表
        posts: {
            type: Array,
            default: () => []
        },
        // 加载中（首次加载，显示骨架屏）
        isLoading: {
            type: Boolean,
            default: false
        },
        // 加载更多中
        isLoadingMore: {
            type: Boolean,
            default: false
        },
        // 是否还有更多
        hasMore: {
            type: Boolean,
            default: true
        },
        // 下拉刷新状态
        refresherTriggered: {
            type: Boolean,
            default: false
        },
        // 列表类型，传递给 PostItem
        listType: {
            type: String,
            default: 'home'
        },
        // 空状态配置
        emptyIcon: {
            type: String,
            default: '📝'
        },
        emptyText: {
            type: String,
            default: '还没有帖子哦～'
        },
        emptySubtext: {
            type: String,
            default: '快来发布第一条帖子吧！'
        },
        // 底部提示文案
        endText: {
            type: String,
            default: '--- 我是有底线的 ---'
        },
        // 容器ID（用于滚动加载检测）
        containerId: {
            type: String,
            default: 'feed-list-container'
        },
        // swiper高度（从父组件传入）
        swiperHeights: {
            type: Object,
            default: () => ({})
        },
        // 预加载阈值（窗口高度的倍数）
        preloadThreshold: {
            type: Number,
            default: 2
        }
    },
    data() {
        return {
            scrollTimer: null,
            touchStartX: 0,
            touchStartY: 0,
            touchMoved: false
        };
    },
    methods: {
        // 下拉刷新
        onRefresherRefresh() {
            this.$emit('refresh');
        },

        // 滚动事件 - 检测是否需要加载更多
        handleScroll(e) {
            if (this.scrollTimer) {
                clearTimeout(this.scrollTimer);
            }
            this.scrollTimer = setTimeout(() => {
                this.checkLoadMore();
            }, 100);
        },

        // 检查是否需要加载更多
        checkLoadMore() {
            if (!this.hasMore || this.isLoading || this.isLoadingMore) {
                return;
            }

            try {
                const info = uni.getSystemInfoSync();
                const winH = info.windowHeight;

                uni.createSelectorQuery()
                    .in(this)
                    .select(`#${this.containerId}`)
                    .boundingClientRect((rect) => {
                        if (!rect || !rect.height) {
                            return;
                        }

                        const rectBottom = rect.top + rect.height;
                        let distanceToBottom = rectBottom - winH;

                        if (distanceToBottom < 0) {
                            distanceToBottom = 0;
                        }

                        const preloadThreshold = winH * this.preloadThreshold;

                        if (distanceToBottom < preloadThreshold) {
                            this.$emit('load-more');
                        }
                    })
                    .exec();
            } catch (err) {
                console.error('FeedList 滚动检测失败:', err);
            }
        },

        // 触摸事件（用于滚动状态检测）
        onTouchStart(e) {
            if (e.touches && e.touches.length > 0) {
                this.touchStartX = e.touches[0].clientX;
                this.touchStartY = e.touches[0].clientY;
            }
            this.touchMoved = false;
            this.$emit('touch-start', e);
        },

        onTouchMove(e) {
            this.touchMoved = true;
            this.$emit('touch-move', e);
        },

        onTouchEnd(e) {
            this.$emit('touch-end', e);
        }
    },
    beforeDestroy() {
        if (this.scrollTimer) {
            clearTimeout(this.scrollTimer);
            this.scrollTimer = null;
        }
    }
};
</script>

<style scoped>
.feed-list-scroll {
    height: 100%;
    width: 100%;
}

.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 100rpx 40rpx;
}

.empty-icon {
    font-size: 80rpx;
    margin-bottom: 20rpx;
}

.empty-text {
    font-size: 32rpx;
    color: #333;
    margin-bottom: 10rpx;
}

.empty-subtext {
    font-size: 26rpx;
    color: #999;
}

.loading-more {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 30rpx 0;
}

.loading-text {
    font-size: 26rpx;
    color: #999;
}

.end-tip {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 30rpx 0 60rpx;
}

.end-text {
    font-size: 24rpx;
    color: #ccc;
}
</style>
