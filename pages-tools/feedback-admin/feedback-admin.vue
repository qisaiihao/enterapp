<template>
    <!-- 管理员反馈查看页面 -->
    <view class="container" :style="'padding-top: ' + statusBarHeight + 'px;'">
        <!-- 头部 -->
        <view class="header" :style="'top: ' + statusBarHeight + 'px;'">
            <view class="header-left" @tap="goBack">
                <text class="back-icon">←</text>
            </view>
            <text class="header-title">反馈管理</text>
            <view class="header-right" @tap="refreshFeedbackList">
                <text class="refresh-icon">🔄</text>
            </view>
        </view>

        <!-- 反馈列表 -->
        <view class="feedback-list">
            <block v-if="feedbackList.length > 0">
                <view :class="'feedback-item ' + (item.isProcessed ? 'processed' : '')" v-for="(item, index) in feedbackList" :key="index">
                    <!-- 反馈头部信息 -->

                    <view class="feedback-header">
                        <view class="user-info">
                            <text class="user-name">{{ item.userName || '匿名用户' }}</text>
                            <text class="feedback-time">{{ item.formattedCreateTime }}</text>
                        </view>
                        <view :class="'status-badge ' + (item.isProcessed ? 'processed' : 'pending')">
                            {{ item.isProcessed ? '已处理' : '待处理' }}
                        </view>
                    </view>

                    <!-- 反馈内容 -->

                    <view class="feedback-content">
                        <text class="content-text">{{ item.content }}</text>
                    </view>

                    <!-- 反馈图片 -->

                    <view v-if="item.imageUrls && item.imageUrls.length > 0" class="feedback-images">
                        <view class="image-grid">
                            <image
                                class="feedback-image"
                                :src="imageUrl"
                                mode="aspectFill"
                                @tap="previewImage"
                                :data-src="imageUrl"
                                :data-urls="item.imageUrls"
                                v-for="(imageUrl, index1) in item.imageUrls"
                                :key="index1"
                            ></image>
                        </view>
                    </view>

                    <!-- 操作按钮 -->

                    <view class="feedback-actions">
                        <button v-if="!item.isProcessed" class="action-btn process-btn" size="mini" @tap="markAsProcessed" :data-id="item._id" :data-index="index">
                            标记已处理
                        </button>
                        <button class="action-btn delete-btn" size="mini" @tap="deleteFeedback" :data-id="item._id" :data-index="index">删除</button>
                    </view>
                </view>
            </block>

            <!-- 空状态 -->
            <view v-else class="empty-state">
                <text class="empty-icon">📝</text>
                <text class="empty-text">暂无反馈</text>
            </view>


            <view v-else-if="!hasMore && feedbackList.length > 0" class="no-more">
                <text>--- 没有更多了 ---</text>
            </view>
        </view>
    </view>
</template>

<script>
// 管理员反馈查看页面
const { formatRelativeTime } = require('../../utils/time.js');
const { previewImage: previewImageUtil } = require('../../utils/imagePreview.js');
const { cloudCall } = require('../../utils/cloudCall.js');
const {
    getFeedbackList: getFeedbackListApi,
    updateFeedbackStatus,
    deleteFeedback: deleteFeedbackApi
} = require('../../api-cache/feedback.js');
export default {
    data() {
        return {
            feedbackList: [],

            // 反馈列表
            loading: false,

            // 加载状态
            hasMore: true,

            // 是否有更多数据
            page: 0,

            // 当前页码
            pageSize: 10,

            // 每页数量
            isAdmin: false,

            // 是否为管理员
            currentUserOpenid: '',

            // 当前用户openid
            // 状态栏高度
            statusBarHeight: 0,

            imageUrl: ''
        };
    },
    onLoad: function () {
        // 获取状态栏高度
        const systemInfo = uni.getSystemInfoSync();
        this.setData({
            statusBarHeight: systemInfo.statusBarHeight
        });

        // 设置CSS变量
        uni.setNavigationBarColor({
            frontColor: '#000000',
            backgroundColor: '#ffffff'
        });
        this.checkAdminPermission();
    },
    onShow: function () {
        // 每次显示时刷新数据
        if (this.isAdmin) {
            this.refreshFeedbackList();
        }
    },
    // 下拉刷新
    onPullDownRefresh: function () {
        this.refreshFeedbackList();
        uni.stopPullDownRefresh();
    },
    // 上拉加载更多
    onReachBottom: function () {
        if (this.hasMore && !this.loading) {
            this.loadFeedbackList();
        }
    },
    methods: {
        // 统一云函数调用方法
        callCloudFunction(name, data = {}, extraOptions = {}) {
            return cloudCall(name, data, Object.assign({ pageTag: 'feedback-admin', context: this }, extraOptions));
        },
        // 检查管理员权限
        async checkAdminPermission() {
            try {
                // 获取当前用户openid
                const openIdResult = await this.callCloudFunction('getOpenId', {});
                if (openIdResult.result && openIdResult.result.openid) {
                    const currentOpenid = openIdResult.result.openid;
                    const adminOpenids = ['ojYBd1_A3uCbQ1LGcHxWxOAeA5SE', 'ojYBd14JG3-ghYuGCI2WHmkMc9nE']; // 管理员openid列表
                    const isAdmin = adminOpenids.includes(currentOpenid);
                    console.log('反馈管理页面 - 当前用户:', currentOpenid);
                    console.log('反馈管理页面 - 是否为管理员:', isAdmin);
                    this.setData({
                        currentUserOpenid: currentOpenid,
                        isAdmin: isAdmin
                    });

                    // 如果不是管理员，显示提示并返回
                    if (!isAdmin) {
                        uni.showModal({
                            title: '权限不足',
                            content: '您没有权限访问反馈管理功能',
                            showCancel: false,
                            success: () => {
                                uni.navigateBack();
                            }
                        });
                        return;
                    }

                    // 是管理员，加载反馈列表
                    this.loadFeedbackList();
                } else {
                    throw new Error('无法获取用户信息');
                }
            } catch (error) {
                console.error('权限检查失败:', error);
                uni.showModal({
                    title: '错误',
                    content: '权限检查失败，无法访问此页面',
                    showCancel: false,
                    success: () => {
                        uni.navigateBack();
                    }
                });
            }
        },

        // 加载反馈列表
        loadFeedbackList: function (isRefresh = false) {
            if (this.loading) {
                return;
            }
            const { page, pageSize } = this;
            const currentPage = isRefresh ? 0 : page;
            this.setData({
                loading: true
            });
            getFeedbackListApi({
                skip: currentPage * pageSize,
                limit: pageSize,
                context: this
            }).then((result) => {
                    const feedbackList = result.feedbackList || [];

                    // 格式化时间
                    feedbackList.forEach((feedback) => {
                        feedback.formattedCreateTime = this.formatTime(feedback.createTime);
                    });
                    const newFeedbackList = isRefresh ? feedbackList : this.feedbackList.concat(feedbackList);
                    this.setData({
                        feedbackList: newFeedbackList,
                        page: currentPage + 1,
                        hasMore: feedbackList.length === pageSize
                    });
                }).catch((err) => {
                    console.error('加载反馈列表失败:', err);
                    uni.showToast({
                        title: err.message || '加载失败',
                        icon: 'none'
                    });
                }).finally(() => {
                    this.setData({
                        loading: false
                    });
                });
        },

        // 刷新反馈列表
        refreshFeedbackList: function () {
            this.setData({
                feedbackList: [],
                page: 0,
                hasMore: true
            });
            this.loadFeedbackList(true);
        },

        // 格式化时间
        formatTime: function (dateString) {
            return formatRelativeTime(dateString);
        },

        // 预览图片
        previewImage: function (event) {
            return previewImageUtil(event, { fallbackToast: false });
        },

        // 删除反馈
        deleteFeedback: function (e) {
            const feedbackId = e.currentTarget.dataset.id;
            const index = e.currentTarget.dataset.index;
            const that = this;
            uni.showModal({
                title: '确认删除',
                content: '确定要删除这条反馈吗？',
                confirmColor: '#ff4d4f',
                success: function (res) {
                    if (res.confirm) {
                        uni.showLoading({
                            title: '删除中...'
                        });
                        deleteFeedbackApi(feedbackId, {
                                context: that
                            }).then(() => {
                                uni.hideLoading();
                                uni.showToast({
                                    title: '删除成功',
                                    icon: 'success'
                                });

                                // 从列表中移除
                                const newList = that.feedbackList.filter((item, i) => i !== index);
                                that.setData({
                                    feedbackList: newList
                                });
                            }).catch((err) => {
                                uni.hideLoading();
                                console.error('删除反馈失败:', err);
                                uni.showToast({
                                    title: err.message || '删除失败',
                                    icon: 'none'
                                });
                            });
                    }
                }
            });
        },

        // 标记为已处理
        markAsProcessed: function (e) {
            const feedbackId = e.currentTarget.dataset.id;
            const index = e.currentTarget.dataset.index;
            const that = this;
            uni.showLoading({
                title: '处理中...'
            });
            updateFeedbackStatus(feedbackId, 'processed', '', {
                    context: this
                }).then(() => {
                    uni.hideLoading();
                    uni.showToast({
                        title: '已标记为处理',
                        icon: 'success'
                    });

                    // 更新列表中的状态
                    that.setData({
                        [`feedbackList[${index}].isProcessed`]: true,
                        [`feedbackList[${index}].processedTime`]: new Date()
                    });
                }).catch((err) => {
                    uni.hideLoading();
                    console.error('标记处理失败:', err);
                    uni.showToast({
                        title: err.message || '操作失败',
                        icon: 'none'
                    });
                });
        },

        // 返回上一页
        goBack: function () {
            uni.navigateBack();
        }
    }
};
</script>
<style>
/* 管理员反馈查看页面样式 */
.container {
    min-height: 100vh;
    background-color: #f5f5f5;
    padding-top: var(--status-bar-height);
}

/* 头部 */
.header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20rpx 30rpx;
    background-color: #fff;
    border-bottom: 1rpx solid #eee;
    position: sticky;
    top: var(--status-bar-height);
    z-index: 100;
}

.header-left,
.header-right {
    width: 60rpx;
    height: 60rpx;
    display: flex;
    align-items: center;
    justify-content: center;
}

.back-icon,
.refresh-icon {
    font-size: 36rpx;
    color: #333;
    font-weight: bold;
}

.header-title {
    font-size: 32rpx;
    font-weight: 600;
    color: #333;
}

/* 反馈列表 */
.feedback-list {
    padding: 20rpx;
}

.feedback-item {
    background-color: #fff;
    border-radius: 16rpx;
    padding: 30rpx;
    margin-bottom: 20rpx;
    box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.1);
}

.feedback-item.processed {
    opacity: 0.7;
    background-color: #f8f8f8;
}

/* 反馈头部 */
.feedback-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20rpx;
}

.user-info {
    display: flex;
    flex-direction: column;
}

.user-name {
    font-size: 28rpx;
    font-weight: 600;
    color: #333;
    margin-bottom: 8rpx;
}

.feedback-time {
    font-size: 24rpx;
    color: #999;
}

.status-badge {
    padding: 8rpx 16rpx;
    border-radius: 20rpx;
    font-size: 22rpx;
    font-weight: 500;
}

.status-badge.pending {
    background-color: #fff2e8;
    color: #fa8c16;
}

.status-badge.processed {
    background-color: #f6ffed;
    color: #52c41a;
}

/* 反馈内容 */
.feedback-content {
    margin-bottom: 20rpx;
}

.content-text {
    font-size: 28rpx;
    color: #333;
    line-height: 1.6;
    white-space: pre-wrap;
}

/* 反馈图片 */
.feedback-images {
    margin-bottom: 20rpx;
}

.image-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 10rpx;
}

.feedback-image {
    width: 120rpx;
    height: 120rpx;
    border-radius: 8rpx;
    background-color: #f0f0f0;
}

/* 操作按钮 */
.feedback-actions {
    display: flex;
    justify-content: flex-end;
    gap: 20rpx;
}

.action-btn {
    border-radius: 20rpx;
    font-size: 24rpx;
    padding: 0 20rpx;
    height: 60rpx;
    line-height: 60rpx;
}

.process-btn {
    background-color: #52c41a;
    color: #fff;
    border: none;
}

.delete-btn {
    background-color: #ff4d4f;
    color: #fff;
    border: none;
}

.action-btn::after {
    border: none;
}

/* 空状态 */
.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 100rpx 0;
}

.empty-icon {
    font-size: 80rpx;
    margin-bottom: 20rpx;
}

.empty-text {
    font-size: 28rpx;
    color: #999;
}

/* 加载状态 */
.loading-more,
.no-more {
    text-align: center;
    padding: 40rpx 0;
    font-size: 24rpx;
    color: #999;
}
</style>
