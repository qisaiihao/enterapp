// 云函数 addComment 的入口文件 (最终版)
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command; // 引入数据库操作符

// 云函数入口函数
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

  // [新增] 接收前端传来的 replyToAuthorName
  const {
    postId,
    content = '',
    parentId,
    replyToAuthorName,
    imageUrls = [],
    originalImageUrls = [],
    isAnonymous = false
  } = event;

  const trimmedContent = (content || '').trim();
  const sanitizedImageUrls = Array.isArray(imageUrls) ? imageUrls.filter(url => !!url) : [];
  let sanitizedOriginalImageUrls = Array.isArray(originalImageUrls) ? originalImageUrls.filter(url => !!url) : [];

  if (sanitizedOriginalImageUrls.length === 0 && sanitizedImageUrls.length > 0) {
    sanitizedOriginalImageUrls = sanitizedImageUrls.slice();
  }

  const hasContent = trimmedContent.length > 0;
  const hasImages = sanitizedImageUrls.length > 0;

  // Basic validation
  if (!postId) {
    return { success: false, message: 'Post ID is required.' };
  }
  if (!hasContent && !hasImages) {
    return { success: false, message: '评论内容或图片至少需要一项。' };
  }

  try {
    // 获取用户信息
    const userResult = await db.collection('users').where({
      _openid: openid
    }).limit(1).get();
    const user = userResult.data[0];
    
    // 准备要存入数据库的数据
    const commentData = {
      _openid: openid,
      postId: postId,
      content: trimmedContent,
      likes: 0, // [建议] 初始化点赞数为0
      createTime: new Date(),
      imageUrls: sanitizedImageUrls,
      originalImageUrls: sanitizedOriginalImageUrls,
      hasImages: hasImages,
      // 匿名评论相关字段
      isAnonymous: isAnonymous,
      authorName: isAnonymous ? '匿名用户' : (user ? user.nickName : '微信用户'),
      authorAvatar: isAnonymous ? '/static/images/avatar.png' : (user ? user.avatarUrl : ''),
      realAuthorOpenid: isAnonymous ? openid : null
    };

    // 如果 parentId 存在，说明这是一条回复
    if (parentId) {
      commentData.parentId = parentId;
      // [新增] 如果是回复，就把被回复人的名字也存进去
      if (replyToAuthorName) {
        commentData.replyToAuthorName = replyToAuthorName;
      }
    }

    // 将新评论/回复添加到数据库
    const result = await db.collection('comments').add({
      data: commentData
    });

    // [新增] 评论或回复成功后，帖子的评论数 +1
    await db.collection('posts').doc(postId).update({
      data: {
        commentCount: _.inc(1)
      }
    });

    // === 新增：创建评论消息通知 ===
    try {
      // 获取帖子信息
      const postResult = await db.collection('posts').doc(postId).get()
      const post = postResult.data
      
      let notifyUserId = null; // 要通知的用户ID
      let shouldNotify = false; // 是否应该发送通知
      
      if (parentId) {
        // 如果是回复评论，需要通知被回复评论的作者
        try {
          const parentCommentResult = await db.collection('comments').doc(parentId).get();
          const parentComment = parentCommentResult.data;
          
          if (parentComment) {
            // 获取被回复评论的作者ID（如果是匿名评论，使用realAuthorOpenid）
            const parentCommentAuthorId = parentComment.isAnonymous 
              ? (parentComment.realAuthorOpenid || parentComment._openid)
              : parentComment._openid;
            
            // 如果回复的不是自己的评论，且不是匿名评论，则发送通知
            if (parentCommentAuthorId !== openid && !isAnonymous) {
              notifyUserId = parentCommentAuthorId;
              shouldNotify = true;
            }
          }
        } catch (commentError) {
          console.error('查询被回复评论失败:', commentError)
        }
      } else {
        // 如果是直接评论帖子，通知帖子作者（排除给自己评论或匿名评论的情况）
        if (post._openid !== openid && !isAnonymous) {
          notifyUserId = post._openid;
          shouldNotify = true;
        }
      }
      
      if (shouldNotify && notifyUserId) {
        // 根据帖子实际字段确定内容类型
        let contentType = 'post';
        let contentTypeText = '帖子';
        
        if (post.isDiscussion) {
          contentType = 'discussion';
          contentTypeText = '讨论';
        } else if (post.isPoem) {
          if (post.isOriginal) {
            contentType = 'original';
            contentTypeText = '原创诗歌';
          } else {
            contentType = 'non-original';
            contentTypeText = '诗歌';
          }
        }
        
        const messageContent = parentId ? 
          `${user ? user.nickName : '微信用户'} 回复了你的评论` :
          `${user ? user.nickName : '微信用户'} 评论了你的${contentTypeText}`
          
        await db.collection('messages').add({
          data: {
            fromUserId: openid,
            fromUserName: user ? user.nickName : '微信用户',
            fromUserAvatar: user ? user.avatarUrl : '',
            toUserId: notifyUserId,
            type: 'comment',
            postId: postId,
            postTitle: post.title || '无标题',
            contentType: contentType,
            content: messageContent,
            commentId: result._id,
            isRead: false,
            createTime: new Date()
          }
        })
      }
    } catch (msgError) {
      console.error('创建评论消息失败:', msgError)
      // 不影响主流程，只是记录错误
    }

    return {
      success: true,
      message: 'Comment added successfully.',
      commentId: result._id
    };

  } catch (e) {
    console.error('addComment error', e);
    return {
      success: false,
      message: 'Failed to add comment.',
      error: e.toString()
    };
  }
};


