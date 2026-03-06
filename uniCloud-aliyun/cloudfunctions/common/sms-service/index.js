'use strict';

/**
 * 短信服务统一入口
 */

const SmsProviderFactory = require('./provider-factory');
const { loadSmsConfig } = require('./config-loader');
const { generateVerificationCode, validatePhone, successResponse, errorResponse } = require('./utils');
const { checkRateLimit } = require('./rate-limiter');
const { saveSmsCode, logSmsSuccess, logSmsError } = require('./database');

module.exports = {
  // 工厂类
  SmsProviderFactory,
  
  // 配置加载
  loadSmsConfig,
  
  // 工具函数
  generateVerificationCode,
  validatePhone,
  successResponse,
  errorResponse,
  
  // 频率限制
  checkRateLimit,
  
  // 数据库操作
  saveSmsCode,
  logSmsSuccess,
  logSmsError
};
