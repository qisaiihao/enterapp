const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// 可编辑的字段（根据实际需求可拓展）
const EDITABLE_KEYS = [
  'title',
  'content',
  'tags',
  'fileIDs',
  'backgroundColor',
  'textColor',
  'highlightSentence',
  'isAnonymous',
  'anonymousAuthorName',
];

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = event.openid || wxContext.OPENID;
  const postId = event.postId;
  const input = event.data || {};

  if (!openid || !postId) {
    return {
      success: false,
      code: 'INVALID_PARAMS',
      message: '用户未登录或参数不完整'
    };
  }

  // 只抽取支持修改的key
  const updateData = {};
  EDITABLE_KEYS.forEach(key => {
    if (input[key] !== undefined) {
      updateData[key] = input[key];
    }
  });
  updateData.updateTime = new Date();

  try {
    // 只能作者本人修改
    const oldRes = await db.collection('posts').doc(postId).get();
    const post = oldRes.data;
    if (!post) {
      return { success: false, code: 'NOT_FOUND', message: '帖子不存在' };
    }
    if (post._openid !== openid) {
      return { success: false, code: 'FORBIDDEN', message: '无权编辑该帖子' };
    }
    // 执行更新
    await db.collection('posts').doc(postId).update({ data: updateData });
    return { success: true, postId, updateFields: Object.keys(updateData) };
  } catch (e) {
    return { success: false, code: 'ERROR', message: e.message };
  }
};
