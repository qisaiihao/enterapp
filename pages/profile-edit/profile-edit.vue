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

            <!-- 新增：职业 -->
            <view class="form-group">
                <label class="label" for="occupation">职业</label>
                <input id="occupation" class="input" type="text" placeholder="如：产品经理 / 学生" :value="occupation" @input="onOccupationInput" />
            </view>

            <!-- 新增：地区（统一用文本输入，兼容多端） -->
            <view class="form-group">
                <label class="label" for="region">地区</label>
                <input id="region" class="input" type="text" placeholder="如：北京 / 上海 / 广东深圳" :value="region" @input="onRegionInput" />
            </view>

            <!-- 新增：Poem ID -->
            <view class="form-group">
                <label class="label" for="poemId">Poem ID</label>
                <input id="poemId" class="input" type="text" placeholder="请输入您的Poem ID" :value="poemId" @input="onPoemIdInput" />
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
            occupation: '',
            region: '',
            poemId: '',        // 新增：poemId字段
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
        // 通用文件上传（重构：H5/App 使用 Blob 直传或回退云函数；小程序直传）
        async uploadFile(cloudPath, filePath) {
            const { getCloudFunctionMethod } = require('../../utils/platformDetector.js');
            const method = getCloudFunctionMethod();
            if (method === 'tcb') {
                const app = getApp();
                if (!(app && app.$tcb && typeof app.$tcb.uploadFile === 'function')) {
                    throw new Error('TCB实例不可用');
                }
                let file = filePath;
                try {
                    if (typeof filePath === "string" && typeof fetch === "function" && typeof Blob !== "undefined") {
                        const resp = await fetch(filePath);
                        file = await resp.blob();
                    } else if (filePath && filePath.tempFilePath && typeof fetch === "function") {
                        const resp = await fetch(filePath.tempFilePath);
                        file = await resp.blob();
                    }
                } catch (e) {
                    console.warn('[ProfileEdit] toBlob失败，改走云函数上传', e);
                    return await this.uploadFileViaCloudFunction(cloudPath, filePath);
                }
                try {
                    const res = await app.$tcb.uploadFile({ cloudPath, file });
                    return (res && (res.fileID || res.fileId)) || (res && res.data && res.data.fileID) || res;
                } catch (e) {
                    console.warn('[ProfileEdit] TCB直传失败，fallback 到云函数', e);
                    return await this.uploadFileViaCloudFunction(cloudPath, filePath);
                }
            } else if (method === "wx-cloud") {
                const res = await wx.cloud.uploadFile({ cloudPath, filePath });
                return (res && res.fileID) ? res.fileID : res;
            }
            throw new Error('不支持的云函数调用方式: ' + method);
        },


        // 通过云函数上传（参考发布页逻辑）：H5 将文件转 base64 后上传
        uploadFileViaCloudFunction(cloudPath, filePath, retryCount = 0) {
            return new Promise((resolve, reject) => {
                if (typeof window !== "undefined" && typeof FileReader !== "undefined") {
                    fetch(filePath)
                        .then(response => {
                            if (!response.ok) throw new Error("HTTP " + response.status);
                            return response.blob();
                        })
                        .then(blob => {
                            const reader = new FileReader();
                            reader.onload = () => {
                                const result = reader.result;
                                if (!result || typeof result !== "string") {
                                    reject(new Error("文件读取失败"));
                                    return;
                                }
                                const base64 = result.split(",")[1];
                                this.callCloudFunction("upload", { cloudPath, fileContent: base64 })
                                    .then((uploadRes) => {
                                        if (uploadRes && uploadRes.result && uploadRes.result.success) {
                                            resolve(uploadRes.result.fileID);
                                        } else {
                                            reject(new Error("云函数返回异常"));
                                        }
                                    })
                                    .catch((err) => {
                                        if (retryCount < 2) {
                                            setTimeout(() => {
                                                this.uploadFileViaCloudFunction(cloudPath, filePath, retryCount + 1)
                                                    .then(resolve).catch(reject);
                                            }, 1000 * (retryCount + 1));
                                        } else {
                                            reject(err);
                                        }
                                    });
                            };
                            reader.onerror = () => reject(new Error("文件读取失败"));
                            reader.readAsDataURL(blob);
                        })
                        .catch(err => reject(err));
                } else {
                    reject(new Error("非H5环境不支持此上传方式"));
                }
            });
        },
        fetchUserProfile: function () {
            this.callCloudFunction('getMyProfileData', {}).then((res) => {
                    console.log('【profile-edit】📝 获取用户资料响应:', res);
                    if (res.result && res.result.success && res.result.userInfo) {
                        const user = res.result.userInfo;
                        console.log('【profile-edit】👤 用户数据:', user);
                        console.log('【profile-edit】💼 职业:', user.occupation);
                        console.log('【profile-edit】📍 地区:', user.region);
                        this.setData({
                            avatarUrl: user.avatarUrl || '',
                            nickName: user.nickName || '',
                            birthday: user.birthday || '',
                            bio: user.bio || '',
                            occupation: user.occupation || '',
                            region: user.region || '',
                            poemId: user.poemId || '',          // 新增：设置poemId
                            signatureUrl: user.signatureUrl || '',
                            signaturePreview: user.signatureUrl || '',
                            signatureTempPath: null
                        });
                        console.log('【profile-edit】✅ 设置后的数据:', {
                            occupation: this.occupation,
                            region: this.region
                        });
                    } else {
                        console.error('【profile-edit】❌ 获取用户资料失败:', res);
                        uni.showToast({
                            title: '加载失败',
                            icon: 'none'
                        });
                    }
                }).catch((err) => {
                    console.error('【profile-edit】❌ 获取用户资料异常:', err);
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

        onOccupationInput(e) {
            this.setData({
                occupation: e.detail.value
            });
        },

        onRegionInput(e) {
            this.setData({
                region: e.detail.value
            });
        },

        onPoemIdInput(e) {
            this.setData({
                poemId: e.detail.value
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

            console.log('【profile-edit】💾 开始保存资料，当前数据:', {
                nickName: this.nickName,
                birthday: this.birthday,
                bio: this.bio,
                occupation: this.occupation,
                region: this.region,
                poemId: this.poemId
            });

            const avatarUpload = this.tempAvatarPath
                ? this.uploadFile(`user_avatars/${Date.now()}_${Math.floor(Math.random() * 1000)}.jpg`, this.tempAvatarPath)
                : Promise.resolve(null);
            const signatureUpload = this.signatureTempPath
                ? this.uploadFile(`user_signatures/${Date.now()}_${Math.floor(Math.random() * 1000)}.png`, this.signatureTempPath)
                : Promise.resolve(null);
            Promise.all([avatarUpload, signatureUpload])
                .then(([avatarFileID, signatureFileID]) => {
                    const updateData = {
                        avatarUrl: (typeof avatarFileID === 'object' && avatarFileID) ? (avatarFileID.fileID || avatarFileID.fileId || '') : (avatarFileID || ''),
                        nickName: this.nickName,
                        birthday: this.birthday,
                        bio: this.bio,
                        occupation: this.occupation,
                        region: this.region,
                        poemId: this.poemId,  // 新增：保存poemId
                        signatureUrl: (typeof signatureFileID === 'object' && signatureFileID) ? (signatureFileID.fileID || signatureFileID.fileId || '') : (signatureFileID || '')
                    };
                    console.log('【profile-edit】📤 发送到云函数的数据:', updateData);
                    return this.callCloudFunction('updateUserProfile', updateData);
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


