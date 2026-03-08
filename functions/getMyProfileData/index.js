// 修复后的getMyProfileData云函数
// 主要修复了：
// 1. 移除了重复的formattedFavorites变量声明
// 2. 修复了多余的大括号导致的语法错误
// 3. 清理了未使用的formatFavoritesForFolder函数引用

console.log('【profile云函数】=== 代码已更新修复版本 ===');

// 云函数入口文件
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const $ = db.command.aggregate;
const { resolveOpenId, buildNoOpenIdResponse } = require('../_lib/request-context');
const { createDraftHandlers } = require('./handlers/drafts');
const { createFavoriteHandlers } = require('./handlers/favorites');

const draftHandlers = createDraftHandlers({ db });
const favoriteHandlers = createFavoriteHandlers({ db, cloud });

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = resolveOpenId({ event, context, wxContext, preferEvent: true });

  console.log('【profile云函数】openid获取:', {
    eventOpenid: event.openid,
    wxContextOpenid: wxContext.OPENID,
    finalOpenid: openid
  });

  if (!openid) {
    return buildNoOpenIdResponse('无法获取用户 openid，请重新登录');
  }

  const { skip = 0, limit = 20, action } = event;
  console.log('【profile云函数】收到参数:', { skip, limit, action });
  console.log('【profile云函数】将查询用户帖子，包括匿名帖子，用户openid:', openid);
  
  // 如果是创建收藏夹，打印详细信息
  if (action === 'createFavoriteFolder') {
    console.log('【profile云函数】创建收藏夹参数:', {
      folderName: event.folderName,
      coverUrl: event.coverUrl,
      openid: openid
    });
  }

  const actionHandlers = {
    getFavoriteFolders: () => favoriteHandlers.getFavoriteFolders(openid),
    createFavoriteFolder: () => favoriteHandlers.createFavoriteFolder(openid, event.folderName, event.coverUrl),
    addToFavorite: () => favoriteHandlers.addToFavorite(openid, event.postId, event.folderId),
    getFavoritesByFolder: () => favoriteHandlers.getFavoritesByFolder(openid, event.folderId, event.skip || 0, event.limit || 10),
    removeFromFavorite: () => favoriteHandlers.removeFromFavorite(openid, event.favoriteId),
    getAllFavorites: () => favoriteHandlers.getAllFavorites(openid, event.skip || 0, event.limit || 10),
    saveDraft: () => draftHandlers.saveDraft(openid, event.draftData),
    getDrafts: () => draftHandlers.getDrafts(openid),
    deleteDraft: () => draftHandlers.deleteDraft(openid, event.draftId)
  };

  if (action && actionHandlers[action]) {
    return await actionHandlers[action]();
  }

  try {
    // Step 1: Aggregate to get user info and their posts (including anonymous posts)
    const profileData = await db.collection('users').aggregate()
      .match({ _openid: openid })
      .limit(1)
      .lookup({
        from: 'posts',
        let: { user_openid: '$_openid' },
        pipeline: [
          { 
            $match: { 
              $expr: { 
                $or: [
                  // 匹配用户直接发布的帖子
                  { $eq: ['$_openid', '$$user_openid'] },
                  // 匹配用户发布的匿名帖子（通过realAuthorOpenid字段）
                  { $eq: ['$realAuthorOpenid', '$$user_openid'] }
                ]
              } 
            } 
          },
          { $sort: { createTime: -1 } },
          { $skip: skip },
          { $limit: limit }
        ],
        as: 'userPosts'
      })
      .project({
        _id: 1,
        nickName: 1,
        avatarUrl: 1, // This is a fileID
        birthday: 1, // 新增：获取生日
        bio: 1,      // 新增：获取个性签名
        occupation: 1,
        region: 1,
        signatureUrl: 1,
        poemId: 1,    // 新增：获取poemId
        password: 1,  // 新增：获取password（谨慎使用）
        phoneNumber: 1, // 新增：获取手机号
        growthCounts: 1,
        posts: '$userPosts'
      })
      .end();

    if (profileData.list.length === 0) {
      return { success: false, message: 'User not found.' };
    }

    const result = profileData.list[0];
    let userInfo = {
      nickName: result.nickName,
      avatarUrl: result.avatarUrl, // fileID
      birthday: result.birthday,
      bio: result.bio,
      occupation: result.occupation,
      region: result.region,
      signatureUrl: result.signatureUrl,
      poemId: result.poemId,     // 新增：poemId字段
      password: result.password,  // 新增：password字段（谨慎使用）
      phoneNumber: result.phoneNumber, // 新增：手机号字段
      growthCounts: (result.growthCounts) || { seed: 0, leaf: 0, flower: 0, peach: 0 }
    };
    let posts = result.posts || []; // 这里已经是分页后的 posts
    console.log('【profile云函数】聚合后 posts 数量:', posts.length);
    // 打印第一个帖子的 _openid 字段，确认数据结构
    if (posts.length > 0) {
      console.log('【profile云函数】第一个帖子关键字段:', {
        _id: posts[0]._id,
        _openid: posts[0]._openid,
        title: posts[0].title,
        isAnonymous: posts[0].isAnonymous
      });
    }
    
    // 统计帖子类型
    const directPosts = posts.filter(post => post._openid === openid);
    const anonymousPosts = posts.filter(post => post.realAuthorOpenid === openid);
    console.log('【profile云函数】帖子类型统计:', {
      总数量: posts.length,
      直接发布: directPosts.length,
      匿名发布: anonymousPosts.length
    });

    // Step 2: Normalize冗余字段（移除重复排序，因为聚合管道已经排序）
    if (posts.length > 0) {
      posts = posts.map(post => ({
        ...post,
        authorName: post.authorName || post.authorNameSnapshot || '匿名用户',
        authorAvatar: post.authorAvatar || post.authorAvatarSnapshot || '',
        commentCount: post.commentCount === undefined || post.commentCount === null ? 0 : post.commentCount
      }));
      // 移除重复排序，聚合管道已经按 createTime: -1 排序
      // posts.sort((a, b) => b.createTime - a.createTime);
    }

    // 图片URL转换逻辑（简化版）
    const fileIDSet = new Set();
    posts.forEach((post, index) => {
      // 保证 imageUrls、originalImageUrls 一定为数组
      if (!Array.isArray(post.imageUrls)) post.imageUrls = post.imageUrls ? [post.imageUrls] : [];
      if (!Array.isArray(post.originalImageUrls)) post.originalImageUrls = post.originalImageUrls ? [post.originalImageUrls] : [];
      
      // 收集唯一的fileID
      if (post.imageUrls && Array.isArray(post.imageUrls) && post.imageUrls.length > 0) {
        post.imageUrls.forEach(url => {
          if (url && url.startsWith('cloud://')) {
            fileIDSet.add(url);
          }
        });
      }
      
    });
    
    if (userInfo.avatarUrl && userInfo.avatarUrl.startsWith('cloud://')) {
      fileIDSet.add(userInfo.avatarUrl);
    }
    if (userInfo.signatureUrl && userInfo.signatureUrl.startsWith('cloud://')) {
      fileIDSet.add(userInfo.signatureUrl);
    }
    const fileIDs = Array.from(fileIDSet);

    if (fileIDs.length > 0) {
      try {
        const fileListResult = await cloud.getTempFileURL({ fileList: fileIDs });
        const urlMap = new Map();
        fileListResult.fileList.forEach(item => {
          if (item.status === 0) {
            urlMap.set(item.fileID, item.tempFileURL);
          }
        });

        posts.forEach((post) => {
          if (post.imageUrls && Array.isArray(post.imageUrls)) {
            post.imageUrls = post.imageUrls.map(url => {
              return urlMap.has(url) ? urlMap.get(url) : url;
            });
          }
        });

        if (userInfo.avatarUrl && urlMap.has(userInfo.avatarUrl)) {
          userInfo.avatarUrl = urlMap.get(userInfo.avatarUrl);
        }
        if (userInfo.signatureUrl && urlMap.has(userInfo.signatureUrl)) {
          userInfo.signatureUrl = urlMap.get(userInfo.signatureUrl);
        }

      } catch (fileError) {
        console.error('文件URL转换失败:', fileError);
      }
    }

    // 给每个post加上作者信息（优先使用帖子中存储的值，因为历史帖子已经通过syncUserPostsMetadata同步更新）
    // 只有当帖子中没有作者信息时，才使用当前用户信息作为兜底
    posts = posts.map(post => ({
      ...post,
      authorName: post.authorName || post.authorNameSnapshot || userInfo.nickName || '匿名用户',
      authorAvatar: post.authorAvatar || post.authorAvatarSnapshot || userInfo.avatarUrl || ''
    }));

    console.log('【profile云函数】最终返回 posts 数量:', posts.length);

    return {
      success: true,
      userInfo: userInfo,
      posts: posts
    };

  } catch (e) {
    console.error(e);
    return {
      success: false,
      error: e
    };
  }
};

// 收藏功能相关函数

