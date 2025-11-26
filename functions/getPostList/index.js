// 云函数入口文件
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;
const $ = _.aggregate;

// 频率限制配置
const RATE_LIMITS = {
  perMinute: 20,    // 每分钟20次
  perHour: 200,     // 每小时200次
  perDay: 600       // 每天600次
};

// 频率限制检查函数
async function checkRateLimit(openid) {
  try {
    const now = Date.now();
    const minuteAgo = now - 60 * 1000;
    const hourAgo = now - 60 * 60 * 1000;
    const dayAgo = now - 24 * 60 * 60 * 1000;

    console.log('🔍 [RateLimit] 开始检查频率限制 - openid:', openid.substring(0, 8) + '...');

    // 检查分钟级限制
    const minuteCount = await db.collection('api_rate_limits')
      .where({
        openid: openid,
        api_name: 'getPostList',
        timestamp: _.gte(minuteAgo)
      })
      .count();

    if (minuteCount.total >= RATE_LIMITS.perMinute) {
      console.log('🚫 [RateLimit] 分钟级限制超限:', minuteCount.total, '/', RATE_LIMITS.perMinute);
      return {
        allowed: false,
        reason: 'RATE_LIMIT_MINUTE_EXCEEDED',
        resetTime: minuteAgo + 60000,
        limit: RATE_LIMITS.perMinute,
        current: minuteCount.total,
        waitSeconds: Math.ceil((minuteAgo + 60000 - now) / 1000)
      };
    }

    // 检查小时级限制
    const hourCount = await db.collection('api_rate_limits')
      .where({
        openid: openid,
        api_name: 'getPostList',
        timestamp: _.gte(hourAgo)
      })
      .count();

    if (hourCount.total >= RATE_LIMITS.perHour) {
      console.log('🚫 [RateLimit] 小时级限制超限:', hourCount.total, '/', RATE_LIMITS.perHour);
      return {
        allowed: false,
        reason: 'RATE_LIMIT_HOUR_EXCEEDED',
        resetTime: hourAgo + 3600000,
        limit: RATE_LIMITS.perHour,
        current: hourCount.total,
        waitSeconds: Math.ceil((hourAgo + 3600000 - now) / 1000)
      };
    }

    // 检查日级限制
    const dayCount = await db.collection('api_rate_limits')
      .where({
        openid: openid,
        api_name: 'getPostList',
        timestamp: _.gte(dayAgo)
      })
      .count();

    if (dayCount.total >= RATE_LIMITS.perDay) {
      console.log('🚫 [RateLimit] 日级限制超限:', dayCount.total, '/', RATE_LIMITS.perDay);
      return {
        allowed: false,
        reason: 'RATE_LIMIT_DAY_EXCEEDED',
        resetTime: dayAgo + 86400000,
        limit: RATE_LIMITS.perDay,
        current: dayCount.total,
        waitSeconds: Math.ceil((dayAgo + 86400000 - now) / 1000)
      };
    }

    // 记录本次请求
    await db.collection('api_rate_limits').add({
      data: {
        openid: openid,
        api_name: 'getPostList',
        timestamp: now
      }
    });

    // 定期清理过期记录（1%概率执行）
    if (Math.random() < 0.01) {
      try {
        await db.collection('api_rate_limits')
          .where({
            timestamp: _.lt(dayAgo)
          })
          .remove();
        console.log('🧹 [RateLimit] 清理过期记录完成');
      } catch (cleanupError) {
        console.warn('⚠️ [RateLimit] 清理过期记录失败:', cleanupError);
      }
    }

    console.log('✅ [RateLimit] 频率检查通过 - 当前分钟:', minuteCount.total + 1, '小时:', hourCount.total + 1, '日:', dayCount.total + 1);
    return {
      allowed: true,
      currentCounts: {
        perMinute: minuteCount.total + 1,
        perHour: hourCount.total + 1,
        perDay: dayCount.total + 1
      }
    };

  } catch (error) {
    console.error('❌ [RateLimit] 频率限制检查失败:', error);
    // 检查失败时允许通过，避免影响正常用户
    return { allowed: true };
  }
}

// 云函数入口函数
exports.main = async (event, context) => {
  console.log('🔍 [getPostList] ========== 云函数开始执行 ==========');
  console.log('🔍 [getPostList] 接收到的参数:', JSON.stringify(event, null, 2));
  
  const wxContext = cloud.getWXContext();
  const wxCtxOpenid = wxContext.OPENID;
  const eventOpenid = event.openid;
  const openid = eventOpenid || wxCtxOpenid;
  const { skip = 0, limit = 10, isPoem, isOriginal, isDiscussion, tag = '' } = event; // 添加isPoem、isOriginal、isDiscussion和tag参数

  console.log('🔍 [getPostList] 解析参数:', {
    eventOpenid: eventOpenid ? '提供' : '未提供',
    wxCtxOpenid: wxCtxOpenid ? '提供' : '未提供',
    chosenOpenidSource: eventOpenid ? 'event.openid' : 'wxContext.OPENID',
    chosenOpenidExists: !!openid,
    skip,
    limit,
    isPoem,
    isOriginal,
    isDiscussion,
    tag
  });

  if (!openid) {
    console.error('❌ [getPostList] 无法获取用户 openid');
    return {
      success: false,
      message: '无法获取用户 openid，请重新登录',
      code: 'NO_OPENID'
    };
  }

  // 检查请求频率限制（临时禁用以排查超时问题）
  // TODO: 优化频率限制检查逻辑后重新启用
  /*
  const rateLimitResult = await checkRateLimit(openid);
  if (!rateLimitResult.allowed) {
    console.log('🚫 [getPostList] 频率限制拦截:', rateLimitResult.reason);
    return {
      success: false,
      code: rateLimitResult.reason,
      message: `请求过于频繁，请在${rateLimitResult.waitSeconds}秒后重试`,
      data: {
        limit: rateLimitResult.limit,
        current: rateLimitResult.current,
        resetTime: rateLimitResult.resetTime,
        waitSeconds: rateLimitResult.waitSeconds
      }
    };
  }
  */

  try {
    console.log('🔍 [getPostList] 开始构建查询');

    // 获取被屏蔽的用户ID列表（使用缓存）
    let blockedUserIds = [];
    try {
      const getBlockedUserIds = require('../_lib/get-blocked-user-ids');
      blockedUserIds = await getBlockedUserIds(openid, db);
      console.log('🔍 [getPostList] 被屏蔽的用户数量:', blockedUserIds.length);
    } catch (blockError) {
      console.error('❌ [getPostList] 获取屏蔽列表失败:', blockError);
    }

    let query = db.collection('posts').aggregate();

    // 构建筛选条件
    const matchConditions = { isHidden: _.neq(true) };
    
    // 如果指定了isPoem参数，添加诗歌筛选条件
    if (isPoem !== undefined) {
      if (isPoem === true) {
        // 只获取诗歌：isPoem 必须为 true
        matchConditions.isPoem = true;
      } else {
        // 只获取非诗歌：isPoem 为 false 或不存在（$ne: true 会匹配 false、null 和不存在的字段）
        matchConditions.isPoem = _.neq(true);
      }
      console.log('🔍 [getPostList] 添加isPoem筛选条件:', isPoem);
    }

    // 如果指定了isOriginal参数，添加原创筛选条件
    if (isOriginal !== undefined) {
      if (isOriginal === true) {
        // 只获取原创：isOriginal 必须为 true
        matchConditions.isOriginal = true;
      } else {
        // 只获取非原创：isOriginal 为 false 或不存在（$ne: true 会匹配 false、null 和不存在的字段）
        matchConditions.isOriginal = _.neq(true);
      }
      console.log('🔍 [getPostList] 添加isOriginal筛选条件:', isOriginal);
    }

    // 如果指定了tag参数，添加标签筛选条件
    if (tag) {
      matchConditions.tags = tag;  // 匹配包含该标签的文档
      matchConditions['tags.0'] = { $exists: true };  // 确保tags数组至少有一个元素
      console.log('🔍 [getPostList] 添加tag筛选条件:', tag);
    }

    // 如果指定了isDiscussion参数，添加讨论筛选条件
    if (isDiscussion !== undefined) {
      if (isDiscussion === true) {
        // 只获取讨论：isDiscussion 必须为 true
        matchConditions.isDiscussion = true;
      } else {
        // 只获取非讨论：isDiscussion 为 false 或不存在（$ne: true 会匹配 false、null 和不存在的字段）
        matchConditions.isDiscussion = _.neq(true);
      }
      console.log('🔍 [getPostList] 添加isDiscussion筛选条件:', isDiscussion);
    }
    
    // 过滤被屏蔽用户的帖子（查询阶段先过滤 _openid，结果处理阶段再过滤 realAuthorOpenid）
    if (blockedUserIds.length > 0) {
      // 在查询阶段过滤普通帖子的 _openid
      matchConditions._openid = _.nin(blockedUserIds);
      console.log('🔍 [getPostList] 添加屏蔽用户过滤条件（_openid），被屏蔽用户数:', blockedUserIds.length);
    }

    console.log('🔍 [getPostList] 最终筛选条件:', JSON.stringify(matchConditions, null, 2));

    // 如果有筛选条件，应用match
    if (Object.keys(matchConditions).length > 0) {
      query = query.match(matchConditions);
    }

    // 判断是否启用随机混合逻辑
    // 只有当没有筛选条件时（广场页面），才启用随机混合
    // 有筛选条件时（山、路页面），只返回时间顺序的帖子
    const hasFilter = isPoem !== undefined || isOriginal !== undefined || isDiscussion !== undefined || tag;
    const enableRandomMix = !hasFilter;  // 没有筛选条件时启用随机混合
    
    let posts = [];
    let timeOrderedPosts = []; // 在外层声明，以便在日志输出时使用
    let randomPosts = []; // 在外层声明，以便在日志输出时使用
    
    if (enableRandomMix) {
      // 广场页面：使用随机混合逻辑（6个时间顺序 + 4个随机）
      const TIME_ORDERED_COUNT = 6;  // 按时间顺序的帖子数量
      const RANDOM_COUNT = 4;        // 随机帖子的数量
      
      // 1. 先获取按时间顺序的帖子（6个）
      const timeOrderedQuery = query.sort({ createTime: -1 })
        .skip(skip)
        .limit(TIME_ORDERED_COUNT);
      
      const timeOrderedRes = await timeOrderedQuery.end();
      timeOrderedPosts = timeOrderedRes.list || []; // 使用外层声明的变量
      
      // 2. 获取随机帖子（4个）
      randomPosts = []; // 重置随机帖子数组
      const timeOrderedPostIds = timeOrderedPosts.map(p => p._id).filter(Boolean);
    
      // 即使没有时间顺序的帖子，也尝试获取随机帖子
      try {
        // 构建随机帖子查询条件（排除已获取的时间顺序帖子）
        const randomPostsMatchConditions = { isHidden: _.neq(true) };
        
        // 复制所有筛选条件（虽然这里应该没有筛选条件，但为了保险还是复制）
        // 如果有时间顺序的帖子，排除它们
        if (timeOrderedPostIds.length > 0) {
          randomPostsMatchConditions._id = _.nin(timeOrderedPostIds);
        }
        
        // 排除被屏蔽的用户
        if (blockedUserIds.length > 0) {
          randomPostsMatchConditions._openid = _.nin(blockedUserIds);
        }
        
        // 先统计符合条件的帖子总数
        const countRes = await db.collection('posts').aggregate()
          .match(randomPostsMatchConditions)
          .count('total')
          .end();
        const totalPosts = (countRes.list && countRes.list[0] && countRes.list[0].total) || 0;
        
        if (totalPosts > 0) {
          // 改进的随机策略：多次随机查询以增加随机性
          let candidatePosts = [];
          const targetCandidates = Math.min(totalPosts, RANDOM_COUNT * 5); // 获取更多候选以增加随机性
          
          // 如果总数较少，直接获取所有
          if (totalPosts <= targetCandidates) {
            const allQuery = db.collection('posts').aggregate()
              .match(randomPostsMatchConditions)
              .limit(totalPosts);
            const allRes = await allQuery.end();
            candidatePosts = allRes.list || [];
          } else {
            // 多次随机查询，每次从不同位置获取
            const queriesPerBatch = 3; // 分批查询
            const perBatchCount = Math.ceil(targetCandidates / queriesPerBatch);
            
            for (let i = 0; i < queriesPerBatch && candidatePosts.length < targetCandidates; i++) {
              // 每次随机选择一个skip位置
              const maxSkip = Math.max(0, totalPosts - perBatchCount);
              const randomSkip = Math.floor(Math.random() * (maxSkip + 1));
              
              const randomQuery = db.collection('posts').aggregate()
                .match(randomPostsMatchConditions)
                .sort({ createTime: -1 })  // 虽然按时间排序，但skip是随机的
                .skip(randomSkip)
                .limit(perBatchCount);
              
              const randomRes = await randomQuery.end();
              const batchPosts = randomRes.list || [];
              
              // 添加到候选列表，并去重
              const existingIds = new Set(candidatePosts.map(p => p._id));
              const newPosts = batchPosts.filter(p => !existingIds.has(p._id));
              candidatePosts = candidatePosts.concat(newPosts);
            }
          }
          
          // 如果候选帖子还不够，从所有帖子中随机选择skip位置再获取
          if (candidatePosts.length < RANDOM_COUNT && totalPosts > candidatePosts.length) {
            const remainingNeeded = RANDOM_COUNT - candidatePosts.length;
            const existingIds = new Set(candidatePosts.map(p => p._id));
            
            // 再尝试几次随机查询
            for (let attempt = 0; attempt < 5 && candidatePosts.length < targetCandidates; attempt++) {
              const maxSkip = Math.max(0, totalPosts - remainingNeeded * 2);
              const randomSkip = Math.floor(Math.random() * (maxSkip + 1));
              
              const randomQuery = db.collection('posts').aggregate()
                .match(randomPostsMatchConditions)
                .sort({ createTime: -1 })
                .skip(randomSkip)
                .limit(remainingNeeded * 2);
              
              const randomRes = await randomQuery.end();
              const batchPosts = randomRes.list || [];
              const newPosts = batchPosts.filter(p => !existingIds.has(p._id));
              candidatePosts = candidatePosts.concat(newPosts);
              newPosts.forEach(p => existingIds.add(p._id));
            }
          }
          
          // 从候选帖子中彻底随机打乱并选择（使用 Fisher-Yates shuffle 算法）
          const shuffled = candidatePosts.slice();
          for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const temp = shuffled[i];
            shuffled[i] = shuffled[j];
            shuffled[j] = temp;
          }
          randomPosts = shuffled.slice(0, Math.min(RANDOM_COUNT, shuffled.length));
        }
      } catch (randomError) {
        console.error('❌ [getPostList] 获取随机帖子失败:', randomError);
      }
      
      // 3. 混合帖子：真正随机混合时间顺序和随机帖子
      if (randomPosts.length > 0) {
        // 创建所有帖子的合并列表
        const allPosts = timeOrderedPosts.concat(randomPosts);
        
        // 使用 Fisher-Yates shuffle 算法真正随机打乱
        for (let i = allPosts.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          const temp = allPosts[i];
          allPosts[i] = allPosts[j];
          allPosts[j] = temp;
        }
        
        posts = allPosts;
      } else {
        posts = timeOrderedPosts.slice();
      }
    } else {
      // 山和路页面：只返回时间顺序的帖子
      const timeOrderedQuery = query.sort({ createTime: -1 })
        .skip(skip)
        .limit(limit);
      
      const timeOrderedRes = await timeOrderedQuery.end();
      posts = timeOrderedRes.list || [];
    }
    
    // 确保返回的帖子数量不超过limit
    posts = posts.slice(0, limit);
    
    // 批量查询点赞状态
    let voterMap = new Set();
    if (posts.length > 0) {
      try {
        const postIds = posts.map(post => post._id);
        const voteRes = await db.collection('votes_log')
          .where({
            _openid: openid,
            type: 'post',
            postId: _.in(postIds)
          })
          .field({ postId: true })
          .get();
        voterMap = new Set(voteRes.data.map(item => item.postId));
      } catch (voteError) {
        console.error('❌ [getPostList] 批量查询点赞记录失败:', voteError);
      }
    }
    
    // 处理帖子数据，并再次过滤被屏蔽用户（双重保险）
    let processedPosts = posts.map(post => {
      const authorName = post.authorName || post.authorNameSnapshot || '匿名用户';
      const authorAvatar = post.authorAvatar || post.authorAvatarSnapshot || '';
      const authorSignature = post.authorSignature || ''; // 签名URL（匿名帖子可能为空）
      const commentCount = post.commentCount || 0;
      const isVoted = voterMap.has(post._id);
      
      return {
        ...post,
        authorName,
        authorAvatar,
        authorSignature,
        commentCount,
        isVoted,
        tags: Array.isArray(post.tags) ? post.tags : []
      };
    });
    
    // 双重保险：前端再次过滤被屏蔽用户的帖子（包括匿名帖子的realAuthorOpenid）
    if (blockedUserIds.length > 0) {
      processedPosts = processedPosts.filter(post => {
        // 检查普通帖子的 _openid
        if (blockedUserIds.includes(post._openid)) {
          return false;
        }
        // 检查匿名帖子的 realAuthorOpenid
        if (post.realAuthorOpenid && blockedUserIds.includes(post.realAuthorOpenid)) {
          return false;
        }
        return true;
      });
    }
    
    // --- 优化图片URL转换逻辑 ---
    const fileIDs = new Set(); // 使用Set避免重复fileID
    
    processedPosts.forEach(post => {
      // 保证 imageUrls、originalImageUrls 一定为数组
      if (!Array.isArray(post.imageUrls)) post.imageUrls = post.imageUrls ? [post.imageUrls] : [];
      if (!Array.isArray(post.originalImageUrls)) post.originalImageUrls = post.originalImageUrls ? [post.originalImageUrls] : [];
      
      // 收集所有需要转换的fileID
      const urlsToCheck = [
        ...post.imageUrls,
        ...post.originalImageUrls,
        post.imageUrl,
        post.originalImageUrl,
        post.authorAvatar,
        post.authorSignature, // 添加签名URL
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

        // 批量转换所有帖子的图片URL
        processedPosts.forEach(post => {
          const convertUrl = (url) => urlMap.get(url) || url;
          
          if (post.imageUrl) post.imageUrl = convertUrl(post.imageUrl);
          if (post.originalImageUrl) post.originalImageUrl = convertUrl(post.originalImageUrl);
          if (post.authorAvatar) post.authorAvatar = convertUrl(post.authorAvatar);
          if (post.authorSignature) post.authorSignature = convertUrl(post.authorSignature); // 转换签名URL
          if (post.poemBgImage) post.poemBgImage = convertUrl(post.poemBgImage);
          
          if (Array.isArray(post.imageUrls)) {
            post.imageUrls = post.imageUrls.map(convertUrl);
          }
          if (Array.isArray(post.originalImageUrls)) {
            post.originalImageUrls = post.originalImageUrls.map(convertUrl);
          }
        });
      } catch (fileError) {
        console.error('❌ [getPostList] 图片URL转换失败:', fileError);
      }
    }

    console.log('✅ [getPostList] ========== 云函数执行完成 ==========');
    console.log('✅ [getPostList] 返回帖子数量:', processedPosts.length);
    if (processedPosts.length > 0) {
      console.log('✅ [getPostList] 前3个帖子时间:', processedPosts.slice(0, 3).map(p => ({
        id: p._id,
        createTime: p.createTime
      })));
    }

    return {
      success: true,
      posts: processedPosts
    };

  } catch (e) {
    console.error('❌ [getPostList] 云函数执行失败:', e);
    console.error('❌ [getPostList] 错误详情:', {
      message: e.message,
      stack: e.stack,
      name: e.name
    });
    return {
      success: false,
      error: {
        message: e.message,
        stack: e.stack
      }
    };
  }
};

