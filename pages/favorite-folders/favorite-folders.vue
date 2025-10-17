<template>
    <!-- pages/favorite-folders/favorite-folders.wxml -->
    <view class="container">

        <!-- 收藏夹列表 -->
        <view v-else-if="folders.length > 0" class="folders-container">
            <view
                class="folder-item"
                :data-folder-id="item._id"
                :data-folder-name="item.name"
                @tap="enterFolder"
                @longpress="onFolderLongPress"
                v-for="(item, index) in folders"
                :key="index"
            >
                <view class="folder-icon">📁</view>

                <view class="folder-info">
                    <view class="folder-name">{{ item.name }}</view>
                    <view class="folder-meta">
                        <text class="item-count">{{ item.itemCount }} 个收藏</text>
                        <text class="create-time">{{ item.createTime }}</text>
                    </view>
                </view>

                <view class="folder-arrow">></view>
            </view>
        </view>

        <!-- 空状态 -->
        <view v-else class="empty-container">
            <view class="empty-icon">📁</view>
            <view class="empty-text">还没有收藏夹</view>
            <view class="empty-subtext">创建收藏夹来整理你的收藏吧</view>
        </view>

        <!-- 创建收藏夹按钮 -->
        <view class="create-button" @tap="showCreateFolder">
            <view class="create-icon">+</view>
            <text>创建收藏夹</text>
        </view>

        <!-- 创建收藏夹弹窗 -->
        <view v-if="showCreateModal" class="modal-overlay">
            <view class="modal-content">
                <view class="modal-title">创建收藏夹</view>
                <input class="modal-input" placeholder="请输入收藏夹名称" :value="newFolderName" @input="onFolderNameInput" maxlength="20" @tap.stop.prevent="trueFun" />
                <view class="modal-buttons">
                    <button class="modal-btn cancel-btn" @tap="hideCreateModal">取消</button>
                    <button class="modal-btn confirm-btn" @tap="createFolder">创建</button>
                </view>
            </view>
        </view>

        <!-- 编辑收藏夹弹窗 -->
        <view v-if="showEditModal" class="modal-overlay">
            <view class="modal-content">
                <view class="modal-title">重命名收藏夹</view>
                <input class="modal-input" placeholder="请输入收藏夹名称" :value="editFolderName" @input="onEditFolderNameInput" maxlength="20" @tap.stop.prevent="trueFun" />
                <view class="modal-buttons">
                    <button class="modal-btn cancel-btn" @tap="hideEditModal">取消</button>
                    <button class="modal-btn confirm-btn" @tap="updateFolderName">保存</button>
                </view>
            </view>
        </view>
    </view>
</template>

<script>
// pages/favorite-folders/favorite-folders.js
const { cloudCall } = require('../../utils/cloudCall.js');
export default {
    data() {
        return {
            folders: [],
            isLoading: true,
            showCreateModal: false,
            newFolderName: '',
            editingFolder: null,
            showEditModal: false,
            editFolderName: ''
        };
    },
    onLoad: function () {
        console.log('=== 收藏夹列表页面 onLoad ===');
        this.loadFolders();
    },
    onShow: function () {
        console.log('=== 收藏夹列表页面 onShow ===');
        this.loadFolders();
    },
    methods: {
        // 统一云函数调用方法
        callCloudFunction(name, data = {}, extraOptions = {}) {
            return cloudCall(name, data, Object.assign({ pageTag: 'favorite-folders', context: this, requireAuth: true }, extraOptions));
        },
        loadFolders: function () {
            this.setData({
                isLoading: true
            });
            this.callCloudFunction('getMyProfileData', {
                    action: 'getFavoriteFolders'
                }).then((res) => {
                    console.log('获取收藏夹返回数据:', res);
                    if (res.result && res.result.success) {
                        const folders = res.result.folders || [];
                        console.log('收藏夹数据:', folders);

                        // 检查数据结构
                        folders.forEach((folder, index) => {
                            console.log(`收藏夹${index}:`, {
                                _id: folder._id,
                                name: folder.name,
                                itemCount: folder.itemCount,
                                createTime: folder.createTime
                            });
                        });
                        this.setData({
                            folders: folders,
                            isLoading: false
                        });
                    } else {
                        console.error('获取收藏夹失败:', res.result);
                        uni.showToast({
                            title: res.result?.message || '加载失败',
                            icon: 'none'
                        });
                        this.setData({
                            isLoading: false,
                            folders: []
                        });
                    }
                }).catch((err) => {
                    console.error('获取收藏夹失败:', err);
                    uni.showToast({
                        title: '网络错误',
                        icon: 'none'
                    });
                    this.setData({
                        isLoading: false
                    });
                });
        },

        // 显示创建收藏夹弹窗
        showCreateFolder: function () {
            this.setData({
                showCreateModal: true,
                newFolderName: ''
            });
        },

        // 隐藏创建收藏夹弹窗
        hideCreateModal: function () {
            this.setData({
                showCreateModal: false
            });
        },

        // 输入收藏夹名称
        onFolderNameInput: function (e) {
            this.setData({
                newFolderName: e.detail.value
            });
        },

        // 创建收藏夹
        createFolder: function () {
            const folderName = this.newFolderName.trim();
            if (!folderName) {
                uni.showToast({
                    title: '请输入收藏夹名称',
                    icon: 'none'
                });
                return;
            }
            console.log('开始创建收藏夹，名称:', folderName);
            uni.showLoading({
                title: '创建中...'
            });
            this.callCloudFunction('getMyProfileData', {
                    action: 'createFavoriteFolder',
                    folderName: folderName
                }).then((res) => {
                    uni.hideLoading();
                    console.log('创建收藏夹云函数返回:', res);

                    // 更详细的返回结果检查
                    if (res && res.result) {
                        if (res.result.success) {
                            uni.showToast({
                                title: '创建成功'
                            });
                            // 先清空输入框，再关闭弹窗，避免状态混乱
                            this.setData({
                                showCreateModal: false,
                                newFolderName: '' // 清空输入框
                            });
                            // 延迟加载，确保状态更新完成
                            setTimeout(() => {
                                this.loadFolders();
                            }, 300);
                        } else {
                            console.error('创建收藏夹业务失败:', res.result);
                            uni.showToast({
                                title: res.result.message || '创建失败',
                                icon: 'none'
                            });
                        }
                    } else {
                        console.error('创建收藏夹返回格式异常:', res);
                        uni.showToast({
                            title: '创建失败：返回格式错误',
                            icon: 'none'
                        });
                    }
                }).catch((err) => {
                    uni.hideLoading();
                    console.error('创建收藏夹云函数调用失败:', err);
                    uni.showToast({
                        title: '网络错误：' + (err.errMsg || '未知错误'),
                        icon: 'none'
                    });
                });
        },

        // 进入收藏夹
        enterFolder: function (e) {
            console.log('=== 点击收藏夹项 ===');
            console.log('事件对象:', e);
            console.log('dataset:', e.currentTarget.dataset);
            const folderId = e.currentTarget.dataset.folderId;
            const folderName = e.currentTarget.dataset.folderName;
            console.log('提取的folderId:', folderId);
            console.log('提取的folderName:', folderName);
            if (!folderId) {
                console.error('错误：folderId 为空');
                uni.showToast({
                    title: '收藏夹ID为空',
                    icon: 'none'
                });
                return;
            }
            const targetUrl = `/pages/favorite-content/favorite-content?folderId=${folderId}&folderName=${encodeURIComponent(folderName || '')}`;
            console.log('跳转URL:', targetUrl);
            uni.navigateTo({
                url: targetUrl,
                success: function () {
                    console.log('跳转成功');
                },
                fail: function (err) {
                    console.error('跳转失败:', err);
                }
            });
        },

        // 长按收藏夹显示编辑选项
        onFolderLongPress: function (e) {
            const folderId = e.currentTarget.dataset.folderId;
            const folderName = e.currentTarget.dataset.folderName;
            uni.showActionSheet({
                itemList: ['重命名', '删除'],
                success: (res) => {
                    if (res.tapIndex === 0) {
                        // 重命名
                        this.showEditFolder(folderId, folderName);
                    } else if (res.tapIndex === 1) {
                        // 删除
                        this.deleteFolder(folderId, folderName);
                    }
                }
            });
        },

        // 显示编辑收藏夹弹窗
        showEditFolder: function (folderId, folderName) {
            this.setData({
                showEditModal: true,
                editingFolder: folderId,
                editFolderName: folderName
            });
        },

        // 隐藏编辑收藏夹弹窗
        hideEditModal: function () {
            this.setData({
                showEditModal: false,
                editingFolder: null,
                editFolderName: ''
            });
        },

        // 输入编辑的收藏夹名称
        onEditFolderNameInput: function (e) {
            this.setData({
                editFolderName: e.detail.value
            });
        },

        // 更新收藏夹名称
        updateFolderName: function () {
            const folderName = this.editFolderName.trim();
            if (!folderName) {
                uni.showToast({
                    title: '请输入收藏夹名称',
                    icon: 'none'
                });
                return;
            }

            // 这里需要创建一个更新收藏夹名称的云函数
            uni.showToast({
                title: '重命名功能待实现',
                icon: 'none'
            });
            this.hideEditModal();
        },

        // 删除收藏夹
        deleteFolder: function (folderId, folderName) {
            uni.showModal({
                title: '确认删除',
                content: `确定要删除收藏夹"${folderName}"吗？删除后其中的所有收藏内容也会被删除。`,
                success: (res) => {
                    if (res.confirm) {
                        // 这里需要创建一个删除收藏夹的云函数
                        uni.showToast({
                            title: '删除功能待实现',
                            icon: 'none'
                        });
                    }
                }
            });
        },

        trueFun() {
            console.log('占位：函数 true 未声明');
        }
    }
};
</script>
<style>
/* pages/favorite-folders/favorite-folders.wxss */
.container {
    min-height: 100vh;
    background-color: #f5f5f5;
    padding: 20rpx;
}

.loading-container {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 400rpx;
}

.loading-text {
    color: #999;
    font-size: 28rpx;
}

.folders-container {
    padding-bottom: 120rpx;
}

.folder-item {
    display: flex;
    align-items: center;
    background: white;
    border-radius: 16rpx;
    padding: 30rpx;
    margin-bottom: 20rpx;
    box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.1);
}

.folder-icon {
    font-size: 48rpx;
    margin-right: 24rpx;
}

.folder-info {
    flex: 1;
}

.folder-name {
    font-size: 32rpx;
    font-weight: 500;
    color: #333;
    margin-bottom: 8rpx;
}

.folder-meta {
    display: flex;
    align-items: center;
    font-size: 24rpx;
    color: #999;
}

.item-count {
    margin-right: 20rpx;
}

.folder-arrow {
    font-size: 32rpx;
    color: #ccc;
}

.empty-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 400rpx;
}

.empty-icon {
    font-size: 80rpx;
    margin-bottom: 20rpx;
    opacity: 0.5;
}

.empty-text {
    font-size: 32rpx;
    color: #666;
    margin-bottom: 12rpx;
}

.empty-subtext {
    font-size: 26rpx;
    color: #999;
}

.create-button {
    position: fixed;
    bottom: 40rpx;
    right: 40rpx;
    display: flex;
    align-items: center;
    background: #9ed7ee;
    color: white;
    padding: 20rpx 30rpx;
    border-radius: 50rpx;
    box-shadow: 0 4rpx 12rpx rgba(7, 193, 96, 0.3);
    font-size: 28rpx;
}

.create-icon {
    font-size: 32rpx;
    margin-right: 8rpx;
}

/* 弹窗样式 */
.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
}

.modal-content {
    background: white;
    border-radius: 16rpx;
    padding: 40rpx;
    margin: 40rpx;
    width: calc(100% - 80rpx);
    max-width: 500rpx;
    position: relative;
    z-index: 1001;
}

.modal-title {
    font-size: 36rpx;
    font-weight: 500;
    color: #333;
    margin-bottom: 30rpx;
    text-align: center;
}

.modal-input {
    width: 100%;
    height: 80rpx;
    border: 2rpx solid #e0e0e0;
    border-radius: 8rpx;
    padding: 0 20rpx;
    font-size: 28rpx;
    margin-bottom: 30rpx;
    box-sizing: border-box;
}

.modal-input:focus {
    border-color: #9ed7ee;
}

.modal-buttons {
    display: flex;
    gap: 20rpx;
}

.modal-btn {
    flex: 1;
    height: 80rpx;
    border-radius: 8rpx;
    font-size: 28rpx;
    border: none;
    position: relative;
    z-index: 1002;
}

.cancel-btn {
    background: #f5f5f5;
    color: #666;
}

.confirm-btn {
    background: #9ed7ee;
    color: white;
}
</style>
