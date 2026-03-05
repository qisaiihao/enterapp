/**
 * 短信服务配置
 * 用于前端选择调用哪个云函数
 */

const SMS_CONFIG = {
  // 短信服务提供商：'unicloud' 或 'tencentcloud'
  provider: 'tencentcloud',
  
  // uniCloud 云函数配置
  unicloud: {
    sendFunctionName: 'sendSmsCode',
    verifyFunctionName: 'verifySmsCode'
  },
  
  // 腾讯云云函数配置（微信云开发）
  tencentcloud: {
    sendFunctionName: 'sendSmsCode',
    verifyFunctionName: 'verifySmsCode'
  }
};

/**
 * 获取当前使用的云函数名称
 */
function getSmsFunction(type) {
  const provider = SMS_CONFIG.provider;
  const config = SMS_CONFIG[provider];
  
  if (!config) {
    throw new Error(`未配置的服务商: ${provider}`);
  }
  
  if (type === 'send') {
    return {
      name: config.sendFunctionName,
      provider: provider
    };
  } else if (type === 'verify') {
    return {
      name: config.verifyFunctionName,
      provider: provider
    };
  } else {
    throw new Error(`未知的函数类型: ${type}`);
  }
}

/**
 * 发送短信验证码
 * @param {string} phone - 手机号
 * @param {string} scene - 场景（binding、updatePhone、resetPassword）
 * @returns {Promise} 发送结果
 */
async function sendSmsCode(phone, scene = 'binding') {
  const funcInfo = getSmsFunction('send');
  
  console.log(`📱 [SMS] 使用 ${funcInfo.provider} 发送短信`);
  
  // #ifdef APP-PLUS
  if (funcInfo.provider === 'unicloud') {
    // 调用 uniCloud 云函数（仅 APP 环境支持）
    return await uniCloud.callFunction({
      name: funcInfo.name,
      data: {
        phone: phone,
        scene: scene
      }
    });
  }
  // #endif
  
  if (funcInfo.provider === 'tencentcloud') {
    // 调用微信云开发云函数
    return await wx.cloud.callFunction({
      name: funcInfo.name,
      data: {
        phone: phone,
        scene: scene
      }
    });
  }
  
  throw new Error(`不支持的服务商: ${funcInfo.provider}`);
}

/**
 * 验证短信验证码
 * @param {string} phone - 手机号
 * @param {string} code - 验证码
 * @param {string} scene - 场景
 * @returns {Promise} 验证结果
 */
async function verifySmsCode(phone, code, scene = 'binding') {
  const funcInfo = getSmsFunction('verify');
  
  console.log(`🔍 [SMS] 使用 ${funcInfo.provider} 验证短信`);
  
  // #ifdef APP-PLUS
  if (funcInfo.provider === 'unicloud') {
    // 调用 uniCloud 云函数（仅 APP 环境支持）
    return await uniCloud.callFunction({
      name: funcInfo.name,
      data: {
        phone: phone,
        code: code,
        scene: scene
      }
    });
  }
  // #endif
  
  if (funcInfo.provider === 'tencentcloud') {
    // 调用微信云开发云函数
    return await wx.cloud.callFunction({
      name: funcInfo.name,
      data: {
        phone: phone,
        code: code,
        scene: scene
      }
    });
  }
  
  throw new Error(`不支持的服务商: ${funcInfo.provider}`);
}

module.exports = {
  SMS_CONFIG,
  sendSmsCode,
  verifySmsCode
};
