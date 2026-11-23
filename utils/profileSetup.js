const DEFAULT_WECHAT_NICKNAME = '\u5FAE\u4FE1\u7528\u6237';

export function isDefaultWechatNickname(nickName) {
    return typeof nickName === 'string' && nickName.trim() === DEFAULT_WECHAT_NICKNAME;
}

/**
 * 微信自动创建的账号在用户填写昵称/头像前不能直接进入 App。
 * 老账号（没有 profileCompleted 字段）只要已有昵称就视为已完成，
 * 避免上线后打断已经正常使用小程序的用户。
 */
export function needsProfileSetup(userInfo) {
    if (!userInfo || typeof userInfo !== 'object') {
        return false;
    }
    if (userInfo.profileCompleted === true) {
        return false;
    }
    if (userInfo.profileCompleted === false) {
        return true;
    }
    return isDefaultWechatNickname(userInfo.nickName);
}

export default {
    needsProfileSetup,
    isDefaultWechatNickname
};
