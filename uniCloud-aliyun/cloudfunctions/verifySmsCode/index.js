'use strict';

const db = uniCloud.database();

exports.main = async (event, context) => {
  // 参数校验
  const { phone, code, scene = 'login' } = event;

  if (!phone || !code) {
    return {
      code: 1001,
      message: '请输入手机号和验证码'
    };
  }

  // 验证手机号格式
  const phoneRegex = /^1[3-9]\d{9}$/;
  if (!phoneRegex.test(phone)) {
    return {
      code: 1002,
      message: '手机号格式不正确'
    };
  }

  // 验证验证码格式
  if (!/^\d{6}$/.test(code)) {
    return {
      code: 1003,
      message: '验证码格式不正确'
    };
  }

  try {
    console.log('🔍 [verifySmsCode] 开始验证验证码，手机号:', phone.substring(0, 3) + '********', '验证码:', code);

    const now = new Date();

    // 查找有效的验证码记录
    const verifyRecord = await db.collection('sms_codes')
      .where({
        phone: phone,
        code: code,
        scene: scene,
        used: false,
        expiredAt: db.command.gt(now) // 未过期
      })
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    console.log('🔍 [verifySmsCode] 查询结果:', verifyRecord);

    if (verifyRecord.data.length === 0) {
      return {
        code: 2001,
        message: '验证码错误或已过期'
      };
    }

    const record = verifyRecord.data[0];

    // 检查验证码是否已过期（双重保险）
    if (record.expiredAt < now) {
      return {
        code: 2002,
        message: '验证码已过期'
      };
    }

    // 标记验证码为已使用
    await db.collection('sms_codes').doc(record._id).update({
      used: true,
      usedAt: now
    });

    console.log('✅ [verifySmsCode] 验证成功');

    return {
      code: 0,
      message: '验证成功',
      data: {
        phone: phone,
        verifiedAt: now
      }
    };

  } catch (error) {
    console.error('❌ [verifySmsCode] 验证失败:', error);
    return {
      code: 5000,
      message: '验证失败：' + (error.message || '未知错误')
    };
  }
};