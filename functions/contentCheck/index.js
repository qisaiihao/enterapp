// 引入云开发 SDK
// 注意：内容审核 SDK 当前未启用，不能在模块加载阶段强依赖它，
// 否则仅做“审核直通”时也会因为缺少依赖导致整个云函数启动失败。
const cloud = require('wx-server-sdk');

// 初始化云开发
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;
const ADMIN_POEM_IDS = ['qisaihao', 'jingmikun'];

// 校验当前用户是否为管理员
async function isAdmin(openid) {
  try {
    const result = await db.collection('users').where({
      _openid: openid,
      poemId: _.in(ADMIN_POEM_IDS)
    }).limit(1).get();
    return result.data.length > 0;
  } catch (error) {
    console.error('[contentCheck] 校验管理员权限失败:', error);
    return false;
  }
}

// 云函数入口函数
// TODO: 此云函数已暂时禁用，因为腾讯云内容审核服务未续费
// 未来续费后可以重新启用此云函数
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

function buildModerationPass(message = '审核通过', extra = {}) {
  return {
    code: 0,
    success: true,
    passed: true,
    message,
    msg: message,
    ...extra
  };
}

exports.main = async (event, context) => {
  console.log('=== contentCheck started ===');
  console.log('[contentCheck] received event:', JSON.stringify(event, null, 2));
  
  // 暂时跳过审核，直接执行帖子创建逻辑
  const moderationOnly = isModerationOnlyRequest(event);
  console.log('[contentCheck] request mode:', moderationOnly ? 'moderation-only' : 'legacy-create-post');

  if (moderationOnly) {
    console.log('[contentCheck] moderation-only request detected, skip post creation');
    console.log('[contentCheck] audit service is currently bypassed, return pass result directly');
    return buildModerationPass();
  }

  console.log('[contentCheck] legacy publish request detected, continue to create post');

  const wxContext = cloud.getWXContext();
  // Prefer event.openid so callers can override (e.g., anonymous posts)
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

  if (activityId && joinActivityId) {
    return buildFailure({
      code: -1101,
      msg: '不能同时设置活动官方发布和活动参与',
      errorCode: 'INVALID_ACTIVITY_PARAMS'
    });
  }

  if (activityId) {
    const admin = await isAdmin(openid);
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
  
  console.log('接收到的fileIDs:', fileIDs);
  console.log('接收到的originalFileIDs:', originalFileIDs);
  console.log('fileIDs类型:', typeof fileIDs);
  console.log('fileIDs长度:', fileIDs ? fileIDs.length : 'undefined');
  console.log('originalFileIDs长度:', originalFileIDs ? originalFileIDs.length : 'undefined');
  console.log('匿名发帖参数:', { isAnonymous, anonymousAuthorName, realAuthorOpenid });
  console.log('讨论参数:', {
    isDiscussion,
    sentenceGroupsLength: Array.isArray(sentenceGroups) ? sentenceGroups.length : 0,
    discussionSentencesLength: Array.isArray(discussionSentences) ? discussionSentences.length : 0,
    quotedPostId
  });
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
  
  /*
  // 以下是原来的内容审核逻辑，暂时注释掉，未来续费后可以重新启用
  // 策略 ID 配置 - 使用默认策略 ID（数字类型）
  // 注意：BizType 参数需要是数字类型，不是字符串
  const TEXT_BIZ_TYPE = 0; // 文本审核策略ID，使用默认策略
  const IMAGE_BIZ_TYPE = 0; // 图片审核策略ID，使用默认策略

  // 调试模式：设置为 true 可以跳过审核（仅用于测试）
  const DEBUG_SKIP_AUDIT = false;

  // 检查环境变量
  console.log('环境变量检查:');
  console.log('TENCENT_SECRET_ID:', process.env.TENCENT_SECRET_ID ? '已设置' : '未设置');
  console.log('TENCENT_SECRET_KEY:', process.env.TENCENT_SECRET_KEY ? '已设置' : '未设置');

  if (!process.env.TENCENT_SECRET_ID || !process.env.TENCENT_SECRET_KEY) {
    console.error('环境变量未正确设置');
    return buildFailure({
      code: -4,
      msg: '环境变量未正确设置，请检查 TENCENT_SECRET_ID 和 TENCENT_SECRET_KEY',
      errorCode: 'MISSING_ENV'
    });
  }

  // ------------------- 安全配置 -------------------
  // 从环境变量中安全地读取密钥
  const clientConfig = {
    credential: {
      secretId: process.env.TENCENT_SECRET_ID,
      secretKey: process.env.TENCENT_SECRET_KEY,
    },
    region: "ap-guangzhou", // 推荐使用广州地域，速度较快
    profile: {
      httpProfile: {
        endpoint: "cms.tencentcloudapi.com",
      },
    },
  };

  console.log('创建腾讯云客户端...');
  const client = new CmsClient(clientConfig);
  */

  /*
  // ------------------- 1. 文本审核 -------------------
  if (DEBUG_SKIP_AUDIT) {
    console.log('调试模式：跳过文本审核');
  } else if (text || title || content) {
    try {
      // 合并所有文本内容进行审核
      const fullText = [title, content, text].filter(t => t && t.trim()).join(' ');
      console.log('准备审核的文本内容:', fullText);

      const textParams = {
        Content: Buffer.from(fullText).toString('base64')
        // 移除BizType参数，使用默认策略
      };

      console.log('调用文本审核API...');
      console.log('审核参数:', {
        Content: textParams.Content.substring(0, 50) + '...'
      });

      const { Data } = await client.TextModeration(textParams);
      console.log('文本审核结果:', Data);

      if (Data.Suggestion !== 'Pass') {
        // 文本审核不通过，记录详细信息
        console.log('文本审核不通过，详细信息:', {
          suggestion: Data.Suggestion,
          labels: Data.Labels || [],
          subLabel: Data.SubLabel || '',
          confidence: Data.Confidence || 0
        });

        return {
          code: -1,
          msg: '文本内容不合规',
          suggestion: Data.Suggestion,
          details: Data.Labels || []
        };
      }
      console.log('文本审核通过');
    } catch (error) {
      console.error('文本审核API调用失败:', error);
      console.error('错误详情:', {
        message: error.message,
        code: error.code,
        stack: error.stack
      });
      return { code: -2, msg: '文本审核服务异常: ' + error.message };
    }
  }

  // ------------------- 2. 图片审核 -------------------
  if (DEBUG_SKIP_AUDIT) {
    console.log('调试模式：跳过图片审核');
  } else if (fileIDs && fileIDs.length > 0) {
    try {
      // 1. 用 fileID 换取临时的图片下载链接
      const fileList = fileIDs;
      const result = await cloud.getTempFileURL({ fileList });

      // 2. 对每张图片进行审核
      for (let i = 0; i < result.fileList.length; i++) {
        const fileItem = result.fileList[i];
        if (fileItem.status === 0) { // 成功获取临时 URL
          const imageParams = {
            FileUrl: fileItem.tempFileURL
            // 移除BizType参数，使用默认策略
          };
          const { Data } = await client.ImageModeration(imageParams);
          console.log('图片审核结果:', Data);

          // 图片审核的判断逻辑：检查各个检测模块的 HitFlag
          const hasViolation = Data.PornDetect?.HitFlag > 0 ||
                              Data.HotDetect?.HitFlag > 0 ||
                              Data.PolityDetect?.HitFlag > 0 ||
                              Data.IllegalDetect?.HitFlag > 0 ||
                              Data.TerrorDetect?.HitFlag > 0;

          if (hasViolation) {
            // 图片审核不通过，记录详细信息
            console.log('图片审核不通过，详细信息:', {
              pornDetect: Data.PornDetect,
              hotDetect: Data.HotDetect,
              polityDetect: Data.PolityDetect,
              illegalDetect: Data.IllegalDetect,
              terrorDetect: Data.TerrorDetect
            });

            return {
              code: -1,
              msg: '图片内容不合规',
              details: {
                pornDetect: Data.PornDetect,
                hotDetect: Data.HotDetect,
                polityDetect: Data.PolityDetect,
                illegalDetect: Data.IllegalDetect,
                terrorDetect: Data.TerrorDetect
              }
            };
          }
        }
      }
    } catch (error) {
      console.error('图片审核API调用失败:', error);
      return { code: -2, msg: '图片审核服务异常' };
    }
  }
  */
  
  // ------------------- 3. 审核全部通过，写入数据库 -------------------
  try {
    // 获取当前用户信息
    // Use resolved openid above (event.openid preferred), fallback to context if missing
    const currentOpenid = openid || cloud.getWXContext().OPENID;
    console.log('当前用户openid:', currentOpenid);
    
    const userInfo = await db.collection('users').where({
      _openid: currentOpenid
    }).get();
    const userNickName = userInfo.data.length > 0 ? userInfo.data[0].nickName : '匿名用户';
    const userAvatar = userInfo.data.length > 0 ? (userInfo.data[0].avatarUrl || '') : '';
    const userSignatureUrl = userInfo.data.length > 0 ? (userInfo.data[0].signatureUrl || '') : '';
    console.log('用户昵称:', userNickName);
    
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
      console.log('匿名发帖设置:', { authorName, displayAuthorName, displayAuthorAvatar });
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
      _openid: currentOpenid, // 添加openid字段
      title: title || '',
      content: content || '',
      createTime: new Date(),
      votes: 0,
      commentCount: 0,
      // 新增诗歌相关字段
      isPoem: publishMode === 'poem' || isSeries,
      isSeries: Boolean(isSeries),
      publishMode: publishMode || (isSeries ? 'poem' : 'normal'),
      seriesBlocks: normalizedSeriesBlocks,
      seriesBlockCount: normalizedSeriesBlocks.length,
      seriesCoverImage: normalizedSeriesBlocks[0]?.imageUrl || '',
      seriesCoverHighlight: highlightSentenceValue || '',
      isOriginal: isOriginal || false,
      // 新增讨论相关字段
      isDiscussion: isDiscussion || false,
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
      realAuthorOpenid: realAuthorOpenid || null,
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
      highlightLines: Array.isArray(effectiveHighlightLines) ? dedupeTop3(effectiveHighlightLines) : [],
      _openid: ownerOpenid,
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
      
      console.log('设置图片URL到帖子数据:', {
        originalFileIDs: fileIDs,
        validFileIDs: validFileIDs,
        originalOriginalFileIDs: originalFileIDs,
        validOriginalFileIDs: validOriginalFileIDs,
        imageUrl: validFileIDs[0],
        imageUrls: validFileIDs,
        originalImageUrl: validOriginalFileIDs[0],
        originalImageUrls: validOriginalFileIDs,
        imageUrlType: typeof validFileIDs[0]
      });
      
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
    
    console.log('准备写入数据库的帖子数据:', JSON.stringify(postData, null, 2));
    console.log('最终作者信息:', { 
      author: postData.author, 
      authorName: postData.authorName, 
      authorAvatar: postData.authorAvatar,
      isAnonymous: postData.isAnonymous 
    });
    
    // 测试数据库连接
    try {
      console.log('测试数据库连接...');
      const testResult = await db.collection('posts').limit(1).get();
      console.log('数据库连接正常，测试查询结果:', testResult);
    } catch (testError) {
      console.error('数据库连接测试失败:', testError);
      throw new Error(`数据库连接失败: ${testError.message}`);
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

    // 追加写入：颜色/高光句（与现有字段解耦，避免旧版本对象结构影响）
    try {
      await db.collection('posts').doc(result._id).update({
        data: {
          backgroundColor: backgroundColor || postData.backgroundColor || '',
          textColor: textColor || postData.textColor || '#000000',
          highlightSentence: highlightSentenceValue || postData.highlightSentence || ''
        }
      });

      // 兼容写入：高光行数组
      try {
        await db.collection('posts').doc(result._id).update({
          data: {
            highlightLines: Array.isArray(effectiveHighlightLines) ? effectiveHighlightLines : []
          }
        });
      } catch (e) {
        console.warn('[contentCheck] 写入 highlightLines 失败（忽略）:', e);
      }
    } catch (e) {
      console.warn('[contentCheck] 追加写入颜色/高光句失败，不影响发布:', e);
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
