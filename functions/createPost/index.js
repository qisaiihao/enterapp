const { createPostsDatabase, withPostResponse } = require('./_lib/posts');
const { moderateBeforeWrite } = require('./_lib/moderation-gate');
const { queueModerationReview } = require('./_lib/moderation-review');
// 云函数：createPost
// 功能：创建新帖子

const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = createPostsDatabase(cloud.database());

exports.main = async (event, context) => {
  console.log('🔍 [createPost] 开始创建帖子');
  
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
    if (userResult.data.some(item => item.postingBanned === true)) {
      return { code: 'POSTING_BANNED', msg: '账号已被限制发帖，请联系管理员' };
    }
    const isAnonymous = event.isAnonymous === true || event.isAnonymous === 'true';
    const anonymousAuthorName = event.anonymousAuthorName || '匿名用户';
    
    // 准备帖子数据
    const postData = {
      _openid: isAnonymous ? '123456' : openid,
      authorName: isAnonymous ? anonymousAuthorName : user.nickName,
      authorAvatar: isAnonymous ? '/static/images/avatar.png' : user.avatarUrl,
      authorSignature: isAnonymous ? '' : (user.signatureUrl || ''),
      title: event.title || '',
      content: event.content || '',
      createTime: new Date(),
      votes: 0,
      commentCount: 0,
      viewCount: 0,
      isPoem: event.publishMode === 'poem' || event.isSeries || false,
      isSeries: event.isSeries || false,
      isOriginal: event.isOriginal || false,
      isDiscussion: event.isDiscussion || false,
      author: isAnonymous ? anonymousAuthorName : (event.author || ''),
      tags: event.tags || [],
      isAnonymous,
      anonymousAuthorName,
      realAuthorOpenid: isAnonymous ? openid : null
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
    
    const moderationFailure = await moderateBeforeWrite(cloud, {
      title: postData.title,
      content: postData.content,
      author: postData.author,
      tags: postData.tags,
      anonymousAuthorName: isAnonymous ? anonymousAuthorName : '',
      highlightSentence: postData.highlightSentence,
      highlightLines: postData.highlightLines,
      sentenceGroups: postData.sentenceGroups,
      discussionSentences: postData.discussionSentences,
      seriesBlocks: postData.seriesBlocks,
      images: Array.isArray(event.originalFileIDs) && event.originalFileIDs.length
        ? event.originalFileIDs : event.fileIDs
    });
    if (moderationFailure) {
      if (!['CONTENT_BLOCKED', 'REVIEW_REQUIRED'].includes(moderationFailure.code)) return moderationFailure;
      return await queueModerationReview(db, {
        openid, source: 'createPost', kind: 'post', audit: moderationFailure, data: postData
      });
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

exports.main = withPostResponse(exports.main);
