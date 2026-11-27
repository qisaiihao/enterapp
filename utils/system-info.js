import { hasAcceptedPrivacyConsent } from './privacyConsent.js';

// uni-app 的 getDeviceInfo/getSystemInfoSync 在读取设备信息时会附带设备标识
// （HarmonyOS 上为 OAID，审核报告中常表述为 IMEI）。只有用户同意隐私政策后
// 才允许调用，避免“同意前收集设备标识”的合规问题。
function canReadDeviceIdentifier() {
    try {
        return hasAcceptedPrivacyConsent();
    } catch (error) {
        return false;
    }
}

function hasKeys(value) {
    return !!(value && typeof value === 'object' && Object.keys(value).length);
}

function callSyncMethod(target, methodName) {
    if (!target || typeof target[methodName] !== 'function') {
        return null;
    }

    try {
        return target[methodName]() || {};
    } catch (error) {
        return null;
    }
}

function callPreferredMethod(methodName) {
    const uniResult = typeof uni !== 'undefined' ? callSyncMethod(uni, methodName) : null;
    if (hasKeys(uniResult)) {
        return uniResult;
    }

    const wxResult = typeof wx !== 'undefined' ? callSyncMethod(wx, methodName) : null;
    if (hasKeys(wxResult)) {
        return wxResult;
    }

    return uniResult || wxResult || null;
}

function getLegacySystemInfo() {
    if (!canReadDeviceIdentifier()) {
        return {};
    }

    const uniResult = typeof uni !== 'undefined' ? callSyncMethod(uni, 'getSystemInfoSync') : null;
    if (hasKeys(uniResult)) {
        return uniResult;
    }

    const wxResult = typeof wx !== 'undefined' ? callSyncMethod(wx, 'getSystemInfoSync') : null;
    if (hasKeys(wxResult)) {
        return wxResult;
    }

    return {};
}

function buildSafeAreaInsets(info = {}) {
    if (info.safeAreaInsets && typeof info.safeAreaInsets === 'object') {
        return info.safeAreaInsets;
    }

    const safeArea = info.safeArea;
    if (!safeArea || typeof safeArea !== 'object') {
        const top = Number(info.statusBarHeight || 0);
        if (!top) {
            return null;
        }

        return {
            top,
            left: 0,
            right: 0,
            bottom: 0
        };
    }

    const screenWidth = Number(info.windowWidth || info.screenWidth || 0);
    const screenHeight = Number(info.windowHeight || info.screenHeight || 0);
    const safeAreaLeft = Math.max(0, Number(safeArea.left || 0));
    const safeAreaRight = Number(safeArea.right || 0);
    const safeAreaBottom = Number(safeArea.bottom || 0);

    return {
        top: Math.max(0, Number(safeArea.top || info.statusBarHeight || 0)),
        left: safeAreaLeft,
        right: screenWidth > 0 && safeAreaRight > 0 ? Math.max(0, screenWidth - safeAreaRight) : 0,
        bottom: screenHeight > 0 && safeAreaBottom > 0 ? Math.max(0, screenHeight - safeAreaBottom) : 0
    };
}

function normalizeInfo(info = {}) {
    if (!info || typeof info !== 'object') {
        return {};
    }

    const normalized = { ...info };
    const safeAreaInsets = buildSafeAreaInsets(normalized);
    if (safeAreaInsets) {
        normalized.safeAreaInsets = safeAreaInsets;
    }

    return normalized;
}

function getWindowInfoCompat() {
    const info = normalizeInfo(callPreferredMethod('getWindowInfo'));
    if (hasKeys(info)) {
        return info;
    }

    return normalizeInfo(getLegacySystemInfo());
}

function getDeviceInfoCompat() {
    if (canReadDeviceIdentifier()) {
        const info = normalizeInfo(callPreferredMethod('getDeviceInfo'));
        if (hasKeys(info)) {
            return info;
        }
    }

    return normalizeInfo(getLegacySystemInfo());
}

function getAppBaseInfoCompat() {
    const info = normalizeInfo(callPreferredMethod('getAppBaseInfo'));
    if (hasKeys(info)) {
        return info;
    }

    return normalizeInfo(getLegacySystemInfo());
}

function getSystemSettingCompat() {
    return normalizeInfo(callPreferredMethod('getSystemSetting') || {});
}

function getAppAuthorizeSettingCompat() {
    return normalizeInfo(callPreferredMethod('getAppAuthorizeSetting') || {});
}

function getSystemInfoCompat() {
    const deviceInfo = getDeviceInfoCompat();
    const appBaseInfo = getAppBaseInfoCompat();
    const windowInfo = getWindowInfoCompat();
    const systemSetting = getSystemSettingCompat();
    const appAuthorizeSetting = getAppAuthorizeSettingCompat();

    if (
        hasKeys(deviceInfo) ||
        hasKeys(appBaseInfo) ||
        hasKeys(windowInfo) ||
        hasKeys(systemSetting) ||
        hasKeys(appAuthorizeSetting)
    ) {
        return normalizeInfo({
            ...deviceInfo,
            ...appBaseInfo,
            ...windowInfo,
            ...systemSetting,
            ...appAuthorizeSetting
        });
    }

    return normalizeInfo(getLegacySystemInfo());
}

function getStatusBarHeightCompat() {
    const info = getWindowInfoCompat();
    return Number(info.safeAreaInsets?.top || info.statusBarHeight || 0);
}

function getMenuButtonBoundingClientRectCompat() {
    const uniResult = typeof uni !== 'undefined' ? callSyncMethod(uni, 'getMenuButtonBoundingClientRect') : null;
    if (hasKeys(uniResult)) {
        return uniResult;
    }

    const wxResult = typeof wx !== 'undefined' ? callSyncMethod(wx, 'getMenuButtonBoundingClientRect') : null;
    if (hasKeys(wxResult)) {
        return wxResult;
    }

    return uniResult || wxResult || null;
}

export {
    getWindowInfoCompat,
    getDeviceInfoCompat,
    getAppBaseInfoCompat,
    getSystemSettingCompat,
    getAppAuthorizeSettingCompat,
    getSystemInfoCompat,
    getStatusBarHeightCompat,
    getMenuButtonBoundingClientRectCompat
};

export default {
    getWindowInfoCompat,
    getDeviceInfoCompat,
    getAppBaseInfoCompat,
    getSystemSettingCompat,
    getAppAuthorizeSettingCompat,
    getSystemInfoCompat,
    getStatusBarHeightCompat,
    getMenuButtonBoundingClientRectCompat
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        getWindowInfoCompat,
        getDeviceInfoCompat,
        getAppBaseInfoCompat,
        getSystemSettingCompat,
        getAppAuthorizeSettingCompat,
        getSystemInfoCompat,
        getStatusBarHeightCompat,
        getMenuButtonBoundingClientRectCompat
    };
}
