'use strict';

const UniCloudSmsProvider = require('./providers/unicloud-provider');
const TencentCloudSmsProvider = require('./providers/tencentcloud-provider');

/**
 * 短信服务商工厂类
 * 根据配置创建相应的服务商实例
 */
class SmsProviderFactory {
  /**
   * 创建短信服务商实例
   * @param {SmsConfig} config - 配置对象
   * @returns {ISmsProvider} 服务商实例
   * @throws {Error} 当服务商类型不支持时抛出错误
   */
  static createProvider(config) {
    if (!config || !config.provider) {
      throw new Error('配置错误：缺少 provider 参数');
    }

    const providerType = config.provider.toLowerCase();

    switch (providerType) {
      case 'unicloud':
        if (!config.unicloud) {
          throw new Error('配置错误：使用 uniCloud 服务商时必须提供 unicloud 配置');
        }
        return new UniCloudSmsProvider(config.unicloud, config.testMode);

      case 'tencentcloud':
        if (!config.tencentcloud) {
          throw new Error('配置错误：使用腾讯云服务商时必须提供 tencentcloud 配置');
        }
        return new TencentCloudSmsProvider(config.tencentcloud, config.testMode);

      default:
        throw new Error(`不支持的服务商类型: ${providerType}，支持的类型：unicloud、tencentcloud`);
    }
  }
}

module.exports = SmsProviderFactory;
