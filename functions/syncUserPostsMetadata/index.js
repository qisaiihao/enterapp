const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

/**
 * 同步用户昵称、头像和签名到该用户的所有历史帖子
 * @param {string} event.openid 用户标识（必需）
 * @param {string} event.nickName 新昵称（可选）
 * @param {string} event.avatarUrl 新头像URL（可选）
 * @param {string} event.signatureUrl 新签名URL（可选）
 * @param {number} event.batchSize 单次处理的文档数量（默认 100）
 */
exports.main = async (event) => {
  const { openid, nickName, avatarUrl, signatureUrl, batchSize = 100 } = event || {};

  if (!openid) {
    return {
      success: false,
      message: 'openid 参数必需',
      code: 'MISSING_OPENID'
    };
  }

  console.log('🔍 [syncUserPostsMetadata] 开始同步用户帖子元数据:', {
    openid,
    hasNickName: !!nickName,
    hasAvatarUrl: !!avatarUrl,
    hasSignatureUrl: !!signatureUrl,
    batchSize
  });

  // 如果既没有昵称也没有头像也没有签名，直接返回
  if (!nickName && !avatarUrl && !signatureUrl) {
    return {
      success: false,
      message: 'nickName、avatarUrl 和 signatureUrl 至少需要提供一个',
      code: 'MISSING_PARAMS'
    };
  }

  try {
    let totalProcessed = 0;
    let totalUpdated = 0;
    let offset = 0;
    let hasMore = true;

    // 分页查询并更新
    while (hasMore) {
      // 查询该用户的所有帖子（分页）
      const postsRes = await db.collection('posts')
        .where({ _openid: openid })
        .orderBy('createTime', 'desc')
        .skip(offset)
        .limit(batchSize)
        .get();

      const posts = postsRes.data || [];
      
      if (posts.length === 0) {
        hasMore = false;
        break;
      }

      console.log(`📝 [syncUserPostsMetadata] 处理第 ${offset / batchSize + 1} 批，共 ${posts.length} 条帖子`);

      // 构建更新数据（只更新提供的字段）
      const updateData = {};
      if (nickName) {
        updateData.authorName = nickName;
        updateData.authorNameSnapshot = nickName;
      }
      if (avatarUrl) {
        updateData.authorAvatar = avatarUrl;
        updateData.authorAvatarSnapshot = avatarUrl;
      }
      if (signatureUrl !== undefined) {
        // 注意：匿名帖子不更新签名（保持为空）
        updateData.authorSignature = signatureUrl || '';
      }

      // 批量更新这些帖子
      // 注意：这里不修改 author 字段（诗歌原作者）
      let batchUpdated = 0;
      for (const post of posts) {
        try {
          await db.collection('posts').doc(post._id).update({
            data: updateData
          });
          batchUpdated += 1;
        } catch (updateError) {
          console.error(`❌ [syncUserPostsMetadata] 更新帖子 ${post._id} 失败:`, updateError);
        }
      }

      totalProcessed += posts.length;
      totalUpdated += batchUpdated;
      offset += batchSize;

      // 如果返回的帖子数量少于批次大小，说明已经是最后一批
      if (posts.length < batchSize) {
        hasMore = false;
      }

      console.log(`✅ [syncUserPostsMetadata] 批次完成，已处理 ${totalProcessed} 条，已更新 ${totalUpdated} 条`);
    }

    console.log(`🎉 [syncUserPostsMetadata] 同步完成，总共处理 ${totalProcessed} 条帖子，更新 ${totalUpdated} 条`);

    return {
      success: true,
      processed: totalProcessed,
      updated: totalUpdated,
      message: `成功更新 ${totalUpdated} 条帖子`
    };

  } catch (e) {
    console.error('❌ [syncUserPostsMetadata] 同步失败:', e);
    return {
      success: false,
      message: '同步失败: ' + (e.message || '未知错误'),
      error: e.message || e.toString()
    };
  }
};

