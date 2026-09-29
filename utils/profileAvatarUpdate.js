import avatarCache from '@/cache/stores/avatar.js';
import { invalidateMyInfo } from '@/api-cache/my.js';
import { invalidateMyProfile } from '@/api-cache/profile.js';
import { invalidateUserInfo } from '@/api-cache/user-profile.js';
import { getAppState, getOpenid, patchAppState } from '@/utils/app-state.js';

/** 仅在服务端确认保存后调用；持久层保留文件 ID，不保存本次选图的临时路径。 */
export function syncSavedProfileAvatar(userId, avatarUrl) {
    if (!userId || !avatarUrl || getOpenid() !== userId) return false;
    invalidateMyInfo();
    invalidateMyProfile();
    invalidateUserInfo(userId);

    let storedUser = {};
    try { storedUser = uni.getStorageSync('userInfo') || {}; } catch (_) {}
    const userInfo = {
        ...storedUser,
        ...(getAppState().userInfo || {}),
        _openid: userId,
        avatarUrl,
        avatarFileID: avatarUrl.startsWith('cloud://') ? avatarUrl : ''
    };
    avatarCache.rememberSavedAvatar(userId, {
        avatarUrl: userInfo.avatarUrl,
        avatarFileID: userInfo.avatarFileID,
        nickName: userInfo.nickName,
        bio: userInfo.bio
    });
    patchAppState({ userInfo });
    try { uni.setStorageSync('userInfo', userInfo); } catch (_) {}
    return true;
}
