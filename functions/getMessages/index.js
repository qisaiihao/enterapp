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

  const { skip = 0, limit = 10, type = null, contentFilter = null } = event;

  try {
    // 构建查询条件
    let whereCondition = {
      toUserId: openid
    };
    
    // 如果指定了消息类型，添加类型过滤
    if (type && ['like', 'comment', 'favorite', 'follow', 'feedback', 'feedback_processed'].includes(type)) {
      whereCondition.type = type;
    }
    
    // 如果指定了内容筛选，添加内容类型过滤
    if (contentFilter && contentFilter !== 'all') {
      if (contentFilter === 'post') {
        // 只看帖子 - 排除讨论类型的消息
        whereCondition.contentType = { $ne: 'discussion' };
      } else if (contentFilter === 'original') {
        // 原创诗歌
        whereCondition.contentType = 'original';
      } else if (contentFilter === 'non-original') {
        // 非原创
        whereCondition.contentType = 'non-original';
      } else if (contentFilter === 'discussion') {
        // 讨论
        whereCondition.contentType = 'discussion';
      }
    }
    
    // 查询消息列表
    const messagesResult = await db.collection('messages')
      .where(whereCondition)
      .orderBy('createTime', 'desc')
      .skip(skip)
      .limit(limit)
      .get();
    
    // 查询未读消息数量
    const unreadCountResult = await db.collection('messages')
      .where({
        toUserId: openid,
        isRead: false
      })
      .count();
    
    // 获取发送者信息
    const fromUserIds = messagesResult.data.map(msg => msg.fromUserId);
    let userInfoMap = {};
    
    if (fromUserIds.length > 0) {
      const uniqueUserIds = [...new Set(fromUserIds)];
      const usersResult = await db.collection('users')
        .where({
          _openid: _.in(uniqueUserIds)
        })
        .field({
          _openid: true,
          nickName: true,
          avatarUrl: true
        })
        .get();
      
      userInfoMap = usersResult.data.reduce((map, user) => {
        map[user._openid] = user;
        return map;
      }, {});
    }
    
    // 补充发送者信息
    const messages = messagesResult.data.map(msg => {
      const userInfo = userInfoMap[msg.fromUserId] || {};
      return {
        ...msg,
        fromUserName: userInfo.nickName || '微信用户',
        fromUserAvatar: userInfo.avatarUrl || ''
      };
    });
    
    return {
      success: true,
      messages: messages,
      totalCount: unreadCountResult.total,
      unreadCount: unreadCountResult.total
    };
    
  } catch (error) {
    console.error('获取消息失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
};