// 创建作品集文件夹的云函数
// 基于createFavoriteFolder逻辑修改
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID || event.openid;
  const { folderName } = event;

  if (!openid) {
    return {
      success: false,
      message: '无法获取用户 openid，请重新登录',
      code: 'NO_OPENID'
    };
  }

  try {
    if (!folderName || folderName.trim() === '') {
      return {
        success: false,
        message: '作品集名称不能为空'
      };
    }

    const trimmedName = folderName.trim();

    // 检查是否与默认作品集名称冲突
    if (trimmedName === '我的作品集') {
      return {
        success: false,
        message: '该名称已被系统使用，请选择其他名称'
      };
    }

    // 检查用户是否已有同名作品集
    const existingFolder = await db.collection('portfolio_folders').where({
      _openid: openid,
      name: trimmedName
    }).get();

    if (existingFolder.data.length > 0) {
      return {
        success: false,
        message: '作品集名称已存在'
      };
    }

    // 创建新作品集
    const result = await db.collection('portfolio_folders').add({
      data: {
        _openid: openid,
        name: trimmedName,
        createTime: new Date(),
        updateTime: new Date(),
        itemCount: 0
      }
    });

    return {
      success: true,
      folderId: result._id,
      message: '作品集创建成功'
    };
  } catch (error) {
    console.error('创建作品集失败:', error);
    return {
      success: false,
      message: '创建作品集失败',
      error: error.message
    };
  }
};