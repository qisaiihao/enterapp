const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

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

  // 只抽取支持修改的key
  const updateData = {};
  EDITABLE_KEYS.forEach(key => {
    if (input[key] !== undefined) {
      updateData[key] = input[key];
    }
  });
  
  // 处理fileIDs：如果提供了fileIDs，需要更新imageUrl和imageUrls字段
  if (input.fileIDs !== undefined) {
    if (Array.isArray(input.fileIDs) && input.fileIDs.length > 0) {
      updateData.imageUrl = input.fileIDs[0];
      updateData.imageUrls = input.fileIDs;
      // 处理原图：如果有originalFileIDs则使用，否则使用fileIDs（向后兼容）
      const originalFileIDs = input.originalFileIDs || input.fileIDs;
      updateData.originalImageUrl = originalFileIDs[0] || input.fileIDs[0];
      updateData.originalImageUrls = originalFileIDs;
      
      // 如果是诗歌模式，第一张图片作为背景图
      // 注意：这里需要从原帖子获取 isPoem 字段，因为编辑时不会传递这个字段
    } else {
      // 如果fileIDs为空数组，清空图片字段
      updateData.imageUrl = '';
      updateData.imageUrls = [];
      updateData.originalImageUrl = '';
      updateData.originalImageUrls = [];
      updateData.poemBgImage = ''; // 清空诗歌背景图
    }
  }
  
  updateData.updateTime = new Date();

  try {
    // 只能作者本人修改
    const oldRes = await db.collection('posts').doc(postId).get();
    const post = oldRes.data;
    if (!post) {
      return { success: false, code: 'NOT_FOUND', message: '帖子不存在' };
    }
    if (post._openid !== openid) {
      return { success: false, code: 'FORBIDDEN', message: '无权编辑该帖子' };
    }
    
    // 如果是诗歌模式且有图片，更新诗歌背景图
    if (post.isPoem && updateData.imageUrls && updateData.imageUrls.length > 0) {
      updateData.poemBgImage = updateData.imageUrls[0];
    } else if (post.isPoem && (!updateData.imageUrls || updateData.imageUrls.length === 0)) {
      // 如果清空了图片，也清空诗歌背景图
      updateData.poemBgImage = '';
    }
    
    // 执行更新（只更新指定字段，保留其他字段如 votes, commentCount 等）
    await db.collection('posts').doc(postId).update({ data: updateData });
    
    console.log('【updatePostContent】更新成功:', {
      postId,
      updateFields: Object.keys(updateData),
      preservedFields: ['votes', 'commentCount', 'createTime', '_openid']
    });
    
    return { success: true, postId, updateFields: Object.keys(updateData) };
  } catch (e) {
    console.error('【updatePostContent】更新失败:', e);
    return { success: false, code: 'ERROR', message: e.message };
  }
};
