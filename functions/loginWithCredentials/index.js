const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { poemId, password } = event;

  console.log('[loginWithCredentials] request:', {
    poemId,
    password: password ? '***' : 'undefined'
  });

  if (!poemId || !password) {
    return {
      success: false,
      message: 'Poem ID和密码不能为空',
      code: 'MISSING_CREDENTIALS'
    };
  }

  try {
    const userRes = await db.collection('users').where({
      poemId,
      password
    }).get();

    console.log('[loginWithCredentials] query result count:', userRes.data.length);

    if (userRes.data.length === 0) {
      return {
        success: false,
        message: '账号或密码错误',
        code: 'INVALID_CREDENTIALS'
      };
    }

    const userInfo = userRes.data[0];
    const currentOpenid = wxContext.OPENID || null;

    console.log('[loginWithCredentials] login success before normalize:', {
      dbOpenid: userInfo._openid,
      currentOpenid,
      poemId: userInfo.poemId,
      nickName: userInfo.nickName
    });

    // 仅在历史数据缺少 _openid 时补齐，避免不同平台登录相互覆盖账号锚点
    if (!userInfo._openid && currentOpenid) {
      try {
        await db.collection('users').doc(userInfo._id).update({
          data: {
            _openid: currentOpenid,
            updateTime: new Date()
          }
        });
        userInfo._openid = currentOpenid;
        console.log('[loginWithCredentials] filled missing _openid with currentOpenid');
      } catch (updateError) {
        console.error('[loginWithCredentials] failed to fill missing _openid:', updateError);
      }
    } else if (currentOpenid && userInfo._openid && currentOpenid !== userInfo._openid) {
      console.log('[loginWithCredentials] openid mismatch detected, keep db _openid unchanged');
    }

    const { password: _, ...safeUserInfo } = userInfo;
    const resolvedOpenid = safeUserInfo._openid || currentOpenid;
    const isPhoneVerified = !!(safeUserInfo.phoneNumber && safeUserInfo.phoneNumber.trim());

    return {
      success: true,
      message: '登录成功',
      userInfo: safeUserInfo,
      openid: resolvedOpenid,
      isPhoneVerified
    };
  } catch (error) {
    console.error('[loginWithCredentials] error:', error);
    return {
      success: false,
      message: '登录失败，请重试',
      code: 'LOGIN_ERROR',
      error: error.message
    };
  }
};
