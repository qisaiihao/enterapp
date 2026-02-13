// 混合推荐云函数 - 简化版本，避免云函数间调用
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;
const $ = _.aggregate;

exports.main = async (event, context) => {
  const requestStart = Date.now();
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID || event.openid;
  const {
    personalizedLimit = 3,
    hotLimit = 2,
    limit: userLimit,
    skip = 0,
    excludePostIds = [] // 排除已显示的帖子ID
  } = event;
  const openId = openid;
  const debug = !!(event && event.debug);

  const maskId = (id) => {
    if (!id || typeof id !== 'string') return '';
    if (id.length <= 8) return id;
    return `${id.slice(0, 3)}***${id.slice(-3)}`;
  };

  console.log('[reco] start', {
    openid: maskId(openid),
    skip,
    userLimit,
    personalizedLimit,
    hotLimit,
    excludeCount: Array.isArray(excludePostIds) ? excludePostIds.length : 0
  });

  if (!openid) {
    console.warn('[reco] no openid');
    return {
      success: false,
      message: '无法获取用户 openid，请重新登录',
      code: 'NO_OPENID'
    };
  }

  try {
    // 获取被屏蔽的用户ID列表（使用缓存）
    let blockedUserIds = [];
    try {
      const getBlockedUserIds = require('../_lib/get-blocked-user-ids');
      blockedUserIds = await getBlockedUserIds(openid, db);
    } catch (blockError) {
      console.error('获取屏蔽列表失败:', blockError);
    }
    console.log('[reco] blocked', { count: blockedUserIds.length });

    const baseLimit = typeof userLimit === 'number' && userLimit > 0 ? userLimit : personalizedLimit + hotLimit;
    const targetCount = Math.max(baseLimit + skip, 0);
    const allPosts = [];
    const usedPostIds = new Set(excludePostIds);

    // 先检查数据库中是否有帖子数据
    const totalPostsCount = await db.collection('posts').count();
    if (debug) {
      console.log('[reco] totals', { totalPostsCount: totalPostsCount.total });
    }

    // 1. 获取个性化推荐（基于用户互动记录）
    let remaining = targetCount - allPosts.length;
    if (remaining > 0) {
      const personalizedPosts = await getPersonalizedPosts(openId, Math.min(personalizedLimit, remaining), usedPostIds);
      if (personalizedPosts.length > 0) {
        personalizedPosts.forEach(post => {
          post.recommendationType = 'personalized';
          post.recommendationReason = '基于你的兴趣推荐';
          usedPostIds.add(post._id);
        });
        allPosts.push(...personalizedPosts);
      }
      console.log('[reco] personalized', { count: personalizedPosts.length, remaining: targetCount - allPosts.length });
    }

    remaining = targetCount - allPosts.length;
    if (remaining > 0) {
      const tagBasedPosts = await getTagBasedPosts(openId, Math.min(personalizedLimit, remaining), usedPostIds);
      if (tagBasedPosts.length > 0) {
        tagBasedPosts.forEach(post => {
          post.recommendationType = 'tag_based';
          post.recommendationReason = '基于热门标签推荐';
          usedPostIds.add(post._id);
        });
        allPosts.push(...tagBasedPosts);
      }
      console.log('[reco] tag_based', { count: tagBasedPosts.length, remaining: targetCount - allPosts.length });
    }

    remaining = targetCount - allPosts.length;
    if (remaining > 0) {
      const hotPosts = await getHotPosts(Math.min(hotLimit, remaining), Array.from(usedPostIds), openId);
      if (hotPosts.length > 0) {
        hotPosts.forEach(post => {
          post.recommendationType = 'hot';
          post.recommendationReason = '热门内容';
          usedPostIds.add(post._id);
        });
        allPosts.push(...hotPosts);
      }
      console.log('[reco] hot', { count: hotPosts.length, remaining: targetCount - allPosts.length });
    }

    remaining = targetCount - allPosts.length;
    if (remaining > 0) {
      const additionalHotPosts = await getHotPosts(remaining, Array.from(usedPostIds), openId);
      if (additionalHotPosts.length > 0) {
        additionalHotPosts.forEach(post => {
          post.recommendationType = 'hot';
          post.recommendationReason = '热门内容';
          usedPostIds.add(post._id);
        });
        allPosts.push(...additionalHotPosts);
        remaining = targetCount - allPosts.length;
      }
      console.log('[reco] hot_extra', { count: additionalHotPosts.length, remaining });
    }

    remaining = targetCount - allPosts.length;
    if (remaining > 0) {
      const latestPosts = await getLatestPosts(remaining, Array.from(usedPostIds), openId);
      if (latestPosts.length > 0) {
        latestPosts.forEach(post => {
          post.recommendationType = 'latest';
          post.recommendationReason = '最新内容';
          usedPostIds.add(post._id);
        });
        allPosts.push(...latestPosts);
      }
      console.log('[reco] latest', { count: latestPosts.length, remaining: targetCount - allPosts.length });
    }

    // 4. 按时间排序并分页
    const uniqueMap = new Map();
    allPosts.forEach((post) => {
      if (post && post._id && !uniqueMap.has(post._id)) {
        uniqueMap.set(post._id, post);
      }
    });

    const sortedPosts = Array.from(uniqueMap.values()).sort((a, b) => {
      const timeA = a && a.createTime ? new Date(a.createTime).getTime() : 0;
      const timeB = b && b.createTime ? new Date(b.createTime).getTime() : 0;
      return timeB - timeA;
    });

    const finalPosts = sortedPosts.slice(skip, skip + baseLimit);
    const hasMore = sortedPosts.length > skip + baseLimit;

    const elapsedMs = Date.now() - requestStart;
    console.log('[reco] done', {
      total: finalPosts.length,
      hasMore,
      counts: {
        personalized: finalPosts.filter(p => p.recommendationType === 'personalized').length,
        tagBased: finalPosts.filter(p => p.recommendationType === 'tag_based').length,
        hot: finalPosts.filter(p => p.recommendationType === 'hot').length,
        latest: finalPosts.filter(p => p.recommendationType === 'latest').length
      },
      elapsedMs
    });

    return {
      success: true,
      posts: finalPosts,
      total: finalPosts.length,
      hasMore,
      personalizedCount: finalPosts.filter(p => p.recommendationType === 'personalized').length,
      tagBasedCount: finalPosts.filter(p => p.recommendationType === 'tag_based').length,
      hotCount: finalPosts.filter(p => p.recommendationType === 'hot').length,
      latestCount: finalPosts.filter(p => p.recommendationType === 'latest').length
    };

  } catch (error) {
    console.error('混合推荐失败:', error);
    return {
      success: false,
      message: '推荐失败',
      error: error.message
    };
  }
};

// 获取个性化推荐帖子
async function getPersonalizedPosts(openId, limit, usedPostIds) {
  try {
    // 获取用户最近的互动记录
    const BATCH_SIZE = 30; // 减少查询数量
    
    const voteRes = await db.collection('votes_log')
      .where({ 
        _openid: openId,
        type: 'post'
      })
      .orderBy('createTime', 'desc')
      .limit(BATCH_SIZE)
      .get();

    const viewRes = await db.collection('view_log')
      .where({ 
        _openid: openId,
        type: 'view'
      })
      .orderBy('createTime', 'desc')
      .limit(BATCH_SIZE)
      .get();

    const allInteractions = [
      ...voteRes.data.map(item => ({ ...item, interactionType: 'vote' })),
      ...viewRes.data.map(item => ({ ...item, interactionType: 'view' }))
    ].sort((a, b) => new Date(b.createTime) - new Date(a.createTime));

    if (allInteractions.length === 0) {
      return [];
    }

    const interactedPostIds = allInteractions.map(item => item.postId);

    // 获取用户互动过的帖子信息
    const postsRes = await db.collection('posts')
      .where({
        _id: _.in(interactedPostIds)
      })
      .field({
        _openid: true,
        tags: true
      })
      .limit(20) // 限制查询数量
      .get();

    const interestedAuthorIds = new Set();
    const interestedTags = new Set();

    postsRes.data.forEach(post => {
      interestedAuthorIds.add(post._openid);
      if (post.tags && Array.isArray(post.tags)) {
        post.tags.forEach(tag => interestedTags.add(tag));
      }
    });

    // 获取被屏蔽的用户ID列表（使用缓存）
    let blockedUserIds = [];
    try {
      const getBlockedUserIds = require('../_lib/get-blocked-user-ids');
      blockedUserIds = await getBlockedUserIds(openId, db);
    } catch (blockError) {
      console.error('获取屏蔽列表失败:', blockError);
    }

    // 查找相似内容
    const matchConditions = {
      _id: _.nin([...interactedPostIds, ...usedPostIds])
      // 移除isOriginal限制，推荐所有类型的帖子
    };

    // 过滤被屏蔽用户的帖子（包括匿名帖子的realAuthorOpenid）
    if (blockedUserIds.length > 0) {
      matchConditions.$and = [
        { _openid: _.nin(blockedUserIds) },
        {
          $or: [
            { realAuthorOpenid: _.exists(false) }, // 不存在 realAuthorOpenid（非匿名帖子）
            { realAuthorOpenid: _.eq(null) }, // realAuthorOpenid 为 null
            { realAuthorOpenid: _.nin(blockedUserIds) } // realAuthorOpenid 不在屏蔽列表中
          ]
        }
      ];
    }

    if (interestedAuthorIds.size > 0 || interestedTags.size > 0) {
      const orConditions = [];
      
      if (interestedAuthorIds.size > 0) {
        orConditions.push({ _openid: _.in(Array.from(interestedAuthorIds)) });
      }
      
      if (interestedTags.size > 0) {
        orConditions.push({ tags: _.in(Array.from(interestedTags)) });
      }
      
      if (orConditions.length > 0) {
        matchConditions.$or = orConditions;
      }
    }

    const personalizedResult = await db.collection('posts').aggregate()
      .match(matchConditions)
      .sort({ createTime: -1 })
      .limit(limit)
      .lookup({
        from: 'votes_log',
        let: { post_id: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$postId', '$$post_id'] },
                  { $eq: ['$_openid', openId] },
                  { $eq: ['$type', 'post'] } // 只查询帖子点赞记录，排除评论点赞记录
                ]
              }
            }
          }
        ],
        as: 'userVote',
      })
      .project({
        _id: '$_id',
        _openid: '$_openid',
        title: '$title',
        content: '$content',
        createTime: '$createTime',
        imageUrl: '$imageUrl',
        imageUrls: '$imageUrls',
        originalImageUrl: '$originalImageUrl',
        originalImageUrls: '$originalImageUrls',
        votes: '$votes',
        isPoem: '$isPoem',
        isOriginal: '$isOriginal',
        poemBgImage: '$poemBgImage',
        tags: '$tags',
        authorName: $.ifNull([
          '$authorName',
          $.ifNull(['$authorNameSnapshot', '匿名用户'])
        ]),
        authorAvatar: $.ifNull([
          '$authorAvatar',
          $.ifNull(['$authorAvatarSnapshot', ''])
        ]),
        commentCount: $.ifNull(['$commentCount', 0]),
        isVoted: $.gt([$.size('$userVote'), 0]),
      })
      .end();

    return await processPostsData(personalizedResult.list || [], openId);

  } catch (error) {
    console.error('获取个性化推荐失败:', error);
    return [];
  }
}

// 获取热门推荐帖子
async function getHotPosts(limit, excludePostIds, openId) {
  try {
    // 获取被屏蔽的用户ID列表（使用缓存）
    let blockedUserIds = [];
    try {
      const getBlockedUserIds = require('../_lib/get-blocked-user-ids');
      blockedUserIds = await getBlockedUserIds(openId, db);
    } catch (blockError) {
      console.error('获取屏蔽列表失败:', blockError);
    }
    
    const matchConditions = {
      // 移除isOriginal限制，推荐所有类型的帖子
    };

    // 过滤被屏蔽用户的帖子（包括匿名帖子的realAuthorOpenid）
    if (blockedUserIds.length > 0) {
      matchConditions.$and = [
        { _openid: _.nin(blockedUserIds) },
        {
          $or: [
            { realAuthorOpenid: _.exists(false) }, // 不存在 realAuthorOpenid（非匿名帖子）
            { realAuthorOpenid: _.eq(null) }, // realAuthorOpenid 为 null
            { realAuthorOpenid: _.nin(blockedUserIds) } // realAuthorOpenid 不在屏蔽列表中
          ]
        }
      ];
    }

    if (excludePostIds.length > 0) {
      matchConditions._id = _.nin(excludePostIds);
    }

    const hotResult = await db.collection('posts').aggregate()
      .match(matchConditions)
      .addFields({
        hotScore: {
          $add: [
            { $multiply: [{ $ifNull: ['$votes', 0] }, 2] },
            { $multiply: [{ $ifNull: ['$commentCount', 0] }, 5] }
          ]
        }
      })
      .sort({ hotScore: -1, createTime: -1 })
      .limit(limit)
      .lookup({
        from: 'votes_log',
        let: { post_id: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$postId', '$$post_id'] },
                  { $eq: ['$_openid', openId] },
                  { $eq: ['$type', 'post'] } // 只查询帖子点赞记录，排除评论点赞记录
                ]
              }
            }
          }
        ],
        as: 'userVote',
      })
      .project({
        _id: '$_id',
        _openid: '$_openid',
        title: '$title',
        content: '$content',
        createTime: '$createTime',
        imageUrl: '$imageUrl',
        imageUrls: '$imageUrls',
        originalImageUrl: '$originalImageUrl',
        originalImageUrls: '$originalImageUrls',
        votes: '$votes',
        isPoem: '$isPoem',
        isOriginal: '$isOriginal',
        poemBgImage: '$poemBgImage',
        tags: '$tags',
        hotScore: '$hotScore',
        authorName: $.ifNull([
          '$authorName',
          $.ifNull(['$authorNameSnapshot', '匿名用户'])
        ]),
        authorAvatar: $.ifNull([
          '$authorAvatar',
          $.ifNull(['$authorAvatarSnapshot', ''])
        ]),
        commentCount: $.ifNull(['$commentCount', 0]),
        isVoted: $.gt([$.size('$userVote'), 0]),
      })
      .end();

    return await processPostsData(hotResult.list || [], openId);

  } catch (error) {
    console.error('获取热门推荐失败:', error);
    return [];
  }
}

// 获取最新帖子
async function getLatestPosts(limit, excludePostIds, openId) {
  try {
    // 获取被屏蔽的用户ID列表（使用缓存）
    let blockedUserIds = [];
    try {
      const getBlockedUserIds = require('../_lib/get-blocked-user-ids');
      blockedUserIds = await getBlockedUserIds(openId, db);
    } catch (blockError) {
      console.error('获取屏蔽列表失败:', blockError);
    }
    
    const matchConditions = {
      // 移除isOriginal限制，推荐所有类型的帖子
    };

    // 过滤被屏蔽用户的帖子（包括匿名帖子的realAuthorOpenid）
    if (blockedUserIds.length > 0) {
      matchConditions.$and = [
        { _openid: _.nin(blockedUserIds) },
        {
          $or: [
            { realAuthorOpenid: _.exists(false) }, // 不存在 realAuthorOpenid（非匿名帖子）
            { realAuthorOpenid: _.eq(null) }, // realAuthorOpenid 为 null
            { realAuthorOpenid: _.nin(blockedUserIds) } // realAuthorOpenid 不在屏蔽列表中
          ]
        }
      ];
    }

    if (excludePostIds.length > 0) {
      matchConditions._id = _.nin(excludePostIds);
    }

    const latestResult = await db.collection('posts')
      .where(matchConditions)
      .orderBy('createTime', 'desc')
      .limit(limit)
      .get();

    return await processPostsData(latestResult.data || [], openId);

  } catch (error) {
    console.error('获取最新帖子失败:', error);
    return [];
  }
}

// 数组随机打乱函数
// 处理帖子数据的通用方法
async function processPostsData(posts, openId) {
  if (!posts || posts.length === 0) return [];

  // 处理图片URL转换
  const fileIDs = new Set();
  
  posts.forEach(post => {
    if (!Array.isArray(post.imageUrls)) post.imageUrls = post.imageUrls ? [post.imageUrls] : [];
    if (!Array.isArray(post.originalImageUrls)) post.originalImageUrls = post.originalImageUrls ? [post.originalImageUrls] : [];
    
    const urlsToCheck = [
      ...post.imageUrls,
      ...post.originalImageUrls,
      post.imageUrl,
      post.originalImageUrl,
      post.authorAvatar,
      post.poemBgImage
    ].filter(url => url && url.startsWith('cloud://'));
    
    urlsToCheck.forEach(url => fileIDs.add(url));
  });

  if (fileIDs.size > 0) {
    try {
      const fileListResult = await cloud.getTempFileURL({ fileList: Array.from(fileIDs) });
      const urlMap = new Map();
      
      fileListResult.fileList.forEach(item => {
        if (item.status === 0) {
          urlMap.set(item.fileID, item.tempFileURL);
        }
      });

      posts.forEach(post => {
        const convertUrl = (url) => urlMap.get(url) || url;
        
        if (post.imageUrl) post.imageUrl = convertUrl(post.imageUrl);
        if (post.originalImageUrl) post.originalImageUrl = convertUrl(post.originalImageUrl);
        if (post.authorAvatar) post.authorAvatar = convertUrl(post.authorAvatar);
        if (post.poemBgImage) post.poemBgImage = convertUrl(post.poemBgImage);
        
        if (Array.isArray(post.imageUrls)) {
          post.imageUrls = post.imageUrls.map(convertUrl);
        }
        if (Array.isArray(post.originalImageUrls)) {
          post.originalImageUrls = post.originalImageUrls.map(convertUrl);
        }
      });
    } catch (fileError) {
      console.error('图片URL转换失败:', fileError);
    }
  }

  return posts;
}

// 获取按标签推荐的帖子
async function getTagBasedPosts(openId, limit, usedPostIds) {
  try {
    // 1. 获取所有热门标签（包括原创和非原创帖子）
    const tagsResult = await db.collection('posts').aggregate()
      .unwind('$tags')
      .group({
        _id: '$tags',
        count: { $sum: 1 }
      })
      .sort({ count: -1 })
      .limit(10) // 获取前10个热门标签
      .end();
    
    const popularTags = tagsResult.list || [];
    
    if (popularTags.length === 0) {
      return [];
    }
    
    // 2. 根据热门标签推荐帖子（包括原创和非原创）
    const tagNames = popularTags.map(tag => tag._id);
    
    // 获取被屏蔽的用户ID列表（使用缓存）
    let blockedUserIds = [];
    try {
      const getBlockedUserIds = require('../_lib/get-blocked-user-ids');
      blockedUserIds = await getBlockedUserIds(openId, db);
    } catch (blockError) {
      console.error('获取屏蔽列表失败:', blockError);
    }
    
    const matchConditions = {
      tags: _.in(tagNames)
      // 移除isOriginal限制，推荐所有类型的帖子
    };
    
    if (usedPostIds.length > 0) {
      matchConditions._id = _.nin(Array.from(usedPostIds));
    }
    
    // 过滤被屏蔽用户的帖子（包括匿名帖子的realAuthorOpenid）
    if (blockedUserIds.length > 0) {
      // 如果已经有 $and 条件，需要合并
      if (matchConditions.$and) {
        matchConditions.$and.push(
          { _openid: _.nin(blockedUserIds) },
          {
            $or: [
              { realAuthorOpenid: _.exists(false) },
              { realAuthorOpenid: _.eq(null) },
              { realAuthorOpenid: _.nin(blockedUserIds) }
            ]
          }
        );
      } else {
        matchConditions.$and = [
          { _openid: _.nin(blockedUserIds) },
          {
            $or: [
              { realAuthorOpenid: _.exists(false) },
              { realAuthorOpenid: _.eq(null) },
              { realAuthorOpenid: _.nin(blockedUserIds) }
            ]
          }
        ];
      }
    }
    
    const tagBasedResult = await db.collection('posts').aggregate()
      .match(matchConditions)
      .addFields({
        tagScore: {
          $size: {
            $setIntersection: ['$tags', tagNames]
          }
        }
      })
      .sort({ tagScore: -1, createTime: -1 })
      .limit(limit)
      .lookup({
        from: 'votes_log',
        let: { post_id: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$postId', '$$post_id'] },
                  { $eq: ['$_openid', openId] },
                  { $eq: ['$type', 'post'] } // 只查询帖子点赞记录，排除评论点赞记录
                ]
              }
            }
          }
        ],
        as: 'userVote',
      })
      .project({
        _id: '$_id',
        _openid: '$_openid',
        title: '$title',
        content: '$content',
        createTime: '$createTime',
        imageUrl: '$imageUrl',
        imageUrls: '$imageUrls',
        originalImageUrl: '$originalImageUrl',
        originalImageUrls: '$originalImageUrls',
        votes: '$votes',
        isPoem: '$isPoem',
        isOriginal: '$isOriginal',
        poemBgImage: '$poemBgImage',
        tags: '$tags',
        tagScore: '$tagScore',
        authorName: $.ifNull([
          '$authorName',
          $.ifNull(['$authorNameSnapshot', '匿名用户'])
        ]),
        authorAvatar: $.ifNull([
          '$authorAvatar',
          $.ifNull(['$authorAvatarSnapshot', ''])
        ]),
        commentCount: $.ifNull(['$commentCount', 0]),
        isVoted: $.gt([$.size('$userVote'), 0]),
      })
      .end();
    
    return await processPostsData(tagBasedResult.list || [], openId);
    
  } catch (error) {
    console.error('获取按标签推荐失败:', error);
    return [];
  }
}
