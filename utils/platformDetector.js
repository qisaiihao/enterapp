/**
 * 平台检测工具
 * 用于准确识别uni-app在不同平台上的运行环境
 */

/**
 * 获取详细的平台信息
 * @returns {Object} 平台信息对象
 */
function getPlatformInfo() {
    const info = {
        platform: 'unknown',
        isH5: false,
        isApp: false,
        isMiniProgram: false,
        isAndroid: false,
        isIOS: false,
        isWeixin: false,
        details: {}
    };

    try {
        // 1. 检查H5环境
        if (typeof window !== 'undefined' && typeof document !== 'undefined') {
            info.platform = 'h5';
            info.isH5 = true;
            // 安全地获取userAgent
            try {
                info.details.userAgent = navigator.userAgent || 'unknown';
            } catch (e) {
                info.details.userAgent = 'unknown';
            }
            return info;
        }

        // 2. 检查uni-app环境
        if (typeof uni !== 'undefined') {
            try {
                const systemInfo = uni.getSystemInfoSync();
                info.details.systemInfo = systemInfo;
                
                // 检查是否为小程序环境
                if (typeof wx !== 'undefined' && wx.getAccountInfoSync) {
                    try {
                        const accountInfo = wx.getAccountInfoSync();
                        if (accountInfo.miniProgram) {
                            info.platform = 'mp-weixin';
                            info.isMiniProgram = true;
                            info.isWeixin = true;
                            info.details.accountInfo = accountInfo;
                            return info;
                        }
                    } catch (e) {
                        // 不是小程序环境
                    }
                }

                // 检查App环境
                if (typeof plus !== 'undefined') {
                    info.platform = 'app';
                    info.isApp = true;
                    
                    if (systemInfo.platform === 'android') {
                        info.isAndroid = true;
                    } else if (systemInfo.platform === 'ios') {
                        info.isIOS = true;
                    }
                    
                    return info;
                }
                
                // 备用检测：通过systemInfo判断app环境
                if (systemInfo.platform && (systemInfo.platform === 'android' || systemInfo.platform === 'ios')) {
                    info.platform = 'app';
                    info.isApp = true;
                    
                    if (systemInfo.platform === 'android') {
                        info.isAndroid = true;
                    } else if (systemInfo.platform === 'ios') {
                        info.isIOS = true;
                    }
                    
                    return info;
                }
            } catch (e) {
                console.warn('获取系统信息失败:', e);
            }
        }

        // 3. 检查微信小程序环境（备用检测）
        if (typeof wx !== 'undefined' && wx.getAccountInfoSync) {
            try {
                const accountInfo = wx.getAccountInfoSync();
                
                if (accountInfo.miniProgram) {
                    info.platform = 'mp-weixin';
                    info.isMiniProgram = true;
                    info.isWeixin = true;
                    
                    // 使用新的API获取系统信息
                    try {
                        if (wx.getWindowInfo) {
                            info.details.windowInfo = wx.getWindowInfo();
                        }
                        if (wx.getDeviceInfo) {
                            info.details.deviceInfo = wx.getDeviceInfo();
                        }
                    } catch (e) {
                        // 忽略获取详细信息失败
                    }
                    
                    info.details.accountInfo = accountInfo;
                    return info;
                }
            } catch (e) {
                // 不是小程序环境
            }
        }

    } catch (error) {
        console.error('平台检测失败:', error);
    }

    return info;
}

/**
 * 获取简化的平台类型
 * @returns {string} 平台类型：'h5', 'app', 'mp-weixin', 'unknown'
 */
function getCurrentPlatform() {
    const info = getPlatformInfo();
    return info.platform;
}

/**
 * 检查是否为特定平台
 * @param {string} platform 平台名称
 * @returns {boolean} 是否为指定平台
 */
function isPlatform(platform) {
    const info = getPlatformInfo();
    return info.platform === platform;
}

/**
 * 检查是否支持云函数调用
 * @returns {boolean} 是否支持云函数
 */
function supportsCloudFunction() {
    const info = getPlatformInfo();
    
    // H5和App环境支持TCB云函数
    if (info.isH5 || info.isApp) {
        return typeof getApp !== 'undefined' && getApp().$tcb;
    }
    
    // 小程序环境支持微信云开发
    if (info.isMiniProgram) {
        return typeof wx !== 'undefined' && wx.cloud;
    }
    
    return false;
}

/**
 * 获取云函数调用方式
 * @returns {string} 调用方式：'tcb', 'wx-cloud', 'none'
 */
function getCloudFunctionMethod() {
    const info = getPlatformInfo();
    
    // 添加调试信息
    console.log('🔍 [PlatformDetector] 环境检测结果:', {
        platform: info.platform,
        isH5: info.isH5,
        isApp: info.isApp,
        isMiniProgram: info.isMiniProgram,
        details: info.details
    });
    
    if (info.isH5 || info.isApp) {
        console.log('🔍 [PlatformDetector] 使用TCB云函数调用方式');
        return 'tcb';
    }
    
    if (info.isMiniProgram) {
        console.log('🔍 [PlatformDetector] 使用微信云开发调用方式');
        return 'wx-cloud';
    }
    
    console.warn('🔍 [PlatformDetector] 未识别的环境，返回none');
    return 'none';
}

/**
 * 打印平台信息（调试用）
 */
function logPlatformInfo() {
    // 调试信息已移除，保持函数存在以避免引用错误
}

module.exports = {
    getPlatformInfo,
    getCurrentPlatform,
    isPlatform,
    supportsCloudFunction,
    getCloudFunctionMethod,
    logPlatformInfo
};
