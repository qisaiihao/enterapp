<template>
    <!-- 用户反馈页面 -->
    <view class="container" :style="'padding-top: ' + statusBarHeight + 'px;'">
        <!-- 头部 -->
        <view class="header" :style="'top: ' + statusBarHeight + 'px;'">
            <view class="header-left" @tap="goBack">
                <text class="back-icon">←</text>
            </view>
            <text class="header-title">意见反馈</text>
            <view class="header-right"></view>
        </view>

        <!-- 反馈内容输入 -->
        <view class="content-section">
            <view class="section-title">反馈内容</view>
            <textarea
                class="content-input"
                placeholder="请详细描述您遇到的问题或建议..."
                :value="content"
                @input="onContentInput"
                maxlength="500"
                :show-confirm-bar="false"
            ></textarea>
            <view class="char-count">{{ content.length }}/500</view>
        </view>

        <!-- 图片上传 -->
        <view class="image-section">
            <view class="section-title">相关图片（可选）</view>
            <view class="image-upload-area">
                <!-- 已选择的图片 -->
                <view class="image-list">
                    <view class="image-item" v-for="(item, index) in images" :key="index">
                        <image class="preview-image" :src="item.path" mode="aspectFill" @tap="previewImage" :data-index="index"></image>

                        <view class="delete-btn" @tap="removeImage" :data-index="index">
                            <text class="delete-icon">×</text>
                        </view>
                    </view>

                    <!-- 添加图片按钮 -->
                    <view v-if="images.length < maxImages" class="add-image-btn" @tap="chooseImages">
                        <text class="add-icon">+</text>
                        <text class="add-text">添加图片</text>
                    </view>
                </view>
            </view>
            <view class="image-tip">最多可上传{{ maxImages }}张图片</view>
        </view>

        <!-- 提交按钮 -->
        <view class="submit-section">
            <button :class="'submit-btn ' + (submitting ? 'submitting' : '')" @tap="submitFeedback" :disabled="submitting">
                {{ submitting ? '提交中...' : '提交反馈' }}
            </button>
        </view>

        <!-- 底部提示 -->
        <view class="footer-tip">
            <text class="tip-text">我们会认真对待每一条反馈，感谢您的支持！</text>
        </view>
    </view>
</template>

<script>
// 用户反馈页面
const { previewImage: previewImageUtil } = require('../../utils/imagePreview.js');
const { cloudCall } = require('../../utils/cloudCall.js');
export default {
    data() {
        return {
            content: '',
            // 反馈内容
            images: [],
            // 反馈图片
            submitting: false,
            // 提交状态
            maxImages: 3,
            // 最大图片数量
            statusBarHeight: 0 // 状态栏高度
        };
    },
    onLoad: function () {
        // 获取状态栏高度
        const systemInfo = uni.getSystemInfoSync();
        this.setData({
            statusBarHeight: systemInfo.statusBarHeight
        });
    },
    methods: {
        // 统一云函数调用方法
        callCloudFunction(name, data = {}, extraOptions = {}) {
            return cloudCall(name, data, Object.assign({ pageTag: 'feedback', context: this }, extraOptions));
        },
        // 输入反馈内容
        onContentInput: function (e) {
            this.setData({
                content: e.detail.value
            });
        },

        // 选择图片
        chooseImages: function () {
            const { images, maxImages } = this;
            const remaining = maxImages - images.length;
            if (remaining <= 0) {
                uni.showToast({
                    title: `最多只能上传${maxImages}张图片`,
                    icon: 'none'
                });
                return;
            }
            uni.chooseMedia({
                count: remaining,
                mediaType: ['image'],
                sourceType: ['album', 'camera'],
                success: (res) => {
                    const tempFiles = res.tempFiles.map((file) => ({
                        path: file.tempFilePath,
                        size: file.size
                    }));
                    this.setData({
                        images: [...images, ...tempFiles]
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

        // 删除图片
        removeImage: function (e) {
            const index = e.currentTarget.dataset.index;
            const images = this.images;
            images.splice(index, 1);
            this.setData({
                images
            });
        },

        // 预览图片
        previewImage: function (e) {
            const index = e.currentTarget.dataset.index;
            const images = Array.isArray(this.images) ? this.images : [];
            if (!images.length) {
                return;
            }
            const urls = images.map((img) => img.path).filter(Boolean);
            if (!urls.length) {
                return;
            }
            const current = urls[index] || urls[0];
            return previewImageUtil({ current, urls }, { fallbackToast: false });
        },

        // 提交反馈
        submitFeedback: function () {
            const { content, images, submitting } = this;
            if (submitting) {
                return;
            }
            if (!content.trim()) {
                uni.showToast({
                    title: '请输入反馈内容',
                    icon: 'none'
                });
                return;
            }
            this.setData({
                submitting: true
            });

            const openid = this.$requireOpenid && this.$requireOpenid();
            if (!openid) {
                this.setData({
                    submitting: false
                });
                return;
            }

            // 先上传图片
            this.uploadImages(images)
                .then((imageUrls) => {
                    // 提交反馈数据
                    return this.submitFeedbackData(content, imageUrls, openid);
                })
                .then(() => {
                    uni.showToast({
                        title: '反馈提交成功',
                        icon: 'success'
                    });

                    // 清空表单
                    this.setData({
                        content: '',
                        images: []
                    });

                    // 延迟返回上一页
                    setTimeout(() => {
                        uni.navigateBack();
                    }, 1500);
                })
                .catch((error) => {
                    console.error('提交反馈失败:', error);
                    uni.showToast({
                        title: '提交失败，请重试',
                        icon: 'none'
                    });
                })
                .finally(() => {
                    this.setData({
                        submitting: false
                    });
                });
        },

        // 上传图片到云存储
        uploadImages: function (images) {
            if (images.length === 0) {
                return Promise.resolve([]);
            }
            const uploadPromises = images.map((image, index) => {
                const fileName = `feedback/${Date.now()}_${index}.jpg`;
                return this.uploadFile(fileName, image.path)
                    .then((res) => {
                        return res.fileID;
                    })
                    .catch((err) => {
                        console.error('图片上传失败:', err);
                        throw err;
                    });
            });
            return Promise.all(uploadPromises);
        },

        // 提交反馈数据
        submitFeedbackData: function (content, imageUrls, openid) {
            return new Promise((resolve, reject) => {
                const safeOpenid = openid || (this.$requireOpenid && this.$requireOpenid());
                if (!safeOpenid) {
                    return reject(new Error('用户未登录'));
                }
                this.callCloudFunction('feedbackManager', {
                        action: 'submitFeedback',
                        content: content,
                        imageUrls: imageUrls,
                        openid: safeOpenid
                    }).then((res) => {
                        if (res.result && res.result.success) {
                            resolve(res.result);
                        } else {
                            reject(new Error(res.result?.message || '提交失败'));
                        }
                    }).catch((err) => {
                        console.error('调用云函数失败:', err);
                        reject(err);
                    });
            });
        },

        // 返回上一页
        goBack: function () {
            uni.navigateBack();
        },

        // 兼容性文件上传方法
        uploadFile(cloudPath, filePath) {
            console.log(`🔍 [反馈页] 上传文件: ${cloudPath}`, filePath);
            
            return new Promise((resolve, reject) => {
                // 使用新的平台检测工具
                const { getCurrentPlatform, getCloudFunctionMethod } = require('../../utils/platformDetector.js');
                
                const platform = getCurrentPlatform();
                const method = getCloudFunctionMethod();
                
                console.log(`🔍 [反馈页] 运行环境检测 - 平台: ${platform}, 方法: ${method}`);
                
                if (method === 'tcb') {
                    // 使用TCB上传文件（H5和App环境）
                    if (this.$tcb && this.$tcb.uploadFile) {
                        console.log(`🔍 [反馈页] TCB环境上传文件: ${cloudPath}`);
                        this.$tcb.uploadFile({
                            cloudPath: cloudPath,
                            filePath: filePath
                        }).then(resolve).catch(reject);
                    } else {
                        console.error(`❌ [反馈页] TCB实例不可用`);
                        reject(new Error('TCB实例不可用'));
                    }
                } else if (method === 'wx-cloud') {
                    // 使用微信云开发上传文件（小程序环境）
                    if (wx.cloud && wx.cloud.uploadFile) {
                        console.log(`🔍 [反馈页] 小程序环境上传文件: ${cloudPath}`);
                        wx.cloud.uploadFile({
                            cloudPath: cloudPath,
                            filePath: filePath,
                            success: (res) => {
                                console.log(`✅ [反馈页] 文件上传成功: ${cloudPath}`, res);
                                resolve(res);
                            },
                            fail: (err) => {
                                console.error(`❌ [反馈页] 文件上传失败: ${cloudPath}`, err);
                                reject(err);
                            }
                        });
                    } else {
                        console.error(`❌ [反馈页] 微信云开发不可用`);
                        reject(new Error('微信云开发不可用'));
                    }
                } else {
                    console.error(`❌ [反馈页] 不支持的文件上传方式: ${method}`);
                    reject(new Error(`不支持的文件上传方式: ${method}`));
                }
            });
        }
    }
};
</script>
<style>
/* 用户反馈页面样式 */
.container {
    min-height: 100vh;
    background-color: #f5f5f5;
    padding-bottom: 40rpx;
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
    z-index: 100;
}

.header-left {
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
    font-size: 32rpx;
    font-weight: 600;
    color: #333;
}

.header-right {
    width: 60rpx;
}

/* 内容区域 */
.content-section {
    background-color: #fff;
    margin: 20rpx 30rpx;
    border-radius: 16rpx;
    padding: 30rpx;
}

.section-title {
    font-size: 28rpx;
    font-weight: 600;
    color: #333;
    margin-bottom: 20rpx;
}

.content-input {
    width: 100%;
    min-height: 200rpx;
    font-size: 28rpx;
    color: #333;
    line-height: 1.6;
    background-color: #f8f8f8;
    border-radius: 12rpx;
    padding: 20rpx;
    box-sizing: border-box;
}

.char-count {
    text-align: right;
    font-size: 24rpx;
    color: #999;
    margin-top: 10rpx;
}

/* 图片上传区域 */
.image-section {
    background-color: #fff;
    margin: 20rpx 30rpx;
    border-radius: 16rpx;
    padding: 30rpx;
}

.image-upload-area {
    margin-bottom: 10rpx;
}

.image-list {
    display: flex;
    flex-wrap: wrap;
    gap: 20rpx;
}

.image-item {
    position: relative;
    width: 160rpx;
    height: 160rpx;
    border-radius: 12rpx;
    overflow: hidden;
}

.preview-image {
    width: 100%;
    height: 100%;
}

.delete-btn {
    position: absolute;
    top: -10rpx;
    right: -10rpx;
    width: 40rpx;
    height: 40rpx;
    background-color: #ff4d4f;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
}

.delete-icon {
    color: #fff;
    font-size: 24rpx;
    font-weight: bold;
}

.add-image-btn {
    width: 160rpx;
    height: 160rpx;
    border: 2rpx dashed #ddd;
    border-radius: 12rpx;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background-color: #fafafa;
}

.add-icon {
    font-size: 48rpx;
    color: #999;
    margin-bottom: 10rpx;
}

.add-text {
    font-size: 24rpx;
    color: #999;
}

.image-tip {
    font-size: 24rpx;
    color: #999;
    text-align: center;
}

/* 提交按钮 */
.submit-section {
    margin: 40rpx 30rpx;
}

.submit-btn {
    width: 100%;
    height: 88rpx;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: #fff;
    font-size: 32rpx;
    font-weight: 600;
    border-radius: 44rpx;
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
}

.submit-btn.submitting {
    background: #ccc;
}

.submit-btn::after {
    border: none;
}

/* 底部提示 */
.footer-tip {
    text-align: center;
    padding: 0 30rpx;
}

.tip-text {
    font-size: 24rpx;
    color: #999;
    line-height: 1.5;
}
</style>
