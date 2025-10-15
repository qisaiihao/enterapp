// 获取指定作品集中的项目列表的云函数
// 基于getFavoritesByFolder逻辑修改
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID || event.openid;
  const { folderId, skip = 0, limit = 10 } = event;

  if (!openid) {
    return {
      success: false,
      message: '无法获取用户 openid，请重新登录',
      code: 'NO_OPENID'
    };
  }

  try {
    if (!folderId) {
      return {
        success: false,
        message: '作品集ID不能为空'
      };
    }

    // 获取作品集中的项目
    const portfolioResult = await db.collection('portfolio_items').where({
      _openid: openid,
      folderId: folderId
    }).orderBy('createTime', 'desc').skip(skip).limit(limit).get();

    const portfolioItems = portfolioResult.data;
    console.log('获取到的作品集项目数量:', portfolioItems.length);
    console.log('作品集项目数据:', portfolioItems);

    if (portfolioItems.length === 0) {
      console.log('作品集为空，返回空数组');
      return {
        success: true,
        portfolioItems: []
      };
    }

    // 获取所有相关的帖子ID
    const postIds = portfolioItems.map(item => item.postId);

    // 获取帖子详细信息
    const postsResult = await db.collection('posts').where({
      _id: db.command.in(postIds)
    }).get();

    const postsMap = new Map();
    postsResult.data.forEach(post => {
      postsMap.set(post._id, post);
    });

    // 获取用户信息（主要是自己的信息）
    const usersResult = await db.collection('users').where({
      _openid: openid
    }).get();

    const user = usersResult.data.length > 0 ? usersResult.data[0] : null;

    // 构建完整的作品集数据
    const completePortfolioItems = portfolioItems.map(portfolioItem => {
      const post = postsMap.get(portfolioItem.postId);
      if (!post) return null;

      // 确保图片URLs是数组
      if (!Array.isArray(post.imageUrls)) {
        post.imageUrls = post.imageUrls ? [post.imageUrls] : (post.imageUrl ? [post.imageUrl] : []);
      }
      if (!Array.isArray(post.originalImageUrls)) {
        post.originalImageUrls = post.originalImageUrls ? [post.originalImageUrls] : (post.originalImageUrl ? [post.originalImageUrl] : []);
      }

      return {
        ...portfolioItem,
        // 帖子基本信息
        postId: post._id,
        postTitle: post.title,
        postContent: post.content,
        postImageUrls: post.imageUrls,
        postOriginalImageUrls: post.originalImageUrls,
        postCreateTime: post.createTime,
        postAuthorName: (user && user.nickName) || post.authorName || post.authorNameSnapshot || '我',
        postAuthorAvatar: (user && user.avatarUrl) || post.authorAvatar || post.authorAvatarSnapshot || '',
        postAuthorOpenid: post._openid,
        postTags: post.tags || [],
        postIsPoem: post.isPoem || false,
        postAuthor: post.author || '',
        postIsOriginal: post.isOriginal || false,
        // 前端期望的字段
        _id: post._id,
        title: post.title,
        content: post.content,
        imageUrls: post.imageUrls,
        originalImageUrls: post.originalImageUrls,
        createTime: post.createTime,
        votes: post.votes || 0,
        authorName: (user && user.nickName) || post.authorName || post.authorNameSnapshot || '我',
        authorAvatar: (user && user.avatarUrl) || post.authorAvatar || post.authorAvatarSnapshot || '',
        _openid: post._openid,
        tags: post.tags || [],
        isPoem: post.isPoem || false,
        author: post.author || '',
        isOriginal: post.isOriginal || false,
        commentCount: post.commentCount === undefined || post.commentCount === null ? 0 : post.commentCount,
        addedTime: portfolioItem.createTime,
        portfolioId: portfolioItem._id
      };
    }).filter(item => item !== null);

    // 处理图片URL转换
    const fileIDSet = new Set();
    completePortfolioItems.forEach(portfolioItem => {
      // 处理帖子图片URL
      if (portfolioItem.imageUrls && Array.isArray(portfolioItem.imageUrls)) {
        portfolioItem.imageUrls.forEach(url => {
          if (url && url.startsWith('cloud://')) {
            fileIDSet.add(url);
          }
        });
      }
      if (portfolioItem.originalImageUrls && Array.isArray(portfolioItem.originalImageUrls)) {
        portfolioItem.originalImageUrls.forEach(url => {
          if (url && url.startsWith('cloud://')) {
            fileIDSet.add(url);
          }
        });
      }
      // 处理头像URL
      if (portfolioItem.authorAvatar && portfolioItem.authorAvatar.startsWith('cloud://')) {
        fileIDSet.add(portfolioItem.authorAvatar);
      }
      if (portfolioItem.postAuthorAvatar && portfolioItem.postAuthorAvatar.startsWith('cloud://')) {
        fileIDSet.add(portfolioItem.postAuthorAvatar);
      }
    });

    // 批量获取临时URL
    if (fileIDSet.size > 0) {
      const fileIDs = Array.from(fileIDSet);
      try {
        console.log('开始获取临时URL，文件数量:', fileIDs.length);
        const fileListResult = await cloud.getTempFileURL({ fileList: fileIDs });
        console.log('临时URL获取结果:', fileListResult);

        const tempFileURLs = fileListResult.fileList.map(item => ({
          fileID: item.fileID,
          tempFileURL: item.status === 0 ? item.tempFileURL : null,
          status: item.status,
          errMsg: item.errMsg
        }));

        // 记录失败的URL转换
        const failedURLs = tempFileURLs.filter(item => item.status !== 0);
        if (failedURLs.length > 0) {
          console.error('部分文件URL转换失败:', failedURLs);
        }

        const tempURLMap = new Map();
        tempFileURLs.forEach(({ fileID, tempFileURL }) => {
          if (tempFileURL) {
            tempURLMap.set(fileID, tempFileURL);
          }
        });

        console.log('成功转换的URL数量:', tempURLMap.size);

        // 替换图片URL和头像URL
        completePortfolioItems.forEach(portfolioItem => {
          if (portfolioItem.imageUrls && Array.isArray(portfolioItem.imageUrls)) {
            portfolioItem.imageUrls = portfolioItem.imageUrls.map(url => {
              return tempURLMap.has(url) ? tempURLMap.get(url) : url;
            });
          }
          if (portfolioItem.originalImageUrls && Array.isArray(portfolioItem.originalImageUrls)) {
            portfolioItem.originalImageUrls = portfolioItem.originalImageUrls.map(url => {
              return tempURLMap.has(url) ? tempURLMap.get(url) : url;
            });
          }
          if (portfolioItem.authorAvatar && tempURLMap.has(portfolioItem.authorAvatar)) {
            portfolioItem.authorAvatar = tempURLMap.get(portfolioItem.authorAvatar);
          }
          if (portfolioItem.postAuthorAvatar && tempURLMap.has(portfolioItem.postAuthorAvatar)) {
            portfolioItem.postAuthorAvatar = tempURLMap.get(portfolioItem.postAuthorAvatar);
          }
        });
      } catch (fileError) {
        console.error('获取临时文件URL失败:', fileError);
        // 即使文件URL转换失败，也继续返回数据
      }
    }

    return {
      success: true,
      portfolioItems: completePortfolioItems
    };
  } catch (error) {
    console.error('获取作品集内容失败:', error);
    return {
      success: false,
      message: '获取作品集内容失败',
      error: error.message
    };
  }
};