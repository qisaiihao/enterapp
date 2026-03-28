<template>
  <view class="white-page">
    <view class="container">
      <view class="avatar-top">
        <view class="avatar-preview" @tap="onChooseAvatar">
          <image :src="localAvatarTempPath || '/static/images/avatar.png'" mode="aspectFill"></image>
        </view>
        <text class="avatar-cta">点击更换头像</text>
      </view>

      <view class="form-wrapper compact">
        <!-- 根据需求：不在资料表单中直接展示手机号输入，改为点击确认后弹窗绑定 -->

        <view class="input-wrapper">
          <text class="input-label">Poem ID</text>
          <input class="input-field" type="text" placeholder="请输入 Poem ID" v-model="poemId" @input="onPoemIdInput" />
        </view>

        <view class="input-wrapper">
          <text class="input-label">密码</text>
          <input class="input-field" type="password" placeholder="请输入密码" v-model="password" @input="onPasswordInput" />
        </view>

        <view class="input-wrapper">
          <text class="input-label">确认密码</text>
          <input class="input-field" type="password" placeholder="请再次输入密码" v-model="confirmPassword" @input="onConfirmPasswordInput" />
        </view>

        <view class="input-wrapper">
          <text class="input-label">昵称</text>
          <input class="input-field" type="text" placeholder="请输入昵称" v-model="nickName" @input="onNickNameInput" />
        </view>

        <view class="login-link-wrapper subtle">
          <text class="login-text">已有账号？</text>
          <text class="login-link" @tap="handleLoginLinkTap">
            {{ fromGithub ? '绑定账号' : '去登录' }}
          </text>
        </view>
      </view>
    </view>

    <!-- 右下角"回车键"形状按钮：点击注册 -->
    <view class="enter-key-btn" @tap="onRegister" :class="{ disabled: !canRegister || isRegistering }">
      <view class="ek-layer ek-border"></view>
      <view class="ek-layer ek-fill">
        <text class="ek-text">Enter ↵</text>
      </view>
    </view>

    <!-- 绑定已有账号弹窗 -->
    <view class="edit-phone-modal" v-if="showBindAccountDialog" @tap.stop>
      <view class="modal-mask" @tap="closeBindAccountDialog"></view>
      <view class="modal-content">
        <view class="modal-header">
          <text class="modal-title">绑定 GitHub 到已有账号</text>
          <text class="modal-close" @tap="closeBindAccountDialog">×</text>
        </view>
        <view class="modal-body">
          <text class="modal-text">请输入您已有账号的 Poem ID 和密码</text>
          <view class="sms-bind-form">
            <view class="input-wrapper">
              <input class="input-field" type="text" placeholder="请输入 Poem ID" v-model="bindPoemId" />
            </view>
            <view class="input-wrapper">
              <input class="input-field" type="password" placeholder="请输入密码" v-model="bindPassword" />
            </view>
          </view>
        </view>
        <view class="modal-footer">
          <view class="modal-btn cancel-btn" @tap="closeBindAccountDialog">取消</view>
          <view class="modal-btn confirm-btn" @tap="handleBindGithubToAccount" :class="{ disabled: isBinding || !bindPoemId || !bindPassword }">
            {{ isBinding ? '绑定中...' : '确认绑定' }}
          </view>
        </view>
      </view>
    </view>

    <!-- 绑定手机号弹窗（样式对齐个人资料修改页面） -->
    <!-- #ifndef MP-WEIXIN -->
    <view class="edit-phone-modal" v-if="showBindPhoneModal" @tap.stop>
      <view class="modal-mask" @tap="closeBindPhoneModal"></view>
      <view class="modal-content">
        <view class="modal-header">
          <text class="modal-title">绑定手机号</text>
          <text class="modal-close" @tap="closeBindPhoneModal">×</text>
        </view>
        <view class="modal-body">
          <text class="modal-text">为保障账户安全，请先绑定手机号完成注册</text>
          <view class="sms-bind-form">
            <view class="input-wrapper">
              <input class="input-field" type="number" placeholder="请输入手机号" v-model="smsPhoneNumber" maxlength="11" />
            </view>
            <view class="code-wrapper">
              <view class="input-wrapper code-input-wrapper">
                <input class="input-field" type="number" placeholder="请输入验证码" v-model="smsCode" maxlength="6" />
              </view>
              <view class="code-send-btn" @tap="sendBindSmsCodeForRegister" :class="{ disabled: isSendingSms || smsCountdown > 0 || !smsPhoneNumber }">
                <text class="code-send-text">{{ smsCountdown > 0 ? `${smsCountdown}秒后重发` : (isSendingSms ? '发送中...' : '获取验证码') }}</text>
              </view>
            </view>
          </view>
        </view>
        <view class="modal-footer">
          <view class="modal-btn cancel-btn" @tap="skipBindPhoneAndRegister">跳过</view>
          <view class="modal-btn confirm-btn" @tap="handleBindPhoneForRegister" :class="{ disabled: isBindingPhone || (!smsCode || !smsPhoneNumber) }">确认绑定</view>
        </view>
      </view>
    </view>
    <!-- #endif -->
  </view>
</template>

<script>
// pages/register/register.js
import { cloudCall } from '@/utils/cloudCall.js';
import { getCurrentPlatform } from '@/utils/platformDetector.js';
import { applyAuthenticatedUserSession } from '@/utils/appBackground.js';

const app = getApp();

// #ifdef APP-PLUS
// 调用 uniCloud 云函数（仅 APP 环境支持，用于一键登录）
async function callUniCloudFunction(name, data) {
    try {
        // 直接调用，uniCloud 会根据 HBuilderX 配置自动选择本地或云端
        // 理论上如果本地调试服务不可用，会自动降级到云端
        return await uniCloud.callFunction({
            name: name,
            data: data
        });
    } catch (error) {
        // 检查是否是本地调试服务连接失败
        const errorMsg = error.message || error.errMsg || String(error);
        const isLocalDebugError = errorMsg.includes('无法连接uniCloud本地调试服务') || 
                                  errorMsg.includes('uniCloud本地调试') ||
                                  errorMsg.includes('本地调试服务') ||
                                  errorMsg.includes('localhost') ||
                                  errorMsg.includes('127.0.0.1');
        
        if (isLocalDebugError) {
            console.warn('⚠️ [uniCloud] 检测到本地调试服务连接失败，错误信息:', errorMsg);
            console.warn('⚠️ [uniCloud] 提示：请在 HBuilderX 运行控制台切换到"连接云端云函数"');
            
            // 重新抛出错误，由调用方处理（会显示友好的错误提示）
            const enhancedError = new Error('无法连接 uniCloud 本地调试服务。\n\n解决方案：\n1. 在 HBuilderX 运行控制台切换到"连接云端云函数"\n2. 或者确保客户端与主机在同一局域网\n3. 或者检查防火墙是否拦截了 HBuilderX');
            enhancedError.originalError = error;
            enhancedError.code = 'UNICLOUD_LOCAL_DEBUG_FAILED';
            throw enhancedError;
        }
        
        // 其他错误直接抛出
        throw error;
    }
}
// #endif

export default {
    data() {
        return {
            poemId: '',
            password: '',
            confirmPassword: '',
            nickName: '',
            isRegistering: false,
            isWaitingPhoneBind: false,
            // 新增：头像直观状态
            localAvatarTempPath: '',
            avatarFileID: '',
            isUploadingAvatar: false,
            // 手机号相关
            phoneNumber: '',
            isGettingPhone: false,
            // 短信验证码相关
            smsPhoneNumber: '',
            smsCode: '',
            isSendingSms: false,
            smsCountdown: 0,
            smsTimer: null,
            // 绑定弹窗
            showBindPhoneModal: false,
            isBindingPhone: false,
            // GitHub 登录相关
            fromGithub: false,
            githubData: null,
            // 微信登录相关
            fromWechat: false,
            wechatData: null,
            // 绑定已有账号
            showBindAccountDialog: false,
            bindPoemId: '',
            bindPassword: '',
            isBinding: false
        };
    },
    
    computed: {
        canRegister() {
            return this.poemId.trim() && 
                   this.password.trim() && 
                   this.confirmPassword.trim() && 
                   this.nickName.trim() &&
                   this.password === this.confirmPassword;
        },
        // 判断是否为 APP 端
        isApp() {
            // #ifdef APP-PLUS
            return true;
            // #endif
            // #ifndef APP-PLUS
            return false;
            // #endif
        }
    },
    
    onLoad: function (options) {
        // 检查是否来自 GitHub 登录
        if (options.fromGithub === 'true' && options.githubData) {
            try {
                this.fromGithub = true;
                this.githubData = JSON.parse(decodeURIComponent(options.githubData));
                
                console.log('📱 [注册页] 检测到 GitHub 登录数据:', this.githubData);
                
                // 预填充表单数据
                if (this.githubData.githubUsername) {
                    this.poemId = this.githubData.githubUsername;
                }
                if (this.githubData.githubName) {
                    this.nickName = this.githubData.githubName;
                }
                if (this.githubData.githubAvatar) {
                    this.localAvatarTempPath = this.githubData.githubAvatar;
                    this.avatarFileID = this.githubData.githubAvatar;
                }
                
                uni.showToast({
                    title: '请完善注册信息',
                    icon: 'none',
                    duration: 2000
                });
            } catch (error) {
                console.error('❌ [注册页] 解析 GitHub 数据失败:', error);
            }
        }
        
        // 检查是否来自微信登录
        if (options.fromWechat === 'true') {
            try {
                this.fromWechat = true;
                // 从本地存储读取微信数据
                const wechatData = uni.getStorageSync('wechat_temp_data');
                if (wechatData) {
                    this.wechatData = wechatData;
                    console.log('📱 [注册页] 检测到微信登录数据:', this.wechatData);
                    
                    uni.showToast({
                        title: '请完善注册信息',
                        icon: 'none',
                        duration: 2000
                    });
                }
            } catch (error) {
                console.error('❌ [注册页] 读取微信数据失败:', error);
            }
        }
    },
    
    methods: {
        // 统一云函数调用方法
        callCloudFunction(name, data = {}, extraOptions = {}) {
            return cloudCall(name, data, Object.assign({ pageTag: 'register', context: this }, extraOptions));
        },

        // 通过云函数上传（H5: fetch -> blob -> base64；小程序/App：FileSystemManager 读为 base64）
        uploadAvatarViaCloudFunction(filePath) {
            return new Promise((resolve, reject) => {
                // H5: 使用 fetch + FileReader
                if (typeof window !== 'undefined' && typeof FileReader !== 'undefined') {
                    fetch(filePath)
                        .then((resp) => {
                            if (!resp.ok) throw new Error('HTTP ' + resp.status);
                            return resp.blob();
                        })
                        .then((blob) => {
                            const reader = new FileReader();
                            reader.onload = () => {
                                const result = reader.result;
                                if (!result || typeof result !== 'string') return reject(new Error('读取失败'));
                                const base64 = result.split(',')[1];
                                this.callCloudFunction('upload', {
                                    cloudPath: `user_avatars/${Date.now()}_${Math.floor(Math.random() * 1000)}.jpg`,
                                    fileContent: base64
                                }).then((res) => {
                                    if (res && res.result && res.result.success) resolve(res.result.fileID); else reject(new Error('上传失败'));
                                }).catch(reject);
                            };
                            reader.onerror = () => reject(new Error('读取失败'));
                            reader.readAsDataURL(blob);
                        })
                        .catch(reject);
                    return;
                }
                // 小程序/App: FileSystemManager 读取为 base64
                try {
                    const fsm = uni.getFileSystemManager && uni.getFileSystemManager();
                    if (!fsm) return reject(new Error('不支持的环境'));
                    fsm.readFile({
                        filePath,
                        encoding: 'base64',
                        success: (r) => {
                            const base64 = r.data;
                            this.callCloudFunction('upload', {
                                cloudPath: `user_avatars/${Date.now()}_${Math.floor(Math.random() * 1000)}.jpg`,
                                fileContent: base64
                            }).then((res) => {
                                if (res && res.result && res.result.success) resolve(res.result.fileID); else reject(new Error('上传失败'));
                            }).catch(reject);
                        },
                        fail: (err) => reject(err)
                    });
                } catch (e) {
                    reject(e);
                }
            });
        },

        onChooseAvatar() {
            if (this.isUploadingAvatar) return;
            const handle = (p) => {
                if (!p) return;
                this.isUploadingAvatar = true;
                this.localAvatarTempPath = p; // 先本地预览
                this.uploadAvatarViaCloudFunction(p)
                    .then((fid) => {
                        this.avatarFileID = fid;
                        uni.showToast({ title: '头像上传成功', icon: 'success' });
                    })
                    .catch((err) => {
                        console.error('上传头像失败:', err);
                        this.avatarFileID = '';
                        uni.showToast({ title: '头像上传失败', icon: 'none' });
                    })
                    .finally(() => { this.isUploadingAvatar = false; });
            };
            if (uni.chooseMedia) {
                uni.chooseMedia({ count: 1, mediaType: ['image'], sourceType: ['album', 'camera'], success: (res) => {
                    const f = res.tempFiles && res.tempFiles[0];
                    handle(f && (f.tempFilePath || f.filePath));
                }, fail: (e) => { if (!(e && e.errMsg && e.errMsg.includes('cancel'))) uni.showToast({ title: '选择失败', icon: 'none' }); } });
            } else {
                uni.chooseImage({ count: 1, sizeType: ['compressed'], sourceType: ['album','camera'], success: (res) => {
                    handle(res.tempFilePaths && res.tempFilePaths[0]);
                }, fail: (e) => { if (!(e && e.errMsg && e.errMsg.includes('cancel'))) uni.showToast({ title: '选择失败', icon: 'none' }); } });
            }
        },

        // 兼容性认证方法
        async performAuth() {
            console.log('🔐 [Register] 开始认证流程');
            
            return new Promise((resolve, reject) => {
                const platform = getCurrentPlatform();
                
                if (platform === 'h5' || platform === 'app') {
                    // H5和App环境使用TCB认证
                    if (this.$tcb && this.$tcb.auth) {
                        const currentUser = this.$tcb.auth().currentUser;
                        if (!currentUser) {
                            console.log('🔐 [注册] 尝试匿名登录...');
                            this.$tcb.auth().signInAnonymously().then((authResult) => {
                                console.log('✅ [注册] 匿名登录成功:', authResult);
                                resolve(authResult);
                            }).catch(reject);
                        } else {
                            console.log('✅ [注册] 用户已登录，跳过匿名登录');
                            resolve(currentUser);
                        }
                    } else {
                        reject(new Error('TCB认证不可用'));
                    }
                } else if (platform === 'miniprogram') {
                    // 小程序环境使用微信云开发认证
                    if (wx.cloud && wx.cloud.auth) {
                        const currentUser = wx.cloud.auth().currentUser;
                        if (!currentUser) {
                            console.log('🔐 [注册] 尝试匿名登录...');
                            wx.cloud.auth().signInAnonymously().then((authResult) => {
                                console.log('✅ [注册] 匿名登录成功:', authResult);
                                resolve(authResult);
                            }).catch(reject);
                        } else {
                            console.log('✅ [注册] 用户已登录，跳过匿名登录');
                            resolve(currentUser);
                        }
                    } else {
                        reject(new Error('微信云开发认证不可用'));
                    }
                } else {
                    reject(new Error(`不支持的平台: ${platform}`));
                }
            });
        },

        onPoemIdInput(e) {
            this.poemId = e.detail.value;
        },

        onPasswordInput(e) {
            this.password = e.detail.value;
        },

        onConfirmPasswordInput(e) {
            this.confirmPassword = e.detail.value;
        },

        onNickNameInput(e) {
            this.nickName = e.detail.value;
        },

        async onRegister() {
            if (!this.canRegister || this.isRegistering) {
                return;
            }

            // 检查密码是否一致
            if (this.password !== this.confirmPassword) {
                uni.showToast({
                    title: '两次输入的密码不一致',
                    icon: 'none',
                    duration: 3000
                });
                return;
            }

            // #ifndef MP-WEIXIN
            // 必须先绑定手机号（非小程序端）
            if (!this.phoneNumber) {
                if (this.isApp) {
                    // App 先拉起一键登录弹窗，用户可选择其它方式切换到短信
                    this.tryOneClickBindOnAppThenRegister();
                } else {
                    // 其他端：直接弹短信验证码绑定
                    this.showBindPhoneModal = true;
                }
                return;
            }
            // #endif

            // 已有手机号或小程序端，直接提交注册
            await this.submitRegister();
        },

        goToLogin() {
            // 跳转到登录页面
            uni.navigateBack();
        },
        
        // 处理"去登录"或"绑定账号"点击
        handleLoginLinkTap() {
            if (this.fromGithub) {
                this.showBindAccountModal();
            } else {
                this.goToLogin();
            }
        },
        
        // 显示绑定账号弹窗
        showBindAccountModal() {
            this.showBindAccountDialog = true;
        },
        
        // 关闭绑定账号弹窗
        closeBindAccountDialog() {
            this.showBindAccountDialog = false;
            this.bindPoemId = '';
            this.bindPassword = '';
        },
        
        // 绑定 GitHub 到已有账号
        async handleBindGithubToAccount() {
            if (this.isBinding || !this.bindPoemId || !this.bindPassword) return;
            
            this.isBinding = true;
            uni.showLoading({ title: '绑定中...', mask: true });
            
            try {
                // 1. 先验证账号密码
                const loginResult = await this.$tcb.callFunction({
                    name: 'loginWithCredentials',
                    data: {
                        poemId: this.bindPoemId,
                        password: this.bindPassword
                    }
                });
                
                console.log('🔍 [绑定账号] 登录验证结果:', loginResult);
                
                if (!loginResult.result || !loginResult.result.success) {
                    throw new Error(loginResult.result?.message || '账号或密码错误');
                }
                
                const userInfo = loginResult.result.userInfo;  // 注意：是 userInfo 不是 user
                const targetOpenid = userInfo._openid;  // 查询到的用户的 openid
                
                console.log('✅ [绑定账号] 查询到的用户信息:', userInfo);
                console.log('✅ [绑定账号] 目标账号的 openid:', targetOpenid);
                console.log('✅ [绑定账号] GitHub数据:', this.githubData);
                
                // 2. 使用查询到的用户的 openid 来更新数据库，添加 GitHub 信息
                const updateData = {
                    openid: targetOpenid,  // 使用查询到的用户的 openid
                    githubEmail: this.githubData.githubEmail,
                    githubOpenid: this.githubData.openid  // 保存 GitHub 的 openid，用于后续 GitHub 登录
                };
                
                console.log('🔍 [绑定账号] 准备更新的数据:', updateData);
                
                const updateResult = await this.$tcb.callFunction({
                    name: 'updateUser',
                    data: updateData
                });
                
                console.log('🔍 [绑定账号] 更新结果:', updateResult);
                console.log('🔍 [绑定账号] 更新结果详情:', JSON.stringify(updateResult, null, 2));
                
                if (!updateResult.result || !updateResult.result.success) {
                    throw new Error(updateResult.result?.message || '绑定失败，请重试');
                }
                
                // 3. 保存用户信息到本地（使用查询到的用户信息 + GitHub 信息）
                const updatedUserInfo = {
                    ...userInfo,
                    githubEmail: this.githubData.githubEmail,
                    githubOpenid: this.githubData.openid,
                    _openid: targetOpenid  // 使用查询到的用户的 openid
                };
                
                uni.setStorageSync('github_access_token', this.githubData.accessToken);

                await applyAuthenticatedUserSession(updatedUserInfo, {
                    openid: targetOpenid
                });
                
                uni.hideLoading();
                uni.showToast({
                    title: 'GitHub 绑定成功！',
                    icon: 'success',
                    duration: 2000
                });
                
                // 5. 跳转到诗歌广场
                setTimeout(() => {
                    uni.reLaunch({
                        url: '/pages/poem-square/poem-square'
                    });
                }, 2000);
                
            } catch (error) {
                console.error('❌ [绑定账号] 失败:', error);
                uni.hideLoading();
                uni.showModal({
                    title: '绑定失败',
                    content: error.message || '请检查账号密码是否正确',
                    showCancel: false
                });
            } finally {
                this.isBinding = false;
            }
        },
        
        // 提交注册（要求 phoneNumber 已有值）
        async submitRegister() {
            if (this.isRegistering) return;
            this.isRegistering = true;
            uni.showLoading({ title: '注册中...', mask: true });

            try {
                // 如果是 GitHub 登录，使用 GitHub 的 openid；否则进行匿名登录获取 openid
                let openid = null;
                if (this.fromGithub && this.githubData && this.githubData.openid) {
                    openid = this.githubData.openid;
                    console.log('✅ [注册] 使用 GitHub openid:', openid);
                } else {
                    await this.performAuth();
                }

                const registerData = {
                    poemId: this.poemId.trim(),
                    password: this.password.trim(),
                    nickName: this.nickName.trim(),
                    avatarFileID: this.avatarFileID || '',
                    phoneNumber: this.phoneNumber || ''
                };
                
                // 如果是 GitHub 登录，添加 openid 和 GitHub 相关信息
                if (this.fromGithub && this.githubData) {
                    registerData.openid = this.githubData.openid;
                    registerData.githubUsername = this.githubData.githubUsername;
                    registerData.githubAvatar = this.githubData.githubAvatar;
                    registerData.githubEmail = this.githubData.githubEmail;
                }

                const registerRes = await this.callCloudFunction('registerUser', registerData);

                console.log('🔍 [注册] 云函数返回结果:', registerRes);

                if (registerRes.result && registerRes.result.success) {
                    const userInfo = registerRes.result.userInfo;
                    const returnedOpenid = registerRes.result.openid;
                    await applyAuthenticatedUserSession(userInfo, {
                        openid: returnedOpenid
                    });
                    uni.showToast({ title: '注册成功', icon: 'success' });
                    setTimeout(() => { uni.switchTab({ url: '/pages/poem-square/poem-square' }); }, 1000);
                } else {
                    const message = registerRes.result?.message || '注册失败，请重试';
                    const code = registerRes.result?.code;
                    if (code === 'PHONE_ALREADY_EXISTS') {
                        uni.showModal({
                            title: '提示',
                            content: '该手机号已注册，请直接登录',
                            showCancel: true,
                            cancelText: '取消',
                            confirmText: '去登录',
                            success: (res) => { if (res.confirm) { this.goToLogin(); } }
                        });
                    } else if (code === 'POEM_ID_EXISTS') {
                        uni.showToast({ title: '该Poem ID已被使用', icon: 'none' });
                    } else {
                        uni.showToast({ title: message, icon: 'none', duration: 3000 });
                    }
                }
            } catch (error) {
                console.error('❌ [注册] 注册失败:', error);
                uni.showToast({ title: '注册失败，请重试', icon: 'none', duration: 3000 });
            } finally {
                uni.hideLoading();
                this.isRegistering = false;
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

        // 注册流程使用的：发送绑定短信验证码（场景：register）
        async sendBindSmsCodeForRegister() {
            if (this.isSendingSms || this.smsCountdown > 0) {
                return;
            }

            if (!this.smsPhoneNumber) {
                uni.showToast({
                    title: '请输入手机号',
                    icon: 'none'
                });
                return;
            }

            // 验证手机号格式
            const phoneRegex = /^1[3-9]\d{9}$/;
            if (!phoneRegex.test(this.smsPhoneNumber)) {
                uni.showToast({
                    title: '请输入正确的手机号',
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
                // 调用腾讯云函数发送短信验证码（场景：register）
                const result = await this.$tcb.callFunction({
                    name: 'sendSmsCode',
                    data: {
                        phone: this.smsPhoneNumber,
                        scene: 'binding'
                    }
                });

                console.log('📱 [短信注册] 发送结果:', result);

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
                console.error('📱 [注册-短信绑定] 发送失败:', error);
                uni.showToast({
                    title: '发送失败，请重试',
                    icon: 'none'
                });
            } finally {
                uni.hideLoading();
                this.isSendingSms = false;
            }
        },

        // 注册流程使用的：验证短信验证码并设置手机号，然后继续注册
        async handleBindPhoneForRegister() {
            if (this.isBindingPhone) return;

            if (!this.smsPhoneNumber) {
                uni.showToast({ title: '请输入手机号', icon: 'none' });
                return;
            }
            if (!this.smsCode || this.smsCode.length !== 6) {
                uni.showToast({ title: '请输入6位验证码', icon: 'none' });
                return;
            }

            this.isBindingPhone = true;
            uni.showLoading({ title: '验证中...', mask: true });

            try {
                const result = await this.$tcb.callFunction({
                    name: 'verifySmsCode',
                    data: {
                        phone: this.smsPhoneNumber,
                        code: this.smsCode,
                        scene: 'binding'
                    }
                });

                console.log('📱 [注册-短信绑定] 验证结果:', result);

                if (result.result && result.result.success === true) {
                    // 绑定成功
                    this.phoneNumber = this.smsPhoneNumber;
                    this.closeBindPhoneModal();
                    uni.showToast({ title: '绑定成功', icon: 'success' });
                    // 继续注册
                    this.submitRegister();
                } else {
                    const message = result.result?.message || '验证码错误';
                    uni.showToast({ title: message, icon: 'none' });
                }
            } catch (error) {
                console.error('📱 [注册-短信绑定] 验证失败:', error);
                uni.showToast({ title: '验证失败，请重试', icon: 'none' });
            } finally {
                uni.hideLoading();
                this.isBindingPhone = false;
            }
        },

        // 打开/关闭绑定手机号弹窗
        closeBindPhoneModal() {
            this.showBindPhoneModal = false;
            this.smsPhoneNumber = '';
            this.smsCode = '';
            if (this.smsTimer) { clearInterval(this.smsTimer); this.smsTimer = null; }
            this.smsCountdown = 0;
        },

        // 跳过手机号绑定并继续注册
        async skipBindPhoneAndRegister() {
            console.log('📱 [注册] 用户选择跳过手机号绑定');
            this.closeBindPhoneModal();
            // 不设置手机号，直接提交注册
            await this.submitRegister();
        },

        

        // App 端：拉起一键登录弹窗（带“其它方式”按钮），成功后设置手机号并继续注册
        async tryOneClickBindOnAppThenRegister() {
            // #ifndef APP-PLUS
            // 非 APP 端直接走短信
            this.showBindPhoneModal = true;
            return;
            // #endif

            if (this.isGettingPhone) return;
            this.isGettingPhone = true;

            try {
                // 预登录可优化冷启动（忽略失败）
                if (uni.preLogin) {
                    try { await new Promise((resolve) => uni.preLogin({ provider: 'univerify', success: resolve, fail: resolve })); } catch (e) {}
                }

                const loginRes = await new Promise((resolve, reject) => {
                    uni.login({
                        provider: 'univerify',
                        univerifyStyle: {
                            otherLoginButton: { visible: true, text: '选择其它方式' }
                        },
                        success: resolve,
                        fail: reject
                    });
                });

                if (!loginRes.authResult || !loginRes.authResult.access_token || !loginRes.authResult.openid) {
                    throw new Error('获取授权失败');
                }

                const { access_token, openid: univerifyOpenid } = loginRes.authResult;

                uni.showLoading({ title: '获取手机号...', mask: true });
                const phoneRes = await callUniCloudFunction('getPhoneNumberByToken', {
                    access_token: access_token,
                    openid: univerifyOpenid
                });

                if (!phoneRes || phoneRes.result?.code !== 0 || !phoneRes.result?.phoneNumber) {
                    throw new Error(phoneRes?.result?.message || '获取手机号失败');
                }

                this.phoneNumber = phoneRes.result.phoneNumber;
                uni.hideLoading();
                uni.showToast({ title: '手机号获取成功', icon: 'success' });

                // 一键绑定成功，提交注册
                await this.submitRegister();
            } catch (err) {
                console.warn('⚠️ [注册] 一键登录未完成，切换短信方式:', err);
                // 无论是用户选择其它方式还是失败，均展示短信弹窗
                try { if (uni.closeAuthView) uni.closeAuthView(); } catch (e) {}
                this.showBindPhoneModal = true;
            } finally {
                this.isGettingPhone = false;
                uni.hideLoading();
            }
        }
    }
};
</script>

<style>
/* 注册页面样式 */
.container {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 120rpx 60rpx 60rpx;
    height: 100vh;
    background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
}

.title {
    font-size: 56rpx;
    font-weight: bold;
    margin-bottom: 20rpx;
    color: #333;
    text-align: center;
}

.subtitle {
    font-size: 28rpx;
    color: #666;
    margin-bottom: 80rpx;
    text-align: center;
}

.form-wrapper {
    width: 100%;
    max-width: 600rpx;
}

/* 头像上传区域 */
.avatar-uploader {
    display: flex;
    align-items: center;
    gap: 20rpx;
    margin-bottom: 30rpx;
}
.avatar-preview {
    width: 120rpx;
    height: 120rpx;
    border-radius: 50%;
    overflow: hidden;
    position: relative;
    background: #f2f2f2;
    display: flex;
    align-items: center;
    justify-content: center;
}
.avatar-preview image { width: 100%; height: 100%; }
.avatar-tip { position: absolute; bottom: 6rpx; font-size: 20rpx; color: #666; background: rgba(255,255,255,.7); padding: 2rpx 6rpx; border-radius: 6rpx; }
.avatar-upload-btn { background-color: #1c9bd6; color: #fff; border-radius: 8rpx; height: 72rpx; line-height: 72rpx; padding: 0 30rpx; }

.input-wrapper {
    margin-bottom: 30rpx;
    background: white;
    border-radius: 16rpx;
    padding: 30rpx;
    box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.1);
}

.input-label {
    display: block;
    font-size: 28rpx;
    color: #333;
    margin-bottom: 20rpx;
    font-weight: 500;
}

.input-field {
    width: 100%;
    font-size: 32rpx;
    color: #333;
    border: none;
    outline: none;
    background: transparent;
}

.input-field::placeholder {
    color: #999;
}

.register-button {
    width: 100%;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    font-size: 32rpx;
    font-weight: 500;
    border-radius: 16rpx;
    padding: 30rpx;
    margin: 60rpx 0 40rpx;
    border: none;
    box-shadow: 0 8rpx 25rpx rgba(102, 126, 234, 0.3);
    transition: all 0.3s ease;
}

.register-button:active {
    transform: translateY(2rpx);
    box-shadow: 0 4rpx 15rpx rgba(102, 126, 234, 0.3);
}

.register-button:disabled {
    background: #ccc;
    box-shadow: none;
    transform: none;
}

.register-button.loading {
    background: #ccc;
    box-shadow: none;
}

.login-link-wrapper {
    display: flex;
    justify-content: center;
    align-items: center;
    margin-top: 40rpx;
}

.login-text {
    font-size: 28rpx;
    color: #666;
    margin-right: 10rpx;
}

.login-link {
    font-size: 28rpx;
    color: #667eea;
    font-weight: 500;
    text-decoration: underline;
}
/* 白色背景 + 顶部头像 + 底部悬浮按钮 */
.white-page { background: #fff; min-height: 100vh; position: relative; }
.container { display: flex; flex-direction: column; align-items: center; padding: 60rpx 40rpx 140rpx; background: #fff; }
.avatar-top { display: flex; flex-direction: column; align-items: center; margin: 20rpx 0 40rpx; }
.avatar-preview { width: 160rpx; height: 160rpx; border-radius: 50%; overflow: hidden; background: #f2f2f2; border: 6rpx solid #f1f1f1; box-shadow: 0 6rpx 16rpx rgba(0,0,0,.06); }
.avatar-preview image { width: 100%; height: 100%; display: block; }
.avatar-cta { margin-top: 12rpx; font-size: 24rpx; color: #999; }
.form-wrapper { width: 100%; max-width: 640rpx; }
.input-wrapper { margin-bottom: 24rpx; background: transparent; border-radius: 0; padding: 0; border: none; box-shadow: none; }
.input-label { display: block; font-size: 26rpx; color: #888; margin-bottom: 12rpx; }
.input-field { width: 100%; height: 88rpx; border: none; outline: none; background: #f5f6f7; border-radius: 9999rpx; padding: 0 26rpx; font-size: 30rpx; color: #333; }
/* 回车键形状按钮 */
.enter-key-btn {
  position: fixed;
  right: 40rpx;
  bottom: 40rpx;
  width: 220rpx;
  height: 180rpx;
  cursor: pointer;
  transition: all 0.2s ease;
}
.enter-key-btn:active { transform: scale(0.95); }
.enter-key-btn.disabled { opacity: .5; pointer-events: none; }
.enter-key-btn .ek-layer { position: absolute; inset: 0; }
/* L 形剪裁：右侧竖条 + 底部横条 */
.enter-key-btn .ek-border { background: #333; filter: drop-shadow(0 6rpx 12rpx rgba(0,0,0,.18)); clip-path: polygon(55% 0,100% 0,100% 100%,0 100%,0 60%,55% 60%,55% 0); border-radius: 24rpx; }
.enter-key-btn .ek-fill { background: #fff; clip-path: polygon(57% 2%,100% 2%,100% 100%,2% 100%,2% 62%,57% 62%,57% 2%); border-radius: 22rpx; }
.enter-key-btn .ek-text { position: absolute; bottom: 24rpx; left: 24rpx; font-size: 28rpx; color: #333; font-weight: 500; }
.login-link-wrapper.subtle { color: #999; }

/* 绑定手机号弹窗（复用个人资料修改样式） */
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
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32rpx;
}

.modal-title { font-size: 36rpx; font-weight: 600; color: #333; }
.modal-close { font-size: 48rpx; color: #999; line-height: 1; width: 48rpx; height: 48rpx; display: flex; align-items: center; justify-content: center; }
.modal-body { margin-bottom: 40rpx; }
.modal-text { font-size: 28rpx; color: #666; line-height: 1.6; margin-bottom: 32rpx; display: block; }

.modal-footer { display: flex; gap: 24rpx; }
.modal-btn { flex: 1; height: 88rpx; line-height: 88rpx; text-align: center; border-radius: 44rpx; font-size: 32rpx; font-weight: 500; }
.cancel-btn { background: #f5f6f7; color: #666; }
.confirm-btn { background: #333; color: #fff; }
.confirm-btn.disabled { opacity: 0.5; pointer-events: none; }

/* 一键注册按钮 */
.one-click-register-btn {
  width: 100%;
  height: 88rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 44rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 36rpx;
  box-shadow: 0 8rpx 25rpx rgba(102, 126, 234, 0.3);
}

.one-click-text {
  font-size: 32rpx;
  color: #fff;
  font-weight: 500;
}

/* 手机号输入框（只读） */
.input-wrapper input[disabled] {
  background: #f0f0f0;
  color: #999;
}

/* 短信验证码弹窗样式 */
.sms-dialog {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.dialog-mask {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
}

.dialog-content {
  position: relative;
  width: 85%;
  max-width: 600rpx;
  background: #fff;
  border-radius: 24rpx;
  padding: 40rpx;
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 40rpx;
}

.dialog-title {
  font-size: 36rpx;
  font-weight: 600;
  color: #333;
}

.dialog-close {
  font-size: 48rpx;
  color: #999;
  line-height: 1;
  width: 48rpx;
  height: 48rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.dialog-body {
  margin-bottom: 40rpx;
}

.code-wrapper {
  display: flex;
  gap: 16rpx;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24rpx;
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

/* 手机号输入框样式 */
.sms-bind-form .input-wrapper {
  margin-right: 0;
  margin-bottom: 24rpx;
}

/* 弹窗中的输入框样式 */
.edit-phone-modal .modal-content .input-field {
  width: 100%;
  height: 88rpx;
  border: 1rpx solid #e0e0e0;
  border-radius: 12rpx;
  padding: 0 24rpx;
  font-size: 30rpx;
  color: #333;
  background: #f8f8f8;
}

/* 无边框输入：仅作用于绑定手机号弹窗的输入框 */
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

.dialog-footer {
  display: flex;
  gap: 24rpx;
}

.dialog-btn {
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
  background: #667eea;
  color: #fff;
}

.confirm-btn.disabled {
  background: #ccc;
  pointer-events: none;
}

/* 短信注册按钮样式 */
.sms-register-btn {
  width: 100%;
  height: 88rpx;
  background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);
  border-radius: 44rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 36rpx;
  box-shadow: 0 8rpx 25rpx rgba(255, 107, 107, 0.3);
  transition: all 0.2s ease;
}

.sms-register-btn:active {
  transform: translateY(2rpx);
  box-shadow: 0 4rpx 15rpx rgba(255, 107, 107, 0.3);
}

.sms-text {
  font-size: 32rpx;
  color: #fff;
  font-weight: 500;
}
</style>
