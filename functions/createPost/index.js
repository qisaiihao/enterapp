// 云函数：createPost
// 功能：创建新帖子

const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

exports.main = async (event, context) => {
  console.log('🔍 [createPost] 开始创建帖子');
  console.log('🔍 [createPost] 请求参数:', JSON.stringify(event, null, 2));
  
  const wxContext = cloud.getWXContext();
  const openid = event.openid || wxContext.OPENID;
  
  if (!openid) {
    return {
      code: -1,
      msg: '无法获取用户信息，请重新登录'
    };
  }
  
  try {
    // 获取用户信息
    const userResult = await db.collection('users').where({
      _openid: openid
    }).get();
    
    if (userResult.data.length === 0) {
      return {
        code: -1,
        msg: '用户信息不存在'
      };
    }
    
    const user = userResult.data[0];
    
    // 准备帖子数据
    const postData = {
      _openid: openid,
      authorName: event.isAnonymous ? event.anonymousAuthorName : user.nickName,
      authorAvatar: event.isAnonymous ? '/static/images/avatar.png' : user.avatarUrl,
      authorSignature: event.isAnonymous ? '' : (user.signatureUrl || ''),
      title: event.title || '',
      content: event.content || '',
      createTime: db.serverDate(),
      votes: 0,
      commentCount: 0,
      viewCount: 0,
      isPoem: event.publishMode === 'poem' || event.isSeries || false,
      isSeries: event.isSeries || false,
      isOriginal: event.isOriginal || false,
      isDiscussion: event.isDiscussion || false,
      author: event.author || '',
      tags: event.tags || [],
      isAnonymous: event.isAnonymous || false,
      anonymousAuthorName: event.anonymousAuthorName || '匿名用户',
      realAuthorOpenid: event.realAuthorOpenid || null
    };
    
    // 添加颜色信息
    if (event.backgroundColor) {
      postData.backgroundColor = event.backgroundColor;
    }
    if (event.textColor) {
      postData.textColor = event.textColor;
    }
    
    // 添加高光行信息
    if (event.highlightLines && event.highlightLines.length > 0) {
      postData.highlightLines = event.highlightLines;
      postData.highlightSentence = event.highlightLines[0];
    }
    
    // 添加图片信息
    if (event.fileIDs && event.fileIDs.length > 0) {
      postData.imageUrl = event.fileIDs[0];
      postData.imageUrls = event.fileIDs;
    }
    if (event.originalFileIDs && event.originalFileIDs.length > 0) {
      postData.originalImageUrl = event.originalFileIDs[0];
      postData.originalImageUrls = event.originalFileIDs;
    }
    
    // 讨论模式特殊处理
    if (event.isDiscussion) {
      postData.sentenceGroups = event.sentenceGroups || [];
      postData.discussionSentences = event.discussionSentences || [];
    }
    
    // 组诗模式特殊处理
    if (event.isSeries) {
      postData.seriesBlocks = event.seriesBlocks || [];
      postData.seriesBlockCount = (event.seriesBlocks || []).length;
    }
    
    // 创建帖子
    const result = await db.collection('posts').add({
      data: postData
    });
    
    console.log('✅ [createPost] 帖子创建成功:', result._id);
    
    return {
      code: 0,
      msg: '发布成功',
      postId: result._id
    };
    
  } catch (error) {
    console.error('❌ [createPost] 创建帖子失败:', error);
    return {
      code: -1,
      msg: error.message || '发布失败'
    };
  }
};
