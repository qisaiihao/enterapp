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

    const existingPortfolio = await db.collection('portfolio_items').where({
      _openid: openid,
      postId,
      folderId
    }).get();

    if (existingPortfolio.data.length > 0) {
      return {
        success: false,
        message: '已经添加过了'
      };
    }

    const result = await db.collection('portfolio_items').add({
      data: {
        _openid: openid,
        postId,
        folderId,
        createTime: new Date()
      }
    });

    await syncFolderCount(folderId);

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
