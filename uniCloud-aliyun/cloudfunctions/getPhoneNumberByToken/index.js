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

  const res = await uniCloud.getPhoneNumber({
    provider: 'univerify',
    apiKey: '【请替换为你的ApiKey】',      // 在DCloud开发者中心开通服务获取
    apiSecret: '【请替换为你的ApiSecret】', // 在DCloud开发者中心开通服务获取
    access_token: access_token,
    openid: openid
  });

  if (res.code === 0 && res.phoneNumber) {
    // 获取手机号成功
    const phoneNumber = res.phoneNumber;

    // ***************************************************************
    // 在这里将获取到的手机号发送给您的腾讯云开发后端
    // 推荐使用 uniCloud.httpclient 调用您腾讯云后端的API接口
    // 为确保安全，建议您的腾讯云接口有签名校验机制
    // ***************************************************************
    try {
      const tencentCloudApiUrl = '【你的腾讯云后端接收手机号的API地址】';
      const response = await uniCloud.httpclient.request(tencentCloudApiUrl, {
        method: 'POST',
        data: {
          phoneNumber: phoneNumber,
          // 可以添加其他需要的信息，例如 openid
        },
        dataType: 'json'
      });

      // 根据腾讯云后端的返回结果，判断是否成功
      if (response.data && response.data.success) {
         return {
            code: 0,
            message: '获取手机号并同步成功',
            // 出于安全考虑，通常不直接将手机号返回给前端
            // 而是由腾讯云后端生成 token，这里可以将 token 返回
            token: response.data.token
         }
      } else {
         throw new Error('同步到腾讯云后端失败');
      }
    } catch (e) {
      return {
        code: 500,
        message: '调用腾讯云后端接口失败：' + e.message
      }
    }

  } else {
    // 获取手机号失败
    return {
      code: res.code || 500,
      message: res.message || '获取手机号失败'
    }
  }
};


