<template>
    <!-- pages/messages/messages.wxml -->
    <view class="container">
        <!-- 自定义返回按钮 -->
        <view class="custom-back-btn" @tap="goBack">
            <image class="back-icon" src="/static/images/back_to_edit.png" mode="aspectFit"></image>
        </view>

        <!-- 主要筛选区域 -->
        <view class="filter-section">
            <view class="filter-main">
                <view class="filter-left">
                    <view class="all-notifications-btn" :class="{ active: activeTab === 'all' }" @tap="switchTab" data-tab="all">
                        <text>全部通知</text>
                    </view>
                    <view class="filter-dropdown" @tap="showFilterOptions">
                        <text class="filter-icon">▼</text>
                    </view>
                </view>
                
                <!-- 筛选下拉菜单 -->
                <view class="filter-dropdown-menu" :class="{ 'filter-dropdown-menu-show': showFilterDropdown }">
                    <view class="filter-option" :class="{ active: contentFilter === 'all' }" @tap="setContentFilter" data-filter="all">
                        <text>全部内容</text>
                    </view>
                    <view class="filter-option" :class="{ active: contentFilter === 'post' }" @tap="setContentFilter" data-filter="post">
                        <text>只看帖子</text>
                    </view>
                    <view class="filter-option" :class="{ active: contentFilter === 'original' }" @tap="setContentFilter" data-filter="original">
                        <text>原创诗歌</text>
                    </view>
                    <view class="filter-option" :class="{ active: contentFilter === 'non-original' }" @tap="setContentFilter" data-filter="non-original">
                        <text>非原创</text>
                    </view>
                    <view class="filter-option" :class="{ active: contentFilter === 'discussion' }" @tap="setContentFilter" data-filter="discussion">
                        <text>讨论</text>
                    </view>
                </view>
                <view class="filter-right">
                    <view class="clear-btn" @tap="clearAllMessages">
                        <text>清空</text>
                    </view>
                    <view class="mark-all-read-btn" @tap="markAllAsRead">
                        <text>全部已读</text>
                    </view>
                </view>
            </view>
        </view>

        <!-- 消息类型标签 -->
        <view class="tab-container">
            <view :class="'tab-item ' + (activeTab === 'like' ? 'active' : '')" @tap="switchTab" data-tab="like">
                <text>点赞</text>
            </view>
            <view :class="'tab-item ' + (activeTab === 'comment' ? 'active' : '')" @tap="switchTab" data-tab="comment">
                <text>评论</text>
            </view>
            <view :class="'tab-item ' + (activeTab === 'favorite' ? 'active' : '')" @tap="switchTab" data-tab="favorite">
                <text>收藏</text>
            </view>
            <view :class="'tab-item ' + (activeTab === 'follow' ? 'active' : '')" @tap="switchTab" data-tab="follow">
                <text>关注</text>
            </view>
        </view>

        <!-- 消息列表 -->
        <scroll-view :scroll-y="true" class="message-list" @scrolltolower="handleScrollToLower" @scrolltoupper="onScrollToUpper">
            <view v-if="messages.length === 0 && !isLoading" class="empty-container">
                <image class="empty-icon" src="/static/images/icons/empty-message.svg" mode="aspectFit"></image>
                <text class="empty-text">暂无消息通知</text>
            </view>

            <view class="message-item-wrapper" v-for="(item, index) in messages" :key="index">
                <!-- 左滑操作按钮 -->
                <view class="swipe-actions" :class="{ 'swipe-actions-show': item.isSwipeOpen }">
                    <view class="action-btn mark-read-btn" @tap.stop="markMessageAsRead" :data-index="index">
                        <text>已读</text>
                    </view>
                    <view class="action-btn delete-btn" @tap.stop="deleteMessage" :data-messageid="item._id" :data-index="index">
                        <text>删除</text>
                    </view>
                </view>
                
                <!-- 消息内容 -->
                <view :class="'message-item ' + (!item.isRead ? 'unread' : '') + (item.isSwipeOpen ? ' swipe-open' : '')" 
                      @tap="handleMessageTap" 
                      @longpress="onMessageLongPress"
                      @touchstart="onTouchStart" 
                      @touchmove="onTouchMove" 
                      @touchend="onTouchEnd"
                      :data-index="index">
                    <!-- 用户头像 -->
                    <image class="user-avatar"
                           :src="item.fromUserAvatar || '/static/images/avatar.png'"
                           mode="aspectFill"
                           @tap.stop.prevent="navigateToUserProfile"
                           :data-user-id="item.fromUserId" />

                    <!-- 消息主体 -->
                    <view class="message-body">
                        <!-- 发送者和动作 -->
                        <view class="message-header">
                            <text class="sender-name">{{ item.fromUserName || '某用户' }}</text>
                            <text class="action-text">{{ getActionText(item.type) }}</text>
                            <!-- 关注按钮（仅关注类型显示，放在时间左边） -->
                            <view v-if="item.type === 'follow'" class="follow-btn" @tap.stop="followBack" :data-user-id="item.fromUserId" :data-index="index">
                                <text>{{ item.isMutual ? '已互关' : '回关' }}</text>
                            </view>
                            <text class="message-time">{{ item.formattedTime || '刚刚' }}</text>
                        </view>

                        <!-- 内容预览 -->
                        <view v-if="(item.postTitle || item.content) && item.type !== 'follow'" class="content-preview">
                            <text class="preview-text">{{ item.postTitle || item.content || '标题' }}</text>
                        </view>
                    </view>

                    <!-- 未读标记 -->
                    <view v-if="!item.isRead" class="unread-dot"></view>
                </view>
            </view>


            <!-- 没有更多 -->
            <view v-if="!hasMore && messages.length > 0" class="no-more">
                <text>没有更多消息了</text>
            </view>
        </scroll-view>

        <!-- 底部操作栏 -->
        <view v-if="selectedMessages.length > 0" class="bottom-action-bar">
            <view class="action-info">
                <text class="selected-time">{{ getSelectedTime() }}</text>
                <view class="selected-content">
                    <text>{{ getSelectedContent() }}</text>
                </view>
            </view>
            <view class="action-buttons">
                <view class="mark-read-btn" @tap="markSelectedAsRead">
                    <text>已读</text>
                </view>
                <view class="delete-selected-btn" @tap="deleteSelectedMessages">
                    <text>删除</text>
                </view>
            </view>
        </view>
    </view>
</template>

<script>
// pages/messages/messages.js
const app = getApp();
const { formatTimeAgo } = require('../../utils/time');
const { cloudCall } = require('../../utils/cloudCall.js');
const { invalidateUnread } = require('../../api-cache/unread.js');
const fileUrlCache = require('../../_utils/file-url-cache.js').default;
export default {
    data() {
        return {
            messages: [],
            isLoading: false,
            hasMore: true,
            page: 0,
            PAGE_SIZE: 10,
            activeTab: 'all',
            // all, like, comment, favorite, follow
            unreadCount: 0,
            selectedMessages: [],
            showFilterDropdown: false,
            // 内容筛选
            contentFilter: 'all', // all, post, original, non-original, discussion
            // 触摸相关数据
            touchStartX: 0,
            touchStartY: 0,
            touchCurrentX: 0,
            touchCurrentY: 0,
            isSwipeMode: false,
            justLongPressed: false,
            longPressGuardTimer: null,
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
    onUnload: function () {
        if (this.longPressGuardTimer) {
            clearTimeout(this.longPressGuardTimer);
            this.longPressGuardTimer = null;
        }
        this.justLongPressed = false;
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
    watch: {
        // 本页未读数更新时，广播给全局（驱动小红点即时消失）
        unreadCount(n) {
            try { const { emitUnreadChanged } = require('../../utils/events.js'); emitUnreadChanged({ count: typeof n === 'number' ? n : 0 }); } catch (_) {}
        }
    },
    methods: {
        // 返回上一页
        goBack() {
            try {
                const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [];

                if (pages && pages.length > 1) {
                    uni.navigateBack({
                        delta: 1,
                        fail: () => {
                            uni.switchTab({ url: '/pages/index/index' });
                        }
                    });
                } else {
                    uni.switchTab({ url: '/pages/index/index' });
                }
            } catch (err) {
                uni.switchTab({ url: '/pages/index/index' });
            }
        },

        // 统一云函数调用方法
        callCloudFunction(name, data = {}, extraOptions = {}) {
            return cloudCall(name, data, Object.assign({ pageTag: 'messages', context: this, requireAuth: true }, extraOptions));
        },

        // 触摸开始
        onTouchStart(e) {
            const touch = e.touches[0];
            this.touchStartX = touch.pageX || touch.clientX;
            this.touchStartY = touch.pageY || touch.clientY;
            this.touchCurrentX = touch.pageX || touch.clientX;
            this.touchCurrentY = touch.pageY || touch.clientY;
            this.isSwipeMode = false;
            console.log('触摸开始:', this.touchStartX, this.touchStartY);
        },

        // 触摸移动
        onTouchMove(e) {
            const touch = e.touches[0];
            this.touchCurrentX = touch.pageX || touch.clientX;
            this.touchCurrentY = touch.pageY || touch.clientY;
            
            const deltaX = this.touchCurrentX - this.touchStartX;
            const deltaY = Math.abs(this.touchCurrentY - this.touchStartY);
            
            console.log('触摸移动:', deltaX, deltaY);
            
            // 如果水平滑动距离大于垂直滑动距离，且向左滑动超过20px，则进入滑动模式
            if (Math.abs(deltaX) > deltaY && deltaX < -20) {
                this.isSwipeMode = true;
                e.preventDefault();
            }
        },

        // 触摸结束
        onTouchEnd(e) {
            const deltaX = this.touchCurrentX - this.touchStartX;
            const deltaY = Math.abs(this.touchCurrentY - this.touchStartY);
            
            console.log('触摸结束:', deltaX, deltaY);
            
            // 如果水平滑动距离大于垂直滑动距离
            if (Math.abs(deltaX) > deltaY) {
                if (deltaX < -30) {
                    // 向左滑动超过30px，显示操作按钮
                    const index = parseInt(e.currentTarget.dataset.index);
                    console.log('显示滑动操作:', index);
                    this.openSwipeActions(index);
                } else {
                    // 滑动距离不够，关闭所有滑动操作
                    this.closeAllSwipeActions();
                }
            }
        },

        // 打开滑动操作
        openSwipeActions(index) {
            const updatedMessages = this.messages.map((msg, i) => {
                if (i === index) {
                    return { ...msg, isSwipeOpen: true };
                } else {
                    return { ...msg, isSwipeOpen: false };
                }
            });
            this.messages = updatedMessages;
            console.log('打开滑动操作:', index, this.messages[index]);
        },

        // 关闭所有滑动操作
        closeAllSwipeActions() {
            const updatedMessages = this.messages.map(msg => ({
                ...msg,
                isSwipeOpen: false
            }));
            this.messages = updatedMessages;
            console.log('关闭所有滑动操作');
        },

        onMessageLongPress: function (e) {
            if (this.longPressGuardTimer) {
                clearTimeout(this.longPressGuardTimer);
                this.longPressGuardTimer = null;
            }

            this.justLongPressed = true;
            this.longPressGuardTimer = setTimeout(() => {
                this.justLongPressed = false;
                this.longPressGuardTimer = null;
            }, 200);

            this.selectMessage(e);
        },

        handleMessageTap: function (e) {
            if (this.justLongPressed) {
                return;
            }
            const rawIndex = e && e.currentTarget && e.currentTarget.dataset ? e.currentTarget.dataset.index : undefined;
            const index = typeof rawIndex === 'number' ? rawIndex : parseInt(rawIndex, 10);
            if (Number.isNaN(index)) {
                return;
            }

            if (this.isSwipeMode) {
                this.isSwipeMode = false;
                return;
            }

            if (this.selectedMessages.length > 0) {
                this.selectMessage(index);
                return;
            }

            this.closeAllSwipeActions();

            const message = this.messages[index];
            if (!message) {
                return;
            }

            if (message._id && !message.isRead) {
                this.markMessagesAsRead([message._id]);
            }

            if (message.postId) {
                this.navigateToPost(message.postId);
                return;
            }

            if (message.type === 'follow' && message.fromUserId) {
                this.navigateToUserProfile(message.fromUserId);
                return;
            }

            uni.showToast({
                title: '暂未找到可跳转的内容',
                icon: 'none'
            });
        },

        // 标记消息为已读
        markMessageAsRead(e) {
            const index = parseInt(e.currentTarget.dataset.index);
            const message = this.messages[index];
            if (message && !message.isRead) {
                this.markMessagesAsRead([message._id]);
                // 关闭滑动操作
                this.closeAllSwipeActions();
            }
        },

        // 滚动到顶部刷新
        onScrollToUpper() {
            console.log('🔍 [消息页] 滚动到顶部，刷新消息');
            this.setData({
                messages: [],
                page: 0,
                hasMore: true
            });
            this.loadMessages();
        },

        // 转换cloud://URL为可访问的URL
        async convertCloudUrl(cloudUrl) {
            if (!cloudUrl || !cloudUrl.startsWith('cloud://')) {
                return cloudUrl;
            }
            
            try {
                console.log('转换cloud://URL:', cloudUrl);
                // 使用fileUrlCache工具进行URL转换
                const convertedUrl = await fileUrlCache.getTempUrl(cloudUrl);
                console.log('成功转换URL:', convertedUrl);
                return convertedUrl;
            } catch (error) {
                console.error('转换cloud://URL失败:', error);
                // 转换失败时返回默认头像
                return '/static/images/avatar.png';
            }
        },

        // 滚动到底部加载更多
        handleScrollToLower() {
            console.log('🔍 [消息页] 滚动到底部，加载更多消息');
            if (this.hasMore && !this.isLoading) {
                this.loadMessages();
            }
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
            const { page, PAGE_SIZE, activeTab, contentFilter } = this;
            this.callCloudFunction('getMessages', {
                skip: page * PAGE_SIZE,
                limit: PAGE_SIZE,
                type: activeTab === 'all' ? null : activeTab,
                contentFilter: contentFilter === 'all' ? null : contentFilter
            }).then((res) => {
                console.log('🔍 [消息页] 云函数返回结果:', res);
                    if (res.result && res.result.success) {
                        const newMessages = res.result.messages || [];
                        const totalCount = res.result.totalCount || 0;

                        // 批量转换头像URL - 处理cloud://协议
                        const avatarUrls = newMessages
                            .filter(msg => msg.fromUserAvatar && msg.fromUserAvatar.startsWith('cloud://'))
                            .map(msg => msg.fromUserAvatar);

                        if (avatarUrls.length > 0) {
                            fileUrlCache.getTempUrls(avatarUrls)
                                .then(convertedUrls => {
                                    newMessages.forEach((msg) => {
                                        if (msg.fromUserAvatar && msg.fromUserAvatar.startsWith('cloud://')) {
                                            const convertedUrl = convertedUrls[msg.fromUserAvatar];
                                            if (convertedUrl) {
                                                msg.fromUserAvatar = convertedUrl;
                                            } else {
                                                msg.fromUserAvatar = '/static/images/avatar.png';
                                            }
                                        }
                                    });

                                    // 继续处理消息
                                    this.processMessagesAfterAvatarConversion(newMessages, page, PAGE_SIZE, res, callback);
                                })
                                .catch(error => {
                                    console.error('批量转换头像URL失败:', error);
                                    // 转换失败时使用默认头像
                                    newMessages.forEach((msg) => {
                                        if (msg.fromUserAvatar && msg.fromUserAvatar.startsWith('cloud://')) {
                                            msg.fromUserAvatar = '/static/images/avatar.png';
                                        }
                                    });

                                    // 继续处理消息
                                    this.processMessagesAfterAvatarConversion(newMessages, page, PAGE_SIZE, res, callback);
                                });
                        } else {
                            // 没有需要转换的头像，直接处理消息
                            this.processMessagesAfterAvatarConversion(newMessages, page, PAGE_SIZE, res, callback);
                        }
                    }
                }).catch((err) => {
                    console.error('获取消息失败:', err);
                    // 根据错误类型显示不同的提示
                    let errorMessage = '获取消息失败';
                    if (err && err.message) {
                        if (err.message.includes('网络')) {
                            errorMessage = '网络连接失败，请检查网络';
                        } else if (err.message.includes('权限')) {
                            errorMessage = '权限不足，请重新登录';
                        } else if (err.message.includes('超时')) {
                            errorMessage = '请求超时，请重试';
                        }
                    }
                    uni.showToast({
                        title: errorMessage,
                        icon: 'none',
                        duration: 3000
                    });
                }).catch((err) => {
                    console.error('获取消息失败:', err);
                    // 根据错误类型显示不同的提示
                    let errorMessage = '获取消息失败';
                    if (err && err.message) {
                        if (err.message.includes('网络')) {
                            errorMessage = '网络连接失败，请检查网络';
                        } else if (err.message.includes('权限')) {
                            errorMessage = '权限不足，请重新登录';
                        } else if (err.message.includes('超时')) {
                            errorMessage = '请求超时，请重试';
                        }
                    }
                    uni.showToast({
                        title: errorMessage,
                        icon: 'none',
                        duration: 3000
                    });

                    // 错误情况下也要完成加载状态
                    this.setData({
                        isLoading: false
                    });
                    if (callback) {
                        callback();
                    }
                });
        },

        // 处理消息（格式化时间、内容等）
        processMessagesAfterAvatarConversion: function (newMessages, page, PAGE_SIZE, res, callback) {
            // 格式化时间和消息内容
            newMessages.forEach((msg) => {
                if (msg.createTime) {
                    const timeAgo = formatTimeAgo(msg.createTime);
                    msg.formattedTime = timeAgo;

                    // 获取用户名称，如果没有则使用默认名称
                    const userName = msg.fromUserName || '某用户';
                    const originalContent = msg.content || '';

                    // 根据消息类型和内容类型生成更详细的消息内容
                    let contentType = msg.contentType;
                    
                    // 如果没有contentType，尝试从现有内容推断
                    if (!contentType) {
                        if (msg.content && msg.content.includes('诗')) {
                            contentType = 'original'; // 默认为原创诗歌
                        } else {
                            contentType = 'post'; // 默认为帖子
                        }
                    }
                    
                    let contentTypeText = '';
                    
                    // 根据内容类型确定文本
                    if (contentType === 'original') {
                        contentTypeText = '原创诗歌';
                    } else if (contentType === 'non-original') {
                        contentTypeText = '转载诗歌';
                    } else if (contentType === 'discussion') {
                        contentTypeText = '讨论';
                    } else {
                        contentTypeText = '帖子';
                    }
                    
                    if (msg.type === 'like') {
                        msg.content = `${userName} ${timeAgo}点赞了你的${contentTypeText}`;
                    } else if (msg.type === 'comment') {
                        const isReply = originalContent.includes('回复了你的评论');
                        const actionText = isReply ? '回复了你的评论' : `评论了你的${contentTypeText}`;
                        msg.content = `${userName} ${timeAgo}${actionText}`;
                    } else if (msg.type === 'favorite') {
                        msg.content = `${userName} ${timeAgo}收藏了你的${contentTypeText}`;
                    } else if (msg.type === 'feedback') {
                        msg.content = `${userName} ${timeAgo}提交了新的意见反馈`;
                    } else if (msg.type === 'feedback_processed') {
                        msg.content = `管理员 ${timeAgo}处理了您的意见反馈`;
                    } else if (msg.type === 'follow') {
                        msg.content = `${userName} ${timeAgo}关注了你`;
                        // 对于关注消息，需要检查是否已经互相关注
                        msg.isMutual = false; // 默认值，后续会通过API检查
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

            // 检查关注消息的互相关注状态
            this.checkFollowStatus(allMessages);

            // 标记已读
            if (newMessages.length > 0) {
                this.markMessagesAsRead(newMessages.filter((msg) => !msg.isRead).map((msg) => msg._id));
            }

            // 完成加载
            this.setData({
                isLoading: false
            });
            if (callback) {
                callback();
            }
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
        navigateToPost: function (payload) {
            let postId = '';
            if (typeof payload === 'string') {
                postId = payload;
            } else if (payload && typeof payload === 'object') {
                if (payload.postId) {
                    postId = payload.postId;
                } else if (payload.currentTarget && payload.currentTarget.dataset) {
                    const dataset = payload.currentTarget.dataset;
                    postId = dataset.postId || dataset.postid;
                }
            }

            if (!postId) {
                console.warn('[messages] navigateToPost called without valid postId', payload);
                return;
            }

            uni.navigateTo({
                url: `/pages/post-detail/post-detail?id=${postId}`
            });
        },

        // 跳转到发送者的个人主页
        navigateToUserProfile: function (payload) {
            try {
                let userId = '';
                if (typeof payload === 'string') {
                    userId = payload;
                } else if (payload && typeof payload === 'object') {
                    if (payload.userId) {
                        userId = payload.userId;
                    } else if (payload.currentTarget && payload.currentTarget.dataset) {
                        const dataset = payload.currentTarget.dataset;
                        userId = dataset.userId || dataset.userid;
                    }
                }

                if (!userId) {
                    uni.showToast({ title: '用户ID缺失', icon: 'none' });
                    return;
                }
                uni.navigateTo({ url: `/pages/user-profile/user-profile?userId=${encodeURIComponent(userId)}` });
            } catch (err) {
                console.error('[messages] navigateToUserProfile failed:', err);
                uni.showToast({ title: '跳转失败', icon: 'none' });
            }
        },

        // 删除单条消息
        deleteMessage: function (e) {
            const messageId = e.currentTarget.dataset.messageid;
            const index = e.currentTarget.dataset.index;
            console.log('删除消息:', messageId, index);
            uni.showModal({
                title: '确认删除',
                content: '确定要删除这条消息吗？',
                success: (res) => {
                    if (res.confirm) {
                        console.log('开始删除消息:', messageId);
                        this.callCloudFunction('deleteMessage', {
                            messageId
                        }).then((res) => {
                                console.log('删除消息云函数返回:', res);
                                if (res.result && res.result.success) {
                                    const messages = this.messages.filter((msg, i) => i !== index);
                                    this.messages = messages;
                                    // 关闭滑动操作
                                    this.closeAllSwipeActions();
                                    uni.showToast({
                                        title: '删除成功',
                                        icon: 'success'
                                    });
                                } else {
                                    console.error('删除失败，云函数返回:', res);
                                    uni.showToast({
                                        title: '删除失败',
                                        icon: 'none'
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
        },


        // 显示筛选选项
        showFilterOptions: function () {
            this.showFilterDropdown = !this.showFilterDropdown;
        },

        // 设置内容筛选
        setContentFilter: function (e) {
            const filter = e.currentTarget.dataset.filter;
            this.contentFilter = filter;
            this.showFilterDropdown = false;
            
            // 重新加载消息
            this.setData({
                messages: [],
                page: 0,
                hasMore: true
            });
            this.loadMessages();
        },

        // 标记全部为已读
        markAllAsRead: function () {
            const unreadMessages = this.messages.filter(msg => !msg.isRead);
            if (unreadMessages.length === 0) {
                uni.showToast({
                    title: '没有未读消息',
                    icon: 'none'
                });
                return;
            }
            
            const messageIds = unreadMessages.map(msg => msg._id);
            this.markMessagesAsRead(messageIds);
        },

        // 获取动作文本
        getActionText: function (type) {
            const actionMap = {
                'like': '点赞了你的帖子',
                'comment': '评论了你的诗',
                'favorite': '收藏了你的诗',
                'follow': '关注了你'
            };
            return actionMap[type] || '通知了你';
        },

        // 选择消息（长按进入选择模式）
        selectMessage: function (payload) {
            this.closeAllSwipeActions();

            const rawIndex = typeof payload === 'number'
                ? payload
                : (payload && payload.currentTarget && payload.currentTarget.dataset
                    ? payload.currentTarget.dataset.index
                    : undefined);
            const index = typeof rawIndex === 'number' ? rawIndex : parseInt(rawIndex, 10);
            if (Number.isNaN(index)) {
                return;
            }

            const updatedSelections = [...this.selectedMessages];
            const existingIndex = updatedSelections.indexOf(index);

            if (existingIndex > -1) {
                updatedSelections.splice(existingIndex, 1);
            } else {
                updatedSelections.push(index);
            }

            this.selectedMessages = updatedSelections;
            this.setData({
                selectedMessages: updatedSelections
            });
        },

        // 关注回关
        followBack: function (e) {
            const userId = e.currentTarget.dataset.userId;
            const index = e.currentTarget.dataset.index;
            if (userId) {
                this.callCloudFunction('follow', { 
                    action: 'toggleFollow',
                    targetOpenid: userId 
                }).then((res) => {
                    if (res.result && res.result.success) {
                        // 更新本地数据中的关注状态
                        const updatedMessages = [...this.messages];
                        if (updatedMessages[index]) {
                            updatedMessages[index].isMutual = res.result.isFollowing;
                        }
                        this.setData({
                            messages: updatedMessages
                        });
                        
                        const message = res.result.isFollowing ? '关注成功' : '取消关注';
                        uni.showToast({
                            title: message,
                            icon: 'success'
                        });
                    }
                }).catch((err) => {
                    console.error('关注操作失败:', err);
                    uni.showToast({
                        title: '操作失败',
                        icon: 'none'
                    });
                });
            }
        },

        // 检查关注状态
        checkFollowStatus: function (messages) {
            const followMessages = messages.filter(msg => msg.type === 'follow');
            if (followMessages.length === 0) {
                return;
            }

            // 批量检查关注状态
            const userIds = followMessages.map(msg => msg.fromUserId);
            const promises = userIds.map(userId => 
                this.callCloudFunction('follow', {
                    action: 'checkFollow',
                    targetOpenid: userId
                })
            );

            Promise.all(promises).then(results => {
                const updatedMessages = [...messages];
                followMessages.forEach((msg, index) => {
                    const result = results[index];
                    if (result && result.result && result.result.success) {
                        const msgIndex = updatedMessages.findIndex(m => m._id === msg._id);
                        if (msgIndex !== -1) {
                            updatedMessages[msgIndex].isMutual = result.result.isMutual;
                        }
                    }
                });
                this.setData({
                    messages: updatedMessages
                });
            }).catch(err => {
                console.error('检查关注状态失败:', err);
            });
        },

        // 获取选中消息的时间
        getSelectedTime: function () {
            if (this.selectedMessages.length === 0) return '';
            const firstSelected = this.messages[this.selectedMessages[0]];
            return firstSelected ? firstSelected.formattedTime || '刚刚' : '';
        },

        // 获取选中消息的内容
        getSelectedContent: function () {
            if (this.selectedMessages.length === 0) return '';
            const firstSelected = this.messages[this.selectedMessages[0]];
            return firstSelected ? (firstSelected.postTitle || firstSelected.content || '标题') : '';
        },

        // 标记选中消息为已读
        markSelectedAsRead: function () {
            if (this.selectedMessages.length === 0) return;
            
            const messageIds = this.selectedMessages.map(index => this.messages[index]._id);
            this.markMessagesAsRead(messageIds);
            
            this.setData({
                selectedMessages: []
            });
        },

        // 删除选中消息
        deleteSelectedMessages: function () {
            if (this.selectedMessages.length === 0) return;
            
            uni.showModal({
                title: '确认删除',
                content: `确定要删除选中的${this.selectedMessages.length}条消息吗？`,
                success: (res) => {
                    if (res.confirm) {
                        const messageIds = this.selectedMessages.map(index => this.messages[index]._id);
                        this.callCloudFunction('deleteMessage', { messageIds }).then((res) => {
                            if (res.result && res.result.success) {
                                // 从本地数据中移除
                                const newMessages = this.messages.filter((msg, index) => !this.selectedMessages.includes(index));
                                this.setData({
                                    messages: newMessages,
                                    selectedMessages: []
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
        }
    }
};
</script>
<style>
/* pages/messages/messages.wxss */
.container {
    min-height: 100vh;
    background-color: #ffffff;
    padding-top: calc(200rpx + env(safe-area-inset-top, var(--safe-area-inset-top, 44px))); /* 为返回按钮留出空间 */
}

/* 自定义返回按钮 */
.custom-back-btn {
    position: absolute;
    top: calc(90rpx + env(safe-area-inset-top, var(--safe-area-inset-top, 44px))); /* 添加安全区域偏移 */
    left: 40rpx;
    width: 100rpx;
    height: 100rpx;
    background: transparent;
    border: none;
    display: block;
    z-index: 100;
    transition: all 0.2s ease;
}

.custom-back-btn:active {
    transform: scale(0.95);
}

.custom-back-btn .back-icon {
    width: 100rpx;
    height: 100rpx;
    display: block;
    object-fit: contain;
}

/* 主要筛选区域 */
.filter-section {
    background-color: #ffffff;
    padding: 20rpx 30rpx;
    border-bottom: 1rpx solid #f0f0f0;
    position: relative;
}

.filter-main {
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.filter-left {
    display: flex;
    align-items: center;
    gap: 20rpx;
}

.filter-right {
    display: flex;
    align-items: center;
    gap: 20rpx;
}

.all-notifications-btn {
    padding: 8rpx 16rpx;
    background-color: rgba(24, 24, 24, 0.5);
    border-radius: 10rpx;
    border: none;
    min-width: 100rpx;
    height: 32rpx;
    display: flex;
    align-items: center;
    justify-content: center;
}

.all-notifications-btn.active {
    background-color: rgba(24, 24, 24, 0.7);
}

.all-notifications-btn text {
    font-size: 24rpx;
    color: #ffffff;
    font-weight: 500;
}

.filter-dropdown {
    padding: 8rpx 12rpx;
    background-color: #D9D9D9;
    border: none;
    border-radius: 10rpx;
    min-width: 40rpx;
    height: 32rpx;
    display: flex;
    align-items: center;
    justify-content: center;
}

.filter-icon {
    font-size: 20rpx;
    color: #666666;
}

.clear-btn, .mark-all-read-btn {
    padding: 8rpx 16rpx;
    background-color: #D9D9D9;
    border: none;
    border-radius: 10rpx;
    min-width: 100rpx;
    height: 32rpx;
    display: flex;
    align-items: center;
    justify-content: center;
}

.clear-btn text, .mark-all-read-btn text {
    font-size: 24rpx;
    color: #989090;
    font-weight: 500;
}

/* 筛选下拉菜单 */
.filter-dropdown-menu {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background-color: #ffffff;
    border: 1rpx solid #e0e0e0;
    border-radius: 8rpx;
    box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.1);
    z-index: 100;
    transform: translateY(-10rpx);
    opacity: 0;
    visibility: hidden;
    transition: all 0.3s ease;
}

.filter-dropdown-menu.filter-dropdown-menu-show {
    transform: translateY(0);
    opacity: 1;
    visibility: visible;
}

.filter-option {
    padding: 20rpx 30rpx;
    border-bottom: 1rpx solid #f0f0f0;
    transition: background-color 0.2s ease;
}

.filter-option:last-child {
    border-bottom: none;
}

.filter-option.active {
    background-color: #f5f5f5;
}

.filter-option text {
    font-size: 28rpx;
    color: #333333;
}

.filter-option.active text {
    color: #000000;
    font-weight: 500;
}

/* 消息类型标签 */
.tab-container {
    display: flex;
    background-color: #ffffff;
    padding: 0 30rpx;
    border-bottom: 1rpx solid #f0f0f0;
}

.tab-item {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 30rpx 0;
    position: relative;
}

.tab-item text {
    font-size: 30rpx;
    color: #000000;
    transition: color 0.3s;
}

.tab-item.active text {
    color: #000000;
    font-weight: 500;
}

/* 消息列表 */
.message-list {
    height: calc(100vh - 200rpx);
    background-color: #ffffff;
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

/* 消息项包装器 */
.message-item-wrapper {
    position: relative;
    overflow: hidden;
}

/* 左滑操作按钮 */
.swipe-actions {
    position: absolute;
    top: 0;
    right: 0;
    height: 100%;
    display: flex;
    z-index: 1;
    transform: translateX(100%);
    transition: transform 0.3s ease;
    width: 300rpx;
}

.swipe-actions.swipe-actions-show {
    transform: translateX(0);
}

.action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 20rpx;
    color: #ffffff;
    font-size: 24rpx;
    min-width: 80rpx;
    flex: 1;
}

.mark-read-btn {
    background-color: #999999;
}

.delete-btn {
    background-color: #cc9090;
}

/* 消息项 */
.message-item {
    position: relative;
    background-color: #ffffff;
    padding: 30rpx;
    border-bottom: 1rpx solid #f0f0f0;
    display: flex;
    align-items: flex-start;
    gap: 30rpx;
    z-index: 2;
    transition: transform 0.3s ease;
    margin-bottom: 20rpx;
}

.message-item.swipe-open {
    transform: translateX(-300rpx);
}

.message-item.unread {
    background-color: #f8f9fa;
}

.user-avatar {
    width: 80rpx;
    height: 80rpx;
    border-radius: 50%;
    flex-shrink: 0;
    border: 2rpx solid #f0f0f0;
}

.message-body {
    flex: 1;
    min-width: 0;
}

.message-header {
    display: flex;
    align-items: center;
    gap: 10rpx;
    margin-bottom: 16rpx;
}

.sender-name {
    font-size: 30rpx;
    color: #000000;
    font-weight: 500;
}

.action-text {
    font-size: 30rpx;
    color: #000000;
}

.message-time {
    font-size: 24rpx;
    color: #999999;
    background-color: #f5f5f5;
    padding: 4rpx 12rpx;
    border-radius: 12rpx;
    margin-left: auto;
}

.content-preview {
    background-color: #f5f5f5;
    padding: 16rpx;
    border-radius: 8rpx;
    margin-top: 10rpx;
}

.preview-text {
    font-size: 28rpx;
    color: #333333;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

.follow-btn {
    padding: 8rpx 16rpx;
    background-color: #f0f0f0;
    border-radius: 16rpx;
    margin-left: 10rpx;
    margin-right: 10rpx;
}

.follow-btn text {
    font-size: 24rpx;
    color: #000000;
}

.unread-dot {
    position: absolute;
    top: 30rpx;
    left: 30rpx;
    width: 16rpx;
    height: 16rpx;
    background-color: #ff6b6b;
    border-radius: 50%;
}

/* 底部操作栏 */
.bottom-action-bar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background-color: #ffffff;
    border-top: 1rpx solid #f0f0f0;
    padding: 20rpx 30rpx;
    display: flex;
    justify-content: space-between;
    align-items: center;
    box-shadow: 0 -2rpx 10rpx rgba(0, 0, 0, 0.1);
}

.action-info {
    flex: 1;
}

.selected-time {
    font-size: 24rpx;
    color: #999999;
    background-color: #f5f5f5;
    padding: 4rpx 12rpx;
    border-radius: 12rpx;
    display: inline-block;
    margin-bottom: 8rpx;
}

.selected-content {
    background-color: #f5f5f5;
    padding: 8rpx 12rpx;
    border-radius: 8rpx;
}

.selected-content text {
    font-size: 26rpx;
    color: #333333;
}

.action-buttons {
    display: flex;
    gap: 20rpx;
}

.mark-read-btn {
    padding: 16rpx 32rpx;
    background-color: #f0f0f0;
    border-radius: 8rpx;
}

.mark-read-btn text {
    font-size: 28rpx;
    color: #000000;
}

.delete-selected-btn {
    padding: 16rpx 32rpx;
    background-color: #ff6b6b;
    border-radius: 8rpx;
}

.delete-selected-btn text {
    font-size: 28rpx;
    color: #ffffff;
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
    .message-item {
        padding: 24rpx;
    }

    .user-avatar {
        width: 70rpx;
        height: 70rpx;
    }

    .sender-name, .action-text {
        font-size: 28rpx;
    }
}
</style>
