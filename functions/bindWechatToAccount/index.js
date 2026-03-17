// 云函数：bindWechatToAccount
// 功能：将当前微信 openid 绑定到用户账号（不修改 _openid，只添加 wechatOpenId）

const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { poemId, forceRebind } = event;
  const wechatOpenId = wxContext.OPENID;
  
  console.log('🔍 [bindWechatToAccount] 开始绑定微信到账号');
  console.log('🔍 [bindWechatToAccount] 参数:', { poemId, wechatOpenId, forceRebind });
  
  if (!poemId || !wechatOpenId) {
    return {
      success: false,
      message: '参数错误：缺少必要参数'
    };
  }
  
  try {
    // 1. 查找用户账号
    const userRes = await db.collection('users').where({
      poemId: poemId
    }).get();
    
    if (userRes.data.length === 0) {
      return {
        success: false,
        message: '用户不存在'
      };
    }
    
    const user = userRes.data[0];
    
    // 2. 检查该微信是否已绑定到其他账号
    const existingBindRes = await db.collection('users').where({
      wechatOpenId: wechatOpenId
    }).get();
    
    if (existingBindRes.data.length > 0 && existingBindRes.data[0]._id !== user._id) {
      const oldUser = existingBindRes.data[0];
      
      // 如果不是强制重新绑定，返回提示信息
      if (!forceRebind) {
        console.log('⚠️ [bindWechatToAccount] 该微信已绑定到其他账号，需要用户确认');
        return {
          success: false,
          message: '该微信已绑定到其他账号',
          code: 'WECHAT_ALREADY_BOUND',
          boundAccount: {
            poemId: oldUser.poemId,
            nickName: oldUser.nickName
          }
        };
      }
      
      // 强制重新绑定：先解绑旧账号
      console.log('🔄 [bindWechatToAccount] 强制重新绑定，解绑旧账号:', oldUser.poemId);
      await db.collection('users').doc(oldUser._id).update({
        data: {
          wechatOpenId: db.command.remove(),
          updatedAt: new Date()
        }
      });
      console.log('✅ [bindWechatToAccount] 已解绑旧账号');
    }
    
    // 3. 更新用户的 wechatOpenId
    await db.collection('users').doc(user._id).update({
      data: {
        wechatOpenId: wechatOpenId,
        updatedAt: new Date()
      }
    });
    
    console.log('✅ [bindWechatToAccount] 绑定成功');
    
    return {
      success: true,
      message: '绑定成功',
      isRebind: forceRebind || false
    };
    
  } catch (error) {
    console.error('❌ [bindWechatToAccount] 绑定失败:', error);
    return {
      success: false,
      message: error.message || '绑定失败'
    };
  }
};
