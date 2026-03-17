// 云函数入口文件
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { phoneNumber } = event;

  console.log('🔍 [loginWithPhone] 收到手机号登录请求:', { phoneNumber: phoneNumber ? phoneNumber.substring(0, 3) + '****' : 'undefined' });

  if (!phoneNumber) {
    return {
      success: false,
      message: '手机号不能为空',
      code: 'MISSING_PHONE'
    };
  }

  // 验证手机号格式
  const phoneRegex = /^1[3-9]\d{9}$/;
  if (!phoneRegex.test(phoneNumber)) {
    return {
      success: false,
      message: '请输入正确的手机号格式',
      code: 'INVALID_PHONE'
    };
  }

  try {
    // 根据手机号查询用户
    const userRes = await db.collection('users').where({
      phoneNumber: phoneNumber
    }).get();

    console.log('🔍 [loginWithPhone] 查询结果:', userRes);

    if (userRes.data.length === 0) {
      return {
        success: false,
        message: '该手机号尚未注册，请先注册',
        code: 'PHONE_NOT_REGISTERED'
      };
    }

    const userInfo = userRes.data[0];
    const currentOpenid = wxContext.OPENID;

    console.log('✅ [loginWithPhone] 登录成功，用户信息:', {
      _openid: userInfo._openid,
      nickName: userInfo.nickName,
      phoneNumber: userInfo.phoneNumber ? userInfo.phoneNumber.substring(0, 3) + '****' : 'none',
      currentOpenid: currentOpenid
    });

    // 检测 openid 是否不同（但不自动更新）
    const needBindWechat = currentOpenid && currentOpenid !== userInfo._openid;
    
    if (needBindWechat) {
      console.log('⚠️ [loginWithPhone] 检测到 openid 不同，需要用户确认绑定');
    }

    // 返回用户信息，但不包含密码
    const { password: _, ...safeUserInfo } = userInfo;

    // 判断是否已验证手机号（应该为true，因为是手机号登录）
    const isPhoneVerified = !!(safeUserInfo.phoneNumber && safeUserInfo.phoneNumber.trim());

    return {
      success: true,
      message: '登录成功',
      userInfo: safeUserInfo,
      openid: userInfo._openid, // 返回数据库中的 openid
      currentOpenid: currentOpenid, // 返回当前微信的 openid
      needBindWechat: needBindWechat, // 是否需要绑定微信
      isPhoneVerified: isPhoneVerified
    };

  } catch (error) {
    console.error('❌ [loginWithPhone] 登录失败:', error);
    return {
      success: false,
      message: '登录失败，请重试',
      code: 'LOGIN_ERROR',
      error: error.message
    };
  }
};