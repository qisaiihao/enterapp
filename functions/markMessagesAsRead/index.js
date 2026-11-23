const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

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

  const { messageIds, markAll } = event;

  try {
    if (markAll === true) {
      // 云函数端单次 update 有条数上限，循环直到没有未读消息可更新
      let updated = 0;
      for (let attempt = 0; attempt < 100; attempt += 1) {
        const batch = await db.collection('messages')
          .where({
            toUserId: openid,
            // 兼容历史数据：只排除明确已读的，isRead 缺失也一并标记
            isRead: _.neq(true)
          })
          .update({
            data: {
              isRead: true,
              readTime: new Date()
            }
          });
        const count = (batch.stats && batch.stats.updated) || 0;
        updated += count;
        if (count === 0) break;
      }

      return {
        success: true,
        updated
      };
    }

    if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
      return {
        success: false,
        error: '消息ID列表不能为空'
      };
    }

    // 批量更新消息为已读
    const result = await db.collection('messages')
      .where({
        _id: _.in(messageIds),
        toUserId: openid,
        isRead: _.neq(true)
      })
      .update({
        data: {
          isRead: true,
          readTime: new Date()
        }
      });
    
    return {
      success: true,
      updated: result.stats.updated || 0
    };
    
  } catch (error) {
    console.error('标记消息已读失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
};
