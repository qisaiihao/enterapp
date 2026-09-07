import { cloudCall } from './cloudCall.js';

const ADMIN_FLAG_STORAGE_KEY = 'adminFlag';
const ADMIN_FLAG_TTL = 30 * 60 * 1000;

let memoryFlag = null;

function getAppUserInfo() {
    if (typeof getApp !== 'function') {
        return null;
    }

    try {
        const app = getApp();
        return (app && app.globalData && app.globalData.userInfo) || null;
    } catch (error) {
        return null;
    }
}

function getStorageUserInfo() {
    if (typeof uni === 'undefined' || typeof uni.getStorageSync !== 'function') {
        return null;
    }

    try {
        return uni.getStorageSync('userInfo') || null;
    } catch (error) {
        return null;
    }
}

function getCurrentUserInfo() {
    return getAppUserInfo() || getStorageUserInfo() || null;
}

function normalizePoemId(poemId) {
    return typeof poemId === 'string' ? poemId.trim() : '';
}

function getCurrentOpenid() {
    const userInfo = getCurrentUserInfo();
    return (userInfo && (userInfo._openid || userInfo.openid)) || '';
}

function readCachedAdminFlag() {
    if (memoryFlag) {
        return memoryFlag;
    }
    if (typeof uni === 'undefined' || typeof uni.getStorageSync !== 'function') {
        return null;
    }
    try {
        const raw = uni.getStorageSync(ADMIN_FLAG_STORAGE_KEY);
        if (raw && typeof raw === 'object') {
            memoryFlag = raw;
            return raw;
        }
    } catch (error) {}
    return null;
}

function saveCachedAdminFlag(flag) {
    memoryFlag = flag;
    if (typeof uni !== 'undefined' && typeof uni.setStorageSync === 'function') {
        try {
            uni.setStorageSync(ADMIN_FLAG_STORAGE_KEY, flag);
        } catch (error) {}
    }
}

function clearCachedAdminFlag() {
    memoryFlag = null;
    if (typeof uni !== 'undefined' && typeof uni.removeStorageSync === 'function') {
        try {
            uni.removeStorageSync(ADMIN_FLAG_STORAGE_KEY);
        } catch (error) {}
    }
}

function isFlagFresh(flag, openid) {
    if (!flag || typeof flag !== 'object') {
        return false;
    }
    if (flag.openid && flag.openid !== openid) {
        return false;
    }
    if (typeof flag.expireAt !== 'number') {
        return false;
    }
    return Date.now() < flag.expireAt;
}

async function refreshAdminStatus() {
    const openid = getCurrentOpenid();
    if (!openid) {
        return false;
    }

    try {
        const res = await cloudCall('checkAdmin', {}, {
            pageTag: 'admin-status',
            requireAuth: false,
            silent: true
        });
        const result = res && res.result && typeof res.result === 'object' ? res.result : res;
        const isAdmin = !!(result && result.isAdmin);
        saveCachedAdminFlag({
            isAdmin,
            openid,
            expireAt: Date.now() + ADMIN_FLAG_TTL
        });
        return isAdmin;
    } catch (error) {
        console.warn('[admin] refresh admin status failed:', error);
        return null;
    }
}

function resolveAdminFlag() {
    const openid = getCurrentOpenid();
    const flag = readCachedAdminFlag();
    if (flag && (!flag.openid || flag.openid === openid)) {
        if (isFlagFresh(flag, openid)) {
            return { isAdmin: !!flag.isAdmin, needsRefresh: false };
        }
        return { isAdmin: !!flag.isAdmin, needsRefresh: true };
    }
    return { isAdmin: false, needsRefresh: true };
}

function isCurrentUserAdmin() {
    const { isAdmin, needsRefresh } = resolveAdminFlag();
    if (needsRefresh) {
        refreshAdminStatus().catch(() => {});
    }
    return isAdmin;
}

function isAdminUser(userInfo) {
    if (!userInfo) {
        return false;
    }

    const openid = (userInfo._openid || userInfo.openid || '').trim();
    const flag = readCachedAdminFlag();
    if (flag && (!flag.openid || flag.openid === openid)) {
        if (isFlagFresh(flag, openid)) {
            return !!flag.isAdmin;
        }
        refreshAdminStatus().catch(() => {});
        return !!flag.isAdmin;
    }
    refreshAdminStatus().catch(() => {});
    return false;
}

function isAdminPoemId(poemId) {
    const userInfo = getCurrentUserInfo();
    if (!userInfo || !poemId) {
        return false;
    }
    if (normalizePoemId(userInfo.poemId) !== normalizePoemId(poemId)) {
        return false;
    }
    return isCurrentUserAdmin();
}

const adminUtils = {
    getCurrentUserInfo,
    isAdminPoemId,
    isAdminUser,
    isCurrentUserAdmin,
    refreshAdminStatus,
    clearCachedAdminFlag
};

export {
    getCurrentUserInfo,
    isAdminPoemId,
    isAdminUser,
    isCurrentUserAdmin,
    refreshAdminStatus,
    clearCachedAdminFlag
};

export default adminUtils;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = adminUtils;
    module.exports.default = adminUtils;
}