const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

function uniqueCloudFileIds(values = []) {
  return [...new Set(
    values.filter((value) => typeof value === 'string' && value.startsWith('cloud://'))
  )];
}

async function buildTempUrlMap(fileIds = []) {
  const validFileIds = uniqueCloudFileIds(fileIds);
  if (!validFileIds.length) {
    return new Map();
  }

  try {
    const result = await cloud.getTempFileURL({ fileList: validFileIds });
    const urlMap = new Map();
    (result.fileList || []).forEach((item) => {
      if (item && item.status === 0 && item.fileID && item.tempFileURL) {
        urlMap.set(item.fileID, item.tempFileURL);
      }
    });
    return urlMap;
  } catch (error) {
    console.error('buildTempUrlMap error', error);
    return new Map();
  }
}

function mapTempUrls(values = [], urlMap = new Map()) {
  if (!Array.isArray(values) || values.length === 0) {
    return [];
  }
  return values.map((value) => urlMap.get(value) || value);
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID || event.openid;

  if (!openid) {
    return {
      success: false,
      message: 'Failed to get user openid, please login again.',
      code: 'NO_OPENID'
    };
  }

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
  const sanitizedImageUrls = Array.isArray(imageUrls) ? imageUrls.filter(Boolean) : [];
  let sanitizedOriginalImageUrls = Array.isArray(originalImageUrls) ? originalImageUrls.filter(Boolean) : [];

  if (sanitizedOriginalImageUrls.length === 0 && sanitizedImageUrls.length > 0) {
    sanitizedOriginalImageUrls = sanitizedImageUrls.slice();
  }

  const hasContent = trimmedContent.length > 0;
  const hasImages = sanitizedImageUrls.length > 0;

  if (!postId) {
    return { success: false, message: 'Post ID is required.' };
  }
  if (!hasContent && !hasImages) {
    return { success: false, message: 'Comment content or images are required.' };
  }

  try {
    const userResult = await db.collection('users').where({
      _openid: openid
    }).limit(1).get();
    const user = userResult.data[0];
    const createTime = new Date();

    const commentData = {
      _openid: openid,
      postId,
      content: trimmedContent,
      likes: 0,
      createTime,
      imageUrls: sanitizedImageUrls,
      originalImageUrls: sanitizedOriginalImageUrls,
      hasImages,
      isAnonymous,
      authorName: isAnonymous ? '匿名用户' : (user ? user.nickName : '微信用户'),
      authorAvatar: isAnonymous ? '/static/images/avatar.png' : (user ? user.avatarUrl : ''),
      realAuthorOpenid: isAnonymous ? openid : null
    };

    if (parentId) {
      commentData.parentId = parentId;
      if (replyToAuthorName) {
        commentData.replyToAuthorName = replyToAuthorName;
      }
    }

    const addResult = await db.collection('comments').add({
      data: commentData
    });

    await db.collection('posts').doc(postId).update({
      data: {
        commentCount: _.inc(1)
      }
    });

    try {
      const postResult = await db.collection('posts').doc(postId).get();
      const post = postResult.data;

      let notifyUserId = null;
      let shouldNotify = false;

      if (parentId) {
        try {
          const parentCommentResult = await db.collection('comments').doc(parentId).get();
          const parentComment = parentCommentResult.data;

          if (parentComment) {
            const parentCommentAuthorId = parentComment.isAnonymous
              ? (parentComment.realAuthorOpenid || parentComment._openid)
              : parentComment._openid;

            if (parentCommentAuthorId !== openid && !isAnonymous) {
              notifyUserId = parentCommentAuthorId;
              shouldNotify = true;
            }
          }
        } catch (commentError) {
          console.error('query parent comment failed', commentError);
        }
      } else if (post && post._openid !== openid && !isAnonymous) {
        notifyUserId = post._openid;
        shouldNotify = true;
      }

      if (shouldNotify && notifyUserId) {
        let contentType = 'post';
        let contentTypeText = '帖子';

        if (post && post.isDiscussion) {
          contentType = 'discussion';
          contentTypeText = '讨论';
        } else if (post && post.isPoem) {
          if (post.isOriginal) {
            contentType = 'original';
            contentTypeText = '原创诗歌';
          } else {
            contentType = 'non-original';
            contentTypeText = '诗歌';
          }
        }

        const senderName = user ? user.nickName : '微信用户';
        const messageContent = parentId
          ? `${senderName} 回复了你的评论`
          : `${senderName} 评论了你的${contentTypeText}`;

        await db.collection('messages').add({
          data: {
            fromUserId: openid,
            fromUserName: senderName,
            fromUserAvatar: user ? user.avatarUrl : '',
            toUserId: notifyUserId,
            type: 'comment',
            postId,
            postTitle: post && post.title ? post.title : '无标题',
            contentType,
            isReply: !!parentId,
            content: messageContent,
            commentId: addResult._id,
            isRead: false,
            createTime: new Date()
          }
        });
      }
    } catch (msgError) {
      console.error('create comment message failed', msgError);
    }

    const returnComment = {
      ...commentData,
      _id: addResult._id,
      parentId: parentId || null,
      replyToAuthorName: replyToAuthorName || null,
      liked: false,
      canDelete: true,
      replies: []
    };

    const urlMap = await buildTempUrlMap([
      returnComment.authorAvatar,
      ...returnComment.imageUrls,
      ...returnComment.originalImageUrls
    ]);

    if (urlMap.size > 0) {
      if (returnComment.authorAvatar) {
        returnComment.authorAvatar = urlMap.get(returnComment.authorAvatar) || returnComment.authorAvatar;
      }
      returnComment.imageUrls = mapTempUrls(returnComment.imageUrls, urlMap);
      returnComment.originalImageUrls = mapTempUrls(returnComment.originalImageUrls, urlMap);
    }

    return {
      success: true,
      message: 'Comment added successfully.',
      commentId: addResult._id,
      comment: returnComment
    };
  } catch (error) {
    console.error('addComment error', error);
    return {
      success: false,
      message: 'Failed to add comment.',
      error: error.toString()
    };
  }
};
