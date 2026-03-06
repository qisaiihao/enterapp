<template>
    <view class="poet-container">
        <view class="poet-header">
            <text class="poet-title">管理诗人主页</text>
            <text class="poet-subtitle">删除错误创建的诗人主页</text>
        </view>

        <!-- 诗人列表 -->
        <view class="poet-list" v-if="poets.length > 0">
            <view class="poet-item" v-for="(poet, index) in poets" :key="poet._id">
                <view class="poet-info" @tap="navigateToPoetProfile" :data-name="poet.name">
                    <image 
                        class="poet-avatar" 
                        :src="poet.avatar || '/static/images/avatar.png'" 
                        mode="aspectFill"
                    />
                    <view class="poet-details">
                        <text class="poet-name">{{ poet.name }}</text>
                        <text class="poet-bio" v-if="poet.bio">{{ poet.bio }}</text>
                        <text class="poet-bio empty" v-else>暂无简介</text>
                        <view class="poet-meta">
                            <text class="poet-count">作品数：{{ poet.postCount || 0 }}</text>
                            <text class="poet-time">{{ formatTime(poet.updateTime) }}</text>
                        </view>
                    </view>
                </view>

                <view class="poet-actions">
                    <button class="action-btn view-btn" @tap="navigateToPoetProfile" :data-name="poet.name">
                        查看主页
                    </button>
                    <button class="action-btn delete-btn" @tap="confirmDelete" :data-id="poet._id" :data-name="poet.name" :data-index="index">
                        删除
                    </button>
                </view>
            </view>
        </view>

        <view v-else-if="loading" class="loading-tip">
            <text>加载中...</text>
        </view>

        <view v-else class="empty-tip">
            <text>暂无诗人</text>
        </view>

        <view v-if="!hasMore && poets.length > 0" class="loading-footer">
            <text>--- 我是有底线的 ---</text>
        </view>
    </view>
</template>

<script>
const { cloudCall } = require('../../utils/cloudCall.js');

export default {
    data() {
        return {
            poets: [],
            loading: false,
            offset: 0,
            limit: 20,
            hasMore: true
        };
    },
    onLoad() {
        this.loadPoets();
    },
    onReachBottom() {
        if (this.hasMore && !this.loading) {
            this.loadPoets();
        }
    },
    onPullDownRefresh() {
        this.poets = [];
        this.offset = 0;
        this.hasMore = true;
        this.loadPoets(() => {
            uni.stopPullDownRefresh();
        });
    },
    methods: {
        loadPoets(callback) {
            if (this.loading) return;
            
            this.loading = true;
            cloudCall('adminManager', {
                action: 'getPoetList',
                offset: this.offset,
                limit: this.limit
            }).then(res => {
                if (res.result && res.result.success) {
                    const newPoets = res.result.poets || [];
                    this.poets = [...this.poets, ...newPoets];
                    this.offset += newPoets.length;
                    this.hasMore = newPoets.length === this.limit;
                } else {
                    uni.showToast({
                        title: res.result?.error || '加载失败',
                        icon: 'none'
                    });
                }
            }).catch(err => {
                console.error('加载诗人列表失败:', err);
                uni.showToast({
                    title: '网络错误',
                    icon: 'none'
                });
            }).finally(() => {
                this.loading = false;
                if (callback) callback();
            });
        },

        navigateToPoetProfile(e) {
            const poetName = e.currentTarget.dataset.name;
            uni.navigateTo({
                url: `/pages-user/poet-profile/poet-profile?poetName=${encodeURIComponent(poetName)}`
            });
        },

        confirmDelete(e) {
            const poetId = e.currentTarget.dataset.id;
            const poetName = e.currentTarget.dataset.name;
            const index = e.currentTarget.dataset.index;

            uni.showModal({
                title: '确认删除',
                content: `确定要删除诗人"${poetName}"的主页吗？\n\n注意：\n1. 删除后无法恢复\n2. 该诗人的作品不会被删除\n3. 如果用户再次访问该诗人，系统会自动重新创建主页`,
                confirmText: '确认删除',
                cancelText: '取消',
                confirmColor: '#f56c6c',
                success: (res) => {
                    if (res.confirm) {
                        this.deletePoet(poetId, index);
                    }
                }
            });
        },

        deletePoet(poetId, index) {
            uni.showLoading({ title: '删除中...' });

            cloudCall('adminManager', {
                action: 'deletePoet',
                poetId: poetId
            }).then(res => {
                uni.hideLoading();
                if (res.result && res.result.success) {
                    this.poets.splice(index, 1);
                    uni.showToast({
                        title: '删除成功',
                        icon: 'success'
                    });
                } else {
                    uni.showToast({
                        title: res.result?.error || '删除失败',
                        icon: 'none'
                    });
                }
            }).catch(err => {
                uni.hideLoading();
                console.error('删除诗人失败:', err);
                uni.showToast({
                    title: '网络错误',
                    icon: 'none'
                });
            });
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
.poet-container {
    min-height: 100vh;
    background-color: #f5f5f5;
    padding: 20rpx;
}

.poet-header {
    background: white;
    padding: 30rpx;
    margin-bottom: 20rpx;
    border-radius: 10rpx;
}

.poet-title {
    font-size: 36rpx;
    font-weight: bold;
    color: #333;
    display: block;
    margin-bottom: 10rpx;
}

.poet-subtitle {
    font-size: 24rpx;
    color: #999;
}

.poet-list {
    display: flex;
    flex-direction: column;
    gap: 20rpx;
}

.poet-item {
    background: white;
    padding: 30rpx;
    border-radius: 10rpx;
}

.poet-info {
    display: flex;
    gap: 20rpx;
    margin-bottom: 20rpx;
    cursor: pointer;
}

.poet-avatar {
    width: 120rpx;
    height: 120rpx;
    border-radius: 50%;
    flex-shrink: 0;
}

.poet-details {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8rpx;
}

.poet-name {
    font-size: 32rpx;
    font-weight: bold;
    color: #333;
}

.poet-bio {
    font-size: 26rpx;
    color: #666;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
}

.poet-bio.empty {
    color: #999;
    font-style: italic;
}

.poet-meta {
    display: flex;
    gap: 20rpx;
    font-size: 24rpx;
    color: #999;
}

.poet-actions {
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

.view-btn {
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

.loading-footer {
    text-align: center;
    padding: 40rpx;
    color: #999;
    font-size: 24rpx;
}
</style>
