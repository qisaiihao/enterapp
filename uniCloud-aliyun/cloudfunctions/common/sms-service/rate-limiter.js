'use strict';

/**
 * 短信频率限制器
 */

/**
 * 检查频率限制
 * @param {string} phone - 手机号
 * @param {string} ip - 客户端 IP
 * @param {Object} db - 数据库实例
 * @returns {Promise<RateLimitResult>} 限制检查结果
 */
async function checkRateLimit(phone, ip, db) {
  try {
    const now = Date.now();
    const logsCollection = db.collection('sms_logs');

    // 1. 检查 60 秒内是否重复请求
    const recentResult = await logsCollection
      .where({
        phone: phone,
        createdAt: db.command.gt(now - 60 * 1000)
      })
      .count();

    if (recentResult.total > 0) {
      return {
        allowed: false,
        message: '请求过于频繁，请 60 秒后再试'
      };
    }

    // 2. 检查 24 小时内请求次数（不超过 10 次）
    const dailyResult = await logsCollection
      .where({
        phone: phone,
        createdAt: db.command.gt(now - 24 * 60 * 60 * 1000)
      })
      .count();

    if (dailyResult.total >= 10) {
      return {
        allowed: false,
        message: '今日发送次数已达上限（10次），请明天再试'
      };
    }

    // 3. 检查 IP 1 小时内请求次数（不超过 20 次）
    if (ip) {
      const ipResult = await logsCollection
        .where({
          ip: ip,
          createdAt: db.command.gt(now - 60 * 60 * 1000)
        })
        .count();

      if (ipResult.total >= 20) {
        return {
          allowed: false,
          message: 'IP 请求过于频繁，请稍后再试'
        };
      }
    }

    // 通过所有检查
    return {
      allowed: true
    };
  } catch (error) {
    console.error('📱 [RateLimiter] 频率限制检查失败:', error);
    // 检查失败时允许通过，避免影响正常业务
    return {
      allowed: true
    };
  }
}

module.exports = {
  checkRateLimit
};
