const STORAGE_PREFIX = 'profileShowGrowthStats:';

function normalizeOpenid(openid) {
    return typeof openid === 'string' ? openid.trim() : '';
}

function getStorageKey(openid) {
    const normalized = normalizeOpenid(openid);
    return normalized ? `${STORAGE_PREFIX}${normalized}` : '';
}

export function readLocalGrowthStatsVisibility(openid) {
    const key = getStorageKey(openid);
    if (!key || typeof uni === 'undefined' || !uni.getStorageSync) {
        return null;
    }
    try {
        const value = uni.getStorageSync(key);
        if (value === true || value === 'true') return true;
        if (value === false || value === 'false') return false;
    } catch (_) {}
    return null;
}

export function writeLocalGrowthStatsVisibility(openid, visible) {
    const key = getStorageKey(openid);
    if (!key || typeof uni === 'undefined' || !uni.setStorageSync) {
        return;
    }
    try {
        uni.setStorageSync(key, visible === true);
    } catch (_) {}
}

export function resolveGrowthStatsVisibility(userInfo = {}, openid = '', options = {}) {
    if (userInfo && typeof userInfo.showGrowthStats === 'boolean') {
        return userInfo.showGrowthStats;
    }
    if (options && options.allowLocalFallback) {
        const localValue = readLocalGrowthStatsVisibility(openid);
        if (typeof localValue === 'boolean') {
            return localValue;
        }
    }
    return false;
}
