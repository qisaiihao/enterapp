const { createPostsDatabase, withPostResponse, resolveOwner } = require('./_lib/posts');
const { moderateBeforeWrite } = require('./_lib/moderation-gate');
const { queueModerationReview } = require('./_lib/moderation-review');
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = createPostsDatabase(cloud.database());
const _ = db.command;

// 可编辑的字段（根据实际需求可拓展）
const EDITABLE_KEYS = [
  'title',
  'content',
  'tags',
  'fileIDs',
  'backgroundColor',
  'textColor',
  'highlightSentence',
  'highlightLines',
  'sentenceGroups',
  'discussionSentences',
  'isAnonymous',
  'anonymousAuthorName',
  'author',
  'isPoem',
  'isOriginal',
  'isDiscussion',
  'isSeries',
  'seriesBlocks',
  'seriesBlockCount',
  'seriesCoverImage',
  'seriesCoverHighlight',
  'publishMode',
  'joinedActivityId',
  'joinedActivityTitleSnapshot'
];

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = event.openid || wxContext.OPENID;
  const postId = event.postId;
  const input = event.data || {};

  if (!openid || !postId) {
    return {
      success: false,
      code: 'INVALID_PARAMS',
      message: '用户未登录或参数不完整'
    };
  }

  // 只抽取支持修改的 key
  const updateData = {};
  EDITABLE_KEYS.forEach(key => {
    if (input[key] !== undefined) {
      updateData[key] = input[key];
    }
  });

  // 组诗：自动维护段落数与内容聚合
  if (input.seriesBlocks !== undefined && Array.isArray(input.seriesBlocks)) {
    updateData.seriesBlockCount = input.seriesBlocks.length;
    if (!input.content) {
      const merged = input.seriesBlocks
        .map(b => (b && b.content ? String(b.content).trim() : ''))
        .filter(Boolean)
        .join('\n\n');
      if (merged) updateData.content = merged;
    }
  }
  
  // 处理 fileIDs：如果提供了 fileIDs，需要同步更新 imageUrl 和 imageUrls 字段
  if (input.fileIDs !== undefined) {
    if (Array.isArray(input.fileIDs) && input.fileIDs.length > 0) {
      updateData.imageUrl = input.fileIDs[0];
      updateData.imageUrls = input.fileIDs;
      // 处理原图：如果有 originalFileIDs 则使用，否则使用 fileIDs（向后兼容）
      const originalFileIDs = input.originalFileIDs || input.fileIDs;
      updateData.originalImageUrl = originalFileIDs[0] || input.fileIDs[0];
      updateData.originalImageUrls = originalFileIDs;
      
      // 如果是诗歌模式，第一张图片作为背景图
      // 注意：这里需要从原帖子里读取 isPoem 字段，因为编辑时不会传这个字段
    } else {
      // 如果 fileIDs 为空数组，清空图片字段
      updateData.imageUrl = '';
      updateData.imageUrls = [];
      updateData.originalImageUrl = '';
      updateData.originalImageUrls = [];
      updateData.poemBgImage = ''; // 清空诗歌背景图
    }
  }
  
  if (input.originalFileIDs !== undefined && input.fileIDs === undefined && Array.isArray(input.originalFileIDs)) {
    updateData.originalImageUrls = input.originalFileIDs.filter(Boolean);
    updateData.originalImageUrl = updateData.originalImageUrls[0] || '';
  }

  updateData.updateTime = new Date();

  try {
    // 只能作者本人修改
    const oldRes = await db.collection('posts').doc(postId).get();
    const post = oldRes.data;
    if (!post) {
      return { success: false, code: 'NOT_FOUND', message: '帖子不存在' };
    }
    if (resolveOwner(post) !== openid) {
      return { success: false, code: 'FORBIDDEN', message: '无权编辑该帖子' };
    }

    // 已匿名的帖子编辑后继续匿名，兼容旧客户端漏传或默认传 false。
    // 普通内容编辑不承担公开作者身份的操作。
    if (post.isAnonymous === true || input.isAnonymous !== undefined) {
      const anonymous = post.isAnonymous === true || input.isAnonymous === true || input.isAnonymous === 'true';
      if (anonymous && post.isActivityPost === true) {
        return { success: false, code: 'INVALID_ANONYMOUS_ACTIVITY', message: '官方活动帖不支持匿名' };
      }
      updateData.isAnonymous = anonymous;
      updateData._openid = anonymous ? '123456' : openid;
      updateData.realAuthorOpenid = anonymous ? openid : null;
      if (anonymous) {
        updateData.authorName = input.anonymousAuthorName || '匿名用户';
        updateData.anonymousAuthorName = updateData.authorName;
        updateData.author = updateData.authorName;
        updateData.authorNameSnapshot = updateData.authorName;
        updateData.authorAvatar = '/static/images/avatar.png';
        updateData.authorAvatarSnapshot = updateData.authorAvatar;
        updateData.authorSignature = '';
      }
    }

        // 官方活动帖不允许改活动归属，避免污染活动官方流
    if (post.isActivityPost === true && (input.joinedActivityId !== undefined || input.joinedActivityTitleSnapshot !== undefined)) {
      return { success: false, code: 'FORBIDDEN', message: '官方活动帖不允许修改参与活动' };
    }

    // 校验并规范化参与活动字段
    const nextIsSeries = updateData.isSeries !== undefined ? updateData.isSeries === true : post.isSeries === true;
    let nextPublishMode = updateData.publishMode || post.publishMode || (post.isPoem === true ? 'poem' : 'normal');
    const requestedPoem = updateData.isPoem === true || nextPublishMode === 'poem' || nextIsSeries;

    if (requestedPoem) {
      nextPublishMode = 'poem';
    } else if (nextPublishMode !== 'discussion') {
      nextPublishMode = 'normal';
    }

    const nextIsPoem = nextPublishMode === 'poem' || nextIsSeries;
    updateData.publishMode = nextPublishMode;
    updateData.isPoem = nextIsPoem;
    updateData.isSeries = nextIsSeries;
    updateData.isDiscussion = nextPublishMode === 'discussion' && !nextIsSeries;
    updateData.isOriginal = nextIsPoem
      ? (updateData.isOriginal !== undefined ? updateData.isOriginal === true : post.isOriginal === true)
      : false;

    if (post.isActivityPost === true) {
      updateData.publishMode = 'normal';
      updateData.isPoem = false;
      updateData.isSeries = false;
      updateData.isOriginal = false;
      updateData.isDiscussion = false;
    }

    if (input.joinedActivityId !== undefined) {
      const nextJoinedActivityId = String(input.joinedActivityId || '').trim();
      const currentJoinedActivityId = String(post.joinedActivityId || '').trim();

      if (!nextJoinedActivityId) {
        updateData.joinedActivityId = '';
        updateData.joinedActivityTitleSnapshot = '';
        updateData.joinedActivityAt = null;
      } else if (nextJoinedActivityId === currentJoinedActivityId) {
                // 活动归属未变更时不重复校验活动时间，避免活动结束后无法编辑正文
        if (input.joinedActivityTitleSnapshot !== undefined) {
          updateData.joinedActivityTitleSnapshot =
            String(input.joinedActivityTitleSnapshot || '').trim() || String(post.joinedActivityTitleSnapshot || '');
        }
      } else {
        let joinedActivityDoc = null;
        try {
          const activityRes = await db.collection('activities').doc(nextJoinedActivityId).get();
          joinedActivityDoc = activityRes.data || null;
        } catch (error) {
          joinedActivityDoc = null;
        }

        if (!joinedActivityDoc || joinedActivityDoc.isDeleted === true) {
          return { success: false, code: 'JOIN_ACTIVITY_NOT_FOUND', message: '参与的活动不存在' };
        }
        if (joinedActivityDoc.status !== 'published') {
          return { success: false, code: 'JOIN_ACTIVITY_NOT_PUBLISHED', message: '活动未发布，暂不可参加' };
        }
        if (joinedActivityDoc.allowUserSubmission === false) {
          return { success: false, code: 'JOIN_ACTIVITY_SUBMISSION_DISABLED', message: '该活动暂不支持用户投稿' };
        }

        const nowMs = Date.now();
        const startMs = joinedActivityDoc.startTime ? new Date(joinedActivityDoc.startTime).getTime() : 0;
        const endMs = joinedActivityDoc.endTime ? new Date(joinedActivityDoc.endTime).getTime() : 0;
        if (!startMs || !endMs || nowMs < startMs || nowMs > endMs) {
          return { success: false, code: 'JOIN_ACTIVITY_CLOSED', message: '活动不在进行中，暂不可参加' };
        }

        updateData.joinedActivityId = nextJoinedActivityId;
        updateData.joinedActivityTitleSnapshot = String(input.joinedActivityTitleSnapshot || '').trim() || joinedActivityDoc.title || '';
        updateData.joinedActivityAt = new Date();
      }
    }
    
    // 如果是诗歌模式且有图片，更新诗歌背景图
    if (nextIsPoem && updateData.imageUrls && updateData.imageUrls.length > 0) {
      updateData.poemBgImage = updateData.imageUrls[0];
    } else if (nextIsPoem && updateData.imageUrls && updateData.imageUrls.length === 0) {
      // 如果清空了图片，也清空诗歌背景图
      updateData.poemBgImage = '';
    }
    
    const oldActivityId = post.isActivityPost === true
      ? String(post.activityId || '')
      : String(post.joinedActivityId || '');

    const submittedContentKeys = ['title', 'content', 'tags', 'author', 'anonymousAuthorName', 'highlightSentence', 'highlightLines', 'seriesCoverHighlight', 'sentenceGroups', 'discussionSentences', 'seriesBlocks', 'seriesCoverImage', 'fileIDs', 'originalFileIDs'];
    if (submittedContentKeys.some(key => input[key] !== undefined)) {
      const moderationFailure = await moderateBeforeWrite(cloud, {
        title: updateData.title,
        content: updateData.content,
        author: updateData.author,
        anonymousAuthorName: updateData.anonymousAuthorName,
        tags: updateData.tags,
        highlightSentence: updateData.highlightSentence,
        highlightLines: updateData.highlightLines,
        seriesCoverHighlight: updateData.seriesCoverHighlight,
        sentenceGroups: updateData.sentenceGroups,
        discussionSentences: updateData.discussionSentences,
        seriesBlocks: updateData.seriesBlocks,
        seriesCoverImage: updateData.seriesCoverImage,
        images: Array.isArray(input.originalFileIDs) && input.originalFileIDs.length
          ? input.originalFileIDs : updateData.imageUrls
      });
      if (moderationFailure) {
        if (!['CONTENT_BLOCKED', 'REVIEW_REQUIRED'].includes(moderationFailure.code)) return moderationFailure;
        const newActivityId = post.isActivityPost === true
          ? String(post.activityId || '')
          : String(updateData.joinedActivityId !== undefined ? updateData.joinedActivityId : (post.joinedActivityId || ''));
        return await queueModerationReview(db, {
          openid, source: 'updatePostContent', kind: 'post_edit', audit: moderationFailure,
          data: updateData, postId, basePost: post, related: { oldActivityId, newActivityId }
        });
      }
    }

    // 执行更新：只更新指定字段，保留 votes、commentCount 等其他字段
    await db.collection('posts').doc(postId).update({ data: updateData });

    const newActivityId = post.isActivityPost === true
      ? String(post.activityId || '')
      : String(
          updateData.joinedActivityId !== undefined
            ? updateData.joinedActivityId
            : (post.joinedActivityId || '')
        );

    // 活动参与关系变化时，维护活动帖子统计
    if (oldActivityId !== newActivityId) {
      const now = new Date();
      try {
        if (oldActivityId) {
          await db.collection('activities').doc(oldActivityId).update({
            data: {
              postCount: _.inc(-1),
              updatedAt: now
            }
          });
        }
      } catch (decError) {
        console.warn('[updatePostContent] 旧活动计数递减失败:', decError);
      }

      try {
        if (newActivityId) {
          await db.collection('activities').doc(newActivityId).update({
            data: {
              postCount: _.inc(1),
              lastPostTime: now,
              updatedAt: now
            }
          });
        }
      } catch (incError) {
        console.warn('[updatePostContent] 新活动计数递增失败:', incError);
      }
    }
    
    return { success: true, postId, updateFields: Object.keys(updateData) };
  } catch (e) {
    console.error('【updatePostContent】更新失败:', e);
    return { success: false, code: 'ERROR', message: e.message };
  }
};

exports.main = withPostResponse(exports.main);
