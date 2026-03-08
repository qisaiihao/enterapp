const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
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
  'isAnonymous',
  'anonymousAuthorName',
  'author',
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

  // 鍙娊鍙栨敮鎸佷慨鏀圭殑key
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
  
  // 澶勭悊fileIDs锛氬鏋滄彁渚涗簡fileIDs锛岄渶瑕佹洿鏂癷mageUrl鍜宨mageUrls瀛楁
  if (input.fileIDs !== undefined) {
    if (Array.isArray(input.fileIDs) && input.fileIDs.length > 0) {
      updateData.imageUrl = input.fileIDs[0];
      updateData.imageUrls = input.fileIDs;
      // 澶勭悊鍘熷浘锛氬鏋滄湁originalFileIDs鍒欎娇鐢紝鍚﹀垯浣跨敤fileIDs锛堝悜鍚庡吋瀹癸級
      const originalFileIDs = input.originalFileIDs || input.fileIDs;
      updateData.originalImageUrl = originalFileIDs[0] || input.fileIDs[0];
      updateData.originalImageUrls = originalFileIDs;
      
      // 濡傛灉鏄瘲姝屾ā寮忥紝绗竴寮犲浘鐗囦綔涓鸿儗鏅浘
      // 娉ㄦ剰锛氳繖閲岄渶瑕佷粠鍘熷笘瀛愯幏鍙?isPoem 瀛楁锛屽洜涓虹紪杈戞椂涓嶄細浼犻€掕繖涓瓧娈?
    } else {
      // 濡傛灉fileIDs涓虹┖鏁扮粍锛屾竻绌哄浘鐗囧瓧娈?
      updateData.imageUrl = '';
      updateData.imageUrls = [];
      updateData.originalImageUrl = '';
      updateData.originalImageUrls = [];
      updateData.poemBgImage = ''; // 娓呯┖璇楁瓕鑳屾櫙鍥?
    }
  }
  
  updateData.updateTime = new Date();

  try {
    // 鍙兘浣滆€呮湰浜轰慨鏀?
    const oldRes = await db.collection('posts').doc(postId).get();
    const post = oldRes.data;
    if (!post) {
      return { success: false, code: 'NOT_FOUND', message: '帖子不存在' };
    }
    if (post._openid !== openid) {
      return { success: false, code: 'FORBIDDEN', message: '无权编辑该帖子' };
    }

        // 官方活动帖不允许改活动归属，避免污染活动官方流
    if (post.isActivityPost === true && (input.joinedActivityId !== undefined || input.joinedActivityTitleSnapshot !== undefined)) {
      return { success: false, code: 'FORBIDDEN', message: '官方活动帖不允许修改参与活动' };
    }

    // 鏍￠獙骞惰鑼冨寲鍙備笌娲诲姩瀛楁
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
    
    // 濡傛灉鏄瘲姝屾ā寮忎笖鏈夊浘鐗囷紝鏇存柊璇楁瓕鑳屾櫙鍥?
    if (post.isPoem && updateData.imageUrls && updateData.imageUrls.length > 0) {
      updateData.poemBgImage = updateData.imageUrls[0];
    } else if (post.isPoem && (!updateData.imageUrls || updateData.imageUrls.length === 0)) {
      // 濡傛灉娓呯┖浜嗗浘鐗囷紝涔熸竻绌鸿瘲姝岃儗鏅浘
      updateData.poemBgImage = '';
    }
    
    const oldActivityId = post.isActivityPost === true
      ? String(post.activityId || '')
      : String(post.joinedActivityId || '');

    // 鎵ц鏇存柊锛堝彧鏇存柊鎸囧畾瀛楁锛屼繚鐣欏叾浠栧瓧娈靛 votes, commentCount 绛夛級
    await db.collection('posts').doc(postId).update({ data: updateData });

    const newActivityId = post.isActivityPost === true
      ? String(post.activityId || '')
      : String(
          updateData.joinedActivityId !== undefined
            ? updateData.joinedActivityId
            : (post.joinedActivityId || '')
        );

    // 娲诲姩鍙備笌鍏崇郴鍙樺寲鏃讹紝缁存姢娲诲姩甯栧瓙缁熻
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
        console.warn('[updatePostContent] 鏃ф椿鍔ㄨ鏁伴€掑噺澶辫触:', decError);
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
        console.warn('[updatePostContent] 鏂版椿鍔ㄨ鏁伴€掑澶辫触:', incError);
      }
    }
    
    return { success: true, postId, updateFields: Object.keys(updateData) };
  } catch (e) {
    console.error('銆恥pdatePostContent銆戞洿鏂板け璐?', e);
    return { success: false, code: 'ERROR', message: e.message };
  }
};

