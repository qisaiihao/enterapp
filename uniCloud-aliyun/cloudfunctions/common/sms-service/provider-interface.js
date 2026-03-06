'use strict';

/**
 * 短信服务商接口
 * 所有短信服务商必须实现此接口
 */
class ISmsProvider {
  /**
   * 发送短信验证码
   * @param {string} phone - 手机号（+86 格式或 1 开头的 11 位）
   * @param {string} code - 验证码
   * @param {string} scene - 场景（binding、updatePhone、resetPassword）
   * @returns {Promise<SendResult>} 发送结果
   */
  async sendVerificationCode(phone, code, scene) {
    throw new Error('sendVerificationCode 方法必须被实现');
  }

  /**
   * 获取服务商名称
   * @returns {string} 服务商名称
   */
  getProviderName() {
    throw new Error('getProviderName 方法必须被实现');
  }
}

module.exports = ISmsProvider;
