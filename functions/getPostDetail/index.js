const { createPostsDatabase, withPostResponse, resolveOwner, canViewPost } = require('./_lib/posts');
const { URL } = require('url');
// 云函数入口文件
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = createPostsDatabase(cloud.database());

const SIGNATURE_BUCKET = '636c-cloud1-5gb0pbyl400845f5-1378788263';
const SIGNATURE_FILE_PREFIX = `cloud://cloud1-5gb0pbyl400845f5.${SIGNATURE_BUCKET}/`;
const SIGNATURE_PATH = /^user_signatures\/[\w.-]+\.(?:png|jpe?g|webp)$/i;
const MAX_SIGNATURE_BYTES = 2 * 1024 * 1024;
const PNG_HEADER = Buffer.from('89504e470d0a1a0a', 'hex');

function getSignatureFileId(source) {
  if (typeof source !== 'string') return '';
  let path;
  if (source.startsWith(SIGNATURE_FILE_PREFIX)) {
    path = source.slice(SIGNATURE_FILE_PREFIX.length);
  } else {
    try {
      // 旧记录可能保存了临时 HTTPS 链接，按存储桶和路径还原文件 ID。
      const url = new URL(source);
      const cosSuffix = url.hostname.slice(SIGNATURE_BUCKET.length);
      if (url.protocol !== 'https:' || !url.hostname.startsWith(SIGNATURE_BUCKET) ||
          (cosSuffix !== '.tcb.qcloud.la' && !/^\.cos\.[a-z0-9-]+\.myqcloud\.com$/.test(cosSuffix))) return '';
      path = decodeURIComponent(url.pathname.slice(1));
    } catch (_) {
      return '';
    }
  }
  return SIGNATURE_PATH.test(path) ? SIGNATURE_FILE_PREFIX + path : '';
}

async function getCardSignature(source) {
  const fileID = getSignatureFileId(source);
  if (!fileID) return { success: true, signatureDataUrl: '' };

  const { fileContent } = await cloud.downloadFile({ fileID });
  if (!Buffer.isBuffer(fileContent) || fileContent.length > MAX_SIGNATURE_BYTES) {
    return { success: true, signatureDataUrl: '' };
  }

  let mime;
  if (fileContent.slice(0, 8).equals(PNG_HEADER)) mime = 'image/png';
  else if (fileContent.slice(0, 3).toString('hex') === 'ffd8ff') mime = 'image/jpeg';
  else if (fileContent.toString('ascii', 0, 4) === 'RIFF' && fileContent.toString('ascii', 8, 12) === 'WEBP') mime = 'image/webp';

  return { success: true, signatureDataUrl: mime ? `data:${mime};base64,${fileContent.toString('base64')}` : '' };
}

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const wxCtxOpenid = wxContext.OPENID;
  const eventOpenid = event.openid;
  const signatureOnly = event.action === 'getCardSignature';
  const openid = signatureOnly ? (wxCtxOpenid || eventOpenid) : (eventOpenid || wxCtxOpenid);
  const { postId } = event;

  if (!openid) {
    return {
      success: false,
      message: '无法获取用户 openid，请重新登录',
      code: 'NO_OPENID'
    };
  }
  console.log('🔍 [getPostDetail] openid来源:', {
    eventOpenid: eventOpenid ? '提供' : '未提供',
    wxCtxOpenid: wxCtxOpenid ? '提供' : '未提供',
    chosenOpenidSource: eventOpenid ? 'event.openid' : 'wxContext.OPENID',
    chosenOpenidExists: !!openid
  });

  if (!postId) {
    return {
      success: false,
      message: 'Post ID is required.'
    };
  }

  try {
    // 1. 根据 postId 获取帖子详情
    const postRes = await db.collection('posts').doc(postId).get();
    const post = postRes.data;
    // 如果帖子被隐藏且当前用户不是作者，禁止访问
    if (post && !await canViewPost(db, post, openid, resolveOwner(post))) {
      return {
        success: false,
        code: 'POST_HIDDEN',
        message: '该内容已隐藏'
      };
    }

    if (!post) {
      return {
        success: false,
        message: 'Post not found.'
      };
    }

    if (signatureOnly && (!post.isPoem || !post.isOriginal || post.isAnonymous)) {
      return { success: true, signatureDataUrl: '' };
    }

    console.log('获取到的帖子数据:', {
      _id: post._id,
      title: post.title,
      commentCount: post.commentCount,
      votes: post.votes
    });

    // 2. 根据帖子的 _openid 获取作者信息
    const userRes = await db.collection('users').where({
      _openid: post._openid
    }).get();
    
    // If author is not found, provide a default object for robustness
    const author = userRes.data[0] || { 
        nickName: '匿名用户', 
        avatarUrl: '',
        signatureUrl: ''
    };
    const authorSignature = post.isAnonymous ? '' : (post.authorSignature || author.signatureUrl || '');
    if (signatureOnly) return await getCardSignature(authorSignature);

    // 3. 获取当前用户的点赞记录
    const voteRes = await db.collection('votes_log').where({
        _openid: openid,
        postId: postId,
        type: 'post'
    }).get();

    // 4. 组合最终结果
    const resultPost = {
      ...post,
      authorName: post.authorName || post.authorNameSnapshot || author.nickName || '匿名用户',
      authorAvatar: post.authorAvatar || post.authorAvatarSnapshot || author.avatarUrl || '',
      authorSignature,
      isAuthor: resolveOwner(post) === openid,
      isVoted: voteRes.data.length > 0,
      tags: post.tags || [] // 确保标签字段存在
    };
    // 保证 imageUrls、originalImageUrls 一定为数组
    if (!Array.isArray(resultPost.imageUrls)) resultPost.imageUrls = resultPost.imageUrls ? [resultPost.imageUrls] : [];
    if (!Array.isArray(resultPost.originalImageUrls)) resultPost.originalImageUrls = resultPost.originalImageUrls ? [resultPost.originalImageUrls] : [];

    // --- Efficiently convert FileIDs to temp URLs ---
    const fileIDs = [];
    if (resultPost.imageUrl && resultPost.imageUrl.startsWith('cloud://')) {
      fileIDs.push(resultPost.imageUrl);
    }
    if (resultPost.imageUrls && Array.isArray(resultPost.imageUrls)) {
      resultPost.imageUrls.forEach(url => {
        if (url && url.startsWith('cloud://')) {
          fileIDs.push(url);
        }
      });
    }
    if (resultPost.originalImageUrl && resultPost.originalImageUrl.startsWith('cloud://')) {
      fileIDs.push(resultPost.originalImageUrl);
    }
    if (resultPost.originalImageUrls && Array.isArray(resultPost.originalImageUrls)) {
      resultPost.originalImageUrls.forEach(url => {
        if (url && url.startsWith('cloud://')) {
          fileIDs.push(url);
        }
      });
    }
    if (resultPost.authorAvatar && resultPost.authorAvatar.startsWith('cloud://')) {
      fileIDs.push(resultPost.authorAvatar);
    }
    if (resultPost.authorSignature && resultPost.authorSignature.startsWith('cloud://')) {
      fileIDs.push(resultPost.authorSignature);
    }

    if (fileIDs.length > 0) {
      const fileListResult = await cloud.getTempFileURL({ fileList: fileIDs });
      const urlMap = new Map();
      fileListResult.fileList.forEach(item => {
        if (item.status === 0) {
          urlMap.set(item.fileID, item.tempFileURL);
        }
      });

      if (resultPost.imageUrl && urlMap.has(resultPost.imageUrl)) {
        resultPost.imageUrl = urlMap.get(resultPost.imageUrl);
      }
      if (resultPost.imageUrls && Array.isArray(resultPost.imageUrls)) {
        resultPost.imageUrls = resultPost.imageUrls.map(url => 
          url && urlMap.has(url) ? urlMap.get(url) : url
        );
      }
      if (resultPost.originalImageUrl && urlMap.has(resultPost.originalImageUrl)) {
        resultPost.originalImageUrl = urlMap.get(resultPost.originalImageUrl);
      }
      if (resultPost.originalImageUrls && Array.isArray(resultPost.originalImageUrls)) {
        resultPost.originalImageUrls = resultPost.originalImageUrls.map(url => 
          url && urlMap.has(url) ? urlMap.get(url) : url
        );
      }
      if (resultPost.authorAvatar && urlMap.has(resultPost.authorAvatar)) {
        resultPost.authorAvatar = urlMap.get(resultPost.authorAvatar);
      }
      if (resultPost.authorSignature && urlMap.has(resultPost.authorSignature)) {
        resultPost.authorSignature = urlMap.get(resultPost.authorSignature);
      }
    }

    // 如果帖子没有commentCount字段，则实时计算评论数量
    let commentCount = resultPost.commentCount;
    console.log('从数据库获取的commentCount:', commentCount, '类型:', typeof commentCount);
    
    if (commentCount === undefined || commentCount === null) {
      console.log('需要实时计算评论数量');
      const commentsRes = await db.collection('comments').where({
        postId: postId
      }).count();
      commentCount = commentsRes.total;
      console.log('实时计算的评论数量:', commentCount);
      
      // 同时更新帖子数据库中的commentCount字段，避免下次再计算
      try {
        await db.collection('posts').doc(postId).update({
          data: {
            commentCount: commentCount
          }
        });
        console.log('已更新数据库中的commentCount字段');
      } catch (updateError) {
        console.error('更新commentCount字段失败:', updateError);
      }
    } else {
      console.log('使用数据库中的commentCount:', commentCount);
    }
    
    console.log('最终返回的评论数量:', commentCount);
    
    // 【调试】打印返回的帖子数据中的背景颜色
    console.log('🎨 [getPostDetail] 返回的背景颜色:', {
      postId: resultPost._id,
      backgroundColor: resultPost.backgroundColor,
      textColor: resultPost.textColor,
      hasBackgroundColor: 'backgroundColor' in resultPost,
      hasTextColor: 'textColor' in resultPost
    });
    
    return {
      post: resultPost,
      commentCount: commentCount, // 添加评论数量
      success: true
    };

  } catch (e) {
    console.error(e);
    return {
      success: false,
      error: e
    };
  }
};

exports.main = withPostResponse(exports.main);
