// 获取用户作品集文件夹列表的云函数
// 基于getFavoriteFolders逻辑修改
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID || event.openid;

  if (!openid) {
    return {
      success: false,
      message: '无法获取用户 openid，请重新登录',
      code: 'NO_OPENID'
    };
  }

  try {
    const result = await db.collection('portfolio_folders').where({
      _openid: openid
    }).orderBy('createTime', 'desc').get();

    // 如果用户没有任何作品集，自动创建一个默认作品集
    if (result.data.length === 0) {
      console.log('用户没有作品集，创建默认作品集');
      const defaultFolder = await db.collection('portfolio_folders').add({
        data: {
          _openid: openid,
          name: '我的作品集',
          itemCount: 0,
          createTime: new Date(),
          updateTime: new Date(),
          isDefault: true // 标记为默认作品集
        }
      });

      return {
        success: true,
        folders: [{
          _id: defaultFolder._id,
          _openid: openid,
          name: '我的作品集',
          itemCount: 0,
          createTime: new Date(),
          updateTime: new Date(),
          isDefault: true
        }]
      };
    }

    return {
      success: true,
      folders: result.data
    };
  } catch (error) {
    console.error('获取作品集失败:', error);
    return {
      success: false,
      message: '获取作品集失败',
      error: error.message
    };
  }
};