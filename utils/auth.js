const OPENID_KEYS = ['userOpenId', 'openid'];

function getAppInstance() {
    if (typeof getApp === 'function') {
        try {
            return getApp();
        } catch (error) {
            console.warn('[auth] 获取 App 实例失败', error);
        }
    }
    return null;
}

function readOpenIdFromStorage() {
    if (typeof uni === 'undefined' || typeof uni.getStorageSync !== 'function') {
        return null;
    }
    for (const key of OPENID_KEYS) {
        try {
            const value = uni.getStorageSync(key);
            if (value) {
                return value;
            }
        } catch (error) {
            console.warn(`[auth] 读取本地 openid(${key}) 失败`, error);
        }
    }
    return null;
}

function cacheOpenId(openid) {
    if (!openid) {
        return;
    }
    const app = getAppInstance();
    if (app) {
        app.globalData = app.globalData || {};
        app.globalData.openid = openid;
    }
    if (typeof uni !== 'undefined' && typeof uni.setStorageSync === 'function') {
        try {
            uni.setStorageSync('userOpenId', openid);
        } catch (error) {
            console.warn('[auth] 缓存 openid 失败', error);
        }
    }
}

async function getOpenId() {
    const app = getAppInstance();
    const fromGlobal = app && app.globalData && app.globalData.openid;
    if (fromGlobal) {
        return fromGlobal;
    }

    const fromCache = readOpenIdFromStorage();
    if (fromCache) {
        cacheOpenId(fromCache);
        return fromCache;
    }

    return null;
}

function setLoginState(userInfo = null, openid = null) {
    const app = getAppInstance();
    if (!app) {
        return;
    }
    app.globalData = app.globalData || {};
    if (openid) {
        app.globalData.openid = openid;
        cacheOpenId(openid);
    }
    if (userInfo) {
        app.globalData.userInfo = Object.assign({}, app.globalData.userInfo || {}, userInfo);
    }
    app.globalData._loginProcessCompleted = true;
}

module.exports = {
    getOpenId,
    setLoginState
};
