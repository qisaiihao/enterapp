<script>
export default {
    // 【重构】1. 将所有全局数据放入 data 函数中，这是 Vue 的标准做法
    data() {
        return {
            // globalData 对象将在这里被 Vue 响应式地管理
            globalData: {
                userInfo: null,
                openid: null
                // 您可以保留其他全局变量，但 env ID 已在 main.js 中配置，这里不再需要
            }
        };
    },

    // 【重构】2. onLaunch 是 Vue 的生命周期函数，保持不变
    onLaunch: function () {
        // 清理缓存是好习惯，予以保留
        uni.removeStorageSync('cachedPostList');
        
        // 执行登录流程
        this.loginAndCheckUser();
    },

    // 【重构】3. 将所有方法都放入 methods 对象中，这是 Vue 的标准做法
    methods: {
        // 【重构 & 修正】4. 使用 async/await 重写整个登录流程，代码更清晰
        async loginAndCheckUser() {
            // 检查 $tcb 实例是否存在
            if (!this.$tcb) {
                console.error('致命错误：this.$tcb 未定义！请检查 main.js 的初始化代码是否执行！');
                return; // 中断执行
            }

            // 步骤一：检查本地缓存，但需要验证云端账户
            const cachedUserInfo = uni.getStorageSync('userInfo');
            if (cachedUserInfo && cachedUserInfo._openid) {
                try {
                    // 先进行匿名认证
                    const currentUser = this.$tcb.auth().currentUser;
                    if (!currentUser) {
                        await this.$tcb.auth().signInAnonymously();
                    }
                    
                    // 调用云函数验证用户是否存在
                    const verifyRes = await this.$tcb.callFunction({
                        name: 'getUserProfile',
                        data: { userId: cachedUserInfo._openid }
                    });
                    
                    if (verifyRes.result && verifyRes.result.success && verifyRes.result.userInfo) {
                        // 使用云端返回的最新用户信息
                        const latestUserInfo = verifyRes.result.userInfo;
                        
                        // 同时更新 this.globalData 和 getApp().globalData
                        this.globalData.userInfo = latestUserInfo;
                        this.globalData.openid = latestUserInfo._openid;
                        
                        // 确保 getApp().globalData 也被正确设置
                        const appInstance = getApp();
                        if (appInstance) {
                            appInstance.globalData = appInstance.globalData || {};
                            appInstance.globalData.userInfo = latestUserInfo;
                            appInstance.globalData.openid = latestUserInfo._openid;
                            console.log('✅ [登录流程] getApp().globalData 已更新:', appInstance.globalData);
                        } else {
                        }
                        
                        // 更新本地缓存为最新的用户信息
                        uni.setStorageSync('userInfo', latestUserInfo);
                        
                        return; // 登录成功，结束流程
                    } else {
                        console.log('⚠️ [登录流程] 云端验证失败，用户账户不存在，将重新注册');
                        // 清除无效的缓存
                        uni.removeStorageSync('userInfo');
                        // 继续执行注册流程
                    }
                } catch (error) {
                    console.error('❌ [登录流程] 云端验证失败:', error);
                    console.log('⚠️ [登录流程] 验证失败，将重新注册');
                    // 清除可能无效的缓存
                    uni.removeStorageSync('userInfo');
                    // 继续执行注册流程
                }
            }

            // 步骤二：缓存未命中，执行完整的云端登录
            console.log('🤔 [登录流程] 缓存未命中，开始执行云端登录...');
            
            try {
                // 检查是否已经登录，避免重复登录
                const currentUser = this.$tcb.auth().currentUser;
                if (!currentUser) {
                    console.log('🔐 [认证] 尝试匿名登录...');
                    const authResult = await this.$tcb.auth().signInAnonymously();
                    console.log('✅ [认证] 匿名登录成功:', authResult);
                } else {
                    console.log('✅ [认证] 用户已登录，跳过匿名登录');
                }
                
                // 【修正】调用 this.$tcb，而不是 uniCloud！
                const loginRes = await this.$tcb.callFunction({
                    name: 'login' // 调用您在 TCB 中的 login 云函数
                });

                // 详细打印login云函数的返回数据，帮助调试
                console.log('🔍 [调试] login云函数完整返回数据:', loginRes);
                console.log('🔍 [调试] loginRes.result:', loginRes.result);
                console.log('🔍 [调试] loginRes.openid:', loginRes.openid);
                
                // 尝试多种方式获取openid
                let openid = null;
                if (loginRes.result && loginRes.result.openid) {
                    openid = loginRes.result.openid;
                    console.log('✅ [调试] 从result.openid获取到openid:', openid);
                } else if (loginRes.openid) {
                    openid = loginRes.openid;
                    console.log('✅ [调试] 从根级别openid获取到openid:', openid);
                } else if (loginRes.result && loginRes.result.uid) {
                    openid = loginRes.result.uid;
                    console.log('✅ [调试] 从result.uid获取到openid:', openid);
                } else {
                    console.error('❌ [登录流程] 无法从login云函数返回数据中获取openid');
                    console.error('❌ [登录流程] 完整返回数据:', JSON.stringify(loginRes, null, 2));
                    throw new Error('云函数 login 未返回 openid');
                }
                console.log('✅ [云函数 login] 调用成功, openid: ', openid);
                this.globalData.openid = openid;
                uni.setStorageSync('userOpenId', openid); // 缓存 openid

                // 步骤三：根据 openid 查询用户数据库
                // 【修正】使用 this.$tcb.database() 获取数据库实例
                const db = this.$tcb.database();
                const userRes = await db.collection('users').where({
                    _openid: openid
                }).get();

                if (userRes.data.length > 0) {
                    // 用户已存在，登录成功
                    const userInfo = userRes.data[0];
                    console.log('✅ [数据库查询] 用户已注册, 登录成功: ', userInfo);
                    this.globalData.userInfo = userInfo;
                    uni.setStorageSync('userInfo', userInfo); // 写入缓存
                } else {
                    // 用户不存在，是新用户
                    console.log('🤔 [数据库查询] 新用户，尚未注册');
                    this.globalData.userInfo = null; // 确保 userInfo 为 null
                }
                
                // 无论新旧用户，都更新 getApp() 的 globalData
                const appInstance = getApp();
                if (appInstance) {
                    appInstance.globalData = appInstance.globalData || {};
                    appInstance.globalData.userInfo = this.globalData.userInfo;
                    appInstance.globalData.openid = this.globalData.openid;
                    appInstance.globalData._loginProcessCompleted = true; // 标记登录流程已完成
                    console.log('✅ [登录流程] getApp().globalData 已更新:', appInstance.globalData);
                } else {
                }

            } catch (err) {
                // 处理登录错误
                
                // 即使登录失败，也标记登录流程已完成，避免后续显示登录提示
                const appInstance = getApp();
                if (appInstance) {
                    appInstance.globalData = appInstance.globalData || {};
                    appInstance.globalData._loginProcessCompleted = true;
                }
                
                uni.showToast({
                    icon: 'none',
                    title: '登录失败，请稍后重试'
                });
            }
        },

    }
};
</script>