<template>
    <view>
        <!-- components/folder-selector/folder-selector.wxml -->
        <view v-if="showClone" class="modal-overlay">
            <view class="modal-content">
                <view class="modal-header">
                    <view class="modal-title">选择收藏夹</view>
                    <view class="close-btn" @tap="hideModal">×</view>
                </view>

                <view class="modal-body">
                    <!-- 加载状态 -->
                    <view v-if="isLoading" class="loading-container">
                        <view class="loading-text">加载中...</view>
                    </view>

                    <!-- 收藏夹列表 -->
                    <view v-else-if="folders.length > 0" class="folders-list">
                        <view
                            :class="'folder-item ' + (selectedFolderId === item._id ? 'selected' : '')"
                            :data-folder-id="item._id"
                            @tap="selectFolder"
                            v-for="(item, index) in folders"
                            :key="index"
                        >
                            <view class="folder-icon">📁</view>

                            <view class="folder-info">
                                <view class="folder-name">{{ item.name }}</view>
                                <view class="folder-count">{{ item.itemCount }} 个收藏</view>
                            </view>

                            <view v-if="selectedFolderId === item._id" class="selected-icon">✓</view>
                        </view>
                    </view>

                    <!-- 空状态 -->
                    <view v-else class="empty-state">
                        <view class="empty-icon">📁</view>
                        <view class="empty-text">还没有收藏夹</view>
                        <view class="empty-subtext">先创建一个收藏夹吧</view>
                    </view>
                </view>

                <view class="modal-footer">
                    <button class="modal-btn secondary-btn" @tap="createFolder">创建收藏夹</button>
                    <button class="modal-btn primary-btn" @tap="confirmFavorite" :disabled="!selectedFolderId">确认收藏</button>
                </view>
            </view>
        </view>

        <!-- 创建收藏夹弹窗 -->
        <view v-if="showCreateModal" class="modal-overlay">
            <view class="modal-content create-modal">
                <view class="modal-header">
                    <view class="modal-title">创建收藏夹</view>
                    <view class="close-btn" @tap="hideCreateModal" @tap.stop.prevent="trueFun">×</view>
                </view>

                <view class="modal-body">
                    <input class="folder-name-input" placeholder="请输入收藏夹名称" :value="newFolderName" @input="onFolderNameInput" :focus="true" @tap.stop.prevent="trueFun" />
                </view>

                <view class="modal-footer">
                    <button class="modal-btn secondary-btn" @tap="hideCreateModal">取消</button>
                    <button class="modal-btn primary-btn" @tap="createNewFolder" :disabled="!newFolderName">创建</button>
                </view>
            </view>
        </view>
    </view>
</template>

<script>
// components/folder-selector/folder-selector.js
export default {
    data() {
        return {
            folders: [],
            isLoading: true,
            selectedFolderId: '',
            showCreateModal: false,
            newFolderName: '',
            showClone: false
        };
    },

    props: {
        show: {
            type: Boolean,
            default: false
        },
        postId: {
            type: String,
            default: ''
        }
    },

    watch: {
        show: function (show) {
            if (show) {
                this.loadFolders();
            }
        },

        show: {
            handler: function (newVal, oldVal) {
                this.showClone = newVal;
            },

            immediate: true
        }
    },

    methods: {
        // 兼容性云函数调用方法
        callCloudFunction(name, data = {}) {
            console.log(`🔍 [页面] 调用云函数: ${name}`, data);
            
            return new Promise((resolve, reject) => {
                // 检查运行环境
                const isH5 = typeof window !== 'undefined';
                const isMiniProgram = typeof wx !== 'undefined';
                
                console.log(`🔍 [页面] 运行环境检测 - H5: ${isH5}, 小程序: ${isMiniProgram}`);
                
                if (isH5) {
                    // H5环境使用TCB
                    if (this.$tcb && this.$tcb.callFunction) {
                        console.log(`🔍 [页面] H5环境使用TCB调用云函数: ${name}`);
                        this.$tcb.callFunction({
                            name: name,
                            data: data
                        }).then(resolve).catch(reject);
                    } else {
                        console.error(`❌ [页面] H5环境TCB不可用`);
                        reject(new Error('TCB实例不可用'));
                    }
                } else if (isMiniProgram) {
                    // 小程序环境使用微信云开发
                    if (wx.cloud && wx.cloud.callFunction) {
                        console.log(`🔍 [页面] 小程序环境使用微信云开发调用云函数: ${name}`);
                        wx.cloud.callFunction({
                            name: name,
                            data: data,
                            success: (res) => {
                                console.log(`✅ [页面] 云函数调用成功: ${name}`, res);
                                resolve(res);
                            },
                            fail: (err) => {
                                console.error(`❌ [页面] 云函数调用失败: ${name}`, err);
                                reject(err);
                            }
                        });
                    } else {
                        console.error(`❌ [页面] 小程序环境微信云开发不可用`);
                        reject(new Error('微信云开发不可用'));
                    }
                } else {
                    console.error(`❌ [页面] 未知运行环境`);
                    reject(new Error('未知运行环境'));
                }
            });
        },
        // 加载收藏夹列表
        loadFolders: function () {
            console.log('开始加载收藏夹列表...');
            this.setData({
                isLoading: true
            });
            const openid = this.$requireOpenid && this.$requireOpenid();
            if (!openid) {
                this.setData({
                    isLoading: false,
                    folders: [],
                    selectedFolderId: ''
                });
                return;
            }
            this.callCloudFunction('getMyProfileData', {
                    action: 'getFavoriteFolders',
                    openid
                }).then((res) => {
                    console.log('folder-selector获取收藏夹:', res);
                    if (res.result && res.result.success) {
                        const folders = res.result.folders || [];
                        console.log('获取到收藏夹数量:', folders.length);

                        // 如果当前选中的文件夹不存在了，清空选择
                        const currentSelectedId = this.selectedFolderId;
                        if (currentSelectedId && !folders.some((f) => f._id === currentSelectedId)) {
                            console.log('清空失效的选中状态');
                            this.setData({
                                selectedFolderId: ''
                            });
                        }
                        this.setData({
                            folders: folders,
                            isLoading: false
                        });
                    } else {
                        uni.showToast({
                            title: res.result?.message || '加载失败',
                            icon: 'none'
                        });
                        this.setData({
                            isLoading: false,
                            folders: [],
                            selectedFolderId: '' // 加载失败时清空选择
                        });
                    }
                }).catch((err) => {
                    console.error('获取收藏夹失败:', err);
                    uni.showToast({
                        title: '网络错误',
                        icon: 'none'
                    });
                    this.setData({
                        isLoading: false,
                        folders: [],
                        selectedFolderId: '' // 网络错误时清空选择
                    });
                });
        },

        // 选择收藏夹
        selectFolder: function (e) {
            const folderId = e.currentTarget.dataset.folderId;
            this.setData({
                selectedFolderId: folderId
            });
        },

        // 确认收藏
        confirmFavorite: function () {
            const selectedFolderId = this.selectedFolderId;
            const postId = this.postId;
            console.log('确认收藏，postId:', postId, 'folderId:', selectedFolderId);
            if (!selectedFolderId) {
                uni.showToast({
                    title: '请选择收藏夹',
                    icon: 'none'
                });
                return;
            }
            if (!postId) {
                console.error('postId 为空，无法收藏');
                uni.showToast({
                    title: '参数错误：帖子ID为空',
                    icon: 'none'
                });
                return;
            }
            const openid = this.$requireOpenid && this.$requireOpenid();
            if (!openid) {
                return;
            }
            uni.showLoading({
                title: '收藏中...'
            });
            this.callCloudFunction('getMyProfileData', {
                action: 'addToFavorite',
                postId: postId,
                folderId: selectedFolderId,
                openid
            }).then((res) => {
                    uni.hideLoading();
                    console.log('确认收藏返回结果:', res);
                    if (res && res.result) {
                        if (res.result.success) {
                            uni.showToast({
                                title: '收藏成功'
                            });
                            console.log('收藏成功，开始关闭弹窗');

                            // 确保状态正确重置
                            this.setData({
                                selectedFolderId: ''
                            });

                            // 延迟关闭，确保用户能看到成功提示
                            setTimeout(() => {
                                this.hideModal();
                            }, 1500);

                            // 触发成功事件
                            this.$emit('favoriteSuccess');
                        } else {
                            console.error('收藏业务失败:', res.result);
                            uni.showToast({
                                title: res.result.message || '收藏失败',
                                icon: 'none'
                            });
                        }
                    } else {
                        console.error('收藏返回格式异常:', res);
                        uni.showToast({
                            title: '收藏失败：返回格式错误',
                            icon: 'none'
                        });
                    }
                }).catch((err) => {
                    uni.hideLoading();
                    console.error('收藏云函数调用失败:', err);
                    uni.showToast({
                        title: '网络错误：' + (err.errMsg || '未知错误'),
                        icon: 'none'
                    });
                });
        },

        // 显示创建收藏夹弹窗
        createFolder: function () {
            this.setData({
                showCreateModal: true,
                newFolderName: ''
            });
        },

        // 隐藏创建收藏夹弹窗
        hideCreateModal: function () {
            this.setData({
                showCreateModal: false,
                newFolderName: ''
            });
        },

        // 输入收藏夹名称
        onFolderNameInput: function (e) {
            const value = e.detail.value;
            this.setData({
                newFolderName: value
            });
        },

        // 创建收藏夹
        createNewFolder: function () {
            const folderName = this.newFolderName.trim();
            if (!folderName) {
                uni.showToast({
                    title: '请输入收藏夹名称',
                    icon: 'none'
                });
                return;
            }

            // 实时更新按钮状态
            this.setData({
                newFolderName: folderName
            });
            console.log('组件开始创建收藏夹，名称:', folderName);
            const openid = this.$requireOpenid && this.$requireOpenid();
            if (!openid) {
                return;
            }
            uni.showLoading({
                title: '创建中...'
            });
            this.callCloudFunction('getMyProfileData', {
                action: 'createFavoriteFolder',
                folderName: folderName,
                openid
            }).then((res) => {
                    uni.hideLoading();
                    console.log('组件创建收藏夹返回结果:', res);

                    // 更详细的返回结果检查
                    if (res && res.result) {
                        if (res.result.success) {
                            uni.showToast({
                                title: '创建成功',
                                duration: 2000
                            });
                            this.setData({
                                showCreateModal: false
                            });
                            // 延迟重新加载，确保状态同步
                            setTimeout(() => {
                                this.loadFolders();
                            }, 300);
                        } else {
                            console.error('组件创建收藏夹业务失败:', res.result);
                            uni.showToast({
                                title: res.result.message || '创建失败',
                                icon: 'none',
                                duration: 3000
                            });
                        }
                    } else {
                        console.error('组件创建收藏夹返回格式异常:', res);
                        uni.showToast({
                            title: '创建失败：返回格式错误',
                            icon: 'none',
                            duration: 3000
                        });
                    }
                }).catch((err) => {
                    uni.hideLoading();
                    console.error('组件创建收藏夹云函数调用失败:', err);
                    uni.showToast({
                        title: '创建失败: ' + (err.errMsg || '网络错误'),
                        icon: 'none',
                        duration: 3000
                    });
                });
        },

        // 隐藏弹窗
        hideModal: function () {
            console.log('=== 点击关闭按钮，开始隐藏弹窗 ===');
            console.log('当前状态：', {
                show: this.show,
                showCreateModal: this.showCreateModal,
                selectedFolderId: this.selectedFolderId
            });
            this.setData({
                selectedFolderId: '',
                showClone: false,
                showCreateModal: false,
                // 确保创建弹窗也关闭
                newFolderName: '' // 清空输入框
            });

            console.log('=== 弹窗已隐藏，状态已重置 ===');
            this.$emit('hide');
        },

        trueFun() {
            console.log('占位：函数 true 未声明');
        }
    },

    created: function () {}
};
</script>
<style>
/* components/folder-selector/folder-selector.wxss */
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
    margin: 40rpx;
    width: calc(100% - 80rpx);
    max-width: 600rpx;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
}

.modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 30rpx 40rpx;
    border-bottom: 1rpx solid #f0f0f0;
}

.modal-title {
    font-size: 36rpx;
    font-weight: 500;
    color: #333;
}

.close-btn {
    font-size: 48rpx;
    color: #999;
    line-height: 1;
    position: relative;
    z-index: 1001;
}

.modal-body {
    flex: 1;
    padding: 20rpx 0;
    max-height: 60vh;
    overflow-y: auto;
}

.loading-container {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 200rpx;
}

.loading-text {
    color: #999;
    font-size: 28rpx;
}

.folders-list {
    padding: 0 40rpx;
}

.folder-item {
    display: flex;
    align-items: center;
    padding: 24rpx 0;
    border-bottom: 1rpx solid #f8f8f8;
}

.folder-item:last-child {
    border-bottom: none;
}

.folder-item.selected {
    background: rgba(7, 193, 96, 0.1);
    border-radius: 8rpx;
    padding: 24rpx 20rpx;
    margin: 0 -20rpx;
}

.folder-icon {
    font-size: 40rpx;
    margin-right: 20rpx;
}

.folder-info {
    flex: 1;
}

.folder-name {
    font-size: 30rpx;
    color: #333;
    font-weight: 500;
    margin-bottom: 4rpx;
}

.folder-count {
    font-size: 24rpx;
    color: #999;
}

.selected-icon {
    font-size: 32rpx;
    color: #9ed7ee;
    font-weight: bold;
}

.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 200rpx;
    padding: 40rpx;
}

.empty-icon {
    font-size: 60rpx;
    margin-bottom: 16rpx;
    opacity: 0.5;
}

.empty-text {
    font-size: 28rpx;
    color: #666;
    margin-bottom: 8rpx;
}

.empty-subtext {
    font-size: 24rpx;
    color: #999;
}

.modal-footer {
    display: flex;
    gap: 20rpx;
    padding: 30rpx 40rpx;
    border-top: 1rpx solid #f0f0f0;
}

.modal-btn {
    flex: 1;
    height: 80rpx;
    border-radius: 8rpx;
    font-size: 28rpx;
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    z-index: 1001;
}

.secondary-btn {
    background: #f5f5f5;
    color: #666;
}

.primary-btn {
    background: #9ed7ee;
    color: white;
}

.primary-btn:disabled {
    background: #ccc;
    color: #999;
}

/* 创建收藏夹弹窗样式 */
.create-modal .modal-body {
    padding: 40rpx;
}

.folder-name-input {
    width: 100%;
    height: 80rpx;
    padding: 0 20rpx;
    border: 2rpx solid #e0e0e0;
    border-radius: 8rpx;
    font-size: 30rpx;
    box-sizing: border-box;
}

.folder-name-input:focus {
    border-color: #9ed7ee;
}
</style>
