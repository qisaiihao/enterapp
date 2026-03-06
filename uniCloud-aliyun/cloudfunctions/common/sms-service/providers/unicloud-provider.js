'use strict';

const ISmsProvider = require('../provider-interface');

/**
 * uniCloud 短信服务商实现
 */
class UniCloudSmsProvider extends ISmsProvider {
  /**
   * @param {UniCloudConfig} config - uniCloud 配置
   * @param {boolean} testMode - 测试模式
   */
  constructor(config, testMode = false) {
    super();
    
    if (!config || !config.templateId) {
      throw new Error('uniCloud 配置错误：缺少 templateId');
    }

    this.templateId = config.templateId;
    this.testMode = testMode;
  }

  /**
   * 发送短信验证码
   * @param {string} phone - 手机号
   * @param {string} code - 验证码
   * @param {string} scene - 场景
   * @returns {Promise<SendResult>}
   */
  async sendVerificationCode(phone, code, scene) {
    try {
      console.log(`📱 [UniCloudSmsProvider] 发送短信 - 手机号: ${phone.substring(0, 3)}****，场景: ${scene}`);

      // 测试模式下不实际发送
      if (this.testMode) {
        console.log('📱 [UniCloudSmsProvider] 测试模式，跳过实际发送');
        return {
          success: true,
          message: '测试模式发送成功',
          requestId: 'test-' + Date.now()
        };
      }

      // 调用 uniCloud.sendSms API
      const result = await uniCloud.sendSms({
        appid: uniCloud.getCloudInfos()[0].appid,
        phone: phone,
        templateId: this.templateId,
        data: {
          code: code,
          time: '5分钟'
        }
      });

      console.log('📱 [UniCloudSmsProvider] uniCloud API 响应:', result);

      // 检查发送结果
      if (result.code === 0) {
        return {
          success: true,
          message: '发送成功',
          requestId: result.requestId || ''
        };
      } else {
        return {
          success: false,
          message: result.message || '发送失败',
          errorCode: result.code ? String(result.code) : undefined,
          requestId: result.requestId || ''
        };
      }
    } catch (error) {
      console.error('📱 [UniCloudSmsProvider] 发送异常:', error);
      return {
        success: false,
        message: error.message || '发送异常',
        errorCode: error.code ? String(error.code) : 'UNKNOWN_ERROR'
      };
    }
  }

  /**
   * 获取服务商名称
   * @returns {string}
   */
  getProviderName() {
    return 'uniCloud';
  }
}

module.exports = UniCloudSmsProvider;
