// 云函数入口文件 - 获取诗人作品列表
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;
const $ = db.command.aggregate;

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const currentOpenid = wxContext.OPENID || event.openid;

  const { poetName, page = 0, pageSize = 10 } = event;

  if (!poetName || !poetName.trim()) {
    return {
      success: false,
      message: '诗人名称不能为空'
    };
  }

  const normalizedName = poetName.trim();
  const skip = page * pageSize;

  try {
    // 获取被屏蔽的用户ID列表
    let blockedUserIds = [];
    if (currentOpenid) {
      try {
        const getBlockedUserIds = require('../_lib/get-blocked-user-ids');
        blockedUserIds = await getBlockedUserIds(currentOpenid, db);
      } catch (blockError) {
        console.error('获取屏蔽列表失败:', blockError);
      }
    }

    // 构建查询条件
    const matchConditions = {
      author: normalizedName,
      isOriginal: false,
      isPoem: true,
      isHidden: _.neq(true)
    };

    // 过滤被屏蔽用户的帖子
    if (blockedUserIds.length > 0) {
      matchConditions._openid = _.nin(blockedUserIds);
    }

    // 先获取总数
    const countResult = await db.collection('posts')
      .where(matchConditions)
      .count();
    const total = countResult.total;

    // 查询帖子列表
    const postsResult = await db.collection('posts')
      .where(matchConditions)
      .orderBy('createTime', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get();

    let posts = postsResult.data || [];

    // 获取所有帖子作者的用户信息
    const authorOpenids = [...new Set(posts.map(p => p._openid).filter(Boolean))];
    let authorMap = new Map();

    if (authorOpenids.length > 0) {
      try {
        const usersResult = await db.collection('users')
          .where({ _openid: _.in(authorOpenids) })
          .field({ _openid: 1, nickName: 1, avatarUrl: 1 })
          .get();
        
        usersResult.data.forEach(user => {
          authorMap.set(user._openid, {
            nickName: user.nickName || '匿名用户',
            avatarUrl: user.avatarUrl || ''
          });
        });
      } catch (userError) {
        console.error('获取用户信息失败:', userError);
      }
    }

    // 处理帖子数据
    posts = posts.map(post => {
      const authorInfo = authorMap.get(post._openid) || {};
      return {
        ...post,
        authorName: authorInfo.nickName || post.authorNameSnapshot || '匿名用户',
        authorAvatar: authorInfo.avatarUrl || post.authorAvatarSnapshot || '',
        imageUrls: Array.isArray(post.imageUrls) ? post.imageUrls : (post.imageUrl ? [post.imageUrl] : []),
        originalImageUrls: Array.isArray(post.originalImageUrls) ? post.originalImageUrls : (post.imageUrl ? [post.imageUrl] : []),
        tags: Array.isArray(post.tags) ? post.tags : []
      };
    });

    // 收集需要转换的云存储URL
    const fileIDs = [];
    posts.forEach(post => {
      if (post.authorAvatar && post.authorAvatar.startsWith('cloud://')) {
        fileIDs.push(post.authorAvatar);
      }
      if (Array.isArray(post.imageUrls)) {
        post.imageUrls.forEach(url => {
          if (url && url.startsWith('cloud://')) {
            fileIDs.push(url);
          }
        });
      }
      if (Array.isArray(post.originalImageUrls)) {
        post.originalImageUrls.forEach(url => {
          if (url && url.startsWith('cloud://')) {
            fileIDs.push(url);
          }
        });
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
        posts.forEach(post => {
          if (post.authorAvatar && urlMap.has(post.authorAvatar)) {
            post.authorAvatar = urlMap.get(post.authorAvatar);
          }
          if (Array.isArray(post.imageUrls)) {
            post.imageUrls = post.imageUrls.map(url => urlMap.get(url) || url);
          }
          if (Array.isArray(post.originalImageUrls)) {
            post.originalImageUrls = post.originalImageUrls.map(url => urlMap.get(url) || url);
          }
        });
      } catch (fileError) {
        console.error('转换文件URL失败:', fileError);
      }
    }

    // 获取点赞状态
    if (currentOpenid && posts.length > 0) {
      try {
        const postIds = posts.map(p => p._id);
        const votesResult = await db.collection('votes_log')
          .where({
            _openid: currentOpenid,
            postId: _.in(postIds)
          })
          .get();
        
        const votedPostIds = new Set(votesResult.data.map(v => v.postId));
        posts.forEach(post => {
          post.isVoted = votedPostIds.has(post._id);
        });
      } catch (voteError) {
        console.error('获取点赞状态失败:', voteError);
      }
    }

    return {
      success: true,
      posts,
      total,
      page,
      pageSize,
      hasMore: skip + posts.length < total
    };

  } catch (e) {
    console.error('【getPoetPosts云函数】错误:', e);
    return {
      success: false,
      error: e.message || '获取诗人作品失败'
    };
  }
};
