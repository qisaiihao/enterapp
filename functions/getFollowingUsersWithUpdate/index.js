const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;
const $ = db.command.aggregate;

/**
 * 获取关注用户列表（按最近发帖时间排序）
 * 用于关注页顶部的头像栏展示
 */
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = event.openid || wxContext.OPENID;

  if (!openid) {
    return {
      success: false,
      message: '无法获取用户 openid，请重新登录',
      code: 'NO_OPENID'
    };
  }

  const { limit = 50 } = event;

  try {
    // 1. 获取用户关注列表
    const followsRes = await db.collection('follows')
      .where({ followerId: openid })
      .orderBy('createTime', 'desc')
      .limit(200) // 最多获取200个关注
      .get();

    if (followsRes.data.length === 0) {
      return {
        success: true,
        users: [],
        total: 0
      };
    }

    const followedIds = followsRes.data.map(item => item.followedId);

    // 2. 获取关注用户的基本信息
    const usersRes = await db.collection('users')
      .where({ _openid: _.in(followedIds) })
      .field({
        _openid: true,
        nickName: true,
        avatarUrl: true
      })
      .get();

    const userMap = new Map();
    usersRes.data.forEach(user => {
      userMap.set(user._openid, {
        _openid: user._openid,
        nickName: user.nickName || '微信用户',
        avatarUrl: user.avatarUrl || '',
        lastPostTime: null
      });
    });

    // 3. 获取每个用户的最近发帖时间
    // 使用聚合查询获取每个用户最近的帖子时间
    const postsAggRes = await db.collection('posts')
      .aggregate()
      .match({
        _openid: _.in(followedIds),
        auditStatus: 'approved',
        isHidden: _.neq(true)
      })
      .group({
        _id: '$_openid',
        lastPostTime: $.max('$createTime')
      })
      .end();

    // 更新用户的最近发帖时间
    if (postsAggRes.list && postsAggRes.list.length > 0) {
      postsAggRes.list.forEach(item => {
        if (userMap.has(item._id)) {
          userMap.get(item._id).lastPostTime = item.lastPostTime;
        }
      });
    }

    // 4. 转换为数组并按最近发帖时间排序
    let users = Array.from(userMap.values());
    
    // 排序：有发帖时间的按时间倒序，没有发帖的放最后
    users.sort((a, b) => {
      if (a.lastPostTime && b.lastPostTime) {
        return new Date(b.lastPostTime) - new Date(a.lastPostTime);
      }
      if (a.lastPostTime && !b.lastPostTime) return -1;
      if (!a.lastPostTime && b.lastPostTime) return 1;
      return 0;
    });

    // 5. 限制返回数量
    users = users.slice(0, limit);

    // 6. 处理头像URL
    await enrichAvatarUrls(users);

    return {
      success: true,
      users,
      total: users.length
    };

  } catch (error) {
    console.error('获取关注用户列表失败:', error);
    return {
      success: false,
      message: '获取用户列表失败',
      error: error.message
    };
  }
};

// 处理头像URL
async function enrichAvatarUrls(list) {
  const fileIDs = Array.from(new Set(
    list
      .filter(user => user.avatarUrl && user.avatarUrl.startsWith('cloud://'))
      .map(user => user.avatarUrl)
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

    list.forEach(user => {
      if (user.avatarUrl && urlMap.has(user.avatarUrl)) {
        user.avatarUrl = urlMap.get(user.avatarUrl);
      }
    });
  } catch (error) {
    console.error('处理头像URL失败:', error);
  }
}
