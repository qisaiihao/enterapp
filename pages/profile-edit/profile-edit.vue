<template>
    <view>
        <!-- pages/profile-edit/profile-edit.wxml -->
        <view class="container">
            <view class="form-group">
                <view class="label">头像</view>
                <button class="avatar-wrapper" @tap="onChooseAvatar">
                    <image class="avatar-preview" :src="avatarUrl || '/static/images/avatar.png'"></image>
                    <view class="avatar-placeholder" v-if="!avatarUrl">
                        <text class="avatar-placeholder-text">点击选择头像</text>
                    </view>
                </button>
            </view>

            <view class="form-group-column signature-section">
                <label class="label">手写签名</label>
                <view class="signature-actions">
                    <button class="signature-upload-btn" @tap="onChooseSignature" :loading="isProcessingSignature" :disabled="isProcessingSignature">上传签名图片</button>
                </view>
                <view class="signature-tip">请上传白底黑字签名，系统会自动去除白色背景并生成透明PNG。</view>
                <image v-if="signaturePreview" class="signature-preview" :src="signaturePreview" mode="aspectFit"></image>
            </view>

            <view class="form-group">
                <label class="label" for="nickname">昵称</label>
                <input id="nickname" class="input" type="nickname" placeholder="请输入昵称" :value="nickName" @input="onNicknameInput" />
            </view>

            <view class="form-group">
                <label class="label">生日</label>
                <picker mode="date" :value="birthday" start="1920-01-01" :end="endDate" @change="onBirthdayChange">
                    <view class="picker-display">
                        {{ birthday || '请选择您的生日' }}
                    </view>
                </picker>
            </view>

            <view class="form-group-column">
                <label class="label">个性签名</label>
                <textarea class="textarea" placeholder="介绍一下自己吧..." :value="bio" @input="onBioInput" maxlength="100"></textarea>
            </view>

            <button class="save-button" @tap="onSaveChanges" :loading="isSaving">保存</button>
        </view>

        <!-- 隐藏的canvas用于头像压缩 -->
        <canvas type="2d" id="signatureCanvas" style="position: fixed; top: -9999px; left: -9999px; width: 400px; height: 200px"></canvas>

        <canvas canvas-id="avatarCompressCanvas" style="position: fixed; top: -9999px; left: -9999px; width: 200px; height: 200px"></canvas>
    </view>
</template>

<script>
// pages/profile-edit/profile-edit.js
const app = getApp();
const { compressAvatar } = require('../../utils/avatarCompress');
const { cloudCall } = require('../../utils/cloudCall.js');
export default {
    data() {
        return {
            avatarUrl: '',
            nickName: '',
            birthday: '',
            bio: '',
            endDate: '',
            isSaving: false,
            tempAvatarPath: null,
            signatureUrl: '',
            signaturePreview: '',
            signatureTempPath: null,
            isProcessingSignature: false
        };
    },
    onLoad: function (options) {
        this.fetchUserProfile();
        const today = new Date();
        const formattedDate = today.getFullYear() + '-' + (today.getMonth() + 1).toString().padStart(2, '0') + '-' + today.getDate().toString().padStart(2, '0');
        this.setData({
            endDate: formattedDate
        });
    },
    methods: {
        // 统一云函数调用方法
        callCloudFunction(name, data = {}, extraOptions = {}) {
            return cloudCall(name, data, Object.assign({ pageTag: 'profile-edit', context: this, requireAuth: true }, extraOptions));
        },

        // 兼容性文件上传方法
        uploadFile(cloudPath, filePath) {
            console.log(`🔍 [ProfileEdit] 上传文件: ${cloudPath}`, filePath);
            
            return new Promise((resolve, reject) => {
                // 使用新的平台检测工具
                const { getCurrentPlatform, getCloudFunctionMethod } = require('../../utils/platformDetector.js');
                
                const platform = getCurrentPlatform();
                const method = getCloudFunctionMethod();
                
                console.log(`🔍 [ProfileEdit] 运行环境: ${platform}, 调用方式: ${method}`);
                
                if (method === 'tcb') {
                    // H5和App环境使用TCB
                    const app = getApp();
                    if (app && app.$tcb && app.$tcb.uploadFile) {
                        console.log(`🔍 [ProfileEdit] ${platform}环境使用TCB上传文件: ${cloudPath}`);
                        app.$tcb.uploadFile({
                            cloudPath: cloudPath,
                            filePath: filePath
                        }).then(resolve).catch(reject);
                    } else {
                        console.error(`❌ [ProfileEdit] ${platform}环境TCB不可用`);
                        console.error(`❌ [ProfileEdit] app:`, app);
                        console.error(`❌ [ProfileEdit] app.$tcb:`, app && app.$tcb);
                        reject(new Error('TCB实例不可用'));
                    }
                } else if (method === 'wx-cloud') {
                    // 小程序环境使用微信云开发
                    if (wx.cloud && wx.cloud.uploadFile) {
                        console.log(`🔍 [ProfileEdit] 小程序环境使用微信云开发上传文件: ${cloudPath}`);
                        wx.cloud.uploadFile({
                            cloudPath: cloudPath,
                            filePath: filePath,
                            success: (res) => {
                                console.log(`✅ [ProfileEdit] 文件上传成功: ${cloudPath}`, res);
                                resolve(res);
                            },
                            fail: (err) => {
                                console.error(`❌ [ProfileEdit] 文件上传失败: ${cloudPath}`, err);
                                reject(err);
                            }
                        });
                    } else {
                        console.error(`❌ [ProfileEdit] 小程序环境微信云开发不可用`);
                        reject(new Error('微信云开发不可用'));
                    }
                } else {
                    console.error(`❌ [ProfileEdit] 不支持的云函数调用方式: ${method}`);
                    reject(new Error(`不支持的云函数调用方式: ${method}`));
                }
            });
        },

        fetchUserProfile: function () {
            this.callCloudFunction('getMyProfileData', {}).then((res) => {
                    if (res.result && res.result.success && res.result.userInfo) {
                        const user = res.result.userInfo;
                        this.setData({
                            avatarUrl: user.avatarUrl || '',
                            nickName: user.nickName || '',
                            birthday: user.birthday || '',
                            bio: user.bio || '',
                            signatureUrl: user.signatureUrl || '',
                            signaturePreview: user.signatureUrl || '',
                            signatureTempPath: null
                        });
                    } else {
                        uni.showToast({
                            title: '加载失败',
                            icon: 'none'
                        });
                    }
                }).catch((err) => {
                    console.error('获取用户资料失败:', err);
                    uni.showToast({
                        title: '加载失败',
                        icon: 'none'
                    });
                });
        },

        onChooseAvatar(e) {
            console.log('🔍 [ProfileEdit] 开始选择头像...');
            
            // 检查运行环境
            const { getCurrentPlatform } = require('../../utils/platformDetector.js');
            const platform = getCurrentPlatform();
            
            console.log(`🔍 [ProfileEdit] 当前平台: ${platform}`);
            
            if (platform === 'mp-weixin' && e.detail && e.detail.avatarUrl) {
                // 微信小程序环境，使用 chooseAvatar API
                const originalPath = e.detail.avatarUrl;
                console.log('🔍 [ProfileEdit] 微信小程序选择头像，原始路径:', originalPath);
                this.processAvatar(originalPath);
            } else {
                // H5和App环境，使用 uni.chooseImage
                console.log('🔍 [ProfileEdit] H5/App环境，使用uni.chooseImage选择头像');
                uni.chooseImage({
                    count: 1,
                    sizeType: ['compressed'],
                    sourceType: ['album', 'camera'],
                    success: (res) => {
                        const originalPath = res.tempFilePaths[0];
                        console.log('🔍 [ProfileEdit] 选择头像成功，原始路径:', originalPath);
                        this.processAvatar(originalPath);
                    },
                    fail: (err) => {
                        console.error('🔍 [ProfileEdit] 选择头像失败:', err);
                        uni.showToast({
                            title: '选择头像失败',
                            icon: 'none'
                        });
                    }
                });
            }
        },
        
        processAvatar(originalPath) {
            console.log('🔍 [ProfileEdit] 开始处理头像:', originalPath);
            
            // 显示压缩提示
            uni.showLoading({
                title: '压缩头像中...'
            });

            // 压缩头像
            compressAvatar(originalPath)
                .then((compressedPath) => {
                    console.log('✅ [ProfileEdit] 头像压缩完成，压缩后路径:', compressedPath);
                    this.setData({
                        avatarUrl: compressedPath,
                        tempAvatarPath: compressedPath
                    });
                    uni.hideLoading();
                    uni.showToast({
                        title: '头像压缩完成',
                        icon: 'success',
                        duration: 1500
                    });
                })
                .catch((err) => {
                    console.error('❌ [ProfileEdit] 头像压缩失败:', err);
                    // 压缩失败，使用原始图片
                    this.setData({
                        avatarUrl: originalPath,
                        tempAvatarPath: originalPath
                    });
                    uni.hideLoading();
                    uni.showToast({
                        title: '压缩失败，使用原图',
                        icon: 'none',
                        duration: 2000
                    });
                });
        },

        onChooseSignature() {
            if (this.isProcessingSignature) {
                return;
            }
            const handleResult = (filePath) => {
                if (!filePath) {
                    uni.showToast({
                        title: '未选择图片',
                        icon: 'none'
                    });
                    return;
                }
                this.processSignatureImage(filePath);
            };
            const chooseMediaOptions = {
                count: 1,
                mediaType: ['image'],
                sourceType: ['album', 'camera'],
                success: (res) => {
                    const file = res.tempFiles && res.tempFiles[0];
                    handleResult(file && (file.tempFilePath || file.filePath));
                },
                fail: (err) => {
                    if (err && err.errMsg && err.errMsg.includes('cancel')) {
                        return;
                    }
                    uni.showToast({
                        title: '选择图片失败',
                        icon: 'none'
                    });
                }
            };
            if (uni.chooseMedia) {
                uni.chooseMedia(chooseMediaOptions);
            } else {
                uni.chooseImage({
                    count: 1,
                    sizeType: ['original', 'compressed'],
                    sourceType: ['album', 'camera'],
                    success: (res) => handleResult(res.tempFilePaths && res.tempFilePaths[0]),
                    fail: (err) => {
                        if (err && err.errMsg && err.errMsg.includes('cancel')) {
                            return;
                        }
                        uni.showToast({
                            title: '选择图片失败',
                            icon: 'none'
                        });
                    }
                });
            }
        },

        processSignatureImage(filePath) {
            uni.showLoading({
                title: '处理中...',
                mask: true
            });
            this.setData({
                isProcessingSignature: true
            });
            uni.createSelectorQuery()
                .in(uni)
                .select('#signatureCanvas')
                .node()
                .exec((res) => {
                    const canvasNode = res && res[0] && res[0].node;
                    if (!canvasNode) {
                        uni.hideLoading();
                        uni.showToast({
                            title: '获取画布失败',
                            icon: 'none'
                        });
                        this.setData({
                            isProcessingSignature: false
                        });
                        return;
                    }
                    const canvas = canvasNode;
                    const ctx = canvas.getContext('2d');
                    const img = canvas.createImage();
                    img.src = filePath;
                    img.onload = () => {
                        const originalWidth = img.width;
                        const originalHeight = img.height;
                        const maxSide = 800;
                        const scale = Math.min(1, maxSide / Math.max(originalWidth, originalHeight));
                        const width = Math.max(1, Math.round(originalWidth * scale));
                        const height = Math.max(1, Math.round(originalHeight * scale));
                        canvas.width = width;
                        canvas.height = height;
                        ctx.clearRect(0, 0, width, height);
                        ctx.drawImage(img, 0, 0, width, height);
                        try {
                            const imageData = ctx.getImageData(0, 0, width, height);
                            const data = imageData.data;
                            for (let i = 0; i < data.length; i += 4) {
                                const r = data[i];
                                const g = data[i + 1];
                                const b = data[i + 2];
                                const avg = (r + g + b) / 3;
                                const diff = Math.max(Math.abs(r - g), Math.abs(r - b), Math.abs(g - b));
                                if (avg > 235 && diff < 25) {
                                    data[i + 3] = 0;
                                } else if (avg > 220 && diff < 30) {
                                    data[i + 3] = Math.min(data[i + 3], 120);
                                }
                            }
                            ctx.putImageData(imageData, 0, 0);
                        } catch (error) {
                            console.log('CatchClause', error);
                            console.log('CatchClause', error);
                            console.error('签名像素处理失败:', error);
                            uni.hideLoading();
                            uni.showToast({
                                title: '处理失败',
                                icon: 'none'
                            });
                            this.setData({
                                isProcessingSignature: false
                            });
                            return;
                        }
                        uni.canvasToTempFilePath({
                            canvas,
                            x: 0,
                            y: 0,
                            width,
                            height,
                            destWidth: width,
                            destHeight: height,
                            fileType: 'png',
                            success: (result) => {
                                uni.hideLoading();
                                uni.showToast({
                                    title: '签名已优化',
                                    icon: 'success',
                                    duration: 1500
                                });
                                this.setData({
                                    signaturePreview: result.tempFilePath,
                                    signatureTempPath: result.tempFilePath,
                                    signatureUrl: ''
                                });
                            },
                            fail: (err) => {
                                console.error('导出签名失败:', err);
                                uni.hideLoading();
                                uni.showToast({
                                    title: '导出失败',
                                    icon: 'none'
                                });
                            },
                            complete: () => {
                                this.setData({
                                    isProcessingSignature: false
                                });
                            }
                        });
                    };
                    img.onerror = (error) => {
                        console.error('签名图片加载失败:', error);
                        uni.hideLoading();
                        uni.showToast({
                            title: '图片加载失败',
                            icon: 'none'
                        });
                        this.setData({
                            isProcessingSignature: false
                        });
                    };
                });
        },

        onNicknameInput(e) {
            this.setData({
                nickName: e.detail.value
            });
        },

        onBirthdayChange(e) {
            this.setData({
                birthday: e.detail.value
            });
        },

        onBioInput(e) {
            this.setData({
                bio: e.detail.value
            });
        },

        onSaveChanges: function () {
            if (this.isSaving || this.isProcessingSignature) {
                return;
            }
            this.setData({
                isSaving: true
            });
            uni.showLoading({
                title: '保存中...',
                mask: true
            });
            const avatarUpload = this.tempAvatarPath
                ? this.uploadFile(`user_avatars/${Date.now()}_${Math.floor(Math.random() * 1000)}`, this.tempAvatarPath)
                : Promise.resolve(null);
            const signatureUpload = this.signatureTempPath
                ? this.uploadFile(`user_signatures/${Date.now()}_${Math.floor(Math.random() * 1000)}.png`, this.signatureTempPath)
                : Promise.resolve(null);
            Promise.all([avatarUpload, signatureUpload])
                .then(([avatarFileID, signatureFileID]) => {
                    return this.callCloudFunction('updateUserProfile', {
                            avatarUrl: avatarFileID,
                            nickName: this.nickName,
                            birthday: this.birthday,
                            bio: this.bio,
                            signatureUrl: signatureFileID
                        });
                })
                .then((res) => {
                    if (res.result.success) {
                        uni.hideLoading();
                        uni.showToast({
                            title: '保存成功'
                        });
                        try {
                            const appInstance = getApp();
                            const userId = appInstance && appInstance.globalData && appInstance.globalData.openid;
                            const { emitAvatarUpdated } = require('@/utils/events.js');
                            emitAvatarUpdated(userId);
                        } catch (e) {}
                        const pages = getCurrentPages();
                        if (pages.length > 1) {
                            const prePage = pages[pages.length - 2];
                            if (prePage && typeof prePage.fetchUserProfile === 'function') {
                                prePage.fetchUserProfile();
                            }
                        }
                        setTimeout(() => uni.navigateBack(), 1000);
                    } else {
                        throw new Error(res.result.message || '云函数保存失败');
                    }
                })
                .catch((err) => {
                    console.error('保存资料失败:', err);
                    uni.hideLoading();
                    uni.showToast({
                        title: err.message || '操作失败',
                        icon: 'none'
                    });
                })
                .finally(() => {
                    this.setData({
                        isSaving: false
                    });
                });
        }
    }
};
</script>
<style>
/* pages/profile-edit/profile-edit.wxss */
.container {
    padding: 30rpx;
}

.form-group,
.form-group-column {
    display: flex;
    align-items: center;
    padding: 20rpx 0;
    border-bottom: 1px solid #f0f0f0;
}

.form-group-column {
    flex-direction: column;
    align-items: flex-start;
}

.label {
    width: 180rpx;
    font-size: 32rpx;
    color: #333;
    flex-shrink: 0;
    margin-bottom: 10rpx; /* For column layout */
}

.avatar-wrapper {
    padding: 0;
    margin: 0;
    background: none;
    border: none;
    line-height: normal;
    width: 120rpx;
    height: 120rpx;
}

.avatar-wrapper::after {
    border: none;
}

.avatar-preview {
    width: 120rpx;
    height: 120rpx;
    border-radius: 50%;
}

.avatar-placeholder {
    position: absolute;
    top: 0;
    left: 0;
    width: 120rpx;
    height: 120rpx;
    border-radius: 50%;
    background-color: #f0f0f0;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2rpx dashed #ccc;
}

.avatar-placeholder-text {
    font-size: 20rpx;
    color: #999;
    text-align: center;
}

.input,
.picker-display,
.textarea {
    flex-grow: 1;
    font-size: 32rpx;
    color: #555;
}

.picker-display {
    text-align: right;
}

.textarea {
    width: 100%;
    height: 150rpx;
    padding: 10rpx;
    background-color: #f7f7f7;
    border-radius: 10rpx;
    margin-top: 10rpx;
}

.save-button {
    margin-top: 60rpx;
    background-color: #9ed7ee;
    color: white;
}

.signature-section {
    width: 100%;
}

.signature-actions {
    display: flex;
    align-items: center;
    gap: 20rpx;
    width: 100%;
}

.signature-upload-btn {
    background-color: #1c9bd6;
    color: #fff;
    border-radius: 8rpx;
    padding: 0 30rpx;
    height: 72rpx;
    line-height: 72rpx;
}

.signature-upload-btn::after {
    border: none;
}

.signature-tip {
    margin-top: 12rpx;
    font-size: 24rpx;
    color: #888;
}

.signature-preview {
    width: 100%;
    max-height: 260rpx;
    margin-top: 24rpx;
    background: #f7f7f7;
    border-radius: 12rpx;
    padding: 20rpx;
    box-sizing: border-box;
}
</style>

