<template>
  <view class="white-page">
    <view class="container">
      <text class="brand">poementer</text>
      <view class="center-wrap">
      <view class="form-wrapper compact">
        <view class="input-wrapper">
          <input class="input-field" type="text" placeholder="请输入 Poem ID" v-model="poemId" @input="onPoemIdInput" />
        </view>
        <view class="input-wrapper">
          <input class="input-field" type="password" placeholder="请输入密码" v-model="password" @input="onPasswordInput" />
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
  </view>
</template>

<script>
// pages/login/login.js
const app = getApp();
const { cloudCall } = require('../../utils/cloudCall.js');
import { resetAllCachesOnAccountChange } from '@/utils/accountCacheReset.js';

export default {
    data() {
        return {
            poemId: '',
            password: '',
            isLogging: false
        };
    },
    
    computed: {
        canLogin() {
            return this.poemId.trim() && this.password.trim();
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

        onPoemIdInput(e) {
            this.poemId = e.detail.value;
        },

        onPasswordInput(e) {
            this.password = e.detail.value;
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
                    
                    console.log('✅ [登录] 登录成功:', userInfo);
                    
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
                    
                    // 跳转到主页面
                    setTimeout(() => {
                        uni.switchTab({
                            url: '/pages/poem-square/poem-square'
                        });
                    }, 1000);
                    
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
</style>
