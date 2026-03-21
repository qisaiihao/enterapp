// 寮曞叆鑵捐浜慡DK鍜屼簯寮€鍙慡DK
// 注意：内容审核 SDK 当前未启用，不能在模块加载阶段强依赖它，
// 否则仅做“审核直通”时也会因为缺少依赖导致整个云函数启动失败。
const cloud = require('wx-server-sdk');

// 鍒濆鍖栦簯寮€鍙?
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;
const ADMIN_POEM_IDS = ['qisaihao', 'jingmikun'];

// 鎷垮埌鍐呭瀹夊叏锛坈ms锛夌殑 client
async function isAdmin(openid) {
  try {
    const result = await db.collection('users').where({
      _openid: openid,
      poemId: _.in(ADMIN_POEM_IDS)
    }).limit(1).get();
    return result.data.length > 0;
  } catch (error) {
    console.error('[contentCheck] 鏍￠獙绠＄悊鍛樻潈闄愬け璐?', error);
    return false;
  }
}

// 浜戝嚱鏁板叆鍙ｅ嚱鏁?
// TODO: 姝や簯鍑芥暟宸叉殏鏃剁鐢紝鍥犱负鑵捐浜戝唴瀹瑰鏍告湇鍔℃湭缁垂
// 鏈潵缁垂鍚庡彲浠ラ噸鏂板惎鐢ㄦ浜戝嚱鏁?
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
  
  // 鏆傛椂璺宠繃瀹℃牳锛岀洿鎺ユ墽琛屽笘瀛愬垱寤洪€昏緫
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

  // 浠?event 涓幏鍙栬瀹℃煡鐨勬枃鏈拰鍥剧墖fileID
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
      console.error('[contentCheck] 鏌ヨ娲诲姩澶辫触:', err);
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

    // 娲诲姩甯栧瓙寮哄埗涓烘櫘閫氬笘妯″紡
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
      console.error('[contentCheck] 鏌ヨ鍙備笌娲诲姩澶辫触:', err);
      return buildFailure({
          code: -1104,
          msg: '参与的活动不存在',
          errorCode: 'JOIN_ACTIVITY_NOT_FOUND'
        });
    }
  }
  
  console.log('鎺ユ敹鍒扮殑fileIDs:', fileIDs);
  console.log('鎺ユ敹鍒扮殑originalFileIDs:', originalFileIDs);
  console.log('fileIDs绫诲瀷:', typeof fileIDs);
  console.log('fileIDs闀垮害:', fileIDs ? fileIDs.length : 'undefined');
  console.log('originalFileIDs闀垮害:', originalFileIDs ? originalFileIDs.length : 'undefined');
  console.log('鍖垮悕鍙戝笘鍙傛暟:', { isAnonymous, anonymousAuthorName, realAuthorOpenid });
  console.log('璁ㄨ鍙傛暟:', {
    isDiscussion,
    sentenceGroupsLength: Array.isArray(sentenceGroups) ? sentenceGroups.length : 0,
    discussionSentencesLength: Array.isArray(discussionSentences) ? discussionSentences.length : 0,
    quotedPostId
  });
  content = content || '';
  title = title || '';

  // 缁熶竴澶勭悊楂樺厜琛岋紝渚夸簬鍚庣画鍐欏簱锛堜繚鎸佺敤鎴烽€夋嫨鐨勯『搴忥紝鍙寘鍚噸澶嶅彞锛屼絾鏈€澶氫笁鍙ワ級
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
  // 缁勮瘲妯″紡锛氳鑼冨寲鍒嗗潡骞剁敓鎴愰珮鍏変笌鍚堝苟鍐呭
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
  // 鍏滃簳闄愰噺锛屼繚璇佹渶缁堝啓搴撲笉瓒呰繃涓夊彞锛堜繚鐣欏彲鑳界殑閲嶅锛岀鍚堢敤鎴烽€夋嫨锛?
  effectiveHighlightLines = clampTop3(effectiveHighlightLines);
  if (!highlightSentenceValue && effectiveHighlightLines.length > 0) {
    highlightSentenceValue = effectiveHighlightLines[0];
  }
  
  /* 
  // 浠ヤ笅鏄師鏉ョ殑鍐呭瀹℃牳閫昏緫锛屾殏鏃舵敞閲婃帀锛屾湭鏉ョ画璐瑰悗鍙互閲嶆柊鍚敤
  // 绛栫暐ID閰嶇疆 - 浣跨敤榛樿绛栫暐ID锛堟暟瀛楃被鍨嬶級
  // 娉ㄦ剰锛欱izType 鍙傛暟闇€瑕佹槸鏁板瓧绫诲瀷锛屼笉鏄瓧绗︿覆
  const TEXT_BIZ_TYPE = 0; // 鏂囨湰瀹℃牳绛栫暐ID锛屼娇鐢ㄩ粯璁ょ瓥鐣?
  const IMAGE_BIZ_TYPE = 0; // 鍥剧墖瀹℃牳绛栫暐ID锛屼娇鐢ㄩ粯璁ょ瓥鐣?
  
  // 璋冭瘯妯″紡锛氳缃负true鍙互璺宠繃瀹℃牳锛堜粎鐢ㄤ簬娴嬭瘯锛?
  const DEBUG_SKIP_AUDIT = false;

  // 妫€鏌ョ幆澧冨彉閲?
  console.log('鐜鍙橀噺妫€鏌?');
  console.log('TENCENT_SECRET_ID:', process.env.TENCENT_SECRET_ID ? '宸茶缃? : '鏈缃?);
  console.log('TENCENT_SECRET_KEY:', process.env.TENCENT_SECRET_KEY ? '宸茶缃? : '鏈缃?);
  
  if (!process.env.TENCENT_SECRET_ID || !process.env.TENCENT_SECRET_KEY) {
    console.error('环境变量未正确设置');
    return buildFailure({
      code: -4,
      msg: '环境变量未正确设置，请检查 TENCENT_SECRET_ID 和 TENCENT_SECRET_KEY',
      errorCode: 'MISSING_ENV'
    });
  }

  // ------------------- 瀹夊叏閰嶇疆 -------------------
  // 浠庣幆澧冨彉閲忎腑瀹夊叏鍦拌鍙栧瘑閽?
  const clientConfig = {
    credential: {
      secretId: process.env.TENCENT_SECRET_ID,
      secretKey: process.env.TENCENT_SECRET_KEY,
    },
    region: "ap-guangzhou", // 鎺ㄨ崘浣跨敤骞垮窞鍦板煙锛岄€熷害杈冨揩
    profile: {
      httpProfile: {
        endpoint: "cms.tencentcloudapi.com",
      },
    },
  };
  
  console.log('鍒涘缓鑵捐浜戝鎴风...');
  const client = new CmsClient(clientConfig);
  */

  /*
  // ------------------- 1. 鏂囨湰瀹℃牳 -------------------
  if (DEBUG_SKIP_AUDIT) {
    console.log('璋冭瘯妯″紡锛氳烦杩囨枃鏈鏍?);
  } else if (text || title || content) {
    try {
      // 鍚堝苟鎵€鏈夋枃鏈唴瀹硅繘琛屽鏍?
      const fullText = [title, content, text].filter(t => t && t.trim()).join(' ');
      console.log('鍑嗗瀹℃牳鐨勬枃鏈唴瀹?', fullText);
      
      const textParams = {
        Content: Buffer.from(fullText).toString('base64')
        // 绉婚櫎BizType鍙傛暟锛屼娇鐢ㄩ粯璁ょ瓥鐣?
      };
      
      console.log('璋冪敤鏂囨湰瀹℃牳API...');
      console.log('瀹℃牳鍙傛暟:', { 
        Content: textParams.Content.substring(0, 50) + '...'
      });
      
      const { Data } = await client.TextModeration(textParams);
      console.log('鏂囨湰瀹℃牳缁撴灉:', Data);
      
      if (Data.Suggestion !== 'Pass') {
        // 鏂囨湰瀹℃牳涓嶉€氳繃锛岃褰曡缁嗕俊鎭?
        console.log('鏂囨湰瀹℃牳涓嶉€氳繃锛岃缁嗕俊鎭?', {
          suggestion: Data.Suggestion,
          labels: Data.Labels || [],
          subLabel: Data.SubLabel || '',
          confidence: Data.Confidence || 0
        });
        
        return {
          code: -1,
          msg: '鏂囨湰鍐呭涓嶅悎瑙?,
          suggestion: Data.Suggestion,
          details: Data.Labels || []
        };
      }
      console.log('鏂囨湰瀹℃牳閫氳繃');
    } catch (error) {
      console.error("鏂囨湰瀹℃牳API璋冪敤澶辫触:", error);
      console.error("閿欒璇︽儏:", {
        message: error.message,
        code: error.code,
        stack: error.stack
      });
      return { code: -2, msg: '鏂囨湰瀹℃牳鏈嶅姟寮傚父: ' + error.message };
    }
  }

  // ------------------- 2. 鍥剧墖瀹℃牳 -------------------
  if (DEBUG_SKIP_AUDIT) {
    console.log('璋冭瘯妯″紡锛氳烦杩囧浘鐗囧鏍?);
  } else if (fileIDs && fileIDs.length > 0) {
    try {
      // 1. 鐢?fileID 鎹㈠彇涓存椂鐨勫浘鐗囦笅杞介摼鎺?
      const fileList = fileIDs;
      const result = await cloud.getTempFileURL({ fileList });
      
      // 2. 瀵规瘡寮犲浘鐗囪繘琛屽鏍?
      for (let i = 0; i < result.fileList.length; i++) {
        const fileItem = result.fileList[i];
        if (fileItem.status === 0) { // 鎴愬姛鑾峰彇涓存椂URL
          const imageParams = {
            FileUrl: fileItem.tempFileURL
            // 绉婚櫎BizType鍙傛暟锛屼娇鐢ㄩ粯璁ょ瓥鐣?
          };
          const { Data } = await client.ImageModeration(imageParams);
          console.log('鍥剧墖瀹℃牳缁撴灉:', Data);
          
          // 鍥剧墖瀹℃牳鐨勫垽鏂€昏緫锛氭鏌ュ悇涓娴嬫ā鍧楃殑HitFlag
          const hasViolation = Data.PornDetect?.HitFlag > 0 || 
                              Data.HotDetect?.HitFlag > 0 || 
                              Data.PolityDetect?.HitFlag > 0 || 
                              Data.IllegalDetect?.HitFlag > 0 || 
                              Data.TerrorDetect?.HitFlag > 0;
          
          if (hasViolation) {
            // 鍥剧墖瀹℃牳涓嶉€氳繃锛岃褰曡缁嗕俊鎭?
            console.log('鍥剧墖瀹℃牳涓嶉€氳繃锛岃缁嗕俊鎭?', {
              pornDetect: Data.PornDetect,
              hotDetect: Data.HotDetect,
              polityDetect: Data.PolityDetect,
              illegalDetect: Data.IllegalDetect,
              terrorDetect: Data.TerrorDetect
            });
            
            return {
              code: -1,
              msg: '鍥剧墖鍐呭涓嶅悎瑙?,
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
      console.error("鍥剧墖瀹℃牳API璋冪敤澶辫触:", error);
      return { code: -2, msg: '鍥剧墖瀹℃牳鏈嶅姟寮傚父' };
    }
  }
  */
  
  // ------------------- 3. 瀹℃牳鍏ㄩ儴閫氳繃锛屽啓鍏ユ暟鎹簱 -------------------
  try {
    // 鑾峰彇褰撳墠鐢ㄦ埛淇℃伅
    // Use resolved openid above (event.openid preferred), fallback to context if missing
    const currentOpenid = openid || cloud.getWXContext().OPENID;
    console.log('褰撳墠鐢ㄦ埛openid:', currentOpenid);
    
    const userInfo = await db.collection('users').where({
      _openid: currentOpenid
    }).get();
    const userNickName = userInfo.data.length > 0 ? userInfo.data[0].nickName : '鍖垮悕鐢ㄦ埛';
    const userAvatar = userInfo.data.length > 0 ? (userInfo.data[0].avatarUrl || '') : '';
    const userSignatureUrl = userInfo.data.length > 0 ? (userInfo.data[0].signatureUrl || '') : '';
    console.log('鐢ㄦ埛鏄电О:', userNickName);
    
    // 纭畾浣滆€呬俊鎭?
    let authorName = '';
    let displayAuthorName = '';
    let displayAuthorAvatar = '';
    
    if (isAnonymous) {
      // 鍖垮悕鍙戝笘锛氭樉绀哄尶鍚嶄俊鎭?
      console.log('鎵ц鍖垮悕鍙戝笘閫昏緫');
      authorName = anonymousAuthorName || '鍖垮悕鐢ㄦ埛';
      displayAuthorName = anonymousAuthorName || '鍖垮悕鐢ㄦ埛';
      displayAuthorAvatar = '/static/images/avatar.png'; // 浣跨敤榛樿澶村儚
      console.log('鍖垮悕鍙戝笘璁剧疆:', { authorName, displayAuthorName, displayAuthorAvatar });
    } else {
      // 姝ｅ父鍙戝笘
      if (publishMode === 'poem' || isSeries) {
        if (isOriginal) {
          // 鍘熷垱璇楁瓕锛氬鏋滃～鍐欎簡浣滆€呭氨鐢ㄥ～鍐欑殑锛屽惁鍒欎娇鐢ㄧ敤鎴锋樀绉?
          authorName = author && author.trim() ? author.trim() : userNickName;
        } else {
          // 闈炲師鍒涜瘲姝岋細蹇呴』浣跨敤濉啓鐨勪綔鑰?
          authorName = author && author.trim() ? author.trim() : '';
        }
      } else {
        // 鏅€氬笘瀛愶細浣跨敤鐢ㄦ埛鏄电О
        authorName = userNickName;
      }
      displayAuthorName = userNickName;
      displayAuthorAvatar = userAvatar;
    }

    const ownerOpenid = isAnonymous ? '123456' : currentOpenid;
    const postData = {
      _openid: currentOpenid, // 娣诲姞openid瀛楁
      title: title || '',
      content: content || '',
      createTime: new Date(),
      votes: 0,
      commentCount: 0,
      // 鏂板璇楁瓕鐩稿叧瀛楁
      isPoem: publishMode === 'poem' || isSeries,
      isSeries: Boolean(isSeries),
      publishMode: publishMode || (isSeries ? 'poem' : 'normal'),
      seriesBlocks: normalizedSeriesBlocks,
      seriesBlockCount: normalizedSeriesBlocks.length,
      seriesCoverImage: normalizedSeriesBlocks[0]?.imageUrl || '',
      seriesCoverHighlight: highlightSentenceValue || '',
      isOriginal: isOriginal || false,
      // 鏂板璁ㄨ鐩稿叧瀛楁
      isDiscussion: isDiscussion || false,
      parentPostId: parentPostId || '',
      quotedPostId: quotedPostId || '',
      sentenceGroups: normalizedSentenceGroups,
      discussionSentences: normalizedSentenceGroups.map(g => ({
        sentences: g.sentences,
        comment: g.comment
      })),
      // 鏂板浣滆€呭瓧娈?      author: authorName,
      authorName: displayAuthorName,
      authorAvatar: displayAuthorAvatar,
      authorNameSnapshot: displayAuthorName,
      authorAvatarSnapshot: displayAuthorAvatar,
      authorSignature: isAnonymous ? '' : (userSignatureUrl || ''), // 绛惧悕URL锛堝尶鍚嶅笘瀛愪笉瀛樺偍绛惧悕锛?
      // 鍖垮悕鍙戝笘鐩稿叧瀛楁
      isAnonymous: isAnonymous || false,
      anonymousAuthorName: anonymousAuthorName || '鍖垮悕鐢ㄦ埛',
      realAuthorOpenid: realAuthorOpenid || null,
      // 鏂板鏍囩瀛楁
      tags: tags || [],
      // 娲诲姩甯栧瓙瀛楁
      isActivityPost: Boolean(activityId),
      activityId: activityId || '',
      activityTitleSnapshot: activityTitleSnapshot || '',
      activityPublishTime: activityId ? new Date() : null,
      joinedActivityId: joinActivityId || '',
      joinedActivityTitleSnapshot: joinActivityTitleSnapshot || '',
      joinedActivityAt: joinActivityId ? new Date() : null,
      // 瀹℃牳鐘舵€?      // UI 瀹氬埗锛氳儗鏅壊 + 楂樺厜鍙ワ紙鍙€夛級
      backgroundColor: backgroundColor || '',
      textColor: textColor || '#000000',
      highlightSentence: highlightSentenceValue || '',
      highlightLines: Array.isArray(effectiveHighlightLines) ? dedupeTop3(effectiveHighlightLines) : [],
      _openid: ownerOpenid,
      auditStatus: 'approved', // 瀹℃牳閫氳繃
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
      // 杩囨护鎺夋棤鏁堢殑fileID
      const validFileIDs = fileIDs.filter(id => id && typeof id === 'string' && id.trim() !== '');
      const validOriginalFileIDs = originalFileIDs ? originalFileIDs.filter(id => id && typeof id === 'string' && id.trim() !== '') : [];
      
      console.log('璁剧疆鍥剧墖URL鍒板笘瀛愭暟鎹?', {
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
        
        // 璁剧疆鍘熷浘URL
        if (validOriginalFileIDs.length > 0) {
          postData.originalImageUrl = validOriginalFileIDs[0];
          postData.originalImageUrls = validOriginalFileIDs;
        } else {
          // 濡傛灉娌℃湁鍘熷浘锛屼娇鐢ㄥ帇缂╁浘浣滀负鍘熷浘
          postData.originalImageUrl = validFileIDs[0];
          postData.originalImageUrls = validFileIDs;
        }
        
        // 濡傛灉鏄瘲姝屾ā寮忥紝绗竴寮犲浘鐗囦綔涓鸿儗鏅浘
        if (publishMode === 'poem' || isSeries) {
          postData.poemBgImage = validFileIDs[0];
        }
      } else {
        console.warn('没有有效的图片 URL，跳过图片字段设置');
      }
    }

    // 鏁版嵁楠岃瘉
    const hasSeriesBlocks = postData.isSeries && Array.isArray(postData.seriesBlocks) && postData.seriesBlocks.length > 0;
    if (!postData.title && !postData.content && !hasSeriesBlocks) {
      throw new Error('标题和内容不能同时为空');
    }
    
    if (!postData._openid) {
      throw new Error('鐢ㄦ埛openid缂哄け');
    }
    
    console.log('鍑嗗鍐欏叆鏁版嵁搴撶殑甯栧瓙鏁版嵁:', JSON.stringify(postData, null, 2));
    console.log('鏈€缁堜綔鑰呬俊鎭?', { 
      author: postData.author, 
      authorName: postData.authorName, 
      authorAvatar: postData.authorAvatar,
      isAnonymous: postData.isAnonymous 
    });
    
    // 娴嬭瘯鏁版嵁搴撹繛鎺?
    try {
      console.log('娴嬭瘯鏁版嵁搴撹繛鎺?..');
      const testResult = await db.collection('posts').limit(1).get();
      console.log('鏁版嵁搴撹繛鎺ユ甯革紝娴嬭瘯鏌ヨ缁撴灉:', testResult);
    } catch (testError) {
      console.error('鏁版嵁搴撹繛鎺ユ祴璇曞け璐?', testError);
      throw new Error(`鏁版嵁搴撹繛鎺ュけ璐? ${testError.message}`);
    }
    
    const result = await db.collection('posts').add({
      data: postData
    });

    // 鍥炲啓娲诲姩缁熻锛堝畼鏂规椿鍔ㄥ笘鎴栫敤鎴峰弬涓庢椿鍔級
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
        console.warn('[contentCheck] 娲诲姩缁熻鏇存柊澶辫触锛堜笉褰卞搷鍙戝竷锛?', activityUpdateError);
      }
    }

    // 杩藉姞鍐欏叆锛氶鑹?楂樺厜鍙ワ紙涓庣幇鏈夊瓧娈佃В鑰︼紝閬垮厤鏃х増鏈璞＄粨鏋勫奖鍝嶏級
    try {
      await db.collection('posts').doc(result._id).update({
        data: {
          backgroundColor: backgroundColor || postData.backgroundColor || '',
          textColor: textColor || postData.textColor || '#000000',
          highlightSentence: highlightSentenceValue || postData.highlightSentence || ''
        }
      });

      // 鍏煎鍐欏叆锛氶珮鍏夎鏁扮粍
      try {
        await db.collection('posts').doc(result._id).update({
          data: {
            highlightLines: Array.isArray(effectiveHighlightLines) ? effectiveHighlightLines : []
          }
        });
      } catch (e) {
        console.warn('[contentCheck] 鍐欏叆 highlightLines 澶辫触锛堝拷鐣ワ級:', e);
      }
    } catch (e) {
      console.warn('[contentCheck] 杩藉姞鍐欏叆棰滆壊/楂樺厜鍙ュけ璐ワ紝涓嶅奖鍝嶅彂甯?', e);
    }

    console.log('鏁版嵁搴撳啓鍏ユ垚鍔燂紝杩斿洖缁撴灉:', {
      postId: result._id,
      insertedCount: result.stats?.inserted || 1
    });

    // ------------------- 4. 闈炲師鍒涜瘲姝岃嚜鍔ㄥ垱寤鸿瘲浜轰富椤?-------------------
    if ((publishMode === 'poem' || isSeries) && !isOriginal && authorName && authorName.trim()) {
      try {
        const poetName = authorName.trim();
        console.log('妫€鏌ヨ瘲浜轰富椤垫槸鍚﹀瓨鍦?', poetName);
        
        // 鏌ヨ璇椾汉鏄惁宸插瓨鍦?
        const poetResult = await db.collection('poets')
          .where({ name: poetName })
          .limit(1)
          .get();
        
        if (!poetResult.data || poetResult.data.length === 0) {
          // 璇椾汉涓嶅瓨鍦紝鑷姩鍒涘缓
          console.log('璇椾汉涓婚〉涓嶅瓨鍦紝鑷姩鍒涘缓:', poetName);
          const newPoet = {
            name: poetName,
            avatar: '',  // 榛樿鏃犲ご鍍?
            bio: '',     // 榛樿鏃犵畝浠?
            createTime: db.serverDate(),
            updateTime: db.serverDate(),
            creatorOpenid: currentOpenid  // 璁板綍璋侀娆¤Е鍙戝垱寤?
          };
          
          const poetAddResult = await db.collection('poets').add({ data: newPoet });
          console.log('璇椾汉涓婚〉鍒涘缓鎴愬姛:', poetAddResult._id);
        } else {
          console.log('璇椾汉涓婚〉宸插瓨鍦紝鏃犻渶鍒涘缓:', poetName);
        }
      } catch (poetError) {
        // 璇椾汉涓婚〉鍒涘缓澶辫触涓嶅奖鍝嶅笘瀛愬彂甯?
        console.warn('鑷姩鍒涘缓璇椾汉涓婚〉澶辫触锛堜笉褰卞搷鍙戝笘锛?', poetError);
      }
    }

    // 鍏ㄩ儴鎴愬姛锛岃繑鍥炴垚鍔熺姸鎬?
    return buildSuccess({
      postId: result._id,
      msg: '发布成功'
    });

  } catch (dbError) {
    console.error("鏁版嵁搴撳啓鍏ュけ璐?", dbError);
    console.error("鏁版嵁搴撻敊璇鎯?", {
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
