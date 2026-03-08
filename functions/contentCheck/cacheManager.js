// 缓存管理模块
// 功能：管理审核结果的缓存

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const crypto = require('crypto');

/**
 * 生成内容指纹（用于缓存 key）
 * @param {string} content - 内容
 * @param {string} type - 类型（text/image）
 * @returns {string} 内容指纹
 */
function generateFingerprint(content, type) {
  const hash = crypto.createHash('md5');
  hash.update(`${type}:${content}`);
  return hash.digest('hex');
}

/**
 * 从缓存读取审核结果
 * @param {string} fingerprint - 内容指纹
 * @returns {Promise<object|null>} 缓存的审核结果，如果不存在或已过期则返回 null
 */
async function getCachedResult(fingerprint) {
  console.log('🔍 [CacheManager] 查询缓存:', fingerprint);
  
  try {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    
    // 查询缓存（5分钟内的记录）
    const cacheRes = await db.collection('moderation_cache')
      .where({
        fingerprint: fingerprint,
        createTime: db.command.gte(fiveMinutesAgo)
      })
      .orderBy('createTime', 'desc')
      .limit(1)
      .get();
    
    if (cacheRes.data.length > 0) {
      console.log('✅ [CacheManager] 找到缓存结果');
      return cacheRes.data[0].result;
    }
    
    console.log('⚠️ [CacheManager] 未找到缓存结果');
    return null;
    
  } catch (error) {
    console.error('❌ [CacheManager] 读取缓存失败:', error);
    return null; // 缓存读取失败不应该影响主流程
  }
}

/**
 * 将审核结果写入缓存
 * @param {string} fingerprint - 内容指纹
 * @param {object} result - 审核结果
 * @returns {Promise<void>}
 */
async function setCachedResult(fingerprint, result) {
  console.log('🔍 [CacheManager] 写入缓存:', fingerprint);
  
  try {
    await db.collection('moderation_cache').add({
      data: {
        fingerprint: fingerprint,
        result: result,
        createTime: new Date()
      }
    });
    
    console.log('✅ [CacheManager] 缓存已写入');
    
  } catch (error) {
    console.error('❌ [CacheManager] 写入缓存失败:', error);
    // 缓存写入失败不应该影响主流程
  }
}

module.exports = {
  generateFingerprint,
  getCachedResult,
  setCachedResult
};
