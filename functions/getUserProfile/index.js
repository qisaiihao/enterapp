// 云函数入口文件
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const $ = db.command.aggregate;

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const currentOpenid = wxContext.OPENID || event.openid;

  if (!currentOpenid) {
    return {
      success: false,
      message: '无法获取用户 openid，请重新登录',
      code: 'NO_OPENID'
    };
  }

  const { userId, skip = 0, limit = 20, onlyProfile = false } = event;
  console.log('【getUserProfile云函数】收到参数:', { userId, skip, limit, onlyProfile });

  if (!userId) {
    return { success: false, message: '用户ID不能为空' };
  }

  try {
    // 检查是否屏蔽了目标用户
    let isBlocked = false;
    try {
      const blockRes = await db.collection('blocks').where({
        blockerId: currentOpenid,
        blockedId: userId
      }).limit(1).get();
      isBlocked = blockRes.data.length > 0;
      
      // 如果当前用户屏蔽了目标用户，返回错误
      if (isBlocked) {
        return {
          success: false,
          message: '无法查看该用户的信息',
          code: 'USER_BLOCKED'
        };
      }
    } catch (blockError) {
      console.error('检查屏蔽状态失败:', blockError);
    }

    // 获取被屏蔽的用户ID列表（用于过滤帖子，使用缓存）
    let blockedUserIds = [];
    try {
      const getBlockedUserIds = require('../_lib/get-blocked-user-ids');
      blockedUserIds = await getBlockedUserIds(currentOpenid, db);
    } catch (blockError) {
      console.error('获取屏蔽列表失败:', blockError);
    }

    // 获取目标用户的公开信息（如果只需要用户信息，跳过帖子查询）
    let profileData;
    if (onlyProfile) {
      // 轻量级模式：只获取用户信息，不查询帖子
      profileData = await db.collection('users')
        .where({ _openid: userId })
        .field({
          _id: 1,
          _openid: 1,
          nickName: 1,
          avatarUrl: 1,
          bio: 1,
          occupation: 1,
          region: 1,
          signatureUrl: 1,
          poemId: 1,
          growthCounts: 1
        })
        .limit(1)
        .get();
      
      // 转换为与 aggregate 相同的格式
      profileData = { list: profileData.data };
    } else {
      // 完整模式：获取用户信息和帖子
      profileData = await db.collection('users').aggregate()
        .match({ _openid: userId })
        .limit(1)
        .lookup({
          from: 'posts',
          let: { user_openid: '$_openid' },
          pipeline: [
            { 
              $match: { 
                $expr: { 
                  $eq: ['$_openid', '$$user_openid']
                } 
              } 
            },
            { $sort: { createTime: -1 } },
            { $skip: skip },
            { $limit: limit }
          ],
          as: 'posts'
        })
        .project({
          _id: 1,
          _openid: 1,
          nickName: 1,
          avatarUrl: 1,
          bio: 1,
          occupation: 1,
          region: 1,
          signatureUrl: 1,
          poemId: 1,
          growthCounts: 1,
          // 不返回隐私信息（生日、年龄等）
          posts: 1
        })
        .end();
    }

    if (!profileData.list || profileData.list.length === 0) {
      return { success: false, message: '用户不存在' };
    }

    const userInfo = profileData.list[0];
    let posts = onlyProfile ? [] : (userInfo.posts || []);
    
    // 只有在非轻量级模式下才处理帖子
    if (!onlyProfile) {
      // 非本人访问时，过滤掉隐藏帖和被屏蔽用户的帖子
      try {
        const isOwner = String(currentOpenid) === String(userId);
        if (!isOwner && Array.isArray(posts)) {
          posts = posts.filter((p) => {
            if (!p || p.isHidden === true) return false;
            // 虽然已经检查过是否屏蔽了目标用户，但这里再过滤一次确保安全
            if (blockedUserIds.length > 0 && blockedUserIds.includes(p._openid)) return false;
            return true;
          });
        }
      } catch (filterError) {
        console.error('过滤帖子失败:', filterError);
      }

      // 处理图片URL
      posts.forEach(post => {
        if (!Array.isArray(post.imageUrls)) {
          post.imageUrls = post.imageUrls ? [post.imageUrls] : [];
        }
        if (!Array.isArray(post.originalImageUrls)) {
          post.originalImageUrls = post.originalImageUrls ? [post.originalImageUrls] : [];
        }
      });

      // 转换云存储URL为临时URL
      const fileIDs = [];
      posts.forEach(post => {
        if (post.imageUrl && post.imageUrl.startsWith('cloud://')) {
          fileIDs.push(post.imageUrl);
        }
        if (post.imageUrls && Array.isArray(post.imageUrls)) {
          post.imageUrls.forEach(url => {
            if (url && url.startsWith('cloud://')) {
              fileIDs.push(url);
            }
          });
        }
        if (post.originalImageUrls && Array.isArray(post.originalImageUrls)) {
          post.originalImageUrls.forEach(url => {
            if (url && url.startsWith('cloud://')) {
              fileIDs.push(url);
            }
          });
        }
      });

      // 处理用户头像URL和签名URL
      if (userInfo.avatarUrl && userInfo.avatarUrl.startsWith('cloud://')) {
        fileIDs.push(userInfo.avatarUrl);
      }
      if (userInfo.signatureUrl && userInfo.signatureUrl.startsWith('cloud://')) {
        fileIDs.push(userInfo.signatureUrl);
      }

      if (fileIDs.length > 0) {
        try {
          const fileListResult = await cloud.getTempFileURL({ fileList: fileIDs });
          const urlMap = new Map();
          fileListResult.fileList.forEach(item => {
            if (item.status === 0) {
              urlMap.set(item.fileID, item.tempFileURL);
            }
          });

          // 转换帖子图片URL
          posts.forEach(post => {
            if (post.imageUrl && urlMap.has(post.imageUrl)) {
              post.imageUrl = urlMap.get(post.imageUrl);
            }
            if (post.imageUrls && Array.isArray(post.imageUrls)) {
              post.imageUrls = post.imageUrls.map(url => {
                return urlMap.has(url) ? urlMap.get(url) : url;
              });
            }
            if (post.originalImageUrls && Array.isArray(post.originalImageUrls)) {
              post.originalImageUrls = post.originalImageUrls.map(url => {
                return urlMap.has(url) ? urlMap.get(url) : url;
              });
            }
          });

          // 转换用户头像URL和签名URL
          if (userInfo.avatarUrl && urlMap.has(userInfo.avatarUrl)) {
            userInfo.avatarUrl = urlMap.get(userInfo.avatarUrl);
            console.log('✅ 头像URL转换成功:', userInfo.avatarUrl);
          } else if (userInfo.avatarUrl && userInfo.avatarUrl.startsWith('cloud://')) {
            console.warn('⚠️ 头像URL转换失败，使用默认头像:', userInfo.avatarUrl);
            userInfo.avatarUrl = '/static/images/avatar.png';
          }
          if (userInfo.signatureUrl && urlMap.has(userInfo.signatureUrl)) {
            userInfo.signatureUrl = urlMap.get(userInfo.signatureUrl);
          } else if (userInfo.signatureUrl && userInfo.signatureUrl.startsWith('cloud://')) {
            console.warn('⚠️ 签名URL转换失败:', userInfo.signatureUrl);
            userInfo.signatureUrl = null;
          }
        } catch (fileError) {
          console.error('文件URL转换失败:', fileError);
        }
      }

      // 批量获取所有帖子的评论数量（优化：并行查询而不是串行）
      if (posts.length > 0) {
        const postIds = posts.map(p => p._id);
        try {
          // 使用 aggregate 批量统计评论数
          const commentCountsAgg = await db.collection('comments').aggregate()
            .match({
              postId: db.command.in(postIds)
            })
            .group({
              _id: '$postId',
              count: $.sum(1)
            })
            .end();
          
          // 创建评论数映射
          const commentCountMap = new Map();
          if (commentCountsAgg.list && commentCountsAgg.list.length > 0) {
            commentCountsAgg.list.forEach(item => {
              commentCountMap.set(item._id, item.count);
            });
          }
          
          // 为每个帖子设置评论数
          posts.forEach(post => {
            post.commentCount = commentCountMap.get(post._id) || 0;
          });
        } catch (err) {
          console.error('批量获取评论数量失败:', err);
          // 失败时设置默认值
          posts.forEach(post => {
            post.commentCount = 0;
          });
        }

        // 检查当前用户是否点赞了这些帖子
        try {
          const votesResult = await db.collection('votes_log')
            .where({
              _openid: currentOpenid,
              postId: db.command.in(postIds)
            })
            .get();

          const votedPostIds = new Set(votesResult.data.map(v => v.postId));
          posts.forEach(post => {
            post.isVoted = votedPostIds.has(post._id);
          });
        } catch (err) {
          console.error('获取点赞状态失败:', err);
          posts.forEach(post => {
            post.isVoted = false;
          });
        }
      }
    }

    // 处理用户头像和签名URL（轻量级模式或posts为空时）
    if (onlyProfile || posts.length === 0) {
      const fileIDs = [];
      if (userInfo.avatarUrl && userInfo.avatarUrl.startsWith('cloud://')) {
        fileIDs.push(userInfo.avatarUrl);
      }
      if (userInfo.signatureUrl && userInfo.signatureUrl.startsWith('cloud://')) {
        fileIDs.push(userInfo.signatureUrl);
      }
      
      if (fileIDs.length > 0) {
        try {
          const fileListResult = await cloud.getTempFileURL({ fileList: fileIDs });
          const urlMap = new Map();
          fileListResult.fileList.forEach(item => {
            if (item.status === 0) {
              urlMap.set(item.fileID, item.tempFileURL);
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
    }

    console.log('【getUserProfile云函数】最终返回 posts 数量:', posts.length, 'onlyProfile:', onlyProfile);

    return {
      success: true,
            userInfo: {
        _openid: userInfo._openid,
        nickName: userInfo.nickName || '微信用户',
        avatarUrl: userInfo.avatarUrl || '',
        occupation: userInfo.occupation || '',
        region: userInfo.region || '',
        bio: userInfo.bio || '这个人很懒，什么都没有写...',
        signatureUrl: userInfo.signatureUrl || '',
        poemId: userInfo.poemId || '',
        growthCounts: userInfo.growthCounts || { seed: 0, leaf: 0, flower: 0, peach: 0 }
      },
      posts: posts
    };

  } catch (e) {
    console.error('【getUserProfile云函数】错误:', e);
    return {
      success: false,
      error: e.message || '获取用户信息失败'
    };
  }
};



