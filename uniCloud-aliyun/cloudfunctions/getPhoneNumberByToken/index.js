'use strict';
exports.main = async (event, context) => {
  // event为客户端上传的参数，其中应包含 access_token 和 openid
  const { access_token, openid } = event;

  if (!access_token || !openid) {
    return {
      code: 1001,
      message: '缺少关键参数'
    }
  }

  try {
    // 新版 uniCloud 不需要 apiKey 和 apiSecret
    const res = await uniCloud.getPhoneNumber({
      provider: 'univerify',
      appid: context.APPID, // 客户端callFunction时携带的AppId信息
      access_token: access_token,
      openid: openid
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


