const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const { commentId } = event;
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID || event.openid;

  if (!openid) {
    return {
      success: false,
      message: '无法获取用户 openid，请重新登录',
      code: 'NO_OPENID'
    };
  }

  if (!commentId) {
    return { success: false, message: '缺少评论ID' };
  }

  try {
    const commentRes = await db.collection('comments').doc(commentId).get();
    const comment = commentRes.data;
    const fileIDsToDelete = new Set();

    const collectFileIds = (commentDoc) => {
      if (!commentDoc) {
        return;
      }
      if (Array.isArray(commentDoc.imageUrls) && commentDoc.imageUrls.length > 0) {
        commentDoc.imageUrls.forEach(id => id && fileIDsToDelete.add(id));
      }
      if (Array.isArray(commentDoc.originalImageUrls) && commentDoc.originalImageUrls.length > 0) {
        commentDoc.originalImageUrls.forEach(id => id && fileIDsToDelete.add(id));
      }
    };


    if (!comment) {
      return { success: false, message: '评论不存在' };
    }

    collectFileIds(comment);

    if (comment._openid !== openid) {
      return { success: false, message: '无权删除该评论' };
    }

    let deleteIds = [commentId];

    if (!comment.parentId) {
      const repliesRes = await db.collection('comments')
        .where({ parentId: commentId })
        .limit(1000)
        .get();
      repliesRes.data.forEach(reply => collectFileIds(reply));
      const replyIds = repliesRes.data.map(reply => reply._id);
      if (replyIds.length > 0) {
        deleteIds = deleteIds.concat(replyIds);
      }
    }

    if (deleteIds.length > 0) {
      if (fileIDsToDelete.size > 0) {
        try {
          await cloud.deleteFile({ fileList: Array.from(fileIDsToDelete) });
        } catch (fileErr) {
          console.error('删除评论图片失败:', fileErr);
        }
      }
      const batchRemove = async (collectionName, buildFilter) => {
        const tasks = [];
        for (let i = 0; i < deleteIds.length; i += 10) {
          const ids = deleteIds.slice(i, i + 10);
          tasks.push(
            db.collection(collectionName).where(buildFilter(ids)).remove()
          );
        }
        await Promise.all(tasks);
      };

      await batchRemove('votes_log', ids => ({
        commentId: _.in(ids),
        type: 'comment'
      }));

      await batchRemove('messages', ids => ({
        commentId: _.in(ids),
        type: 'comment'
      }));

      await batchRemove('comments', ids => ({
        _id: _.in(ids)
      }));
    }

    if (comment.postId) {
      const decrement = deleteIds.length;
      await db.collection('posts').doc(comment.postId).update({
        data: {
          commentCount: _.inc(-decrement)
        }
      });

      const postRes = await db.collection('posts').doc(comment.postId).get();
      if (postRes.data && postRes.data.commentCount < 0) {
        await db.collection('posts').doc(comment.postId).update({
          data: {
            commentCount: 0
          }
        });
      }
    }

    return {
      success: true,
      deletedCount: deleteIds.length
    };
  } catch (error) {
    console.error('deleteComment error:', error);
    return {
      success: false,
      message: '删除失败',
      error: error.toString()
    };
  }
};




