<template>
    <view>
        <!-- folder-selector-container -->
        <view class="folder-selector-container">
            <!-- components/folder-selector/folder-selector.wxml -->
            <view v-if="showClone" class="modal-overlay" @tap="hideModal">
                <view class="modal-content" @tap.stop="trueFun">
                    <view class="modal-header">
                        <view class="modal-title">添加收藏</view>
                        <view class="create-btn" @tap="createFolder">创建</view>
                    </view>

                    <view class="modal-body">
                        <!-- 加载状态 -->
                        <view v-if="isLoading" class="loading-container">
                            <view class="loading-text">加载中...</view>
                        </view>

                        <!-- 收藏夹列表 -->
                        <view v-else-if="folders.length > 0" class="folders-list">
                            <view class="folder-item-wrapper" v-for="(item, index) in folders" :key="index">
                                <!-- 左滑操作按钮 -->
                                <view class="swipe-actions" :class="{ 'swipe-actions-show': item.isSwipeOpen }">
                                    <view class="action-btn delete-btn" @tap.stop="deleteFolder" :data-folderid="item._id" :data-index="index">
                                        <text>删除</text>
                                    </view>
                                </view>

                                <!-- 收藏夹内容 -->
                                <view class="folder-item"
                                      :class="{ 'selected': selectedFolderId === item._id, 'swipe-open': item.isSwipeOpen }"
                                      :data-folder-id="item._id"
                                      @tap="selectFolder"
                                      @touchstart="onTouchStart"
                                      @touchmove="onTouchMove"
                                      @touchend="onTouchEnd"
                                      :data-index="index">
                                    <view class="folder-icon">
                                        <image v-if="item.coverUrl" class="folder-cover-image" :src="item.coverUrl" mode="aspectFill"></image>
                                        <image v-else class="folder-default-icon-img" src="/static/images/newicons/collection.png" mode="aspectFit"></image>
                                    </view>

                                    <view class="folder-info">
                                        <view class="folder-name">{{ item.name }}</view>
                                        <view class="folder-count">{{ ((item.itemCount !== undefined && item.itemCount !== null) ? item.itemCount : item.postCount) === 0 ? '空空如也~' : (((item.itemCount !== undefined && item.itemCount !== null) ? item.itemCount : item.postCount) || 0) + '个内容' }}</view>
                                    </view>

                                    <view class="folder-meta">
                                        <view v-if="item.isRecent" class="recent-tag">最近使用</view>
                                        <view class="create-time">创建于{{ formatDate(item.createTime) }}</view>
                                    </view>
                                </view>
                            </view>
                        </view>

                        <!-- 空状态 -->
                        <view v-else class="empty-state">
                            <image class="empty-icon-img" src="/static/images/newicons/collection.png" mode="aspectFit"></image>
                            <view class="empty-text">还没有收藏夹</view>
                            <view class="empty-subtext">先创建一个收藏夹吧</view>
                        </view>
                    </view>

                    <view class="modal-footer">
                        <button class="modal-btn secondary-btn" @tap="hideModal">取消</button>
                    </view>
                </view>
            </view>

            <!-- 创建收藏夹弹窗 -->
            <view v-if="showCreateModal" class="modal-overlay" @tap="hideCreateModal">
                <view class="modal-content create-modal" @tap.stop="trueFun">
                    <view class="modal-header">
                        <view class="modal-title">创建收藏夹</view>
                        <view class="close-btn" @tap="hideCreateModal" @tap.stop.prevent="trueFun">×</view>
                    </view>

                    <view class="modal-body">
                        <view class="create-folder-form">
                            <view class="form-item">
                                <view class="form-label">收藏夹名称</view>
                                <input class="folder-name-input" placeholder="请输入收藏夹名称" :value="newFolderName" @input="onFolderNameInput" :focus="true" @tap.stop.prevent="trueFun" />
                            </view>

                            <view class="form-item">
                                <view class="form-label">收藏夹封面</view>
                                <view class="cover-upload-section">
                                    <view v-if="!newFolderCover" class="cover-upload-btn" @tap="chooseCoverImage">
                                        <image class="upload-icon-img" src="/static/images/newicons/image.png" mode="aspectFit"></image>
                                        <view class="upload-text">选择封面</view>
                                    </view>
                                    <view v-else class="cover-preview" @tap="chooseCoverImage">
                                        <image class="cover-image" :src="newFolderCover" mode="aspectFill"></image>
                                        <view class="cover-overlay">
                                            <view class="change-text">更换封面</view>
                                        </view>
                                    </view>
                                </view>
                            </view>
                        </view>
                    </view>

                    <view class="modal-footer create-footer">
                        <button class="modal-btn outline-btn" @tap="hideCreateModal">取消</button>
                        <button class="modal-btn outline-btn" @tap="createNewFolder" :disabled="!newFolderName">创建</button>
                    </view>
                </view>
            </view>
        </view>

        <!-- 删除确认弹窗 -->
        <view v-if="showDeleteConfirm" class="delete-confirm-overlay" @tap="cancelDelete">
            <view class="delete-confirm-modal" @tap.stop>
                <view class="delete-confirm-header">
                    <view class="delete-confirm-title">确认删除</view>
                </view>
                <view class="delete-confirm-content">
                    <view class="delete-confirm-text">
                        确定要删除收藏夹"{{ deleteFolderInfo && deleteFolderInfo.folder.name }}"吗？
                    </view>
                    <view class="delete-confirm-warning">删除后无法恢复</view>
                </view>
                <view class="delete-confirm-footer">
                    <button class="delete-confirm-btn cancel-btn" @tap="cancelDelete">取消</button>
                    <button class="delete-confirm-btn confirm-btn" @tap="confirmDelete">删除</button>
                </view>
            </view>
        </view>
    </view>
</template>

<script>
// components/folder-selector/folder-selector.js
import { cloudCall } from '../../utils/cloudCall.js';
import { emitFavoriteChanged } from '@/utils/events.js';
import { readFileAsBase64 } from '../../utils/fileReader.js';
export default {
    data() {
        return {
            folders: [],
            isLoading: true,
            showCreateModal: false,
            newFolderName: '',
            newFolderCover: '',
            showClone: false,
            selectedFolderId: '',
            // 触摸相关
            touchStartX: 0,
            touchCurrentX: 0,
            touchStartY: 0,
            touchCurrentY: 0,
            isSwipeMode: false,
            // 删除确认弹窗
            showDeleteConfirm: false,
            deleteFolderInfo: null
        };
    },
    emits: ['favoriteSuccess', 'hide'],
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
        show: {
            handler: function (newVal, oldVal) {
                this.showClone = newVal;
                if (newVal) {
                    this.loadFolders();
                }
            },
            immediate: true
        }
    },

    methods: {
        // 统一云函数调用方法
        callCloudFunction(name, data = {}, extraOptions = {}) {
            return cloudCall(name, data, Object.assign({ pageTag: 'folder-selector', context: this, requireAuth: true }, extraOptions));
        },

        // 触摸开始
        onTouchStart(e) {
            const touch = e.touches[0];
            this.touchStartX = touch.pageX || touch.clientX;
            this.touchStartY = touch.pageY || touch.clientY;
            this.touchCurrentX = this.touchStartX;
            this.touchCurrentY = this.touchStartY;
            this.isSwipeMode = false;
        },

        // 触摸移动
        onTouchMove(e) {
            const touch = e.touches[0];
            this.touchCurrentX = touch.pageX || touch.clientX;
            this.touchCurrentY = touch.pageY || touch.clientY;
            
            const deltaX = this.touchCurrentX - this.touchStartX;
            const deltaY = Math.abs(this.touchCurrentY - this.touchStartY);
            
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
            
            // 如果水平滑动距离大于垂直滑动距离
            if (Math.abs(deltaX) > deltaY) {
                if (deltaX < -30) {
                    // 向左滑动超过30px，显示操作按钮
                    const index = parseInt(e.currentTarget.dataset.index);
                    this.openSwipeActions(index);
                } else {
                    // 滑动距离不够，关闭所有滑动操作
                    this.closeAllSwipeActions();
                }
            }
        },

        // 打开滑动操作
        openSwipeActions(index) {
            const updatedFolders = this.folders.map((folder, i) => {
                if (i === index) {
                    return { ...folder, isSwipeOpen: true };
                } else {
                    return { ...folder, isSwipeOpen: false };
                }
            });
            this.folders = updatedFolders;
        },

        // 关闭所有滑动操作
        closeAllSwipeActions() {
            const updatedFolders = this.folders.map(folder => ({
                ...folder,
                isSwipeOpen: false
            }));
            this.folders = updatedFolders;
        },

        // 删除收藏夹
        deleteFolder(e) {
            const folderId = e.currentTarget.dataset.folderid;
            const index = e.currentTarget.dataset.index;
            const folder = this.folders[index];
            // 显示自定义确认弹窗
            this.setData({
                showDeleteConfirm: true,
                deleteFolderInfo: {
                    folderId: folderId,
                    index: index,
                    folder: folder
                }
            });
        },

        // 确认删除
        confirmDelete() {
            const { folderId, index, folder } = this.deleteFolderInfo;
            this.callCloudFunction('deleteFavoriteFolder', {
                folderId
            }).then((res) => {
                console.log('删除收藏夹云函数返回:', res);
                if (res.result && res.result.success) {
                    // 从列表中移除
                    this.folders.splice(index, 1);
                    // 关闭滑动操作
                    this.closeAllSwipeActions();
                    // 关闭确认弹窗
                    this.setData({
                        showDeleteConfirm: false,
                        deleteFolderInfo: null
                    });
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
                console.error('删除收藏夹失败:', err);
                uni.showToast({
                    title: '删除失败',
                    icon: 'none'
                });
            });
        },

        // 取消删除
        cancelDelete() {
            this.setData({
                showDeleteConfirm: false,
                deleteFolderInfo: null
            });
        },
        // 加载收藏夹列表
        loadFolders: function () {
            this.setData({
                isLoading: true
            });
            const openid = this.$requireOpenid && this.$requireOpenid();

            if (!openid) {
                console.log('openid为空，停止加载');
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
                    if (res.result && res.result.success) {
                        const folders = res.result.folders || [];

                        // 为每个收藏夹添加isSwipeOpen字段
                        const foldersWithSwipe = folders.map(folder => ({
                            ...folder,
                            isSwipeOpen: false
                        }));

                        this.setData({
                            folders: foldersWithSwipe,
                            isLoading: false
                        });
                    } else {
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
                        isLoading: false,
                        folders: []
                    });
                });
        },

        // 选择收藏夹并直接收藏
        selectFolder: function (e) {
            const folderId = e.currentTarget.dataset.folderId;
            const postId = this.postId;
            
            console.log('直接收藏，postId:', postId, 'folderId:', folderId);
            
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
                folderId: folderId,
                openid
            }).then((res) => {
                uni.hideLoading();
                if (res && res.result) {
                    if (res.result.success) {
                        uni.showToast({
                            title: '收藏成功'
                        });

                        // 确保状态正确重置

                        // 延迟关闭，确保用户能看到成功提示
                        setTimeout(() => {
                            this.hideModal();
                        }, 1500);

                        // 触发成功事件
                        this.$emit('favoriteSuccess');
                        try {
                            const appInstance = getApp();
                            const userId = appInstance && appInstance.globalData && appInstance.globalData.openid;
                            emitFavoriteChanged({ userId, postId, favored: true });
                        } catch (e) {}
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
            const openid = this.$requireOpenid && this.$requireOpenid();
            if (!openid) {
                return;
            }
            // 先上传封面图片（如果有的话）
            this.uploadCoverImage().then((coverUrl) => {
                uni.showLoading({
                    title: '创建中...'
                });
                
                this.callCloudFunction('createFavoriteFolder', {
                    folderName: folderName,
                    coverUrl: coverUrl,
                    openid
                }).then((res) => {
                    uni.hideLoading();

                    // 更详细的返回结果检查
                    if (res && res.result) {
                        if (res.result.success) {
                            uni.showToast({
                                title: '创建成功',
                                duration: 2000
                            });
                            this.setData({
                                showCreateModal: false,
                                newFolderName: '',
                                newFolderCover: ''
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
            }).catch((err) => {
                console.error('上传封面图片失败:', err);
                uni.showToast({
                    title: '上传封面失败',
                    icon: 'none'
                });
            });
        },

        // 隐藏弹窗
        hideModal: function () {
            console.log('=== 点击关闭按钮，开始隐藏弹窗 ===');
            console.log('当前状态：', {
                show: this.show,
                showCreateModal: this.showCreateModal
            });
            this.setData({
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
        },

        // 格式化日期
        formatDate(dateString) {
            if (!dateString) return '';
            const date = new Date(dateString);
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        },

        // 选择封面图片
        chooseCoverImage() {
            uni.chooseImage({
                count: 1,
                sizeType: ['compressed'],
                sourceType: ['album', 'camera'],
                success: (res) => {
                    const tempFilePath = res.tempFilePaths[0];
                    console.log('选择的封面图片:', tempFilePath);
                    this.setData({
                        newFolderCover: tempFilePath
                    });
                },
                fail: (err) => {
                    console.error('选择图片失败:', err);
                    uni.showToast({
                        title: '选择图片失败',
                        icon: 'none'
                    });
                }
            });
        },

        // 上传封面图片
        uploadCoverImage() {
            return new Promise((resolve, reject) => {
                if (!this.newFolderCover) {
                    resolve(null);
                    return;
                }

                const timestamp = new Date().getTime();
                const cloudPath = `folder_covers/${timestamp}_cover.jpg`;
                
                uni.showLoading({
                    title: '上传封面中...'
                });

                readFileAsBase64(this.newFolderCover).then((base64) => {
                    this.callCloudFunction('upload', {
                        cloudPath: cloudPath,
                        fileContent: base64
                    }).then((uploadRes) => {
                        uni.hideLoading();
                        console.log('上传云函数返回结果:', uploadRes);

                        if (uploadRes && uploadRes.result && uploadRes.result.success) {
                            console.log('封面图片上传成功:', uploadRes.result.fileID);
                            resolve(uploadRes.result.fileID);
                        } else {
                            reject(new Error('上传失败'));
                        }
                    }).catch((err) => {
                        uni.hideLoading();
                        console.error('上传封面图片失败:', err);
                        reject(err);
                    });
                }).catch((err) => {
                    uni.hideLoading();
                    console.error('读取图片文件失败:', err);
                    reject(new Error('读取图片失败'));
                });
            });
        }
    },

    created: function () {
        console.log('folder-selector组件创建，初始isLoading状态:', this.isLoading);
        // 如果组件创建时show为true，立即加载数据
        if (this.show) {
            console.log('组件创建时show为true，开始加载收藏夹');
            this.loadFolders();
        }
    }
};
</script>
<style>
/* components/folder-selector/folder-selector.wxss */

/* 组件容器 */
.folder-selector-container {
    position: relative;
}

.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.1);
    display: flex;
    align-items: flex-end;
    justify-content: center;
    z-index: 1000;
}

.modal-content {
    background: #ffffff;
    border-top-left-radius: 30rpx;
    border-top-right-radius: 30rpx;
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
    margin: 0;
    width: 100%;
    max-width: none;
    max-height: 60vh;
    min-height: 40vh;
    display: flex;
    flex-direction: column;
    animation: slideUp 0.3s ease;
}

.modal-header {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20rpx 40rpx;
    border-bottom: none;
    position: relative;
}

.modal-title {
    font-size: 32rpx;
    font-weight: 500;
    color: #000000;
    text-align: center;
}

.close-btn {
    font-size: 48rpx;
    color: #999;
    line-height: 1;
    cursor: pointer;
    position: absolute;
    right: 40rpx;
    top: 50%;
    transform: translateY(-50%);
}

.create-btn {
    font-size: 26rpx;
    font-weight: normal;
    color: #989090;
    cursor: pointer;
    position: absolute;
    right: 40rpx;
    top: 50%;
    transform: translateY(-50%);
    padding: 20rpx;
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
    display: flex;
    flex-direction: column;
    gap: 20rpx;
}

.folder-item {
    display: flex;
    align-items: center;
    padding: 20rpx 0;
    border-bottom: none;
    position: relative;
}

.folder-item:last-child {
    border-bottom: none;
}


.folder-icon {
    width: 88rpx;
    height: 88rpx;
    background: #FFFFFF;
    border-radius: 20rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 40rpx;
    margin-right: 20rpx;
    flex-shrink: 0;
    overflow: hidden;
}

.folder-cover-image {
    width: 100%;
    height: 100%;
    border-radius: 20rpx;
}

.folder-default-icon-img {
    width: 60rpx;
    height: 60rpx;
}

.folder-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8rpx;
}

.folder-name {
    font-size: 26rpx;
    color: #000000;
    font-weight: 500;
    margin-bottom: 0;
}

.folder-count {
    font-size: 22rpx;
    color: #989090;
    font-weight: 400;
}


.folder-meta {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 8rpx;
    position: absolute;
    right: 40rpx;
    top: 50%;
    transform: translateY(-50%);
}

.recent-tag {
    background: rgba(10, 10, 10, 0.2);
    border-radius: 10rpx;
    padding: 8rpx 16rpx;
    font-size: 20rpx;
    font-weight: 400;
    color: #FFFFFF;
    line-height: 1;
}

.create-time {
    font-size: 20rpx;
    font-weight: 400;
    color: #989090;
    line-height: 1;
}

.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 200rpx;
    padding: 40rpx;
}

.empty-icon-img {
    width: 80rpx;
    height: 80rpx;
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
    justify-content: flex-end;
    align-items: center;
    padding: 20rpx 40rpx calc(20rpx + env(safe-area-inset-bottom));
    border-top: none;
}

.modal-footer.create-footer {
    justify-content: center;
    gap: 30rpx;
}

.modal-btn {
    width: 132rpx;
    height: 52rpx;
    border-radius: 40rpx;
    font-size: 26rpx;
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    z-index: 1001;
    margin-left: 0 !important;
    margin-right: 0 !important;
}

.secondary-btn {
    background: #e8e8e8;
    color: #989090;
    font-weight: normal;
    margin-left: auto !important;
    margin-right: 0 !important;
}

.outline-btn {
    background: #FFFFFF;
    color: #000000;
    border: 2rpx solid #000000 !important;
    font-weight: 400;
}

.outline-btn:disabled {
    background: #FFFFFF;
    color: #ccc;
    border: 2rpx solid #ccc !important;
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

.create-folder-form {
    display: flex;
    flex-direction: column;
    gap: 30rpx;
}

.form-item {
    display: flex;
    flex-direction: column;
    gap: 16rpx;
}

.form-label {
    font-size: 28rpx;
    color: #333;
    font-weight: 500;
}

.cover-upload-section {
    display: flex;
    justify-content: center;
}

.cover-upload-btn {
    width: 200rpx;
    height: 200rpx;
    border: 2rpx dashed #ccc;
    border-radius: 20rpx;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: #f9f9f9;
    cursor: pointer;
}

.upload-icon-img {
    width: 60rpx;
    height: 60rpx;
    margin-bottom: 16rpx;
    opacity: 0.6;
}

.upload-text {
    font-size: 24rpx;
    color: #666;
}

.cover-preview {
    width: 200rpx;
    height: 200rpx;
    border-radius: 20rpx;
    overflow: hidden;
    position: relative;
    cursor: pointer;
}

.cover-image {
    width: 100%;
    height: 100%;
}

.cover-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.3s ease;
}

.cover-preview:hover .cover-overlay {
    opacity: 1;
}

.change-text {
    color: white;
    font-size: 24rpx;
    font-weight: 500;
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

/* 滑入动画 */
@keyframes slideUp {
    from {
        transform: translateY(100%);
    }
    to {
        transform: translateY(0);
    }
}

/* 左滑删除样式 */
.folder-item-wrapper {
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

/* 收藏夹项 */
.folder-item {
    position: relative;
    background-color: #ffffff;
    padding: 20rpx 0;
    border-bottom: none;
    display: flex;
    align-items: center;
    gap: 20rpx;
    z-index: 2;
    transition: transform 0.3s ease;
    position: relative;
}

.folder-item.swipe-open {
    transform: translateX(-150rpx);
}

/* 删除确认弹窗样式 */
.delete-confirm-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000; /* 确保在最顶层 */
}

.delete-confirm-modal {
    background: #ffffff;
    border-radius: 20rpx;
    width: 600rpx;
    max-width: 90%;
    overflow: hidden;
    animation: scaleIn 0.3s ease;
}

@keyframes scaleIn {
    from {
        transform: scale(0.8);
        opacity: 0;
    }
    to {
        transform: scale(1);
        opacity: 1;
    }
}

.delete-confirm-header {
    padding: 40rpx 40rpx 20rpx;
    text-align: center;
    border-bottom: 1rpx solid #f0f0f0;
}

.delete-confirm-title {
    font-size: 32rpx;
    font-weight: 600;
    color: #333333;
}

.delete-confirm-content {
    padding: 30rpx 40rpx;
}

.delete-confirm-text {
    font-size: 28rpx;
    color: #333333;
    line-height: 1.5;
    margin-bottom: 20rpx;
}

.delete-confirm-warning {
    font-size: 24rpx;
    color: #ff4757;
    text-align: center;
}

.delete-confirm-footer {
    display: flex;
    border-top: 1rpx solid #f0f0f0;
}

.delete-confirm-btn {
    flex: 1;
    height: 88rpx;
    border: none;
    background: transparent;
    font-size: 28rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
}

.cancel-btn {
    color: #666666;
    border-right: 1rpx solid #f0f0f0;
}

.confirm-btn {
    color: #ff4757;
    font-weight: 600;
}

.cancel-btn:active {
    background: #f8f8f8;
}

.confirm-btn:active {
    background: #fff5f5;
}
</style>
