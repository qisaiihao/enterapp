const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

async function syncFolderCount(folderId) {
  if (!folderId) return;

  const countResult = await db.collection('portfolio_items').where({
    folderId
  }).count();
  const exactCount = Number(countResult.total) || 0;

  await db.collection('portfolio_folders').doc(folderId).update({
    data: {
      itemCount: exactCount,
      postCount: exactCount,
      updateTime: new Date()
    }
  });
}

exports.main = async (event) => {
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

    const portfolioItem = await db.collection('portfolio_items').doc(portfolioId).get();
    if (!portfolioItem.data) {
      return {
        success: false,
        message: '作品集项目不存在'
      };
    }

    const folderId = portfolioItem.data.folderId;

    await db.collection('portfolio_items').doc(portfolioId).remove();
    await syncFolderCount(folderId);

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
