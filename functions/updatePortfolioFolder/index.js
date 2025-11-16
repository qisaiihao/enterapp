const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID || event.openid;
  const { folderId, name, coverUrl } = event;

  if (!openid) {
    return { success: false, message: '用户未登录' };
  }

  if (!folderId) {
    return { success: false, message: '作品集ID不能为空' };
  }

  if (!name || name.trim() === '') {
    return { success: false, message: '作品集名称不能为空' };
  }

  try {
    // 检查作品集是否存在且属于当前用户
    const folder = await db.collection('portfolio_folders').doc(folderId).get();
    if (!folder.data || folder.data._openid !== openid) {
      return { success: false, message: '作品集不存在或无权限修改' };
    }

    const trimmedName = name.trim();

    // 检查是否与默认作品集名称冲突
    if (trimmedName === '我的作品集') {
      return { success: false, message: '该名称已被系统使用，请选择其他名称' };
    }

    // 检查是否与其他作品集名称冲突（排除当前作品集）
    const existingFolder = await db.collection('portfolio_folders').where({
      _openid: openid,
      name: trimmedName,
      _id: db.command.neq(folderId)
    }).get();

    if (existingFolder.data.length > 0) {
      return { success: false, message: '作品集名称已存在' };
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
      } else {
        // 如果coverUrl为空字符串，表示删除封面
        updateData.coverUrl = null;
      }
    }

    // 更新作品集
    const result = await db.collection('portfolio_folders').doc(folderId).update({
      data: updateData
    });

    return { 
      success: true, 
      message: '作品集更新成功',
      updatedCount: result.stats.updated
    };
  } catch (error) {
    console.error('【updatePortfolioFolder云函数】更新作品集失败:', error);
    return { 
      success: false, 
      message: '更新作品集失败', 
      error: error.message 
    };
  }
};
