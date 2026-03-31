<template>
    <!-- 图片上传管理页面 -->
    <view class="container">
        <view class="header">
            <text class="title">图片管理</text>
            <text class="subtitle">上传和管理小程序图片</text>
        </view>

        <!-- 开屏图管理 -->
        <view class="section">
            <view class="section-title">开屏图管理</view>
            <view class="upload-area" @tap="chooseSplashImage">
                <view class="upload-content">
                    <text class="upload-icon">📷</text>
                    <text class="upload-text">点击选择开屏图</text>
                    <text class="upload-hint">建议选择 750x1334 或类似比例的图片</text>
                </view>
            </view>

            <view class="preview-area" v-if="splashPreview">
                <text class="preview-title">预览</text>
                <image class="preview-image" :src="splashPreview" mode="aspectFit"></image>
                <view class="button-group">
                    <button class="btn btn-primary" @tap="uploadSplashImage" :loading="uploading">
                        {{ uploading ? '上传中...' : '确认上传' }}
                    </button>
                    <button class="btn btn-secondary" @tap="clearSplashPreview">取消</button>
                </view>
            </view>
        </view>

        <!-- 上传历史 -->
        <view class="section" v-if="imageHistory.length > 0">
            <view class="section-title">最近上传</view>
            <view class="history-list">
                <view class="history-item" v-for="(item, index) in imageHistory" :key="index">
                    <image class="history-thumb" :src="item.tempUrl" mode="aspectFill"></image>

                    <view class="history-info">
                        <text class="history-name">{{ item.metadata.name || '未命名' }}</text>
                        <text class="history-time">{{ formatTime(item.uploadTime) }}</text>
                        <text class="history-category">{{ item.category }}</text>
                    </view>

                    <view class="history-actions">
                        <button class="btn-small" size="mini" @tap="copyUrl" :data-url="item.tempUrl">复制链接</button>
                    </view>
                </view>
            </view>
        </view>

        <!-- 操作提示 -->
        <view class="tips">
            <text class="tips-title">使用说明：</text>
            <text class="tips-item">1. 开屏图会自动应用到启动页面</text>
            <text class="tips-item">2. 上传后URL会自动复制到剪贴板</text>
            <text class="tips-item">3. 云端图片有缓存，修改后可能需要重新编译小程序</text>
        </view>
    </view>
</template>

<script>
import { imageManager } from '../../utils/imageManager.js';
import { formatRelativeTime } from '../../utils/time.js';
import { cloudCall } from '../../utils/cloudCall.js';
import { getCurrentUserInfo, isAdminUser } from '../../utils/admin.js';

export default {
    data() {
        return {
            splashPreview: '',
            uploading: false,
            imageHistory: [],
            isAdmin: false,
            // 是否为管理员
            currentUserOpenid: '' // 当前用户openid
        };
    },
    onLoad: function () {
        this.checkAdminPermission();
    },
    methods: {
        // 统一云函数调用方法
        callCloudFunction(name, data = {}, extraOptions = {}) {
            return cloudCall(name, data, Object.assign({ pageTag: 'image-manager', context: this, requireAuth: true }, extraOptions));
        },
        // 检查管理员权限
        async checkAdminPermission() {
            try {
                // 获取当前用户openid
                const openIdResult = await this.callCloudFunction('getOpenId', {});
                if (openIdResult.result && openIdResult.result.openid) {
                    const currentOpenid = openIdResult.result.openid;
                    const adminOpenids = ['ojYBd1_A3uCbQ1LGcHxWxOAeA5SE', 'ojYBd14JG3-ghYuGCI2WHmkMc9nE']; // 管理员openid列表
                    const currentUser = getCurrentUserInfo() || {};
                    const isAdmin = isAdminUser(currentUser);
                    console.log('图片管理页面 - 当前用户:', currentOpenid);
                    console.log('图片管理页面 - 是否为管理员:', isAdmin);
                    this.setData({
                        currentUserOpenid: currentOpenid,
                        isAdmin: isAdmin
                    });

                    // 如果不是管理员，显示提示并返回
                    if (!isAdmin) {
                        uni.showModal({
                            title: '权限不足',
                            content: '您没有权限访问图片管理功能',
                            showCancel: false,
                            success: () => {
                                uni.navigateBack();
                            }
                        });
                        return;
                    }

                    // 是管理员，加载图片历史
                    this.loadImageHistory();
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

        // 加载图片历史记录
        async loadImageHistory() {
            try {
                const result = await imageManager.getImageList({
                    limit: 10
                });
                if (result.success) {
                    this.setData({
                        imageHistory: result.images
                    });
                }
            } catch (error) {
                console.error('加载图片历史失败:', error);
            }
        },

        // 选择开屏图
        chooseSplashImage() {
            uni.chooseImage({
                count: 1,
                sizeType: ['compressed'],
                // 使用压缩图
                sourceType: ['album', 'camera'],
                success: (res) => {
                    const tempFilePath = res.tempFilePaths[0];
                    this.setData({
                        splashPreview: tempFilePath
                    });
                },
                fail: (error) => {
                    uni.showToast({
                        title: '选择图片失败',
                        icon: 'none'
                    });
                }
            });
        },

        // 上传开屏图
        async uploadSplashImage() {
            if (!this.splashPreview) {
                uni.showToast({
                    title: '请先选择图片',
                    icon: 'none'
                });
                return;
            }
            this.setData({
                uploading: true
            });
            try {
                const result = await imageManager.uploadSplashImage(this.splashPreview);
                if (result.success) {
                    uni.showToast({
                        title: '上传成功',
                        icon: 'success',
                        duration: 2000
                    });

                    // 复制URL到剪贴板
                    uni.setClipboardData({
                        data: result.url,
                        success: () => {
                            uni.showToast({
                                title: 'URL已复制',
                                icon: 'none'
                            });
                        }
                    });

                    // 清空预览
                    this.setData({
                        splashPreview: ''
                    });

                    // 刷新历史记录
                    this.loadImageHistory();
                } else {
                    throw new Error(result.error);
                }
            } catch (error) {
                console.error('上传失败:', error);
                uni.showToast({
                    title: '上传失败: ' + error.message,
                    icon: 'none',
                    duration: 3000
                });
            } finally {
                this.setData({
                    uploading: false
                });
            }
        },

        // 清除开屏图预览
        clearSplashPreview() {
            this.setData({
                splashPreview: ''
            });
        },

        // 复制URL
        copyUrl(e) {
            const url = e.currentTarget.dataset.url;
            uni.setClipboardData({
                data: url,
                success: () => {
                    uni.showToast({
                        title: 'URL已复制',
                        icon: 'none'
                    });
                }
            });
        },

        // 格式化时间
        formatTime(dateStr) {
            return formatRelativeTime(dateStr);
        }
    }
};
</script>
<style>
.container {
    padding: 20rpx;
    background-color: #f8f9fa;
    min-height: 100vh;
}

.header {
    text-align: center;
    margin-bottom: 40rpx;
    padding: 40rpx 0;
}

.title {
    display: block;
    font-size: 48rpx;
    font-weight: bold;
    color: #333;
    margin-bottom: 10rpx;
}

.subtitle {
    display: block;
    font-size: 28rpx;
    color: #666;
}

.section {
    background: white;
    border-radius: 16rpx;
    padding: 30rpx;
    margin-bottom: 20rpx;
    box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.1);
}

.section-title {
    font-size: 32rpx;
    font-weight: bold;
    color: #333;
    margin-bottom: 20rpx;
    display: block;
}

.upload-area {
    border: 2rpx dashed #ddd;
    border-radius: 12rpx;
    padding: 60rpx 40rpx;
    text-align: center;
    background-color: #fafafa;
    transition: all 0.3s ease;
}

.upload-area:active {
    background-color: #f0f0f0;
    border-color: #999;
}

.upload-content {
    display: flex;
    flex-direction: column;
    align-items: center;
}

.upload-icon {
    font-size: 64rpx;
    margin-bottom: 20rpx;
    color: #999;
}

.upload-text {
    font-size: 32rpx;
    color: #333;
    margin-bottom: 10rpx;
    display: block;
}

.upload-hint {
    font-size: 24rpx;
    color: #999;
    display: block;
}

.preview-area {
    margin-top: 30rpx;
    text-align: center;
}

.preview-title {
    font-size: 28rpx;
    color: #333;
    margin-bottom: 20rpx;
    display: block;
}

.preview-image {
    width: 100%;
    height: 400rpx;
    border-radius: 12rpx;
    margin-bottom: 30rpx;
    background-color: #f5f5f5;
}

.button-group {
    display: flex;
    gap: 20rpx;
    justify-content: center;
}

.btn {
    padding: 20rpx 40rpx;
    border-radius: 8rpx;
    font-size: 28rpx;
    border: none;
    min-width: 160rpx;
}

.btn-primary {
    background-color: #9ed7ee;
    color: white;
}

.btn-secondary {
    background-color: #f0f0f0;
    color: #333;
}

.history-list {
    max-height: 600rpx;
    overflow-y: auto;
}

.history-item {
    display: flex;
    align-items: center;
    padding: 20rpx 0;
    border-bottom: 1rpx solid #f0f0f0;
}

.history-item:last-child {
    border-bottom: none;
}

.history-thumb {
    width: 80rpx;
    height: 80rpx;
    border-radius: 8rpx;
    margin-right: 20rpx;
    background-color: #f5f5f5;
}

.history-info {
    flex: 1;
    display: flex;
    flex-direction: column;
}

.history-name {
    font-size: 28rpx;
    color: #333;
    margin-bottom: 4rpx;
}

.history-time {
    font-size: 24rpx;
    color: #999;
    margin-bottom: 4rpx;
}

.history-category {
    font-size: 22rpx;
    color: #666;
    background-color: #f0f0f0;
    padding: 2rpx 8rpx;
    border-radius: 4rpx;
    align-self: flex-start;
}

.history-actions {
    display: flex;
    flex-direction: column;
    gap: 10rpx;
}

.btn-small {
    font-size: 22rpx;
    padding: 8rpx 16rpx;
    margin: 0;
}

.tips {
    background-color: #e8f5e8;
    border-radius: 12rpx;
    padding: 30rpx;
    margin-top: 20rpx;
}

.tips-title {
    font-size: 28rpx;
    font-weight: bold;
    color: #333;
    margin-bottom: 20rpx;
    display: block;
}

.tips-item {
    font-size: 26rpx;
    color: #666;
    margin-bottom: 10rpx;
    display: block;
    line-height: 1.5;
}
</style>
