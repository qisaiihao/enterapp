function safeGetSystemInfo() {
    if (typeof uni === 'undefined' || typeof uni.getSystemInfoSync !== 'function') {
        return {};
    }
    try {
        return uni.getSystemInfoSync() || {};
    } catch (error) {
        return {};
    }
}

function isHarmonySystem(systemInfo = {}) {
    const values = [
        systemInfo.uniPlatform,
        systemInfo.platform,
        systemInfo.osName,
        systemInfo.system,
        systemInfo.deviceBrand,
        systemInfo.hostName
    ].map((value) => String(value || '').toLowerCase());

    return values.some((value) => value.includes('harmony') || value.includes('hongmeng') || value.includes('ohos'));
}

function getPlatformInfo() {
    const info = {
        platform: 'unknown',
        isH5: false,
        isApp: false,
        isHarmony: false,
        isMiniProgram: false,
        isAndroid: false,
        isIOS: false,
        isWeixin: false,
        details: {}
    };

    try {
        if (typeof window !== 'undefined' && typeof document !== 'undefined') {
            info.platform = 'h5';
            info.isH5 = true;
            try {
                info.details.userAgent = navigator.userAgent || 'unknown';
            } catch (error) {
                info.details.userAgent = 'unknown';
            }
            return info;
        }

        const systemInfo = safeGetSystemInfo();
        info.details.systemInfo = systemInfo;

        if (typeof wx !== 'undefined' && typeof wx.getAccountInfoSync === 'function') {
            try {
                const accountInfo = wx.getAccountInfoSync();
                if (accountInfo && accountInfo.miniProgram) {
                    info.platform = 'mp-weixin';
                    info.isMiniProgram = true;
                    info.isWeixin = true;
                    info.details.accountInfo = accountInfo;
                    return info;
                }
            } catch (error) {}
        }

        if (isHarmonySystem(systemInfo)) {
            info.platform = 'app-harmony';
            info.isApp = true;
            info.isHarmony = true;
            return info;
        }

        const platform = String(systemInfo.platform || '').toLowerCase();
        if (typeof plus !== 'undefined' || platform === 'android' || platform === 'ios') {
            info.platform = 'app';
            info.isApp = true;
            info.isAndroid = platform === 'android';
            info.isIOS = platform === 'ios';
            return info;
        }
    } catch (error) {
        console.error('[platformDetector] detect platform failed', error);
    }

    return info;
}

function getCurrentPlatform() {
    return getPlatformInfo().platform;
}

function isPlatform(platform) {
    return getCurrentPlatform() === platform;
}

function supportsCloudFunction() {
    const info = getPlatformInfo();
    if (info.isH5 || info.isApp) {
        try {
            return typeof getApp === 'function' && !!(getApp() && getApp().$tcb);
        } catch (error) {
            return !!(typeof uni !== 'undefined' && uni.$tcb);
        }
    }
    if (info.isMiniProgram) {
        return typeof wx !== 'undefined' && !!wx.cloud;
    }
    return false;
}

function getCloudFunctionMethod() {
    const info = getPlatformInfo();
    if (info.isH5 || info.isApp) {
        return 'tcb';
    }
    if (info.isMiniProgram) {
        return 'wx-cloud';
    }
    return 'none';
}

function logPlatformInfo() {
    try {
        console.log('[platformDetector]', getPlatformInfo());
    } catch (error) {}
}

export {
    getPlatformInfo,
    getCurrentPlatform,
    isPlatform,
    supportsCloudFunction,
    getCloudFunctionMethod,
    logPlatformInfo
};

export default {
    getPlatformInfo,
    getCurrentPlatform,
    isPlatform,
    supportsCloudFunction,
    getCloudFunctionMethod,
    logPlatformInfo
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        getPlatformInfo,
        getCurrentPlatform,
        isPlatform,
        supportsCloudFunction,
        getCloudFunctionMethod,
        logPlatformInfo
    };
}
