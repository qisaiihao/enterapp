<template>
    <!-- pages/messages/messages.wxml -->
    <view class="container" :style="pageInlineStyle">
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
                            <view v-if="item.type === 'follow'" :class="'follow-btn ' + (item.isFollowing ? 'following' : '')" @tap.stop="followBack" :data-user-id="item.fromUserId" :data-index="index">
                                <text>{{ item.isFollowing ? '已关注' : '回关' }}</text>
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

    </view>
</template>

<script>
import { formatTimeAgo } from '../../utils/time.js';
import { getUnreadCount, invalidateUnread } from '../../api-cache/unread.js';
import {
    getMessages as getMessagesWithCache,
    markMessagesAsRead as markMessagesAsReadApi,
    deleteMessageById,
    clearMessages,
    invalidateMessages
} from '../../api-cache/messages.js';
import { toggleFollow } from '../../api-cache/following.js';
import fileUrlCache from '../../cache/core/file-url.js';
import unreadBadge from '../../cache/stores/unread-badge.js';
import followCache from '../../cache/stores/follow.js';
import { emitUnreadChanged } from '../../utils/events.js';
import { resolveUserAvatar } from '../../utils/defaultAvatar.js';
import { getSystemInfoCompat } from '@/utils/system-info.js';
// pages/messages/messages.js
const app = getApp();

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
    onLoad: function (options) {
        this.setupHeaderLayout();
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
        // 下拉刷新时清除缓存并强制刷新
        invalidateMessages({ type: this.activeTab === 'all' ? null : this.activeTab });
        this.setData({
            messages: [],
            page: 0,
            hasMore: true
        });
        this.loadMessages(() => {
            uni.stopPullDownRefresh();
        }, true); // forceRefresh = true
    },
    watch: {
        // 本页未读数更新时，广播给全局（驱动小红点即时消失）
        unreadCount(n) {
            try { emitUnreadChanged({ count: typeof n === 'number' ? n : 0 }); } catch (_) {}
        }
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
                    this.pageInlineStyle = `--messages-safe-area-top: ${safeAreaTop}px;`;
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

        // 获取当前用户ID
        getCurrentUserId: function () {
            const appInstance = getApp();
            const openid = appInstance && appInstance.globalData && appInstance.globalData.openid;
            return openid || uni.getStorageSync('openid') || uni.getStorageSync('userOpenId');
        },

        normalizeMessageAvatar(message) {
            const resolvedAvatar = resolveUserAvatar(
                message && message.fromUserAvatar,
                message && (message.fromUserId || message._openid || message.userId || message.fromUserName || message._id)
            );

            if (message && typeof message === 'object') {
                message.fromUserAvatar = resolvedAvatar;
            }

            return resolvedAvatar;
        },

        getMessageAvatar(message) {
            return this.normalizeMessageAvatar(message);
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

        // 滚动到顶部刷新
        onScrollToUpper() {
            console.log('🔍 [消息页] 滚动到顶部，刷新消息');
            // 清除当前类型的缓存并强制刷新
            invalidateMessages({ type: this.activeTab === 'all' ? null : this.activeTab });
            this.setData({
                messages: [],
                page: 0,
                hasMore: true
            });
            this.loadMessages(null, true); // forceRefresh = true
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
            console.log('🔍 [消息页] 切换标签:', this.activeTab, '->', tab);
            // 清除旧标签的缓存，确保切换时能获取最新数据
            invalidateMessages({ type: this.activeTab === 'all' ? null : this.activeTab });
            // 重置状态并加载新标签的数据
            this.setData({
                activeTab: tab,
                messages: [],
                page: 0,
                hasMore: true,
                isLoading: false  // 重置加载状态，确保可以加载新标签的数据
            });
            // 强制刷新新标签的数据
            this.loadMessages(null, true);
        },

        // 加载消息列表（使用缓存）
        loadMessages: function (callback, forceRefresh = false) {
            if (this.isLoading) {
                console.log('🔍 [消息页] 正在加载中，跳过重复请求');
                if (typeof callback === 'function') {
                    callback();
                }
                return;
            }
            console.log('🔍 [消息页] 开始加载消息，页码:', this.page, '类型:', this.activeTab, 'forceRefresh:', forceRefresh);
            this.setData({
                isLoading: true
            });
            const { page, PAGE_SIZE, activeTab } = this;
            
            // 使用缓存封装的接口
            getMessagesWithCache({
                page,
                pageSize: PAGE_SIZE,
                type: activeTab === 'all' ? null : activeTab,
                context: this,
                forceRefresh
            }).then((result) => {
                console.log('🔍 [消息页] 缓存接口返回结果:', result);
                const newMessages = result.messages || [];
                const unreadCount = result.unreadCount || 0;
                
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
                                        msg.fromUserAvatar = '';
                                    }
                                }
                            });

                            // 继续处理消息
                            this.processMessagesAfterAvatarConversion(newMessages, page, PAGE_SIZE, unreadCount, callback);
                        })
                        .catch(error => {
                            console.error('批量转换头像URL失败:', error);
                            // 转换失败时使用默认头像
                            newMessages.forEach((msg) => {
                                if (msg.fromUserAvatar && msg.fromUserAvatar.startsWith('cloud://')) {
                                    msg.fromUserAvatar = '';
                                }
                            });

                            // 继续处理消息
                            this.processMessagesAfterAvatarConversion(newMessages, page, PAGE_SIZE, unreadCount, callback);
                        });
                } else {
                    // 没有需要转换的头像，直接处理消息
                    this.processMessagesAfterAvatarConversion(newMessages, page, PAGE_SIZE, unreadCount, callback);
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
        processMessagesAfterAvatarConversion: function (newMessages, page, PAGE_SIZE, unreadCount, callback) {
            // 格式化时间和消息内容
            newMessages.forEach((msg) => {
                this.normalizeMessageAvatar(msg);
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
                        msg.content = `管理员 ${timeAgo}处理了您的意见反馈`;
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
                hasMore: newMessages.length === PAGE_SIZE,
                unreadCount: unreadCount || 0
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
            getUnreadCount(this).then((count) => {
                    this.setData({
                        unreadCount: count || 0
                    });
                }).catch((err) => {
                    console.error('获取未读消息数量失败:', err);
                });
        },

        // 标记消息为已读
        markMessagesAsRead: function (messageIds) {
            if (!messageIds || messageIds.length === 0) {
                return;
            }
            markMessagesAsReadApi(messageIds, this).then(() => {
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

                    // 使用 unreadBadge 统一管理，自动广播到所有订阅者
                    unreadBadge.setUnreadCount(nextUnread);

                    // 清除消息列表缓存
                    invalidateMessages({ type: this.activeTab === 'all' ? null : this.activeTab });

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
            const index = e.currentTarget.dataset.index;
            console.log('删除消息:', messageId, index);
            uni.showModal({
                title: '确认删除',
                content: '确定要删除这条消息吗？',
                success: (res) => {
                    if (res.confirm) {
                        console.log('开始删除消息:', messageId);
                        deleteMessageById(messageId, this).then(() => {
                                const messages = this.messages.filter((msg, i) => i !== index);
                                this.messages = messages;
                                // 关闭滑动操作
                                this.closeAllSwipeActions();
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
            uni.showModal({
                title: '清空消息',
                content: '确定要清空所有消息吗？此操作不可恢复。',
                success: (res) => {
                    if (res.confirm) {
                        clearMessages(this).then(() => {
                                this.setData({ messages: [], page: 0, hasMore: false, unreadCount: 0 });

                                // 使用 unreadBadge 清零，自动广播到所有订阅者
                                unreadBadge.clearUnread();

                                // 清除消息列表缓存
                                invalidateMessages();
                                console.log('【messages】清空消息后已清除所有缓存');

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
                'follow': '关注了你'
            };
            return actionMap[type] || '通知了你';
        },


        // 关注回关
        followBack: function (e) {
            const userId = e.currentTarget.dataset.userId;
            const index = e.currentTarget.dataset.index;
            if (userId) {
                toggleFollow(userId, {
                    context: this,
                    pageTag: 'messages:toggle-follow'
                }).then((result) => {
                        // 更新本地数据中的关注状态
                        const updatedMessages = [...this.messages];
                        if (updatedMessages[index]) {
                            updatedMessages[index].isFollowing = result.isFollowing;
                            updatedMessages[index].isMutual = result.isMutual;
                        }
                        this.setData({
                            messages: updatedMessages
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
            const currentUserId = this.getCurrentUserId();
            if (!currentUserId) {
                return;
            }

            const userIds = [...new Set(followMessages.map(msg => msg.fromUserId).filter(Boolean))];
            if (userIds.length === 0) {
                return;
            }

            // 使用批量查询接口，减少云函数调用次数
            followCache.getBatchFollowStatus(currentUserId, userIds).then(statuses => {
                const updatedMessages = [...messages];
                let changed = false;
                
                followMessages.forEach((msg) => {
                    if (!msg.fromUserId) return;
                    const status = statuses[msg.fromUserId];
                    if (status && status.isFollowing !== undefined) {
                        const msgIndex = updatedMessages.findIndex(m => m._id === msg._id);
                        if (msgIndex !== -1 && updatedMessages[msgIndex].isFollowing !== status.isFollowing) {
                            updatedMessages[msgIndex].isFollowing = status.isFollowing;
                            updatedMessages[msgIndex].isMutual = status.isMutual;
                            changed = true;
                        }
                    }
                });
                
                if (changed) {
                    this.setData({
                        messages: updatedMessages
                    });
                }
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
    padding: 0 30rpx;
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
    font-size: 30rpx;
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
    border: none;
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
}

.empty-text {
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
    background-color: #cc9090;
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
    background-color: var(--app-subtle-surface-bg, #f8f9fa);
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
    background-color: #ff6b6b;
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
</style>
