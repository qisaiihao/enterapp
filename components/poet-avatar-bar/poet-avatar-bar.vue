<template>
    <view class="avatar-bar-container">
        <scroll-view 
            class="avatar-scroll" 
            scroll-x 
            :scroll-left="scrollLeft"
            :show-scrollbar="false"
        >
            <view class="avatar-list">
                <!-- 返回按钮 -->
                <view class="avatar-item back-item" @tap="onBackClick">
                    <view class="avatar-wrapper back-wrapper">
                        <image class="back-icon" src="/static/images/newicons/back.png" mode="aspectFit" />
                    </view>
                    <text class="avatar-name">全部</text>
                </view>

                <!-- 诗人头像列表 -->
                <view 
                    v-for="poet in poets" 
                    :key="poet._id"
                    class="avatar-item"
                    :class="{ selected: selectedPoetName === poet.name }"
                    @tap="selectPoet(poet.name)"
                >
                    <view class="avatar-wrapper">
                        <image 
                            class="avatar-image" 
                            :src="poet.avatar || defaultAvatar"
                            mode="aspectFill"
                            lazy-load
                            @error="onAvatarError(poet)"
                        />
                    </view>
                    <text 
                        class="avatar-name" 
                        :class="{ 'name-selected': selectedPoetName === poet.name }"
                    >{{ formatName(poet.name) }}</text>
                </view>
            </view>
        </scroll-view>
    </view>
</template>

<script>
import { getPoetList, invalidatePoetList } from '@/api-cache/poet.js';

export default {
    name: 'PoetAvatarBar',
    emits: ['select'],
    props: {
        // 当前选中的诗人名字，null表示全部
        selectedPoetName: {
            type: String,
            default: null
        }
    },
    data() {
        return {
            poets: [],
            isLoading: false,
            scrollLeft: 0,
            defaultAvatar: '/static/images/avatar.png',
            lastClickedPoet: null,  // 记录上次点击的诗人
            clickTimer: null  // 点击计时器
        };
    },
    mounted() {
        this.loadPoets();
    },
    methods: {
        // 加载诗人列表
        async loadPoets(forceRefresh = false) {
            if (this.isLoading) return;
            
            this.isLoading = true;
            try {
                if (forceRefresh) {
                    invalidatePoetList();
                }
                const poets = await getPoetList({
                    limit: 50,
                    context: this,
                    onBackgroundUpdate: (newPoets) => {
                        if (Array.isArray(newPoets) && newPoets.length > 0) {
                            this.poets = newPoets;
                        }
                    }
                });
                this.poets = poets || [];
            } catch (error) {
                console.error('加载诗人列表失败:', error);
            } finally {
                this.isLoading = false;
            }
        },

        // 刷新诗人列表
        refresh() {
            this.loadPoets(true);
        },

        // 选中诗人
        selectPoet(poetName) {
            // 如果点击的是同一个诗人
            if (this.selectedPoetName === poetName) {
                // 第二次点击，进入诗人主页
                this.navigateToPoetProfile(poetName);
            } else {
                // 第一次点击，筛选该诗人的诗
                this.$emit('select', poetName);
            }
        },

        // 导航到诗人主页
        navigateToPoetProfile(poetName) {
            if (!poetName) return;
            
            // 跳转到诗人主页（使用 poetName 参数）
            uni.navigateTo({
                url: `/pages-user/poet-profile/poet-profile?poetName=${encodeURIComponent(poetName)}`
            });
        },

        // 点击返回（显示全部）
        onBackClick() {
            this.$emit('select', null);
        },

        // 格式化名字（超长截断）
        formatName(name) {
            if (!name) return '未知';
            return name.length > 4 ? name.slice(0, 4) + '…' : name;
        },

        // 头像加载错误
        onAvatarError(poet) {
            poet.avatar = this.defaultAvatar;
        }
    }
};
</script>

<style scoped>
.avatar-bar-container {
    background-color: var(--app-page-bg, #fff);
    padding: 20rpx 0 28rpx 0;
    margin-bottom: 24rpx;
    border-bottom: var(--app-surface-border-line, 1rpx solid #f0f0f0);
}

.avatar-scroll {
    width: 100%;
    white-space: nowrap;
}

/* 隐藏滚动条 - 使用与following-avatar-bar相同的方式 */
.avatar-scroll ::-webkit-scrollbar {
    display: none;
    width: 0;
    height: 0;
}

.avatar-scroll {
    scrollbar-width: none;
    -ms-overflow-style: none;
}

.avatar-list {
    display: inline-flex;
    padding: 0 20rpx 0 32rpx;
    gap: 36rpx;
}

.avatar-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100rpx;
    flex-shrink: 0;
}

.avatar-item.selected .avatar-wrapper {
    border: 3rpx solid var(--app-accent-color, #24375f);
}

.avatar-wrapper {
    width: 88rpx;
    height: 88rpx;
    border-radius: 50%;
    overflow: hidden;
    background-color: var(--app-subtle-surface-bg, #f5f5f5);
    display: flex;
    align-items: center;
    justify-content: center;
}

.back-wrapper {
    background-color: transparent;
}

.avatar-image {
    width: 100%;
    height: 100%;
}

.back-icon {
    width: 48rpx;
    height: 48rpx;
    opacity: 0.7;
    filter: var(--app-icon-filter, none);
}

.avatar-name {
    margin-top: 16rpx;
    font-size: 22rpx;
    color: var(--app-muted-text, #999);
    text-align: center;
    width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    transition: color 0.2s ease;
}

.avatar-name.name-selected {
    color: var(--app-primary-text, #333);
    font-weight: 500;
}
</style>
