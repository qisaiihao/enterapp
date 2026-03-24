<template>
    <view class="portfolio-selector-container">
        <!-- components/portfolio-selector/portfolio-selector.wxml -->
        <view v-if="showClone" class="modal-overlay" @tap="hideModal">
            <view class="modal-content" @tap.stop>
                <view class="modal-header">
                    <view class="modal-title">添加作品集</view>
                    <button class="create-btn" @tap="createPortfolio">创建</button>
                </view>

                <view class="modal-body">
                    <!-- 加载状态 -->
                    <view v-if="isLoading" class="loading-container">
                        <view class="loading-text">加载中...</view>
                    </view>

                    <!-- 作品集列表 -->
                    <view v-else-if="portfolios.length > 0" class="portfolios-list">
                        <view
                            class="portfolio-item"
                            :data-portfolio-id="item._id"
                            @tap="selectPortfolio"
                            v-for="(item, index) in portfolios"
                            :key="index"
                        >
                            <view class="portfolio-icon">
                                <image v-if="item.coverUrl" class="portfolio-cover-image" :src="item.coverUrl" mode="aspectFill"></image>
                                <view v-else class="portfolio-default-icon">📚</view>
                            </view>

                            <view class="portfolio-info">
                                <view class="portfolio-name">{{ item.name }}</view>
                                <view class="portfolio-count">{{ getPortfolioItemCount(item) === 0 ? '空空如也~' : getPortfolioItemCount(item) + '个作品' }}</view>
                            </view>

                            <view class="portfolio-meta">
                                <view v-if="item.isRecent" class="recent-tag">最近使用</view>
                                <view class="create-time">创建于{{ formatDate(item.createTime) }}</view>
                            </view>
                        </view>
                    </view>

                    <!-- 空状态 -->
                    <view v-else class="empty-state">
                        <view class="empty-icon">📚</view>
                        <view class="empty-text">还没有作品集</view>
                        <view class="empty-subtext">点击下方按钮创建一个作品集</view>
                    </view>
                </view>

                <view class="modal-footer">
                    <button class="modal-btn secondary-btn" @tap="hideModal">取消</button>
                </view>
            </view>
        </view>

        <!-- 创建作品集弹窗 -->
        <view v-if="showCreateModal" class="modal-overlay" @tap="hideCreateModal">
            <view class="modal-content create-modal" @tap.stop>
                <view class="modal-header">
                    <view class="modal-title">创建作品集</view>
                    <button class="close-btn" @tap="hideCreateModal">×</button>
                </view>

                <view class="modal-body">
                    <view class="create-portfolio-form">
                        <view class="form-item">
                            <view class="form-label">作品集名称</view>
                            <input class="portfolio-name-input" placeholder="请输入作品集名称" :value="newPortfolioName" @input="onPortfolioNameInput" :focus="true" @tap.stop.prevent="trueFun" maxlength="7" />
                        </view>

                        <view class="form-item">
                            <view class="form-label">作品集封面</view>
                            <view class="cover-upload-section">
                                <view v-if="!newPortfolioCover" class="cover-upload-btn" @tap="choosePortfolioCoverImage">
                                    <view class="upload-icon">📷</view>
                                    <view class="upload-text">选择封面</view>
                                </view>
                                <view v-else class="cover-preview" @tap="choosePortfolioCoverImage">
                                    <image class="cover-image" :src="newPortfolioCover" mode="aspectFill"></image>
                                    <view class="cover-overlay">
                                        <view class="change-text">更换封面</view>
                                    </view>
                                </view>
                            </view>
                        </view>
                    </view>
                </view>

                <view class="modal-footer">
                    <button class="modal-btn secondary-btn" @tap="hideCreateModal">取消</button>
                    <button class="modal-btn primary-btn" @tap="createNewPortfolio" :disabled="!newPortfolioName">创建</button>
                </view>
            </view>
        </view>
    </view>
</template>

<script>
// components/portfolio-selector/portfolio-selector.js
const { cloudCall } = require('../../utils/cloudCall.js');
const { notifyPortfolioUpdated } = require('../../api-cache/portfolio.js');
export default {
    data() {
        return {
            portfolios: [],
            isLoading: true,
            selectedPortfolioId: '',
            showCreateModal: false,
            newPortfolioName: '',
            newPortfolioCover: '',
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
        show: {
            handler: function (newVal, oldVal) {
                this.showClone = newVal;
                if (newVal && !oldVal) { // 从false变为true时
                    setTimeout(() => {
                        if (this.showClone) {
                            this.loadPortfolios();
                        }
                    }, 100); // 延迟一点时间确保DOM渲染完成
                }
            },
            immediate: true
        }
    },

    methods: {
        getPortfolioItemCount(item = {}) {
            return Number(
                item.itemCount !== undefined && item.itemCount !== null
                    ? item.itemCount
                    : item.postCount
            ) || 0;
        },
        // 统一云函数调用方法
        callCloudFunction(name, data = {}, extraOptions = {}) {
            return cloudCall(name, data, Object.assign({ pageTag: 'portfolio-selector', context: this, requireAuth: true }, extraOptions));
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

        // 加载作品集列表
        loadPortfolios: function () {
            this.setData({
                isLoading: true
            });
            this.callCloudFunction('getPortfolioFolders').then((res) => {
                if (res.result && res.result.success) {
                    const portfolios = res.result.folders || [];

                    // 如果当前选中的作品集不存在了，清空选择
                    const currentSelectedId = this.selectedPortfolioId;
                    if (currentSelectedId && !portfolios.some((p) => p._id === currentSelectedId)) {
                        this.setData({
                            selectedPortfolioId: ''
                        });
                    }
                    this.setData({
                        portfolios: portfolios,
                        isLoading: false
                    });
                } else {
                    this.setData({
                        isLoading: false,
                        portfolios: [],
                        selectedPortfolioId: '' // 加载失败时清空选择
                    });
                    // 如果获取失败，尝试重新加载一次
                    setTimeout(() => {
                        if (this.showClone) { // 如果弹窗还在显示中
                            this.loadPortfolios();
                        }
                    }, 1000);
                }
            }).catch(() => {
                this.setData({
                    isLoading: false,
                    portfolios: [],
                    selectedPortfolioId: '' // 网络错误时清空选择
                });
            });
        },

        // 选择作品集
        selectPortfolio: function (e) {
            const portfolioId = e.currentTarget.dataset.portfolioId;
            const postId = this.postId;
            
            if (!portfolioId) {
                uni.showToast({
                    title: '请选择作品集',
                    icon: 'none'
                });
                return;
            }
            if (!postId) {
                uni.showToast({
                    title: '帖子ID不存在',
                    icon: 'none'
                });
                return;
            }

            // 立刻添加到作品集
            this.addToPortfolio(portfolioId, postId);
        },

        // 添加到作品集
        addToPortfolio: function (portfolioId, postId) {
            if (!portfolioId) {
                uni.showToast({
                    title: '请选择作品集',
                    icon: 'none'
                });
                return;
            }
            if (!postId) {
                uni.showToast({
                    title: '帖子ID不存在',
                    icon: 'none'
                });
                return;
            }
            
            uni.showLoading({
                title: '添加中...'
            });
            
            this.callCloudFunction('addToPortfolio', {
                postId: postId,
                folderId: portfolioId
            }).then((res) => {
                uni.hideLoading();
                if (res && res.result) {
                    if (res.result.success) {
                        uni.showToast({
                            title: '添加成功'
                        });

                        // 确保状态正确重置
                        this.setData({
                            selectedPortfolioId: ''
                        });

                        // 延迟关闭，确保用户能看到成功提示
                        setTimeout(() => {
                            this.hideModal();
                        }, 1500);

                        // 触发成功事件
                        notifyPortfolioUpdated({
                            source: 'portfolio-selector:add',
                            folderId: portfolioId,
                            postId: postId,
                            delta: 1
                        });
                        this.$emit('portfolioSuccess');
                    } else {
                        uni.showToast({
                            title: res.result.message || '添加失败',
                            icon: 'none'
                        });
                    }
                } else {
                    uni.showToast({
                        title: '添加失败：返回格式错误',
                        icon: 'none'
                    });
                }
            }).catch((err) => {
                uni.hideLoading();
                uni.showToast({
                    title: '网络错误：' + (err.errMsg || '未知错误'),
                    icon: 'none'
                });
            });
        },

        // 确认添加到作品集
        confirmAddToPortfolio: function () {
            const selectedPortfolioId = this.selectedPortfolioId;
            const postId = this.postId;
            if (!selectedPortfolioId) {
                uni.showToast({
                    title: '请选择作品集',
                    icon: 'none'
                });
                return;
            }
            if (!postId) {
                uni.showToast({
                    title: '帖子ID不存在',
                    icon: 'none'
                });
                return;
            }
            uni.showLoading({
                title: '添加中...'
            });
            this.callCloudFunction('addToPortfolio', {
                postId: postId,
                folderId: selectedPortfolioId
            }).then((res) => {
                uni.hideLoading();
                if (res && res.result) {
                    if (res.result.success) {

                            // 延迟关闭，确保用户能看到成功提示
                            setTimeout(() => {
                                this.hideModal();
                            }, 1500);

                            // 触发成功事件
                            notifyPortfolioUpdated({
                                source: 'portfolio-selector:add',
                                folderId: selectedPortfolioId,
                                postId: postId,
                                delta: 1
                            });
                            this.$emit('portfolioSuccess');
                        } else {
                            console.error('添加到作品集业务失败:', res.result);
                            uni.showToast({
                                title: res.result.message || '添加失败',
                                icon: 'none'
                            });
                        }
                    } else {
                        console.error('添加到作品集返回格式异常:', res);
                        uni.showToast({
                            title: '添加失败：返回格式错误',
                            icon: 'none'
                        });
                    }
                }).catch((err) => {
                    uni.hideLoading();
                    console.error('添加到作品集云函数调用失败:', err);
                    uni.showToast({
                        title: '网络错误：' + (err.errMsg || '未知错误'),
                        icon: 'none'
                    });
                });
        },

        // 显示创建作品集弹窗
        createPortfolio: function () {
            this.setData({
                showCreateModal: true,
                newPortfolioName: '',
                newPortfolioCover: ''
            });
        },

        // 隐藏创建作品集弹窗
        hideCreateModal: function () {
            this.setData({
                showCreateModal: false,
                newPortfolioName: '',
                newPortfolioCover: ''
            });
        },

        // 输入作品集名称
        onPortfolioNameInput: function (e) {
            const value = e.detail.value;
            this.setData({
                newPortfolioName: value
            });
        },

        // 选择作品集封面图片
        choosePortfolioCoverImage: function () {
            uni.chooseImage({
                count: 1,
                sizeType: ['compressed'], // 强制使用压缩图片
                sourceType: ['album', 'camera'],
                success: (res) => {
                    const tempFilePath = res.tempFilePaths[0];
                    console.log('【portfolio-selector】选择的作品集封面图片:', tempFilePath);
                    // 验证图片大小（可选，限制最大5MB）
                    uni.getFileInfo({
                        filePath: tempFilePath,
                        success: (fileInfo) => {
                            const maxSize = 5 * 1024 * 1024; // 5MB
                            if (fileInfo.size > maxSize) {
                                uni.showToast({
                                    title: '图片过大，请选择更小的图片',
                                    icon: 'none'
                                });
                                return;
                            }
                            this.setData({
                                newPortfolioCover: tempFilePath
                            });
                        },
                        fail: (err) => {
                            console.warn('获取文件信息失败，但仍继续使用:', err);
                            // 即使获取文件信息失败，也继续使用该图片
                            this.setData({
                                newPortfolioCover: tempFilePath
                            });
                        }
                    });
                },
                fail: (err) => {
                    console.error('【portfolio-selector】选择图片失败:', err);
                    uni.showToast({
                        title: err.errMsg || '选择图片失败',
                        icon: 'none'
                    });
                }
            });
        },

        // 上传作品集封面图片
        uploadPortfolioCoverImage: function () {
            return new Promise((resolve, reject) => {
                if (!this.newPortfolioCover) {
                    resolve(null);
                    return;
                }

                const timestamp = new Date().getTime();
                const cloudPath = `portfolio_covers/${timestamp}_cover.jpg`;
                
                uni.showLoading({
                    title: '上传封面中...'
                });

                // 检查运行环境
                // #ifdef H5
                // H5环境：使用fetch获取blob，然后转换为base64
                fetch(this.newPortfolioCover)
                    .then(response => response.blob())
                    .then(blob => {
                        return new Promise((resolve, reject) => {
                            const reader = new FileReader();
                            reader.onload = () => resolve(reader.result);
                            reader.onerror = reject;
                            reader.readAsDataURL(blob);
                        });
                    })
                    .then(base64 => {
                        // 移除data:image/jpeg;base64,前缀
                        const base64Data = base64.split(',')[1];
                        console.log('H5环境封面图片base64转换成功');
                        
                        // 调用云函数上传
                        this.callCloudFunction('upload', {
                            fileContent: base64Data,
                            cloudPath: cloudPath
                        }).then((uploadRes) => {
                            uni.hideLoading();
                            console.log('【portfolio-selector】H5环境封面图片上传结果:', uploadRes);
                            if (uploadRes && uploadRes.result && uploadRes.result.success && uploadRes.result.fileID) {
                                resolve(uploadRes.result.fileID);
                            } else {
                                const errorMsg = uploadRes?.result?.message || uploadRes?.result?.error || '上传失败';
                                console.error('【portfolio-selector】H5环境封面图片上传失败:', uploadRes);
                                reject(new Error(errorMsg));
                            }
                        }).catch((uploadErr) => {
                            uni.hideLoading();
                            console.error('【portfolio-selector】H5环境封面图片上传云函数调用失败:', uploadErr);
                            reject(new Error(uploadErr.message || '上传失败'));
                        });
                    })
                    .catch((err) => {
                        uni.hideLoading();
                        console.error('H5环境封面图片base64转换失败:', err);
                        reject(err);
                    });
                // #endif

                // #ifndef H5
                // 非H5环境（如小程序）：使用uni.getFileSystemManager
                uni.getFileSystemManager().readFile({
                    filePath: this.newPortfolioCover,
                    encoding: 'base64',
                    success: (readRes) => {
                        console.log('非H5环境封面图片base64读取成功');
                        
                        // 调用云函数上传
                        this.callCloudFunction('upload', {
                            fileContent: readRes.data,
                            cloudPath: cloudPath
                        }).then((uploadRes) => {
                            uni.hideLoading();
                            console.log('【portfolio-selector】非H5环境封面图片上传结果:', uploadRes);
                            if (uploadRes && uploadRes.result && uploadRes.result.success && uploadRes.result.fileID) {
                                resolve(uploadRes.result.fileID);
                            } else {
                                const errorMsg = uploadRes?.result?.message || uploadRes?.result?.error || '上传失败';
                                console.error('【portfolio-selector】非H5环境封面图片上传失败:', uploadRes);
                                reject(new Error(errorMsg));
                            }
                        }).catch((uploadErr) => {
                            uni.hideLoading();
                            console.error('【portfolio-selector】非H5环境封面图片上传云函数调用失败:', uploadErr);
                            reject(new Error(uploadErr.message || '上传失败'));
                        });
                    },
                    fail: (readErr) => {
                        uni.hideLoading();
                        console.error('非H5环境封面图片base64读取失败:', readErr);
                        reject(readErr);
                    }
                });
                // #endif
            });
        },

        // 创建作品集
        createNewPortfolio: async function () {
            const portfolioName = this.newPortfolioName.trim();
            if (!portfolioName) {
                uni.showToast({
                    title: '请输入作品集名称',
                    icon: 'none'
                });
                return;
            }

            if (portfolioName.length > 7) {
                uni.showToast({
                    title: '作品集名称最多7个字',
                    icon: 'none'
                });
                return;
            }

            try {
                uni.showLoading({ title: '创建中...' });
                
                // 先上传封面图片（如果有的话）
                let coverUrl = null;
                if (this.newPortfolioCover) {
                    try {
                        coverUrl = await this.uploadPortfolioCoverImage();
                        console.log('【portfolio-selector】封面图片上传成功，fileID:', coverUrl);
                    } catch (uploadError) {
                        console.error('【portfolio-selector】封面图片上传失败:', uploadError);
                        uni.hideLoading();
                        // 询问用户是否继续创建不带封面的作品集
                        const userChoice = await new Promise((resolve) => {
                            uni.showModal({
                                title: '封面上传失败',
                                content: '封面图片上传失败，是否继续创建不带封面的作品集？',
                                confirmText: '继续创建',
                                cancelText: '取消',
                                success: (res) => {
                                    resolve(res.confirm);
                                },
                                fail: () => {
                                    resolve(false);
                                }
                            });
                        });
                        
                        if (!userChoice) {
                            // 用户选择取消，直接返回
                            return;
                        }
                        // 用户选择继续创建，coverUrl 保持为 null
                    }
                }
                
                console.log('【portfolio-selector】组件开始创建作品集，名称:', portfolioName, '封面:', coverUrl);
                
                const res = await this.callCloudFunction('createPortfolioFolder', {
                    folderName: portfolioName,
                    coverUrl: coverUrl
                });

                uni.hideLoading();
                console.log('【portfolio-selector】组件创建作品集返回结果:', res);

                if (res && res.result) {
                    if (res.result.success) {
                        uni.showToast({
                            title: '创建成功',
                            duration: 2000
                        });
                        this.setData({
                            showCreateModal: false,
                            newPortfolioName: '',
                            newPortfolioCover: ''
                        });
                        // 延迟重新加载，确保状态同步
                        setTimeout(() => {
                            this.loadPortfolios();
                        }, 300);
                    } else {
                        console.error('【portfolio-selector】组件创建作品集业务失败:', res.result);
                        uni.showToast({
                            title: res.result.message || '创建失败',
                            icon: 'none',
                            duration: 3000
                        });
                    }
                } else {
                    console.error('【portfolio-selector】组件创建作品集返回格式异常:', res);
                    uni.showToast({
                        title: '创建失败：返回格式错误',
                        icon: 'none',
                        duration: 3000
                    });
                }
            } catch (error) {
                uni.hideLoading();
                console.error('【portfolio-selector】组件创建作品集云函数调用失败:', error);
                uni.showToast({
                    title: error.message || '创建失败',
                    icon: 'none',
                    duration: 3000
                });
            }
        },

        // 隐藏弹窗
        hideModal: function () {
            console.log('=== 点击关闭按钮，开始隐藏弹窗 ===');
            console.log('当前状态：', {
                show: this.show,
                showCreateModal: this.showCreateModal,
                selectedPortfolioId: this.selectedPortfolioId
            });
            this.setData({
                selectedPortfolioId: '',
                showClone: false,
                showCreateModal: false,
                // 确保创建弹窗也关闭
                newPortfolioName: '' // 清空输入框
            });

            console.log('=== 弹窗已隐藏，状态已重置 ===');
            this.$emit('hide');
        },

        trueFun() {
            console.log('占位：函数 true 未声明');
        }
    },

    created: function () {},

    mounted: function () {
        console.log('【portfolio-selector】组件mounted');
        if (this.show) {
            console.log('【portfolio-selector】mounted时show为true，开始加载作品集');
            this.loadPortfolios();
        }
    }
};
</script>
<style>
/* components/portfolio-selector/portfolio-selector.wxss */
/* 组件容器 */
.portfolio-selector-container {
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
    z-index: 1000;
}

.modal-content {
    background: #FFFFFF;
    border-top-left-radius: 30rpx;
    border-top-right-radius: 30rpx;
    margin: 0;
    width: 100%;
    max-width: none;
    max-height: 60vh;
    min-height: 40vh;
    animation: slideUp 0.3s ease;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.modal-header {
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

.create-btn {
    position: absolute;
    right: 40rpx;
    top: 50%;
    transform: translateY(-50%);
    background: transparent;
    border: none;
    color: #989090;
    font-size: 26rpx;
    font-weight: normal;
    padding: 0;
    outline: none;
}

.create-btn::after {
    border: none;
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

.portfolios-list {
    display: flex;
    flex-direction: column;
    gap: 20rpx;
    padding: 0 40rpx;
}

.portfolio-item {
    padding: 20rpx 0;
    border-bottom: none;
    position: relative;
    display: flex;
    align-items: center;
    gap: 20rpx;
}

.portfolio-icon {
    width: 88rpx;
    height: 88rpx;
    background: #D9D9D9;
    border-radius: 20rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 40rpx;
    margin-right: 20rpx;
    flex-shrink: 0;
}

.portfolio-cover-image {
    width: 100%;
    height: 100%;
    border-radius: 20rpx;
}

.portfolio-default-icon {
    font-size: 40rpx;
}

.portfolio-info {
    display: flex;
    flex-direction: column;
    gap: 8rpx;
}

.portfolio-name {
    font-size: 26rpx;
    color: #000000;
    font-weight: 500;
    margin-bottom: 0;
}

.portfolio-count {
    font-size: 22rpx;
    color: #989090;
    font-weight: 400;
}

.portfolio-meta {
    display: flex;
    align-items: center;
    gap: 10rpx;
    margin-left: auto;
}

.recent-tag {
    background: rgba(10, 10, 10, 0.2);
    color: #FFFFFF;
    font-size: 20rpx;
    padding: 4rpx 8rpx;
    border-radius: 10rpx;
    font-weight: 400;
}

.create-time {
    font-size: 20rpx;
    color: #989090;
    font-weight: 400;
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
    justify-content: flex-end;
    padding: 20rpx 40rpx calc(20rpx + env(safe-area-inset-bottom));
    border-top: none;
    align-items: center;
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

/* 滑入动画 */
@keyframes slideUp {
    from {
        transform: translateY(100%);
    }
    to {
        transform: translateY(0);
    }
}

/* 创建作品集弹窗样式 */
.create-portfolio-form {
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

.portfolio-name-input {
    width: 100%;
    height: 80rpx;
    padding: 0 20rpx;
    border: 2rpx solid #e0e0e0;
    border-radius: 8rpx;
    font-size: 30rpx;
    box-sizing: border-box;
}

.portfolio-name-input:focus {
    border-color: #9ed7ee;
}

.close-btn {
    position: absolute;
    right: 40rpx;
    top: 50%;
    transform: translateY(-50%);
    background: transparent;
    border: none;
    color: #989090;
    font-size: 26rpx;
    font-weight: normal;
    padding: 0;
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
</style>
