const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj || {}, key);
}

exports.main = async (event = {}, context = {}) => {
  const wxContext = cloud.getWXContext();
  const callerOpenid = wxContext.OPENID
    || context.OPENID
    || (wxContext.claims && wxContext.claims.openid);
  const targetOpenid = event.openid || callerOpenid;

  if (!targetOpenid) {
    return {
      success: false,
      code: 'NO_OPENID',
      message: '无法获取用户 openid'
    };
  }

  if (callerOpenid && event.openid && event.openid !== callerOpenid) {
    return {
      success: false,
      code: 'FORBIDDEN',
      message: '不能同步其他用户的帖子资料'
    };
  }

  const updateData = {};

  if (hasOwn(event, 'nickName')) {
    const nickName = String(event.nickName || '').trim();
    if (nickName) {
      updateData.authorName = nickName;
      updateData.authorNameSnapshot = nickName;
    }
  }

  if (hasOwn(event, 'avatarUrl')) {
    const avatarUrl = event.avatarUrl || '';
    updateData.authorAvatar = avatarUrl;
    updateData.authorAvatarSnapshot = avatarUrl;
  }

  if (hasOwn(event, 'signatureUrl')) {
    updateData.authorSignature = event.signatureUrl || '';
  }

  if (Object.keys(updateData).length === 0) {
    return {
      success: true,
      updated: 0,
      message: '没有需要同步的字段'
    };
  }

  try {
    const result = await db.collection('posts')
      .where({
        _openid: targetOpenid,
        isAnonymous: _.neq(true)
      })
      .update({
        data: updateData
      });

    return {
      success: true,
      updated: result && result.stats ? result.stats.updated || 0 : 0,
      fields: Object.keys(updateData)
    };
  } catch (error) {
    console.error('[syncUserPostsMetadata] 同步历史帖子失败:', error);
    return {
      success: false,
      code: 'SYNC_FAILED',
      message: error.message || '同步历史帖子失败',
      error
    };
  }
};
