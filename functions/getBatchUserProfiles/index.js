// 批量获取用户信息云函数
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID || event.openid;

  if (!openid) {
    return {
      success: false,
      message: '无法获取用户 openid，请重新登录',
      code: 'NO_OPENID'
    };
  }

  const { userIds, rawAvatar = false } = event;

  if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
    return {
      success: false,
      message: '用户ID列表不能为空'
    };
  }

  const ids = [...new Set(userIds.filter(id => typeof id === 'string' && id.trim()))];
  if (!ids.length || ids.length > 100) {
    return { success: false, message: '用户ID数量须为 1 到 100' };
  }

  try {
    // 批量获取用户信息
    // 使用公开字段白名单，禁止整条用户记录（密码、手机号等）离开服务端。
    // 显式分页，避免数据库默认条数限制让批量结果静默缺失。
    const publicFields = { _id: 1, _openid: 1, nickName: 1, avatarUrl: 1, bio: 1 };
    const userProfiles = [];
    for (let offset = 0; offset < ids.length; offset += 20) {
      const usersRes = await db.collection('users')
        .where({ _openid: _.in(ids.slice(offset, offset + 20)) })
        .field(publicFields)
        .limit(100)
        .get();
      for (const user of usersRes.data || []) {
        const profile = {};
        Object.keys(publicFields).forEach(key => {
          if (Object.prototype.hasOwnProperty.call(user, key)) profile[key] = user[key];
        });
        if (typeof profile.avatarUrl === 'string' && profile.avatarUrl.startsWith('cloud://')) {
          profile.avatarFileID = profile.avatarUrl;
        }
        userProfiles.push(profile);
      }
    }

    // 处理头像URL
    // 新客户端统一批量换链；旧客户端仍收到可显示的临时 URL。
    if (rawAvatar !== true) await enrichAvatarUrls(userProfiles);

    return {
      success: true,
      userProfiles: userProfiles
    };
  } catch (error) {
    console.error('批量获取用户信息失败:', error);
    return {
      success: false,
      message: '获取用户信息失败',
      error: error.message
    };
  }
};

// 处理头像URL
async function enrichAvatarUrls(users) {
  const fileIDs = Array.from(new Set(
    users
      .filter(user => user.avatarUrl && user.avatarUrl.startsWith('cloud://'))
      .map(user => user.avatarUrl)
  ));

  if (fileIDs.length === 0) {
    return;
  }

  try {
    const urlMap = new Map();
    for (let offset = 0; offset < fileIDs.length; offset += 50) {
      const tempUrls = await cloud.getTempFileURL({ fileList: fileIDs.slice(offset, offset + 50) });
      (tempUrls.fileList || []).forEach(file => {
        if (file.status === 0 && file.tempFileURL) urlMap.set(file.fileID, file.tempFileURL);
      });
    }

    users.forEach(user => {
      if (user.avatarUrl && urlMap.has(user.avatarUrl)) {
        user.avatarUrl = urlMap.get(user.avatarUrl);
      }
    });
  } catch (error) {
    console.error('头像URL转换失败:', error);
  }
}
