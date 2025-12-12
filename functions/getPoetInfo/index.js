// 云函数入口文件 - 获取诗人信息
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const currentOpenid = wxContext.OPENID || event.openid;

  const { poetName } = event;

  if (!poetName || !poetName.trim()) {
    return {
      success: false,
      message: '诗人名称不能为空'
    };
  }

  const normalizedName = poetName.trim();

  try {
    // 查询诗人信息
    const poetResult = await db.collection('poets')
      .where({ name: normalizedName })
      .limit(1)
      .get();

    let poetInfo;

    if (poetResult.data && poetResult.data.length > 0) {
      // 诗人已存在
      poetInfo = poetResult.data[0];
    } else {
      // 诗人不存在，自动创建
      // 从帖子中获取该诗人的信息（首次需要创建）
      const postsCheck = await db.collection('posts')
        .where({
          author: normalizedName,
          isOriginal: false,
          isPoem: true
        })
        .limit(1)
        .get();

      if (!postsCheck.data || postsCheck.data.length === 0) {
        return {
          success: false,
          message: '未找到该诗人的作品',
          code: 'POET_NOT_FOUND'
        };
      }

      // 创建新诗人记录
      const newPoet = {
        name: normalizedName,
        avatar: '',  // 默认无头像
        bio: '',     // 默认无简介
        createTime: db.serverDate(),
        updateTime: db.serverDate(),
        creatorOpenid: currentOpenid  // 记录谁首次触发创建
      };

      const addResult = await db.collection('poets').add({ data: newPoet });
      poetInfo = {
        _id: addResult._id,
        ...newPoet
      };
    }

    // 处理头像URL转换
    if (poetInfo.avatar && poetInfo.avatar.startsWith('cloud://')) {
      try {
        const fileResult = await cloud.getTempFileURL({
          fileList: [poetInfo.avatar]
        });
        if (fileResult.fileList && fileResult.fileList[0] && fileResult.fileList[0].status === 0) {
          poetInfo.avatar = fileResult.fileList[0].tempFileURL;
        }
      } catch (fileError) {
        console.error('转换诗人头像URL失败:', fileError);
      }
    }

    return {
      success: true,
      poetInfo: {
        _id: poetInfo._id,
        name: poetInfo.name,
        avatar: poetInfo.avatar || '',
        bio: poetInfo.bio || ''
      }
    };

  } catch (e) {
    console.error('【getPoetInfo云函数】错误:', e);
    return {
      success: false,
      error: e.message || '获取诗人信息失败'
    };
  }
};
