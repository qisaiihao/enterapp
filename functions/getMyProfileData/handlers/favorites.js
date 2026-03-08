function createFavoriteHandlers({ db, cloud }) {
async function getFavoriteFolders(openid) {
  try {
    const result = await db.collection('favorite_folders').where({
      _openid: openid
    }).orderBy('createTime', 'desc').get();

    // 如果用户没有任何收藏夹，自动创建一个默认收藏夹
    if (result.data.length === 0) {
      console.log('用户没有收藏夹，创建默认收藏夹');
      const defaultFolder = await db.collection('favorite_folders').add({
        data: {
          _openid: openid,
          name: '我的收藏',
          itemCount: 0,
          createTime: new Date(),
          updateTime: new Date(),
          isDefault: true // 标记为默认收藏夹
        }
      });

      return {
        success: true,
        folders: [{
          _id: defaultFolder._id,
          _openid: openid,
          name: '我的收藏',
          itemCount: 0,
          createTime: new Date(),
          updateTime: new Date(),
          isDefault: true,
          coverUrl: null
        }]
      };
    }

    // 处理封面图片URL转换
    const folders = result.data;
    const fileIDSet = new Set();
    
    // 收集所有需要转换的cloud:// URL
    folders.forEach(folder => {
      if (folder.coverUrl && folder.coverUrl.startsWith('cloud://')) {
        fileIDSet.add(folder.coverUrl);
      }
    });

    // 如果有需要转换的URL，批量获取临时URL
    if (fileIDSet.size > 0) {
      try {
        const fileIDs = Array.from(fileIDSet);
        console.log('【getFavoriteFolders】需要转换的封面URL数量:', fileIDs.length);
        
        const fileListResult = await cloud.getTempFileURL({ fileList: fileIDs });
        const urlMap = new Map();
        
        fileListResult.fileList.forEach(item => {
          if (item.status === 0) {
            urlMap.set(item.fileID, item.tempFileURL);
          }
        });

        console.log('【getFavoriteFolders】成功转换的URL数量:', urlMap.size);

        // 替换封面URL
        folders.forEach(folder => {
          if (folder.coverUrl && urlMap.has(folder.coverUrl)) {
            folder.coverUrl = urlMap.get(folder.coverUrl);
            console.log('【getFavoriteFolders】转换封面URL:', folder.name, folder.coverUrl);
          }
        });
      } catch (fileError) {
        console.error('【getFavoriteFolders】封面URL转换失败:', fileError);
      }
    }

    return {
      success: true,
      folders: folders
    };
  } catch (error) {
    console.error('获取收藏夹失败:', error);
    return {
      success: false,
      message: '获取收藏夹失败',
      error: error.message
    };
  }
}

async function createFavoriteFolder(openid, folderName, coverUrl) {
  try {
    console.log('【createFavoriteFolder】开始创建收藏夹:', {
      openid,
      folderName,
      coverUrl
    });
    
    if (!folderName || folderName.trim() === '') {
      return {
        success: false,
        message: '收藏夹名称不能为空'
      };
    }

    const trimmedName = folderName.trim();
    
    // 检查是否与默认收藏夹名称冲突
    if (trimmedName === '我的收藏') {
      return {
        success: false,
        message: '该名称已被系统使用，请选择其他名称'
      };
    }

    // 检查用户是否已有同名收藏夹
    const existingFolder = await db.collection('favorite_folders').where({
      _openid: openid,
      name: trimmedName
    }).get();

    if (existingFolder.data.length > 0) {
      return {
        success: false,
        message: '收藏夹名称已存在'
      };
    }

    // 创建新收藏夹
    const folderData = {
      _openid: openid,
      name: trimmedName,
      createTime: new Date(),
      updateTime: new Date(),
      itemCount: 0
    };

    // 如果有封面图片，添加到数据中
    if (coverUrl) {
      folderData.coverUrl = coverUrl;
      console.log('【createFavoriteFolder】添加封面URL到数据中:', coverUrl);
    } else {
      console.log('【createFavoriteFolder】没有封面URL');
    }

    console.log('【createFavoriteFolder】准备保存的数据:', folderData);

    const result = await db.collection('favorite_folders').add({
      data: folderData
    });

    console.log('【createFavoriteFolder】保存结果:', result);

    return {
      success: true,
      folderId: result._id,
      message: '收藏夹创建成功'
    };
  } catch (error) {
    console.error('创建收藏夹失败:', error);
    return {
      success: false,
      message: '创建收藏夹失败',
      error: error.message
    };
  }
}

async function addToFavorite(openid, postId, folderId) {
  try {
    if (!postId || !folderId) {
      return {
        success: false,
        message: '参数不完整'
      };
    }

    // 检查是否已经收藏过
    const existingFavorite = await db.collection('favorites').where({
      _openid: openid,
      postId: postId,
      folderId: folderId
    }).get();

    if (existingFavorite.data.length > 0) {
      return {
        success: false,
        message: '已经收藏过了'
      };
    }

    // 添加到收藏
    const result = await db.collection('favorites').add({
      data: {
        _openid: openid,
        postId: postId,
        folderId: folderId,
        createTime: new Date()
      }
    });

    // 更新收藏夹的项目数量
    await db.collection('favorite_folders').doc(folderId).update({
      data: {
        itemCount: db.command.inc(1),
        updateTime: new Date()
      }
    });

    // === 新增：创建收藏消息通知 ===
    try {
      // 获取帖子信息
      const postResult = await db.collection('posts').doc(postId).get()
      const post = postResult.data
      
      // 获取收藏者信息
      const userResult = await db.collection('users').where({
        _openid: openid
      }).limit(1).get()
      const user = userResult.data[0]
      
      // 如果给自己收藏，不发送通知
      if (post._openid === openid) {
        console.log('用户给自己收藏，不发送通知')
      } else {
        // 根据帖子实际字段确定内容类型
        let contentType = 'post';
        let contentTypeText = '帖子';
        
        if (post.isDiscussion) {
          contentType = 'discussion';
          contentTypeText = '讨论';
        } else if (post.isPoem) {
          if (post.isOriginal) {
            contentType = 'original';
            contentTypeText = '原创诗歌';
          } else {
            contentType = 'non-original';
            contentTypeText = '诗歌';
          }
        }
        
        await db.collection('messages').add({
          data: {
            fromUserId: openid,
            fromUserName: user ? user.nickName : '微信用户',
            fromUserAvatar: user ? user.avatarUrl : '',
            toUserId: post._openid,
            type: 'favorite',
            postId: postId,
            postTitle: post.title || '无标题',
            contentType: contentType,
            content: `${user ? user.nickName : '微信用户'} 收藏了你的${contentTypeText}`,
            isRead: false,
            createTime: new Date()
          }
        })
        console.log('收藏消息已创建')
      }
    } catch (msgError) {
      console.error('创建收藏消息失败:', msgError)
      // 不影响主流程，只是记录错误
    }

    return {
      success: true,
      favoriteId: result._id,
      message: '收藏成功'
    };
  } catch (error) {
    console.error('添加收藏失败:', error);
    return {
      success: false,
      message: '添加收藏失败',
      error: error.message
    };
  }
}

async function getFavoritesByFolder(openid, folderId, skip, limit) {
  try {
    if (!folderId) {
      return {
        success: false,
        message: '收藏夹ID不能为空'
      };
    }

    // 获取收藏夹中的收藏项
    const favoritesResult = await db.collection('favorites').where({
      _openid: openid,
      folderId: folderId
    }).orderBy('createTime', 'desc').skip(skip).limit(limit).get();

    const favorites = favoritesResult.data;
    console.log('获取到的收藏项数量:', favorites.length);
    console.log('收藏项数据:', favorites);
    
    if (favorites.length === 0) {
      console.log('收藏夹为空，返回空数组');
      return {
        success: true,
        favorites: []
      };
    }

    // 获取所有相关的帖子ID
    const postIds = favorites.map(fav => fav.postId);
    
    // 获取帖子详细信息
    const postsResult = await db.collection('posts').where({
      _id: db.command.in(postIds)
    }).get();
    
    const postsMap = new Map();
    postsResult.data.forEach(post => {
      postsMap.set(post._id, post);
    });

    // 获取用户信息
    const userIds = [...new Set(postsResult.data.map(post => post._openid))];
    const usersResult = await db.collection('users').where({
      _openid: db.command.in(userIds)
    }).get();
    
    const usersMap = new Map();
    usersResult.data.forEach(user => {
      usersMap.set(user._openid, user);
    });

    // 构建完整的收藏数据 - 与getAllFavorites保持一致
    const completeFavorites = favorites.map(favorite => {
      const post = postsMap.get(favorite.postId);
      if (!post) return null;
      
      const user = usersMap.get(post._openid);

      // 确保图片URLs是数组 - 与getPostList保持一致，处理imageUrl和imageUrls字段
      if (!Array.isArray(post.imageUrls)) {
        post.imageUrls = post.imageUrls ? [post.imageUrls] : (post.imageUrl ? [post.imageUrl] : []);
      }
      if (!Array.isArray(post.originalImageUrls)) {
        post.originalImageUrls = post.originalImageUrls ? [post.originalImageUrls] : (post.originalImageUrl ? [post.originalImageUrl] : []);
      }
      
      return {
        ...favorite,
        // 帖子基本信息
        postId: post._id,
        postTitle: post.title,
        postContent: post.content,
        postImageUrls: post.imageUrls,
        postOriginalImageUrls: post.originalImageUrls,
        postCreateTime: post.createTime,
        postAuthorName: (user && user.nickName) || post.authorName || post.authorNameSnapshot || '未知用户',
        postAuthorAvatar: (user && user.avatarUrl) || post.authorAvatar || post.authorAvatarSnapshot || '',
        postAuthorOpenid: post._openid,
        postTags: post.tags || [],
        postIsPoem: post.isPoem || false,
        postAuthor: post.author || '',
        postIsOriginal: post.isOriginal || false,
        // 前端期望的字段 - 与getAllFavorites保持一致
        _id: post._id,
        title: post.title,
        content: post.content,
        imageUrls: post.imageUrls,
        originalImageUrls: post.originalImageUrls,
        createTime: post.createTime,
        votes: post.votes || 0,
        authorName: (user && user.nickName) || post.authorName || post.authorNameSnapshot || '未知用户',
        authorAvatar: (user && user.avatarUrl) || post.authorAvatar || post.authorAvatarSnapshot || '',
        _openid: post._openid,
        tags: post.tags || [],
        isPoem: post.isPoem || false,
        author: post.author || '',
        isOriginal: post.isOriginal || false,
        commentCount: post.commentCount === undefined || post.commentCount === null ? 0 : post.commentCount,
        favoriteTime: favorite.createTime,
        favoriteId: favorite._id
      };
    }).filter(item => item !== null);

    // 处理图片URL转换 - 与getPostList保持一致，收集所有可能的图片字段
    const fileIDSet = new Set();
    completeFavorites.forEach(favorite => {
      // 处理帖子图片URL
      if (favorite.imageUrls && Array.isArray(favorite.imageUrls)) {
        favorite.imageUrls.forEach(url => {
          if (url && url.startsWith('cloud://')) {
            fileIDSet.add(url);
          }
        });
      }
      if (favorite.originalImageUrls && Array.isArray(favorite.originalImageUrls)) {
        favorite.originalImageUrls.forEach(url => {
          if (url && url.startsWith('cloud://')) {
            fileIDSet.add(url);
          }
        });
      }
      // 处理头像URL
      if (favorite.authorAvatar && favorite.authorAvatar.startsWith('cloud://')) {
        fileIDSet.add(favorite.authorAvatar);
      }
      if (favorite.postAuthorAvatar && favorite.postAuthorAvatar.startsWith('cloud://')) {
        fileIDSet.add(favorite.postAuthorAvatar);
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

      // 替换图片URL和头像URL - 与getAllFavorites保持一致
      completeFavorites.forEach(favorite => {
        if (favorite.imageUrls && Array.isArray(favorite.imageUrls)) {
          favorite.imageUrls = favorite.imageUrls.map(url => {
            return tempURLMap.has(url) ? tempURLMap.get(url) : url;
          });
        }
        if (favorite.originalImageUrls && Array.isArray(favorite.originalImageUrls)) {
          favorite.originalImageUrls = favorite.originalImageUrls.map(url => {
            return tempURLMap.has(url) ? tempURLMap.get(url) : url;
          });
        }
        if (favorite.authorAvatar && tempURLMap.has(favorite.authorAvatar)) {
          favorite.authorAvatar = tempURLMap.get(favorite.authorAvatar);
        }
        if (favorite.postAuthorAvatar && tempURLMap.has(favorite.postAuthorAvatar)) {
          favorite.postAuthorAvatar = tempURLMap.get(favorite.postAuthorAvatar);
        }
      });
      } catch (fileError) {
        console.error('获取临时文件URL失败:', fileError);
        // 即使文件URL转换失败，也继续返回数据
      }
    }

    return {
      success: true,
      favorites: completeFavorites
    };
  } catch (error) {
    console.error('获取收藏内容失败:', error);
    return {
      success: false,
      message: '获取收藏内容失败',
      error: error.message
    };
  }
}

async function removeFromFavorite(openid, favoriteId) {
  try {
    if (!favoriteId) {
      return {
        success: false,
        message: '收藏ID不能为空'
      };
    }

    // 首先获取收藏项信息，以便更新收藏夹计数
    const favorite = await db.collection('favorites').doc(favoriteId).get();
    if (!favorite.data) {
      return {
        success: false,
        message: '收藏项不存在'
      };
    }

    const folderId = favorite.data.folderId;

    // 删除收藏项
    await db.collection('favorites').doc(favoriteId).remove();

    // 更新收藏夹的项目数量
    if (folderId) {
      await db.collection('favorite_folders').doc(folderId).update({
        data: {
          itemCount: db.command.inc(-1),
          updateTime: new Date()
        }
      });
    }

    return {
      success: true,
      message: '取消收藏成功'
    };
  } catch (error) {
    console.error('取消收藏失败:', error);
    return {
      success: false,
      message: '取消收藏失败',
      error: error.message
    };
  }
}

async function getAllFavorites(openid, skip, limit) {
  try {
    // 获取用户的所有收藏项，按收藏时间降序排列
    const favoritesResult = await db.collection('favorites').where({
      _openid: openid
    }).orderBy('createTime', 'desc').skip(skip).limit(limit).get();

    const favorites = favoritesResult.data;
    
    if (favorites.length === 0) {
      return {
        success: true,
        favorites: []
      };
    }

    // 获取所有相关的帖子ID
    const postIds = favorites.map(fav => fav.postId);
    
    // 获取帖子详细信息
    const postsResult = await db.collection('posts').where({
      _id: db.command.in(postIds)
    }).get();
    
    const postsMap = new Map();
    postsResult.data.forEach(post => {
      postsMap.set(post._id, post);
    });

    // 获取用户信息
    const userIds = [...new Set(postsResult.data.map(post => post._openid))];
    const usersResult = await db.collection('users').where({
      _openid: db.command.in(userIds)
    }).get();
    
    const usersMap = new Map();
    usersResult.data.forEach(user => {
      usersMap.set(user._openid, user);
    });

    // 获取评论数量
    // 构建完整的收藏数据
    const completeFavorites = favorites.map(favorite => {
      const post = postsMap.get(favorite.postId);
      if (!post) return null;
      
      const user = usersMap.get(post._openid);
      const commentCount = post.commentCount === undefined || post.commentCount === null ? 0 : post.commentCount;

      // 确保图片URLs是数组
      if (!Array.isArray(post.imageUrls)) {
        post.imageUrls = post.imageUrls ? [post.imageUrls] : [];
      }
      if (!Array.isArray(post.originalImageUrls)) {
        post.originalImageUrls = post.originalImageUrls ? [post.originalImageUrls] : [];
      }
      
      return {
        ...favorite,
        _id: post._id,
        title: post.title,
        content: post.content,
        imageUrls: post.imageUrls,
        originalImageUrls: post.originalImageUrls,
        createTime: post.createTime,
        votes: post.votes || 0,
        commentCount: commentCount,
        authorName: (user && user.nickName) || post.authorName || post.authorNameSnapshot || '未知用户',
        authorAvatar: (user && user.avatarUrl) || post.authorAvatar || post.authorAvatarSnapshot || '',
        favoriteTime: favorite.createTime,
        favoriteId: favorite._id
      };
    }).filter(item => item !== null);

    // 处理图片URL转换
    const fileIDSet = new Set();
    completeFavorites.forEach(favorite => {
      if (favorite.imageUrls && Array.isArray(favorite.imageUrls)) {
        favorite.imageUrls.forEach(url => {
          if (url && url.startsWith('cloud://')) {
            fileIDSet.add(url);
          }
        });
      }
      if (favorite.authorAvatar && favorite.authorAvatar.startsWith('cloud://')) {
        fileIDSet.add(favorite.authorAvatar);
      }
    });

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

        completeFavorites.forEach(favorite => {
          if (favorite.imageUrls && Array.isArray(favorite.imageUrls)) {
            favorite.imageUrls = favorite.imageUrls.map(url => {
              return urlMap.has(url) ? urlMap.get(url) : url;
            });
          }
          if (favorite.authorAvatar && urlMap.has(favorite.authorAvatar)) {
            favorite.authorAvatar = urlMap.get(favorite.authorAvatar);
          }
        });
      } catch (fileError) {
        console.error('文件URL转换失败:', fileError);
      }
    }

    return {
      success: true,
      favorites: completeFavorites
    };
  } catch (error) {
    console.error('获取所有收藏失败:', error);
    return {
      success: false,
      message: '获取收藏失败',
      error: error.message
    };
  }
}

  return {
    getFavoriteFolders,
    createFavoriteFolder,
    addToFavorite,
    getFavoritesByFolder,
    removeFromFavorite,
    getAllFavorites
  };
}

module.exports = {
  createFavoriteHandlers
};
