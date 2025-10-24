// 云函数入口文件
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
      message: '无法获取用户 openid，请重新登录',
      code: 'NO_OPENID'
    };
  }

  const { userId } = event;
  console.log('【getUserPortfolio云函数】收到参数:', { userId });

  if (!userId) {
    return { success: false, message: '用户ID不能为空' };
  }

  try {
    // 查询用户的作品集/文件夹 - 同时查询两个集合
    const [foldersResult, portfolioFoldersResult] = await Promise.all([
      db.collection('folders')
        .where({
          _openid: userId,
          isDeleted: db.command.neq(true) // 排除已删除的文件夹
        })
        .orderBy('createTime', 'desc')
        .get(),
      db.collection('portfolio_folders')
        .where({
          _openid: userId,
          isDeleted: db.command.neq(true) // 排除已删除的文件夹
        })
        .orderBy('createTime', 'desc')
        .get()
    ]);

    // 合并两个集合的结果
    let folders = [...(foldersResult.data || []), ...(portfolioFoldersResult.data || [])];
    
    // 按创建时间排序
    folders.sort((a, b) => new Date(b.createTime) - new Date(a.createTime));

    // 如果不是本人访问，只返回公开的文件夹
    const isOwner = String(currentOpenid) === String(userId);
    if (!isOwner) {
      folders = folders.filter(folder => folder.isPublic !== false); // 默认公开，除非明确设置为私有
    }

    // 为每个文件夹获取帖子数量和封面图片
    for (let folder of folders) {
      try {
        // 获取文件夹中的帖子数量
        const postsCount = await db.collection('posts')
          .where({
            folderId: folder._id,
            isDeleted: db.command.neq(true)
          })
          .count();

        folder.postsCount = postsCount.total;

        // 如果文件夹有封面图片且是云存储路径，转换为临时URL
        if (folder.coverImage && folder.coverImage.startsWith('cloud://')) {
          try {
            const tempUrlResult = await cloud.getTempFileURL({
              fileList: [folder.coverImage]
            });

            if (tempUrlResult.fileList && tempUrlResult.fileList[0] && tempUrlResult.fileList[0].status === 0) {
              folder.coverImage = tempUrlResult.fileList[0].tempFileURL;
            }
          } catch (fileError) {
            console.error('封面图片URL转换失败:', fileError);
          }
        }

        // 确保必要字段存在
        folder.name = folder.name || '未命名文件夹';
        folder.description = folder.description || '';
        folder.coverImage = folder.coverImage || '';
        folder.createTime = folder.createTime || new Date().getTime();
        folder.updateTime = folder.updateTime || folder.createTime;

      } catch (err) {
        console.error('处理文件夹数据失败:', err);
        folder.postsCount = 0;
      }
    }

    console.log('【getUserPortfolio云函数】返回文件夹数量:', folders.length);

    return {
      success: true,
      folders: folders
    };

  } catch (e) {
    console.error('【getUserPortfolio云函数】错误:', e);
    return {
      success: false,
      error: e.message || '获取用户作品集失败'
    };
  }
};