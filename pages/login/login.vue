<template>
  <view class="white-page">
    <view class="container">
      <text class="brand">poementer</text>
      
      <!-- 小程序环境：显示微信授权登录 -->
      <!-- #ifdef MP-WEIXIN -->
      <view class="center-wrap wechat-wrap" v-if="enableWechatLogin && !showPasswordLogin">
        <view class="wechat-login-section">
          <button 
            class="wechat-login-btn" 
            @tap="loginWithWechat"
            :disabled="isLogging"
          >
            <text class="wechat-login-text">微信授权登录</text>
          </button>
          
          <!-- 切换到账号密码登录 -->
          <view class="switch-login-method" @tap="showPasswordLogin = true">
            <text class="switch-text">使用 Poem ID 登录</text>
          </view>
          
          <!-- 取消登录按钮 -->
          <view class="logout-link" @tap="handleLogout">
            <text class="logout-text">取消登录</text>
          </view>
        </view>
      </view>
      
      <view class="center-wrap" v-if="showPasswordLogin">
      <!-- #endif -->
      
      <!-- H5/App 环境 -->
      <!-- #ifndef MP-WEIXIN -->
      <view class="center-wrap">
      <!-- #endif -->
        
        <!-- H5/App 环境 或 小程序切换到密码登录 -->
        <view class="password-login-section">
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

            <!-- GitHub 登录（图标样式）- 暂时隐藏 -->
            <!-- <view class="github-login-wrapper">
              <image
                class="github-login-icon"
                src="/static/images/github-logo.png"
                mode="aspectFit"
                :aria-label="'使用 GitHub 登录'"
                @tap="loginWithGitHub"
              />
            </view> -->
          </view>
          
          <!-- #ifdef MP-WEIXIN -->
          <view class="switch-login-method" v-if="enableWechatLogin" @tap="showPasswordLogin = false">
            <text class="switch-text">返回微信登录</text>
          </view>
          <!-- #endif -->
        </view>
      </view>
    </view>

    <!-- 右下角"回车键"形状按钮：点击登录 -->
    <!-- #ifdef MP-WEIXIN -->
    <view class="enter-key-btn" v-if="showPasswordLogin" @tap="onLogin" :class="{ disabled: !canLogin || isLogging }">
      <view class="ek-layer ek-border"></view>
      <view class="ek-layer ek-fill">
        <text class="ek-text">Enter ↵</text>
      </view>
    </view>
    <!-- #endif -->
    <!-- #ifndef MP-WEIXIN -->
    <view class="enter-key-btn" @tap="onLogin" :class="{ disabled: !canLogin || isLogging }">
      <view class="ek-layer ek-border"></view>
      <view class="ek-layer ek-fill">
        <text class="ek-text">Enter ↵</text>
      </view>
    </view>
    <!-- #endif -->

    <!-- 绑定微信弹窗（小程序专属） -->
    <!-- #ifdef MP-WEIXIN -->
    <view class="bind-phone-modal" v-if="showBindWechatModal" @tap.stop>
      <view class="modal-mask" @tap="closeBindWechatModal"></view>
      <view class="modal-content">
        <view class="modal-header">
          <text class="modal-title">绑定微信账号</text>
          <text class="modal-close" @tap="closeBindWechatModal">×</text>
        </view>
        <view class="modal-body">
          <text class="modal-text">检测到您使用 Poem ID 登录，是否将此账号绑定到当前微信？</text>
          <text class="modal-text" style="margin-top: 20rpx; color: #999; font-size: 26rpx;">绑定后，下次可直接使用微信登录此账号，数据更安全且可跨端共享。</text>
        </view>
        <view class="modal-footer">
          <view class="modal-btn cancel-btn" @tap="skipBindWechat">跳过</view>
          <view class="modal-btn confirm-btn" @tap="handleBindWechat" :class="{ disabled: isBindingWechat }">
            {{ isBindingWechat ? '绑定中...' : '确认绑定' }}
          </view>
        </view>
      </view>
    </view>

    <!-- 解绑确认弹窗（小程序专属） -->
    <view class="bind-phone-modal" v-if="showRebindConfirmModal" @tap.stop>
      <view class="modal-mask" @tap="cancelRebind"></view>
      <view class="modal-content">
        <view class="modal-header">
          <text class="modal-title">微信已绑定其他账号</text>
          <text class="modal-close" @tap="cancelRebind">×</text>
        </view>
        <view class="modal-body">
          <text class="modal-text">当前微信已绑定到账号：</text>
          <view class="bound-account-info">
            <text class="bound-account-text">Poem ID: {{ boundAccountPoemId }}</text>
            <text class="bound-account-text">昵称: {{ boundAccountNickName }}</text>
          </view>
          <text class="modal-text" style="margin-top: 20rpx; color: #ff6b6b; font-size: 26rpx;">是否解绑该账号，并绑定到当前登录的账号？</text>
          <text class="modal-text" style="margin-top: 10rpx; color: #999; font-size: 24rpx;">注意：解绑后，原账号将无法使用微信登录。</text>
        </view>
        <view class="modal-footer">
          <view class="modal-btn cancel-btn" @tap="cancelRebind">取消</view>
          <view class="modal-btn confirm-btn warning-btn" @tap="confirmRebind" :class="{ disabled: isBindingWechat }">
            {{ isBindingWechat ? '处理中...' : '确认解绑并重新绑定' }}
          </view>
        </view>
      </view>
    </view>

    <!-- _openid 冲突确认弹窗（小程序专属） -->
    <view class="bind-phone-modal" v-if="showOpenidConflictModal" @tap.stop>
      <view class="modal-mask" @tap="cancelOpenidConflict"></view>
      <view class="modal-content">
        <view class="modal-header">
          <text class="modal-title">⚠️ 重要提示</text>
          <text class="modal-close" @tap="cancelOpenidConflict">×</text>
        </view>
        <view class="modal-body">
          <text class="modal-text">当前微信已被用于注册账号：</text>
          <view class="bound-account-info">
            <text class="bound-account-text">Poem ID: {{ conflictAccountPoemId }}</text>
            <text class="bound-account-text">昵称: {{ conflictAccountNickName }}</text>
          </view>
          
          <!-- 如果冲突账号没有设置 Poem ID，显示数据丢失警告 -->
          <view v-if="!conflictAccountCanLogin">
            <text class="modal-text" style="margin-top: 20rpx; color: #ff4444; font-size: 28rpx; font-weight: bold;">⚠️ 该账号未设置 Poem ID 和密码！</text>
            <text class="modal-text" style="margin-top: 10rpx; color: #ff6b6b; font-size: 26rpx;">如果继续绑定，该账号的数据将永久丢失，无法找回！</text>
            <text class="modal-text" style="margin-top: 15rpx; color: #333; font-size: 26rpx; font-weight: bold;">建议操作：</text>
            <text class="modal-text" style="margin-top: 5rpx; color: #666; font-size: 24rpx;">1. 点击"取消"</text>
            <text class="modal-text" style="margin-top: 5rpx; color: #666; font-size: 24rpx;">2. 使用微信登录原账号</text>
            <text class="modal-text" style="margin-top: 5rpx; color: #666; font-size: 24rpx;">3. 在个人资料中设置 Poem ID 和密码</text>
            <text class="modal-text" style="margin-top: 5rpx; color: #666; font-size: 24rpx;">4. 再回来绑定当前账号</text>
          </view>
          
          <!-- 如果冲突账号已设置 Poem ID，显示普通警告 -->
          <view v-else>
            <text class="modal-text" style="margin-top: 20rpx; color: #ff6b6b; font-size: 28rpx; font-weight: bold;">如果继续绑定，该账号将无法通过微信登录！</text>
            <text class="modal-text" style="margin-top: 10rpx; color: #666; font-size: 24rpx;">该账号可以继续通过 Poem ID + 密码登录。</text>
            <text class="modal-text" style="margin-top: 10rpx; color: #666; font-size: 24rpx;">建议：如果您想使用该账号，请点击"取消"，然后使用微信登录。</text>
          </view>
        </view>
        <view class="modal-footer">
          <view class="modal-btn cancel-btn" @tap="cancelOpenidConflict">取消</view>
          <view class="modal-btn confirm-btn" 
                :class="{ 
                  'warning-btn': true, 
                  'danger-btn': !conflictAccountCanLogin,
                  'disabled': isBindingWechat 
                }" 
                @tap="confirmOpenidConflict">
            <text v-if="isBindingWechat">处理中...</text>
            <text v-else-if="!conflictAccountCanLogin">我知道风险，继续绑定</text>
            <text v-else>我知道了，继续绑定</text>
          </view>
        </view>
      </view>
    </view>
    <!-- #endif -->

    <!-- 底部绑定手机号弹窗 -->
    <!-- #ifndef MP-WEIXIN -->
    <view class="bind-phone-modal" v-if="showBindPhoneModal" @tap.stop>
      <view class="modal-mask" @tap="closeBindPhoneModal"></view>
      <view class="modal-content">
        <view class="modal-header">
          <text class="modal-title">绑定手机号</text>
          <text class="modal-close" @tap="closeBindPhoneModal">×</text>
        </view>
        <view class="modal-body">
          <text class="modal-text">为了您的账户安全，请绑定手机号</text>

          <!-- APP端一键绑定 -->
          <view v-if="bindPhoneMethod === 'oneclick'" class="bind-method-desc">
            <text>本机号码一键绑定</text>
          </view>

          <!-- H5/小程序短信验证绑定 -->
          <view v-if="bindPhoneMethod === 'sms'" class="sms-bind-form">
            <view class="input-wrapper">
              <input class="input-field" type="number" placeholder="请输入手机号" v-model="smsPhoneNumber" maxlength="11" />
            </view>
            <view class="code-wrapper">
              <view class="input-wrapper code-input-wrapper">
                <input class="input-field" type="number" placeholder="请输入验证码" v-model="smsCode" maxlength="6" />
              </view>
              <view class="code-send-btn" @tap="sendBindSmsCode" :class="{ disabled: isSendingSms || smsCountdown > 0 || !smsPhoneNumber }">
                <text class="code-send-text">{{ smsCountdown > 0 ? `${smsCountdown}秒后重发` : (isSendingSms ? '发送中...' : '获取验证码') }}</text>
              </view>
            </view>
          </view>
        </view>
        <view class="modal-footer">
          <view class="modal-btn cancel-btn" @tap="closeBindPhoneModal">稍后再说</view>
          <view class="modal-btn confirm-btn" @tap="handleBindPhone" :class="{ disabled: isBindingPhone || (bindPhoneMethod === 'sms' && (!smsCode || !smsPhoneNumber)) }">
            {{ bindPhoneMethod === 'oneclick' ? '一键绑定' : '确认绑定' }}
          </view>
        </view>
      </view>
    </view>
    <!-- #endif -->
  </view>
</template>

<script>
// pages/login/login.js
import { cloudCall } from '@/utils/cloudCall.js';
import { resetAllCachesOnAccountChange } from '@/utils/accountCacheReset.js';
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
            isLogging: false,
            showPasswordLogin: true, // 小程序环境下控制是否显示密码登录
            enableWechatLogin: true,
            showBindPhoneModal: false,
            isBindingPhone: false,
            bindPhoneMethod: 'oneclick', // 'oneclick' 或 'sms'
            // 登录后绑定相关
            smsPhoneNumber: '',
            smsCode: '',
            isSendingSms: false,
            smsCountdown: 0,
            smsTimer: null,
            // 绑定微信相关
            showBindWechatModal: false,
            isBindingWechat: false,
            pendingLoginResult: null, // 暂存登录结果，等待用户确认绑定
            // 解绑确认相关
            showRebindConfirmModal: false,
            boundAccountInfo: null, // 已绑定的账号信息
            // _openid 冲突确认相关
            showOpenidConflictModal: false,
            conflictAccountInfo: null // 冲突的账号信息
        };
    },
    
    computed: {
        canLogin() {
            // #ifdef MP-WEIXIN
            if (this.enableWechatLogin && !this.showPasswordLogin) {
                return true; // 微信登录始终可用
            }
            // #endif
            return this.poemId.trim() && this.password.trim();
        },
        boundAccountPoemId() {
            return this.boundAccountInfo && this.boundAccountInfo.poemId ? this.boundAccountInfo.poemId : '';
        },
        boundAccountNickName() {
            return this.boundAccountInfo && this.boundAccountInfo.nickName ? this.boundAccountInfo.nickName : '';
        },
        conflictAccountPoemId() {
            return this.conflictAccountInfo && this.conflictAccountInfo.poemId ? this.conflictAccountInfo.poemId : '未设置';
        },
        conflictAccountNickName() {
            return this.conflictAccountInfo && this.conflictAccountInfo.nickName ? this.conflictAccountInfo.nickName : '';
        },
        conflictAccountCanLogin() {
            return !!(this.conflictAccountInfo && this.conflictAccountInfo.canLogin);
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
    onLoad: function () {
        console.log('🔍 [登录页面] 页面加载');

        // 检查是否需要重新初始化openid
        this.checkAndInitializeOpenid();

        // 如果本地已有登录信息，自动设置全局并跳转，避免重复登录
        this.tryAutoRedirect();

        // 处理 GitHub 回调（新的云函数直接处理模式）
        this.handleGitHubRedirectCallback();
    },
    methods: {
        // 微信授权登录
        async loginWithWechat() {
            // #ifdef MP-WEIXIN
            if (this.isLogging) return;
            
            this.isLogging = true;
            uni.showLoading({
                title: '登录中...',
                mask: true
            });
            
            try {
                console.log('🔍 [微信登录] 开始微信登录流程');
                
                // 1. 调用 wx.login 获取 code
                const loginRes = await new Promise((resolve, reject) => {
                    wx.login({
                        success: resolve,
                        fail: reject
                    });
                });
                
                console.log('🔍 [微信登录] wx.login 成功:', loginRes);
                
                if (!loginRes.code) {
                    throw new Error('获取微信登录凭证失败');
                }
                
                // 2. 调用云函数验证用户
                const result = await this.callCloudFunction('loginWithWechat', {
                    code: loginRes.code
                });
                
                console.log('🔍 [微信登录] 云函数返回结果:', result);
                
                if (result.result && result.result.success) {
                    // 登录成功（包括自动注册的新用户）
                    console.log('✅ [微信登录] 登录成功');
                    
                    // 如果是新用户，显示欢迎提示
                    if (result.result.isNewUser) {
                        const poemId = result.result.defaultPoemId || result.result.userInfo?.poemId;
                        uni.showToast({
                            title: `欢迎！您的 Poem ID: ${poemId}`,
                            icon: 'none',
                            duration: 3000
                        });
                    }
                    
                    await this.handleLoginResult(result);
                } else {
                    throw new Error(result.result?.message || '登录失败');
                }
            } catch (error) {
                console.error('❌ [微信登录] 失败:', error);
                
                // 如果是用户拒绝授权，提示使用账号密码登录
                if (error.errMsg && error.errMsg.includes('auth deny')) {
                    uni.showModal({
                        title: '授权失败',
                        content: '您拒绝了微信授权，可以使用 Poem ID 登录',
                        showCancel: true,
                        cancelText: '取消',
                        confirmText: '使用 Poem ID',
                        success: (res) => {
                            if (res.confirm) {
                                this.showPasswordLogin = true;
                            }
                        }
                    });
                } else {
                    uni.showToast({
                        title: error.message || '登录失败，请重试',
                        icon: 'none',
                        duration: 3000
                    });
                }
            } finally {
                uni.hideLoading();
                this.isLogging = false;
            }
            // #endif
        },
        
        // GitHub 登录
        async loginWithGitHub() {
            try {
                uni.showLoading({
                    title: '正在跳转...',
                    mask: true
                });

                // 判断当前平台
                let platform = 'app';  // 默认为 app
                // #ifdef H5
                platform = 'h5';
                // #endif
                // #ifdef APP-PLUS
                platform = 'app';
                // #endif

                // 获取 GitHub 授权 URL
                console.log(`🔍 [GitHub登录] 当前平台: ${platform}，调用云函数获取授权URL...`);
                const result = await this.callCloudFunction('github-auth', {
                    action: 'getAuthUrl',
                    platform: platform  // 传递平台参数
                }, {
                    injectOpenId: false  // GitHub登录不需要openid
                });

                console.log('🔍 [GitHub登录] 云函数返回结果:', result);

                if (result.result && result.result.success) {
                    // 跳转到 GitHub 授权页面
                    console.log('✅ [GitHub登录] 获取授权URL成功:', result.result.authUrl);
                    
                    // #ifdef H5
                    // H5 环境使用 window.location
                    window.location.href = result.result.authUrl;
                    // #endif
                    
                    // #ifdef APP-PLUS
                    // App 环境：使用 WebView 内嵌浏览器（可以监听回调）
                    // 或者使用外部浏览器 + URL Scheme（当前方案）
                    plus.runtime.openURL(result.result.authUrl);
                    // #endif
                    
                    // #ifdef MP-WEIXIN
                    // 小程序环境不支持 GitHub OAuth，提示用户
                    uni.showToast({
                        title: '小程序暂不支持 GitHub 登录',
                        icon: 'none',
                        duration: 3000
                    });
                    // #endif
                } else {
                    console.error('❌ [GitHub登录] 获取授权URL失败:', result);
                    const message = result.result ? result.result.message : '获取授权链接失败';
                    throw new Error(message);
                }
            } catch (error) {
                console.error('GitHub 登录失败:', error);
                uni.showToast({
                    title: error.message || '登录失败，请重试',
                    icon: 'none',
                    duration: 3000
                });
            } finally {
                uni.hideLoading();
            }
        },

        // 处理 GitHub 回调（云函数直接处理并重定向回来的模式）
        async handleGitHubRedirectCallback() {
            // #ifdef H5
            // 小程序不支持 GitHub 登录，只在 H5 环境处理
            if (typeof window === 'undefined' || !window.location) {
                return;
            }
            
            const urlParams = new URLSearchParams(window.location.search);
            const githubLogin = urlParams.get('githubLogin');

            if (githubLogin === 'success') {
                try {
                    const loginDataStr = urlParams.get('loginData');
                    if (!loginDataStr) {
                        throw new Error('登录数据缺失');
                    }

                    const result = JSON.parse(decodeURIComponent(loginDataStr));

                    if (result.user) {
                        // 更新全局数据
                        await applyAuthenticatedUserSession(result.user, {
                            openid: result.user && (result.user._openid || result.user.openid)
                        });

                        // 缓存用户信息

                        if (result.needPhoneBinding) {
                            // 需要绑定手机号
                            this.showBindPhoneModal = true;
                            this.bindPhoneMethod = this.isApp ? 'oneclick' : 'sms';
                        } else {
                            // 直接跳转到主页
                            uni.showToast({
                                title: '登录成功',
                                icon: 'success',
                                duration: 2000
                            });

                            setTimeout(() => {
                                uni.switchTab({
                                    url: '/pages/poem-square/poem-square'
                                });
                            }, 1500);
                        }
                    } else {
                        throw new Error('用户信息缺失');
                    }
                } catch (error) {
                    console.error('GitHub 重定向回调处理失败:', error);
                    uni.showToast({
                        title: 'GitHub 登录失败：' + error.message,
                        icon: 'none',
                        duration: 3000
                    });
                }
            } else if (githubLogin === 'error') {
                try {
                    const errorDataStr = urlParams.get('errorData');
                    if (errorDataStr) {
                        const errorData = JSON.parse(decodeURIComponent(errorDataStr));
                        uni.showToast({
                            title: 'GitHub 登录失败：' + errorData.message,
                            icon: 'none',
                            duration: 3000
                        });
                    } else {
                        uni.showToast({
                            title: 'GitHub 登录失败，请重试',
                            icon: 'none',
                            duration: 3000
                        });
                    }
                } catch (error) {
                    uni.showToast({
                        title: 'GitHub 登录失败，请重试',
                        icon: 'none',
                        duration: 3000
                    });
                }
            }
            // #endif
        },

        // 处理 GitHub 回调（旧的手动处理模式 - 保留备用）
        async handleGitHubCallback() {
            // #ifdef H5
            // 小程序不支持 GitHub 登录，只在 H5 环境处理
            if (typeof window === 'undefined' || !window.location) {
                return;
            }
            
            // 从 URL 获取 code 和 state
            const urlParams = new URLSearchParams(window.location.search);
            const code = urlParams.get('code');
            const state = urlParams.get('state');

            if (code) {
                try {
                    uni.showLoading({
                        title: '登录中...',
                        mask: true
                    });

                    // 处理 GitHub 回调
                    const result = await this.callCloudFunction('github-auth', {
                        action: 'handleCallback',
                        code: code,
                        state: state
                    }, {
                        injectOpenId: false  // GitHub回调不需要openid
                    });

                    if (result.success) {
                        // 更新全局数据
                        await applyAuthenticatedUserSession(result.user, {
                            openid: result.user && (result.user._openid || result.user.openid)
                        });

                        // 缓存用户信息

                        if (result.needPhoneBinding) {
                            // 需要绑定手机号
                            this.showBindPhoneModal = true;
                            this.bindPhoneMethod = this.isApp ? 'oneclick' : 'sms';
                        } else {
                            // 直接跳转到主页
                            uni.showToast({
                                title: '登录成功',
                                icon: 'success',
                                duration: 2000
                            });

                            setTimeout(() => {
                                uni.switchTab({
                                    url: '/pages/poem-square/poem-square'
                                });
                            }, 1500);
                        }
                    } else {
                        throw new Error(result.message || 'GitHub 登录失败');
                    }
                } catch (error) {
                    console.error('GitHub 登录失败:', error);
                    uni.showToast({
                        title: error.message || '登录失败，请重试',
                        icon: 'none',
                        duration: 3000
                    });
                } finally {
                    uni.hideLoading();
                }
            }
            // #endif
        },

        // 已有本地登录信息则自动跳转
        tryAutoRedirect: async function () {
            try {
                const cachedUserInfo = uni.getStorageSync('userInfo');
                const cachedOpenId = uni.getStorageSync('userOpenId');
                if (cachedUserInfo && (cachedUserInfo._openid || cachedOpenId)) {
                    const app = getApp();
                    app.globalData = app.globalData || {};
                    app.globalData.userInfo = cachedUserInfo;
                    app.globalData.openid = cachedUserInfo._openid || cachedOpenId;
                    app.globalData._loginProcessCompleted = true;
                    await applyAuthenticatedUserSession(cachedUserInfo, {
                        openid: cachedUserInfo._openid || cachedOpenId
                    });
                    // 【关键修复】设置登录状态标记
                    app.globalData.isLoggedIn = true;
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

        // 账号密码登录
        async onLogin() {
            // #ifdef MP-WEIXIN
            if (this.enableWechatLogin && !this.showPasswordLogin) {
                // 微信登录
                return this.loginWithWechat();
            }
            // #endif
            
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

                await this.handleLoginResult(loginRes);
                
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

        // 取消登录（从登录页返回）
        handleLogout() {
            // 直接返回上一页，不需要确认和清除数据
            const pages = getCurrentPages();
            if (pages.length > 1) {
                // 有上一页，返回上一页
                uni.navigateBack();
            } else {
                // 没有上一页，跳转到首页
                uni.switchTab({
                    url: '/pages/poem-square/poem-square'
                });
            }
        },

        // 关闭绑定手机号弹窗
        closeBindPhoneModal() {
            this.showBindPhoneModal = false;
            // 清理短信相关数据
            this.smsPhoneNumber = '';
            this.smsCode = '';
            if (this.smsTimer) {
                clearInterval(this.smsTimer);
                this.smsTimer = null;
            }
            this.smsCountdown = 0;
            // 关闭弹窗后跳转到主页面
            setTimeout(() => {
                uni.switchTab({
                    url: '/pages/poem-square/poem-square'
                });
            }, 300);
        },

        // 登录后绑定 - 发送短信验证码
        async sendBindSmsCode() {
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
                // 调用腾讯云函数发送短信验证码
                const result = await this.$tcb.callFunction({
                    name: 'sendSmsCode',
                    data: {
                        phone: this.smsPhoneNumber,
                        scene: 'binding' // 绑定场景
                    }
                });

                console.log('📱 [登录后绑定] 发送结果:', result);

                if (result.result && result.result.success === true) {
                    uni.showToast({
                        title: '验证码已发送',
                        icon: 'success'
                    });
                    this.startSmsCountdown();
                } else {
                    const message = result.result && result.result.message ? result.result.message : '发送失败';
                    uni.showToast({
                        title: message,
                        icon: 'none',
                        duration: 3000
                    });
                }
            } catch (error) {
                console.error('📱 [登录后绑定] 发送失败:', error);
                uni.showToast({
                    title: '发送失败，请重试',
                    icon: 'none'
                });
            } finally {
                uni.hideLoading();
                this.isSendingSms = false;
            }
        },

        // 登录后绑定 - 短信验证码倒计时
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

        // 处理登录结果
        async handleLoginResult(loginRes) {
            console.log('🔍 [handleLoginResult] 处理登录结果:', loginRes);

            // 检查云函数返回结构
            const result = loginRes.result || loginRes;

            if (result.success) {
                console.log('✅ [handleLoginResult] 登录成功');

                // #ifdef MP-WEIXIN
                // 小程序环境：检查是否需要绑定微信
                if (result.needBindWechat) {
                    // openid 不同，询问是否绑定微信
                    console.log('⚠️ [handleLoginResult] 检测到 openid 不同，显示绑定微信弹窗');
                    this.pendingLoginResult = result;
                    this.showBindWechatModal = true;
                    return; // 等待用户确认
                }
                // #endif

                // 更新全局数据
                const app = getApp();
                app.globalData.userInfo = result.userInfo;
                app.globalData.openid = result.openid;
                app.globalData._loginProcessCompleted = true;
                await applyAuthenticatedUserSession(result.userInfo, {
                    openid: result.openid
                });
                // 【关键修复】设置登录状态标记
                app.globalData.isLoggedIn = true;

                // 缓存用户信息
                uni.setStorageSync('userInfo', result.userInfo);
                uni.setStorageSync('userOpenId', result.openid);

                // 检查是否需要绑定手机号
                // #ifndef MP-WEIXIN
                const isPhoneVerified = result.isPhoneVerified;
                console.log('🔍 [handleLoginResult] 手机号验证状态:', isPhoneVerified);

                if (!isPhoneVerified) {
                    console.log('⚠️ [handleLoginResult] 需要绑定手机号');
                    // 显示绑定手机号弹窗
                    this.showBindPhoneModal = true;
                    this.bindPhoneMethod = this.isApp ? 'oneclick' : 'sms';
                } else {
                // #endif
                    console.log('✅ [handleLoginResult] 手机号已验证或小程序端跳过验证，跳转到主页');
                    // 跳转到主页
                    uni.showToast({
                        title: '登录成功',
                        icon: 'success',
                        duration: 2000
                    });

                    setTimeout(() => {
                        uni.switchTab({
                            url: '/pages/poem-square/poem-square'
                        });
                    }, 1500);
                // #ifndef MP-WEIXIN
                }
                // #endif
            } else {
                console.error('❌ [handleLoginResult] 登录失败:', result.message);
                // 登录失败提示
                uni.showToast({
                    title: result.message || '登录失败，请重试',
                    icon: 'none',
                    duration: 3000
                });
            }
        },

        // 处理绑定手机号（支持多种方式）
        async handleBindPhone() {
            if (this.isBindingPhone) {
                return;
            }

            this.isBindingPhone = true;
            uni.showLoading({
                title: '绑定中...',
                mask: true
            });

            try {
                if (this.bindPhoneMethod === 'oneclick') {
                    // APP端一键绑定
                    if (!this.isApp) {
                        throw new Error('当前平台不支持一键登录');
                    }

                    // #ifdef APP-PLUS
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
                    const userOpenid = app.globalData && app.globalData.openid ? app.globalData.openid : null;
                    if (!userOpenid) {
                        throw new Error('未获取到用户标识，请先登录');
                    }

                    // 调用 uniCloud 云函数获取手机号并同步到腾讯云
                    const phoneRes = await callUniCloudFunction('getPhoneNumberByToken', {
                        access_token: access_token,
                        openid: univerifyOpenid,
                        userOpenid: userOpenid
                    });

                    if (phoneRes.result.code !== 0) {
                        throw new Error(phoneRes.result.message || '绑定手机号失败');
                    }

                    const phoneNumber = phoneRes.result.phoneNumber;
                    if (!phoneNumber) {
                        throw new Error('未获取到手机号');
                    }

                    // 更新本地用户信息
                    if (app.globalData.userInfo) {
                        app.globalData.userInfo.phoneNumber = phoneNumber;
                        app.globalData.userInfo.isPhoneVerified = true;
                        uni.setStorageSync('userInfo', app.globalData.userInfo);
                    }
                    // #endif

                } else if (this.bindPhoneMethod === 'sms') {
                    // H5/小程序短信验证绑定
                    if (!this.smsPhoneNumber || !this.smsCode) {
                        throw new Error('请输入手机号和验证码');
                    }

                    // 验证短信验证码 - 调用腾讯云函数
                    const verifyRes = await this.$tcb.callFunction({
                        name: 'verifySmsCode',
                        data: {
                            phone: this.smsPhoneNumber,
                            code: this.smsCode,
                            scene: 'binding'
                        }
                    });

                    if (verifyRes.result && verifyRes.result.success === true) {
                        // 验证成功，更新用户手机号
                        const app = getApp();
                        const userOpenid = app.globalData && app.globalData.openid ? app.globalData.openid : null;

                        if (!userOpenid) {
                            throw new Error('未获取到用户标识');
                        }

                        // 调用腾讯云函数更新用户信息
                        const updateRes = await this.callCloudFunction('updateUser', {
                            phoneNumber: this.smsPhoneNumber,
                            isPhoneVerified: true
                        });

                        if (updateRes.result && updateRes.result.success) {
                            // 更新本地用户信息
                            if (app.globalData.userInfo) {
                                app.globalData.userInfo.phoneNumber = this.smsPhoneNumber;
                                app.globalData.userInfo.isPhoneVerified = true;
                                uni.setStorageSync('userInfo', app.globalData.userInfo);
                            }
                        } else {
                            throw new Error(updateRes.result && updateRes.result.message ? updateRes.result.message : '更新用户信息失败');
                        }
                    } else {
                        const message = verifyRes.result && verifyRes.result.message ? verifyRes.result.message : '验证码错误';
                        throw new Error(message);
                    }
                }

                uni.showToast({
                    title: '绑定成功',
                    icon: 'success'
                });

                // 关闭弹窗并跳转
                this.closeBindPhoneModal();

            } catch (error) {
                console.error('❌ [绑定手机号] 失败:', error);

                // 如果是用户取消，不显示错误提示
                if (error.errMsg && (error.errMsg.includes('cancel') || error.errMsg.includes('取消'))) {
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
        },

        // 关闭绑定微信弹窗
        closeBindWechatModal() {
            this.showBindWechatModal = false;
            // 跳过绑定，直接完成登录
            this.skipBindWechat();
        },

        // 跳过绑定微信
        skipBindWechat() {
            if (!this.pendingLoginResult) return;
            
            console.log('⚠️ [skipBindWechat] 用户跳过绑定微信');
            
            // 使用原有的 openid 完成登录
            const result = this.pendingLoginResult;
            const app = getApp();
            app.globalData.userInfo = result.userInfo;
            app.globalData.openid = result.openid;
            app.globalData._loginProcessCompleted = true;
            applyAuthenticatedUserSession(result.userInfo, {
                openid: result.openid
            }).catch(() => {});
            app.globalData.isLoggedIn = true;

            uni.setStorageSync('userInfo', result.userInfo);
            uni.setStorageSync('userOpenId', result.openid);

            this.showBindWechatModal = false;
            this.pendingLoginResult = null;

            // 跳转到主页
            uni.showToast({
                title: '登录成功',
                icon: 'success',
                duration: 2000
            });

            setTimeout(() => {
                uni.switchTab({
                    url: '/pages/poem-square/poem-square'
                });
            }, 1500);
        },

        // 处理绑定微信
        async handleBindWechat() {
            if (this.isBindingWechat || !this.pendingLoginResult) return;

            this.isBindingWechat = true;
            uni.showLoading({
                title: '绑定中...',
                mask: true
            });

            try {
                const result = this.pendingLoginResult;
                const poemId = result.userInfo.poemId;

                console.log('🔍 [handleBindWechat] 开始绑定微信到账号:', { poemId });

                // 调用新的云函数：只添加 wechatOpenId，不修改 _openid
                const bindResult = await this.callCloudFunction('bindWechatToAccount', {
                    poemId: poemId,
                    forceRebind: false // 首次绑定，不强制
                });

                console.log('🔍 [handleBindWechat] 绑定结果:', bindResult);

                if (bindResult.result && bindResult.result.success) {
                    // 绑定成功
                    applyAuthenticatedUserSession(result.userInfo, {
                        openid: result.openid
                    }).catch(() => {});
                    this.completeBindWechat(result);
                } else if (bindResult.result && bindResult.result.code === 'OPENID_CONFLICT') {
                    // 微信 openid 已被用作其他账号的 _openid
                    console.log('⚠️ [handleBindWechat] 微信 openid 冲突，显示警告弹窗');
                    this.conflictAccountInfo = bindResult.result.conflictAccount;
                    this.showBindWechatModal = false;
                    this.showOpenidConflictModal = true;
                } else if (bindResult.result && bindResult.result.code === 'WECHAT_ALREADY_BOUND') {
                    // 微信已绑定到其他账号，显示解绑确认弹窗
                    console.log('⚠️ [handleBindWechat] 微信已绑定到其他账号，显示解绑确认弹窗');
                    this.boundAccountInfo = bindResult.result.boundAccount;
                    this.showBindWechatModal = false;
                    this.showRebindConfirmModal = true;
                } else {
                    throw new Error(bindResult.result?.message || '绑定失败');
                }
            } catch (error) {
                console.error('❌ [handleBindWechat] 绑定失败:', error);
                uni.showToast({
                    title: error.message || '绑定失败，请重试',
                    icon: 'none',
                    duration: 3000
                });
            } finally {
                uni.hideLoading();
                this.isBindingWechat = false;
            }
        },

        // 确认解绑并重新绑定
        async confirmRebind() {
            if (this.isBindingWechat || !this.pendingLoginResult) return;

            this.isBindingWechat = true;
            uni.showLoading({
                title: '重新绑定中...',
                mask: true
            });

            try {
                const result = this.pendingLoginResult;
                const poemId = result.userInfo.poemId;

                console.log('🔍 [confirmRebind] 确认解绑并重新绑定:', { poemId });

                // 调用云函数，强制重新绑定
                const bindResult = await this.callCloudFunction('bindWechatToAccount', {
                    poemId: poemId,
                    forceRebind: true // 强制重新绑定
                });

                console.log('🔍 [confirmRebind] 重新绑定结果:', bindResult);

                if (bindResult.result && bindResult.result.success) {
                    // 重新绑定成功
                    this.showRebindConfirmModal = false;
                    this.boundAccountInfo = null;
                    applyAuthenticatedUserSession(result.userInfo, {
                        openid: result.openid
                    }).catch(() => {});
                    this.completeBindWechat(result);
                } else {
                    throw new Error(bindResult.result?.message || '重新绑定失败');
                }
            } catch (error) {
                console.error('❌ [confirmRebind] 重新绑定失败:', error);
                uni.showToast({
                    title: error.message || '重新绑定失败，请重试',
                    icon: 'none',
                    duration: 3000
                });
            } finally {
                uni.hideLoading();
                this.isBindingWechat = false;
            }
        },

        // 取消解绑
        cancelRebind() {
            this.showRebindConfirmModal = false;
            this.boundAccountInfo = null;
            // 返回到绑定微信弹窗
            this.showBindWechatModal = true;
        },

        // 确认 openid 冲突并继续绑定
        async confirmOpenidConflict() {
            if (this.isBindingWechat || !this.pendingLoginResult) return;

            this.isBindingWechat = true;
            uni.showLoading({
                title: '绑定中...',
                mask: true
            });

            try {
                const result = this.pendingLoginResult;
                const poemId = result.userInfo.poemId;

                console.log('🔍 [confirmOpenidConflict] 用户确认继续绑定，忽略 openid 冲突:', { poemId });

                // 调用云函数，强制绑定
                const bindResult = await this.callCloudFunction('bindWechatToAccount', {
                    poemId: poemId,
                    forceRebind: true // 强制绑定，忽略冲突
                });

                console.log('🔍 [confirmOpenidConflict] 强制绑定结果:', bindResult);

                if (bindResult.result && bindResult.result.success) {
                    // 绑定成功
                    this.showOpenidConflictModal = false;
                    this.conflictAccountInfo = null;
                    applyAuthenticatedUserSession(result.userInfo, {
                        openid: result.openid
                    }).catch(() => {});
                    this.completeBindWechat(result);
                } else {
                    throw new Error(bindResult.result?.message || '绑定失败');
                }
            } catch (error) {
                console.error('❌ [confirmOpenidConflict] 强制绑定失败:', error);
                uni.showToast({
                    title: error.message || '绑定失败，请重试',
                    icon: 'none',
                    duration: 3000
                });
            } finally {
                uni.hideLoading();
                this.isBindingWechat = false;
            }
        },

        // 取消 openid 冲突绑定
        cancelOpenidConflict() {
            this.showOpenidConflictModal = false;
            this.conflictAccountInfo = null;
            // 返回到绑定微信弹窗
            this.showBindWechatModal = true;
        },

        // 完成绑定微信（公共方法）
        completeBindWechat(result) {
            // 绑定成功，更新本地用户信息
            const app = getApp();
            result.userInfo.wechatOpenId = result.currentOpenid;
            app.globalData.userInfo = result.userInfo;
            app.globalData.openid = result.openid; // 保持原有 openid
            app.globalData._loginProcessCompleted = true;
            app.globalData.isLoggedIn = true;

            uni.setStorageSync('userInfo', result.userInfo);
            uni.setStorageSync('userOpenId', result.openid);

            this.showBindWechatModal = false;
            this.showRebindConfirmModal = false;
            this.pendingLoginResult = null;
            this.boundAccountInfo = null;

            uni.showToast({
                title: '绑定成功！下次可直接使用微信登录',
                icon: 'success',
                duration: 3000
            });

            setTimeout(() => {
                uni.switchTab({
                    url: '/pages/poem-square/poem-square'
                });
            }, 2000);
        }
    }
};
</script>
<style>
.white-page { background: #fff; min-height: 100vh; position: relative; }
.container { position: relative; min-height: 100vh; padding: 0 0 140rpx; }
.center-wrap { position: absolute; top: 30%; left: 0; right: 0; transform: translateY(-50%); display: flex; flex-direction: column; align-items: center; padding: 0 40rpx; }
/* 微信登录区域位置调整到中下 */
.wechat-wrap { top: 50%; }
.brand { display: block; width: 100%; margin: 20vh 0 48rpx; font-size: 44rpx; font-weight: 600; color: #333; text-align: center; }
.form-wrapper { width: 100%; max-width: 560rpx; display: flex; flex-direction: column; align-items: center; }
.input-wrapper { width: 100%; margin-bottom: 36rpx; background: transparent; padding: 0; border: none; box-shadow: none; }
.input-field { width: 100%; height: 88rpx; border: none; outline: none; background: #f5f6f7; border-radius: 9999rpx; padding: 0 26rpx; font-size: 30rpx; color: #333; box-sizing: border-box; }

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

/* 微信登录区域 */
.wechat-login-section {
  width: 100%;
  max-width: 560rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 32rpx;
}

.wechat-login-btn {
  width: 100%;
  height: 96rpx;
  background: #4c6756;
  border-radius: 48rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  padding: 0;
  transition: all 0.2s ease;
}

.wechat-login-btn:active {
  opacity: 0.8;
  transform: scale(0.98);
}

.wechat-login-btn[disabled] {
  opacity: 0.6;
}

.wechat-login-text {
  font-size: 32rpx;
  color: #fff;
  font-weight: 500;
}

.switch-login-method {
  width: 100%;
  text-align: center;
  padding: 16rpx 0;
}

.switch-text {
  font-size: 28rpx;
  color: #999;
  text-decoration: underline;
  cursor: pointer;
}

.switch-text:active {
  color: #666;
}

/* 取消登录按钮样式 */
.logout-link {
  width: 100%;
  text-align: center;
  padding: 16rpx 0;
  margin-top: 8rpx;
}

.logout-text {
  font-size: 28rpx;
  color: #999;
  text-decoration: underline;
  cursor: pointer;
}

.logout-text:active {
  color: #666;
}

.password-login-section {
  width: 100%;
  max-width: 560rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24rpx;
}

/* GitHub 登录 */
.github-login-wrapper {
  width: 100%;
  margin-top: 30rpx;
  text-align: center;
}
.github-login-icon {
  width: 80rpx;
  height: 80rpx;
  border-radius: 50%;
  box-shadow: 0 8rpx 18rpx rgba(0, 0, 0, 0.15);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.github-login-icon:active {
  transform: scale(0.95);
  box-shadow: 0 4rpx 10rpx rgba(0, 0, 0, 0.2);
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

/* 验证码输入区域样式（绑定手机号时使用） */
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

/* 手机号输入框样式 */
.sms-bind-form .input-wrapper {
  margin-right: 0;
  margin-bottom: 24rpx;
}

/* 弹窗中的输入框样式 */
.bind-phone-modal .modal-content .input-field {
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
.bind-phone-modal .input-field {
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

/* 已绑定账号信息样式 */
.bound-account-info {
  margin-top: 20rpx;
  padding: 24rpx;
  background: #f5f6f7;
  border-radius: 12rpx;
}

.bound-account-text {
  display: block;
  font-size: 28rpx;
  color: #333;
  line-height: 1.8;
}

/* 警告按钮样式 */
.warning-btn {
  background: #ff6b6b;
  color: #fff;
}

.warning-btn:active {
  opacity: 0.8;
}

/* 危险按钮样式（数据丢失风险） */
.danger-btn {
  background: #ff4444 !important;
  color: #fff !important;
  border: 2rpx solid #ff2222 !important;
  box-shadow: 0 0 20rpx rgba(255, 68, 68, 0.3);
}

.danger-btn:active {
  opacity: 0.9;
}
</style>
