'use strict';

const { maskPhone } = require('./utils');

/**
 * 短信服务数据库操作
 */

/**
 * 保存验证码到数据库
 * @param {Object} params - 参数
 * @param {string} params.phone - 手机号
 * @param {string} params.code - 验证码
 * @param {string} params.scene - 场景
 * @param {string} params.ip - 客户端 IP
 * @param {Object} db - 数据库实例
 * @returns {Promise<Object>} 保存结果
 */
async function saveSmsCode({ phone, code, scene, ip }, db) {
  try {
    const now = Date.now();
    const expiredAt = now + 5 * 60 * 1000; // 5 分钟后过期

    const result = await db.collection('sms_codes').add({
      phone: phone,
      code: code,
      scene: scene,
      used: false,
      createdAt: now,
      expiredAt: expiredAt,
      ip: ip || ''
    });

    console.log('📱 [Database] 验证码已保存:', result);
    return result;
  } catch (error) {
    console.error('📱 [Database] 保存验证码失败:', error);
    throw error;
  }
}

/**
 * 记录短信发送成功日志
 * @param {string} phone - 手机号
 * @param {string} scene - 场景
 * @param {string} provider - 服务商名称
 * @param {SendResult} sendResult - 发送结果
 * @param {string} ip - 客户端 IP
 * @param {Object} db - 数据库实例
 * @returns {Promise<Object>} 日志记录结果
 */
async function logSmsSuccess(phone, scene, provider, sendResult, ip, db) {
  try {
    const result = await db.collection('sms_logs').add({
      phone: maskPhone(phone), // 脱敏手机号
      scene: scene,
      provider: provider,
      success: true,
      message: sendResult.message || '发送成功',
      requestId: sendResult.requestId || '',
      ip: ip || '',
      createdAt: Date.now()
    });

    console.log('📱 [Database] 成功日志已记录');
    return result;
  } catch (error) {
    console.error('📱 [Database] 记录成功日志失败:', error);
    // 日志记录失败不影响主流程
  }
}

/**
 * 记录短信发送失败日志
 * @param {string} phone - 手机号
 * @param {string} scene - 场景
 * @param {string} provider - 服务商名称
 * @param {SendResult} sendResult - 发送结果
 * @param {string} ip - 客户端 IP
 * @param {Object} db - 数据库实例
 * @returns {Promise<Object>} 日志记录结果
 */
async function logSmsError(phone, scene, provider, sendResult, ip, db) {
  try {
    const result = await db.collection('sms_logs').add({
      phone: maskPhone(phone), // 脱敏手机号
      scene: scene,
      provider: provider,
      success: false,
      message: sendResult.message || '发送失败',
      errorCode: sendResult.errorCode || '',
      requestId: sendResult.requestId || '',
      ip: ip || '',
      createdAt: Date.now()
    });

    console.log('📱 [Database] 失败日志已记录');
    return result;
  } catch (error) {
    console.error('📱 [Database] 记录失败日志失败:', error);
    // 日志记录失败不影响主流程
  }
}

module.exports = {
  saveSmsCode,
  logSmsSuccess,
  logSmsError
};
