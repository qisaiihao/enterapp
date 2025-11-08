// 云函数入口文件
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { poemId, password } = event;

  console.log('🔍 [loginWithCredentials] 收到登录请求:', { poemId, password: password ? '***' : 'undefined' });

  if (!poemId || !password) {
    return {
      success: false,
      message: 'Poem ID和密码不能为空',
      code: 'MISSING_CREDENTIALS'
    };
  }

  try {
    // 查询用户是否存在
    const userRes = await db.collection('users').where({
      poemId: poemId,
      password: password
    }).get();

    console.log('🔍 [loginWithCredentials] 查询结果:', userRes);

    if (userRes.data.length === 0) {
      return {
        success: false,
        message: '账号或密码错误',
        code: 'INVALID_CREDENTIALS'
      };
    }

    const userInfo = userRes.data[0];
    const currentOpenid = wxContext.OPENID;
    
    console.log('✅ [loginWithCredentials] 登录成功，用户信息:', {
      _openid: userInfo._openid,
      nickName: userInfo.nickName,
      poemId: userInfo.poemId,
      currentOpenid: currentOpenid
    });

    // 如果当前openid与数据库中的openid不同，更新数据库中的openid
    if (currentOpenid && currentOpenid !== userInfo._openid) {
      console.log('🔄 [loginWithCredentials] 检测到openid变化，更新数据库中的openid');
      try {
        await db.collection('users').doc(userInfo._id).update({
          data: {
            _openid: currentOpenid,
            updateTime: new Date()
          }
        });
        console.log('✅ [loginWithCredentials] openid更新成功');
        
        // 更新用户信息中的openid
        userInfo._openid = currentOpenid;
      } catch (updateError) {
        console.error('❌ [loginWithCredentials] openid更新失败:', updateError);
        // 即使更新失败，也继续登录流程
      }
    }

    // 返回用户信息，但不包含密码
    const { password: _, ...safeUserInfo } = userInfo;

    // 判断是否已验证手机号：检查 phoneNumber 字段是否存在且不为空
    const isPhoneVerified = !!(safeUserInfo.phoneNumber && safeUserInfo.phoneNumber.trim());

    return {
      success: true,
      message: '登录成功',
      userInfo: safeUserInfo,
      openid: currentOpenid || userInfo._openid,
      isPhoneVerified: isPhoneVerified
    };

  } catch (error) {
    console.error('❌ [loginWithCredentials] 登录失败:', error);
    return {
      success: false,
      message: '登录失败，请重试',
      code: 'LOGIN_ERROR',
      error: error.message
    };
  }
};
