// 添加帖子到作品集的云函数
// 基于addToFavorite逻辑修改
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID || event.openid;
  const { postId, folderId } = event;

  if (!openid) {
    return {
      success: false,
      message: '无法获取用户 openid，请重新登录',
      code: 'NO_OPENID'
    };
  }

  try {
    if (!postId || !folderId) {
      return {
        success: false,
        message: '参数不完整'
      };
    }

    // 检查是否已经添加过
    const existingPortfolio = await db.collection('portfolio_items').where({
      _openid: openid,
      postId: postId,
      folderId: folderId
    }).get();

    if (existingPortfolio.data.length > 0) {
      return {
        success: false,
        message: '已经添加过了'
      };
    }

    // 添加到作品集
    const result = await db.collection('portfolio_items').add({
      data: {
        _openid: openid,
        postId: postId,
        folderId: folderId,
        createTime: new Date()
      }
    });

    // 更新作品集的项目数量
    await db.collection('portfolio_folders').doc(folderId).update({
      data: {
        itemCount: db.command.inc(1),
        updateTime: new Date()
      }
    });

    return {
      success: true,
      portfolioId: result._id,
      message: '添加到作品集成功'
    };
  } catch (error) {
    console.error('添加到作品集失败:', error);
    return {
      success: false,
      message: '添加到作品集失败',
      error: error.message
    };
  }
};