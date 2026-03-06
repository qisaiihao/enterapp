'use strict';

const ISmsProvider = require('../provider-interface');

/**
 * 腾讯云短信服务商实现
 */
class TencentCloudSmsProvider extends ISmsProvider {
  /**
   * @param {TencentCloudConfig} config - 腾讯云配置
   * @param {boolean} testMode - 测试模式
   */
  constructor(config, testMode = false) {
    super();

    // 验证必需配置
    if (!config) {
      throw new Error('腾讯云配置错误：缺少配置对象');
    }

    const requiredFields = ['secretId', 'secretKey', 'sdkAppId', 'signName', 'templateId'];
    for (const field of requiredFields) {
      if (!config[field]) {
        throw new Error(`腾讯云配置错误：缺少 ${field}`);
      }
    }

    this.secretId = config.secretId;
    this.secretKey = config.secretKey;
    this.sdkAppId = config.sdkAppId;
    this.signName = config.signName;
    this.templateId = config.templateId;
    this.region = config.region || 'ap-guangzhou';
    this.testMode = testMode;
    this.client = null;
  }

  /**
   * 初始化腾讯云 SMS 客户端
   * @private
   */
  _initClient() {
    if (this.client) {
      return;
    }

    try {
      const tencentcloud = require('tencentcloud-sdk-nodejs-sms');
      const SmsClient = tencentcloud.sms.v20210111.Client;

      this.client = new SmsClient({
        credential: {
          secretId: this.secretId,
          secretKey: this.secretKey
        },
        region: this.region,
        profile: {
          httpProfile: {
            endpoint: 'sms.tencentcloudapi.com'
          }
        }
      });

      console.log('📱 [TencentCloudSmsProvider] 客户端初始化成功');
    } catch (error) {
      console.error('📱 [TencentCloudSmsProvider] 客户端初始化失败:', error);
      throw new Error(`腾讯云 SMS 客户端初始化失败: ${error.message}`);
    }
  }

  /**
   * 格式化手机号为腾讯云要求的格式（+86 开头）
   * @param {string} phone - 手机号
   * @returns {string} 格式化后的手机号
   * @private
   */
  _formatPhone(phone) {
    // 如果已经是 +86 开头，直接返回
    if (phone.startsWith('+86')) {
      return phone;
    }
    // 如果是 1 开头的 11 位数字，添加 +86
    if (/^1[3-9]\d{9}$/.test(phone)) {
      return `+86${phone}`;
    }
    // 其他情况直接返回
    return phone;
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
      console.log(`📱 [TencentCloudSmsProvider] 发送短信 - 手机号: ${phone.substring(0, 3)}****，场景: ${scene}`);

      // 测试模式下不实际发送
      if (this.testMode) {
        console.log('📱 [TencentCloudSmsProvider] 测试模式，跳过实际发送');
        return {
          success: true,
          message: '测试模式发送成功',
          requestId: 'test-tencent-' + Date.now()
        };
      }

      // 初始化客户端
      this._initClient();

      // 格式化手机号
      const formattedPhone = this._formatPhone(phone);

      // 构造请求参数
      const params = {
        PhoneNumberSet: [formattedPhone],
        SmsSdkAppId: this.sdkAppId,
        SignName: this.signName,
        TemplateId: this.templateId,
        TemplateParamSet: [code, '5'] // 验证码和有效期（5分钟）
      };

      console.log('📱 [TencentCloudSmsProvider] 请求参数:', {
        ...params,
        PhoneNumberSet: [formattedPhone.substring(0, 6) + '****']
      });

      // 调用腾讯云 SendSms 接口
      const response = await this.client.SendSms(params);

      console.log('📱 [TencentCloudSmsProvider] 腾讯云 API 响应:', response);

      // 检查发送结果
      if (response.SendStatusSet && response.SendStatusSet.length > 0) {
        const status = response.SendStatusSet[0];

        if (status.Code === 'Ok') {
          return {
            success: true,
            message: '发送成功',
            requestId: response.RequestId
          };
        } else {
          return {
            success: false,
            message: status.Message || '发送失败',
            errorCode: status.Code,
            requestId: response.RequestId
          };
        }
      } else {
        return {
          success: false,
          message: '发送失败：未返回发送状态',
          requestId: response.RequestId
        };
      }
    } catch (error) {
      console.error('📱 [TencentCloudSmsProvider] 发送异常:', error);
      
      // 解析腾讯云错误
      let errorMessage = error.message || '发送异常';
      let errorCode = 'UNKNOWN_ERROR';

      if (error.code) {
        errorCode = error.code;
      }

      // 提供更友好的错误信息
      if (errorCode.includes('AuthFailure')) {
        errorMessage = '认证失败，请检查 SecretId 和 SecretKey';
      } else if (errorCode.includes('InvalidParameter')) {
        errorMessage = '参数错误：' + errorMessage;
      } else if (errorCode.includes('LimitExceeded')) {
        errorMessage = '超过频率限制';
      }

      return {
        success: false,
        message: errorMessage,
        errorCode: errorCode
      };
    }
  }

  /**
   * 获取服务商名称
   * @returns {string}
   */
  getProviderName() {
    return 'TencentCloud';
  }
}

module.exports = TencentCloudSmsProvider;
