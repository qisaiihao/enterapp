<template>
    <!-- pages/draft-box/draft-box.wxml -->
    <view class="container">
        <!-- 顶部导航栏 -->
        <view class="header">
            <view class="header-left" @tap="goBack">
                <image class="back-icon-image" src="/static/images/back_to_edit.png" mode="aspectFit"></image>
            </view>
            <text class="header-title">草稿箱</text>
        </view>
        
        <!-- 草稿列表 -->
        <view v-if="drafts.length > 0" class="draft-list" @tap="closeAllDeleteActions">
            <view class="draft-item-wrapper" v-for="(item, index) in drafts" :key="index">
                <view class="draft-item" 
                      @tap.stop="editDraft" 
                      @touchstart="onTouchStart" 
                      @touchmove="onTouchMove" 
                      @touchend="onTouchEnd"
                      :data-draft="item" 
                      :data-index="index"
                      :style="{ transform: `translateX(${item.translateX || 0}px)` }">
                    <view class="draft-content">
                        <view class="draft-title">{{ item.title || '无标题草稿' }}</view>
                        <view class="draft-preview">{{ item.content || '正文内容' }}</view>
                        <view class="draft-meta">
                            <view class="draft-tag">{{ getDraftTag(item) }}</view>
                            <text class="draft-time">编辑于{{ formatEditTime(item.saveTime) }}</text>
                        </view>
                    </view>
                </view>
                <view class="delete-action" 
                      @tap.stop="deleteDraft" 
                      :data-draft-id="item._id"
                      :style="{ opacity: item.showDelete ? 1 : 0 }">
                    <text class="delete-text">删除</text>
                </view>
            </view>
        </view>

        <!-- 空状态 -->
        <view v-else class="empty-container">
            <view class="empty-icon">📝</view>
            <view class="empty-text">草稿箱是空的</view>
            <view class="empty-subtext">去发布一些内容吧</view>
            <button class="create-btn" @tap="goToPublish">开始创作</button>
        </view>
    </view>
</template>

<script>
// pages/draft-box/draft-box.js
const { formatRelativeTime, formatDate } = require('../../utils/time.js');
const { getMyDrafts, deleteDraft: deleteDraftApi } = require('../../api-cache/draft.js');
// 修复：移除全局数据库实例，改为在方法中动态获取
export default {
    data() {
        return {
            drafts: [],
            isLoading: true,
            touchStartX: 0,
            touchStartY: 0,
            currentSwipeIndex: -1
        };
    },
    onLoad: function () {
        this.loadDrafts();
    },
    onShow: function () {
        // 每次显示时重新加载草稿，以防其他页面有更新
        this.loadDrafts();
    },
    methods: {
        // 加载草稿列表
        async loadDrafts() {
    this.setData({
        isLoading: true
    });

    try {
        // 1. 获取响应对象
        const res = await getMyDrafts({
            page: 0,
            pageSize: 20,
            context: this
        });

        console.log('API原始返回:', res);

        // --- 修改开始：增强响应格式兼容性 ---
        // 尝试从不同的响应结构中提取草稿数组
        let rawList = [];

        // 1. 兼容 result.drafts (草稿相关的特定API可能返回这个)
        if (res.result && Array.isArray(res.result.drafts)) {
            rawList = res.result.drafts;
        }
        // 2. 兼容 result.data (标准云数据库查询通常返回这个)
        else if (res.result && Array.isArray(res.result.data)) {
            rawList = res.result.data;
        }
        // 3. 兼容 result 直接是数组的情况
        else if (res.result && Array.isArray(res.result)) {
            rawList = res.result;
        }
        // 4. 兼容响应直接是数组的情况
        else if (Array.isArray(res)) {
            rawList = res;
        }

        // --- 修改结束 ---

        console.log('提取出的草稿数组:', rawList);

        // 3. 对提取出的数组进行 map 操作
        const formattedDrafts = rawList.map((draft) => ({
            ...draft,
            formattedSaveTime: formatRelativeTime(draft.saveTime) || formatDate(draft.saveTime, 'yyyy-MM-dd HH:mm')
        }));

        this.setData({
            drafts: formattedDrafts,
            isLoading: false
        });
    } catch (err) {
        console.error('获取草稿失败:', err);
        this.setData({
            isLoading: false
        });
        uni.showToast({
            title: err.message || '加载草稿失败',
            icon: 'none'
        });
    }
},

        // 编辑草稿
        editDraft: function (e) {
            const draft = e.currentTarget.dataset.draft;
            if (!draft) {
                return;
            }

            // 将草稿数据存储到本地，供发布页使用
            try {
                uni.setStorageSync('editing_draft', draft);
                uni.navigateTo({
                    url: '/pages/add/add?mode=edit'
                });
            } catch (error) {
                console.log('CatchClause', error);
                console.log('CatchClause', error);
                console.error('存储草稿数据失败:', error);
                uni.showToast({
                    title: '打开草稿失败',
                    icon: 'none'
                });
            }
        },

        // 删除草稿
        async deleteDraft(e) {
            const draftId = e.currentTarget.dataset.draftId;
            if (!draftId) {
                return;
            }

            return new Promise((resolve) => {
                uni.showModal({
                    title: '删除草稿',
                    content: '确定要删除这个草稿吗？',
                    confirmColor: '#ff4d4f',
                    success: async (res) => {
                        if (!res.confirm) {
                            resolve();
                            return;
                        }

                        try {
                            uni.showLoading({
                                title: '删除中...'
                            });

                            const result = await deleteDraftApi(draftId, { context: this });

                            uni.hideLoading();
                            uni.showToast({
                                title: '删除成功',
                                icon: 'success'
                            });

                            // 重新加载草稿列表
                            await this.loadDrafts();
                        } catch (err) {
                            uni.hideLoading();
                            console.error('删除草稿失败:', err);
                            uni.showToast({
                                title: err.message || '删除失败',
                                icon: 'none'
                            });
                        } finally {
                            resolve();
                        }
                    }
                });
            });
        },

        // 去发布页面
        goToPublish: function () {
            uni.navigateTo({
                url: '/pages/add/add'
            });
        },

        // 返回上一页
        goBack: function () {
            const pages = getCurrentPages();
            if (pages.length > 1) {
                uni.navigateBack({
                    delta: 1,
                    fail: () => {
                        uni.switchTab({
                            url: '/pages/index/index'
                        });
                    }
                });
            } else {
                uni.switchTab({
                    url: '/pages/index/index'
                });
            }
        },

        // 兼容旧调用签名
        formatTime: function (timestamp) {
            return formatRelativeTime(timestamp) || formatDate(timestamp, 'yyyy-MM-dd HH:mm');
        },

        // 获取草稿标签
        getDraftTag: function(draft) {
            if (draft.publishMode === 'poem') {
                return draft.isOriginal ? '原创诗歌' : '诗歌分享';
            }
            return '帖子';
        },

        // 格式化编辑时间
        formatEditTime: function(timestamp) {
            const date = new Date(timestamp);
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        },

        // 触摸开始
        onTouchStart: function(e) {
            this.touchStartX = e.touches[0].clientX;
            this.touchStartY = e.touches[0].clientY;
        },

        // 触摸移动
        onTouchMove: function(e) {
            const currentX = e.touches[0].clientX;
            const currentY = e.touches[0].clientY;
            const deltaX = currentX - this.touchStartX;
            const deltaY = currentY - this.touchStartY;
            
            // 如果是垂直滑动，不处理
            if (Math.abs(deltaY) > Math.abs(deltaX)) {
                return;
            }
            
            const index = parseInt(e.currentTarget.dataset.index);
            const draft = this.drafts[index];
            
            if (deltaX < 0) { // 左滑
                const translateX = Math.max(deltaX, -160); // 限制最大滑动距离
                this.$set(this.drafts, index, {
                    ...draft,
                    translateX: translateX,
                    showDelete: translateX < -80
                });
            } else { // 右滑
                const translateX = Math.min(deltaX, 0);
                this.$set(this.drafts, index, {
                    ...draft,
                    translateX: translateX,
                    showDelete: false
                });
            }
        },

        // 触摸结束
        onTouchEnd: function(e) {
            const index = parseInt(e.currentTarget.dataset.index);
            const draft = this.drafts[index];
            
            if (draft.translateX < -80) {
                // 显示删除按钮
                this.$set(this.drafts, index, {
                    ...draft,
                    translateX: -160,
                    showDelete: true
                });
                this.currentSwipeIndex = index;
            } else {
                // 隐藏删除按钮
                this.$set(this.drafts, index, {
                    ...draft,
                    translateX: 0,
                    showDelete: false
                });
                this.currentSwipeIndex = -1;
            }
        },

        // 关闭所有删除按钮
        closeAllDeleteActions: function() {
            this.drafts.forEach((draft, index) => {
                if (draft.showDelete) {
                    this.$set(this.drafts, index, {
                        ...draft,
                        translateX: 0,
                        showDelete: false
                    });
                }
            });
            this.currentSwipeIndex = -1;
        }
    }
};
</script>
<style>
/* pages/draft-box/draft-box.wxss */
.container {
    background-color: #fff;
    min-height: 100vh;
}

.header {
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    padding: 20rpx 30rpx;
    background: #fff;
    border-bottom: 1rpx solid #e9ecef;
}

.header-left {
    position: absolute;
    left: 30rpx;
    width: 60rpx;
    height: 60rpx;
    display: flex;
    align-items: center;
    justify-content: center;
}

.back-icon-image {
    width: 72rpx;
    height: 72rpx;
    margin-top: 4rpx;
}

.header-title {
    font-size: 36rpx;
    font-weight: 600;
    color: #333;
}

.draft-list {
    display: flex;
    flex-direction: column;
}

.draft-item-wrapper {
    position: relative;
    border-bottom: 1rpx solid #f0f0f0;
}

.draft-item {
    background: #fff;
    padding: 30rpx;
    transition: transform 0.3s ease;
    position: relative;
    z-index: 2;
}

.draft-content {
    width: 100%;
}

.draft-title {
    font-size: 32rpx;
    font-weight: 600;
    color: #333;
    margin-bottom: 15rpx;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.draft-preview {
    font-size: 28rpx;
    color: #666;
    line-height: 1.6;
    margin-bottom: 20rpx;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
}

.draft-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.draft-tag {
    background: #f5f5f5;
    color: #666;
    padding: 6rpx 16rpx;
    border-radius: 20rpx;
    font-size: 24rpx;
    font-weight: 400;
}

.draft-time {
    font-size: 24rpx;
    color: #999;
}

.delete-action {
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    width: 160rpx;
    background: #CC9090;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1;
    transition: opacity 0.3s ease;
}

.delete-text {
    color: #fff;
    font-size: 32rpx;
    font-weight: 500;
}

/* 空状态样式 */
.empty-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 200rpx 40rpx;
    text-align: center;
}

.empty-icon {
    font-size: 120rpx;
    margin-bottom: 30rpx;
    opacity: 0.6;
}

.empty-text {
    font-size: 32rpx;
    color: #666;
    margin-bottom: 15rpx;
}

.empty-subtext {
    font-size: 28rpx;
    color: #999;
    margin-bottom: 40rpx;
}

.create-btn {
    background: #9ed7ee;
    color: white;
    border: none;
    border-radius: 50rpx;
    padding: 20rpx 40rpx;
    font-size: 28rpx;
    transition: all 0.2s ease;
}

.create-btn:active {
    background: #06ad56;
    transform: scale(0.95);
}
</style>
