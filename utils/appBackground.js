import fileUrlCache from '@/cache/core/file-url';
import { emitAppBackgroundUpdated } from '@/utils/events.js';

const APP_BACKGROUND_STORAGE_KEY = 'appBackgroundUrlCache';

function getAppInstance() {
    if (typeof getApp === 'function') {
        try {
            return getApp();
        } catch (_) {}
    }
    return null;
}

function cloneUserInfo(userInfo) {
    return userInfo && typeof userInfo === 'object' ? { ...userInfo } : null;
}

export function normalizeAppBackgroundUrl(url) {
    return typeof url === 'string' ? url.trim() : '';
}

export function getRawAppBackgroundUrl(userInfo = null) {
    return normalizeAppBackgroundUrl(userInfo && userInfo.appBackgroundUrl);
}

export function getCachedAppBackgroundUrl() {
    try {
        return normalizeAppBackgroundUrl(uni.getStorageSync(APP_BACKGROUND_STORAGE_KEY));
    } catch (_) {
        return '';
    }
}

export function setCachedAppBackgroundUrl(url) {
    const normalizedUrl = normalizeAppBackgroundUrl(url);
    try {
        if (normalizedUrl) {
            uni.setStorageSync(APP_BACKGROUND_STORAGE_KEY, normalizedUrl);
        } else {
            uni.removeStorageSync(APP_BACKGROUND_STORAGE_KEY);
        }
    } catch (_) {}
    return normalizedUrl;
}

export async function resolveAppBackgroundUrl(url) {
    const normalizedUrl = normalizeAppBackgroundUrl(url);
    if (!normalizedUrl) {
        return '';
    }
    if (!normalizedUrl.startsWith('cloud://')) {
        return normalizedUrl;
    }
    try {
        return await fileUrlCache.getTempUrl(normalizedUrl);
    } catch (error) {
        console.warn('[appBackground] resolve cloud url failed', error);
        return '';
    }
}

export async function syncAppBackgroundFromUserInfo(userInfo, { emit = false } = {}) {
    const rawUrl = getRawAppBackgroundUrl(userInfo);
    if (!rawUrl) {
        setCachedAppBackgroundUrl('');
        if (emit) {
            emitAppBackgroundUpdated({
                url: '',
                rawUrl: '',
                cleared: true
            });
        }
        return '';
    }
    const resolvedUrl = await resolveAppBackgroundUrl(rawUrl);
    setCachedAppBackgroundUrl(resolvedUrl);
    if (emit) {
        emitAppBackgroundUpdated({
            url: resolvedUrl,
            rawUrl,
            cleared: !resolvedUrl
        });
    }
    return resolvedUrl;
}

export async function applyUserInfoWithAppBackground(userInfo, { emit = true, writeStorage = true, writeGlobal = true } = {}) {
    const normalizedUserInfo = cloneUserInfo(userInfo);
    const app = getAppInstance();

    if (writeGlobal && app) {
        app.globalData = app.globalData || {};
        app.globalData.userInfo = normalizedUserInfo;
        if (normalizedUserInfo) {
            app.globalData.openid = normalizedUserInfo._openid || normalizedUserInfo.openid || app.globalData.openid || null;
        }
    }

    if (writeStorage) {
        try {
            if (normalizedUserInfo) {
                uni.setStorageSync('userInfo', normalizedUserInfo);
            } else {
                uni.removeStorageSync('userInfo');
            }
        } catch (_) {}
    }

    if (!normalizedUserInfo) {
        setCachedAppBackgroundUrl('');
        if (emit) {
            emitAppBackgroundUpdated({ url: '', rawUrl: '', cleared: true });
        }
        return null;
    }

    await syncAppBackgroundFromUserInfo(normalizedUserInfo, { emit });
    return normalizedUserInfo;
}

export async function applyAuthenticatedUserSession(
    userInfo,
    {
        openid = null,
        emit = true,
        writeStorage = true,
        writeGlobal = true
    } = {}
) {
    const normalizedUserInfo = await applyUserInfoWithAppBackground(userInfo, {
        emit,
        writeStorage,
        writeGlobal
    });

    const resolvedOpenid =
        openid ||
        (normalizedUserInfo && (normalizedUserInfo._openid || normalizedUserInfo.openid)) ||
        '';

    const app = getAppInstance();
    if (app) {
        app.globalData = app.globalData || {};
        app.globalData.userInfo = normalizedUserInfo || null;
        app.globalData.openid = resolvedOpenid || null;
        app.globalData._loginProcessCompleted = true;
        app.globalData.isLoggedIn = !!normalizedUserInfo;
    }

    try {
        if (resolvedOpenid) {
            uni.setStorageSync('userOpenId', resolvedOpenid);
        } else {
            uni.removeStorageSync('userOpenId');
        }
    } catch (_) {}

    return {
        userInfo: normalizedUserInfo,
        openid: resolvedOpenid
    };
}

export async function updateCurrentUserAppBackground(rawUrl, { emit = true } = {}) {
    const app = getAppInstance();
    let nextUserInfo = null;

    if (app && app.globalData && app.globalData.userInfo) {
        nextUserInfo = { ...app.globalData.userInfo, appBackgroundUrl: normalizeAppBackgroundUrl(rawUrl) };
    } else {
        try {
            const storedUserInfo = uni.getStorageSync('userInfo');
            if (storedUserInfo && typeof storedUserInfo === 'object') {
                nextUserInfo = { ...storedUserInfo, appBackgroundUrl: normalizeAppBackgroundUrl(rawUrl) };
            }
        } catch (_) {}
    }

    if (!nextUserInfo) {
        setCachedAppBackgroundUrl('');
        if (emit) {
            emitAppBackgroundUpdated({ url: '', rawUrl: '', cleared: true });
        }
        return null;
    }

    return applyUserInfoWithAppBackground(nextUserInfo, { emit, writeStorage: true, writeGlobal: true });
}
