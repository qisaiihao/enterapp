const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const currentOpenid = wxContext.OPENID || event.openid;

  console.log('【getUserFavorites云函数】收到完整event参数:', event);
  console.log('【getUserFavorites云函数】wxContext:', wxContext);
  const { userId, skip = 0, limit = 10 } = event;

  if (!userId) {
    return {
      success: false,
      message: '缺少用户ID参数',
      code: 'MISSING_USER_ID'
    };
  }

  console.log('【getUserFavorites云函数】查询用户收藏，userId:', userId);

  try {
    // 直接使用 _openid 字段查询收藏
    const favoritesResult = await db.collection('favorites')
      .where({
        _openid: userId
      })
      .orderBy('createTime', 'desc')
      .skip(skip)
      .limit(limit)
      .get();

    console.log('【getUserFavorites云函数】查询结果数量:', favoritesResult.data.length);

    const favorites = favoritesResult.data || [];

    // 获取收藏的帖子详情
    if (favorites.length > 0) {
      const postIds = favorites.map(fav => fav.postId).filter(id => id);
      console.log('【getUserFavorites云函数】找到的postId列表:', postIds);

      if (postIds.length > 0) {
        const postsResult = await db.collection('posts')
          .where({
            _id: db.command.in(postIds)
          })
          .get();

        const posts = postsResult.data || [];
        console.log('【getUserFavorites云函数】找到的帖子数量:', posts.length);
        const postMap = new Map();
        posts.forEach(post => {
          postMap.set(post._id, post);
        });

        // 将帖子信息合并到收藏中
        favorites.forEach(favorite => {
          const post = postMap.get(favorite.postId);
          if (post) {
            favorite.post = post;
            // 添加收藏时间字段供前端使用
            favorite.favoriteTime = favorite.createTime;
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




