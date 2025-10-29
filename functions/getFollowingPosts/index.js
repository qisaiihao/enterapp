const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID || event.openid;

  if (!openid) {
    return {
      success: false,
      message: '无法获取用户 openid，请重新登录',
      code: 'NO_OPENID'
    };
  }

  const { skip = 0, limit = 10 } = event;

  try {
    // 1. 获取用户关注列表
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

    const followedIds = followsRes.data.map(item => item.followedId);

    // 2. 获取关注用户的帖子
    const postsRes = await db.collection('posts')
      .where({
        _openid: _.in(followedIds),
        // 只获取已审核通过的帖子
        auditStatus: 'approved',
        // 不显示隐藏的帖子
        isHidden: _.neq(true)
      })
      .orderBy('createTime', 'desc')
      .skip(skip)
      .limit(limit)
      .get();

    // 3. 获取帖子作者信息
    const authorIds = [...new Set(postsRes.data.map(post => post._openid))];
    
    const authorsRes = await db.collection('users')
      .where({ _openid: _.in(authorIds) })
      .field({
        _openid: true,
        nickName: true,
        avatarUrl: true
      })
      .get();

    const authorMap = new Map();
    authorsRes.data.forEach(author => {
      authorMap.set(author._openid, author);
    });

    // 4. 组装帖子数据
    const posts = postsRes.data.map(post => {
      const author = authorMap.get(post._openid) || {};
      return {
        ...post,
        authorName: author.nickName || '微信用户',
        authorAvatar: author.avatarUrl || '',
        isAnonymous: post.isAnonymous || false
      };
    });

    // 5. 处理头像URL
    await enrichAvatarUrls(posts);

    // 6. 获取总数（用于判断是否还有更多）
    const totalRes = await db.collection('posts')
      .where({
        _openid: _.in(followedIds),
        // 只统计已审核通过的帖子
        auditStatus: 'approved',
        // 不统计隐藏的帖子
        isHidden: _.neq(true)
      })
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

// 处理头像URL
async function enrichAvatarUrls(list) {
  const fileIDs = Array.from(new Set(
    list
      .filter(user => user.authorAvatar && user.authorAvatar.startsWith('cloud://'))
      .map(user => user.authorAvatar)
  ));

  if (fileIDs.length === 0) {
    return;
  }

  try {
    const tempUrls = await cloud.getTempFileURL({ fileList: fileIDs });
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
    });
  } catch (error) {
    console.error('处理头像URL失败:', error);
  }
}
