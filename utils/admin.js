const ADMIN_POEM_IDS = ['qisaihao', 'jingmikun', 'ZOUHE', 'qwertyuioop'];

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

function isAdminPoemId(poemId) {
    return ADMIN_POEM_IDS.includes(normalizePoemId(poemId));
}

function isAdminUser(userInfo) {
    return !!userInfo && isAdminPoemId(userInfo.poemId);
}

function isCurrentUserAdmin() {
    return isAdminUser(getCurrentUserInfo());
}

const adminUtils = {
    ADMIN_POEM_IDS,
    getCurrentUserInfo,
    isAdminPoemId,
    isAdminUser,
    isCurrentUserAdmin
};

export {
    ADMIN_POEM_IDS,
    getCurrentUserInfo,
    isAdminPoemId,
    isAdminUser,
    isCurrentUserAdmin
};

export default adminUtils;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = adminUtils;
    module.exports.default = adminUtils;
}
