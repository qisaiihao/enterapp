const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID || event.openid;
  const { folderId, name, coverUrl } = event;

  console.log('【updateFavoriteFolder云函数】收到参数:', { openid, folderId, name, coverUrl });

  if (!openid) {
    return { success: false, message: '用户未登录' };
  }

  if (!folderId) {
    return { success: false, message: '收藏夹ID不能为空' };
  }

  if (!name || name.trim() === '') {
    return { success: false, message: '收藏夹名称不能为空' };
  }

  try {
    // 检查收藏夹是否存在且属于当前用户
    const folder = await db.collection('favorite_folders').doc(folderId).get();
    if (!folder.data || folder.data._openid !== openid) {
      return { success: false, message: '收藏夹不存在或无权限修改' };
    }

    const trimmedName = name.trim();

    // 检查是否与默认收藏夹名称冲突
    if (trimmedName === '我的收藏') {
      return { success: false, message: '该名称已被系统使用，请选择其他名称' };
    }

    // 检查是否与其他收藏夹名称冲突（排除当前收藏夹）
    const existingFolder = await db.collection('favorite_folders').where({
      _openid: openid,
      name: trimmedName,
      _id: db.command.neq(folderId)
    }).get();

    if (existingFolder.data.length > 0) {
      return { success: false, message: '收藏夹名称已存在' };
    }

    // 准备更新数据
    const updateData = {
      name: trimmedName,
      updateTime: new Date()
    };

    // 如果有封面URL，添加到更新数据中
    if (coverUrl !== undefined) {
      if (coverUrl) {
        updateData.coverUrl = coverUrl;
        console.log('【updateFavoriteFolder云函数】更新封面URL:', coverUrl);
      } else {
        // 如果coverUrl为空字符串，表示删除封面
        updateData.coverUrl = null;
        console.log('【updateFavoriteFolder云函数】删除封面');
      }
    }

    console.log('【updateFavoriteFolder云函数】准备更新的数据:', updateData);

    // 更新收藏夹
    const result = await db.collection('favorite_folders').doc(folderId).update({
      data: updateData
    });

    console.log('【updateFavoriteFolder云函数】更新结果:', result);

    return { 
      success: true, 
      message: '收藏夹更新成功',
      updatedCount: result.stats.updated
    };
  } catch (error) {
    console.error('【updateFavoriteFolder云函数】更新收藏夹失败:', error);
    return { 
      success: false, 
      message: '更新收藏夹失败', 
      error: error.message 
    };
  }
};
