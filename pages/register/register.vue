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
        <!-- 一键注册按钮 -->
        <view class="one-click-register-btn" @tap="handleOneClickRegister" v-if="!phoneNumber">
          <text class="one-click-text">本机号码一键注册</text>
        </view>

        <!-- 手机号显示（只读） -->
        <view class="input-wrapper" v-if="phoneNumber">
          <text class="input-label">手机号</text>
          <input class="input-field" type="text" :value="phoneNumber" disabled />
        </view>

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
          <text class="login-link" @tap="goToLogin">去登录</text>
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
  </view>
</template>

<script>
// pages/register/register.js
const app = getApp();
const { cloudCall } = require('../../utils/cloudCall.js');

// 调用 uniCloud 云函数（自动处理本地调试服务连接失败的情况）
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

export default {
    data() {
        return {
            poemId: '',
            password: '',
            confirmPassword: '',
            nickName: '',
            isRegistering: false,
            // 新增：头像直观状态
            localAvatarTempPath: '',
            avatarFileID: '',
            isUploadingAvatar: false,
            // 手机号相关
            phoneNumber: '',
            isGettingPhone: false
        };
    },
    
    computed: {
        canRegister() {
            return this.poemId.trim() && 
                   this.password.trim() && 
                   this.confirmPassword.trim() && 
                   this.nickName.trim() &&
                   this.password === this.confirmPassword;
        }
    },
    
    onLoad: function () {
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
                const { getCurrentPlatform } = require('../../utils/platformDetector.js');
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

            this.isRegistering = true;
            uni.showLoading({
                title: '注册中...',
                mask: true
            });

            try {
                // 先进行匿名登录获取openid
                await this.performAuth();

                // 调用注册云函数
                const registerRes = await this.callCloudFunction('registerUser', {
                    poemId: this.poemId.trim(),
                    password: this.password.trim(),
                    nickName: this.nickName.trim(),
                    // 头像使用云函数上传返回的 fileID（不能直连COS）
                    avatarFileID: this.avatarFileID || '',
                    // 传递手机号（如果已获取）
                    phoneNumber: this.phoneNumber || ''
                });

                console.log('🔍 [注册] 云函数返回结果:', registerRes);

                if (registerRes.result && registerRes.result.success) {
                    // 注册成功
                    const userInfo = registerRes.result.userInfo;
                    const openid = registerRes.result.openid;
                    
                    console.log('✅ [注册] 注册成功:', userInfo);
                    
                    // 更新全局数据
                    const app = getApp();
                    app.globalData.userInfo = userInfo;
                    app.globalData.openid = openid;
                    
                    // 保存到本地缓存
                    uni.setStorageSync('userInfo', userInfo);
                    uni.setStorageSync('userOpenId', openid);
                    
                    uni.showToast({
                        title: '注册成功',
                        icon: 'success'
                    });
                    
                    // 跳转到主页面
                    setTimeout(() => {
                        uni.switchTab({
                            url: '/pages/poem-square/poem-square'
                        });
                    }, 1000);
                    
                } else {
                    // 注册失败
                    const message = registerRes.result?.message || '注册失败，请重试';
                    const code = registerRes.result?.code;
                    
                    // 如果手机号已存在，提示用户去登录
                    if (code === 'PHONE_ALREADY_EXISTS') {
                        uni.showModal({
                            title: '提示',
                            content: '该手机号已注册，请直接登录',
                            showCancel: true,
                            cancelText: '取消',
                            confirmText: '去登录',
                            success: (res) => {
                                if (res.confirm) {
                                    this.goToLogin();
                                }
                            }
                        });
                    } else {
                        uni.showToast({
                            title: message,
                            icon: 'none',
                            duration: 3000
                        });
                    }
                }
                
            } catch (error) {
                console.error('❌ [注册] 注册失败:', error);
                uni.showToast({
                    title: '注册失败，请重试',
                    icon: 'none',
                    duration: 3000
                });
            } finally {
                uni.hideLoading();
                this.isRegistering = false;
            }
        },

        goToLogin() {
            // 跳转到登录页面
            uni.navigateBack();
        },

        // 处理一键注册
        async handleOneClickRegister() {
            if (this.isGettingPhone) {
                return;
            }

            this.isGettingPhone = true;
            uni.showLoading({
                title: '获取手机号中...',
                mask: true
            });

            try {
                // 1. 调用一键登录授权
                const loginRes = await new Promise((resolve, reject) => {
                    uni.login({
                        provider: 'univerify',
                        success: resolve,
                        fail: reject
                    });
                });

                if (!loginRes.authResult || !loginRes.authResult.access_token || !loginRes.authResult.openid) {
                    throw new Error('获取授权失败');
                }

                const { access_token, openid: univerifyOpenid } = loginRes.authResult;

                // 2. 调用 uniCloud 云函数获取手机号
                // 注意：此函数仅用于获取手机号，不需要用户在 uniCloud 服务空间下登录
                // 需要传递 univerify 返回的 access_token 和 openid
                const phoneRes = await callUniCloudFunction('getPhoneNumberByToken', {
                    access_token: access_token,
                    openid: univerifyOpenid // univerify 返回的 openid
                });

                if (phoneRes.result.code !== 0 || !phoneRes.result.phoneNumber) {
                    throw new Error(phoneRes.result.message || '获取手机号失败');
                }

                const phoneNumber = phoneRes.result.phoneNumber;

                // 3. 检查手机号是否已存在
                uni.showLoading({
                    title: '检查手机号...',
                    mask: true
                });

                // 通过调用注册云函数来检查（传入空参数，只检查手机号）
                // 或者我们可以直接调用 registerUser 但只传 phoneNumber，让后端检查
                // 但更好的方式是创建一个检查接口，不过用户说合并到 registerUser 中
                // 所以我们先尝试注册，如果手机号已存在会返回错误
                
                // 实际上，我们可以先调用 registerUser 检查，但这样不太优雅
                // 更好的方式是：先调用一个检查接口，但用户说合并到 registerUser 中
                // 所以我们直接设置手机号，在提交注册时再检查
                
                // 设置手机号
                this.phoneNumber = phoneNumber;
                
                uni.showToast({
                    title: '手机号获取成功',
                    icon: 'success'
                });

            } catch (error) {
                console.error('❌ [一键注册] 失败:', error);
                
                // 如果是用户取消，不显示错误提示
                if (error.errMsg && (error.errMsg.includes('cancel') || error.errMsg.includes('取消'))) {
                    // 用户取消，不做处理
                    return;
                }
                
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
                        title: error.message || error.errMsg || '获取手机号失败，请重试',
                        icon: 'none',
                        duration: 3000
                    });
                }
            } finally {
                uni.hideLoading();
                this.isGettingPhone = false;
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
.form-wrapper.compact { }
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
</style>
