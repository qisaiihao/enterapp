const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

/**
 * 验证手机号格式
 */
function validatePhoneNumber(phone) {
  const phoneRegex = /^(\+86)?1[3-9]\d{9}$/;
  return phoneRegex.test(phone);
}

exports.main = async (event, context) => {
  console.log('🔍 [verifySmsCode] 开始验证验证码');

  const { phone, code, scene = 'binding' } = event;

  console.log('🔍 [verifySmsCode] 参数:', {
    phone: phone ? phone.substring(0, 3) + '****' : '未提供',
    scene
  });

  try {
    // 1. 参数验证
    if (!phone || !code) {
      return {
        success: false,
        code: 'MISSING_PARAMS',
        message: '请输入手机号和验证码'
      };
    }

    // 2. 验证手机号格式
    if (!validatePhoneNumber(phone)) {
      return {
        success: false,
        code: 'INVALID_PHONE',
        message: '手机号格式不正确'
      };
    }

    // 3. 验证验证码格式
    if (!/^\d{6}$/.test(code)) {
      return {
        success: false,
        code: 'INVALID_CODE',
        message: '验证码格式不正确'
      };
    }

    // 4. 场景验证
    const validScenes = ['binding', 'updatePhone', 'resetPassword'];
    if (!validScenes.includes(scene)) {
      return {
        success: false,
        code: 'INVALID_SCENE',
        message: `不支持的场景: ${scene}`
      };
    }

    const now = new Date();

    // 5. 查找有效的验证码记录
    const verifyRecord = await db.collection('sms_codes')
      .where({
        phone: phone,
        code: code,
        scene: scene,
        used: false,
        expiredAt: _.gt(now)
      })
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    console.log('🔍 [verifySmsCode] 查询结果数量:', verifyRecord.data.length);

    // 6. 检查验证码是否存在
    if (verifyRecord.data.length === 0) {
      return {
        success: false,
        code: 'CODE_INVALID',
        message: '验证码错误或已过期'
      };
    }

    const record = verifyRecord.data[0];

    // 7. 双重检查过期时间
    if (record.expiredAt < now) {
      return {
        success: false,
        code: 'CODE_EXPIRED',
        message: '验证码已过期'
      };
    }

    // 8. 标记验证码为已使用
    await db.collection('sms_codes').doc(record._id).update({
      data: {
        used: true,
        usedAt: now
      }
    });

    console.log('✅ [verifySmsCode] 验证成功');

    // 9. 返回成功响应
    return {
      success: true,
      code: 'SUCCESS',
      message: '验证成功',
      data: {
        phone: phone,
        scene: scene,
        verifiedAt: now
      }
    };

  } catch (error) {
    console.error('❌ [verifySmsCode] 验证失败:', error);
    return {
      success: false,
      code: 'SYSTEM_ERROR',
      message: '验证失败：' + (error.message || '未知错误')
    };
  }
};
