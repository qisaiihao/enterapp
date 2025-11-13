<template>
    <view>
        <!-- 滚动容器 -->
        <scroll-view class="container" scroll-y="true">
            <!-- 返回按钮在滚动容器内部 -->
            <view class="custom-back-btn" @tap="goBack">
                <image class="back-icon" src="/static/images/back_to_edit.png" mode="aspectFit"></image>
            </view>

            <!-- 头像区域 -->
            <view class="avatar-section">
                <view class="avatar-container" @tap="onChooseAvatar">
                    <image class="main-avatar" :src="avatarUrl || '/static/images/avatar.png'" mode="aspectFill"></image>
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
                <view class="form-row" @tap="onEditPhoneNumber">
                    <view class="form-label">
                        <text>手机号</text>
                    </view>
                    <view class="form-input">
                        <input class="input-field" type="text" :value="formattedPhoneNumber" :disabled="true" />
                    </view>
                </view>

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
                    <view class="signature-upload-btn" @tap="onChooseSignature">
                        <image class="upload-icon" src="/static/images/upload.png" mode="aspectFit"></image>
                    </view>
                </view>
                <view class="signature-container">
                    <image v-if="signaturePreview" class="signature-preview" :src="signaturePreview" mode="aspectFit"></image>
                </view>
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
                    <view class="input-wrapper">
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
    </view>
</template>

<script>
// pages/profile-edit/profile-edit.js
const app = getApp();
const { cloudCall } = require('../../utils/cloudCall.js');
const { uploadFile } = require('../../utils/uploader.js');
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
            signatureUrl: '',
            signaturePreview: '',
            signatureTempPath: null,
            isProcessingSignature: false,
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

        // 调用 uniCloud 云函数（自动处理本地调试服务连接失败的情况）
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
                            signatureTempPath: null
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

            // 简化处理：直接使用原图，参考注册页面的逻辑
            this.setData({
                avatarUrl: originalPath,
                tempAvatarPath: originalPath
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
            // 暂时注释掉所有canvas处理逻辑，直接使用原图
            console.log('签名处理：直接使用原图，跳过canvas处理');
            
            uni.showLoading({
                title: '处理中...',
                mask: true
            });
            
            this.setData({
                isProcessingSignature: true
            });
            
            // 直接使用原图，不进行任何处理
            setTimeout(() => {
                uni.hideLoading();
                uni.showToast({
                    title: '签名已保存',
                    icon: 'success',
                    duration: 1500
                });
                
                this.setData({
                    signaturePreview: filePath,
                    signatureTempPath: filePath,
                    signatureUrl: '',
                    isProcessingSignature: false
                });
            }, 500); // 模拟处理时间
            
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

        // 个性签名输入（绑定到bio字段）
        onBioInput: function (e) {
            this.setData({
                bio: e.detail.value
            });
        },

        goBack: function () {
            uni.navigateBack();
        },

        // 修改手机号相关方法
        onEditPhoneNumber() {
            console.log('📱 [profile-edit] 点击修改手机号');
            this.showEditPhoneModal = true;
            // 重置表单数据
            this.newPhoneNumber = '';
            this.smsCode = '';
            this.smsCountdown = 0;
            if (this.smsTimer) {
                clearInterval(this.smsTimer);
                this.smsTimer = null;
            }
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
                // 调用 uniCloud 发送短信验证码
                const result = await this.callUniCloudFunction('sendSmsCode', {
                    phone: this.newPhoneNumber,
                    scene: 'updatePhone' // 修改手机号场景
                });

                console.log('📱 [profile-edit] 发送短信结果:', result);

                if (result.result && result.result.code === 0) {
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
                // 1. 验证短信验证码
                const verifyRes = await this.callUniCloudFunction('verifySmsCode', {
                    phone: this.newPhoneNumber,
                    code: this.smsCode,
                    scene: 'updatePhone'
                });

                console.log('📱 [profile-edit] 验证短信结果:', verifyRes);

                if (verifyRes.result && verifyRes.result.code === 0) {
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
                    const message = verifyRes.result?.message || '验证码错误';
                    throw new Error(message);
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

        onSaveChanges: function () {
            if (this.isSaving || this.isProcessingSignature || !this.hasChanges) {
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
                ? uploadFile(`user_avatars/${Date.now()}_${Math.floor(Math.random() * 1000)}.jpg`, this.tempAvatarPath)
                : Promise.resolve(null);
            const signatureUpload = this.signatureTempPath
                ? uploadFile(`user_signatures/${Date.now()}_${Math.floor(Math.random() * 1000)}.png`, this.signatureTempPath)
                : Promise.resolve(null);
            Promise.all([avatarUpload, signatureUpload])
                .then(([avatarFileID, signatureFileID]) => {
                    const updateData = {
                        avatarUrl: avatarFileID || '',
                        nickName: this.nickName,
                        birthday: this.birthday,
                        bio: this.bio,
                        occupation: this.occupation,
                        region: this.region,
                        poemId: this.poemId,  // 新增：保存poemId
                        signatureUrl: signatureFileID || ''
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
    top: calc(90rpx + env(safe-area-inset-top, var(--safe-area-inset-top, 44px))); /* 添加安全区域偏移 */
    left: 40rpx;
    width: 100rpx;
    height: 100rpx;
    background: transparent;
    border: none;
    display: block;
    z-index: 100;
    transition: all 0.2s ease;
}

.custom-back-btn:active {
    transform: scale(0.95);
}

.custom-back-btn .back-icon {
    width: 100rpx;
    height: 100rpx;
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

.signature-container {
    display: flex;
    flex-direction: column;
    gap: 20rpx;
    width: 60%;
    align-items: flex-start;
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
    gap: 20rpx;
    align-items: flex-end;
    margin-bottom: 24rpx;
}

.code-input-wrapper {
    flex: 1;
    margin-bottom: 0;
}

.code-send-btn {
    height: 88rpx;
    padding: 0 24rpx;
    background: #667eea;
    border-radius: 44rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
}

.code-send-btn:active {
    opacity: 0.8;
}

.code-send-btn.disabled {
    background: #ccc;
    pointer-events: none;
}

.code-send-text {
    font-size: 28rpx;
    color: #fff;
    white-space: nowrap;
}

.input-wrapper {
    margin-bottom: 24rpx;
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
</style>
