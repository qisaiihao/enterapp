<template>
    <!-- pages/favorite-folders/favorite-folders.wxml -->
    <view class="favorite-folders-page">
        <!-- 顶部导航栏 -->
        <view class="header">
            <view class="header-left" @tap="goBack">
                <text class="back-icon">←</text>
            </view>
            <text class="header-title">我的收藏</text>
            <view class="header-right">
                <text class="create-btn" @tap="showCreateFolder">+ 新建</text>
            </view>
        </view>

        <!-- 收藏夹列表 -->
        <scroll-view class="folders-list" scroll-y="true">
            <view class="folders-content">
                <view v-if="folders.length === 0" class="empty-state">
                    <text class="empty-icon">📁</text>
                    <text class="empty-text">暂无收藏夹</text>
                    <text class="empty-subtext">创建您的第一个收藏夹吧</text>
                </view>

                <view v-else class="folder-grid">
                    <view
                        v-for="folder in folders"
                        :key="folder._id"
                        class="folder-item-simple"
                        @tap="enterFolder(folder)"
                    >
                        <view class="folder-content">
                            <text class="folder-name">{{ folder.name }}</text>
                            <text class="folder-count">{{ folder.itemCount }} 个收藏</text>
                        </view>
                        <view class="folder-actions">
                            <text class="action-btn edit" @tap.stop="editFolderName(folder)">编辑</text>
                            <text class="action-btn delete" @tap.stop="deleteFolder(folder)">删除</text>
                        </view>
                    </view>
                </view>
            </view>
        </scroll-view>

        <!-- 创建收藏夹弹窗 -->
        <view v-if="showCreateModal" class="modal-overlay" @tap="hideCreateModal">
            <view class="modal-content" @tap.stop>
                <view class="modal-header">
                    <text class="modal-title">新建收藏夹</text>
                    <text class="close-btn" @tap="hideCreateModal">×</text>
                </view>
                <view class="modal-body">
                    <input
                        class="folder-name-input"
                        v-model="newFolderName"
                        placeholder="请输入收藏夹名称（最多7个字）"
                        maxlength="7"
                    />
                </view>
                <view class="modal-footer">
                    <button class="modal-btn cancel" @tap="hideCreateModal">取消</button>
                    <button class="modal-btn confirm" @tap="createFolder" :disabled="!newFolderName.trim()">创建</button>
                </view>
            </view>
        </view>

        <!-- 编辑收藏夹弹窗 -->
        <view v-if="showEditModal" class="modal-overlay" @tap="hideEditModal">
            <view class="modal-content" @tap.stop>
                <view class="modal-header">
                    <text class="modal-title">修改收藏夹名字</text>
                    <text class="close-btn" @tap="hideEditModal">×</text>
                </view>
                <view class="modal-body">
                    <view class="edit-folder-form">
                        <view class="form-item">
                            <view class="form-label">收藏夹名称</view>
                            <input
                                class="folder-name-input"
                                v-model="editingFolderName"
                                placeholder="请输入收藏夹名称（最多7个字）"
                                maxlength="7"
                            />
                        </view>

                        <view class="form-item">
                            <view class="form-label">收藏夹封面</view>
                            <view class="cover-upload-section">
                                <view v-if="!editingFolderCover" class="cover-upload-btn" @tap="chooseEditCoverImage">
                                    <view class="upload-icon">📷</view>
                                    <view class="upload-text">选择封面</view>
                                </view>
                                <view v-else class="cover-preview" @tap="chooseEditCoverImage">
                                    <image class="cover-image" :src="editingFolderCover" mode="aspectFill"></image>
                                    <view class="cover-overlay">
                                        <view class="change-text">更换封面</view>
                                    </view>
                                </view>
                            </view>
                        </view>
                    </view>
                </view>
                <view class="modal-footer">
                    <button class="modal-btn cancel" @tap="hideEditModal">取消</button>
                    <button class="modal-btn confirm" @tap="saveFolderName" :disabled="!editingFolderName.trim()">保存</button>
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
            editingFolderName: '',
            editingFolderCover: ''
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

        // 返回上一页
        goBack() {
            uni.navigateBack();
        },

        // 进入收藏夹
        enterFolder(folder) {
            console.log('=== 点击收藏夹项 ===');
            console.log('folder对象:', folder);
            
            if (!folder || !folder._id) {
                console.error('错误：folder对象或_id为空');
                uni.showToast({
                    title: '收藏夹信息错误',
                    icon: 'none'
                });
                return;
            }

            const folderId = folder._id;
            const folderName = folder.name;
            
            console.log('folderId:', folderId);
            console.log('folderName:', folderName);

            const targetUrl = `/pages/favorite-content/favorite-content?folderId=${folderId}&folderName=${encodeURIComponent(folderName || '')}`;
            console.log('跳转URL:', targetUrl);
            
            uni.navigateTo({
                url: targetUrl,
                success: function () {
                    console.log('跳转成功');
                },
                fail: function (err) {
                    console.error('跳转失败:', err);
                    uni.showToast({
                        title: '跳转失败',
                        icon: 'none'
                    });
                }
            });
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

        // 显示创建收藏夹弹窗
        showCreateFolder() {
            this.setData({
                showCreateModal: true,
                newFolderName: ''
            });
        },

        // 隐藏创建收藏夹弹窗
        hideCreateModal() {
            this.setData({
                showCreateModal: false,
                newFolderName: ''
            });
        },

        // 创建收藏夹
        async createFolder() {
            const folderName = this.newFolderName.trim();
            if (!folderName) {
                uni.showToast({
                    title: '请输入收藏夹名称',
                    icon: 'none'
                });
                return;
            }

            try {
                uni.showLoading({ title: '创建中...' });
                const result = await this.callCloudFunction('createFavoriteFolder', {
                    folderName: folderName
                });

                if (result.result && result.result.success) {
                    uni.showToast({
                        title: '创建成功',
                        icon: 'success'
                    });
                    this.hideCreateModal();
                    this.loadFolders();
                } else {
                    uni.showToast({
                        title: result.result?.message || '创建失败',
                        icon: 'none'
                    });
                }
            } catch (error) {
                console.error('创建收藏夹失败:', error);
                uni.showToast({
                    title: '创建失败',
                    icon: 'none'
                });
            } finally {
                uni.hideLoading();
            }
        },

        // 编辑收藏夹名称
        editFolderName(folder) {
            this.setData({
                showEditModal: true,
                editingFolder: folder,
                editingFolderName: folder.name,
                editingFolderCover: folder.coverUrl || ''
            });
        },

        // 隐藏编辑弹窗
        hideEditModal() {
            this.setData({
                showEditModal: false,
                editingFolder: null,
                editingFolderName: '',
                editingFolderCover: ''
            });
        },

        // 选择编辑封面图片
        chooseEditCoverImage() {
            uni.chooseImage({
                count: 1,
                sizeType: ['compressed'],
                sourceType: ['album', 'camera'],
                success: (res) => {
                    const tempFilePath = res.tempFilePaths[0];
                    console.log('选择的编辑封面图片:', tempFilePath);
                    this.setData({
                        editingFolderCover: tempFilePath
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

        // 上传编辑封面图片
        uploadEditCoverImage() {
            return new Promise((resolve, reject) => {
                if (!this.editingFolderCover) {
                    resolve(null);
                    return;
                }

                const timestamp = new Date().getTime();
                const cloudPath = `folder_covers/${timestamp}_edit_cover.jpg`;
                
                uni.showLoading({
                    title: '上传封面中...'
                });

                // 检查环境并使用相应的文件读取方式
                if (typeof window !== 'undefined' && typeof FileReader !== 'undefined') {
                    // H5环境：使用fetch获取blob，然后转换为base64
                    fetch(this.editingFolderCover)
                        .then(response => {
                            if (!response.ok) {
                                throw new Error(`HTTP error! status: ${response.status}`);
                            }
                            return response.blob();
                        })
                        .then(blob => {
                            const reader = new FileReader();
                            reader.onload = () => {
                                const result = reader.result;
                                if (!result || typeof result !== 'string') {
                                    console.error('FileReader结果无效:', result);
                                    reject(new Error('文件读取失败'));
                                    return;
                                }
                                const base64 = result.split(',')[1];
                                console.log('编辑封面图片转换为base64完成，长度:', base64.length);
                                
                                // 使用云函数上传
                                this.callCloudFunction('upload', {
                                    cloudPath: cloudPath,
                                    fileContent: base64
                                }).then((uploadRes) => {
                                    uni.hideLoading();
                                    console.log('编辑封面上传云函数返回结果:', uploadRes);
                                    
                                    if (uploadRes && uploadRes.result && uploadRes.result.success) {
                                        console.log('编辑封面图片上传成功:', uploadRes.result.fileID);
                                        resolve(uploadRes.result.fileID);
                                    } else {
                                        console.error('编辑封面上传云函数返回格式错误:', uploadRes);
                                        reject(new Error('上传失败'));
                                    }
                                }).catch((err) => {
                                    uni.hideLoading();
                                    console.error('上传编辑封面图片失败:', err);
                                    reject(err);
                                });
                            };
                            reader.onerror = () => {
                                uni.hideLoading();
                                reject(new Error('文件读取失败'));
                            };
                            reader.readAsDataURL(blob);
                        })
                        .catch((err) => {
                            uni.hideLoading();
                            console.error('获取编辑封面图片失败:', err);
                            reject(new Error('获取图片失败'));
                        });
                } else {
                    // 小程序环境：使用getFileSystemManager
                    uni.getFileSystemManager().readFile({
                        filePath: this.editingFolderCover,
                        encoding: 'base64',
                        success: (res) => {
                            console.log('编辑封面图片读取成功，base64长度:', res.data.length);
                            
                            // 使用云函数上传
                            this.callCloudFunction('upload', {
                                cloudPath: cloudPath,
                                fileContent: res.data
                            }).then((uploadRes) => {
                                uni.hideLoading();
                                console.log('编辑封面上传云函数返回结果:', uploadRes);
                                
                                if (uploadRes && uploadRes.result && uploadRes.result.success) {
                                    console.log('编辑封面图片上传成功:', uploadRes.result.fileID);
                                    resolve(uploadRes.result.fileID);
                                } else {
                                    console.error('编辑封面上传云函数返回格式错误:', uploadRes);
                                    reject(new Error('上传失败'));
                                }
                            }).catch((err) => {
                                uni.hideLoading();
                                console.error('上传编辑封面图片失败:', err);
                                reject(err);
                            });
                        },
                        fail: (err) => {
                            uni.hideLoading();
                            console.error('读取编辑封面图片失败:', err);
                            reject(new Error('读取图片失败'));
                        }
                    });
                }
            });
        },

        // 保存收藏夹名称
        async saveFolderName() {
            const folderName = this.editingFolderName.trim();
            if (!folderName) {
                uni.showToast({
                    title: '请输入收藏夹名称',
                    icon: 'none'
                });
                return;
            }

            if (!this.editingFolder) {
                uni.showToast({
                    title: '参数错误',
                    icon: 'none'
                });
                return;
            }

            try {
                uni.showLoading({ title: '修改中...' });
                
                // 先上传封面图片（如果有的话）
                const coverUrl = await this.uploadEditCoverImage();
                
                const result = await this.callCloudFunction('updateFavoriteFolder', {
                    folderId: this.editingFolder._id,
                    name: folderName,
                    coverUrl: coverUrl
                });

                if (result.result && result.result.success) {
                    uni.showToast({
                        title: '修改成功',
                        icon: 'success'
                    });
                    this.hideEditModal();
                    this.loadFolders();
                } else {
                    uni.showToast({
                        title: result.result?.message || '修改失败',
                        icon: 'none'
                    });
                }
            } catch (error) {
                console.error('修改收藏夹名称失败:', error);
                uni.showToast({
                    title: '修改失败',
                    icon: 'none'
                });
            } finally {
                uni.hideLoading();
            }
        },

        // 删除收藏夹
        async deleteFolder(folder) {
            if (folder.isDefault) {
                uni.showToast({
                    title: '默认收藏夹不能删除',
                    icon: 'none'
                });
                return;
            }

            uni.showModal({
                title: '确认删除',
                content: `确定要删除收藏夹"${folder.name}"吗？里面的收藏不会被删除。`,
                success: async (res) => {
                    if (res.confirm) {
                        try {
                            uni.showLoading({ title: '删除中...' });
                            const result = await this.callCloudFunction('deleteFavoriteFolder', {
                                folderId: folder._id
                            });

                            if (result.result && result.result.success) {
                                uni.showToast({
                                    title: '删除成功',
                                    icon: 'success'
                                });
                                this.loadFolders();
                            } else {
                                uni.showToast({
                                    title: result.result?.message || '删除失败',
                                    icon: 'none'
                                });
                            }
                        } catch (error) {
                            console.error('删除收藏夹失败:', error);
                            uni.showToast({
                                title: '删除失败',
                                icon: 'none'
                            });
                        } finally {
                            uni.hideLoading();
                        }
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
.favorite-folders-page {
    min-height: 100vh;
    background: #fff;
    display: flex;
    flex-direction: column;
    /* #ifdef APP-PLUS */
    padding-top: var(--status-bar-height);
    /* #endif */
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

.back-icon {
    font-size: 36rpx;
    color: #333;
    font-weight: bold;
}

.header-title {
    font-size: 36rpx;
    font-weight: 600;
    color: #333;
}

.header-right {
    position: absolute;
    right: 30rpx;
    width: 100rpx;
    display: flex;
    justify-content: flex-end;
}

.create-btn {
    font-size: 28rpx;
    color: #9ed7ee;
    font-weight: 500;
}

.folders-list {
    flex: 1;
    height: 0;
    overflow: hidden;
}

.folders-content {
    padding: 30rpx;
}

.loading {
    text-align: center;
    padding: 60rpx 0;
    color: #666;
    font-size: 28rpx;
}

.empty-state {
    text-align: center;
    padding: 120rpx 0;
}

.empty-icon {
    font-size: 120rpx;
    margin-bottom: 30rpx;
    display: block;
}

.empty-text {
    font-size: 32rpx;
    color: #333;
    margin-bottom: 20rpx;
    display: block;
}

.empty-subtext {
    font-size: 28rpx;
    color: #666;
    display: block;
}

.folder-grid {
    display: flex;
    flex-direction: column;
}

.folder-item-simple {
    padding: 30rpx 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1rpx solid #f0f0f0;
    width: 100%;
    box-sizing: border-box;
    margin-right: 0;
    padding-right: 0;
}

.folder-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8rpx;
}

.folder-name {
    font-size: 32rpx;
    font-weight: 600;
    color: #333;
}

.folder-count {
    font-size: 26rpx;
    color: #666;
}

.folder-actions {
    display: flex;
    gap: 8rpx;
    flex-shrink: 0;
    margin-right: -10rpx;
    padding-right: 10rpx;
    position: relative;
    right: 0;
}

.action-btn {
    font-size: 20rpx;
    color: #9ed7ee;
    padding: 8rpx 12rpx;
    border-radius: 6rpx;
    background: rgba(158, 215, 238, 0.1);
    white-space: nowrap;
    min-width: 60rpx;
    text-align: center;
}

.action-btn.edit {
    color: #9ed7ee;
    background: rgba(158, 215, 238, 0.1);
}

.action-btn.delete {
    color: #ff6b6b;
    background: rgba(255, 107, 107, 0.1);
}

.load-more {
    text-align: center;
    padding: 40rpx 0;
    color: #666;
    font-size: 28rpx;
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
    background: #fff;
    border-radius: 20rpx;
    width: 600rpx;
    padding: 0;
}

.modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 40rpx 40rpx 30rpx;
    border-bottom: 1rpx solid #f0f0f0;
}

.modal-title {
    font-size: 32rpx;
    font-weight: 600;
    color: #333;
}

.close-btn {
    font-size: 40rpx;
    color: #999;
    width: 60rpx;
    height: 60rpx;
    display: flex;
    align-items: center;
    justify-content: center;
}

.modal-body {
    padding: 40rpx;
}

.folder-name-input {
    width: 100%;
    height: 80rpx;
    border: 2rpx solid #e9ecef;
    border-radius: 12rpx;
    padding: 0 20rpx;
    font-size: 28rpx;
    color: #333;
    box-sizing: border-box;
}

.folder-name-input:focus {
    border-color: #9ed7ee;
}

/* 编辑表单样式 */
.edit-folder-form {
    padding: 0 40rpx;
}

.form-item {
    margin-bottom: 30rpx;
}

.form-label {
    font-size: 26rpx;
    color: #333333;
    margin-bottom: 16rpx;
    font-weight: 500;
}

/* 封面上传样式 */
.cover-upload-section {
    display: flex;
    justify-content: center;
    align-items: center;
}

.cover-upload-btn {
    width: 200rpx;
    height: 200rpx;
    border: 2rpx dashed #e0e0e0;
    border-radius: 12rpx;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: #f8f9fa;
}

.upload-icon {
    font-size: 48rpx;
    color: #999;
    margin-bottom: 8rpx;
}

.upload-text {
    font-size: 24rpx;
    color: #666;
}

.cover-preview {
    width: 200rpx;
    height: 200rpx;
    border-radius: 12rpx;
    overflow: hidden;
    position: relative;
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

.cover-preview:active .cover-overlay {
    opacity: 1;
}

.change-text {
    color: #fff;
    font-size: 24rpx;
    font-weight: 500;
}

.modal-footer {
    display: flex;
    gap: 20rpx;
    padding: 30rpx 40rpx 40rpx;
}

.modal-btn {
    flex: 1;
    height: 80rpx;
    border-radius: 12rpx;
    font-size: 28rpx;
    font-weight: 500;
    border: none;
}

.modal-btn.cancel {
    background: #f8f9fa;
    color: #666;
}

.modal-btn.confirm {
    background: #9ed7ee;
    color: #fff;
}

.modal-btn.confirm[disabled] {
    background: #ccc;
    color: #999;
}
</style>
