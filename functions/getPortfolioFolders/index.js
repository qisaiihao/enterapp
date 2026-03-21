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

  console.log('【getPortfolioFolders】开始执行，openid:', openid);

  if (!openid) {
    console.log('【getPortfolioFolders】获取openid失败');
    return {
      success: false,
      message: '无法获取用户 openid，请重新登录',
      code: 'NO_OPENID'
    };
  }

  try {
    console.log('【getPortfolioFolders】查询portfolio_folders集合...');
    const result = await db.collection('portfolio_folders').where({
      _openid: openid
    }).orderBy('createTime', 'desc').get();

    const dataList = result.data || [];
    console.log('【getPortfolioFolders】查询结果，数量:', dataList.length);

    // 如果用户没有任何作品集，自动创建一个默认作品集
    if (dataList.length === 0) {
      console.log('【getPortfolioFolders】用户没有作品集，创建默认作品集');
      try {
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

        console.log('【getPortfolioFolders】创建默认作品集成功，ID:', defaultFolder._id);
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

    console.log('【getPortfolioFolders】返回作品集列表，数量:', dataList.length);
    
    // 处理封面图片URL转换
    const folders = result.data || [];
    const fileIDSet = new Set();
    
    // 收集所有需要转换的cloud:// URL
    folders.forEach(folder => {
      if (folder.coverUrl && typeof folder.coverUrl === 'string' && folder.coverUrl.startsWith('cloud://')) {
        fileIDSet.add(folder.coverUrl);
      }
    });

    // 如果有需要转换的URL，批量获取临时URL
    if (fileIDSet.size > 0) {
      try {
        const fileIDs = Array.from(fileIDSet);
        console.log('【getPortfolioFolders】需要转换的封面URL数量:', fileIDs.length);
        
        const fileListResult = await cloud.getTempFileURL({ fileList: fileIDs });
        const urlMap = new Map();
        
        fileListResult.fileList.forEach(item => {
          if (item.status === 0) {
            urlMap.set(item.fileID, item.tempFileURL);
          }
        });

        console.log('【getPortfolioFolders】成功转换的URL数量:', urlMap.size);

        // 替换封面URL
        folders.forEach(folder => {
          if (folder.coverUrl && urlMap.has(folder.coverUrl)) {
            folder.coverUrl = urlMap.get(folder.coverUrl);
            console.log('【getPortfolioFolders】转换封面URL:', folder.name, folder.coverUrl);
          }
        });
      } catch (fileError) {
        console.error('【getPortfolioFolders】封面URL转换失败:', fileError);
      }
    }
    
    return {
      success: true,
      folders: folders
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