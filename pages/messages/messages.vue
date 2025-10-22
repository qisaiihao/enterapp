<template>
    <!-- pages/messages/messages.wxml -->
    <view class="container">
        <!-- 页面标题 -->
        <view class="page-header">
            <text class="page-title">消息通知</text>
            <view class="header-actions">
                <text v-if="unreadCount > 0" class="unread-count">{{ unreadCount }}条未读</text>
                <text class="clear-btn" @tap="clearAllMessages">清空</text>
            </view>
        </view>

        <!-- 消息类型标签 -->
        <view class="tab-container">
            <view :class="'tab-item ' + (activeTab === 'all' ? 'active' : '')" @tap="switchTab" data-tab="all">
                <text>全部</text>
                <view v-if="activeTab === 'all'" class="tab-indicator"></view>
            </view>
            <view :class="'tab-item ' + (activeTab === 'like' ? 'active' : '')" @tap="switchTab" data-tab="like">
                <text>点赞</text>
                <view v-if="activeTab === 'like'" class="tab-indicator"></view>
            </view>
            <view :class="'tab-item ' + (activeTab === 'comment' ? 'active' : '')" @tap="switchTab" data-tab="comment">
                <text>评论</text>
                <view v-if="activeTab === 'comment'" class="tab-indicator"></view>
            </view>
            <view :class="'tab-item ' + (activeTab === 'favorite' ? 'active' : '')" @tap="switchTab" data-tab="favorite">
                <text>收藏</text>
                <view v-if="activeTab === 'favorite'" class="tab-indicator"></view>
            </view>
            <view :class="'tab-item ' + (activeTab === 'feedback' ? 'active' : '')" @tap="switchTab" data-tab="feedback">
                <text>反馈</text>
                <view v-if="activeTab === 'feedback'" class="tab-indicator"></view>
            </view>
        </view>

        <!-- 消息列表 -->
        <scroll-view :scroll-y="true" class="message-list" @scrolltolower="onReachBottom" @scrolltoupper="onScrollToUpper">
            <view v-if="messages.length === 0 && !isLoading" class="empty-container">
                <image class="empty-icon" src="/static/images/icons/empty-message.svg" mode="aspectFit"></image>
                <text class="empty-text">暂无消息通知</text>
            </view>

            <view :class="'message-item ' + (!item.isRead ? 'unread' : '')" v-for="(item, index) in messages" :key="index">
                <!-- 消息内容 -->

                <view class="message-content" @tap="navigateToPost" :data-postid="item.postId">
                    <!-- 用户头像 -->
                    <image class="user-avatar" :src="item.fromUserAvatar || '/static/images/avatar.png'" mode="aspectFill"></image>

                    <!-- 消息主体 -->
                    <view class="message-body">
                        <!-- 消息类型图标和标题 -->
                        <view class="message-header">
                            <view class="message-type">
                                <text class="type-icon">
                                    {{
                                        item.type === 'like'
                                            ? '👍'
                                            : item.type === 'comment'
                                            ? '💬'
                                            : item.type === 'favorite'
                                            ? '⭐'
                                            : item.type === 'feedback'
                                            ? '📝'
                                            : item.type === 'feedback_processed'
                                            ? '✅'
                                            : '📢'
                                    }}
                                </text>
                                <text class="type-text">
                                    {{
                                        item.type === 'like'
                                            ? '点赞'
                                            : item.type === 'comment'
                                            ? '评论'
                                            : item.type === 'favorite'
                                            ? '收藏'
                                            : item.type === 'feedback'
                                            ? '反馈'
                                            : item.type === 'feedback_processed'
                                            ? '反馈处理'
                                            : '通知'
                                    }}
                                </text>
                            </view>
                        </view>

                        <!-- 消息文本（包含时间信息） -->
                        <text class="message-text">{{ item.content }}</text>

                        <!-- 相关帖子预览 -->
                        <view v-if="item.postTitle" class="post-preview">
                            <text class="post-title">{{ item.postTitle }}</text>
                        </view>
                    </view>
                </view>

                <!-- 删除按钮 -->

                <view class="delete-btn" @tap="deleteMessage" :data-messageid="item._id" :data-index="index">
                    <text>删除</text>
                </view>

                <!-- 未读标记 -->

                <view v-if="!item.isRead" class="unread-dot"></view>
            </view>


            <!-- 没有更多 -->
            <view v-if="!hasMore && messages.length > 0" class="no-more">
                <text>没有更多消息了</text>
            </view>
        </scroll-view>
    </view>
</template>

<script>
// pages/messages/messages.js
const app = getApp();
const { formatTimeAgo } = require('../../utils/time');
const { cloudCall } = require('../../utils/cloudCall.js');
const { invalidateUnread } = require('../../api-cache/unread.js');
export default {
    data() {
        return {
            messages: [],
            isLoading: false,
            hasMore: true,
            page: 0,
            PAGE_SIZE: 10,
            activeTab: 'all',
            // all, like, comment, favorite
            unreadCount: 0
        };
    },
    onLoad: function (options) {
        this.loadMessages();
    },
    onShow: function () {
        // 页面显示时刷新消息
        if (this.messages.length === 0) {
            this.loadMessages();
        } else {
            this.checkUnreadCount();
        }
        
        // 清除未读消息缓存，确保其他页面的小红点能及时更新
        invalidateUnread();
    },
    onPullDownRefresh: function () {
        this.setData({
            messages: [],
            page: 0,
            hasMore: true
        });
        this.loadMessages(() => {
            uni.stopPullDownRefresh();
        });
    },
    onReachBottom: function () {
        if (!this.hasMore || this.isLoading) {
            return;
        }
        this.loadMessages();
    },
    onScrollToUpper: function () {
        // 滚动到顶部时的处理，可以用于刷新
        console.log('滚动到顶部');
    },
    watch: {
        // 本页未读数更新时，广播给全局（驱动小红点即时消失）
        unreadCount(n) {
            try { const { emitUnreadChanged } = require('../../utils/events.js'); emitUnreadChanged({ count: typeof n === 'number' ? n : 0 }); } catch (_) {}
        }
    },
    methods: {
        // 统一云函数调用方法
        callCloudFunction(name, data = {}, extraOptions = {}) {
            return cloudCall(name, data, Object.assign({ pageTag: 'messages', context: this, requireAuth: true }, extraOptions));
        },

        // 切换消息类型标签
        switchTab: function (e) {
            const tab = e.currentTarget.dataset.tab;
            if (tab === this.activeTab) {
                return;
            }
            this.setData({
                activeTab: tab,
                messages: [],
                page: 0,
                hasMore: true
            });
            this.loadMessages();
        },

        // 加载消息列表
        loadMessages: function (callback) {
            if (this.isLoading) {
                return;
            }
            console.log('🔍 [消息页] 开始加载消息，页码:', this.page, '类型:', this.activeTab);
            this.setData({
                isLoading: true
            });
            const { page, PAGE_SIZE, activeTab } = this;
            this.callCloudFunction('getMessages', {
                skip: page * PAGE_SIZE,
                limit: PAGE_SIZE,
                type: activeTab === 'all' ? null : activeTab
            }).then((res) => {
                console.log('🔍 [消息页] 云函数返回结果:', res);
                    if (res.result && res.result.success) {
                        const newMessages = res.result.messages || [];
                        const totalCount = res.result.totalCount || 0;

                        // 格式化时间和消息内容
                        newMessages.forEach((msg) => {
                            if (msg.createTime) {
                                const timeAgo = formatTimeAgo(msg.createTime);
                                msg.formattedTime = timeAgo;

                                // 获取用户名称，如果没有则使用默认名称
                                const userName = msg.fromUserName || '某用户';
                                const originalContent = msg.content || '';

                                // 根据消息类型生成更详细的消息内容
                                if (msg.type === 'like') {
                                    msg.content = `${userName} ${timeAgo}点赞了你的帖子`;
                                } else if (msg.type === 'comment') {
                                    const isReply = originalContent.includes('回复了你的评论');
                                    const actionText = isReply ? '回复了你的评论' : '评论了你的帖子';
                                    msg.content = `${userName} ${timeAgo}${actionText}`;
                                } else if (msg.type === 'favorite') {
                                    msg.content = `${userName} ${timeAgo}收藏了你的帖子`;
                                } else if (msg.type === 'feedback') {
                                    msg.content = `${userName} ${timeAgo}提交了新的意见反馈`;
                                } else if (msg.type === 'feedback_processed') {
                                    msg.content = `管理员 ${timeAgo}处理了您的意见反馈`;
                                }
                            }
                        });
                        const allMessages = page === 0 ? newMessages : this.messages.concat(newMessages);
                        this.setData({
                            messages: allMessages,
                            page: page + 1,
                            hasMore: newMessages.length === PAGE_SIZE,
                            unreadCount: res.result.unreadCount || 0
                        });

                        // 标记已读
                        if (newMessages.length > 0) {
                            this.markMessagesAsRead(newMessages.filter((msg) => !msg.isRead).map((msg) => msg._id));
                        }
                    }
                }).catch((err) => {
                    console.error('获取消息失败:', err);
                    uni.showToast({
                        title: '获取消息失败',
                        icon: 'none'
                    });
                }).finally(() => {
                    this.setData({
                        isLoading: false
                    });
                    if (callback) {
                        callback();
                    }
                });
        },

        // 检查未读消息数量
        checkUnreadCount: function () {
            this.callCloudFunction('getUnreadMessageCount', {}).then((res) => {
                    if (res.result && res.result.success) {
                        this.setData({
                            unreadCount: res.result.count || 0
                        });
                    }
                }).catch((err) => {
                    console.error('获取未读消息数量失败:', err);
                });
        },

        // 标记消息为已读
        markMessagesAsRead: function (messageIds) {
            if (!messageIds || messageIds.length === 0) {
                return;
            }
            this.callCloudFunction('markMessagesAsRead', {
                messageIds
            }).then((res) => {
                    if (res.result && res.result.success) {
                        // 更新本地数据
                        const updatedMessages = this.messages.map((msg) => {
                            if (messageIds.includes(msg._id)) {
                                msg.isRead = true;
                            }
                            return msg;
                        });
                        const nextUnread = Math.max(0, this.unreadCount - messageIds.length);
                        this.setData({
                            messages: updatedMessages,
                            unreadCount: nextUnread
                        });
                        // 立即广播未读变化，确保顶部小红点立刻消失
                        try {
                            const { emitUnreadChanged } = require('../../utils/events.js');
                            emitUnreadChanged({ count: nextUnread });
                        } catch (_) {}
                        
                        // 清除未读消息缓存，让其他页面的小红点消失
                        invalidateUnread();
                        console.log('【messages】已清除未读消息缓存');
                    }
                }).catch((err) => {
                    console.error('标记消息为已读失败:', err);
                });
        },

        // 跳转到相关帖子
        navigateToPost: function (e) {
            const postId = e.currentTarget.dataset.postid;
            if (postId) {
                uni.navigateTo({
                    url: `/pages/post-detail/post-detail?id=${postId}`
                });
            }
        },

        // 删除单条消息
        deleteMessage: function (e) {
            const messageId = e.currentTarget.dataset.messageid;
            const index = e.currentTarget.dataset.index;
            uni.showModal({
                title: '确认删除',
                content: '确定要删除这条消息吗？',
                success: (res) => {
                    if (res.confirm) {
                        this.callCloudFunction('deleteMessage', {
                            messageId
                        }).then((res) => {
                                if (res.result && res.result.success) {
                                    const messages = this.messages.filter((msg, i) => i !== index);
                                    this.setData({
                                        messages
                                    });
                                    uni.showToast({
                                        title: '删除成功',
                                        icon: 'success'
                                    });
                                }
                            }).catch((err) => {
                                console.error('删除消息失败:', err);
                                uni.showToast({
                                    title: '删除失败',
                                    icon: 'none'
                                });
                            });
                        }
                    }
            });
        },

        // 清空所有消息
        clearAllMessages: function () {
            uni.showModal({
                title: '清空消息',
                content: '确定要清空所有消息吗？此操作不可恢复。',
                success: (res) => {
                    if (res.confirm) {
                        this.callCloudFunction('clearAllMessages', {}).then((res) => {
                                if (res.result && res.result.success) {
                                    this.setData({ messages: [], page: 0, hasMore: false, unreadCount: 0 });
                                    // 立即广播 0，确保顶部小红点立刻消失
                                    try {
                                        const { emitUnreadChanged } = require('../../utils/events.js');
                                        emitUnreadChanged({ count: 0 });
                                    } catch (_) {}
                                    
                                    // 清除未读消息缓存，让其他页面的小红点消失
                                    invalidateUnread();
                                    console.log('【messages】清空消息后已清除未读消息缓存');
                                    
                                    uni.showToast({
                                        title: '已清空',
                                        icon: 'success'
                                    });
                                }
                            }).catch((err) => {
                                console.error('清空消息失败:', err);
                                uni.showToast({
                                    title: '清空失败',
                                    icon: 'none'
                                });
                            });
                        }
                    }
            });
        }
    }
};
</script>
<style>
/* pages/messages/messages.wxss */
.container {
    min-height: 100vh;
    background-color: #f8f9fa;
}

/* 页面标题 */
.page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20rpx 30rpx;
    background-color: #fff;
    border-bottom: 1rpx solid #eee;
}

.page-title {
    font-size: 36rpx;
    font-weight: bold;
    color: #333;
}

.header-actions {
    display: flex;
    align-items: center;
    gap: 20rpx;
}

.unread-count {
    font-size: 24rpx;
    color: #ff6b6b;
    background-color: #ffe0e0;
    padding: 4rpx 12rpx;
    border-radius: 20rpx;
}

.clear-btn {
    font-size: 28rpx;
    color: #666;
    padding: 8rpx 16rpx;
}

/* 标签容器 */
.tab-container {
    display: flex;
    background-color: #fff;
    padding: 0 30rpx;
    border-bottom: 1rpx solid #eee;
}

.tab-item {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 30rpx 0;
    position: relative;
}

.tab-item text {
    font-size: 30rpx;
    color: #666;
    transition: color 0.3s;
}

.tab-item.active text {
    color: #9ed7ee;
    font-weight: 500;
}

.tab-indicator {
    position: absolute;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 60rpx;
    height: 4rpx;
    background-color: #9ed7ee;
    border-radius: 2rpx;
}

/* 消息列表 */
.message-list {
    height: calc(100vh - 200rpx);
    background-color: #f8f9fa;
}

/* 空状态 */
.empty-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 200rpx 0;
}

.empty-icon {
    width: 200rpx;
    height: 200rpx;
    margin-bottom: 30rpx;
    opacity: 0.5;
}

.empty-text {
    font-size: 30rpx;
    color: #999;
}

/* 消息项 */
.message-item {
    position: relative;
    background-color: #fff;
    margin: 20rpx 30rpx;
    border-radius: 16rpx;
    box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.1);
    overflow: hidden;
}

.message-item.unread {
    background-color: #f0f9ff;
    border-left: 6rpx solid #9ed7ee;
}

.message-content {
    display: flex;
    padding: 30rpx;
    gap: 20rpx;
}

.user-avatar {
    width: 80rpx;
    height: 80rpx;
    border-radius: 50%;
    flex-shrink: 0;
}

.message-body {
    flex: 1;
    min-width: 0;
}

.message-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10rpx;
}

.message-type {
    display: flex;
    align-items: center;
    gap: 8rpx;
}

.type-icon {
    font-size: 32rpx;
}

.type-text {
    font-size: 28rpx;
    color: #333;
    font-weight: 500;
}

.message-time {
    font-size: 24rpx;
    color: #999;
    flex-shrink: 0;
}

.message-text {
    font-size: 28rpx;
    color: #666;
    line-height: 1.5;
    margin-bottom: 16rpx;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

.post-preview {
    background-color: #f8f9fa;
    padding: 16rpx;
    border-radius: 8rpx;
    border-left: 4rpx solid #9ed7ee;
}

.post-title {
    font-size: 26rpx;
    color: #333;
    display: -webkit-box;
    -webkit-line-clamp: 1;
    line-clamp: 1;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

/* 时间信息样式 */
.time-info {
    margin: 12rpx 0;
    padding: 8rpx 12rpx;
    background-color: #f0f9ff;
    border-radius: 8rpx;
    border-left: 3rpx solid #9ed7ee;
}

.time-text {
    font-size: 24rpx;
    color: #9ed7ee;
    font-weight: 500;
}

.delete-btn {
    position: absolute;
    top: 20rpx;
    right: 20rpx;
    padding: 8rpx 16rpx;
    background-color: #f5f5f5;
    border-radius: 8rpx;
    font-size: 24rpx;
    color: #999;
}

.unread-dot {
    position: absolute;
    top: 20rpx;
    left: 20rpx;
    width: 16rpx;
    height: 16rpx;
    background-color: #ff6b6b;
    border-radius: 50%;
}

/* 加载更多 */
.loading-more,
.no-more {
    text-align: center;
    padding: 40rpx;
    font-size: 28rpx;
    color: #999;
}

/* 响应式设计 */
@media (max-width: 375px) {
    .message-content {
        padding: 24rpx;
    }

    .user-avatar {
        width: 70rpx;
        height: 70rpx;
    }

    .message-text {
        font-size: 26rpx;
    }
}
</style>
