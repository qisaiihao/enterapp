const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

async function getExactFolderCount(folderId) {
  if (!folderId) return 0;

  const countResult = await db.collection('portfolio_items').where({
    folderId
  }).count();

  return Number(countResult.total) || 0;
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
