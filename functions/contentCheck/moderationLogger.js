// 审核日志记录模块
// 功能：将审核详情记录到数据库

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

/**
 * 记录审核日志
 * @param {object} logData - 日志数据
 * @param {string} logData.openid - 用户 openid
 * @param {string} logData.type - 审核类型（text/image）
 * @param {string} logData.content - 文本内容（会被脱敏处理）
 * @param {string} logData.imageUrl - 图片 URL
 * @param {number} logData.scene - 场景值
 * @param {object} logData.result - 审核结果
 * @param {array} logData.detail - 详细检测结果
 * @param {string} logData.traceId - 图片审核 trace_id
 * @param {boolean} logData.passed - 是否通过
 * @param {number} logData.errorCode - 错误码
 * @param {string} logData.errorMessage - 错误信息
 * @returns {Promise<void>}
 */
async function logModeration(logData) {
  console.log('🔍 [ModerationLogger] 开始记录审核日志');
  
  try {
    // 构建日志记录
    const logRecord = {
      openid: logData.openid,
      type: logData.type,
      scene: logData.scene,
      passed: logData.passed,
      createTime: new Date(),
      _openid: logData.openid // 云数据库权限字段
    };
    
    // 添加文本内容（脱敏处理：最多保存100字）
    if (logData.content) {
      logRecord.content = logData.content.substring(0, 100);
      if (logData.content.length > 100) {
        logRecord.content += '...';
      }
    }
    
    // 添加图片 URL
    if (logData.imageUrl) {
      logRecord.imageUrl = logData.imageUrl;
    }
    
    // 添加审核结果
    if (logData.result) {
      logRecord.result = {
        suggest: logData.result.suggest,
        label: logData.result.label
      };
    }
    
    // 添加详细检测结果
    if (logData.detail) {
      logRecord.detail = logData.detail;
    }
    
    // 添加 trace_id（图片审核）
    if (logData.traceId) {
      logRecord.traceId = logData.traceId;
    }
    
    // 添加错误信息
    if (logData.errorCode) {
      logRecord.errorCode = logData.errorCode;
    }
    if (logData.errorMessage) {
      logRecord.errorMessage = logData.errorMessage;
    }
    
    console.log('🔍 [ModerationLogger] 日志记录:', {
      ...logRecord,
      content: logRecord.content ? logRecord.content.substring(0, 30) + '...' : undefined
    });
    
    // 保存到数据库
    await db.collection('moderation_logs').add({
      data: logRecord
    });
    
    console.log('✅ [ModerationLogger] 审核日志已保存');
    
  } catch (error) {
    console.error('❌ [ModerationLogger] 记录审核日志失败:', error);
    // 日志记录失败不应该影响主流程，只记录错误
    console.error('⚠️ [ModerationLogger] 日志记录失败，但不影响审核结果返回');
  }
}

module.exports = {
  logModeration
};
