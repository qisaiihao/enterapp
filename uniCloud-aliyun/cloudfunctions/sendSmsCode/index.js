'use strict';

exports.main = async (event, context) => {
  // 参数校验
  const { phone, scene = 'login' } = event;

  if (!phone) {
    return {
      code: 1001,
      message: '请输入手机号'
    };
  }

  // 验证手机号格式（中国大陆）
  const phoneRegex = /^1[3-9]\d{9}$/;
  if (!phoneRegex.test(phone)) {
    return {
      code: 1002,
      message: '请输入正确的手机号格式'
    };
  }

  try {
    console.log('📱 [uniCloud] 开始发送短信验证码，手机号:', phone.substring(0, 3) + '********');

    // 生成6位验证码
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    console.log('📱 [uniCloud] 生成验证码:', verificationCode);

    // 根据场景选择模板
    let templateId;
    let templateData;

    // 使用指定的模板ID 37351
    templateId = '37351';
    templateData = {
      code: verificationCode,
      time: '5分钟'
    };

    console.log('📱 [uniCloud] 使用模板ID 37351');

    console.log('📱 [uniCloud] 使用模板ID:', templateId);

    // 发送短信
    const smsResult = await uniCloud.sendSms({
      appid: context.APPID, // 使用当前应用的 appid
      phone: phone,
      templateId: templateId,
      data: templateData
    });

    console.log('📱 [uniCloud] 短信发送结果:', smsResult);

    // 检查发送结果
    if (smsResult.code !== 0) {
      console.error('📱 [uniCloud] 短信发送失败:', smsResult.message);
      return {
        code: 2001,
        message: smsResult.message || '短信发送失败'
      };
    }

    // 保存验证码到数据库（用于后续校验）
    const db = uniCloud.database();
    const now = new Date();
    const expiredAt = new Date(now.getTime() + 5 * 60 * 1000); // 5分钟后过期

    try {
      await db.collection('sms_codes').add({
        phone: phone,
        code: verificationCode,
        scene: scene,
        used: false,
        createdAt: now,
        expiredAt: expiredAt,
        ip: context.CLIENTIP || ''
      });

      console.log('✅ [uniCloud] 验证码记录已保存');

      return {
        code: 0,
        message: '验证码已发送，请注意查收',
        data: {
          phone: phone,
          expireTime: 5 * 60, // 5分钟，单位秒
          remainTime: 60 // 下次可发送间隔，单位秒
        }
      };

    } catch (dbError) {
      console.error('📱 [uniCloud] 数据库操作失败:', dbError);
      // 即使数据库操作失败，也返回成功（因为短信已发送）
      return {
        code: 0,
        message: '验证码已发送，请注意查收',
        data: {
          phone: phone,
          expireTime: 5 * 60,
          remainTime: 60,
          warning: '验证码记录保存失败'
        }
      };
    }

  } catch (error) {
    console.error('📱 [uniCloud] 发送短信异常:', error);
    return {
      code: 5000,
      message: '发送失败：' + (error.message || '未知错误')
    };
  }
};