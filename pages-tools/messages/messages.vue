<template>
    <!-- pages/messages/messages.wxml -->
    <view class="container" :class="{ 'container--dark': appThemeMode === 'dark' }" :data-app-theme="appThemeMode" :style="messagePageStyle">
        <!-- 自定义返回按钮 -->
        <view class="custom-back-btn" @tap="goBack">
            <image class="back-icon" src="/static/images/left_exit.png" mode="aspectFit"></image>
        </view>

        <!-- 操作按钮区域 -->
        <view class="filter-section" :style="filterSectionInlineStyle">
            <view class="filter-main">
                <view class="filter-left">
                    <!-- 左侧留空 -->
                </view>
                <view class="filter-right">
                    <view class="clear-btn" @tap="clearAllMessages">
                        <text>清空</text>
                    </view>
                </view>
            </view>
        </view>

        <!-- 消息类型标签 -->
        <view class="tab-container">
            <view :class="'tab-item ' + (activeTab === 'all' ? 'active' : '')" @tap="switchTab" data-tab="all">
                <text>全部</text>
            </view>
            <view :class="'tab-item ' + (activeTab === 'like_all' ? 'active' : '')" @tap="switchTab" data-tab="like_all">
                <text>点赞</text>
            </view>
            <view :class="'tab-item ' + (activeTab === 'comment' ? 'active' : '')" @tap="switchTab" data-tab="comment">
                <text>评论</text>
            </view>
            <view :class="'tab-item ' + (activeTab === 'follow' ? 'active' : '')" @tap="switchTab" data-tab="follow">
                <text>关注</text>
            </view>
            <view :class="'tab-item ' + (activeTab === 'feedback_report_all' ? 'active' : '')" @tap="switchTab" data-tab="feedback_report_all">
                <text>反馈</text>
            </view>
            <view :class="'tab-item ' + (activeTab === 'content_review_all' ? 'active' : '')" @tap="switchTab" data-tab="content_review_all">
                <text>复核</text>
            </view>
        </view>

        <!-- 消息列表 -->
        <scroll-view :scroll-y="true" class="message-list" @scrolltolower="handleScrollToLower"
                     refresher-enabled :refresher-triggered="isRefreshing" @refresherrefresh="refreshMessages">
            <view v-if="showLoadingState" class="loading-state">
                <text class="loading-text">加载中...</text>
            </view>

            <view v-else-if="messages.length === 0" class="empty-container">
                <image class="empty-icon" src="/static/images/icons/empty-message.svg" mode="aspectFit"></image>
                <text class="empty-text">暂无消息通知</text>
            </view>

            <view class="message-item-wrapper" v-for="(item, index) in messages" :key="item._id">
                <!-- 左滑操作按钮 -->
                <view class="swipe-actions" :class="{ 'swipe-actions-show': item.isSwipeOpen }">
                    <view class="action-btn delete-btn" @tap.stop="deleteMessage" :data-messageid="item._id">
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
                           :src="getMessageAvatar(item)"
                           mode="aspectFill"
                           @tap.stop.prevent="navigateToUserProfile"
                           :data-user-id="item.fromUserId" />

                    <!-- 消息主体 -->
                    <view class="message-body">
                        <!-- 发送者和动作 -->
                        <view class="message-header">
                            <text class="sender-name">{{ item.fromUserName || '某用户' }}</text>
                            <text class="action-text">{{ getActionText(item) }}</text>
                            <!-- 关注按钮（仅关注类型显示，放在时间左边） -->
                            <view v-if="item.type === 'follow'" :class="'follow-btn ' + (item.isFollowing ? 'following' : '')" @tap.stop="followBack" :data-user-id="item.fromUserId">
                                <text>{{ item.isFollowing ? '已关注' : '回关' }}</text>
                            </view>
                            <text class="message-time">{{ item.formattedTime || '刚刚' }}</text>
                        </view>

                        <!-- 内容预览 -->
                        <view v-if="(item.feedbackContent || item.postTitle || item.content) && item.type !== 'follow'" class="content-preview">
                            <text class="preview-text">{{ item.replyContent || item.feedbackContent || item.postTitle || item.content || '标题' }}</text>
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

    </view>
    <app-overlay-host />
</template>

<script>
import { formatTimeAgo } from '../../utils/time.js';
import { invalidateUnread, updateUnreadCache } from '../../api-cache/unread.js';
import {
    getCachedMessages,
    getMessageViewer,
    getMessages as getMessagesWithCache,
    markMessagesAsRead as markMessagesAsReadApi,
    markAllMessagesAsRead as markAllMessagesAsReadApi,
    deleteMessageById,
    clearMessages
} from '../../api-cache/messages.js';
import { toggleFollow } from '../../api-cache/following.js';
import fileUrlCache from '../../cache/core/file-url.js';
import unreadBadge from '../../cache/stores/unread-badge.js';
import followCache from '../../cache/stores/follow.js';
import { resolveUserAvatar } from '../../utils/defaultAvatar.js';
import { getSystemInfoCompat } from '@/utils/system-info.js';
import { applyThemeMode, getThemeMode } from '@/utils/theme.js';
import { feedbackDetailUrl } from '../../utils/feedback.js';
import { refreshAdminStatus } from '../../utils/admin.js';
import { requireLogin } from '../../utils/authHelper.js';
import { invalidatePostDetail } from '../../api-cache/post.js';

export default {
    data() {
        return {
            messages: [],
            isLoading: false,
            isRefreshing: false,
            hasLoaded: false,
            hasMore: true,
            page: 0,
            PAGE_SIZE: 10,
            activeTab: 'all',
            // all, like_all, comment, follow, feedback_report_all, content_review_all
            unreadCount: 0,
            pageInlineStyle: '',
            filterSectionInlineStyle: '',
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
    computed: {
        messagePageStyle() {
            return Object.assign({}, this.appThemeVars || {}, this.pageInlineStyle || {});
        },
        showLoadingState() {
            return !this.hasLoaded;
        }
    },
    onLoad: function (options) {
        this.setupHeaderLayout();
    },
    onShow: function () {
        const mode = applyThemeMode(getThemeMode());
        this.appThemeMode = mode;
        const viewer = getMessageViewer();
        if (viewer !== this._messageViewer) {
            this._messageViewer = viewer;
            this._markAllReadTask = null;
            this._messageSnapshot = null;
            this.setData({ messages: [], page: 0, hasMore: true, hasLoaded: false, unreadCount: 0 });
        }
        if (!viewer) {
            this.hasLoaded = true;
            requireLogin();
            return;
        }
        this.markAllMessagesAsRead(viewer);
        return this.loadMessages({ reset: true });
    },
    onUnload: function () {
        this._messageViewer = null;
        this._messageRequestId = (this._messageRequestId || 0) + 1;
        if (this.longPressGuardTimer) {
            clearTimeout(this.longPressGuardTimer);
            this.longPressGuardTimer = null;
        }
        this.justLongPressed = false;
    },
    onPullDownRefresh: function () {
        return this.refreshMessages().finally(() => {
            uni.stopPullDownRefresh();
        });
    },
    methods: {
        setupHeaderLayout() {
            try {
                const systemInfo = getSystemInfoCompat();
                let safeAreaTop = 0;

                if (systemInfo.safeAreaInsets && systemInfo.safeAreaInsets.top > 0) {
                    safeAreaTop = systemInfo.safeAreaInsets.top;
                } else if (systemInfo.statusBarHeight) {
                    safeAreaTop = systemInfo.statusBarHeight;
                }

                if (safeAreaTop > 0) {
                    this.pageInlineStyle = {
                        '--messages-safe-area-top': `${safeAreaTop}px`
                    };
                }
            } catch (err) {
                console.warn('[messages] setupHeaderLayout safe area failed:', err);
            }

            // #ifdef MP-WEIXIN
            try {
                const systemInfo = getSystemInfoCompat();
                const menuButton = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null;

                if (!menuButton) {
                    return;
                }

                const windowWidth = systemInfo.windowWidth || 375;
                const rightInset = Math.max(30, windowWidth - menuButton.left + 24);

                this.filterSectionInlineStyle = `padding-right: ${rightInset}px;`;
            } catch (err) {
                console.warn('[messages] setupHeaderLayout failed:', err);
            }
            // #endif
        },
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

        getMessageAvatar(message) {
            const source = message.fromUserAvatar;
            const avatar = typeof source === 'string' && source.startsWith('cloud://') ? message.displayAvatar : source;
            return resolveUserAvatar(avatar, message.fromUserId || message._openid || message.userId || message.fromUserName || message._id);
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
        },

        handleMessageTap: async function (e) {
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

            this.closeAllSwipeActions();

            const message = this.messages[index];
            if (!message) {
                return;
            }

            if (message._id && !message.isRead) {
                this.markMessagesAsRead([message._id]);
            }

            if (message.type === 'content_review_new') {
                if (!message.reviewId) {
                    uni.showToast({ title: '复核记录标识缺失', icon: 'none' });
                    return;
                }
                const isAdmin = await refreshAdminStatus();
                if (!isAdmin) {
                    uni.showToast({ title: isAdmin === null ? '暂时无法确认管理员权限，请重试' : '仅管理员可查看复核详情', icon: 'none' });
                    return;
                }
                uni.navigateTo({ url: `/pages-admin/post-reports/post-reports?reviewId=${encodeURIComponent(message.reviewId)}` });
                return;
            }
            if (message.type === 'content_review_approved' || message.type === 'content_review_rejected') {
                const approved = message.type === 'content_review_approved';
                const canOpen = approved && !!message.postId;
                const kindLabel = ({ post: '帖子', post_edit: '帖子修改', comment: '评论' })[message.reviewKind] || '内容';
                uni.showModal({
                    title: approved ? '复核已通过' : '复核未通过',
                    content: `${message.postTitle ? `帖子：${message.postTitle}\n` : ''}${message.content || (approved ? `您的${kindLabel}已通过管理员复核并发布。` : `您的${kindLabel}未通过管理员复核，仍未发布。`)}`,
                    showCancel: canOpen,
                    cancelText: '关闭',
                    confirmText: canOpen ? '查看帖子' : '知道了',
                    success: result => {
                        if (result.confirm && canOpen) {
                            invalidatePostDetail(message.postId);
                            this.navigateToPost(message.postId);
                        }
                    }
                });
                return;
            }

            if (message.type === 'post_report_new' && message.reportId) {
                uni.navigateTo({ url: `/pages-admin/post-reports/post-reports?reportId=${encodeURIComponent(message.reportId)}` });
                return;
            }
            if (message.type === 'post_report_handled' || message.type === 'post_report_dismissed') {
                uni.showModal({
                    title: message.type === 'post_report_handled' ? '举报已处理' : '举报未通过',
                    content: `${message.postTitle ? `帖子：${message.postTitle}\n` : ''}举报原因：${message.reportReason || '未填写'}\n${message.type === 'post_report_handled' ? '管理员已删除相关帖子。' : '管理员核查后未删除相关帖子。'}`,
                    showCancel: false,
                    confirmText: '知道了'
                });
                return;
            }

            if (['feedback', 'feedback_reply', 'feedback_detail_requested', 'feedback_processed'].includes(message.type) && message.feedbackId) {
                uni.navigateTo({ url: feedbackDetailUrl(message.feedbackId) });
                return;
            }
            if (message.type === 'feedback_processed') {
                uni.showModal({
                    title: '反馈已解决',
                    content: message.feedbackContent || message.content || '您反馈的问题已解决',
                    showCancel: false,
                    confirmText: '知道了'
                });
                return;
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

        // 滚动到底部加载更多
        handleScrollToLower() {
            if (this.page > 0 && this.hasMore && !this.isLoading) {
                this.loadMessages();
            }
        },

        switchTab(e) {
            const tab = e.currentTarget.dataset.tab;
            if (tab === this.activeTab) {
                return;
            }
            this._messageSnapshot = null;
            this.setData({ activeTab: tab, messages: [], page: 0, hasMore: true, hasLoaded: false });
            return this.loadMessages({ reset: true });
        },

        async refreshMessages() {
            if (this.isRefreshing) return;
            this.isRefreshing = true;
            try {
                await this.loadMessages({ reset: true, forceRefresh: true });
            } finally {
                this.isRefreshing = false;
            }
        },

        async loadMessages({ reset = false, forceRefresh = false } = {}) {
            const viewer = getMessageViewer();
            if (!viewer || viewer !== this._messageViewer || (!reset && this.isLoading)) {
                return;
            }
            const requestId = (this._messageRequestId || 0) + 1;
            this._messageRequestId = requestId;
            const isCurrent = () => this._messageRequestId === requestId && getMessageViewer() === viewer;
            const page = reset ? 0 : this.page;
            const type = this.activeTab === 'all' ? null : this.activeTab;
            const cached = reset ? getCachedMessages({ type, pageSize: this.PAGE_SIZE }) : undefined;
            this.isLoading = true;

            try {
                if (cached && cached !== this._messageSnapshot) {
                    this._messageSnapshot = cached;
                    this.applyMessages(cached.messages, page, cached.unreadCount, { cached: true });
                }
                const result = await getMessagesWithCache({
                    page, pageSize: this.PAGE_SIZE, type, context: this, forceRefresh
                });
                if (isCurrent() && (!reset || result !== this._messageSnapshot)) {
                    if (reset) this._messageSnapshot = result;
                    this.applyMessages(result.messages, page, result.unreadCount);
                }
            } catch (err) {
                if (!isCurrent()) return;
                console.error('获取消息失败:', err);
                if (forceRefresh || !this.hasLoaded || !reset) {
                    let errorMessage = '获取消息失败';
                    if (err?.message?.includes('网络')) {
                        errorMessage = '网络连接失败，请检查网络';
                    } else if (err?.message?.includes('权限')) {
                        errorMessage = '权限不足，请重新登录';
                    } else if (err?.message?.includes('超时')) {
                        errorMessage = '请求超时，请重试';
                    }
                    uni.showToast({ title: errorMessage, icon: 'none', duration: 3000 });
                }
            } finally {
                if (isCurrent()) {
                    this.setData({ isLoading: false, hasLoaded: true });
                }
            }
        },

        resolveMessageAvatars(messages) {
            const avatarIds = messages.map(msg => msg.fromUserAvatar)
                .filter(url => typeof url === 'string' && url.startsWith('cloud://'));
            if (avatarIds.length === 0) return;

            const viewer = this._messageViewer;
            fileUrlCache.getTempUrls(avatarIds).then(urls => {
                if (this._messageViewer !== viewer || getMessageViewer() !== viewer) return;
                this.messages.forEach(msg => {
                    const url = urls[msg.fromUserAvatar];
                    if (url) msg.displayAvatar = url;
                });
            }).catch(error => console.warn('转换消息头像失败:', error));
        },

        applyMessages(rows, page, unreadCount, { cached = false } = {}) {
            const markAllTask = this._markAllReadTask;
            const unreadIds = cached ? [] : rows.filter(msg => !msg.isRead).map(msg => msg._id);
            // 格式化后的文字、头像和已读状态都只写入页面副本。
            const newMessages = rows.map(msg => ({ ...msg, isRead: cached || !!markAllTask || msg.isRead }));
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
                        const isReply = !!msg.isReply 
                            || originalContent.includes('评论了你的评论') 
                            || originalContent.includes('回复了你的评论')
                            || !!msg.parentId;
                        const actionText = isReply ? '回复了你的评论' : `评论了你的${contentTypeText}`;
                        msg.content = `${userName} ${timeAgo}${actionText}`;
                    } else if (msg.type === 'favorite') {
                        msg.content = `${userName} ${timeAgo}收藏了你的${contentTypeText}`;
                    } else if (msg.type === 'feedback') {
                        msg.content = `${userName} ${timeAgo}提交了新的意见反馈`;
                    } else if (msg.type === 'feedback_processed') {
                        msg.content = msg.replyContent ? `${userName}办结了您的反馈` : `${userName}解决了您反馈的问题`;
                    } else if (msg.type === 'feedback_reply') {
                        msg.content = `${userName}${msg.feedbackRole === 'user' ? '补充了反馈信息' : '回复了您的反馈'}`;
                    } else if (msg.type === 'feedback_detail_requested') {
                        msg.content = `${userName}请您补充反馈细节`;
                    } else if (msg.type === 'post_report_new') {
                        msg.content = `${userName}提交了新的举报`;
                    } else if (msg.type === 'post_report_handled') {
                        msg.content = `${userName}处理了您的举报`;
                    } else if (msg.type === 'post_report_dismissed') {
                        msg.content = `${userName}没有通过您的举报`;
                    } else if (msg.type === 'follow') {
                        msg.content = `${userName} ${timeAgo}关注了你`;
                        // 对于关注消息，需要检查是否已经互相关注
                        msg.isFollowing = false; // 默认值，后续会通过API检查
                        msg.isMutual = false; // 默认值，后续会通过API检查
                    }
                }
            });
            const allMessages = page === 0 ? newMessages : this.messages.concat(newMessages);
            this.setData({
                messages: allMessages,
                page: page + 1,
                hasMore: newMessages.length === this.PAGE_SIZE,
                unreadCount: cached || markAllTask ? 0 : unreadCount || 0,
                hasLoaded: true
            });

            this.resolveMessageAvatars(newMessages);
            this.checkFollowStatus(newMessages);

            if (unreadIds.length > 0) {
                if (markAllTask) {
                    const viewer = this._messageViewer;
                    markAllTask.then(result => {
                        if (!result.success && this._messageViewer === viewer && getMessageViewer() === viewer) {
                            this.markMessagesAsRead(unreadIds);
                        }
                    });
                } else {
                    this.markMessagesAsRead(unreadIds);
                }
            }
        },

        // 进入页面立即清除红点，同时在后台同步服务器已读状态。
        markAllMessagesAsRead: function (viewer) {
            if (this.messages.some((msg) => !msg.isRead)) {
                this.setData({
                    messages: this.messages.map((msg) => (msg.isRead ? msg : Object.assign({}, msg, { isRead: true })))
                });
            }
            this.setData({ unreadCount: 0 });
            try { unreadBadge.acknowledgeAllRead(); } catch (_) {}
            updateUnreadCache(0);

            if (this._markAllReadTask) {
                return this._markAllReadTask;
            }

            const task = markAllMessagesAsReadApi(this)
                .catch((error) => {
                    // 首次失败可能是登录态/网络尚未就绪，短暂等待后重试一次
                    console.warn('[messages] 标记全部已读失败，准备重试:', error);
                    return new Promise((resolve) => setTimeout(resolve, 800)).then(() => {
                        return getMessageViewer() === viewer ? markAllMessagesAsReadApi(this) : { success: false };
                    });
                })
                .then((result) => {
                    if (result.success && getMessageViewer() === viewer) {
                        try { unreadBadge.acknowledgeAllRead(); } catch (_) {}
                        updateUnreadCache(0);
                    }
                    return result;
                })
                .catch((error) => {
                    // 仍然失败时回读服务器未读数，避免红点被错误清除
                    console.warn('[messages] 标记全部已读失败:', error);
                    if (getMessageViewer() === viewer) invalidateUnread();
                    return { success: false };
                })
                .finally(() => {
                    if (this._markAllReadTask === task) {
                        this._markAllReadTask = null;
                    }
                });
            this._markAllReadTask = task;
            return task;
        },

        // 标记消息为已读
        markMessagesAsRead: function (messageIds) {
            if (!messageIds || messageIds.length === 0) {
                return;
            }
            const viewer = this._messageViewer;
            markMessagesAsReadApi(messageIds, this).then(() => {
                    if (getMessageViewer() !== viewer) return;
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

                    // 以全局未读数为准递减，避免用页面里可能过期的列表计数把红点点亮
                    try { unreadBadge.decreaseUnread(messageIds.length); } catch (_) {}
                    updateUnreadCache((prev) => Math.max(0, (typeof prev === 'number' ? prev : 0) - messageIds.length));

                    console.log('【messages】已标记已读，未读数:', nextUnread);
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
                uni.navigateTo({ url: `/pages-user/user-profile/user-profile?userId=${encodeURIComponent(userId)}` });
            } catch (err) {
                console.error('[messages] navigateToUserProfile failed:', err);
                uni.showToast({ title: '跳转失败', icon: 'none' });
            }
        },

        // 删除单条消息
        deleteMessage: function (e) {
            const messageId = e.currentTarget.dataset.messageid;
            const viewer = this._messageViewer;
            uni.showModal({
                title: '确认删除',
                content: '确定要删除这条消息吗？',
                success: (res) => {
                    if (res.confirm && viewer && viewer === getMessageViewer()) {
                        deleteMessageById(messageId, this).then(() => {
                                if (this._messageViewer !== viewer || getMessageViewer() !== viewer) return;
                                this.messages = this.messages.filter(msg => msg._id !== messageId);
                                // 关闭滑动操作
                                this.closeAllSwipeActions();
                                this.loadMessages({ reset: true });
                                uni.showToast({
                                    title: '删除成功',
                                    icon: 'success'
                                });
                            }).catch((err) => {
                                console.error('删除消息失败:', err);
                                uni.showToast({
                                    title: err.message || '删除失败',
                                    icon: 'none'
                                });
                            });
                        }
                    }
            });
        },

        // 清空所有消息
        clearAllMessages: function () {
            const viewer = this._messageViewer;
            uni.showModal({
                title: '清空消息',
                content: '确定要清空所有消息吗？此操作不可恢复。',
                success: (res) => {
                    if (res.confirm && viewer && viewer === getMessageViewer()) {
                        clearMessages(this).then(() => {
                                if (this._messageViewer !== viewer || getMessageViewer() !== viewer) return;
                                this._messageRequestId = (this._messageRequestId || 0) + 1;
                                this._messageSnapshot = null;
                                this.setData({ messages: [], page: 0, hasMore: false, unreadCount: 0, isLoading: false, hasLoaded: true });

                                // 使用 unreadBadge 清零，自动广播到所有订阅者
                                unreadBadge.clearUnread();
                                updateUnreadCache(0);

                                uni.showToast({
                                    title: '已清空',
                                    icon: 'success'
                                });
                            }).catch((err) => {
                                console.error('清空消息失败:', err);
                                uni.showToast({
                                    title: err.message || '清空失败',
                                    icon: 'none'
                                });
                            });
                        }
                    }
            });
        },


        // 获取动作文本
        getActionText: function (msg) {
            if (!msg) return '通知了你';
            const { type, contentType, content, isReply, parentId } = msg;
            
            // 优先判断是否为“评论的回复”，无需依赖 contentType
            const repliedToComment = !!isReply 
                || !!parentId 
                || (content || '').includes('评论了你的评论') 
                || (content || '').includes('回复了你的评论');
            if (type === 'comment' && repliedToComment) {
                return '回复了你的评论';
            }

            // 根据内容类型确定显示文本
            let contentTypeText = '';
            if (contentType === 'comment') {
                contentTypeText = '评论';
            } else if (contentType === 'original' || contentType === 'non-original') {
                contentTypeText = '诗';
            } else if (contentType === 'discussion') {
                contentTypeText = '讨论';
            } else {
                contentTypeText = '帖子';
            }
            
            const actionMap = {
                'like': `点赞了你的${contentTypeText}`,
                'comment': `评论了你的${contentTypeText}`,
                'favorite': `收藏了你的${contentTypeText}`,
                'follow': '关注了你',
                'feedback': '提交了新的意见反馈',
                'feedback_reply': msg.feedbackRole === 'user' ? '补充了反馈信息' : '回复了您的反馈',
                'feedback_detail_requested': '请您补充反馈细节',
                'feedback_processed': msg.replyContent ? '办结了您的反馈' : '解决了您反馈的问题',
                'post_report_new': '提交了新的举报',
                'post_report_handled': '处理了您的举报',
                'post_report_dismissed': '没有通过您的举报',
                'content_review_new': '提交了待复核内容',
                'content_review_approved': '通过了您的内容复核',
                'content_review_rejected': '未通过您的内容复核'
            };
            return actionMap[type] || '通知了你';
        },


        // 关注回关
        followBack: function (e) {
            const userId = e.currentTarget.dataset.userId;
            const viewer = this._messageViewer;
            if (userId && viewer && getMessageViewer() === viewer) {
                toggleFollow(userId, {
                    context: this,
                    pageTag: 'messages:toggle-follow'
                }).then((result) => {
                        if (this._messageViewer !== viewer || getMessageViewer() !== viewer) return;
                        this.messages.forEach(msg => {
                            if (msg.type === 'follow' && msg.fromUserId === userId) {
                                msg.isFollowing = result.isFollowing;
                                msg.isMutual = result.isMutual;
                            }
                        });
                        
                        const message = result.isFollowing ? '关注成功' : '取消关注';
                        uni.showToast({
                            title: message,
                            icon: 'success'
                        });
                }).catch((err) => {
                    console.error('关注操作失败:', err);
                    uni.showToast({
                        title: err.message || '操作失败',
                        icon: 'none'
                    });
                });
            }
        },

        // 检查关注状态（优化：使用缓存批量查询，避免频繁调用云函数）
        checkFollowStatus: function (messages) {
            const followMessages = messages.filter(msg => msg.type === 'follow');
            if (followMessages.length === 0) {
                return;
            }

            // 使用关注缓存批量查询，避免频繁调用云函数
            const currentUserId = this._messageViewer;
            if (!currentUserId) {
                return;
            }

            const userIds = [...new Set(followMessages.map(msg => msg.fromUserId).filter(Boolean))];
            if (userIds.length === 0) {
                return;
            }

            // 使用批量查询接口，减少云函数调用次数
            followCache.getBatchFollowStatus(currentUserId, userIds).then(statuses => {
                if (this._messageViewer !== currentUserId || getMessageViewer() !== currentUserId) return;
                this.messages.forEach(msg => {
                    if (msg.type !== 'follow') return;
                    const status = statuses[msg.fromUserId];
                    if (status?.isFollowing !== undefined) {
                        msg.isFollowing = status.isFollowing;
                        msg.isMutual = status.isMutual;
                    }
                });
            }).catch(err => {
                console.error('检查关注状态失败:', err);
            });
        },




    }
};
</script>
<style>
/* pages/messages/messages.wxss */
.container {
    min-height: 100vh;
    background-color: var(--app-page-bg, #ffffff);
    padding-top: 0;
    color: var(--app-primary-text, #000000);
}

/* 自定义返回按钮 */
.custom-back-btn {
    position: absolute;
    top: calc(var(--messages-safe-area-top, 0px) + 28rpx);
    left: 30rpx;
    width: 56rpx;
    height: 56rpx;
    background: transparent;
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    transition: all 0.2s ease;
}

.custom-back-btn:active {
    transform: scale(0.95);
}

.custom-back-btn .back-icon {
    width: 22rpx;
    height: 38rpx;
    display: block;
    object-fit: contain;
    filter: var(--app-icon-filter, none);
}

/* 消息类型标签 */
.tab-container {
    display: flex;
    background-color: var(--app-surface-bg, #ffffff);
    padding: 0 18rpx;
    border-bottom: var(--app-surface-border-line, 1rpx solid #f0f0f0);
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
    font-size: 27rpx;
    color: var(--app-secondary-text, #000000);
    transition: color 0.3s;
}

.tab-item.active text {
    color: var(--app-primary-text, #000000);
    font-weight: 500;
}

/* 操作按钮区域 */
.filter-section {
    background-color: var(--app-surface-bg, #ffffff);
    padding: calc(var(--messages-safe-area-top, 0px) + 28rpx) 30rpx 18rpx;
    border-bottom: var(--app-surface-border-line, 1rpx solid #f0f0f0);
    position: relative;
}

.filter-main {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 60rpx;
}

.filter-left {
    display: flex;
    align-items: center;
    gap: 20rpx;
    flex: 0 0 60rpx;
}

.filter-right {
    display: flex;
    align-items: center;
    gap: 20rpx;
}

.clear-btn {
    padding: 0 16rpx;
    background-color: var(--app-subtle-surface-bg, #D9D9D9);
    border: var(--app-surface-border-line, none);
    border-radius: 10rpx;
    min-width: 96rpx;
    height: 48rpx;
    display: flex;
    align-items: center;
    justify-content: center;
}

.clear-btn text {
    font-size: 24rpx;
    color: var(--app-secondary-text, #989090);
    font-weight: 500;
}

/* 消息列表 */
.message-list {
    height: calc(100vh - 200rpx - var(--messages-safe-area-top, 0px));
    background-color: var(--app-page-bg, #ffffff);
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
    filter: var(--app-icon-filter, none);
}

.empty-text {
    font-size: 30rpx;
    color: var(--app-muted-text, #999);
}

/* 首次加载状态 */
.loading-state {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 200rpx 0;
}

.loading-text {
    font-size: 30rpx;
    color: var(--app-muted-text, #999);
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
    width: 150rpx;
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

.delete-btn {
    background-color: var(--app-danger-color, #cc9090);
}

/* 消息项 */
.message-item {
    position: relative;
    background-color: var(--app-surface-bg, #ffffff);
    padding: 30rpx;
    border-bottom: var(--app-surface-border-line, 1rpx solid #f0f0f0);
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
    background-color: var(--app-message-unread-bg, #f8f9fa);
}

.user-avatar {
    width: 80rpx;
    height: 80rpx;
    border-radius: 50%;
    flex-shrink: 0;
    border: 2rpx solid var(--app-border-color, #f0f0f0);
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
    min-width: 0;
    overflow: hidden;
}

.sender-name {
    font-size: 30rpx;
    color: var(--app-primary-text, #000000);
    font-weight: 500;
    flex: 0 1 auto;
    min-width: 0;
    max-width: 40%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.action-text {
    font-size: 30rpx;
    color: var(--app-primary-text, #000000);
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.message-time {
    font-size: 24rpx;
    color: var(--app-muted-text, #999999);
    background-color: var(--app-subtle-surface-bg, #f5f5f5);
    padding: 4rpx 12rpx;
    border-radius: 12rpx;
    margin-left: auto;
    flex-shrink: 0;
    white-space: nowrap;
}

.content-preview {
    background-color: var(--app-subtle-surface-bg, #f5f5f5);
    padding: 16rpx;
    border-radius: 8rpx;
    margin-top: 10rpx;
}

.preview-text {
    font-size: 28rpx;
    color: var(--app-secondary-text, #333333);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

.follow-btn {
    padding: 8rpx 16rpx;
    background-color: var(--app-subtle-surface-bg, #f0f0f0);
    border-radius: 16rpx;
    margin-left: 10rpx;
    margin-right: 10rpx;
    flex-shrink: 0;
}

.follow-btn text {
    font-size: 24rpx;
    color: var(--app-primary-text, #000000);
    white-space: nowrap;
}

.follow-btn.following {
    background-color: var(--app-subtle-surface-bg, #f0f0f0);
}

.follow-btn.following text {
    color: var(--app-secondary-text, #666666);
}

.unread-dot {
    position: absolute;
    top: 30rpx;
    left: 30rpx;
    width: 16rpx;
    height: 16rpx;
    background-color: var(--app-danger-strong-color, #ff6b6b);
    border-radius: 50%;
}


/* 加载更多 */
.loading-more,
.no-more {
    text-align: center;
    padding: 40rpx;
    font-size: 28rpx;
    color: var(--app-muted-text, #999);
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
.container--dark {
    background-color: #0f1115;
    color: #f4f1ea;
}

.container--dark .filter-section,
.container--dark .tab-container,
.container--dark .message-item {
    background-color: #171a20;
    border-bottom: 1rpx solid rgba(255, 255, 255, 0.12);
}

.container--dark .message-list {
    background-color: #0f1115;
}

.container--dark .back-icon,
.container--dark .empty-icon {
    filter: brightness(0) invert(1);
}

.container--dark .tab-item text,
.container--dark .sender-name,
.container--dark .action-text,
.container--dark .follow-btn text {
    color: #f4f1ea;
}

.container--dark .tab-item.active text {
    color: #ffffff;
}

.container--dark .clear-btn,
.container--dark .message-time,
.container--dark .content-preview,
.container--dark .follow-btn,
.container--dark .follow-btn.following,
.container--dark .message-item.unread {
    background-color: rgba(255, 255, 255, 0.08);
}

.container--dark .clear-btn {
    border: 1rpx solid rgba(255, 255, 255, 0.12);
}

.container--dark .clear-btn text,
.container--dark .preview-text,
.container--dark .follow-btn.following text {
    color: #c9ced8;
}

.container--dark .message-time,
.container--dark .empty-text,
.container--dark .loading-text,
.container--dark .loading-more,
.container--dark .no-more {
    color: #8e96a3;
}

.container--dark .user-avatar {
    border-color: rgba(255, 255, 255, 0.12);
}

.container--dark .delete-btn {
    background-color: #bf616a;
}

.container--dark .unread-dot {
    background-color: #d45c5c;
}

</style>
