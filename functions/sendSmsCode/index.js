const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

// 短信发送限制配置
const SMS_LIMITS = {
  // 同一手机号每日最多发送次数
  DAILY_LIMIT_PER_PHONE: 10,
  // 同一IP每日最多发送次数
  DAILY_LIMIT_PER_IP: 50,
  // 发送间隔（秒）
  SEND_INTERVAL: 60,
  // 验证码有效期（秒）
  CODE_EXPIRE_TIME: 300, // 5分钟
  // 测试模板ID（需要替换为实际模板ID）
  TEST_TEMPLATE_ID: 'uni_sms_test',
  // 正式模板ID（需要替换为实际模板ID）
  VERIFICATION_TEMPLATE_ID: '10001' // 需要申请正式模板
};

/**
 * 生成6位随机验证码
 */
function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * 验证手机号格式
 */
function validatePhoneNumber(phone) {
  const phoneRegex = /^1[3-9]\d{9}$/;
  return phoneRegex.test(phone);
}

/**
 * 获取客户端IP
 */
function getClientIP(context) {
  return context.CLIENTIP || context.clientIP || 'unknown';
}

/**
 * 检查发送限制
 */
async function checkSendLimits(phone, clientIP) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  try {
    // 检查手机号发送次数
    const phoneCount = await db.collection('sms_codes')
      .where({
        phone: phone,
        createdAt: _.gte(today)
      })
      .count();

    if (phoneCount.total >= SMS_LIMITS.DAILY_LIMIT_PER_PHONE) {
      return {
        canSend: false,
        reason: `该手机号今日发送次数已达上限（${SMS_LIMITS.DAILY_LIMIT_PER_PHONE}次）`
      };
    }

    // 检查IP发送次数
    if (clientIP !== 'unknown') {
      const ipCount = await db.collection('sms_codes')
        .where({
          clientIP: clientIP,
          createdAt: _.gte(today)
        })
        .count();

      if (ipCount.total >= SMS_LIMITS.DAILY_LIMIT_PER_IP) {
        return {
          canSend: false,
          reason: `该IP今日发送次数已达上限（${SMS_LIMITS.DAILY_LIMIT_PER_IP}次）`
        };
      }
    }

    // 检查发送间隔
    const recentRecord = await db.collection('sms_codes')
      .where({
        phone: phone
      })
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    if (recentRecord.data.length > 0) {
      const lastSendTime = recentRecord.data[0].createdAt;
      const timeDiff = (now - lastSendTime) / 1000; // 转换为秒

      if (timeDiff < SMS_LIMITS.SEND_INTERVAL) {
        const remainTime = Math.ceil(SMS_LIMITS.SEND_INTERVAL - timeDiff);
        return {
          canSend: false,
          reason: `请等待${remainTime}秒后再发送`
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
async function saveVerificationCode(phone, code, clientIP, scene = 'login') {
  try {
    await db.collection('sms_codes').add({
      data: {
        phone: phone,
        code: code,
        clientIP: clientIP,
        scene: scene, // 使用场景：login/register/binding等
        used: false,
        createdAt: new Date(),
        expiredAt: new Date(Date.now() + SMS_LIMITS.CODE_EXPIRE_TIME * 1000)
      }
    });
  } catch (error) {
    console.error('保存验证码记录失败:', error);
    throw error;
  }
}

exports.main = async (event, context) => {
  console.log('📱 [sendSmsCode] 开始发送短信验证码');

  const wxContext = cloud.getWXContext();
  const { phone, scene = 'login' } = event;
  const clientIP = getClientIP(context);

  console.log('📱 [sendSmsCode] 参数:', { phone, scene, clientIP });

  // 参数验证
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

  try {
    // 检查发送限制
    const limitCheck = await checkSendLimits(phone, clientIP);
    if (!limitCheck.canSend) {
      return {
        success: false,
        code: 'SEND_LIMIT_EXCEEDED',
        message: limitCheck.reason
      };
    }

    // 生成验证码
    const verificationCode = generateVerificationCode();
    console.log('📱 [sendSmsCode] 生成验证码:', verificationCode);

    // 根据场景选择模板
    let templateId;
    let templateData;

    if (scene === 'test') {
      // 测试场景使用测试模板
      templateId = SMS_LIMITS.TEST_TEMPLATE_ID;
      templateData = {
        code: verificationCode,
        time: Math.floor(SMS_LIMITS.CODE_EXPIRE_TIME / 60) + '分钟'
      };
    } else {
      // 正式场景使用验证码模板（需要替换为实际模板ID）
      templateId = SMS_LIMITS.VERIFICATION_TEMPLATE_ID;
      templateData = {
        code: verificationCode,
        time: Math.floor(SMS_LIMITS.CODE_EXPIRE_TIME / 60) + '分钟'
      };
    }

    console.log('📱 [sendSmsCode] 使用模板:', templateId, '数据:', templateData);

    // 发送短信
    const smsResult = await uniCloud.sendSms({
      appid: '__UNI__your_appid', // 需要替换为实际appid
      phone: phone,
      templateId: templateId,
      data: templateData
    });

    console.log('📱 [sendSmsCode] 短信发送结果:', smsResult);

    // 保存验证码记录
    await saveVerificationCode(phone, verificationCode, clientIP, scene);

    return {
      success: true,
      code: 'SUCCESS',
      message: '验证码已发送，请注意查收',
      data: {
        phone: phone,
        expireTime: SMS_LIMITS.CODE_EXPIRE_TIME,
        remainTime: SMS_LIMITS.SEND_INTERVAL // 下次可发送的间隔时间
      }
    };

  } catch (error) {
    console.error('📱 [sendSmsCode] 发送失败:', error);

    // 处理短信服务相关错误
    if (error.errCode || error.code) {
      const errorCode = error.errCode || error.code;

      // 账户相关错误
      if (errorCode === 'ACCOUNT_NOT_ENOUGH') {
        return {
          success: false,
          code: 'ACCOUNT_INSUFFICIENT',
          message: '短信账户余额不足，请联系管理员充值'
        };
      }

      // 模板相关错误
      if (errorCode === 'TEMPLATE_NOT_FOUND') {
        return {
          success: false,
          code: 'TEMPLATE_ERROR',
          message: '短信模板不存在，请联系管理员检查模板配置'
        };
      }

      // 频率限制
      if (errorCode === 'FREQUENCY_LIMIT') {
        return {
          success: false,
          code: 'FREQUENCY_LIMIT',
          message: '发送过于频繁，请稍后再试'
        };
      }
    }

    return {
      success: false,
      code: 'SEND_FAILED',
      message: '发送失败，请重试'
    };
  }
};