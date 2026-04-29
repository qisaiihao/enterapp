<template>
    <scroll-view 
        :scroll-y="scrollEnabled" 
        class="feed-list-scroll" 
        @scroll="handleScroll"
        @touchstart="onTouchStart"
        @touchmove="onTouchMove"
        @touchend="onTouchEnd"
        :refresher-enabled="refresherEnabled"
        :refresher-triggered="refresherTriggered"
        :refresher-threshold="90"
        :refresher-background="appThemeMode === 'dark' ? '#0f1115' : '#ffffff'"
        :refresher-default-style="appThemeMode === 'dark' ? 'white' : 'black'"
        :refresher-background-style="appThemeMode === 'dark' ? '#0f1115' : '#ffffff'"
        @refresherrefresh="onRefresherRefresh"
    >
        <!-- 顶部筛选按钮插槽 -->
        <slot name="filter"></slot>

        <!-- 骨架屏：初次加载或正在加载且没有数据时显示 -->
        <view v-if="(isLoading && posts.length === 0) || (posts.length === 0 && !hasEverLoaded)">
            <skeleton pageType="index" />
        </view>

        <!-- 空状态：确认没有数据时才显示 -->
        <view v-else-if="posts.length === 0 && hasEverLoaded && !isLoading" class="empty-state">
            <view class="empty-icon">{{ emptyIcon }}</view>
            <view class="empty-text">{{ emptyText }}</view>
            <view class="empty-subtext">{{ emptySubtext }}</view>
        </view>

        <!-- 帖子列表 -->
        <view v-else :id="containerId">
            <post-item
                v-for="(item, index) in posts"
                :key="index"
                :item="item"
                :index="index"
                :swiper-height="swiperHeights[index]"
                :show-vote-section="true"
                :list-type="listType"
                :show-poem-author="showPoemAuthor"
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
import { getWindowInfoCompat } from '@/utils/system-info.js';

export default {
    name: 'FeedList',
    components: {
        skeleton,
        PostItem
    },
    emits: ['avatar-error', 'avatar-load', 'navigate-to-user', 'preview-image', 'image-error', 'image-load', 'tag-click', 'vote', 'comment-click', 'like-icon-error', 'refresh', 'load-more', 'touch-start', 'touch-move', 'touch-end'],
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
        },
        // 是否允许滚动（用于左右滑动时禁用上下滚动）
        scrollEnabled: {
            type: Boolean,
            default: true
        },
        // 是否允许下拉刷新（用于左右滑动时禁用）
        refresherEnabled: {
            type: Boolean,
            default: true
        },
        // 是否曾经加载过数据（用于区分初始状态和真正的空状态）
        hasEverLoaded: {
            type: Boolean,
            default: false
        },
        // 是否显示诗歌作者
        showPoemAuthor: {
            type: Boolean,
            default: true
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
    mounted() {
        console.log('📋 [FeedList] mounted');
        console.log('📋 [FeedList] posts:', this.posts);
        console.log('📋 [FeedList] posts.length:', this.posts?.length || 0);
        console.log('📋 [FeedList] isLoading:', this.isLoading);
        console.log('📋 [FeedList] hasEverLoaded:', this.hasEverLoaded);
        console.log('📋 [FeedList] listType:', this.listType);
    },
    watch: {
        posts: {
            handler(newVal) {
                console.log('📋 [FeedList] posts 变化:', newVal?.length || 0);
            },
            immediate: true
        }
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
                const info = getWindowInfoCompat();
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
    beforeUnmount() {
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
    background-color: var(--app-page-bg, #ffffff);
}

.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 100rpx 40rpx;
    animation: emptyFadeIn 0.5s ease;
}

@keyframes emptyFadeIn {
    from {
        opacity: 0;
        transform: scale(0.95);
    }
    to {
        opacity: 1;
        transform: scale(1);
    }
}

.empty-icon {
    animation: emptyIconBounce 2s ease-in-out infinite;
}

@keyframes emptyIconBounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-10rpx); }
}

.empty-icon {
    font-size: 80rpx;
    margin-bottom: 20rpx;
}

.empty-text {
    font-size: 32rpx;
    color: var(--app-primary-text, #333);
    margin-bottom: 10rpx;
}

.empty-subtext {
    font-size: 26rpx;
    color: var(--app-muted-text, #999);
}

.loading-more {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 30rpx 0;
    animation: loadingFadeIn 0.3s ease;
}

@keyframes loadingFadeIn {
    from { opacity: 0; transform: translateY(10rpx); }
    to { opacity: 1; transform: translateY(0); }
}

.loading-text {
    font-size: 26rpx;
    color: var(--app-muted-text, #999);
}

/* 加载点动画 */
.loading-more::before {
    content: '';
    width: 28rpx;
    height: 28rpx;
    border: 3rpx solid var(--app-border-color, #e0e0e0);
    border-top-color: var(--app-primary-text, #333);
    border-radius: 50%;
    margin-right: 16rpx;
    animation: loadingSpin 0.8s linear infinite;
}

@keyframes loadingSpin {
    to { transform: rotate(360deg); }
}

.end-tip {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 30rpx 0 60rpx;
}

.end-text {
    font-size: 24rpx;
    color: var(--app-muted-text, #ccc);
}
</style>
