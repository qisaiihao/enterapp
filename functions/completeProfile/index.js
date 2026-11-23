const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database({ throwOnNotFound: false });

const MAX_NICKNAME_LENGTH = 30;
const MAX_AVATAR_URL_LENGTH = 1024;
const SENSITIVE_FIELDS = ['password', 'passwordHash', 'passwordSalt', 'resetToken', 'accessToken', 'refreshToken'];

function sanitizeUser(user) {
  const result = Object.assign({}, user);
  SENSITIVE_FIELDS.forEach((key) => delete result[key]);
  return result;
}

// Mini-program users created by WeChat login must set a real profile before entry.
// Identity comes only from the trusted WeChat context, so a client cannot edit another account.
exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) {
    return { success: false, code: 'NO_OPENID', message: '无法获取微信身份，请重新登录' };
  }

  const nickName = typeof event.nickName === 'string' ? event.nickName.trim() : '';
  if (!nickName) {
    return { success: false, code: 'MISSING_NICKNAME', message: '请填写昵称' };
  }
  if (nickName.length > MAX_NICKNAME_LENGTH) {
    return { success: false, code: 'INVALID_NICKNAME', message: '昵称不能超过30个字符' };
  }

  const avatarUrl = typeof event.avatarUrl === 'string' ? event.avatarUrl.trim() : '';
  if (avatarUrl.length > MAX_AVATAR_URL_LENGTH) {
    return { success: false, code: 'INVALID_AVATAR', message: '头像地址无效' };
  }

  const updateData = {
    nickName,
    profileCompleted: true,
    updatedAt: new Date()
  };
  if (avatarUrl) {
    updateData.avatarUrl = avatarUrl;
  }

  try {
    const updateResult = await db.collection('users').where({ _openid: OPENID }).update({ data: updateData });
    if (!updateResult.stats || updateResult.stats.updated < 1) {
      return { success: false, code: 'USER_NOT_FOUND', message: '账号不存在，请重新登录' };
    }

    const refreshed = await db.collection('users').where({ _openid: OPENID }).limit(1).get();
    const userInfo = refreshed.data && refreshed.data[0] ? sanitizeUser(refreshed.data[0]) : null;
    return { success: true, message: '资料已保存', userInfo };
  } catch (error) {
    console.error('[completeProfile] update failed:', error && error.message ? error.message : error);
    return { success: false, code: 'UPDATE_FAILED', message: '保存失败，请稍后重试' };
  }
};
