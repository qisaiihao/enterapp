const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  // 与 getPostList/vote 保持一致：优先使用前端注入的 event.openid，
  // 在某些运行环境（如 App/H5 通过 uniCloud）下，wxContext.OPENID 可能不可用或为空，
  // 这会导致后续点赞状态查询用错 openid，从而初始显示“未点赞”。
  const openid = event.openid || wxContext.OPENID;

  if (!openid) {
    return {
      success: false,
      message: '无法获取用户 openid，请重新登录',
      code: 'NO_OPENID'
    };
  }

  const { skip = 0, limit = 10, isPoem, isOriginal, filterByUserId } = event;

  try {
    // 1. 获取被屏蔽的用户ID列表（使用缓存）
    let blockedUserIds = [];
    try {
      const getBlockedUserIds = require('../_lib/get-blocked-user-ids');
      blockedUserIds = await getBlockedUserIds(openid, db);
    } catch (blockError) {
      console.error('获取屏蔽列表失败:', blockError);
    }

    // 2. 获取用户关注列表
    const followsRes = await db.collection('follows')
      .where({ followerId: openid })
      .field({ followedId: true })
      .get();

    if (followsRes.data.length === 0) {
      return {
        success: true,
        posts: [],
        hasMore: false,
        total: 0
      };
    }

    let followedIds = followsRes.data
      .map(item => item.followedId)
      .filter(id => !blockedUserIds.includes(id)); // 过滤被屏蔽的用户

    if (followedIds.length === 0) {
      return {
        success: true,
        posts: [],
        hasMore: false,
        total: 0
      };
    }

    // 如果指定了用户ID筛选，且该用户在关注列表中
    if (filterByUserId) {
      if (!followedIds.includes(filterByUserId)) {
        // 筛选的用户不在关注列表中
        return {
          success: true,
          posts: [],
          hasMore: false,
          total: 0
        };
      }
      // 只筛选该用户的帖子
      followedIds = [filterByUserId];
      console.log('🔍 [getFollowingPosts] 按用户ID筛选:', filterByUserId);
    }

    // 3. 构建查询条件
    const queryConditions = {
      _openid: _.in(followedIds),
      // 只获取已审核通过的帖子
      auditStatus: 'approved',
      // 不显示隐藏的帖子
      isHidden: _.neq(true)
    };

    // 如果指定了isPoem参数，添加诗歌筛选条件
    if (isPoem !== undefined) {
      queryConditions.isPoem = isPoem;
      console.log('🔍 [getFollowingPosts] 添加isPoem筛选条件:', isPoem);
    }

    // 如果指定了isOriginal参数，添加原创筛选条件
    if (isOriginal !== undefined) {
      if (isOriginal === true) {
        // 只获取原创：isOriginal 必须为 true
        queryConditions.isOriginal = true;
      } else {
        // 只获取非原创：isOriginal 为 false 或不存在
        queryConditions.isOriginal = _.neq(true);
      }
      console.log('🔍 [getFollowingPosts] 添加isOriginal筛选条件:', isOriginal);
    }

    // 4. 获取关注用户的帖子
    const postsRes = await db.collection('posts')
      .where(queryConditions)
      .orderBy('createTime', 'desc')
      .skip(skip)
      .limit(limit)
      .get();

    // 5. 获取帖子作者信息
    const authorIds = [...new Set(postsRes.data.map(post => post._openid))];
    
    const authorsRes = await db.collection('users')
      .where({ _openid: _.in(authorIds) })
      .field({
        _openid: true,
        nickName: true,
        avatarUrl: true,
        signatureUrl: true
      })
      .get();

    const authorMap = new Map();
    authorsRes.data.forEach(author => {
      authorMap.set(author._openid, author);
    });

    // 6. 过滤被屏蔽用户的匿名帖子（再次过滤，因为匿名帖子的realAuthorOpenid可能不在followedIds中）
    const filteredPosts = postsRes.data.filter(post => {
      if (blockedUserIds.length === 0) return true;
      // 检查匿名帖子的 realAuthorOpenid
      if (post.realAuthorOpenid && blockedUserIds.includes(post.realAuthorOpenid)) return false;
      return true;
    });
    
    // 7. 组装帖子数据
    const posts = filteredPosts.map(post => {
      const author = authorMap.get(post._openid) || {};
      return {
        ...post,
        authorName: author.nickName || '微信用户',
        authorAvatar: author.avatarUrl || '',
        authorSignature: post.isAnonymous ? '' : (author.signatureUrl || ''),
        isAnonymous: post.isAnonymous || false
      };
    });

    // 8. 处理头像URL和签名URL
    await enrichCloudUrls(posts);

    // 9. 查询当前用户对这些帖子的点赞状态
    if (posts.length > 0) {
      try {
        const postIds = posts.map(post => post._id);
        const votesResult = await db.collection('votes_log')
          .where({
            _openid: openid,
            postId: _.in(postIds),
            type: 'post'
          })
          .get();

        const votedPostIds = new Set(votesResult.data.map(v => v.postId));
        posts.forEach(post => {
          post.isVoted = votedPostIds.has(post._id);
        });
      } catch (err) {
        console.error('获取点赞状态失败:', err);
        // 如果查询失败，默认所有帖子都未点赞
        posts.forEach(post => {
          post.isVoted = false;
        });
      }
    }

    // 10. 获取总数（用于判断是否还有更多）
    const totalRes = await db.collection('posts')
      .where(queryConditions)
      .count();

    const hasMore = skip + posts.length < totalRes.total;

    return {
      success: true,
      posts,
      hasMore,
      total: totalRes.total
    };

  } catch (error) {
    console.error('获取关注的人帖子失败:', error);
    return {
      success: false,
      message: '获取帖子失败',
      error: error.message
    };
  }
};

// 处理头像URL和签名URL
async function enrichCloudUrls(list) {
  // 收集所有需要转换的 cloud:// URLs
  const fileIDs = new Set();
  
  list.forEach(post => {
    if (post.authorAvatar && post.authorAvatar.startsWith('cloud://')) {
      fileIDs.add(post.authorAvatar);
    }
    if (post.authorSignature && post.authorSignature.startsWith('cloud://')) {
      fileIDs.add(post.authorSignature);
    }
  });

  if (fileIDs.size === 0) {
    return;
  }

  try {
    const tempUrls = await cloud.getTempFileURL({ fileList: Array.from(fileIDs) });
    const urlMap = new Map();

    tempUrls.fileList.forEach(file => {
      if (file.status === 0) {
        urlMap.set(file.fileID, file.tempFileURL);
      }
    });

    list.forEach(post => {
      if (post.authorAvatar && urlMap.has(post.authorAvatar)) {
        post.authorAvatar = urlMap.get(post.authorAvatar);
      }
      if (post.authorSignature && urlMap.has(post.authorSignature)) {
        post.authorSignature = urlMap.get(post.authorSignature);
      }
    });
  } catch (error) {
    console.error('处理云文件URL失败:', error);
  }
}
