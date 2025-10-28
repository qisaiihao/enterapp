// 删除收藏夹云函数
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  // 优先使用前端传递的openid，如果没有则使用当前微信openid
  const openid = event.openid || wxContext.OPENID;

  console.log('【deleteFavoriteFolder】开始删除收藏夹:', {
    openid,
    folderId: event.folderId
  });

  if (!openid) {
    return {
      success: false,
      message: '无法获取用户 openid，请重新登录',
      code: 'NO_OPENID'
    };
  }

  try {
    const { folderId } = event;
    
    if (!folderId) {
      return {
        success: false,
        message: '收藏夹ID不能为空'
      };
    }

    // 检查收藏夹是否存在且属于当前用户
    const folderResult = await db.collection('favorite_folders').where({
      _id: folderId,
      _openid: openid
    }).get();

    if (folderResult.data.length === 0) {
      return {
        success: false,
        message: '收藏夹不存在或无权限删除'
      };
    }

    const folder = folderResult.data[0];
    
    // 检查是否为默认收藏夹
    if (folder.isDefault) {
      return {
        success: false,
        message: '默认收藏夹不能删除'
      };
    }

    console.log('【deleteFavoriteFolder】准备删除收藏夹:', folder.name);

    // 开始事务删除
    const transaction = await db.startTransaction();
    
    try {
      // 1. 删除收藏夹中的所有收藏项
      const favoritesResult = await transaction.collection('favorites').where({
        folderId: folderId,
        _openid: openid
      }).get();

      if (favoritesResult.data.length > 0) {
        console.log('【deleteFavoriteFolder】删除收藏项数量:', favoritesResult.data.length);
        await transaction.collection('favorites').where({
          folderId: folderId,
          _openid: openid
        }).remove();
      }

      // 2. 删除收藏夹
      await transaction.collection('favorite_folders').doc(folderId).remove();

      // 提交事务
      await transaction.commit();

      console.log('【deleteFavoriteFolder】删除成功:', folder.name);

      return {
        success: true,
        message: '收藏夹删除成功',
        deletedItems: favoritesResult.data.length
      };
    } catch (transactionError) {
      // 回滚事务
      await transaction.rollback();
      throw transactionError;
    }
  } catch (error) {
    console.error('【deleteFavoriteFolder】删除收藏夹失败:', error);
    return {
      success: false,
      message: '删除收藏夹失败',
      error: error.message
    };
  }
};
