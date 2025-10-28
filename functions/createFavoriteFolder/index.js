// 创建收藏夹云函数
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

  console.log('【createFavoriteFolder】开始创建收藏夹:', {
    openid,
    folderName: event.folderName,
    coverUrl: event.coverUrl
  });

  if (!openid) {
    return {
      success: false,
      message: '无法获取用户 openid，请重新登录',
      code: 'NO_OPENID'
    };
  }

  try {
    const { folderName, coverUrl } = event;
    
    if (!folderName || folderName.trim() === '') {
      return {
        success: false,
        message: '收藏夹名称不能为空'
      };
    }

    const trimmedName = folderName.trim();
    
    // 检查是否与默认收藏夹名称冲突
    if (trimmedName === '我的收藏') {
      return {
        success: false,
        message: '该名称已被系统使用，请选择其他名称'
      };
    }

    // 检查用户是否已有同名收藏夹
    const existingFolder = await db.collection('favorite_folders').where({
      _openid: openid,
      name: trimmedName
    }).get();

    if (existingFolder.data.length > 0) {
      return {
        success: false,
        message: '收藏夹名称已存在'
      };
    }

    // 创建新收藏夹
    const folderData = {
      _openid: openid,
      name: trimmedName,
      createTime: new Date(),
      updateTime: new Date(),
      itemCount: 0
    };

    // 如果有封面图片，添加到数据中
    if (coverUrl) {
      folderData.coverUrl = coverUrl;
      console.log('【createFavoriteFolder】添加封面URL到数据中:', coverUrl);
    } else {
      console.log('【createFavoriteFolder】没有封面URL');
    }

    console.log('【createFavoriteFolder】准备保存的数据:', folderData);

    const result = await db.collection('favorite_folders').add({
      data: folderData
    });

    console.log('【createFavoriteFolder】保存结果:', result);

    return {
      success: true,
      folderId: result._id,
      message: '收藏夹创建成功'
    };
  } catch (error) {
    console.error('【createFavoriteFolder】创建收藏夹失败:', error);
    return {
      success: false,
      message: '创建收藏夹失败',
      error: error.message
    };
  }
};
