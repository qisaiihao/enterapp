// 云函数 getOtherPortfolioItems 的入口文件
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const currentOpenid = wxContext.OPENID || event.openid;
  const { folderId, userId, skip = 0, limit = 10 } = event;

  console.log('【getOtherPortfolioItems云函数】收到参数:', { folderId, userId, skip, limit });

  if (!folderId || !userId) {
    return {
      success: false,
      message: '作品集ID和用户ID不能为空'
    };
  }

  if (!currentOpenid) {
    return {
      success: false,
      message: '无法获取用户 openid，请重新登录',
      code: 'NO_OPENID'
    };
  }

  try {
    // 1. 获取作者信息
    const authorRes = await db.collection('users').where({
      _openid: userId
    }).get();

    if (authorRes.data.length === 0) {
      return {
        success: false,
        message: '用户不存在'
      };
    }

    const authorInfo = authorRes.data[0];

    // 2. 验证作品集是否存在且属于该用户
    const folderRes = await db.collection('portfolio_folders').where({
      _id: folderId,
      _openid: userId,
      isDeleted: db.command.neq(true)
    }).get();

    if (folderRes.data.length === 0) {
      return {
        success: false,
        message: '作品集不存在或已被删除'
      };
    }

    const folder = folderRes.data[0];

    // 3. 检查作品集是否公开（非作者访问时）
    const isOwner = String(currentOpenid) === String(userId);
    if (!isOwner && folder.isPublic === false) {
      return {
        success: false,
        message: '该作品集为私有，无法访问'
      };
    }

    // 4. 获取作品集中的项目
    const portfolioResult = await db.collection('portfolio_items').where({
      _openid: userId,
      folderId: folderId
    }).orderBy('createTime', 'desc').skip(skip).limit(limit).get();

    const portfolioItems = portfolioResult.data;
    console.log('【getOtherPortfolioItems】获取到的作品集项目数量:', portfolioItems.length);

    if (portfolioItems.length === 0) {
      return {
        success: true,
        portfolioItems: [],
        authorInfo: {
          nickName: authorInfo.nickName,
          avatarUrl: authorInfo.avatarUrl,
          bio: authorInfo.bio
        }
      };
    }

    // 5. 获取所有相关的帖子ID
    const postIds = portfolioItems.map(item => item.postId);

    // 6. 获取帖子详细信息
    const postsResult = await db.collection('posts').where({
      _id: db.command.in(postIds)
    }).get();

    const postsMap = new Map();
    postsResult.data.forEach(post => {
      postsMap.set(post._id, post);
    });

    // 7. 获取当前用户对这些帖子的点赞状态
    const votesRes = await db.collection('votes_log').where({
      _openid: currentOpenid,
      postId: db.command.in(postIds),
      type: 'post'
    }).get();

    const userVotedPostIds = new Set(votesRes.data.map(vote => vote.postId));

    // 8. 构建完整的作品集数据
    const completePortfolioItems = portfolioItems.map(item => {
      const post = postsMap.get(item.postId);
      if (!post) {
        return null; // 帖子不存在，过滤掉
      }

      // 非作者访问时，过滤掉隐藏的帖子
      if (!isOwner && post.isHidden === true) {
        return null;
      }

      return {
        ...post,
        isVoted: userVotedPostIds.has(post._id),
        likeIcon: userVotedPostIds.has(post._id) ? '/static/images/seedplus.png' : '/static/images/seed.png',
        isExpanded: false, // 默认折叠状态
        // 保留作品集相关字段
        portfolioItemId: item._id,
        addTime: item.createTime
      };
    }).filter(item => item !== null); // 过滤掉null项

    // 9. 处理图片URL转换
    const allImageUrls = [];
    completePortfolioItems.forEach(item => {
      if (item.imageUrl && item.imageUrl.startsWith('cloud://')) {
        allImageUrls.push(item.imageUrl);
      }
      if (item.imageUrls && Array.isArray(item.imageUrls)) {
        item.imageUrls.forEach(url => {
          if (url && url.startsWith('cloud://')) {
            allImageUrls.push(url);
          }
        });
      }
      if (item.originalImageUrl && item.originalImageUrl.startsWith('cloud://')) {
        allImageUrls.push(item.originalImageUrl);
      }
      if (item.originalImageUrls && Array.isArray(item.originalImageUrls)) {
        item.originalImageUrls.forEach(url => {
          if (url && url.startsWith('cloud://')) {
            allImageUrls.push(url);
          }
        });
      }
      if (item.authorSignature && item.authorSignature.startsWith('cloud://')) {
        allImageUrls.push(item.authorSignature);
      }
    });

    // 转换云存储URL为临时URL
    if (allImageUrls.length > 0) {
      const uniqueUrls = [...new Set(allImageUrls)];
      const fileListResult = await cloud.getTempFileURL({
        fileList: uniqueUrls
      });

      const urlMap = new Map();
      fileListResult.fileList.forEach(item => {
        if (item.status === 0) {
          urlMap.set(item.fileID, item.tempFileURL);
        }
      });

      // 更新所有图片URL
      completePortfolioItems.forEach(item => {
        if (item.imageUrl && urlMap.has(item.imageUrl)) {
          item.imageUrl = urlMap.get(item.imageUrl);
        }
        if (item.imageUrls && Array.isArray(item.imageUrls)) {
          item.imageUrls = item.imageUrls.map(url => urlMap.get(url) || url);
        }
        if (item.originalImageUrl && urlMap.has(item.originalImageUrl)) {
          item.originalImageUrl = urlMap.get(item.originalImageUrl);
        }
        if (item.originalImageUrls && Array.isArray(item.originalImageUrls)) {
          item.originalImageUrls = item.originalImageUrls.map(url => urlMap.get(url) || url);
        }
        if (item.authorSignature && urlMap.has(item.authorSignature)) {
          item.authorSignature = urlMap.get(item.authorSignature);
        }
      });
    }

    console.log('【getOtherPortfolioItems】返回作品集项目数量:', completePortfolioItems.length);

    return {
      success: true,
      portfolioItems: completePortfolioItems,
      authorInfo: {
        nickName: authorInfo.nickName,
        avatarUrl: authorInfo.avatarUrl,
        bio: authorInfo.bio
      }
    };

  } catch (e) {
    console.error('【getOtherPortfolioItems云函数】错误:', e);
    return {
      success: false,
      message: '获取作品集内容失败',
      error: e.message
    };
  }
};
