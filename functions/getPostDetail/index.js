// 云函数入口文件
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const wxCtxOpenid = wxContext.OPENID;
  const eventOpenid = event.openid;
  const openid = eventOpenid || wxCtxOpenid;
  const { postId } = event;

  if (!openid) {
    return {
      success: false,
      message: '无法获取用户 openid，请重新登录',
      code: 'NO_OPENID'
    };
  }
  console.log('🔍 [getPostDetail] openid来源:', {
    eventOpenid: eventOpenid ? '提供' : '未提供',
    wxCtxOpenid: wxCtxOpenid ? '提供' : '未提供',
    chosenOpenidSource: eventOpenid ? 'event.openid' : 'wxContext.OPENID',
    chosenOpenidExists: !!openid
  });

  if (!postId) {
    return {
      success: false,
      message: 'Post ID is required.'
    };
  }

  try {
    // 1. 根据 postId 获取帖子详情
    const postRes = await db.collection('posts').doc(postId).get();
    const post = postRes.data;

    if (!post) {
      return {
        success: false,
        message: 'Post not found.'
      };
    }

    console.log('获取到的帖子数据:', {
      _id: post._id,
      title: post.title,
      commentCount: post.commentCount,
      votes: post.votes
    });

    // 2. 根据帖子的 _openid 获取作者信息
    const userRes = await db.collection('users').where({
      _openid: post._openid
    }).get();
    
    // If author is not found, provide a default object for robustness
    const author = userRes.data[0] || { 
        nickName: '匿名用户', 
        avatarUrl: '' 
    };

    // 3. 获取当前用户的点赞记录
    const voteRes = await db.collection('votes_log').where({
        _openid: openid,
        postId: postId,
        type: 'post'
    }).get();

    // 4. 组合最终结果
    const resultPost = {
      ...post,
      authorName: author.nickName,
      authorAvatar: author.avatarUrl,
      isAuthor: post._openid === openid,
      isVoted: voteRes.data.length > 0,
      tags: post.tags || [] // 确保标签字段存在
    };
    // 保证 imageUrls、originalImageUrls 一定为数组
    if (!Array.isArray(resultPost.imageUrls)) resultPost.imageUrls = resultPost.imageUrls ? [resultPost.imageUrls] : [];
    if (!Array.isArray(resultPost.originalImageUrls)) resultPost.originalImageUrls = resultPost.originalImageUrls ? [resultPost.originalImageUrls] : [];

    // --- Efficiently convert FileIDs to temp URLs ---
    const fileIDs = [];
    if (resultPost.imageUrl && resultPost.imageUrl.startsWith('cloud://')) {
      fileIDs.push(resultPost.imageUrl);
    }
    if (resultPost.imageUrls && Array.isArray(resultPost.imageUrls)) {
      resultPost.imageUrls.forEach(url => {
        if (url && url.startsWith('cloud://')) {
          fileIDs.push(url);
        }
      });
    }
    if (resultPost.originalImageUrl && resultPost.originalImageUrl.startsWith('cloud://')) {
      fileIDs.push(resultPost.originalImageUrl);
    }
    if (resultPost.originalImageUrls && Array.isArray(resultPost.originalImageUrls)) {
      resultPost.originalImageUrls.forEach(url => {
        if (url && url.startsWith('cloud://')) {
          fileIDs.push(url);
        }
      });
    }
    if (resultPost.authorAvatar && resultPost.authorAvatar.startsWith('cloud://')) {
      fileIDs.push(resultPost.authorAvatar);
    }

    if (fileIDs.length > 0) {
      const fileListResult = await cloud.getTempFileURL({ fileList: fileIDs });
      const urlMap = new Map();
      fileListResult.fileList.forEach(item => {
        if (item.status === 0) {
          urlMap.set(item.fileID, item.tempFileURL);
        }
      });

      if (resultPost.imageUrl && urlMap.has(resultPost.imageUrl)) {
        resultPost.imageUrl = urlMap.get(resultPost.imageUrl);
      }
      if (resultPost.imageUrls && Array.isArray(resultPost.imageUrls)) {
        resultPost.imageUrls = resultPost.imageUrls.map(url => 
          url && urlMap.has(url) ? urlMap.get(url) : url
        );
      }
      if (resultPost.originalImageUrl && urlMap.has(resultPost.originalImageUrl)) {
        resultPost.originalImageUrl = urlMap.get(resultPost.originalImageUrl);
      }
      if (resultPost.originalImageUrls && Array.isArray(resultPost.originalImageUrls)) {
        resultPost.originalImageUrls = resultPost.originalImageUrls.map(url => 
          url && urlMap.has(url) ? urlMap.get(url) : url
        );
      }
      if (resultPost.authorAvatar && urlMap.has(resultPost.authorAvatar)) {
        resultPost.authorAvatar = urlMap.get(resultPost.authorAvatar);
      }
    }

    // 如果帖子没有commentCount字段，则实时计算评论数量
    let commentCount = resultPost.commentCount;
    console.log('从数据库获取的commentCount:', commentCount, '类型:', typeof commentCount);
    
    if (commentCount === undefined || commentCount === null) {
      console.log('需要实时计算评论数量');
      const commentsRes = await db.collection('comments').where({
        postId: postId
      }).count();
      commentCount = commentsRes.total;
      console.log('实时计算的评论数量:', commentCount);
      
      // 同时更新帖子数据库中的commentCount字段，避免下次再计算
      try {
        await db.collection('posts').doc(postId).update({
          data: {
            commentCount: commentCount
          }
        });
        console.log('已更新数据库中的commentCount字段');
      } catch (updateError) {
        console.error('更新commentCount字段失败:', updateError);
      }
    } else {
      console.log('使用数据库中的commentCount:', commentCount);
    }
    
    console.log('最终返回的评论数量:', commentCount);
    
    return {
      post: resultPost,
      commentCount: commentCount, // 添加评论数量
      success: true
    };

  } catch (e) {
    console.error(e);
    return {
      success: false,
      error: e
    };
  }
};
