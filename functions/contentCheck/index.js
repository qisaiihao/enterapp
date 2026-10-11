const { createPostsDatabase, withPostResponse } = require('./_lib/posts');
const { createModerationService } = require('./moderation');
// 引入云开发 SDK
// 注意：内容审核 SDK 当前未启用，不能在模块加载阶段强依赖它，
// 否则仅做“审核直通”时也会因为缺少依赖导致整个云函数启动失败。
const cloud = require('wx-server-sdk');

// 初始化云开发
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = createPostsDatabase(cloud.database());
const _ = db.command;
const moderation = createModerationService(cloud);
const { isAdminByPoemId } = require('./_lib/admin-auth');

// 校验当前用户是否为管理员

// 云函数入口函数
function buildFailure({ code, msg, errorCode, extra = {} }) {
  const result = {
    code,
    msg,
    success: false,
    message: msg,
    ...extra
  };
  if (errorCode) {
    result.errorCode = errorCode;
  }
  return result;
}

function buildSuccess({ postId, msg = '发布成功', extra = {} }) {
  return {
    code: 0,
    msg,
    success: true,
    message: msg,
    postId,
    ...extra
  };
}
function isModerationOnlyRequest(event = {}) {
  return typeof event.type === 'string' && ['text', 'image', 'batch'].includes(event.type);
}

exports.main = async (event, context) => {
  console.log('=== contentCheck started ===');
  // Do not log UGC payloads or signed image URLs.
  const moderationOnly = isModerationOnlyRequest(event);
  console.log('[contentCheck] request mode:', moderationOnly ? 'moderation-only' : 'legacy-create-post');

  if (moderationOnly) {
    return moderation.moderate(event);
  }

  console.log('[contentCheck] legacy publish request detected, continue to create post');

  const wxContext = cloud.getWXContext();
  // App 身份沿用统一调用层注入；匿名展示身份只在服务端存储时替换。
  const openid = (event && event.openid) || wxContext.OPENID;

  if (!openid) {
    return buildFailure({
      code: -1001,
      msg: '无法获取用户 openid，请重新登录',
      errorCode: 'NO_OPENID'
    });
  }

  // 从 event 中获取要审查的文本和图片 fileID
  let {
    text,
    fileIDs,
    originalFileIDs,
    title,
    content,
    publishMode,
    isOriginal,
    author,
    tags,
    backgroundColor,
    textColor,
    highlightSentence,
    highlightLines,
    isPoem,
    isDiscussion,
    parentPostId,
    isAnonymous,
    anonymousAuthorName,
    realAuthorOpenid,
    sentenceGroups = [],
    discussionSentences = [],
    quotedPostId = '',
    isSeries = false,
    seriesBlocks = [],
    activityId: rawActivityId = '',
    activityTitleSnapshot: rawActivityTitleSnapshot = '',
    joinActivityId: rawJoinActivityId = '',
    joinActivityTitleSnapshot: rawJoinActivityTitleSnapshot = ''
  } = event;

  let activityId = typeof rawActivityId === 'string' ? rawActivityId.trim() : '';
  let activityTitleSnapshot = typeof rawActivityTitleSnapshot === 'string' ? rawActivityTitleSnapshot.trim() : '';
  let joinActivityId = typeof rawJoinActivityId === 'string' ? rawJoinActivityId.trim() : '';
  let joinActivityTitleSnapshot = typeof rawJoinActivityTitleSnapshot === 'string' ? rawJoinActivityTitleSnapshot.trim() : '';
  let activityDoc = null;
  const normalizeBoolean = (value) => value === true || value === 'true';
  isAnonymous = normalizeBoolean(isAnonymous);

  if (activityId && joinActivityId) {
    return buildFailure({
      code: -1101,
      msg: '不能同时设置活动官方发布和活动参与',
      errorCode: 'INVALID_ACTIVITY_PARAMS'
    });
  }

  if (activityId) {
    const admin = await isAdminByPoemId({ db, command: _, openid, loggerPrefix: 'contentCheck' });
    if (!admin) {
      return buildFailure({
        code: -1102,
        msg: '只有管理员可以发布活动帖子',
        errorCode: 'NO_PERMISSION'
      });
    }

    try {
      const activityRes = await db.collection('activities').doc(activityId).get();
      activityDoc = activityRes.data || null;
    } catch (err) {
      console.error('[contentCheck] 查询活动失败:', err);
      return buildFailure({
        code: -1103,
        msg: '活动不存在',
        errorCode: 'ACTIVITY_NOT_FOUND'
      });
    }

    if (!activityDoc || activityDoc.isDeleted === true) {
      return buildFailure({
        code: -1103,
        msg: '活动不存在',
        errorCode: 'ACTIVITY_NOT_FOUND'
      });
    }

    activityTitleSnapshot = activityTitleSnapshot || activityDoc.title || '';

    // 活动帖子强制为普通帖子模式
    publishMode = 'normal';
    isDiscussion = false;
    isSeries = false;
    isOriginal = false;
    parentPostId = '';
    quotedPostId = '';
    isAnonymous = false;
  }

  if (joinActivityId) {
    try {
      const joinActivityRes = await db.collection('activities').doc(joinActivityId).get();
      const joinActivityDoc = joinActivityRes.data || null;
      if (!joinActivityDoc || joinActivityDoc.isDeleted === true) {
        return buildFailure({
          code: -1104,
          msg: '参与的活动不存在',
          errorCode: 'JOIN_ACTIVITY_NOT_FOUND'
        });
      }
      if (joinActivityDoc.status !== 'published') {
        return buildFailure({
          code: -1105,
          msg: '活动未发布，暂不可参加',
          errorCode: 'JOIN_ACTIVITY_NOT_PUBLISHED'
        });
      }
      if (joinActivityDoc.allowUserSubmission === false) {
        return buildFailure({
          code: -1107,
          msg: '该活动暂不支持用户投稿',
          errorCode: 'JOIN_ACTIVITY_SUBMISSION_DISABLED'
        });
      }
      const nowMs = Date.now();
      const startMs = joinActivityDoc.startTime ? new Date(joinActivityDoc.startTime).getTime() : 0;
      const endMs = joinActivityDoc.endTime ? new Date(joinActivityDoc.endTime).getTime() : 0;
      if (!startMs || !endMs || nowMs < startMs || nowMs > endMs) {
        return buildFailure({
          code: -1106,
          msg: '活动不在进行中，暂不可参加',
          errorCode: 'JOIN_ACTIVITY_CLOSED'
        });
      }
      joinActivityTitleSnapshot = joinActivityTitleSnapshot || joinActivityDoc.title || '';
    } catch (err) {
      console.error('[contentCheck] 查询参与活动失败:', err);
      return buildFailure({
          code: -1104,
          msg: '参与的活动不存在',
          errorCode: 'JOIN_ACTIVITY_NOT_FOUND'
        });
    }
  }
  
  isSeries = normalizeBoolean(isSeries);
  isDiscussion = normalizeBoolean(isDiscussion);
  isPoem = normalizeBoolean(isPoem);
  publishMode = (isSeries || isPoem || publishMode === 'poem') ? 'poem' : (publishMode || 'normal');
  isPoem = publishMode === 'poem' || isSeries;
  isDiscussion = publishMode === 'discussion' && !isSeries;
  isOriginal = isPoem ? normalizeBoolean(isOriginal) : false;

  content = content || '';
  title = title || '';

  // 统一处理高光行，便于后续写库（保持用户选择的顺序，可包含重复句，但最多三句）
const clampTop3 = (lines = []) =>
  (lines || [])
    .map(l => (l || '').trim())
    .filter(Boolean)
    .slice(0, 3);

// 去重并截取前三行，兼容旧版本未定义 dedupeTop3 的情况
const dedupeTop3 = (lines = []) => {
  const seen = new Set();
  const result = [];
  for (const raw of lines || []) {
    const line = (raw || '').trim();
    if (!line) continue;
    if (seen.has(line)) continue;
    seen.add(line);
    result.push(line);
    if (result.length >= 3) break;
  }
  return result;
};

  let effectiveHighlightLines = clampTop3(Array.isArray(highlightLines) ? highlightLines : []);
  let highlightSentenceValue = highlightSentence || '';

  // 讨论模式：规范化句子组与高光行
  let normalizedSentenceGroups = [];
  if (isDiscussion) {
    if (Array.isArray(sentenceGroups)) {
      normalizedSentenceGroups = sentenceGroups
        .map(g => ({
          sentences: Array.isArray(g.sentences) ? g.sentences.filter(s => typeof s === 'string' && s.trim() !== '') : [],
          comment: (g.comment || '').trim()
        }))
        .filter(g => g.sentences.length > 0 || g.comment);
    } else if (Array.isArray(discussionSentences)) {
      normalizedSentenceGroups = discussionSentences
        .map(g => ({
          sentences: Array.isArray(g.sentences) ? g.sentences.filter(s => typeof s === 'string' && s.trim() !== '') : [],
          comment: (g.comment || '').trim()
        }))
        .filter(g => g.sentences.length > 0 || g.comment);
    }

    if (normalizedSentenceGroups.length > 0 && effectiveHighlightLines.length === 0) {
      effectiveHighlightLines = clampTop3(normalizedSentenceGroups.reduce((acc, g) => acc.concat(g.sentences || []), []));
    }
    if (!highlightSentenceValue && effectiveHighlightLines.length > 0) {
      highlightSentenceValue = effectiveHighlightLines[0];
    }
  }
  // 组诗模式：规范化分块并生成高光与合并内容
  let normalizedSeriesBlocks = [];
  if (isSeries) {
    normalizedSeriesBlocks = Array.isArray(seriesBlocks)
      ? seriesBlocks
          .map((block, idx) => {
            const blockContent = (block && block.content ? String(block.content) : '').trim();
            const blockSubtitle = (block && block.subtitle ? String(block.subtitle) : '').trim();
            const blockHighlight =
              (block && block.highlightSentence && String(block.highlightSentence).trim()) ||
              (blockContent.split(/\n+/).find(line => line && line.trim()) || '');
            const blockHighlightLines = Array.isArray(block?.highlightLines)
              ? block.highlightLines.filter(l => typeof l === 'string' && l.trim() !== '')
              : (blockHighlight ? [blockHighlight] : []);
            const imageUrl = block && block.imageUrl ? String(block.imageUrl) : '';
            const bg = block && block.backgroundColor ? String(block.backgroundColor) : '';
            const txtColor = block && block.textColor ? String(block.textColor) : '';
            if (!blockContent && !blockSubtitle && !imageUrl) return null;
            return {
              id: block?.id || `block-${idx}`,
              order: typeof block?.order === 'number' ? block.order : idx,
              subtitle: blockSubtitle,
              content: blockContent,
              highlightSentence: blockHighlight,
              highlightLines: blockHighlightLines,
              imageUrl,
              backgroundColor: bg,
              textColor: txtColor
            };
          })
          .filter(Boolean)
      : [];

    if (normalizedSeriesBlocks.length > 0) {
      const mergedSeriesContent = normalizedSeriesBlocks.map(b => b.content).filter(Boolean).join('\n\n');
      if (!content || !String(content).trim()) {
        content = mergedSeriesContent;
      }
      if (effectiveHighlightLines.length === 0) {
        const collected = [];
        for (const b of normalizedSeriesBlocks) {
          if (collected.length >= 3) break;
          if (Array.isArray(b.highlightLines) && b.highlightLines.length > 0) {
            for (const line of b.highlightLines) {
              if (collected.length >= 3) break;
              const s = (line || '').trim();
              if (s) collected.push(s);
            }
          } else if (b.highlightSentence) {
            const s = b.highlightSentence.trim();
            if (s) collected.push(s);
          }
        }
        effectiveHighlightLines = clampTop3(collected);
      }
      if (!highlightSentenceValue && effectiveHighlightLines.length > 0) {
        highlightSentenceValue = effectiveHighlightLines[0];
      }
    }
  }
  // 兜底限量，保证最终写库不超过三句（保留可能的重复，符合用户选择）
  effectiveHighlightLines = clampTop3(effectiveHighlightLines);
  if (!highlightSentenceValue && effectiveHighlightLines.length > 0) {
    highlightSentenceValue = effectiveHighlightLines[0];
  }
  
  const audit = await moderation.moderate({
    title,
    content,
    text,
    author,
    tags,
    anonymousAuthorName: isAnonymous ? anonymousAuthorName : '',
    sentenceGroups: normalizedSentenceGroups,
    seriesBlocks: normalizedSeriesBlocks,
    images: Array.isArray(originalFileIDs) && originalFileIDs.length
      ? originalFileIDs : (Array.isArray(fileIDs) ? fileIDs : [])
  });
  if (!audit.success || !audit.passed) {
    return buildFailure({
      code: -1201,
      msg: audit.message,
      errorCode: audit.code,
      extra: { passed: false, suggestion: audit.suggestion, requestId: audit.requestId }
    });
  }

  // ------------------- 3. 审核全部通过，写入数据库 -------------------
  try {
    // 获取当前用户信息
    // Use resolved openid above (event.openid preferred), fallback to context if missing
    const currentOpenid = openid || cloud.getWXContext().OPENID;
    
    const userInfo = await db.collection('users').where({
      _openid: currentOpenid
    }).get();
    if (!userInfo.data.length) {
      return buildFailure({ code: -1002, msg: '未找到当前账号，请重新登录后发布', errorCode: 'USER_NOT_FOUND' });
    }
    if (userInfo.data.some(user => user.postingBanned === true)) {
      return buildFailure({ code: -1003, msg: '账号已被限制发帖，请联系管理员', errorCode: 'POSTING_BANNED' });
    }
    const userNickName = userInfo.data.length > 0 ? userInfo.data[0].nickName : '匿名用户';
    const userAvatar = userInfo.data.length > 0 ? (userInfo.data[0].avatarUrl || '') : '';
    const userSignatureUrl = userInfo.data.length > 0 ? (userInfo.data[0].signatureUrl || '') : '';
    
    // 确定作者信息
    let authorName = '';
    let displayAuthorName = '';
    let displayAuthorAvatar = '';
    
    if (isAnonymous) {
      // 匿名发帖：显示匿名信息
      console.log('执行匿名发帖逻辑');
      authorName = anonymousAuthorName || '匿名用户';
      displayAuthorName = anonymousAuthorName || '匿名用户';
      displayAuthorAvatar = '/static/images/avatar.png'; // 使用默认头像
    } else {
      // 正常发帖
      if (publishMode === 'poem' || isSeries) {
        if (isOriginal) {
          // 原创诗歌：如果填写了作者就用填写的，否则使用用户昵称
          authorName = author && author.trim() ? author.trim() : userNickName;
        } else {
          // 非原创诗歌：必须使用填写的作者
          authorName = author && author.trim() ? author.trim() : '';
        }
      } else {
        // 普通帖子：使用用户昵称
        authorName = userNickName;
      }
      displayAuthorName = userNickName;
      displayAuthorAvatar = userAvatar;
    }

    const ownerOpenid = isAnonymous ? '123456' : currentOpenid;
    const postData = {
      _openid: ownerOpenid,
      title: title || '',
      content: content || '',
      createTime: new Date(),
      votes: 0,
      commentCount: 0,
      // 新增诗歌相关字段
      isPoem: isPoem,
      isSeries: isSeries,
      publishMode: publishMode,
      seriesBlocks: normalizedSeriesBlocks,
      seriesBlockCount: normalizedSeriesBlocks.length,
      seriesCoverImage: normalizedSeriesBlocks[0]?.imageUrl || '',
      seriesCoverHighlight: highlightSentenceValue || '',
      isOriginal: isOriginal,
      // 新增讨论相关字段
      isDiscussion: isDiscussion,
      parentPostId: parentPostId || '',
      quotedPostId: quotedPostId || '',
      sentenceGroups: normalizedSentenceGroups,
      discussionSentences: normalizedSentenceGroups.map(g => ({
        sentences: g.sentences,
        comment: g.comment
      })),
      // 新增作者字段
      author: authorName,
      authorName: displayAuthorName,
      authorAvatar: displayAuthorAvatar,
      authorNameSnapshot: displayAuthorName,
      authorAvatarSnapshot: displayAuthorAvatar,
      authorSignature: isAnonymous ? '' : (userSignatureUrl || ''), // 签名URL（匿名帖子不存储签名）
      // 匿名发帖相关字段
      isAnonymous: isAnonymous || false,
      anonymousAuthorName: anonymousAuthorName || '匿名用户',
      realAuthorOpenid: isAnonymous ? currentOpenid : null,
      // 新增标签字段
      tags: tags || [],
      // 活动帖子字段
      isActivityPost: Boolean(activityId),
      activityId: activityId || '',
      activityTitleSnapshot: activityTitleSnapshot || '',
      activityPublishTime: activityId ? new Date() : null,
      joinedActivityId: joinActivityId || '',
      joinedActivityTitleSnapshot: joinActivityTitleSnapshot || '',
      joinedActivityAt: joinActivityId ? new Date() : null,
      // 审核状态
      // UI 定制：背景色 + 高光句（可选）
      backgroundColor: backgroundColor || '',
      textColor: textColor || '#000000',
      highlightSentence: highlightSentenceValue || '',
      highlightLines: Array.isArray(effectiveHighlightLines) ? effectiveHighlightLines : [],
      auditStatus: 'approved', // 审核通过
      auditTime: new Date()
    };

    if (activityId) {
      postData.isPoem = false;
      postData.isSeries = false;
      postData.publishMode = 'normal';
      postData.seriesBlocks = [];
      postData.seriesBlockCount = 0;
      postData.seriesCoverImage = '';
      postData.seriesCoverHighlight = '';
      postData.isOriginal = false;
      postData.isDiscussion = false;
      postData.parentPostId = '';
      postData.quotedPostId = '';
      postData.sentenceGroups = [];
      postData.discussionSentences = [];
      postData.isAnonymous = false;
      postData.anonymousAuthorName = '';
      postData.realAuthorOpenid = null;
      postData.joinedActivityId = '';
      postData.joinedActivityTitleSnapshot = '';
      postData.joinedActivityAt = null;
    }
    
    if (fileIDs && fileIDs.length > 0) {
      // 过滤掉无效的 fileID
      const validFileIDs = fileIDs.filter(id => id && typeof id === 'string' && id.trim() !== '');
      const validOriginalFileIDs = originalFileIDs ? originalFileIDs.filter(id => id && typeof id === 'string' && id.trim() !== '') : [];
      
      if (validFileIDs.length > 0) {
        postData.imageUrl = validFileIDs[0];
        postData.imageUrls = validFileIDs;
        
        // 设置原图URL
        if (validOriginalFileIDs.length > 0) {
          postData.originalImageUrl = validOriginalFileIDs[0];
          postData.originalImageUrls = validOriginalFileIDs;
        } else {
          // 如果没有原图，使用压缩图作为原图
          postData.originalImageUrl = validFileIDs[0];
          postData.originalImageUrls = validFileIDs;
        }
        
        // 如果是诗歌模式，第一张图片作为背景图
        if (publishMode === 'poem' || isSeries) {
          postData.poemBgImage = validFileIDs[0];
        }
      } else {
        console.warn('没有有效的图片 URL，跳过图片字段设置');
      }
    }

    // 数据验证
    const hasSeriesBlocks = postData.isSeries && Array.isArray(postData.seriesBlocks) && postData.seriesBlocks.length > 0;
    if (!postData.title && !postData.content && !hasSeriesBlocks) {
      throw new Error('标题和内容不能同时为空');
    }
    
    if (!postData._openid) {
      throw new Error('用户openid缺失');
    }
    
    const result = await db.collection('posts').add({
      data: postData
    });

    // 回写活动统计（官方活动帖或用户参与活动）
    const targetActivityId = activityId || joinActivityId;
    if (targetActivityId) {
      try {
        await db.collection('activities').doc(targetActivityId).update({
          data: {
            postCount: _.inc(1),
            lastPostTime: new Date(),
            updatedAt: new Date()
          }
        });
      } catch (activityUpdateError) {
        console.warn('[contentCheck] 活动统计更新失败（不影响发布）:', activityUpdateError);
      }
    }

    console.log('数据库写入成功，返回结果:', {
      postId: result._id,
      insertedCount: result.stats?.inserted || 1
    });

    // ------------------- 4. 非原创诗歌自动创建诗人主页 -------------------
    if ((publishMode === 'poem' || isSeries) && !isOriginal && authorName && authorName.trim()) {
      try {
        const poetName = authorName.trim();
        console.log('检查诗人主页是否存在:', poetName);
        
        // 查询诗人是否已存在
        const poetResult = await db.collection('poets')
          .where({ name: poetName })
          .limit(1)
          .get();
        
        if (!poetResult.data || poetResult.data.length === 0) {
          // 诗人不存在，自动创建
          console.log('诗人主页不存在，自动创建:', poetName);
          const newPoet = {
            name: poetName,
            avatar: '',  // 默认无头像
            bio: '',     // 默认无简介
            createTime: db.serverDate(),
            updateTime: db.serverDate(),
            creatorOpenid: currentOpenid  // 记录谁首次触发创建
          };
          
          const poetAddResult = await db.collection('poets').add({ data: newPoet });
          console.log('诗人主页创建成功:', poetAddResult._id);
        } else {
          console.log('诗人主页已存在，无需创建:', poetName);
        }
      } catch (poetError) {
        // 诗人主页创建失败不影响帖子发布
        console.warn('自动创建诗人主页失败（不影响发帖）:', poetError);
      }
    }

    // 全部成功，返回成功状态
    return buildSuccess({
      postId: result._id,
      msg: '发布成功'
    });

  } catch (dbError) {
    console.error('数据库写入失败:', dbError);
    console.error('数据库错误详情:', {
      message: dbError.message,
      code: dbError.code,
      stack: dbError.stack
    });
    return buildFailure({
      code: -3,
      msg: '数据库存储失败: ' + dbError.message,
      errorCode: dbError.code || 'DB_WRITE_FAILED',
      extra: { error: dbError.message }
    });
  }
};

exports.main = withPostResponse(exports.main);
