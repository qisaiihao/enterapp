// 登录审计只发送基础端信息；IP 和源端口由云函数读取可信请求上下文。
const FIELD_LIMITS = {
    platform: 16,
    os: 32,
    osVersion: 64,
    deviceModel: 128,
    deviceBrand: 64,
    appVersion: 64,
    appVersionCode: 32,
    sdkVersion: 64,
    userAgent: 512
};

function text(value, limit) {
    if (typeof value !== 'string' && typeof value !== 'number') return '';
    return String(value).replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, limit);
}

function readBasicInfo(method) {
    // uni 的小程序设备信息包装器会额外生成 deviceId；审计优先直接读原生基础 API。
    const isNativeWechat = typeof wx !== 'undefined' && typeof wx.getAccountInfoSync === 'function';
    const targets = isNativeWechat ? [wx] : [typeof uni !== 'undefined' ? uni : null];
    for (const target of targets) {
        try {
            if (!target || typeof target[method] !== 'function') continue;
            const info = target[method]();
            if (info && typeof info === 'object') return info;
        } catch (error) {
            // 采集失败不能阻断登录，也不记录原始设备信息。
        }
    }
    return {};
}

function detectPlatform(device, app) {
    const uniPlatform = text(app.uniPlatform || device.uniPlatform, 32).toLowerCase();
    if (uniPlatform === 'app-harmony') return 'app-harmony';
    if (typeof plus !== 'undefined' || /^app(?:-|$)/.test(uniPlatform)) return 'app';
    if (uniPlatform === 'mp-weixin') return 'mp-weixin';
    if (uniPlatform === 'web' || uniPlatform === 'h5') return 'h5';
    if (typeof wx !== 'undefined' && typeof wx.getAccountInfoSync === 'function') {
        try {
            if (wx.getAccountInfoSync()?.miniProgram) return 'mp-weixin';
        } catch (error) {}
    }
    if (typeof window !== 'undefined' && typeof document !== 'undefined') return 'h5';
    return 'unknown';
}

function readBrowserOs(userAgent) {
    for (const [os, pattern] of [
        ['android', /Android\s+([\d.]+)/i],
        ['ios', /(?:CPU(?: iPhone)? OS|iPhone OS)\s+([\d_]+)/i],
        ['windows', /Windows NT\s+([\d.]+)/i],
        ['macos', /Mac OS X\s+([\d_]+)/i],
        ['chromeos', /CrOS\s+\S+\s+([\d.]+)/i]
    ]) {
        const match = userAgent.match(pattern);
        if (match) return { os, osVersion: text(match[1].replace(/_/g, '.'), FIELD_LIMITS.osVersion) };
    }
    return { os: /Linux/i.test(userAgent) ? 'linux' : '', osVersion: '' };
}

export function collectLoginClientInfo() {
    const result = {};
    Object.keys(FIELD_LIMITS).forEach(key => { result[key] = key === 'platform' ? 'unknown' : ''; });
    try {
        const app = readBasicInfo('getAppBaseInfo');
        const isBrowser = detectPlatform({}, app) === 'h5';
        // H5 的 uni.getDeviceInfo 会创建持久随机标识；浏览器审计直接读取有限 UA。
        const device = isBrowser ? {} : readBasicInfo('getDeviceInfo');
        // 老版本运行时仅提供 getSystemInfoSync；读取后也只取下面的白名单。
        const legacy = !isBrowser && (!Object.keys(device).length || !Object.keys(app).length)
            ? readBasicInfo('getSystemInfoSync') : {};
        const deviceInfo = Object.keys(device).length ? device : legacy;
        const appInfo = Object.keys(app).length ? app : legacy;
        result.platform = detectPlatform(deviceInfo, appInfo);
        const system = text(deviceInfo.system, 128);
        const systemParts = system.match(/^([^\d]+?)\s*(\d.*)$/);
        result.os = text(deviceInfo.osName || (systemParts && systemParts[1]) || deviceInfo.platform || system, FIELD_LIMITS.os).toLowerCase();
        result.osVersion = text(deviceInfo.osVersion || (systemParts && systemParts[2]), FIELD_LIMITS.osVersion);
        result.deviceModel = text(deviceInfo.deviceModel || deviceInfo.model, FIELD_LIMITS.deviceModel);
        result.deviceBrand = text(deviceInfo.deviceBrand || deviceInfo.brand, FIELD_LIMITS.deviceBrand);
        result.appVersion = text(appInfo.appVersion, FIELD_LIMITS.appVersion);
        result.appVersionCode = text(appInfo.appVersionCode, FIELD_LIMITS.appVersionCode);
        result.sdkVersion = text(appInfo.SDKVersion || appInfo.uniRuntimeVersion, FIELD_LIMITS.sdkVersion);
        if (['app', 'app-harmony'].includes(result.platform) && typeof plus !== 'undefined' && plus.runtime) {
            result.appVersion = result.appVersion || text(plus.runtime.version, FIELD_LIMITS.appVersion);
            result.appVersionCode = result.appVersionCode || text(plus.runtime.versionCode, FIELD_LIMITS.appVersionCode);
        }
        if (result.platform === 'mp-weixin' && typeof wx !== 'undefined' && typeof wx.getAccountInfoSync === 'function') {
            try {
                result.appVersion = result.appVersion || text(wx.getAccountInfoSync()?.miniProgram?.version, FIELD_LIMITS.appVersion);
            } catch (error) {}
        }
        if (typeof navigator !== 'undefined') {
            result.userAgent = text(navigator.userAgent, FIELD_LIMITS.userAgent);
        }
        if (isBrowser) {
            const browserOs = readBrowserOs(result.userAgent);
            result.os = browserOs.os;
            result.osVersion = browserOs.osVersion;
        }
    } catch (error) {
        // 基础信息 API 或宿主属性不可用时保留已取得的字段，其余留空。
    }
    return result;
}

export function isLoginAuditRequest(name, data = {}) {
    return ['loginWithCredentials', 'loginWithPhone', 'loginWithWechat', 'registerUser'].includes(name) ||
        (name === 'github-auth' && data.action === 'handleCallback');
}
