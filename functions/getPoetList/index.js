// 云函数入口文件 - 获取诗人列表
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

// 云函数入口函数
exports.main = async (event, context) => {
  const { limit = 50, offset = 0 } = event;

  try {
    // 获取诗人列表，按更新时间倒序
    const poetResult = await db.collection('poets')
      .orderBy('updateTime', 'desc')
      .skip(offset)
      .limit(limit)
      .get();

    let poets = poetResult.data || [];

    // 收集需要转换的云存储URL
    const fileIDs = [];
    poets.forEach(poet => {
      if (poet.avatar && poet.avatar.startsWith('cloud://')) {
        fileIDs.push(poet.avatar);
      }
    });

    // 批量转换URL
    if (fileIDs.length > 0) {
      try {
        const uniqueFileIDs = [...new Set(fileIDs)];
        const fileResult = await cloud.getTempFileURL({ fileList: uniqueFileIDs });
        const urlMap = new Map();
        
        fileResult.fileList.forEach(item => {
          if (item.status === 0) {
            urlMap.set(item.fileID, item.tempFileURL);
          }
        });

        // 替换URL
        poets.forEach(poet => {
          if (poet.avatar && urlMap.has(poet.avatar)) {
            poet.avatar = urlMap.get(poet.avatar);
          }
        });
      } catch (fileError) {
        console.error('转换诗人头像URL失败:', fileError);
      }
    }

    // 返回精简的诗人信息
    const result = poets.map(poet => ({
      _id: poet._id,
      name: poet.name,
      avatar: poet.avatar || '',
      bio: poet.bio || ''
    }));

    return {
      success: true,
      poets: result,
      total: result.length
    };

  } catch (e) {
    console.error('【getPoetList云函数】错误:', e);
    return {
      success: false,
      error: e.message || '获取诗人列表失败'
    };
  }
};
