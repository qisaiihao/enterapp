// 云函数入口文件 - 更新诗人信息（头像/简介）
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const currentOpenid = wxContext.OPENID || event.openid;

  if (!currentOpenid) {
    return {
      success: false,
      message: '请先登录'
    };
  }

  const { poetName, bio, avatarFileID } = event;

  if (!poetName || !poetName.trim()) {
    return {
      success: false,
      message: '诗人名称不能为空'
    };
  }

  const normalizedName = poetName.trim();

  try {
    // 查询诗人是否存在
    const poetResult = await db.collection('poets')
      .where({ name: normalizedName })
      .limit(1)
      .get();

    let poetId;
    let updateData = {
      updateTime: db.serverDate(),
      lastEditorOpenid: currentOpenid
    };

    if (poetResult.data && poetResult.data.length > 0) {
      // 诗人存在，更新
      poetId = poetResult.data[0]._id;
    } else {
      // 诗人不存在，先创建
      const newPoet = {
        name: normalizedName,
        avatar: '',
        bio: '',
        createTime: db.serverDate(),
        updateTime: db.serverDate(),
        creatorOpenid: currentOpenid
      };
      const addResult = await db.collection('poets').add({ data: newPoet });
      poetId = addResult._id;
    }

    // 更新简介
    if (typeof bio === 'string') {
      updateData.bio = bio.trim().slice(0, 200);  // 限制200字
    }

    // 更新头像
    if (avatarFileID) {
      updateData.avatar = avatarFileID;
    }

    // 执行更新
    await db.collection('poets').doc(poetId).update({
      data: updateData
    });

    // 返回最新的头像URL
    let avatarUrl = avatarFileID || '';
    if (avatarUrl && avatarUrl.startsWith('cloud://')) {
      try {
        const fileResult = await cloud.getTempFileURL({
          fileList: [avatarUrl]
        });
        if (fileResult.fileList && fileResult.fileList[0] && fileResult.fileList[0].status === 0) {
          avatarUrl = fileResult.fileList[0].tempFileURL;
        }
      } catch (fileError) {
        console.error('转换头像URL失败:', fileError);
      }
    }

    return {
      success: true,
      message: '更新成功',
      avatar: avatarUrl,
      bio: updateData.bio
    };

  } catch (e) {
    console.error('【updatePoetInfo云函数】错误:', e);
    return {
      success: false,
      error: e.message || '更新诗人信息失败'
    };
  }
};
