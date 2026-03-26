const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

async function getExactFolderCount(folderId) {
  if (!folderId) return 0;

  // 获取该文件夹下的所有 portfolio_items（最多100条）
  const itemsResult = await db.collection('portfolio_items').where({
    folderId
  }).limit(100).field({ _id: true, postId: true }).get();

  const items = itemsResult.data || [];
  if (items.length === 0) return 0;

  // 提取所有 postId，验证帖子是否仍然存在
  const postIds = [...new Set(items.map(item => item.postId).filter(Boolean))];
  if (postIds.length === 0) {
    // 所有记录都没有 postId，全部清理
    await Promise.all(items.map(item =>
      db.collection('portfolio_items').doc(item._id).remove().catch(() => {})
    ));
    return 0;
  }

  // 批量检查帖子是否存在（db.command.in 最多支持约500个）
  const postsResult = await db.collection('posts').where({
    _id: db.command.in(postIds)
  }).field({ _id: true }).get();

  const existingPostIds = new Set((postsResult.data || []).map(p => p._id));

  // 找出引用已删除帖子的孤儿记录并清理
  const orphanItems = items.filter(item => !item.postId || !existingPostIds.has(item.postId));
  if (orphanItems.length > 0) {
    console.log(`【getPortfolioFolders】清理孤儿记录 ${orphanItems.length} 条，folderId: ${folderId}`);
    await Promise.all(orphanItems.map(item =>
      db.collection('portfolio_items').doc(item._id).remove().catch(err => {
        console.error('清理孤儿记录失败:', item._id, err);
      })
    ));
  }

  return items.length - orphanItems.length;
}

function normalizeFolderCount(folder = {}, exactCount = null) {
  const normalizedCount = exactCount === null
    ? (Number(
        folder.itemCount !== undefined && folder.itemCount !== null
          ? folder.itemCount
          : folder.postCount
      ) || 0)
    : (Number(exactCount) || 0);

  return {
    ...folder,
    itemCount: normalizedCount,
    postCount: normalizedCount
  };
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID || event.openid;

  console.log('【getPortfolioFolders】开始执行，openid:', openid);

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

    const dataList = result.data || [];

    if (dataList.length === 0) {
      try {
        const now = new Date();
        const defaultFolder = await db.collection('portfolio_folders').add({
          data: {
            _openid: openid,
            name: '我的作品集',
            itemCount: 0,
            postCount: 0,
            createTime: now,
            updateTime: now,
            isDefault: true
          }
        });

        return {
          success: true,
          folders: [normalizeFolderCount({
            _id: defaultFolder._id,
            _openid: openid,
            name: '我的作品集',
            itemCount: 0,
            postCount: 0,
            createTime: now,
            updateTime: now,
            isDefault: true
          })]
        };
      } catch (createError) {
        const createErrDetail = createError.errMsg || createError.message || (typeof createError === 'object' ? JSON.stringify(createError) : String(createError));
        console.error('【getPortfolioFolders】创建默认作品集失败:', createError, '详情:', createErrDetail);
        return {
          success: false,
          message: '创建默认作品集失败',
          error: createErrDetail
        };
      }
    }

    const rawFolders = result.data || [];
    const exactCounts = await Promise.all(
      rawFolders.map(folder => getExactFolderCount(folder && folder._id))
    );
    const folders = rawFolders.map((folder, index) => normalizeFolderCount(folder, exactCounts[index]));

    await Promise.all(
      folders.map((folder, index) => {
        const original = rawFolders[index] || {};
        const originalItemCount = Number(original.itemCount || 0);
        const originalPostCount = Number(original.postCount || 0);
        const exactCount = Number(folders[index].itemCount || 0);

        if (originalItemCount === exactCount && originalPostCount === exactCount) {
          return Promise.resolve();
        }

        return db.collection('portfolio_folders').doc(folder._id).update({
          data: {
            itemCount: exactCount,
            postCount: exactCount,
            updateTime: new Date()
          }
        }).catch(error => {
          console.error(`【getPortfolioFolders】回写作品集数量失败: ${folder && folder._id}`, error);
        });
      })
    );

    const fileIDSet = new Set();

    folders.forEach(folder => {
      if (folder.coverUrl && typeof folder.coverUrl === 'string' && folder.coverUrl.startsWith('cloud://')) {
        fileIDSet.add(folder.coverUrl);
      }
    });

    if (fileIDSet.size > 0) {
      try {
        const fileIDs = Array.from(fileIDSet);
        const fileListResult = await cloud.getTempFileURL({ fileList: fileIDs });
        const urlMap = new Map();

        fileListResult.fileList.forEach(item => {
          if (item.status === 0) {
            urlMap.set(item.fileID, item.tempFileURL);
          }
        });

        folders.forEach(folder => {
          if (folder.coverUrl && urlMap.has(folder.coverUrl)) {
            folder.coverUrl = urlMap.get(folder.coverUrl);
          }
        });
      } catch (fileError) {
        console.error('【getPortfolioFolders】封面 URL 转换失败:', fileError);
      }
    }

    return {
      success: true,
      folders
    };
  } catch (error) {
    const errDetail = error.errMsg || error.message || (typeof error === 'object' ? JSON.stringify(error) : String(error));
    console.error('【getPortfolioFolders】数据库查询失败:', error, '详情:', errDetail);
    return {
      success: false,
      message: '获取作品集失败',
      error: errDetail
    };
  }
};
