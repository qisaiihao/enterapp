// 从作品集中移除项目的云函数
// 基于removeFromFavorite逻辑修改
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID || event.openid;
  const { portfolioId } = event;

  if (!openid) {
    return {
      success: false,
      message: '无法获取用户 openid，请重新登录',
      code: 'NO_OPENID'
    };
  }

  try {
    if (!portfolioId) {
      return {
        success: false,
        message: '作品集项目ID不能为空'
      };
    }

    // 首先获取作品集项目信息，以便更新作品集计数
    const portfolioItem = await db.collection('portfolio_items').doc(portfolioId).get();
    if (!portfolioItem.data) {
      return {
        success: false,
        message: '作品集项目不存在'
      };
    }

    const folderId = portfolioItem.data.folderId;

    // 删除作品集项目
    await db.collection('portfolio_items').doc(portfolioId).remove();

    // 更新作品集的项目数量
    if (folderId) {
      await db.collection('portfolio_folders').doc(folderId).update({
        data: {
          itemCount: db.command.inc(-1),
          updateTime: new Date()
        }
      });
    }

    return {
      success: true,
      message: '从作品集移除成功'
    };
  } catch (error) {
    console.error('从作品集移除失败:', error);
    return {
      success: false,
      message: '从作品集移除失败',
      error: error.message
    };
  }
};