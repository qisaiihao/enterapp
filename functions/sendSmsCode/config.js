/**
 * 短信服务配置
 */

module.exports = {
  // 短信服务商：'wechat' 或 'tencentcloud'
  provider: 'tencentcloud',
  
  // 测试模式：true 时使用固定验证码 123456
  testMode: false,
  
  // 微信云开发配置
  wechat: {
    appid: '__UNI__your_appid', // 需要替换为实际appid
    templateId: 'uni_sms_test'
  },
  
  // 腾讯云 SMS 配置
  tencentcloud: {
    // 从环境变量读取（在云开发控制台设置）
    secretId: process.env.TENCENT_SECRET_ID,
    secretKey: process.env.TENCENT_SECRET_KEY,
    sdkAppId: '1401056037',
    signName: '江门市新会区回车键网络',
    templateId: '2601313',
    region: 'ap-guangzhou'
  },
  
  // 短信发送限制配置
  limits: {
    // 同一手机号每日最多发送次数
    dailyLimitPerPhone: 10,
    // 同一IP每日最多发送次数
    dailyLimitPerIP: 50,
    // 发送间隔（秒）
    sendInterval: 60,
    // 验证码有效期（秒）
    codeExpireTime: 300 // 5分钟
  }
};
