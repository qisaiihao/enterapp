/**
 * 平台调试工具
 * 提供详细的环境检测调试信息
 */

/**
 * 详细的环境检测调试
 */
function debugEnvironmentDetection() {
    console.log('🔍 [DebugPlatform] 开始详细环境检测...');
    
    // 1. 基础环境检测
    console.log('📋 [DebugPlatform] 基础环境检测:');
    console.log('  - typeof window:', typeof window);
    console.log('  - typeof document:', typeof document);
    console.log('  - typeof wx:', typeof wx);
    console.log('  - typeof uni:', typeof uni);
    console.log('  - typeof plus:', typeof plus);
    console.log('  - typeof getApp:', typeof getApp);
    
    // 2. 检查wx对象的具体内容
    if (typeof wx !== 'undefined') {
        console.log('📋 [DebugPlatform] wx对象检测:');
        console.log('  - wx.cloud:', typeof wx.cloud);
        console.log('  - wx.getSystemInfoSync:', typeof wx.getSystemInfoSync);
        console.log('  - wx.getAccountInfoSync:', typeof wx.getAccountInfoSync);
        
        // 尝试获取系统信息
        try {
            const systemInfo = wx.getSystemInfoSync();
            console.log('  - 系统信息:', systemInfo);
        } catch (e) {
            console.log('  - 获取系统信息失败:', e.message);
        }
        
        // 尝试获取账户信息
        try {
            const accountInfo = wx.getAccountInfoSync();
            console.log('  - 账户信息:', accountInfo);
        } catch (e) {
            console.log('  - 获取账户信息失败:', e.message);
        }
    }
    
    // 3. 检查uni对象
    if (typeof uni !== 'undefined') {
        console.log('📋 [DebugPlatform] uni对象检测:');
        console.log('  - uni.getSystemInfoSync:', typeof uni.getSystemInfoSync);
        
        try {
            const systemInfo = uni.getSystemInfoSync();
            console.log('  - uni系统信息:', systemInfo);
        } catch (e) {
            console.log('  - uni获取系统信息失败:', e.message);
        }
    }
    
    // 4. 检查getApp
    if (typeof getApp !== 'undefined') {
        try {
            const app = getApp();
            console.log('📋 [DebugPlatform] getApp检测:');
            console.log('  - getApp()成功:', !!app);
            console.log('  - app.$tcb:', typeof app.$tcb);
            console.log('  - app.$tcb.callFunction:', typeof (app.$tcb && app.$tcb.callFunction));
        } catch (e) {
            console.log('  - getApp()失败:', e.message);
        }
    }
    
    // 5. 检查TCB实例
    try {
        const app = getApp();
        if (app && app.$tcb) {
            console.log('📋 [DebugPlatform] TCB实例检测:');
            console.log('  - TCB实例存在:', !!app.$tcb);
            console.log('  - TCB配置:', app.$tcb.config);
            console.log('  - TCB环境ID:', app.$tcb.config?.env);
            console.log('  - TCB数据库方法:', typeof app.$tcb.database);
            console.log('  - TCB云函数方法:', typeof app.$tcb.callFunction);
        }
    } catch (e) {
        console.log('  - TCB实例检测失败:', e.message);
    }
    
    // 6. 最终判断
    console.log('📋 [DebugPlatform] 最终判断:');
    
    // H5环境判断
    const isH5 = typeof window !== 'undefined' && typeof document !== 'undefined';
    console.log('  - 是否H5环境:', isH5);
    
    // 小程序环境判断（严格）
    let isMiniProgram = false;
    if (typeof wx !== 'undefined' && wx.getSystemInfoSync && wx.getAccountInfoSync) {
        try {
            const systemInfo = wx.getSystemInfoSync();
            const accountInfo = wx.getAccountInfoSync();
            isMiniProgram = !!(accountInfo.miniProgram && systemInfo.platform);
        } catch (e) {
            isMiniProgram = false;
        }
    }
    console.log('  - 是否小程序环境:', isMiniProgram);
    
    // App环境判断（修复逻辑）
    const isApp = !isH5 && !isMiniProgram && (typeof plus !== 'undefined' || typeof uni !== 'undefined');
    console.log('  - 是否App环境:', isApp);
    
    // 推荐使用的云函数调用方式
    let recommendedMethod = 'none';
    if (isH5 || isApp) {
        recommendedMethod = 'tcb';
    } else if (isMiniProgram) {
        recommendedMethod = 'wx-cloud';
    }
    console.log('  - 推荐云函数调用方式:', recommendedMethod);
    
    console.log('🔍 [DebugPlatform] 环境检测完成');
}

/**
 * 测试云函数调用能力
 */
function testCloudFunctionCapability() {
    console.log('🧪 [DebugPlatform] 测试云函数调用能力...');
    
    try {
        const app = getApp();
        if (app && app.$tcb && app.$tcb.callFunction) {
            console.log('✅ [DebugPlatform] TCB云函数调用能力: 可用');
            return 'tcb';
        }
    } catch (e) {
        console.log('❌ [DebugPlatform] TCB云函数调用能力: 不可用', e.message);
    }
    
    try {
        if (typeof wx !== 'undefined' && wx.cloud && wx.cloud.callFunction) {
            console.log('✅ [DebugPlatform] 微信云开发调用能力: 可用');
            return 'wx-cloud';
        }
    } catch (e) {
        console.log('❌ [DebugPlatform] 微信云开发调用能力: 不可用', e.message);
    }
    
    console.log('❌ [DebugPlatform] 无可用云函数调用方式');
    return 'none';
}

module.exports = {
    debugEnvironmentDetection,
    testCloudFunctionCapability
};
