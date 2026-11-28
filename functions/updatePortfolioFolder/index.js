const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

function hasValidSortOrder(folder) {
  return folder && typeof folder.sortOrder === 'number' && Number.isFinite(folder.sortOrder);
}

function getFolderTimestamp(folder) {
  if (!folder || !folder.createTime) return 0;
  const ts = new Date(folder.createTime).getTime();
  return Number.isFinite(ts) ? ts : 0;
}

function sortFoldersByOrder(folders = []) {
  return folders.slice().sort((a, b) => {
    const aHas = hasValidSortOrder(a);
    const bHas = hasValidSortOrder(b);
    if (aHas && bHas) {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return getFolderTimestamp(b) - getFolderTimestamp(a);
    }
    if (!aHas && bHas) return -1;
    if (aHas && !bHas) return 1;
    return getFolderTimestamp(b) - getFolderTimestamp(a);
  });
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID || event.openid;
  const { folderId, name, coverUrl, action, folderIds } = event;

  if (!openid) {
    return { success: false, message: '用户未登录' };
  }

  if (action === 'updateOrder') {
    const requestedIds = Array.isArray(folderIds)
      ? folderIds.map(id => String(id || '').trim()).filter(Boolean)
      : [];
    if (requestedIds.length === 0) {
      return { success: false, message: '排序列表不能为空' };
    }

    try {
      const existing = await db.collection('portfolio_folders').where({
        _openid: openid
      }).get();
      const allOwned = existing.data || [];
      const ownedMap = new Map(allOwned.map(item => [item._id, item]));
      const orderedIds = [];
      const seen = new Set();

      for (const id of requestedIds) {
        if (ownedMap.has(id) && !seen.has(id)) {
          seen.add(id);
          orderedIds.push(id);
        }
      }

      const remaining = sortFoldersByOrder(allOwned.filter(item => item && !seen.has(item._id)));
      for (const item of remaining) {
        orderedIds.push(item._id);
      }

      const now = new Date();
      await Promise.all(orderedIds.map((id, index) =>
        db.collection('portfolio_folders').doc(id).update({
          data: {
            sortOrder: index,
            updateTime: now
          }
        })
      ));

      return {
        success: true,
        updatedOrder: true,
        updatedCount: orderedIds.length,
        message: '作品集排序已更新'
      };
    } catch (error) {
      console.error('【updatePortfolioFolder云函数】更新作品集排序失败:', error);
      return {
        success: false,
        message: '更新作品集排序失败',
        error: error.message
      };
    }
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

    // 默认作品集保留原名更新封面时，不应被保留名称校验拦截。
    if (trimmedName === '我的作品集' && folder.data.name !== trimmedName) {
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
