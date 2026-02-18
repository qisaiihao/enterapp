'use strict';

/**
 * 短信服务配置类型定义
 */

/**
 * @typedef {Object} SendResult
 * @property {boolean} success - 是否成功
 * @property {string} message - 结果消息
 * @property {string} [requestId] - 请求ID
 * @property {string} [errorCode] - 错误码
 */

/**
 * @typedef {Object} UniCloudConfig
 * @property {string} templateId - uniCloud 模板ID
 */

/**
 * @typedef {Object} TencentCloudConfig
 * @property {string} secretId - 腾讯云 SecretId
 * @property {string} secretKey - 腾讯云 SecretKey
 * @property {string} sdkAppId - 短信应用ID
 * @property {string} signName - 短信签名
 * @property {string} templateId - 模板ID
 * @property {string} [region] - 地域，默认 ap-guangzhou
 */

/**
 * @typedef {Object} SmsConfig
 * @property {string} provider - 服务商类型：unicloud 或 tencentcloud
 * @property {boolean} [testMode] - 测试模式
 * @property {UniCloudConfig} [unicloud] - uniCloud 配置
 * @property {TencentCloudConfig} [tencentcloud] - 腾讯云配置
 */

/**
 * @typedef {Object} RateLimitResult
 * @property {boolean} allowed - 是否允许
 * @property {string} [message] - 拒绝原因
 */

module.exports = {};
