const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

/**
 * 回填历史帖子的签名字段
 * @param {number} event.batchSize 单次处理的文档数量（默认 50）
 * @param {number} event.offset 跳过的文档数量，用于手动分页（默认 0）
 * @param {boolean} event.force 是否强制更新已有签名的帖子（默认 false，只更新缺失的）
 */
exports.main = async (event) => {
  const { batchSize = 50, offset = 0, force = false } = event || {};

  console.log('🔍 [backfillPostSignatures] 开始回填签名，参数:', { batchSize, offset, force });

  // 查询缺少authorSignature字段的帖子
  const query = db.collection('posts');
  
  let postsRes;
  if (force) {
    // 强制模式：处理所有帖子
    postsRes = await query
      .orderBy('createTime', 'desc')
      .skip(offset)
      .limit(batchSize)
      .get();
  } else {
    // 默认模式：只处理缺失authorSignature字段的帖子
    postsRes = await query
      .where({
        authorSignature: _.exists(false) // 字段不存在
      })
      .orderBy('createTime', 'desc')
      .skip(offset)
      .limit(batchSize)
      .get();
  }

  const posts = postsRes.data || [];
  if (posts.length === 0) {
    return {
      success: true,
      processed: 0,
      updated: 0,
      message: '没有更多帖子需要处理'
    };
  }

  console.log(`📝 [backfillPostSignatures] 查询到 ${posts.length} 个帖子`);

  // 收集所有需要查询的用户ID（排除匿名帖子）
  const userIdSet = new Set();
  const postsNeedingSignature = [];

  posts.forEach((post) => {
    // 跳过匿名帖子（匿名帖子不应该有签名）
    if (post.isAnonymous || post.realAuthorOpenid) {
      return;
    }

    // 检查是否需要更新签名
    const needsSignature = force || !post.authorSignature || post.authorSignature === '';
    if (needsSignature && post._openid) {
      postsNeedingSignature.push(post);
      userIdSet.add(post._openid);
    }
  });

  console.log(`📝 [backfillPostSignatures] 需要处理的帖子数: ${postsNeedingSignature.length}, 涉及用户数: ${userIdSet.size}`);

  // 批量查询用户签名信息
  let userSignatureMap = new Map();
  if (userIdSet.size > 0) {
    const usersRes = await db.collection('users')
      .where({ _openid: _.in(Array.from(userIdSet)) })
      .field({ _openid: true, signatureUrl: true })
      .get();
    
    userSignatureMap = new Map(
      usersRes.data.map((user) => [user._openid, user.signatureUrl || ''])
    );
    
    console.log(`✅ [backfillPostSignatures] 查询到 ${userSignatureMap.size} 个用户的签名信息`);
  }

  // 批量更新帖子
  let updated = 0;
  let skipped = 0;

  for (const post of postsNeedingSignature) {
    const signatureUrl = userSignatureMap.get(post._openid) || '';
    
    // 如果强制更新或当前没有签名，则更新
    if (force || !post.authorSignature || post.authorSignature === '') {
      try {
        await db.collection('posts').doc(post._id).update({
          data: {
            authorSignature: signatureUrl
          }
        });
        updated += 1;
        
        if (updated % 10 === 0) {
          console.log(`🔄 [backfillPostSignatures] 已更新 ${updated} 个帖子...`);
        }
      } catch (error) {
        console.error(`❌ [backfillPostSignatures] 更新帖子 ${post._id} 失败:`, error);
      }
    } else {
      skipped += 1;
    }
  }

  console.log(`✅ [backfillPostSignatures] 批次完成 - 处理: ${posts.length}, 更新: ${updated}, 跳过: ${skipped}`);

  return {
    success: true,
    processed: posts.length,
    updated,
    skipped,
    nextOffset: offset + posts.length,
    message: `成功更新 ${updated} 个帖子，跳过 ${skipped} 个帖子`
  };
};

