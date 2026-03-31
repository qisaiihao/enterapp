import fileUrlCache from '@/cache/core/file-url';
import { emitAppBackgroundUpdated } from '@/utils/events.js';
import { patchAppState, setUserSession } from '@/utils/app-state.js';

const APP_BACKGROUND_STORAGE_KEY = 'appBackgroundUrlCache';

function getAppInstance() {
    if (typeof getApp !== 'function') {
        return null;
    }
    try {
        return getApp();
    } catch (_) {
        return null;
    }
}

function cloneUserInfo(userInfo) {
    return userInfo && typeof userInfo === 'object' ? { ...userInfo } : null;
}

export function normalizeAppBackgroundUrl(url) {
    return typeof url === 'string' ? url.trim() : '';
}

export function normalizeAppBackgroundMode(mode, backgroundUrl = '') {
    const normalizedUrl = normalizeAppBackgroundUrl(backgroundUrl);
    if (!normalizedUrl) {
        return '';
    }
    return typeof mode === 'string' && mode.trim().toLowerCase() === 'header' ? 'header' : 'full';
}

export function getRawAppBackgroundUrl(userInfo = null) {
    return normalizeAppBackgroundUrl(userInfo && userInfo.appBackgroundUrl);
}

export function getRawAppBackgroundMode(userInfo = null) {
    return normalizeAppBackgroundMode(userInfo && userInfo.appBackgroundMode, getRawAppBackgroundUrl(userInfo));
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
    const mode = getRawAppBackgroundMode(userInfo);
    if (!rawUrl) {
        setCachedAppBackgroundUrl('');
        if (emit) {
            emitAppBackgroundUpdated({
                url: '',
                rawUrl: '',
                mode: '',
                cleared: true
            });
        }
        return { url: '', mode: '' };
    }

    const resolvedUrl = await resolveAppBackgroundUrl(rawUrl);
    setCachedAppBackgroundUrl(resolvedUrl);
    if (emit) {
        emitAppBackgroundUpdated({
            url: resolvedUrl,
            rawUrl,
            mode,
            cleared: !resolvedUrl
        });
    }
    return {
        url: resolvedUrl,
        mode
    };
}

export async function applyUserInfoWithAppBackground(userInfo, { emit = true, writeStorage = true, writeGlobal = true } = {}) {
    const normalizedUserInfo = cloneUserInfo(userInfo);
    if (normalizedUserInfo) {
        normalizedUserInfo.appBackgroundUrl = getRawAppBackgroundUrl(normalizedUserInfo);
        normalizedUserInfo.appBackgroundMode = getRawAppBackgroundMode(normalizedUserInfo);
    }

    if (writeGlobal) {
        if (normalizedUserInfo) {
            setUserSession(normalizedUserInfo, normalizedUserInfo._openid || normalizedUserInfo.openid || null);
        } else {
            patchAppState({
                userInfo: null,
                isLoggedIn: false
            });
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
            emitAppBackgroundUpdated({ url: '', rawUrl: '', mode: '', cleared: true });
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

    if (writeGlobal) {
        setUserSession(normalizedUserInfo, resolvedOpenid || null);
        patchAppState({
            _loginProcessStarted: true,
            _loginProcessCompleted: true,
            isLoggedIn: !!normalizedUserInfo
        });
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

export async function updateCurrentUserAppBackground(rawUrl, { emit = true, mode } = {}) {
    const app = getAppInstance();
    let nextUserInfo = null;
    const normalizedRawUrl = normalizeAppBackgroundUrl(rawUrl);

    if (app && app.globalData && app.globalData.userInfo) {
        nextUserInfo = { ...app.globalData.userInfo, appBackgroundUrl: normalizedRawUrl };
    } else {
        try {
            const storedUserInfo = uni.getStorageSync('userInfo');
            if (storedUserInfo && typeof storedUserInfo === 'object') {
                nextUserInfo = { ...storedUserInfo, appBackgroundUrl: normalizedRawUrl };
            }
        } catch (_) {}
    }

    if (!nextUserInfo) {
        setCachedAppBackgroundUrl('');
        if (emit) {
            emitAppBackgroundUpdated({ url: '', rawUrl: '', mode: '', cleared: true });
        }
        return null;
    }

    nextUserInfo.appBackgroundMode = normalizeAppBackgroundMode(mode || nextUserInfo.appBackgroundMode, normalizedRawUrl);
    return applyUserInfoWithAppBackground(nextUserInfo, { emit, writeStorage: true, writeGlobal: true });
}
