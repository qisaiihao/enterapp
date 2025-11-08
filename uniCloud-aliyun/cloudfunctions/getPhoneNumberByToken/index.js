'use strict';
exports.main = async (event, context) => {
  // ==================== 🚀 参数修改 ====================
  // 除了 univerify 的凭证，如果用户已登录，还需要传递腾讯云用户系统中的唯一标识 openid
  const { access_token, openid: univerifyOpenid, userOpenid } = event;

  // 1. 参数校验（userOpenid 是可选的，如果没有则只返回手机号，不同步到数据库）
  if (!access_token || !univerifyOpenid) {
    return {
      code: 1001,
      message: '缺少关键参数，请确保 access_token 和 openid 都已提供'
    }
  }

  try {
    // 2. 使用凭证在云端获取手机号 (这部分逻辑和原来一致)
    console.log('🔍 [uniCloud] 开始调用 getPhoneNumber');
    const phoneRes = await uniCloud.getPhoneNumber({
      provider: 'univerify',
      appid: context.APPID,
      access_token: access_token,
      openid: univerifyOpenid
    });
    console.log('🔍 [uniCloud] getPhoneNumber 响应:', phoneRes);

    // 检查手机号是否获取成功
    if (phoneRes.code !== 0 || !phoneRes.phoneNumber) {
      return {
        code: phoneRes.code || 5001,
        message: phoneRes.message || '获取手机号失败'
      }
    }
    
    const phoneNumber = phoneRes.phoneNumber;
    console.log(`✅ [uniCloud] 成功获取手机号: ${phoneNumber.substring(0, 3)}********`);

    // ==================== 🚀 核心改造：发起 HTTP 请求到腾讯云 ====================
    // 如果提供了 userOpenid，则同步到腾讯云数据库；否则只返回手机号
    if (userOpenid) {
      console.log('🚀 [uniCloud] 准备同步手机号到腾讯云...');
      
      // 腾讯云 updateUser 函数的 HTTP 触发 URL
      const TCB_FUNCTION_URL = 'https://cloud1-5gb0pbyl400845f5-1378788263.ap-shanghai.app.tcloudbase.com/updateUser';
      // ⚠️ 密钥必须与腾讯云函数中设置的密钥完全一致（建议使用环境变量）
      const TCB_SECRET_KEY = process.env.TCB_SECRET_KEY || 'Your-Custom-Secret-Key-123';

      console.log('🔍 [uniCloud] 请求 URL:', TCB_FUNCTION_URL);
      console.log('🔍 [uniCloud] 请求参数:', {
        openid: userOpenid,
        phoneNumber: phoneNumber.substring(0, 3) + '********',
        secretKey: '***'
      });

      try {
        const httpRes = await uniCloud.httpclient.request(TCB_FUNCTION_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          data: JSON.stringify({
            // 发送给 updateUser 函数的业务数据
            openid: userOpenid, // 这是腾讯云用户系统的 openid
            phoneNumber: phoneNumber,
            // 用于安全校验的密钥
            secretKey: TCB_SECRET_KEY
          }),
          dataType: 'json',
          timeout: 10000 // 10秒超时
        });
        
        console.log('🔍 [uniCloud] 腾讯云接口响应状态:', httpRes.status);
        console.log('🔍 [uniCloud] 腾讯云接口响应数据:', httpRes.data);

        // 解析响应数据
        let responseData = httpRes.data;
        if (typeof responseData === 'string') {
          try {
            responseData = JSON.parse(responseData);
          } catch (e) {
            console.error('❌ [uniCloud] 响应数据解析失败:', e);
          }
        }

        // 根据腾讯云的返回结果，向客户端响应最终状态
        const isSuccess = httpRes.status === 200 && responseData && responseData.success === true;

        if (isSuccess) {
          console.log('✅ [uniCloud] 同步成功');
          return {
            code: 0,
            message: '手机号授权并同步成功',
            phoneNumber: phoneNumber, // 返回手机号，供前端使用
            data: responseData
          };
        } else {
          console.error('❌ [uniCloud] 同步失败:', responseData);
          return {
            code: 5002,
            message: responseData?.message || '手机号同步到业务后台失败',
            error: responseData,
            phoneNumber: phoneNumber // 即使同步失败，也返回手机号
          };
        }
      } catch (httpError) {
        console.error('❌ [uniCloud] HTTP 请求失败:', httpError);
        return {
          code: 5003,
          message: '同步请求失败：' + (httpError.message || '网络错误'),
          error: httpError.message,
          phoneNumber: phoneNumber // 即使请求失败，也返回手机号
        };
      }
    } else {
      // 没有 userOpenid，只返回手机号（用于注册场景）
      console.log('ℹ️ [uniCloud] 未提供 userOpenid，仅返回手机号');
      return {
        code: 0,
        message: '获取手机号成功',
        phoneNumber: phoneNumber
      };
    }
    // =======================================================================

  } catch (error) {
    console.error('❌ [uniCloud] 云函数执行异常:', error);
    return {
      code: 5000,
      message: '云函数执行异常：' + (error.message || '未知错误')
    }
  }
};