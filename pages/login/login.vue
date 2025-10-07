<template>
    <view>
        <!-- 新的登录页面 -->
        <view class="container">
            <view class="title">欢迎回到回车键</view>
            <view class="subtitle">请输入你的账号信息登录</view>

            <view class="form-wrapper">
                <view class="input-wrapper">
                    <text class="input-label">Poem ID</text>
                    <input 
                        class="input-field" 
                        type="text" 
                        placeholder="请输入你的Poem ID" 
                        v-model="poemId"
                        @input="onPoemIdInput" 
                    />
                </view>

                <view class="input-wrapper">
                    <text class="input-label">密码</text>
                    <input 
                        class="input-field" 
                        type="password" 
                        placeholder="请输入密码" 
                        v-model="password"
                        @input="onPasswordInput" 
                    />
                </view>

                <button 
                    class="login-button" 
                    @tap="onLogin" 
                    :disabled="!canLogin || isLogging"
                    :class="{ 'loading': isLogging }"
                >
                    {{ isLogging ? '登录中...' : '登录' }}
                </button>

                <view class="register-link-wrapper">
                    <text class="register-text">还没有账号？</text>
                    <text class="register-link" @tap="goToRegister">立即注册</text>
                </view>
            </view>
        </view>
    </view>
</template>

<script>
// pages/login/login.js
const app = getApp();

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
                    uni.switchTab({ url: '/pages/poem/poem' });
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

        // 兼容性云函数调用方法
        callCloudFunction(name, data = {}) {
            return new Promise((resolve, reject) => {
                // 使用新的平台检测工具
                const { getCurrentPlatform, getCloudFunctionMethod } = require('../../utils/platformDetector.js');
                
                const platform = getCurrentPlatform();
                const method = getCloudFunctionMethod();
                // 使用检测到的调用方式
                const actualMethod = method;
                
                if (actualMethod === 'tcb') {
                    // 使用TCB调用云函数（H5和App环境）
                    if (this.$tcb && this.$tcb.callFunction) {
                        this.$tcb.callFunction({
                            name: name,
                            data: data
                        }).then(resolve).catch(reject);
                    } else {
                        reject(new Error('TCB实例不可用'));
                    }
                } else if (actualMethod === 'wx-cloud') {
                    // 使用微信云开发调用云函数（小程序环境）
                    if (wx.cloud && wx.cloud.callFunction) {
                        wx.cloud.callFunction({
                            name: name,
                            data: data,
                            success: (res) => {
                                resolve(res);
                            },
                            fail: (err) => {
                                reject(err);
                            }
                        });
                    } else {
                        reject(new Error('微信云开发不可用'));
                    }
                } else {
                    reject(new Error(`不支持的云函数调用方式: ${actualMethod}`));
                }
            });
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
                    
                    uni.showToast({
                        title: '登录成功',
                        icon: 'success'
                    });
                    
                    // 跳转到主页面
                    setTimeout(() => {
                        uni.switchTab({
                            url: '/pages/poem/poem'
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
/* 新的登录页面样式 */
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
    margin-bottom: 100rpx;
    text-align: center;
}

.form-wrapper {
    width: 100%;
    max-width: 600rpx;
}

.input-wrapper {
    margin-bottom: 40rpx;
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

.login-button {
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

.login-button:active {
    transform: translateY(2rpx);
    box-shadow: 0 4rpx 15rpx rgba(102, 126, 234, 0.3);
}

.login-button:disabled {
    background: #ccc;
    box-shadow: none;
    transform: none;
}

.login-button.loading {
    background: #ccc;
    box-shadow: none;
}

.register-link-wrapper {
    display: flex;
    justify-content: center;
    align-items: center;
    margin-top: 40rpx;
}

.register-text {
    font-size: 28rpx;
    color: #666;
    margin-right: 10rpx;
}

.register-link {
    font-size: 28rpx;
    color: #667eea;
    font-weight: 500;
    text-decoration: underline;
}
</style>
