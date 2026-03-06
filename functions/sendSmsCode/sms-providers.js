/**
 * 短信服务商实现
 */

const tencentcloud = require('tencentcloud-sdk-nodejs-sms');

/**
 * 微信云开发短信服务
 */
class WechatSmsProvider {
  constructor(config) {
    this.appid = config.appid;
    this.templateId = config.templateId;
  }

  async sendVerificationCode(phone, code) {
    console.log('📱 [WechatSms] 发送短信，手机号:', phone.substring(0, 3) + '****');
    
    const result = await uniCloud.sendSms({
      appid: this.appid,
      phone: phone,
      templateId: this.templateId,
      data: {
        code: code,
        time: '5分钟'
      }
    });

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
        errorCode: result.code
      };
    }
  }

  getProviderName() {
    return 'WechatCloud';
  }
}

/**
 * 腾讯云 SMS 服务
 */
class TencentCloudSmsProvider {
  constructor(config) {
    this.config = config;
    this.client = null;
  }

  _initClient() {
    if (this.client) {
      return;
    }

    const SmsClient = tencentcloud.sms.v20210111.Client;

    this.client = new SmsClient({
      credential: {
        secretId: this.config.secretId,
        secretKey: this.config.secretKey
      },
      region: this.config.region || 'ap-guangzhou',
      profile: {
        httpProfile: {
          endpoint: 'sms.tencentcloudapi.com'
        }
      }
    });

    console.log('📱 [TencentCloudSms] 客户端初始化成功');
  }

  _formatPhone(phone) {
    // 如果已经是 +86 开头，直接返回
    if (phone.startsWith('+86')) {
      return phone;
    }
    // 如果是 1 开头的 11 位数字，添加 +86
    if (/^1[3-9]\d{9}$/.test(phone)) {
      return `+86${phone}`;
    }
    return phone;
  }

  async sendVerificationCode(phone, code) {
    try {
      console.log('📱 [TencentCloudSms] 发送短信，手机号:', phone.substring(0, 3) + '****');

      this._initClient();

      const formattedPhone = this._formatPhone(phone);

      const params = {
        PhoneNumberSet: [formattedPhone],
        SmsSdkAppId: this.config.sdkAppId,
        SignName: this.config.signName,
        TemplateId: this.config.templateId,
        TemplateParamSet: [code, '5'] // 验证码和有效期（5分钟）
      };

      console.log('📱 [TencentCloudSms] 请求参数:', {
        ...params,
        PhoneNumberSet: [formattedPhone.substring(0, 6) + '****']
      });

      const response = await this.client.SendSms(params);

      console.log('📱 [TencentCloudSms] 腾讯云 API 响应:', response);

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
      console.error('📱 [TencentCloudSms] 发送异常:', error);

      let errorMessage = error.message || '发送异常';
      let errorCode = error.code || 'UNKNOWN_ERROR';

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

  getProviderName() {
    return 'TencentCloud';
  }
}

/**
 * 服务商工厂
 */
class SmsProviderFactory {
  static createProvider(config) {
    const provider = config.provider || 'wechat';

    switch (provider) {
      case 'wechat':
        return new WechatSmsProvider(config.wechat);
      case 'tencentcloud':
        if (!config.tencentcloud.secretId || !config.tencentcloud.secretKey) {
          throw new Error('腾讯云配置错误：缺少 SecretId 或 SecretKey，请在云开发控制台设置环境变量 TENCENT_SECRET_ID 和 TENCENT_SECRET_KEY');
        }
        return new TencentCloudSmsProvider(config.tencentcloud);
      default:
        throw new Error(`不支持的服务商: ${provider}`);
    }
  }
}

module.exports = {
  SmsProviderFactory
};
