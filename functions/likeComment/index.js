// 云函数 likeComment 的入口文件 (已更新)
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID || event.openid;
  const { commentId, postId } = event; // [移除] 不再需要 isLiked

  if (!openid) {
    return {
      success: false,
      message: '无法获取用户 openid，请重新登录',
      code: 'NO_OPENID'
    };
  }

  if (!commentId || !postId) {
    return { success: false, message: '缺少评论ID或帖子ID' };
  }

  try {
    const votesLogCollection = db.collection('votes_log');
    
    // [核心修改] 查询用户是否已经点赞过此评论
    const existingLog = await votesLogCollection.where({
      _openid: openid,
      commentId: commentId,
      type: 'comment'
    }).get();

    if (existingLog.data.length > 0) {
      // --- 用户已点赞，执行取消点赞 ---
      const logId = existingLog.data[0]._id;
      await votesLogCollection.doc(logId).remove();
      
      await db.collection('comments').doc(commentId).update({
        data: {
          likes: _.inc(-1)
        }
      });

    } else {
      // --- 用户未点赞，执行点赞 ---
      await votesLogCollection.add({
        data: {
          _openid: openid,
          commentId: commentId,
          postId: postId,
          type: 'comment',
          createTime: new Date()
        }
      });
      
      await db.collection('comments').doc(commentId).update({
        data: {
          likes: _.inc(1)
        }
      });
      
      // === 新增：创建评论点赞消息通知 ===
      try {
        // 获取评论信息
        const commentResult = await db.collection('comments').doc(commentId).get();
        const comment = commentResult.data;
        
        // 获取帖子信息（用于显示帖子标题）
        const postResult = await db.collection('posts').doc(postId).get();
        const post = postResult.data;
        
        // 获取点赞者信息
        const userResult = await db.collection('users').where({
          _openid: openid
        }).limit(1).get();
        const user = userResult.data[0];
        
        // 获取评论作者ID（如果是匿名评论，使用realAuthorOpenid）
        const commentAuthorId = comment.isAnonymous 
          ? (comment.realAuthorOpenid || comment._openid)
          : comment._openid;
        
        // 如果给自己的评论点赞，不发送通知
        if (commentAuthorId !== openid) {
          await db.collection('messages').add({
            data: {
              fromUserId: openid,
              fromUserName: user ? user.nickName : '微信用户',
              fromUserAvatar: user ? user.avatarUrl : '',
              toUserId: commentAuthorId,
              type: 'like',
              postId: postId,
              postTitle: post ? (post.title || '无标题') : '无标题',
              commentId: commentId,
              contentType: 'comment',
              content: `${user ? user.nickName : '微信用户'} 点赞了你的评论`,
              isRead: false,
              createTime: new Date()
            }
          });
        }
      } catch (msgError) {
        console.error('创建评论点赞消息失败:', msgError);
        // 不影响主流程
      }
    }
    
    // [新增] 返回最新的点赞数
    const updatedComment = await db.collection('comments').doc(commentId).get();
    
    return { 
      success: true,
      likes: updatedComment.data.likes
    };

  } catch (e) {
    console.error('likeComment error', e);
    return { success: false, message: '操作失败', error: e.toString() };
  }
};