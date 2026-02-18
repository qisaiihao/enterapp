'use strict';

/**
 * 短信服务工具函数
 */

/**
 * 生成 6 位数字验证码
 * @param {boolean} testMode - 测试模式，为 true 时返回固定验证码 123456
 * @returns {string} 6 位数字验证码
 */
function generateVerificationCode(testMode = false) {
  if (testMode) {
    return '123456';
  }
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * 验证手机号格式
 * @param {string} phone - 手机号
 * @returns {boolean} 是否有效
 */
function validatePhone(phone) {
  if (!phone || typeof phone !== 'string') {
    return false;
  }

  // 支持 +86 开头的 11 位数字
  if (/^\+86\d{11}$/.test(phone)) {
    return true;
  }

  // 支持 1 开头的 11 位数字（中国大陆手机号）
  if (/^1[3-9]\d{9}$/.test(phone)) {
    return true;
  }

  return false;
}

/**
 * 脱敏手机号
 * @param {string} phone - 手机号
 * @returns {string} 脱敏后的手机号
 */
function maskPhone(phone) {
  if (!phone || phone.length < 7) {
    return phone;
  }

  if (phone.startsWith('+86')) {
    // +86 格式：+86****1234
    return phone.substring(0, 6) + '****' + phone.substring(phone.length - 4);
  } else {
    // 普通格式：138****1234
    return phone.substring(0, 3) + '****' + phone.substring(phone.length - 4);
  }
}

/**
 * 统一成功响应格式
 * @param {string} message - 消息
 * @param {*} data - 数据
 * @returns {Object} 响应对象
 */
function successResponse(message, data = null) {
  const response = {
    code: 0,
    message: message
  };

  if (data !== null) {
    response.data = data;
  }

  return response;
}

/**
 * 统一错误响应格式
 * @param {string} message - 错误消息
 * @param {number} code - 错误码，默认 -1
 * @returns {Object} 响应对象
 */
function errorResponse(message, code = -1) {
  return {
    code: code,
    message: message
  };
}

module.exports = {
  generateVerificationCode,
  validatePhone,
  maskPhone,
  successResponse,
  errorResponse
};
