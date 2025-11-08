<template>
  <view class="white-page">
    <view class="container">
      <text class="brand">poementer</text>
      <view class="center-wrap">
      <view class="form-wrapper compact">
        <view class="input-wrapper">
          <input class="input-field" type="text" placeholder="请输入 Poem ID" v-model="poemId" />
        </view>
        <view class="input-wrapper">
          <input class="input-field" type="password" placeholder="请输入密码" v-model="password" />
        </view>

        <!-- 注册入口 -->
        <view class="register-link" @tap="goToRegister">
          <text class="register-text">注册</text>
        </view>
    </view>
      </view>
    </view>

    <!-- 右下角"回车键"形状按钮：点击登录 -->
    <view class="enter-key-btn" @tap="onLogin" :class="{ disabled: !canLogin || isLogging }">
      <view class="ek-layer ek-border"></view>
      <view class="ek-layer ek-fill">
        <text class="ek-text">Enter ↵</text>
      </view>
    </view>

    <!-- 底部绑定手机号弹窗 -->
    <view class="bind-phone-modal" v-if="showBindPhoneModal" @tap.stop>
      <view class="modal-mask" @tap="closeBindPhoneModal"></view>
      <view class="modal-content">
        <view class="modal-header">
          <text class="modal-title">绑定手机号</text>
          <text class="modal-close" @tap="closeBindPhoneModal">×</text>
        </view>
        <view class="modal-body">
          <text class="modal-text" v-if="isAppPlatform">为了您的账户安全，请绑定手机号</text>
          <text class="modal-text" v-else>为了您的账户安全，请绑定手机号（暂仅支持APP端一键登录）</text>
        </view>
        <view class="modal-footer">
          <view class="modal-btn cancel-btn" @tap="closeBindPhoneModal">稍后再说</view>
          <!-- APP端显示一键登录按钮 -->
          <view v-if="isAppPlatform" class="modal-btn confirm-btn" @tap="handleBindPhone" :class="{ disabled: isBindingPhone }">一键登录绑定</view>
          <!-- 非APP端预留短信验证码登录入口（暂时注释） -->
          <!-- <view v-else class="modal-btn confirm-btn" @tap="handleSmsLogin">短信验证码登录</view> -->
        </view>
      </view>
    </view>
  </view>
</template>

<script>
// pages/login/login.js
const app = getApp();
const { cloudCall } = require('../../utils/cloudCall.js');
import { resetAllCachesOnAccountChange } from '@/utils/accountCacheReset.js';

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
            isLogging: false,
            showBindPhoneModal: false,
            isBindingPhone: false
        };
    },
    
    computed: {
        canLogin() {
            return this.poemId.trim() && this.password.trim();
        },
        isAppPlatform() {
            // #ifdef APP-PLUS
            return true;
            // #endif
            // #ifndef APP-PLUS
            return false;
            // #endif
        }
    },
    onLoad: function () {
        console.log('🔍 [登录页面] 页面加载');
        
        // 检查是否需要重新初始化openid
        this.checkAndInitializeOpenid();

        // 如果本地已有登录信息，自动设置全局并跳转，避免重复登录
        this.tryAutoRedirect();
    },
    methods: {
        // 已有本地登录信息则自动跳转
        tryAutoRedirect: function () {
            try {
                const cachedUserInfo = uni.getStorageSync('userInfo');
                const cachedOpenId = uni.getStorageSync('userOpenId');
                if (cachedUserInfo && (cachedUserInfo._openid || cachedOpenId)) {
                    const app = getApp();
                    app.globalData = app.globalData || {};
                    app.globalData.userInfo = cachedUserInfo;
                    app.globalData.openid = cachedUserInfo._openid || cachedOpenId;
                    app.globalData._loginProcessCompleted = true;
                    console.log('✅ [登录页面] 检测到已登录用户，自动跳转');
                    uni.switchTab({ url: '/pages/poem-square/poem-square' });
                }
            } catch (e) {
                console.log('⚠️ [登录页面] 自动跳转检查失败(忽略)：', e);
            }
        },
        // 检查并初始化openid
        checkAndInitializeOpenid: function () {
            console.log('🔍 [登录页面] 检查openid状态');
            
            const app = getApp();
            const hasOpenid = app && app.globalData && app.globalData.openid;
            
            if (!hasOpenid) {
                console.log('⚠️ [登录页面] 未检测到openid，尝试重新初始化');
                this.initializeAnonymousOpenid();
            } else {
                console.log('✅ [登录页面] openid已存在:', app.globalData.openid);
            }
        },

        // 初始化匿名openid
        initializeAnonymousOpenid: function () {
            console.log('🔄 [登录页面] 初始化匿名openid');
            
            // 使用TCB调用login云函数获取匿名openid
            if (this.$tcb && this.$tcb.callFunction) {
                this.$tcb.callFunction({
                    name: 'login'
                }).then((loginRes) => {
                    console.log('✅ [登录页面] 匿名openid初始化成功:', loginRes);
                    
                    // 获取openid
                    let openid = null;
                    if (loginRes.result && loginRes.result.openid) {
                        openid = loginRes.result.openid;
                    } else if (loginRes.openid) {
                        openid = loginRes.openid;
                    } else if (loginRes.result && loginRes.result.uid) {
                        openid = loginRes.result.uid;
                    }
                    
                    if (openid) {
                        // 更新全局数据
                        const app = getApp();
                        if (app && app.globalData) {
                            app.globalData.openid = openid;
                            console.log('✅ [登录页面] 匿名openid已设置:', openid);
                        }
                        
                        // 缓存openid
                        uni.setStorageSync('userOpenId', openid);
                    } else {
                        console.error('❌ [登录页面] 无法获取匿名openid');
                    }
                }).catch((error) => {
                    console.error('❌ [登录页面] 匿名openid初始化失败:', error);
                });
            } else {
                console.error('❌ [登录页面] TCB实例不可用，无法初始化openid');
            }
        },

        // 统一云函数调用方法
        callCloudFunction(name, data = {}, extraOptions = {}) {
            return cloudCall(name, data, Object.assign({ pageTag: 'login', context: this }, extraOptions));
        },

        async onLogin() {
            if (!this.canLogin || this.isLogging) {
                return;
            }

            this.isLogging = true;
            uni.showLoading({
                title: '登录中...',
                mask: true
            });

            try {
                // 调用登录验证云函数
                const loginRes = await this.callCloudFunction('loginWithCredentials', {
                    poemId: this.poemId.trim(),
                    password: this.password.trim()
                });

                console.log('🔍 [登录] 云函数返回结果:', loginRes);

                if (loginRes.result && loginRes.result.success) {
                    // 登录成功
                    const userInfo = loginRes.result.userInfo;
                    const openid = loginRes.result.openid;
                    const isPhoneVerified = loginRes.result.isPhoneVerified;
                    
                    console.log('✅ [登录] 登录成功:', userInfo);
                    console.log('🔍 [登录] 手机号验证状态:', isPhoneVerified);
                    
                    // 更新全局数据
                    const app = getApp();
                    // 将 openid 合并进 userInfo，便于 App.vue 缓存分支命中
                    const userInfoWithOpenId = Object.assign({}, userInfo || {}, { _openid: openid });
                    app.globalData.userInfo = userInfoWithOpenId;
                    app.globalData.openid = openid;
                    app.globalData._loginProcessCompleted = true;
                    
                    // 保存到本地缓存
                    uni.setStorageSync('userInfo', userInfoWithOpenId);
                    uni.setStorageSync('userOpenId', openid);
                    
                    // 账号切换/新登录后，清理所有与旧账号相关的缓存，并预热当前账号数据
                    try { await resetAllCachesOnAccountChange({ newOpenId: openid }); } catch (e) { console.warn('cache reset failed', e); }
                    
                    uni.showToast({
                        title: '登录成功',
                        icon: 'success'
                    });
                    
                    // 检查是否需要绑定手机号
                    if (isPhoneVerified === false) {
                        // 显示底部弹窗提示绑定手机号
                        this.showBindPhoneModal = true;
                    } else {
                        // 已绑定手机号，直接跳转
                        setTimeout(() => {
                            uni.switchTab({
                                url: '/pages/poem-square/poem-square'
                            });
                        }, 1000);
                    }
                    
                } else {
                    // 登录失败
                    const message = loginRes.result?.message || '登录失败，请检查账号密码';
                    uni.showToast({
                        title: message,
                        icon: 'none',
                        duration: 3000
                    });
                }
                
            } catch (error) {
                console.error('❌ [登录] 登录失败:', error);
                uni.showToast({
                    title: '登录失败，请重试',
                    icon: 'none',
                    duration: 3000
                });
            } finally {
                uni.hideLoading();
                this.isLogging = false;
            }
        },

        goToRegister() {
            // 跳转到注册页面（原有的注册页面）
            uni.navigateTo({
                url: '/pages/register/register'
            });
        },

        // 关闭绑定手机号弹窗
        closeBindPhoneModal() {
            this.showBindPhoneModal = false;
            // 关闭弹窗后跳转到主页面
            setTimeout(() => {
                uni.switchTab({
                    url: '/pages/poem-square/poem-square'
                });
            }, 300);
        },

        // 处理一键登录绑定手机号（仅APP端）
        async handleBindPhone() {

            // 预留：短信验证码登录方法（非APP端）
            // async handleSmsLogin() {
            //     console.log('🔍 [短信登录] 开始短信验证码登录流程');
            //     // TODO: 实现短信验证码登录逻辑
            //     // 1. 跳转到短信验证码输入页面
            //     // 2. 发送验证码
            //     // 3. 验证码校验
            //     // 4. 绑定手机号
            // },
            if (this.isBindingPhone) {
                return;
            }

            this.isBindingPhone = true;
            uni.showLoading({
                title: '绑定中...',
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

                // 获取当前用户在腾讯云开发中的 openid
                const app = getApp();
                const userOpenid = app.globalData?.openid;
                if (!userOpenid) {
                    throw new Error('未获取到用户标识，请先登录');
                }

                // 2. 调用 uniCloud 云函数获取手机号并同步到腾讯云
                // 注意：uniCloud 云函数会自动将手机号同步到腾讯云开发数据库
                // 需要传递：
                //   - access_token: univerify 返回的 access_token
                //   - openid: univerify 返回的 openid
                //   - userOpenid: 腾讯云开发中的用户 openid
                const phoneRes = await callUniCloudFunction('getPhoneNumberByToken', {
                    access_token: access_token,
                    openid: univerifyOpenid, // univerify 返回的 openid
                    userOpenid: userOpenid   // 腾讯云开发中的用户 openid
                });

                if (phoneRes.result.code !== 0) {
                    throw new Error(phoneRes.result.message || '绑定手机号失败');
                }

                // 3. 获取手机号并更新本地用户信息
                const phoneNumber = phoneRes.result.phoneNumber;
                if (phoneNumber) {
                    // 更新本地用户信息
                    if (app.globalData.userInfo) {
                        app.globalData.userInfo.phoneNumber = phoneNumber;
                        app.globalData.userInfo.isPhoneVerified = true;
                        uni.setStorageSync('userInfo', app.globalData.userInfo);
                    }

                    uni.showToast({
                        title: '绑定成功',
                        icon: 'success'
                    });

                    // 关闭弹窗并跳转
                    this.closeBindPhoneModal();
                } else {
                    throw new Error('未获取到手机号');
                }

            } catch (error) {
                console.error('❌ [绑定手机号] 失败:', error);
                
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
                        title: error.message || error.errMsg || '绑定失败，请重试',
                        icon: 'none',
                        duration: 3000
                    });
                }
            } finally {
                uni.hideLoading();
                this.isBindingPhone = false;
            }
        }
    }
};
</script>
<style>
.white-page { background: #fff; min-height: 100vh; position: relative; }
.container { position: relative; min-height: 100vh; padding: 0 0 140rpx; }
.center-wrap { position: absolute; top: 30%; left: 0; right: 0; transform: translateY(-50%); display: flex; flex-direction: column; align-items: center; padding: 0 40rpx; }
.brand { display: block; width: 100%; margin: 20vh 0 48rpx; font-size: 44rpx; font-weight: 600; color: #333; text-align: center; }
.form-wrapper { width: 100%; max-width: 560rpx; display: flex; flex-direction: column; align-items: center; }
.input-wrapper { width: 100%; margin-bottom: 36rpx; background: transparent; padding: 0; border: none; box-shadow: none; }
.input-field { width: 100%; height: 88rpx; border: none; outline: none; background: #f5f6f7; border-radius: 9999rpx; padding: 0 26rpx; font-size: 30rpx; color: #333; }

/* 注册入口 */
.register-link {
  margin-top: 20rpx;
  text-align: right;
  width: 100%;
}
.register-text {
  font-size: 28rpx;
  color: #999;
  text-decoration: underline;
  cursor: pointer;
  transition: color 0.2s ease;
}
.register-text:active {
  color: #666;
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
}
.enter-key-btn:active { transform: scale(0.95); }
.enter-key-btn.disabled { opacity: .5; pointer-events: none; }
.enter-key-btn .ek-layer { position: absolute; inset: 0; }
/* L 形剪裁：右侧竖条 + 底部横条 */
.enter-key-btn .ek-border { background: #333; filter: drop-shadow(0 6rpx 12rpx rgba(0,0,0,.18)); clip-path: polygon(55% 0,100% 0,100% 100%,0 100%,0 60%,55% 60%,55% 0); border-radius: 24rpx; }
.enter-key-btn .ek-fill { background: #fff; clip-path: polygon(57% 2%,100% 2%,100% 100%,2% 100%,2% 62%,57% 62%,57% 2%); border-radius: 22rpx; }
.enter-key-btn .ek-text { position: absolute; bottom: 24rpx; left: 24rpx; font-size: 28rpx; color: #333; font-weight: 500; }

/* 绑定手机号弹窗 */
.bind-phone-modal {
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
</style>
