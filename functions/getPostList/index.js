// 云函数入口文件
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;
const $ = _.aggregate;

// 云函数入口函数
exports.main = async (event, context) => {
  console.log('🔍 [getPostList] 云函数开始执行');
  console.log('🔍 [getPostList] 接收到的参数:', event);
  
  const wxContext = cloud.getWXContext();
  const wxCtxOpenid = wxContext.OPENID;
  const eventOpenid = event.openid;
  const openid = eventOpenid || wxCtxOpenid;
  const { skip = 0, limit = 10, isPoem, isOriginal, tag = '' } = event; // 添加isPoem、isOriginal和tag参数

  console.log('🔍 [getPostList] 解析参数:', {
    eventOpenid: eventOpenid ? '提供' : '未提供',
    wxCtxOpenid: wxCtxOpenid ? '提供' : '未提供',
    chosenOpenidSource: eventOpenid ? 'event.openid' : 'wxContext.OPENID',
    chosenOpenidExists: !!openid,
    skip,
    limit,
    isPoem,
    isOriginal,
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

  try {
    console.log('🔍 [getPostList] 开始构建查询');

    let query = db.collection('posts').aggregate();

    // 构建筛选条件
    const matchConditions = {};

    // 如果指定了isPoem参数，添加诗歌筛选条件
    if (isPoem !== undefined) {
      matchConditions.isPoem = isPoem;
      console.log('🔍 [getPostList] 添加isPoem筛选条件:', isPoem);
    }

    // 如果指定了isOriginal参数，添加原创筛选条件
    if (isOriginal !== undefined) {
      matchConditions.isOriginal = isOriginal;
      console.log('🔍 [getPostList] 添加isOriginal筛选条件:', isOriginal);
    }

    // 如果指定了tag参数，添加标签筛选条件
    if (tag) {
      matchConditions.tags = tag;  // 匹配包含该标签的文档
      matchConditions['tags.0'] = { $exists: true };  // 确保tags数组至少有一个元素
      console.log('🔍 [getPostList] 添加tag筛选条件:', tag);
    }

    console.log('🔍 [getPostList] 最终筛选条件:', matchConditions);

    // 如果有筛选条件，应用match
    if (Object.keys(matchConditions).length > 0) {
      query = query.match(matchConditions);
      console.log('🔍 [getPostList] 应用筛选条件');
    } else {
      console.log('🔍 [getPostList] 无筛选条件，查询所有帖子');
    }

    // 在筛选后进行排序和分页
    query = query.sort({ createTime: -1 })
      .skip(skip)
      .limit(limit);
      
    console.log('🔍 [getPostList] 查询参数 - skip:', skip, 'limit:', limit);
    
    const postsRes = await query
      .lookup({
        from: 'users',
        localField: '_openid',
        foreignField: '_openid',
        as: 'authorInfo',
      })
      .lookup({
        from: 'comments',
        localField: '_id',
        foreignField: 'postId',
        as: 'comments',
      })
      // 关联当前用户的点赞记录 (兼容旧版SDK的写法)
      .lookup({
        from: 'votes_log',
        let: {
          post_id: '$_id'
        },
        // 使用JSON对象替代.pipeline().build()
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$postId', '$$post_id'] },
                  { $eq: ['$_openid', openid] },
                  { $eq: ['$type', 'post'] }
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
        tags: '$tags', // 新增标签字段
        author: '$author', // 新增作者字段
        authorName: $.ifNull([$.arrayElemAt(['$authorInfo.nickName', 0]), '匿名用户']),
        authorAvatar: $.ifNull([$.arrayElemAt(['$authorInfo.avatarUrl', 0]), '']),
        commentCount: $.size('$comments'),
        isVoted: $.gt([$.size('$userVote'), 0]),
      })
      .end();

    const posts = postsRes.list;
    console.log('✅ [getPostList] 查询成功，获取到帖子数量:', posts.length);
    
    if (posts.length > 0) {
      console.log('🔍 [getPostList] 帖子详情:');
      posts.forEach((post, index) => {
        console.log(`📝 [getPostList] 帖子${index + 1}:`, {
          _id: post._id,
          title: post.title,
          isPoem: post.isPoem,
          isOriginal: post.isOriginal,
          authorName: post.authorName,
          createTime: post.createTime
        });
      });
    } else {
      console.log('⚠️ [getPostList] 没有找到符合条件的帖子');
    }

    // --- 优化图片URL转换逻辑 ---
    const fileIDs = new Set(); // 使用Set避免重复fileID
    
    posts.forEach(post => {
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
        post.poemBgImage
      ].filter(url => url && url.startsWith('cloud://'));
      
      urlsToCheck.forEach(url => fileIDs.add(url));
    });

    console.log('🔍 [getPostList] 需要转换的图片数量:', fileIDs.size);

    if (fileIDs.size > 0) {
      try {
        console.log('🔍 [getPostList] 开始转换图片URL');
        const fileListResult = await cloud.getTempFileURL({ fileList: Array.from(fileIDs) });
        const urlMap = new Map();
        
        fileListResult.fileList.forEach(item => {
          if (item.status === 0) {
            urlMap.set(item.fileID, item.tempFileURL);
          }
        });

        console.log('✅ [getPostList] 图片URL转换完成，成功转换数量:', urlMap.size);

        // 批量转换所有帖子的图片URL
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
        console.error('❌ [getPostList] 图片URL转换失败:', fileError);
      }
    }

    console.log('✅ [getPostList] 云函数执行完成，返回帖子数量:', posts.length);

    return {
      success: true,
      posts: posts
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