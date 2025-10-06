<template>
    <!-- pages/draft-box/draft-box.wxml -->
    <view class="container">
        <!-- 草稿列表 -->
        <view v-if="drafts.length > 0" class="draft-list">
            <view class="draft-item" @tap="editDraft" :data-draft="item" v-for="(item, index) in drafts" :key="index">
                <view class="draft-content">
                    <view class="draft-title">{{ item.title || '无标题' }}</view>
                    <view class="draft-preview">{{ item.content || '无内容' }}</view>
                    <view class="draft-meta">
                        <text class="draft-time">{{ item.formattedSaveTime }}</text>
                        <text class="draft-mode">{{ item.publishMode === 'poem' ? '诗歌' : '普通' }}</text>
                        <text v-if="item.isOriginal" class="draft-original">原创</text>
                    </view>
                </view>

                <view class="draft-actions">
                    <button class="action-btn edit-btn" size="mini" @tap.stop.prevent="editDraft" :data-draft="item">编辑</button>
                    <button class="action-btn delete-btn" size="mini" @tap.stop.prevent="deleteDraft" :data-draft-id="item._id">删除</button>
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
// 修复：移除全局数据库实例，改为在方法中动态获取
export default {
    data() {
        return {
            drafts: [],
            isLoading: true
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
        // 兼容性云函数调用方法
        callCloudFunction(name, data = {}) {
            console.log(`🔍 [草稿箱页] 调用云函数: ${name}`, data);
            
            return new Promise((resolve, reject) => {
                // 使用新的平台检测工具
                const { getCurrentPlatform, getCloudFunctionMethod } = require('../../utils/platformDetector.js');
                
                const platform = getCurrentPlatform();
                const method = getCloudFunctionMethod();
                
                console.log(`🔍 [草稿箱页] 运行环境检测 - 平台: ${platform}, 方法: ${method}`);
                
                if (method === 'tcb') {
                    // 使用TCB调用云函数（H5和App环境）
                    if (this.$tcb && this.$tcb.callFunction) {
                        console.log(`🔍 [草稿箱页] TCB环境调用云函数: ${name}`);
                        this.$tcb.callFunction({
                            name: name,
                            data: data
                        }).then(resolve).catch(reject);
                    } else {
                        console.error(`❌ [草稿箱页] TCB实例不可用`);
                        reject(new Error('TCB实例不可用'));
                    }
                } else if (method === 'wx-cloud') {
                    // 使用微信云开发调用云函数（小程序环境）
                    if (wx.cloud && wx.cloud.callFunction) {
                        console.log(`🔍 [草稿箱页] 小程序环境调用云函数: ${name}`);
                        wx.cloud.callFunction({
                            name: name,
                            data: data,
                            success: (res) => {
                                console.log(`✅ [草稿箱页] 云函数调用成功: ${name}`, res);
                                resolve(res);
                            },
                            fail: (err) => {
                                console.error(`❌ [草稿箱页] 云函数调用失败: ${name}`, err);
                                reject(err);
                            }
                        });
                    } else {
                        console.error(`❌ [草稿箱页] 微信云开发不可用`);
                        reject(new Error('微信云开发不可用'));
                    }
                } else {
                    console.error(`❌ [草稿箱页] 不支持的云函数调用方式: ${method}`);
                    reject(new Error(`不支持的云函数调用方式: ${method}`));
                }
            });
        },
        // 加载草稿列表
        loadDrafts: function () {
            this.setData({
                isLoading: true
            });
            const openid = this.$requireOpenid && this.$requireOpenid();
            if (!openid) {
                this.setData({
                    isLoading: false
                });
                return;
            }
            this.callCloudFunction('getMyProfileData', {
                    action: 'getDrafts',
                    openid
                }).then((res) => {
                    console.log('获取草稿列表结果:', res);
                    if (res.result && res.result.success) {
                        const drafts = res.result.drafts || [];
                        // 格式化时间
                        const formattedDrafts = drafts.map((draft) => ({
                            ...draft,
                            formattedSaveTime: this.formatTime(draft.saveTime)
                        }));
                        this.setData({
                            drafts: formattedDrafts,
                            isLoading: false
                        });
                    } else {
                        console.error('获取草稿失败:', res.result);
                        this.setData({
                            isLoading: false
                        });
                        uni.showToast({
                            title: '加载草稿失败',
                            icon: 'none'
                        });
                    }
                }).catch((err) => {
                    console.error('获取草稿失败:', err);
                    this.setData({
                        isLoading: false
                    });
                    uni.showToast({
                        title: '网络错误',
                        icon: 'none'
                    });
                });
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
        deleteDraft: function (e) {
            const draftId = e.currentTarget.dataset.draftId;
            if (!draftId) {
                return;
            }
            uni.showModal({
                title: '删除草稿',
                content: '确定要删除这个草稿吗？',
                confirmColor: '#ff4d4f',
                success: (res) => {
                    if (!res.confirm) {
                        return;
                    }
                    const openid = this.$requireOpenid && this.$requireOpenid();
                    if (!openid) {
                        return;
                    }
                    uni.showLoading({
                        title: '删除中...'
                    });
                    this.callCloudFunction('getMyProfileData', {
                            action: 'deleteDraft',
                            draftId: draftId,
                            openid
                        }).then((result) => {
                            uni.hideLoading();
                            if (result.result && result.result.success) {
                                uni.showToast({
                                    title: '删除成功',
                                    icon: 'success'
                                });
                                // 重新加载草稿列表
                                this.loadDrafts();
                            } else {
                                uni.showToast({
                                    title: result.result?.message || '删除失败',
                                    icon: 'none'
                                });
                            }
                        }).catch((err) => {
                            uni.hideLoading();
                            console.error('删除草稿失败:', err);
                            uni.showToast({
                                title: '删除失败',
                                icon: 'none'
                            });
                        });
                }
            });
        },

        // 去发布页面
        goToPublish: function () {
            uni.navigateTo({
                url: '/pages/add/add'
            });
        },

        // 格式化时间
        formatTime: function (timestamp) {
            if (!timestamp) {
                return '未知时间';
            }
            const date = new Date(timestamp);
            const now = new Date();
            const diff = now - date;

            // 小于1分钟
            if (diff < 60000) {
                return '刚刚';
            }

            // 小于1小时
            if (diff < 3600000) {
                return Math.floor(diff / 60000) + '分钟前';
            }

            // 小于1天
            if (diff < 86400000) {
                return Math.floor(diff / 3600000) + '小时前';
            }

            // 小于7天
            if (diff < 604800000) {
                return Math.floor(diff / 86400000) + '天前';
            }

            // 超过7天显示具体日期
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hour = String(date.getHours()).padStart(2, '0');
            const minute = String(date.getMinutes()).padStart(2, '0');
            if (year === now.getFullYear()) {
                return `${month}-${day} ${hour}:${minute}`;
            } else {
                return `${year}-${month}-${day} ${hour}:${minute}`;
            }
        }
    }
};
</script>
<style>
/* pages/draft-box/draft-box.wxss */
.container {
    padding: 20rpx;
    background-color: #f7f8fa;
    min-height: 100vh;
}

.draft-list {
    display: flex;
    flex-direction: column;
    gap: 20rpx;
}

.draft-item {
    background: #fff;
    border-radius: 16rpx;
    padding: 30rpx;
    box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.05);
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    transition: all 0.2s ease;
}

.draft-item:active {
    transform: scale(0.98);
    box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.1);
}

.draft-content {
    flex: 1;
    margin-right: 20rpx;
}

.draft-title {
    font-size: 32rpx;
    font-weight: 600;
    color: #333;
    margin-bottom: 10rpx;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.draft-preview {
    font-size: 28rpx;
    color: #666;
    line-height: 1.5;
    margin-bottom: 15rpx;
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
    gap: 20rpx;
    font-size: 24rpx;
    color: #999;
}

.draft-time {
    flex-shrink: 0;
}

.draft-mode {
    background: #e3f2fd;
    color: #1976d2;
    padding: 4rpx 12rpx;
    border-radius: 12rpx;
    font-size: 22rpx;
}

.draft-original {
    background: #e8f5e8;
    color: #4caf50;
    padding: 4rpx 12rpx;
    border-radius: 12rpx;
    font-size: 22rpx;
}

.draft-actions {
    display: flex;
    flex-direction: column;
    gap: 10rpx;
    flex-shrink: 0;
}

.action-btn {
    min-width: 120rpx;
    height: 60rpx;
    line-height: 60rpx;
    border-radius: 8rpx;
    font-size: 24rpx;
    border: none;
    transition: all 0.2s ease;
}

.edit-btn {
    background: #9ed7ee;
    color: white;
}

.edit-btn:active {
    background: #06ad56;
}

.delete-btn {
    background: #ff4d4f;
    color: white;
}

.delete-btn:active {
    background: #d9363e;
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
