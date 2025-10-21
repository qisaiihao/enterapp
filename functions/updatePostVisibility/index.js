// 更新帖子可见性（隐藏/取消隐藏）
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = event.openid || wxContext.OPENID;
  const { postId, hidden } = event || {};

  if (!openid) {
    return { success: false, code: 'NO_OPENID', message: '无法获取用户身份' };
  }
  if (!postId || typeof hidden !== 'boolean') {
    return { success: false, code: 'INVALID_PARAMS', message: '参数不完整' };
  }

  try {
    const postRes = await db.collection('posts').doc(postId).get();
    const post = postRes && postRes.data;
    if (!post) {
      return { success: false, code: 'NOT_FOUND', message: '帖子不存在' };
    }
    if (post._openid !== openid) {
      return { success: false, code: 'FORBIDDEN', message: '无权操作该帖子' };
    }

    await db.collection('posts').doc(postId).update({
      data: { isHidden: hidden, updateTime: new Date() }
    });

    return { success: true, postId, isHidden: hidden };
  } catch (e) {
    return { success: false, code: 'ERROR', message: e.message };
  }
};

