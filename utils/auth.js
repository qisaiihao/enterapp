import * as appState from './app-state.js';

const OPENID_KEYS = ['userOpenId', 'openid'];

function getAppInstance() {
    if (typeof getApp !== 'function') {
        return null;
    }
    try {
        return getApp();
    } catch (error) {
        return null;
    }
}

function getAppStateModule() {
    return appState && typeof appState === 'object' ? appState : {};
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
        } catch (error) {}
    }
    return null;
}

function patchFallbackState(partial = {}) {
    const app = getAppInstance();
    if (!app) {
        return {};
    }
    app.globalData = app.globalData || {};
    Object.keys(partial).forEach((key) => {
        app.globalData[key] = partial[key];
    });
    return app.globalData;
}

function patchAppStateSafe(partial = {}) {
    const appState = getAppStateModule();
    if (typeof appState.patchAppState === 'function') {
        try {
            return appState.patchAppState(partial);
        } catch (error) {}
    }
    return patchFallbackState(partial);
}

function setUserSessionSafe(userInfo = null, openid = null) {
    const appState = getAppStateModule();
    if (typeof appState.setUserSession === 'function') {
        try {
            return appState.setUserSession(userInfo, openid);
        } catch (error) {}
    }
    return patchFallbackState({
        userInfo: userInfo || null,
        openid: openid || null,
        isLoggedIn: !!userInfo
    });
}

function getOpenIdFromState() {
    const appState = getAppStateModule();
    if (typeof appState.getOpenid === 'function') {
        try {
            return appState.getOpenid();
        } catch (error) {}
    }
    if (typeof appState.getAppState === 'function') {
        try {
            const state = appState.getAppState();
            return state && state.openid;
        } catch (error) {}
    }
    const app = getAppInstance();
    return app && app.globalData ? app.globalData.openid : null;
}

function cacheOpenId(openid) {
    if (!openid) {
        return;
    }
    patchAppStateSafe({ openid });
    if (typeof uni !== 'undefined' && typeof uni.setStorageSync === 'function') {
        try {
            uni.setStorageSync('userOpenId', openid);
        } catch (error) {}
    }
}

async function getOpenId() {
    const fromState = getOpenIdFromState();
    if (fromState) {
        return fromState;
    }

    const fromStorage = readOpenIdFromStorage();
    if (fromStorage) {
        cacheOpenId(fromStorage);
        return fromStorage;
    }

    return null;
}

function setLoginState(userInfo = null, openid = null) {
    const resolvedOpenid = openid || (userInfo && (userInfo._openid || userInfo.openid)) || null;
    if (resolvedOpenid) {
        cacheOpenId(resolvedOpenid);
    }
    setUserSessionSafe(userInfo, resolvedOpenid);
    patchAppStateSafe({
        _loginProcessStarted: true,
        _loginProcessCompleted: true,
        isLoggedIn: !!userInfo
    });
}

function getCurrentUserId(context = null) {
    if (context && context.openid) {
        return context.openid;
    }

    const fromState = getOpenIdFromState();
    if (fromState) {
        return fromState;
    }

    return readOpenIdFromStorage();
}

const authUtils = {
    getOpenId,
    setLoginState,
    getCurrentUserId
};

export {
    getOpenId,
    setLoginState,
    getCurrentUserId
};

export default authUtils;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = authUtils;
    module.exports.default = authUtils;
}
