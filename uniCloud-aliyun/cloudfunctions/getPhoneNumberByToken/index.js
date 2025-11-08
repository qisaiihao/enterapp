'use strict';
exports.main = async (event, context) => {
  // 此云函数仅用于获取手机号，不需要用户在 uniCloud 服务空间下登录
  // event为客户端上传的参数，其中应包含 access_token 和 openid（univerify 返回的）
  const { access_token, openid: univerifyOpenid } = event;

  if (!access_token) {
    return {
      code: 1001,
      message: '缺少关键参数: access_token'
    }
  }

  if (!univerifyOpenid) {
    return {
      code: 1002,
      message: '缺少关键参数: openid（univerify 返回的 openid）'
    }
  }

  try {
    // uniCloud.getPhoneNumber 只需要 univerify 返回的 access_token 和 openid
    // 不需要 context.OPENID（服务空间下的用户标识）
    const res = await uniCloud.getPhoneNumber({
      provider: 'univerify',
      appid: context.APPID, // 客户端callFunction时携带的AppId信息
      access_token: access_token,
      openid: univerifyOpenid // 使用 univerify 返回的 openid
    });

    if (res.code === 0 && res.phoneNumber) {
      // 获取手机号成功，直接返回给客户端
      return {
        code: 0,
        message: '获取手机号成功',
        phoneNumber: res.phoneNumber
      }
    } else {
      // 获取手机号失败
      return {
        code: res.code || 500,
        message: res.message || '获取手机号失败'
      }
    }
  } catch (error) {
    console.error('❌ [getPhoneNumberByToken] 获取手机号失败:', error);
    return {
      code: 500,
      message: '获取手机号失败：' + (error.message || '未知错误')
    }
  }
};


