<template>
    <view>
        <!-- 滚动容器 -->
        <scroll-view class="container" scroll-y="true">
            <!-- 返回按钮在滚动容器内部 -->
            <view class="custom-back-btn" @tap="goBack">
                <image class="back-icon" src="/static/images/left_exit.png" mode="aspectFit"></image>
            </view>

            <!-- 头像区域 -->
            <view class="avatar-section">
                <view class="avatar-container" @tap="onChooseAvatar">
                    <image class="main-avatar" :src="avatarPreviewSrc" mode="aspectFill"></image>
                </view>
            </view>

            <!-- 信息表单区域 -->
            <view class="form-section">
                <view class="form-divider"></view>
                <!-- 昵称 -->
                <view class="form-row">
                    <view class="form-label">
                        <text>昵称</text>
                    </view>
                    <view class="form-input">
                        <input class="input-field" type="text" placeholder="请输入昵称" :value="nickName" @input="onNicknameInput" />
                    </view>
                </view>

                <!-- POEM ID -->
                <view class="form-row">
                    <view class="form-label">
                        <text>POEM ID</text>
                    </view>
                    <view class="form-input">
                        <input class="input-field" type="text" placeholder="请输入POEM ID" :value="poemId" @input="onPoemIdInput" />
                    </view>
                </view>

                <!-- 手机号（可修改） -->
                <!-- #ifndef MP-WEIXIN -->
                <view class="form-row phone-row" @tap="onEditPhoneNumber">
                    <view class="form-label">
                        <text>手机号</text>
                    </view>
                    <view class="form-input">
                        <input class="input-field" type="text" :value="formattedPhoneNumber" :disabled="true" />
                    </view>
                </view>
                <!-- #endif -->

                <!-- 地区 -->
                <view class="form-row">
                    <view class="form-label">
                        <text>地区</text>
                    </view>
                    <view class="form-input">
                        <input class="input-field" type="text" placeholder="如：广东" :value="region" @input="onRegionInput" />
                    </view>
                </view>

                <!-- 生日 -->
                <view class="form-row">
                    <view class="form-label">
                        <text>生日</text>
                    </view>
                    <view class="form-input">
                        <picker mode="date" :value="birthday" start="1920-01-01" :end="endDate" @change="onBirthdayChange">
                            <view class="picker-display">
                                {{ birthday || '请选择生日' }}
                            </view>
                        </picker>
                    </view>
                </view>
            </view>

            <!-- 个性描述区域 -->
            <view class="personality-section">
                <text class="personality-title">假如用1~3句诗形容你，会是</text>
                <view class="poem-input-container">
                    <textarea class="poem-input" placeholder="请写下你的诗..." :value="bio" @input="onBioInput"></textarea>
                </view>
            </view>

            <!-- 签名区域 -->
            <view class="signature-section">
                <view class="signature-header">
                    <text class="signature-title">签个名吧~</text>
                    <view class="signature-options">
                        <text class="signature-option-label">自动去白底</text>
                        <switch class="signature-option-switch" :checked="autoRemoveSignatureBg" @change="onToggleSignatureBg" />
                    </view>
                    <view class="signature-upload-btn" @tap="onChooseSignature">
                        <image class="upload-icon" src="/static/images/upload.png" mode="aspectFit"></image>
                    </view>
                </view>
                <view class="signature-container">
                    <image v-if="signaturePreview" class="signature-preview" :src="signaturePreview" mode="aspectFit"></image>
                </view>
                <canvas
                    id="signatureCanvas"
                    canvas-id="signatureCanvas"
                    type="2d"
                    class="signature-canvas"
                    :style="{ width: signatureCanvasWidth + 'px', height: signatureCanvasHeight + 'px' }"
                ></canvas>
            </view>

            <!-- 为固定按钮留出空间 -->
            <view class="bottom-spacer"></view>
        </scroll-view>

        <!-- 保存按钮在滚动容器之外，固定在屏幕右下角 -->
        <view class="enter-key-btn" @tap="onSaveChanges" :class="{ disabled: isSaving || !hasChanges }">
            <view class="ek-layer ek-border" :class="{ 'ek-border-inactive': !hasChanges }"></view>
            <view class="ek-layer ek-fill" :class="{ 'ek-fill-inactive': !hasChanges }">
                <text class="ek-text" :class="{ 'ek-text-inactive': !hasChanges }">enter ↵</text>
            </view>
        </view>

        <!-- 修改手机号弹窗 -->
        <view class="edit-phone-modal" v-if="showEditPhoneModal" @tap.stop>
            <view class="modal-mask" @tap="closeEditPhoneModal"></view>
            <view class="modal-content">
                <view class="modal-header">
                    <text class="modal-title">修改手机号</text>
                    <text class="modal-close" @tap="closeEditPhoneModal">×</text>
                </view>
                <view class="modal-body">
                    <text class="modal-text">请输入新手机号并通过短信验证</text>

                    <!-- 新手机号输入 -->
                    <view class="input-wrapper phone-input-wrapper">
                        <input
                            class="input-field"
                            type="number"
                            placeholder="请输入新手机号"
                            v-model="newPhoneNumber"
                            maxlength="11"
                        />
                    </view>

                    <!-- 验证码输入 -->
                    <view class="code-wrapper">
                        <view class="input-wrapper code-input-wrapper">
                            <input
                                class="input-field"
                                type="number"
                                placeholder="请输入验证码"
                                v-model="smsCode"
                                maxlength="6"
                            />
                        </view>
                        <view
                            class="code-send-btn"
                            @tap="sendEditPhoneSmsCode"
                            :class="{ disabled: isSendingSms || smsCountdown > 0 || !newPhoneNumber }"
                        >
                            <text class="code-send-text">{{ smsCountdown > 0 ? `${smsCountdown}秒后重发` : (isSendingSms ? '发送中...' : '获取验证码') }}</text>
                        </view>
                    </view>
                </view>
                <view class="modal-footer">
                    <view class="modal-btn cancel-btn" @tap="closeEditPhoneModal">取消</view>
                    <view class="modal-btn confirm-btn" @tap="handleEditPhoneConfirm" :class="{ disabled: isVerifying || (!newPhoneNumber || !smsCode) }">
                        确认修改
                    </view>
                </view>
            </view>
        </view>

        <view
            v-if="showAvatarActionSheet"
            class="avatar-action-sheet-mask"
            @tap="closeAvatarActionSheet"
        ></view>
        <view
            v-if="showAvatarActionSheet"
            class="avatar-action-sheet-panel"
            @tap.stop
        >
            <view
                class="avatar-action-sheet-item"
                @tap="handleAvatarActionSheetSelect('upload')"
            >
                <text class="avatar-action-sheet-text">上传自定义头像</text>
            </view>
            <view
                class="avatar-action-sheet-item"
                @tap="handleAvatarActionSheetSelect('preset')"
            >
                <text class="avatar-action-sheet-text">从默认头像中选择</text>
            </view>
        </view>

        <view v-if="showStickerPicker" class="sticker-picker-modal" @tap="closeStickerPicker">
            <view class="modal-mask"></view>
            <view class="sticker-picker-panel" @tap.stop>
                <view class="sticker-picker-header">
                    <text class="sticker-picker-title">选择默认头像</text>
                    <text class="sticker-picker-close" @tap="closeStickerPicker">×</text>
                </view>
                <view class="sticker-picker-grid">
                    <view
                        v-for="avatar in defaultAvatarOptions"
                        :key="avatar"
                        class="sticker-picker-item"
                        :class="{ 'sticker-picker-item--selected': avatarUrl === avatar }"
                        @tap="selectDefaultAvatar(avatar)"
                    >
                        <image class="sticker-picker-image" :src="avatar" mode="aspectFill"></image>
                    </view>
                </view>
            </view>
        </view>
    </view>
</template>

<script>
// pages/profile-edit/profile-edit.js
const app = getApp();
const { cloudCall } = require('../../utils/cloudCall.js');
const { uploadFile } = require('../../utils/uploader.js');
const { checkContentSafe, checkImageSafe, checkTextSafe } = require('../../utils/contentModeration.js');
const { STICKER_AVATAR_PATHS, isStickerAvatar, resolveUserAvatar } = require('../../utils/defaultAvatar.js');
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
            phoneNumber: '',   // 手机号（只读显示）
            endDate: '',
            isSaving: false,
            tempAvatarPath: null,
            showAvatarActionSheet: false,
            showStickerPicker: false,
            defaultAvatarOptions: STICKER_AVATAR_PATHS,
            currentUserSeed: '',
            signatureUrl: '',
            signaturePreview: '',
            signatureTempPath: null,
            signatureOriginalPath: '',
            isProcessingSignature: false,
            autoRemoveSignatureBg: true,
            signatureCanvasWidth: 1,
            signatureCanvasHeight: 1,
            // 修改手机号相关
            showEditPhoneModal: false,
            newPhoneNumber: '',
            smsCode: '',
            isSendingSms: false,
            isVerifying: false,
            smsCountdown: 0,
            smsTimer: null,
            // 原始数据用于对比
            originalData: {
                avatarUrl: '',
                nickName: '',
                birthday: '',
                bio: '',
                occupation: '',
                region: '',
                poemId: '',
                signatureUrl: ''
            }
        };
    },
    computed: {
        hasChanges() {
            // 检查是否有任何修改
            return (
                this.avatarUrl !== this.originalData.avatarUrl ||
                this.nickName !== this.originalData.nickName ||
                this.birthday !== this.originalData.birthday ||
                this.bio !== this.originalData.bio ||
                this.occupation !== this.originalData.occupation ||
                this.region !== this.originalData.region ||
                this.poemId !== this.originalData.poemId ||
                this.signatureUrl !== this.originalData.signatureUrl ||
                this.tempAvatarPath !== null ||
                this.signatureTempPath !== null
            );
        },
        // 格式化手机号显示（隐藏中间4位）
        formattedPhoneNumber() {
            if (!this.phoneNumber) {
                return '未绑定';
            }
            // 如果手机号长度是11位，显示为：138****5678
            if (this.phoneNumber.length === 11) {
                return this.phoneNumber.substring(0, 3) + '****' + this.phoneNumber.substring(7);
            }
            // 其他情况直接显示
            return this.phoneNumber;
        },
        avatarPreviewSrc() {
            return resolveUserAvatar(
                this.avatarUrl || this.tempAvatarPath || '',
                this.currentUserSeed || this.poemId || this.nickName || (app && app.globalData && app.globalData.openid) || 'profile-edit-avatar'
            );
        }
    },
    onLoad: function (options) {
        this.fetchUserProfile();
        const today = new Date();
        const formattedDate = today.getFullYear() + '-' + (today.getMonth() + 1).toString().padStart(2, '0') + '-' + today.getDate().toString().padStart(2, '0');
        this.setData({
            endDate: formattedDate
        });

        // H5端调试触摸事件
        // #ifdef H5
        console.log('【profile-edit】H5环境，触摸事件调试已禁用');
        // #endif
    },
    methods: {
        // 统一云函数调用方法
        callCloudFunction(name, data = {}, extraOptions = {}) {
            return cloudCall(name, data, Object.assign({ pageTag: 'profile-edit', context: this, requireAuth: true }, extraOptions));
        },

        // #ifdef APP-PLUS
        // 调用 uniCloud 云函数（仅 APP 环境支持，用于一键登录）
        async callUniCloudFunction(name, data) {
            try {
                return await uniCloud.callFunction({
                    name: name,
                    data: data
                });
            } catch (error) {
                const errorMsg = error.message || error.errMsg || String(error);
                const isLocalDebugError = errorMsg.includes('无法连接uniCloud本地调试服务') ||
                                          errorMsg.includes('uniCloud本地调试') ||
                                          errorMsg.includes('本地调试服务') ||
                                          errorMsg.includes('localhost') ||
                                          errorMsg.includes('127.0.0.1');

                if (isLocalDebugError) {
                    console.warn('⚠️ [uniCloud] 检测到本地调试服务连接失败');
                    const enhancedError = new Error('无法连接 uniCloud 本地调试服务');
                    enhancedError.originalError = error;
                    enhancedError.code = 'UNICLOUD_LOCAL_DEBUG_FAILED';
                    throw enhancedError;
                }

                throw error;
            }
        },
        // #endif

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
                            phoneNumber: user.phoneNumber || '', // 手机号（只读显示）
                            signatureUrl: user.signatureUrl || '',
                            signaturePreview: user.signatureUrl || '',
                            signatureTempPath: null,
                            currentUserSeed: (app && app.globalData && app.globalData.openid) || user._openid || user.poemId || user.nickName || ''
                        });
                        
                        // 保存原始数据用于对比
                        this.originalData = {
                            avatarUrl: user.avatarUrl || '',
                            nickName: user.nickName || '',
                            birthday: user.birthday || '',
                            bio: user.bio || '',
                            occupation: user.occupation || '',
                            region: user.region || '',
                            poemId: user.poemId || '',
                            signatureUrl: user.signatureUrl || ''
                        };
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

        onChooseAvatar() {
            this.setData({
                showAvatarActionSheet: true
            });
        },

        closeAvatarActionSheet(callback) {
            this.setData({
                showAvatarActionSheet: false
            });
            if (typeof callback === 'function') {
                setTimeout(callback, 80);
            }
        },

        handleAvatarActionSheetSelect(action) {
            this.closeAvatarActionSheet(() => {
                if (action === 'upload') {
                    this.chooseCustomAvatar();
                    return;
                }
                this.openStickerPicker();
            });
        },

        chooseCustomAvatar() {
            console.log('🔍 [ProfileEdit] 开始选择自定义头像...');
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
                    if (err && err.errMsg && err.errMsg.includes('cancel')) {
                        return;
                    }
                    console.error('🔍 [ProfileEdit] 选择头像失败:', err);
                    uni.showToast({
                        title: '选择头像失败',
                        icon: 'none'
                    });
                }
            });
        },

        openStickerPicker() {
            this.setData({
                showAvatarActionSheet: false,
                showStickerPicker: true
            });
        },

        closeStickerPicker() {
            this.setData({
                showStickerPicker: false
            });
        },

        selectDefaultAvatar(avatarPath) {
            this.setData({
                avatarUrl: avatarPath,
                tempAvatarPath: null,
                showStickerPicker: false
            });

            uni.showToast({
                title: '默认头像已选择',
                icon: 'success',
                duration: 1500
            });
        },
        
        processAvatar(originalPath) {
            console.log('🔍 [ProfileEdit] 开始处理头像:', originalPath);

            // 简化处理：直接使用原图，参考注册页面的逻辑
            this.setData({
                avatarUrl: originalPath,
                tempAvatarPath: originalPath,
                showStickerPicker: false
            });

            uni.showToast({
                title: '头像已选择',
                icon: 'success',
                duration: 1500
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
                    sizeType: ['compressed'],
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
            if (!filePath) {
                uni.showToast({ title: '未选择图片', icon: 'none' });
                return;
            }

            // 记录原始签名图，便于开关切换时回退/重处理
            if (this.signatureOriginalPath !== filePath) {
                this.setData({ signatureOriginalPath: filePath });
            }

            if (!this.autoRemoveSignatureBg) {
                this.setData({
                    signaturePreview: filePath,
                    signatureTempPath: filePath,
                    signatureUrl: ''
                });
                return;
            }

            uni.showLoading({ title: '处理中...', mask: true });
            this.setData({ isProcessingSignature: true });

            this.removeWhiteBackground(filePath)
                .then((processedPath) => {
                    uni.hideLoading();
                    uni.showToast({
                        title: '签名已优化',
                        icon: 'success',
                        duration: 1500
                    });
                    this.setData({
                        signaturePreview: processedPath || filePath,
                        signatureTempPath: processedPath || filePath,
                        signatureUrl: '',
                        isProcessingSignature: false
                    });
                })
                .catch((err) => {
                    console.error('签名去白底失败，回退原图:', err);
                    uni.hideLoading();
                    uni.showToast({
                        title: '去白底失败，已使用原图',
                        icon: 'none',
                        duration: 2000
                    });
                    this.setData({
                        signaturePreview: filePath,
                        signatureTempPath: filePath,
                        signatureUrl: '',
                        isProcessingSignature: false
                    });
                });
            
            /* 
            // 注释掉的canvas处理逻辑
            // 检查平台兼容性
            const { getCurrentPlatform } = require('../../utils/platformDetector.js');
            const platform = getCurrentPlatform();
            
            // 尝试使用node()方法（H5和部分App支持）
            const tryNodeMethod = () => {
                return new Promise((resolve, reject) => {
                    try {
                        uni.createSelectorQuery()
                            .in(uni)
                            .select('#signatureCanvas')
                            .node()
                            .exec((res) => {
                                const canvasNode = res && res[0] && res[0].node;
                                if (canvasNode) {
                                    resolve(canvasNode);
                                } else {
                                    reject(new Error('无法获取canvas节点'));
                                }
                            });
                    } catch (error) {
                        reject(error);
                    }
                });
            };
            
            // 降级方案：使用传统canvas API
            const fallbackMethod = () => {
                return new Promise((resolve, reject) => {
                    try {
                        // 尝试使用备用canvas（canvas-id方式）
                        const query = uni.createSelectorQuery();
                        query.select('#signatureCanvasFallback').fields({
                            node: true,
                            size: true
                        }).exec((res) => {
                            if (res && res[0] && res[0].node) {
                                resolve(res[0].node);
                            } else {
                                // 如果备用canvas也失败，尝试直接获取DOM元素（仅H5环境）
                                if (typeof document !== 'undefined') {
                                    const canvasElement = document.getElementById('signatureCanvas') || 
                                                        document.getElementById('signatureCanvasFallback');
                                    if (canvasElement) {
                                        resolve(canvasElement);
                                    } else {
                                        reject(new Error('降级方案也无法获取canvas节点'));
                                    }
                                } else {
                                    reject(new Error('非H5环境无法使用DOM API'));
                                }
                            }
                        });
                    } catch (error) {
                        // 如果uni API失败，尝试直接获取DOM元素（仅H5环境）
                        try {
                            if (typeof document !== 'undefined') {
                                const canvasElement = document.getElementById('signatureCanvas') || 
                                                    document.getElementById('signatureCanvasFallback');
                                if (canvasElement) {
                                    resolve(canvasElement);
                                } else {
                                    reject(new Error('无法获取canvas元素'));
                                }
                            } else {
                                reject(new Error('非H5环境无法使用DOM API: ' + error.message));
                            }
                        } catch (domError) {
                            reject(new Error('所有方案都失败了: ' + error.message));
                        }
                    }
                });
            };
            
            // 根据平台选择合适的方法
            let canvasPromise;
            if (platform === 'h5') {
                // H5环境优先尝试node()方法，失败后使用DOM降级
                canvasPromise = tryNodeMethod().catch(() => fallbackMethod());
            } else if (platform === 'app') {
                // App环境直接使用原图，跳过canvas处理
                console.log('App环境跳过canvas处理，直接使用原图');
                canvasPromise = Promise.reject(new Error('App环境跳过canvas处理，直接使用原图'));
            } else {
                // 小程序环境直接使用降级方案
                canvasPromise = fallbackMethod();
            }
            
            canvasPromise.then((canvasNode) => {
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
            }).catch((error) => {
                console.error('获取canvas节点失败:', error);
                uni.hideLoading();
                
                // 根据平台提供不同的提示信息
                let toastMessage = '使用原图（背景处理不可用）';
                if (platform === 'app') {
                    toastMessage = 'App环境使用原图（背景处理功能暂不可用）';
                } else if (platform === 'mp-weixin') {
                    toastMessage = '小程序环境使用原图（背景处理功能暂不可用）';
                }
                
                console.log('使用最终降级方案：直接使用原图');
                uni.showToast({
                    title: toastMessage,
                    icon: 'none',
                    duration: 2000
                });
                
                this.setData({
                    signaturePreview: filePath,
                    signatureTempPath: filePath,
                    signatureUrl: '',
                    isProcessingSignature: false
                });
            });
            */
        },

        onToggleSignatureBg(e) {
            const enabled = !!(e && e.detail && e.detail.value);
            this.setData({ autoRemoveSignatureBg: enabled });

            // 切换开关时，如果已有签名图，立即重处理/回退
            const originalPath = this.signatureOriginalPath || this.signatureTempPath;
            if (!originalPath) return;

            if (!enabled) {
                this.setData({
                    signaturePreview: originalPath,
                    signatureTempPath: originalPath,
                    signatureUrl: ''
                });
                return;
            }

            if (this.isProcessingSignature) return;
            this.processSignatureImage(originalPath);
        },

        async removeWhiteBackground(filePath) {
            const { getCurrentPlatform } = require('../../utils/platformDetector.js');
            const platform = getCurrentPlatform();

            const sampleBackgroundColor = (pixels, width, height) => {
                const samplePoints = [
                    [2, 2],
                    [width - 3, 2],
                    [2, height - 3],
                    [width - 3, height - 3],
                    [Math.floor(width / 2), 2],
                    [Math.floor(width / 2), height - 3]
                ];
                let r = 0;
                let g = 0;
                let b = 0;
                let count = 0;
                samplePoints.forEach(([x, y]) => {
                    if (x < 0 || y < 0 || x >= width || y >= height) return;
                    const idx = (y * width + x) * 4;
                    r += pixels[idx];
                    g += pixels[idx + 1];
                    b += pixels[idx + 2];
                    count += 1;
                });
                if (!count) return { r: 255, g: 255, b: 255 };
                return {
                    r: Math.round(r / count),
                    g: Math.round(g / count),
                    b: Math.round(b / count)
                };
            };

            let rawWidth = 0;
            let rawHeight = 0;
            try {
                const imageInfo = await new Promise((resolve, reject) => {
                    uni.getImageInfo({
                        src: filePath,
                        success: resolve,
                        fail: reject
                    });
                });
                rawWidth = imageInfo && imageInfo.width ? imageInfo.width : 0;
                rawHeight = imageInfo && imageInfo.height ? imageInfo.height : 0;
            } catch (infoErr) {
                // H5/部分平台可能无法获取本地图片信息，降级为后续 img 尺寸
                rawWidth = 0;
                rawHeight = 0;
            }

            const isH5 = platform === 'h5' && typeof document !== 'undefined';
            let canvas = null;
            let ctx = null;

            if (isH5) {
                canvas = document.createElement('canvas');
                ctx = canvas.getContext('2d');
                if (!ctx) throw new Error('无法获取 canvas context');
            } else {
                canvas = await new Promise((resolve, reject) => {
                    try {
                        const query = uni.createSelectorQuery().in(this);
                        query
                            .select('#signatureCanvas')
                            .fields({ node: true, size: true })
                            .exec((res) => {
                                const node = res && res[0] && res[0].node;
                                if (node) {
                                    resolve(node);
                                    return;
                                }
                                reject(new Error('无法获取 canvas 节点'));
                            });
                    } catch (error) {
                        reject(error);
                    }
                });
                ctx = canvas.getContext('2d');
                if (!ctx) throw new Error('无法获取 canvas context');
            }

            const img = canvas.createImage ? canvas.createImage() : (typeof Image !== 'undefined' ? new Image() : null);
            if (!img) throw new Error('当前环境不支持加载图片');
            if (isH5 && img && typeof img.crossOrigin !== 'undefined') {
                img.crossOrigin = 'anonymous';
            }

            const imgInfo = await new Promise((resolve, reject) => {
                img.onload = () => resolve({ width: img.width, height: img.height });
                img.onerror = (e) => reject(e || new Error('图片加载失败'));
                img.src = filePath;
            });

            const baseWidth = rawWidth || imgInfo.width || 0;
            const baseHeight = rawHeight || imgInfo.height || 0;
            if (!baseWidth || !baseHeight) {
                throw new Error('无法获取图片尺寸');
            }

            const maxSide = 1200;
            const scale = Math.min(1, maxSide / Math.max(baseWidth, baseHeight));
            const width = Math.max(1, Math.round(baseWidth * scale));
            const height = Math.max(1, Math.round(baseHeight * scale));

            canvas.width = width;
            canvas.height = height;
            if (!isH5) {
                this.setData({
                    signatureCanvasWidth: width,
                    signatureCanvasHeight: height
                });
            }
            ctx.clearRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);

            const imageData = ctx.getImageData(0, 0, width, height);
            const data = imageData.data;

            const bg = sampleBackgroundColor(data, width, height);
            const bgLuma = (bg.r + bg.g + bg.b) / 3;
            const threshold = Math.max(200, Math.min(250, bgLuma - 2));
            const softRange = 28;
            const chromaThreshold = 40;
            const distanceThreshold = 36;

            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                const max = Math.max(r, g, b);
                const min = Math.min(r, g, b);
                const whiteness = (r + g + b) / 3;
                const chroma = max - min;
                const dist = Math.max(Math.abs(r - bg.r), Math.abs(g - bg.g), Math.abs(b - bg.b));

                const isBgStrong = dist <= 18 && chroma <= 26;
                const isBgSoft = dist <= distanceThreshold && chroma <= chromaThreshold;

                if (isBgStrong || (whiteness >= threshold && isBgSoft)) {
                    data[i + 3] = 0;
                } else if (whiteness >= threshold - softRange && isBgSoft) {
                    const t = Math.min(1, Math.max(0, (dist - 18) / (distanceThreshold - 18)));
                    data[i + 3] = Math.round(data[i + 3] * t);
                }
            }

            ctx.putImageData(imageData, 0, 0);

            if (platform === 'h5') {
                if (typeof canvas.toBlob === 'function') {
                    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
                    if (!blob) {
                        throw new Error('H5 导出失败');
                    }
                    return URL.createObjectURL(blob);
                }
                // H5 fallback: toDataURL
                if (typeof canvas.toDataURL === 'function') {
                    const dataUrl = canvas.toDataURL('image/png');
                    return dataUrl;
                }
            }

            return await new Promise((resolve, reject) => {
                const exportOptions = {
                    canvas,
                    x: 0,
                    y: 0,
                    width,
                    height,
                    destWidth: width,
                    destHeight: height,
                    fileType: 'png',
                    quality: 1,
                    success: (res) => resolve(res.tempFilePath),
                    fail: (err) => reject(err)
                };
                uni.canvasToTempFilePath(exportOptions, this);
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


        goBack: function () {
            uni.navigateBack();
        },

        // 修改手机号相关方法
        onEditPhoneNumber(e) {
            console.log('📱 [profile-edit] 点击修改手机号', e);
            console.log('📱 [profile-edit] 当前 showEditPhoneModal 值:', this.showEditPhoneModal);
            this.showEditPhoneModal = true;
            console.log('📱 [profile-edit] 设置后 showEditPhoneModal 值:', this.showEditPhoneModal);
            // 重置表单数据
            this.newPhoneNumber = '';
            this.smsCode = '';
            this.smsCountdown = 0;
            if (this.smsTimer) {
                clearInterval(this.smsTimer);
                this.smsTimer = null;
            }
            // 强制更新视图
            this.$nextTick(() => {
                console.log('📱 [profile-edit] nextTick 后 showEditPhoneModal 值:', this.showEditPhoneModal);
            });
        },

        closeEditPhoneModal() {
            console.log('📱 [profile-edit] 关闭修改手机号弹窗');
            this.showEditPhoneModal = false;
            this.newPhoneNumber = '';
            this.smsCode = '';
            this.smsCountdown = 0;
            if (this.smsTimer) {
                clearInterval(this.smsTimer);
                this.smsTimer = null;
            }
        },

        // 发送短信验证码（修改手机号）
        async sendEditPhoneSmsCode() {
            if (this.isSendingSms || this.smsCountdown > 0 || !this.newPhoneNumber) {
                return;
            }

            // 验证手机号格式
            const phoneRegex = /^1[3-9]\d{9}$/;
            if (!phoneRegex.test(this.newPhoneNumber)) {
                uni.showToast({
                    title: '请输入正确的手机号格式',
                    icon: 'none'
                });
                return;
            }

            // 检查是否和原手机号相同
            if (this.newPhoneNumber === this.phoneNumber) {
                uni.showToast({
                    title: '新手机号不能与当前手机号相同',
                    icon: 'none'
                });
                return;
            }

            this.isSendingSms = true;
            uni.showLoading({
                title: '发送中...',
                mask: true
            });

            try {
                // 调用腾讯云开发发送短信验证码
                const result = await this.$tcb.callFunction({
                    name: 'sendSmsCode',
                    data: {
                        phone: this.newPhoneNumber,
                        scene: 'updatePhone' // 修改手机号场景
                    }
                });

                console.log('📱 [profile-edit] 发送短信结果:', result);

                if (result.result && result.result.success === true) {
                    uni.showToast({
                        title: '验证码已发送',
                        icon: 'success'
                    });
                    this.startSmsCountdown();
                } else {
                    const message = result.result?.message || '发送失败';
                    uni.showToast({
                        title: message,
                        icon: 'none',
                        duration: 3000
                    });
                }
            } catch (error) {
                console.error('📱 [profile-edit] 发送短信失败:', error);

                // 检查是否是 uniCloud 本地调试服务连接问题
                const errorMsg = error.message || error.errMsg || '';
                const errorCode = error.code || '';

                if (errorCode === 'UNICLOUD_LOCAL_DEBUG_FAILED' ||
                    errorMsg.includes('无法连接uniCloud本地调试服务') ||
                    errorMsg.includes('uniCloud本地调试') ||
                    errorMsg.includes('本地调试服务')) {
                    uni.showModal({
                        title: '连接 uniCloud 服务失败',
                        content: '无法连接 uniCloud 本地调试服务。\n\n解决方案：\n1. 在 HBuilderX 运行控制台切换到"连接云端云函数"\n2. 或者确保客户端与主机在同一局域网\n3. 或者检查防火墙是否拦截了 HBuilderX\n4. 如果切换网络环境，请重启 HBuilderX',
                        showCancel: false,
                        confirmText: '知道了'
                    });
                } else {
                    uni.showToast({
                        title: '发送失败，请重试',
                        icon: 'none'
                    });
                }
            } finally {
                uni.hideLoading();
                this.isSendingSms = false;
            }
        },

        // 短信验证码倒计时
        startSmsCountdown() {
            this.smsCountdown = 60;
            this.smsTimer = setInterval(() => {
                if (this.smsCountdown > 0) {
                    this.smsCountdown--;
                } else {
                    clearInterval(this.smsTimer);
                    this.smsTimer = null;
                }
            }, 1000);
        },

        // 确认修改手机号
        async handleEditPhoneConfirm() {
            if (this.isVerifying || !this.newPhoneNumber || !this.smsCode) {
                return;
            }

            // 验证手机号格式
            const phoneRegex = /^1[3-9]\d{9}$/;
            if (!phoneRegex.test(this.newPhoneNumber)) {
                uni.showToast({
                    title: '请输入正确的手机号格式',
                    icon: 'none'
                });
                return;
            }

            if (!this.smsCode || this.smsCode.length !== 6) {
                uni.showToast({
                    title: '请输入6位验证码',
                    icon: 'none'
                });
                return;
            }

            this.isVerifying = true;
            uni.showLoading({
                title: '验证中...',
                mask: true
            });

            try {
                // 1. 验证短信验证码 - 调用腾讯云函数
                const verifyRes = await this.$tcb.callFunction({
                    name: 'verifySmsCode',
                    data: {
                        phone: this.newPhoneNumber,
                        code: this.smsCode,
                        scene: 'updatePhone'
                    }
                });

                console.log('📱 [profile-edit] 验证短信结果:', verifyRes);

                if (verifyRes.result && verifyRes.result.success === true) {
                    // 2. 验证成功，更新用户手机号
                    const updateRes = await this.callCloudFunction('updateUser', {
                        phoneNumber: this.newPhoneNumber,
                        isPhoneVerified: true
                    });

                    if (updateRes.result && updateRes.result.success) {
                        uni.showToast({
                            title: '手机号修改成功',
                            icon: 'success'
                        });

                        // 更新本地数据
                        this.phoneNumber = this.newPhoneNumber;
                        this.closeEditPhoneModal();

                        // 更新全局用户信息
                        const app = getApp();
                        if (app.globalData.userInfo) {
                            app.globalData.userInfo.phoneNumber = this.newPhoneNumber;
                            app.globalData.userInfo.isPhoneVerified = true;
                            uni.setStorageSync('userInfo', app.globalData.userInfo);
                        }
                    } else {
                        throw new Error(updateRes.result?.message || '更新手机号失败');
                    }
                } else {
                    // 验证失败
                    const message = verifyRes.result?.message || '验证码错误';
                    uni.showToast({
                        title: message,
                        icon: 'none',
                        duration: 3000
                    });
                }
            } catch (error) {
                console.error('📱 [profile-edit] 修改手机号失败:', error);

                // 检查是否是 uniCloud 本地调试服务连接问题
                const errorMsg = error.message || error.errMsg || '';
                const errorCode = error.code || '';

                if (errorCode === 'UNICLOUD_LOCAL_DEBUG_FAILED' ||
                    errorMsg.includes('无法连接uniCloud本地调试服务') ||
                    errorMsg.includes('uniCloud本地调试') ||
                    errorMsg.includes('本地调试服务')) {
                    uni.showModal({
                        title: '连接 uniCloud 服务失败',
                        content: '无法连接 uniCloud 本地调试服务。\n\n解决方案：\n1. 在 HBuilderX 运行控制台切换到"连接云端云函数"\n2. 或者确保客户端与主机在同一局域网\n3. 或者检查防火墙是否拦截了 HBuilderX\n4. 如果切换网络环境，请重启 HBuilderX',
                        showCancel: false,
                        confirmText: '知道了'
                    });
                } else {
                    uni.showToast({
                        title: error.message || '修改失败，请重试',
                        icon: 'none',
                        duration: 3000
                    });
                }
            } finally {
                uni.hideLoading();
                this.isVerifying = false;
            }
        },

        onSaveChanges: async function () {
            if (this.isSaving || this.isProcessingSignature || !this.hasChanges) {
                return;
            }

            // 【内容审核】审核个人资料内容（仅小程序端）
            const moderationResult = await this.moderateProfileContent();
            if (!moderationResult.passed) {
                uni.showModal({
                    title: '内容审核未通过',
                    content: moderationResult.message || '您的个人资料包含不适当的信息，请修改后重试',
                    showCancel: false,
                    confirmText: '知道了'
                });
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

            const avatarUpload = this.tempAvatarPath && !isStickerAvatar(this.tempAvatarPath)
                ? uploadFile(`user_avatars/${Date.now()}_${Math.floor(Math.random() * 1000)}.jpg`, this.tempAvatarPath)
                : Promise.resolve(null);
            const signatureUpload = this.signatureTempPath
                ? uploadFile(`user_signatures/${Date.now()}_${Math.floor(Math.random() * 1000)}.png`, this.signatureTempPath)
                : Promise.resolve(null);
            Promise.all([avatarUpload, signatureUpload])
                .then(([avatarFileID, signatureFileID]) => {
                    const resolvedAvatarUrl = avatarFileID || (isStickerAvatar(this.avatarUrl) ? this.avatarUrl : '');
                    const shouldUpdateAvatar = this.tempAvatarPath !== null || this.avatarUrl !== this.originalData.avatarUrl;
                    const updateData = {
                        nickName: this.nickName,
                        birthday: this.birthday,
                        bio: this.bio,
                        occupation: this.occupation,
                        region: this.region,
                        poemId: this.poemId,  // 新增：保存poemId
                        signatureUrl: signatureFileID || ''
                    };
                    if (shouldUpdateAvatar && resolvedAvatarUrl) {
                        updateData.avatarUrl = resolvedAvatarUrl;
                    }
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
        },

        // 【内容审核】审核个人资料内容（仅小程序端）
        async moderateProfileContent() {
            console.log('🔍 [ProfileEdit] 开始审核个人资料');
            
            try {
                uni.showLoading({
                    title: '审核中...',
                    mask: true
                });

                // 准备审核内容
                const textContent = [
                    this.nickName || '',
                    this.poemId || '',
                    this.bio || ''
                ].filter(Boolean).join('\n');

                const imageUrls = [];
                
                // 添加头像
                if (this.tempAvatarPath) {
                    imageUrls.push(this.tempAvatarPath);
                }
                
                // 添加签名
                if (this.signatureTempPath) {
                    imageUrls.push(this.signatureTempPath);
                }

                console.log('🔍 [ProfileEdit] 审核内容:', {
                    textLength: textContent.length,
                    imageCount: imageUrls.length
                });

                // 调用批量审核
                const result = await checkContentSafe({
                    text: textContent,
                    images: imageUrls
                }, {
                    scene: 1 // 场景1-资料
                });

                uni.hideLoading();
                console.log('🔍 [ProfileEdit] 审核结果:', result);
                return result;

            } catch (error) {
                uni.hideLoading();
                console.error('❌ [ProfileEdit] 个人资料审核失败:', error);
                
                // 审核失败时返回通过
                return {
                    passed: true,
                    message: '审核服务暂时不可用'
                };
            }
        },

        }
};
</script>
<style>
/* pages/profile-edit/profile-edit.wxss */

/* 外层容器 */
.container {
    height: 100vh;
    background-color: #ffffff;
    width: 100%;
    box-sizing: border-box;
}

/* 底部留白区域 */
.bottom-spacer {
    height: 240rpx;
    width: 100%;
}

/* --- 以下是您其余的样式，基本保持不变 --- */

.custom-back-btn {
    position: absolute;
    top: calc(90rpx + env(safe-area-inset-top, var(--safe-area-inset-top, 0px))); /* 添加安全区域偏移 */
    left: 40rpx;
    width: 100rpx;
    height: 100rpx;
    background: transparent;
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    transition: all 0.2s ease;
}

.custom-back-btn:active {
    transform: scale(0.95);
}

.custom-back-btn .back-icon {
    width: 22rpx;
    height: 38rpx;
    display: block;
    object-fit: contain;
}

/* 头像区域 */
.avatar-section {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 220rpx 30rpx 120rpx 30rpx;
}

.avatar-container {
    position: relative;
    width: 146rpx;
    height: 146rpx;
    cursor: pointer;
}

.main-avatar {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    border: 4rpx solid #f0f0f0;
}


/* 表单区域 */
.form-section {
    background-color: #ffffff;
    margin: 0 30rpx;
    border-radius: 16rpx;
    overflow: hidden;
}

.form-divider {
    width: 100%;
    height: 1rpx;
    background-color: #f0f0f0;
    margin: 0;
}

.form-row {
    display: flex;
    align-items: center;
    padding: 20rpx 10rpx;
    position: relative;
}

.form-row::after {
    content: '';
    position: absolute;
    bottom: 15rpx; /* 从底部向上偏移10rpx，更贴近文字 */
    left: 200rpx; /* 从标签宽度(160rpx) + 右边距(20rpx) + 左边距(20rpx)开始 */
    right: 20rpx; /* 右边留出20rpx间距 */
    height: 1rpx;
    background-color: #f0f0f0;
}

/* 手机号表单行特殊样式 - 增强H5端点击体验 */
.phone-row {
    cursor: pointer;
    transition: background-color 0.2s ease;
}

.phone-row:hover {
    background-color: rgba(0, 0, 0, 0.02);
}

.phone-row:active {
    background-color: rgba(0, 0, 0, 0.05);
}

.form-label {
    flex-shrink: 0;
    background-color: #cccccc;
    border: 1rpx solid #cccccc;
    padding: 12rpx 20rpx;
    border-radius: 20rpx;
    text-align: center;
    box-sizing: border-box;
    margin-right: 20rpx;
    width: 160rpx;
    height: 50rpx;
    display: flex;
    align-items: center;
    justify-content: center;
}

.form-label text {
    font-size: 28rpx;
    color: #ffffff;
    font-weight: 500;
}

.form-input {
    flex: 1;
    margin: 0 20rpx;
}

.input-field {
    width: 100%;
    font-size: 30rpx;
    color: #000000;
    background: transparent;
    border: none;
}

 .input-field[disabled] {
     color: #999999;
     background-color: #f5f5f5;
     opacity: 1;
     outline: none;
     pointer-events: none;
     /* 让点击穿透禁用的输入框，父级整行可点 */
 }

.picker-display {
    font-size: 30rpx;
    color: #000000;
}


/* 个性描述区域 */
.personality-section {
    padding: 30rpx;
    background-color: #ffffff;
    margin: 10rpx 30rpx 0rpx 30rpx;
    border-radius: 16rpx;
}

.personality-title {
    font-size: 30rpx;
    color: #999999;
    margin-bottom: 40rpx;
    display: block;
}

.poem-input-container {
    background-color: #f5f5f5;
    border-radius: 12rpx;
    padding: 20rpx;
    width: 500rpx;
    margin-left: auto;
}

.poem-input {
    width: 100%;
    height:120rpx;
    min-height: 60rpx;
    font-size: 28rpx;
    color: #333333;
    background: transparent;
    border: none;
    outline: none;
    pointer-events: auto;
    resize: none;
}

/* 签名区域 */
.signature-section {
    padding: 30rpx;
    background-color: #ffffff;
    margin: 0rpx 30rpx;
    border-radius: 16rpx;
}

.signature-header {
    display: flex;
    justify-content: flex-start;
    align-items: center;
    margin-bottom: 20rpx;
    gap: 20rpx;
}

.signature-title {
    font-size: 30rpx;
    color: #999999;
}

.signature-options {
    display: flex;
    align-items: center;
    gap: 10rpx;
}

.signature-option-label {
    font-size: 24rpx;
    color: #999999;
}

.signature-option-switch {
    transform: scale(0.8);
}

.signature-container {
    display: flex;
    flex-direction: column;
    gap: 20rpx;
    width: 100%;
    align-items: flex-start;
    padding: 10rpx;
    border-radius: 12rpx;
    background-color: #ffffff;
    background-image:
        linear-gradient(45deg, #e6e6e6 25%, transparent 25%),
        linear-gradient(-45deg, #e6e6e6 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, #e6e6e6 75%),
        linear-gradient(-45deg, transparent 75%, #e6e6e6 75%);
    background-size: 24rpx 24rpx;
    background-position: 0 0, 0 12rpx, 12rpx -12rpx, -12rpx 0px;
}

.signature-upload-btn {
    background-color: transparent !important;
    background: none !important;
    border: none !important;
    padding: 4rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 50rpx;
    height: 50rpx;
    box-shadow: none !important;
    outline: none !important;
}

.upload-icon {
    width: 50rpx;
    height: 50rpx;
}

.signature-preview {
    width: 100%;
    max-height: 200rpx;
    border-radius: 12rpx;
    object-fit: contain;
}

.signature-canvas {
    position: fixed;
    left: -9999px;
    top: -9999px;
    opacity: 0;
    pointer-events: none;
}

/* 回车键形状按钮 */
.enter-key-btn {
    position: fixed;
    right: 40rpx;
    bottom: 40rpx;
    width: 220rpx;
    height: 180rpx;
    cursor: pointer;
    transition: all 0.2s ease;
    z-index: 99;
}

.enter-key-btn:active { 
    transform: scale(0.95); 
}

.enter-key-btn.disabled { 
    opacity: .5; 
    pointer-events: none; 
}

.enter-key-btn .ek-layer { 
    position: absolute; 
    inset: 0; 
}

/* L 形剪裁：右侧竖条 + 底部横条 */
.enter-key-btn .ek-border { 
    background: #333; 
    filter: drop-shadow(0 6rpx 12rpx rgba(0,0,0,.18)); 
    clip-path: polygon(55% 0,100% 0,100% 100%,0 100%,0 60%,55% 60%,55% 0); 
    border-radius: 24rpx; 
}

.enter-key-btn .ek-fill { 
    background: #fff; 
    clip-path: polygon(57% 2%,100% 2%,100% 100%,2% 100%,2% 62%,57% 62%,57% 2%); 
    border-radius: 22rpx; 
}

.enter-key-btn .ek-text { 
    position: absolute; 
    bottom: 24rpx; 
    left: 24rpx; 
    font-size: 28rpx; 
    color: #333; 
    font-weight: 500; 
}

/* 灰色状态样式 */
.enter-key-btn .ek-border-inactive {
    background: #cccccc !important;
    filter: none !important;
}

.enter-key-btn .ek-fill-inactive {
    background: #f5f5f5 !important;
}

.enter-key-btn .ek-text-inactive {
    color: #999999 !important;
}

/* 响应式设计 */
@media (max-width: 375px) {
    .form-row {
        padding: 24rpx;
    }

    .form-label text, .input-field, .picker-display {
        font-size: 28rpx;
    }
}

/* 修改手机号弹窗 - 仅弹窗样式，不影响原有表单 */
.edit-phone-modal {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 9999;
    display: flex;
    align-items: flex-end;
    justify-content: center;
}

.modal-mask {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
}

.modal-content {
    position: relative;
    width: 100%;
    background: #fff;
    border-radius: 32rpx 32rpx 0 0;
    padding: 40rpx;
    animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
    from {
        transform: translateY(100%);
    }
    to {
        transform: translateY(0);
    }
}

.modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 32rpx;
}

.modal-title {
    font-size: 36rpx;
    font-weight: 600;
    color: #333;
}

.modal-close {
    font-size: 48rpx;
    color: #999;
    line-height: 1;
    width: 48rpx;
    height: 48rpx;
    display: flex;
    align-items: center;
    justify-content: center;
}

.modal-body {
    margin-bottom: 40rpx;
}

.modal-text {
    font-size: 28rpx;
    color: #666;
    line-height: 1.6;
    margin-bottom: 32rpx;
    display: block;
}

.modal-footer {
    display: flex;
    gap: 24rpx;
}

.modal-btn {
    flex: 1;
    height: 88rpx;
    line-height: 88rpx;
    text-align: center;
    border-radius: 44rpx;
    font-size: 32rpx;
    font-weight: 500;
}

.cancel-btn {
    background: #f5f6f7;
    color: #666;
}

.confirm-btn {
    background: #333;
    color: #fff;
}

.confirm-btn.disabled {
    opacity: 0.5;
    pointer-events: none;
}

/* 验证码输入区域样式 - 仅弹窗内部使用 */
.code-wrapper {
    display: flex;
    gap: 16rpx;
    align-items: center;
    margin-bottom: 24rpx;
    justify-content: space-between;
}

.code-input-wrapper {
    flex: 0 0 auto;
    width: 380rpx;
    min-width: 0;
    margin-bottom: 0 !important;
    height: 88rpx;
    display: flex;
    align-items: center;
}

.code-send-btn {
    height: 88rpx;
    width: 220rpx;
    padding: 0 20rpx;
    background: #999999;
    border-radius: 44rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    flex-shrink: 0;
}

.code-send-btn:active {
    opacity: 0.8;
}

.code-send-btn.disabled {
    background: #ccc;
    pointer-events: none;
}

.code-send-text {
    font-size: 26rpx;
    color: #fff;
    white-space: nowrap;
}

.input-wrapper {
    margin-bottom: 24rpx;
}

/* 手机号输入框样式 */
.phone-input-wrapper {
    margin-right: 0;
}

/* 弹窗中的输入框样式 - 不影响原有表单输入框 */
.modal-content .input-field {
    width: 100%;
    height: 88rpx;
    border: 1rpx solid #e0e0e0;
    border-radius: 12rpx;
    padding: 0 24rpx;
    font-size: 30rpx;
    color: #333;
    background: #f8f8f8;
}
/* 无边框输入：仅作用于"修改手机号"弹窗的两个输入框 */
.edit-phone-modal .input-field {
    border: none !important;
}

/* 验证码输入框对齐样式 */
.code-input-wrapper .input-field {
    height: 100%;
    line-height: 88rpx;
    box-sizing: border-box;
    margin: 0;
    padding: 0 24rpx;
}

.sticker-picker-modal {
    position: fixed;
    inset: 0;
    z-index: 10000;
    display: flex;
    align-items: flex-end;
    justify-content: center;
}

.sticker-picker-panel {
    position: relative;
    width: 100%;
    background: #fff;
    border-radius: 32rpx 32rpx 0 0;
    padding: 32rpx;
    max-height: 70vh;
    overflow-y: auto;
}

.sticker-picker-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 24rpx;
}

.sticker-picker-title {
    font-size: 34rpx;
    font-weight: 600;
    color: #333;
}

.sticker-picker-close {
    font-size: 44rpx;
    color: #999;
    line-height: 1;
}

.sticker-picker-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 24rpx;
}

.sticker-picker-item {
    width: 100%;
    aspect-ratio: 1 / 1;
    border-radius: 24rpx;
    padding: 10rpx;
    background: #f7f7f7;
    border: 2rpx solid transparent;
    box-sizing: border-box;
}

.sticker-picker-item--selected {
    border-color: #333;
}

.sticker-picker-image {
    width: 100%;
    height: 100%;
    border-radius: 18rpx;
    display: block;
}

.avatar-action-sheet-mask {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    background: rgba(0, 0, 0, 0.18);
    z-index: 1200;
}

.avatar-action-sheet-panel {
    position: fixed;
    left: 24rpx;
    right: 24rpx;
    bottom: 72rpx;
    bottom: calc(72rpx + constant(safe-area-inset-bottom));
    bottom: calc(72rpx + env(safe-area-inset-bottom));
    background: rgba(255, 255, 255, 0.96);
    border-radius: 24rpx;
    box-shadow: 0 18rpx 40rpx rgba(0, 0, 0, 0.14);
    overflow: hidden;
    z-index: 1201;
    backdrop-filter: blur(14rpx);
    -webkit-backdrop-filter: blur(14rpx);
    animation: avatarActionSheetSlideUp 0.22s ease-out;
}

.avatar-action-sheet-item {
    min-height: 104rpx;
    padding: 0 36rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    border-bottom: 1rpx solid #f0f0f0;
    transition: background-color 0.2s ease;
}

.avatar-action-sheet-item:last-child {
    border-bottom: none;
}

.avatar-action-sheet-item:active {
    background: #f5f5f5;
}

.avatar-action-sheet-text {
    font-size: 32rpx;
    font-weight: 500;
    color: #333;
    line-height: 1.4;
    letter-spacing: 0.5rpx;
}

@keyframes avatarActionSheetSlideUp {
    from {
        opacity: 0;
        transform: translateY(18rpx);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}
</style>
