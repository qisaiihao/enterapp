// 云函数入口文件
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { account, poemId, password } = event || {};
  // 旧客户端及 GitHub 绑定仍传 poemId，仅按 Poem ID 验证。
  const isAccountLogin = account !== undefined;
  const rawIdentifier = isAccountLogin ? account : poemId;
  const identifier = typeof rawIdentifier === 'string' ? rawIdentifier.trim() : '';

  if (!identifier || typeof password !== 'string' || !password.trim()) {
    return {
      success: false,
      message: '账号和密码不能为空',
      code: 'MISSING_CREDENTIALS'
    };
  }

  try {
    // 先确定账号，再校验密码；不同字段重合时不因密码错误回退到另一用户。
    const fields = isAccountLogin ? ['poemId', 'phoneNumber', 'nickName'] : ['poemId'];
    let candidates = [];
    for (const field of fields) {
      const userRes = await db.collection('users').where({
        [field]: identifier
      }).limit(2).get();
      candidates = userRes.data;
      if (candidates.length > 0) break;
    }

    if (candidates.length > 1) {
      return {
        success: false,
        message: '账号存在重名，请使用唯一的 Poem ID 或绑定手机号登录',
        code: 'AMBIGUOUS_ACCOUNT'
      };
    }

    if (candidates.length === 0 || candidates[0].password !== password) {
      return {
        success: false,
        message: '账号或密码错误',
        code: 'INVALID_CREDENTIALS'
      };
    }

    const userInfo = candidates[0];
    const currentOpenid = wxContext.OPENID;
    
    console.log('✅ [loginWithCredentials] 登录成功，用户信息:', {
      _openid: userInfo._openid,
      nickName: userInfo.nickName,
      poemId: userInfo.poemId,
      currentOpenid: currentOpenid
    });

    // 检测 openid 是否不同（但不自动更新）
    const needBindWechat = currentOpenid && currentOpenid !== userInfo._openid;
    
    if (needBindWechat) {
      console.log('⚠️ [loginWithCredentials] 检测到 openid 不同，需要用户确认绑定');
    }

    // 返回用户信息，但不包含密码
    const { password: _, ...safeUserInfo } = userInfo;

    // 判断是否已验证手机号：检查 phoneNumber 字段是否存在且不为空
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
    console.error('❌ [loginWithCredentials] 登录失败:', error);
    return {
      success: false,
      message: '登录失败，请重试',
      code: 'LOGIN_ERROR',
      error: error.message
    };
  }
};
