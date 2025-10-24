const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  if (!openid) {
    return {
      success: false,
      message: '无法获取用户 openid，请重新登录',
      code: 'NO_OPENID'
    };
  }

  const { userId, skip = 0, limit = 10 } = event;

  if (!userId) {
    return {
      success: false,
      message: '缺少用户ID参数',
      code: 'MISSING_USER_ID'
    };
  }

  try {
    // 查询用户的收藏
    const favoritesResult = await db.collection('favorites')
      .where({
        userId: userId
      })
      .orderBy('favoriteTime', 'desc')
      .skip(skip)
      .limit(limit)
      .get();

    const favorites = favoritesResult.data || [];

    // 获取收藏的帖子详情
    if (favorites.length > 0) {
      const postIds = favorites.map(fav => fav.postId).filter(id => id);
      
      if (postIds.length > 0) {
        const postsResult = await db.collection('posts')
          .where({
            _id: db.command.in(postIds)
          })
          .get();

        const posts = postsResult.data || [];
        const postMap = new Map();
        posts.forEach(post => {
          postMap.set(post._id, post);
        });

        // 将帖子信息合并到收藏中
        favorites.forEach(favorite => {
          const post = postMap.get(favorite.postId);
          if (post) {
            favorite.post = post;
          }
        });
      }
    }

    return {
      success: true,
      favorites: favorites,
      totalCount: favorites.length
    };

  } catch (error) {
    console.error('获取用户收藏失败:', error);
    return {
      success: false,
      message: '获取用户收藏失败',
      error: error.message
    };
  }
};


