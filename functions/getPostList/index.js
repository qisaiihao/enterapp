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

  try {
    console.log('🔍 [getPostList] 开始构建查询');

    let query = db.collection('posts').aggregate();

    // 构建筛选条件
    const matchConditions = { isHidden: _.neq(true) };

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

    // 如果指定了isDiscussion参数，添加讨论筛选条件
    if (isDiscussion !== undefined) {
      matchConditions.isDiscussion = isDiscussion;
      console.log('🔍 [getPostList] 添加isDiscussion筛选条件:', isDiscussion);
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
    
    // 优化：先执行基础查询，避免复杂的聚合操作
    const postsRes = await query.end();

    const posts = postsRes.list;
    console.log('✅ [getPostList] 查询成功，获取到帖子数量:', posts.length);
    
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
        console.log('✅ [getPostList] 批量查询点赞状态成功');
      } catch (voteError) {
        console.error('❌ [getPostList] 批量查询点赞记录失败:', voteError);
      }
    }
    
    // 处理帖子数据
    const processedPosts = posts.map(post => {
      const authorName = post.authorName || post.authorNameSnapshot || '匿名用户';
      const authorAvatar = post.authorAvatar || post.authorAvatarSnapshot || '';
      const commentCount = post.commentCount || 0;
      const isVoted = voterMap.has(post._id);
      
      return {
        ...post,
        authorName,
        authorAvatar,
        commentCount,
        isVoted,
        tags: Array.isArray(post.tags) ? post.tags : []
      };
    });
    
    if (processedPosts.length > 0) {
      console.log('🔍 [getPostList] 帖子详情:');
      processedPosts.forEach((post, index) => {
        console.log(`📝 [getPostList] 帖子${index + 1}:`, {
          _id: post._id,
          title: post.title,
          isPoem: post.isPoem,
          isOriginal: post.isOriginal,
          isFoundPoetry: post.isFoundPoetry,
          authorName: post.authorName,
          createTime: post.createTime
        });
      });
    } else {
      console.log('⚠️ [getPostList] 没有找到符合条件的帖子');
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

    console.log('✅ [getPostList] 云函数执行完成，返回帖子数量:', processedPosts.length);

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

