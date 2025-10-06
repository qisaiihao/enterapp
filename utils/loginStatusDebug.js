/**
 * 登录状态调试工具
 * 用于检查和调试用户登录状态问题
 */

/**
 * 检查登录状态
 */
function checkLoginStatus() {
    console.log('🔍 [LoginStatusDebug] 开始检查登录状态...');
    
    // 1. 检查缓存中的用户信息
    try {
        const cachedUserInfo = uni.getStorageSync('userInfo');
        console.log('📋 [LoginStatusDebug] 缓存中的用户信息:', cachedUserInfo);
        console.log('📋 [LoginStatusDebug] 缓存用户信息是否存在:', !!cachedUserInfo);
        console.log('📋 [LoginStatusDebug] 缓存用户信息_openid:', cachedUserInfo ? cachedUserInfo._openid : 'undefined');
    } catch (e) {
        console.error('❌ [LoginStatusDebug] 读取缓存用户信息失败:', e);
    }
    
    // 2. 检查 getApp().globalData
    try {
        const appInstance = getApp();
        console.log('📋 [LoginStatusDebug] getApp() 实例:', !!appInstance);
        console.log('📋 [LoginStatusDebug] getApp().globalData:', appInstance ? appInstance.globalData : 'undefined');
        console.log('📋 [LoginStatusDebug] getApp().globalData.userInfo:', appInstance && appInstance.globalData ? appInstance.globalData.userInfo : 'undefined');
        console.log('📋 [LoginStatusDebug] getApp().globalData.openid:', appInstance && appInstance.globalData ? appInstance.globalData.openid : 'undefined');
    } catch (e) {
        console.error('❌ [LoginStatusDebug] 检查getApp().globalData失败:', e);
    }
    
    // 3. 检查当前页面的 this.globalData（如果在Vue组件中）
    try {
        if (typeof this !== 'undefined' && this.globalData) {
            console.log('📋 [LoginStatusDebug] 当前页面this.globalData:', this.globalData);
            console.log('📋 [LoginStatusDebug] 当前页面this.globalData.userInfo:', this.globalData.userInfo);
            console.log('📋 [LoginStatusDebug] 当前页面this.globalData.openid:', this.globalData.openid);
        } else {
            console.log('📋 [LoginStatusDebug] 当前页面没有this.globalData或不在Vue组件中');
        }
    } catch (e) {
        console.error('❌ [LoginStatusDebug] 检查当前页面globalData失败:', e);
    }
    
    // 4. 综合判断登录状态
    const cachedUserInfo = uni.getStorageSync('userInfo');
    const appInstance = getApp();
    const appGlobalData = appInstance && appInstance.globalData;
    
    const hasCachedUser = !!(cachedUserInfo && cachedUserInfo._openid);
    const hasAppUserInfo = !!(appGlobalData && appGlobalData.userInfo);
    const hasAppOpenid = !!(appGlobalData && appGlobalData.openid);
    
    console.log('📋 [LoginStatusDebug] 登录状态判断:');
    console.log('  - 缓存中有用户信息:', hasCachedUser);
    console.log('  - getApp().globalData中有userInfo:', hasAppUserInfo);
    console.log('  - getApp().globalData中有openid:', hasAppOpenid);
    
    const isLoggedIn = hasCachedUser && hasAppUserInfo && hasAppOpenid;
    console.log('  - 综合判断：用户已登录:', isLoggedIn);
    
    if (!isLoggedIn) {
        console.log('❌ [LoginStatusDebug] 登录状态异常，可能的原因:');
        if (!hasCachedUser) console.log('  - 缓存中没有用户信息');
        if (!hasAppUserInfo) console.log('  - getApp().globalData中没有userInfo');
        if (!hasAppOpenid) console.log('  - getApp().globalData中没有openid');
    }
    
    return {
        isLoggedIn,
        hasCachedUser,
        hasAppUserInfo,
        hasAppOpenid,
        cachedUserInfo,
        appGlobalData
    };
}

/**
 * 修复登录状态
 */
function fixLoginStatus() {
    console.log('🔧 [LoginStatusDebug] 开始修复登录状态...');
    
    const status = checkLoginStatus();
    
    if (status.hasCachedUser && (!status.hasAppUserInfo || !status.hasAppOpenid)) {
        console.log('🔧 [LoginStatusDebug] 检测到缓存有用户信息但getApp().globalData不完整，开始修复...');
        
        try {
            const appInstance = getApp();
            if (appInstance) {
                appInstance.globalData = appInstance.globalData || {};
                appInstance.globalData.userInfo = status.cachedUserInfo;
                appInstance.globalData.openid = status.cachedUserInfo._openid;
                
                console.log('✅ [LoginStatusDebug] 登录状态修复完成');
                console.log('✅ [LoginStatusDebug] 修复后的getApp().globalData:', appInstance.globalData);
                
                return true;
            } else {
                console.error('❌ [LoginStatusDebug] getApp() 返回空值，无法修复');
                return false;
            }
        } catch (e) {
            console.error('❌ [LoginStatusDebug] 修复登录状态失败:', e);
            return false;
        }
    } else if (!status.hasCachedUser) {
        console.log('❌ [LoginStatusDebug] 缓存中没有用户信息，无法修复');
        return false;
    } else {
        console.log('✅ [LoginStatusDebug] 登录状态正常，无需修复');
        return true;
    }
}

/**
 * 在页面中使用的登录状态检查方法
 */
function checkLoginStatusInPage(pageName = '页面') {
    console.log(`🔍 [${pageName}] 检查登录状态...`);
    
    const status = checkLoginStatus();
    
    if (!status.isLoggedIn) {
        console.log(`❌ [${pageName}] 用户未登录，尝试修复...`);
        const fixed = fixLoginStatus();
        if (fixed) {
            console.log(`✅ [${pageName}] 登录状态修复成功`);
            return true;
        } else {
            console.log(`❌ [${pageName}] 登录状态修复失败`);
            return false;
        }
    } else {
        console.log(`✅ [${pageName}] 用户已登录`);
        return true;
    }
}

module.exports = {
    checkLoginStatus,
    fixLoginStatus,
    checkLoginStatusInPage
};
