const cloud = require('wx-server-sdk');
const config = require('./config');
const { SmsProviderFactory } = require('./sms-providers');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

/**
 * 生成6位随机验证码
 */
function generateVerificationCode(testMode = false) {
  if (testMode) {
    return '123456';
  }
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * 验证手机号格式
 */
function validatePhoneNumber(phone) {
  const phoneRegex = /^(\+86)?1[3-9]\d{9}$/;
  return phoneRegex.test(phone);
}

/**
 * 获取客户端IP
 */
function getClientIP(context) {
  return context.CLIENTIP || context.clientIP || 'unknown';
}

/**
 * 脱敏手机号
 */
function maskPhone(phone) {
  if (!phone || phone.length < 7) {
    return phone;
  }
  if (phone.startsWith('+86')) {
    return phone.substring(0, 6) + '****' + phone.substring(phone.length - 4);
  } else {
    return phone.substring(0, 3) + '****' + phone.substring(phone.length - 4);
  }
}

/**
 * 检查发送限制
 */
async function checkSendLimits(phone, clientIP) {
  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;
  const oneHourAgo = now - 60 * 60 * 1000;
  const sixtySecondsAgo = now - 60 * 1000;

  try {
    // 检查 60 秒内是否重复请求
    const recentCount = await db.collection('sms_logs')
      .where({
        phone: phone,
        createdAt: _.gte(new Date(sixtySecondsAgo))
      })
      .count();

    if (recentCount.total > 0) {
      return {
        canSend: false,
        reason: '请求过于频繁，请 60 秒后再试'
      };
    }

    // 检查 24 小时内请求次数
    const dailyCount = await db.collection('sms_logs')
      .where({
        phone: phone,
        createdAt: _.gte(new Date(oneDayAgo))
      })
      .count();

    if (dailyCount.total >= config.limits.dailyLimitPerPhone) {
      return {
        canSend: false,
        reason: `今日发送次数已达上限（${config.limits.dailyLimitPerPhone}次），请明天再试`
      };
    }

    // 检查 IP 1 小时内请求次数
    if (clientIP && clientIP !== 'unknown') {
      const ipCount = await db.collection('sms_logs')
        .where({
          clientIP: clientIP,
          createdAt: _.gte(new Date(oneHourAgo))
        })
        .count();

      if (ipCount.total >= config.limits.dailyLimitPerIP) {
        return {
          canSend: false,
          reason: 'IP 请求过于频繁，请稍后再试'
        };
      }
    }

    return { canSend: true };
  } catch (error) {
    console.error('检查发送限制失败:', error);
    return { canSend: true }; // 如果检查失败，允许发送（降级处理）
  }
}

/**
 * 保存验证码记录
 */
async function saveVerificationCode(phone, code, clientIP, scene = 'binding') {
  try {
    const now = new Date();
    await db.collection('sms_codes').add({
      data: {
        phone: phone,
        code: code,
        clientIP: clientIP,
        scene: scene,
        used: false,
        createdAt: now,
        expiredAt: new Date(now.getTime() + config.limits.codeExpireTime * 1000)
      }
    });
  } catch (error) {
    console.error('保存验证码记录失败:', error);
    throw error;
  }
}

/**
 * 记录发送日志
 */
async function logSms(phone, scene, provider, success, message, clientIP, errorCode = '') {
  try {
    await db.collection('sms_logs').add({
      data: {
        phone: maskPhone(phone),
        scene: scene,
        provider: provider,
        success: success,
        message: message,
        errorCode: errorCode,
        clientIP: clientIP,
        createdAt: new Date()
      }
    });
  } catch (error) {
    console.error('记录日志失败:', error);
  }
}


exports.main = async (event, context) => {
  console.log('📱 [sendSmsCode] 开始处理短信发送请求');

  const { phone, scene = 'binding' } = event;
  const clientIP = getClientIP(context);

  console.log('📱 [sendSmsCode] 参数:', { 
    phone: phone ? phone.substring(0, 3) + '****' : '未提供', 
    scene, 
    clientIP 
  });

  try {
    // 1. 参数验证
    if (!phone) {
      return {
        success: false,
        code: 'MISSING_PHONE',
        message: '请输入手机号'
      };
    }

    if (!validatePhoneNumber(phone)) {
      return {
        success: false,
        code: 'INVALID_PHONE',
        message: '请输入正确的手机号格式'
      };
    }

    // 2. 场景验证
    const validScenes = ['binding', 'updatePhone', 'resetPassword'];
    if (!validScenes.includes(scene)) {
      return {
        success: false,
        code: 'INVALID_SCENE',
        message: `不支持的场景: ${scene}`
      };
    }

    // 3. 检查发送限制
    const limitCheck = await checkSendLimits(phone, clientIP);
    if (!limitCheck.canSend) {
      return {
        success: false,
        code: 'SEND_LIMIT_EXCEEDED',
        message: limitCheck.reason
      };
    }

    // 4. 生成验证码
    const verificationCode = generateVerificationCode(config.testMode);
    console.log('📱 [sendSmsCode] 验证码已生成');

    // 5. 获取短信服务商
    let provider;
    try {
      provider = SmsProviderFactory.createProvider(config);
      console.log('📱 [sendSmsCode] 使用服务商:', provider.getProviderName());
    } catch (providerError) {
      console.error('📱 [sendSmsCode] 服务商创建失败:', providerError);
      return {
        success: false,
        code: 'PROVIDER_INIT_FAILED',
        message: providerError.message || '短信服务初始化失败'
      };
    }

    // 6. 发送短信
    const sendResult = await provider.sendVerificationCode(phone, verificationCode);

    // 7. 处理发送结果
    if (!sendResult.success) {
      // 记录失败日志
      await logSms(phone, scene, provider.getProviderName(), false, sendResult.message, clientIP, sendResult.errorCode);
      
      console.error('📱 [sendSmsCode] 发送失败:', sendResult.message);
      return {
        success: false,
        code: 'SEND_FAILED',
        message: `发送失败: ${sendResult.message}`
      };
    }

    // 8. 保存验证码到数据库
    try {
      await saveVerificationCode(phone, verificationCode, clientIP, scene);
    } catch (dbError) {
      console.error('📱 [sendSmsCode] 数据库保存失败:', dbError);
      // 短信已发送，数据库失败不影响用户体验
    }

    // 9. 记录成功日志
    await logSms(phone, scene, provider.getProviderName(), true, sendResult.message, clientIP);

    console.log('✅ [sendSmsCode] 短信发送成功');

    // 10. 返回成功响应
    return {
      success: true,
      code: 'SUCCESS',
      message: '验证码已发送，请注意查收',
      data: {
        phone: phone,
        expireTime: config.limits.codeExpireTime,
        remainTime: config.limits.sendInterval
      }
    };

  } catch (error) {
    console.error('📱 [sendSmsCode] 系统异常:', error);
    return {
      success: false,
      code: 'SYSTEM_ERROR',
      message: '系统错误，请稍后重试'
    };
  }
};