const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

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

  try {
    // 查询未读消息数量
    const result = await db.collection('messages')
      .where({
        toUserId: openid,
        isRead: false
      })
      .count();
    
    return {
      success: true,
      count: result.total || 0
    };
    
  } catch (error) {
    console.error('获取未读消息数量失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
};