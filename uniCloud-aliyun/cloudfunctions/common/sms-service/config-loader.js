'use strict';

/**
 * 配置加载器
 */

/**
 * 从环境变量替换配置中的占位符
 * @param {string} value - 配置值
 * @returns {string} 替换后的值
 * @private
 */
function replaceEnvVars(value) {
  if (typeof value !== 'string') {
    return value;
  }

  // 替换 ${VAR_NAME} 格式的环境变量
  return value.replace(/\$\{([^}]+)\}/g, (match, varName) => {
    return process.env[varName] || match;
  });
}

/**
 * 递归替换对象中的环境变量
 * @param {Object} obj - 配置对象
 * @returns {Object} 替换后的对象
 * @private
 */
function replaceEnvVarsInObject(obj) {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  const result = Array.isArray(obj) ? [] : {};

  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const value = obj[key];
      if (typeof value === 'string') {
        result[key] = replaceEnvVars(value);
      } else if (typeof value === 'object') {
        result[key] = replaceEnvVarsInObject(value);
      } else {
        result[key] = value;
      }
    }
  }

  return result;
}

/**
 * 验证配置的完整性
 * @param {SmsConfig} config - 配置对象
 * @throws {Error} 配置不完整时抛出错误
 * @private
 */
function validateConfig(config) {
  if (!config.provider) {
    throw new Error('配置错误：缺少 provider 参数');
  }

  const provider = config.provider.toLowerCase();

  if (provider === 'unicloud') {
    if (!config.unicloud || !config.unicloud.templateId) {
      throw new Error('配置错误：使用 uniCloud 时必须提供 unicloud.templateId');
    }
  } else if (provider === 'tencentcloud') {
    if (!config.tencentcloud) {
      throw new Error('配置错误：使用腾讯云时必须提供 tencentcloud 配置');
    }

    const tc = config.tencentcloud;
    const requiredFields = ['secretId', 'secretKey', 'sdkAppId', 'signName', 'templateId'];

    for (const field of requiredFields) {
      if (!tc[field]) {
        throw new Error(`配置错误：腾讯云配置缺少 ${field}`);
      }

      // 检查是否还有未替换的环境变量占位符
      if (typeof tc[field] === 'string' && tc[field].includes('${')) {
        throw new Error(`配置错误：环境变量 ${field} 未设置或未正确替换`);
      }
    }
  } else {
    throw new Error(`配置错误：不支持的服务商 ${provider}`);
  }
}

/**
 * 加载短信服务配置
 * @param {string} configPath - 配置文件路径（相对于云函数根目录）
 * @returns {SmsConfig} 配置对象
 * @throws {Error} 配置加载或验证失败时抛出错误
 */
function loadSmsConfig(configPath = './config.json') {
  try {
    // 加载配置文件
    const config = require(configPath);

    // 替换环境变量
    const processedConfig = replaceEnvVarsInObject(config);

    // 验证配置
    validateConfig(processedConfig);

    console.log('📱 [ConfigLoader] 配置加载成功，使用服务商:', processedConfig.provider);

    return processedConfig;
  } catch (error) {
    console.error('📱 [ConfigLoader] 配置加载失败:', error);
    throw error;
  }
}

module.exports = {
  loadSmsConfig
};
