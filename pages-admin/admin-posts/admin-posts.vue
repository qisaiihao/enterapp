<template>
    <view class="admin-container" :data-app-theme="appThemeMode" :style="appThemeVars">
        <view class="admin-header">
            <text class="admin-title">管理帖子</text>
        </view>

        <view class="type-filters">
            <view class="filter-option" :class="{ active: activePostType === 'all' }" @tap="selectPostType('all')">全部</view>
            <view v-for="type in postTypes" :key="type.value" class="filter-option" :class="{ active: activePostType === type.value }" @tap="selectPostType(type.value)">{{ type.label }}</view>
        </view>

        <!-- 帖子列表 -->
        <view class="posts-list" v-if="posts.length > 0">
            <view class="post-item" v-for="(post, index) in posts" :key="post._id">
                <view class="post-header" @tap="navigateToDetail" :data-id="post._id">
                    <text class="post-title">{{ post.title }}</text>
                    <view class="post-type-badge" :class="'type-' + (post.postType || 'normal')">
                        {{ getPostTypeText(post.postType || 'normal') }}
                    </view>
                </view>
                
                <view class="post-content" v-if="post.content" @tap="navigateToDetail" :data-id="post._id">{{ post.content }}</view>
                
                <view class="post-meta" @tap="navigateToDetail" :data-id="post._id">
                    <text class="post-author">作者: {{ post.authorName }}</text>
                    <text class="post-time">{{ formatTime(post.createTime) }}</text>
                </view>

                <view class="post-actions">
                    <button class="action-btn change-type-btn" @tap="showTypeSelector" :data-index="index">
                        更改类型
                    </button>
                    <button class="action-btn delete-btn" @tap="confirmDelete" :data-id="post._id" :data-index="index">
                        删除
                    </button>
                </view>
            </view>
        </view>

        <view v-else-if="loading" class="loading-tip">
            <text>加载中...</text>
        </view>

        <view v-else-if="!loadError" class="empty-tip">
            <text>{{ activePostType === 'all' ? '暂无帖子' : '该类型下暂无帖子' }}</text>
        </view>
        <view v-if="loadError" class="loading-tip" @tap="loadPosts(posts.length === 0)">{{ loadError }} · 点击重试</view>
        <view v-else-if="posts.length && loading" class="loading-tip">加载中...</view>
        <view v-else-if="posts.length && !hasMore" class="loading-tip">没有更多帖子了</view>

        <!-- 类型选择器弹窗 -->
        <view v-if="showTypePicker" class="modal-mask" @tap="hideTypeSelector">
            <view class="modal-content" @tap.stop>
                <view class="modal-title">选择帖子类型</view>
                <view class="current-type" v-if="selectedPostIndex !== null">
                    当前类型：{{ getPostTypeText(posts[selectedPostIndex].postType || 'normal') }}
                </view>
                <view class="type-options">
                    <view 
                        class="type-option" 
                        :class="selectedPostIndex !== null && posts[selectedPostIndex].postType === type.value ? 'current' : ''"
                        v-for="type in postTypes" 
                        :key="type.value"
                        @tap="changePostType"
                        :data-type="type.value"
                    >
                        {{ type.label }}
                        <text v-if="selectedPostIndex !== null && posts[selectedPostIndex].postType === type.value" class="current-mark">✓</text>
                    </view>
                </view>
                <button class="modal-cancel-btn" @tap="hideTypeSelector">取消</button>
            </view>
        </view>
    </view>
    <app-overlay-host />
</template>

<script>
import { listAdminPosts, updateAdminPostType, deleteAdminPost } from '../../api-cache/admin-manager.js';

export default {
    data() {
        return {
            posts: [],
            loading: false,
            page: 0,
            pageSize: 20,
            hasMore: true,
            activePostType: 'all',
            loadRequestId: 0,
            loadError: '',
            showTypePicker: false,
            selectedPostIndex: null,
            postTypes: [
                { label: '普通帖子', value: 'normal' },
                { label: '原创诗歌', value: 'original' },
                { label: '非原创诗歌', value: 'non-original' },
                { label: '讨论', value: 'discussion' }
            ]
        };
    },
    onLoad() {
        this.loadPosts();
    },
    onReachBottom() {
        if (this.hasMore && !this.loading) {
            this.loadPosts();
        }
    },
    onPullDownRefresh() {
        return this.loadPosts(true);
    },
    onUnload() {
        this.loadRequestId++;
    },
    methods: {
        selectPostType(type) {
            if (this.activePostType === type) return;
            this.activePostType = type;
            return this.loadPosts(true);
        },
        async loadPosts(reset = false) {
            if (this.loading && !reset) return;
            if (reset) {
                this.hideTypeSelector();
                this.posts = [];
                this.page = 0;
                this.hasMore = true;
            }
            const requestId = ++this.loadRequestId;
            const page = this.page;

            this.loading = true;
            this.loadError = '';
            try {
                const result = await listAdminPosts({
                    page,
                    pageSize: this.pageSize,
                    postType: this.activePostType,
                    context: this
                });
                if (requestId !== this.loadRequestId) return;
                const newPosts = result.posts || [];
                this.posts = page === 0 ? newPosts : [...this.posts, ...newPosts];
                this.page = page + 1;
                this.hasMore = typeof result.hasMore === 'boolean' ? result.hasMore : newPosts.length === this.pageSize;
            } catch (err) {
                if (requestId !== this.loadRequestId) return;
                this.loadError = err.message || '加载失败';
                console.error('加载帖子失败:', err);
                uni.showToast({
                    title: err.message || '加载失败',
                    icon: 'none'
                });
            } finally {
                if (requestId === this.loadRequestId) {
                    this.loading = false;
                    uni.stopPullDownRefresh();
                }
            }
        },
        
        navigateToDetail(e) {
            const postId = e.currentTarget.dataset.id;
            uni.navigateTo({
                url: `/pages/post-detail/post-detail?id=${postId}`
            });
        },
        
        showTypeSelector(e) {
            const index = e.currentTarget.dataset.index;
            this.selectedPostIndex = index;
            this.showTypePicker = true;
        },
        
        hideTypeSelector() {
            this.showTypePicker = false;
            this.selectedPostIndex = null;
        },
        
        async changePostType(e) {
            const newType = e.currentTarget.dataset.type;
            const post = this.posts[this.selectedPostIndex];
            if (!post) return;
            
            uni.showLoading({ title: '更新中...' });

            try {
                await updateAdminPostType({
                    postId: post._id,
                    postType: newType,
                    context: this
                });
                uni.showToast({
                    title: '更新成功',
                    icon: 'success'
                });
                this.hideTypeSelector();
                await this.loadPosts(true);
            } catch (err) {
                console.error('更新帖子类型失败:', err);
                uni.showToast({
                    title: err.message || '更新失败',
                    icon: 'none'
                });
            } finally {
                uni.hideLoading();
            }
        },
        
        confirmDelete(e) {
            const postId = e.currentTarget.dataset.id;
            const index = e.currentTarget.dataset.index;
            
            uni.showModal({
                title: '确认删除',
                content: '确定要删除这篇帖子吗？删除后无法恢复，相关的评论和收藏也会被删除。',
                confirmText: '确认删除',
                cancelText: '取消',
                confirmColor: '#f56c6c',
                success: (res) => {
                    if (res.confirm) {
                        this.deletePost(postId, index);
                    }
                }
            });
        },
        
        async deletePost(postId, index) {
            uni.showLoading({ title: '删除中...' });

            try {
                await deleteAdminPost({
                    postId,
                    context: this
                });
                await this.loadPosts(true);
                uni.showToast({
                    title: '删除成功',
                    icon: 'success'
                });
            } catch (err) {
                console.error('删除帖子失败:', err);
                uni.showToast({
                    title: err.message || '删除失败',
                    icon: 'none'
                });
            } finally {
                uni.hideLoading();
            }
        },
        
        getPostTypeText(type) {
            const typeMap = {
                'normal': '普通',
                'original': '原创',
                'non-original': '非原创',
                'discussion': '讨论'
            };
            return typeMap[type] || '普通';
        },
        
        formatTime(timestamp) {
            if (!timestamp) return '未知时间';
            const date = new Date(timestamp);
            return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        }
    }
};
</script>

<style scoped>
.type-filters { display: flex; flex-wrap: wrap; gap: 16rpx; margin-bottom: 24rpx; }
.filter-option { padding: 14rpx 22rpx; border-radius: 28rpx; font-size: 26rpx; background: var(--app-surface-bg, #fff); color: var(--app-secondary-text, #666); border: 1rpx solid var(--app-border-color, #ddd); }
.filter-option.active { background: var(--app-primary-text, #333); color: var(--app-surface-bg, #fff); border-color: var(--app-primary-text, #333); }
.admin-container {
    min-height: 100vh;
    background-color: #f5f5f5;
    padding: 20rpx;
}

.admin-header {
    background: white;
    padding: 30rpx;
    margin-bottom: 20rpx;
    border-radius: 10rpx;
}

.admin-title {
    font-size: 36rpx;
    font-weight: bold;
    color: #333;
}

.posts-list {
    display: flex;
    flex-direction: column;
    gap: 20rpx;
}

.post-item {
    background: white;
    padding: 30rpx;
    border-radius: 10rpx;
}

.post-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20rpx;
    cursor: pointer;
}

.post-title {
    font-size: 32rpx;
    font-weight: bold;
    color: #333;
    flex: 1;
}

.post-type-badge {
    padding: 8rpx 16rpx;
    border-radius: 8rpx;
    font-size: 24rpx;
    color: white;
}

.type-normal {
    background-color: #909399;
}

.type-original {
    background-color: #67c23a;
}

.type-non-original {
    background-color: #e6a23c;
}

.type-discussion {
    background-color: #409eff;
}

.post-content {
    font-size: 28rpx;
    color: #666;
    margin-bottom: 20rpx;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    cursor: pointer;
}

.post-meta {
    display: flex;
    justify-content: space-between;
    font-size: 24rpx;
    color: #999;
    margin-bottom: 20rpx;
    cursor: pointer;
}

.post-actions {
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

.change-type-btn {
    background-color: #409eff;
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

.modal-mask {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
}

.modal-content {
    background: white;
    width: 80%;
    border-radius: 20rpx;
    padding: 40rpx;
}

.modal-title {
    font-size: 32rpx;
    font-weight: bold;
    text-align: center;
    margin-bottom: 30rpx;
}

.current-type {
    text-align: center;
    font-size: 28rpx;
    color: #666;
    margin-bottom: 20rpx;
    padding: 15rpx;
    background-color: #f0f9ff;
    border-radius: 8rpx;
}

.type-options {
    display: flex;
    flex-direction: column;
    gap: 20rpx;
    margin-bottom: 30rpx;
}

.type-option {
    padding: 30rpx;
    background-color: #f5f5f5;
    border-radius: 10rpx;
    text-align: center;
    font-size: 28rpx;
    position: relative;
}

.type-option.current {
    background-color: #e6f7ff;
    border: 2rpx solid #409eff;
    color: #409eff;
    font-weight: bold;
}

.current-mark {
    position: absolute;
    right: 30rpx;
    top: 50%;
    transform: translateY(-50%);
    color: #409eff;
    font-size: 32rpx;
    font-weight: bold;
}

.modal-cancel-btn {
    width: 100%;
    height: 80rpx;
    line-height: 80rpx;
    background-color: #909399;
    color: white;
    border: none;
    border-radius: 10rpx;
}
</style>
