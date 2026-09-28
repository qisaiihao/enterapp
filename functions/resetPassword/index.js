const cloud = require('wx-server-sdk');
const crypto = require('crypto');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database({ throwOnNotFound: false });
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const invalidCode = () => ({ success: false, code: 'CODE_INVALID', message: '验证码错误或已过期，请重新获取' });
const tooManyAttempts = () => ({ success: false, code: 'CODE_ATTEMPTS_EXCEEDED', message: '验证码错误次数过多，请重新获取' });

exports.main = async (event) => {
  const { phoneNumber: rawPhone, code: rawCode, newPassword } = event || {};
  const phoneNumber = typeof rawPhone === 'string' ? rawPhone.trim().replace(/^\+86/, '') : '';
  const code = typeof rawCode === 'string' ? rawCode.trim() : '';
  if (!/^1[3-9]\d{9}$/.test(phoneNumber)) {
    return { success: false, code: 'INVALID_PHONE', message: '请输入正确的已绑定手机号' };
  }
  if (!/^\d{6}$/.test(code)) {
    return { success: false, code: 'INVALID_CODE', message: '请输入6位短信验证码' };
  }
  if (typeof newPassword !== 'string' || newPassword.length < 6 || newPassword.length > 32 || newPassword !== newPassword.trim()) {
    return { success: false, code: 'INVALID_PASSWORD', message: '新密码需为6–32位，首尾不能有空格' };
  }

  try {
    // 仅按已绑定手机号选定账号；忽略客户端传入的用户 ID / openid。
    const candidates = await db.collection('users').where({ phoneNumber }).limit(2).get();
    return await db.runTransaction(async transaction => {
      const codeRef = transaction.collection('sms_codes').doc(`resetPassword_${digest(phoneNumber)}`);
      const { data: record } = await codeRef.get();
      const now = new Date();
      if (!record || record.phone !== phoneNumber || record.scene !== 'resetPassword' || record.status !== 'sent' ||
          record.used || !(new Date(record.expiredAt) > now)) return invalidCode();
      if (record.attempts >= 5) return tooManyAttempts();
      const expected = typeof record.codeHash === 'string' ? Buffer.from(record.codeHash, 'hex') : Buffer.alloc(0);
      const actual = Buffer.from(digest(`${record.requestId}:${code}`), 'hex');
      if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
        const attempts = (record.attempts || 0) + 1;
        await codeRef.update({ data: { attempts } });
        return attempts >= 5 ? tooManyAttempts() : invalidCode();
      }

      if (candidates.data.length !== 1) {
        await codeRef.update({ data: { used: true, usedAt: now } });
        return candidates.data.length === 0
          ? { success: false, code: 'PHONE_NOT_REGISTERED', message: '该手机号未绑定账号，请确认手机号或先注册' }
          : { success: false, code: 'AMBIGUOUS_ACCOUNT', message: '该手机号绑定多个账号，请联系管理员处理' };
      }
      const userRef = transaction.collection('users').doc(candidates.data[0]._id);
      const { data: user } = await userRef.get();
      if (!user || user.phoneNumber !== phoneNumber) {
        await codeRef.update({ data: { used: true, usedAt: now } });
        return { success: false, code: 'PHONE_CHANGED', message: '账号绑定手机号已变化，请重新确认' };
      }
      // 保持现有密码登录字段格式，密码修改与验证码消费必须一起提交或一起回滚。
      await userRef.update({ data: { password: newPassword, passwordUpdatedAt: now } });
      await codeRef.update({ data: { used: true, usedAt: now } });
      return { success: true, code: 'SUCCESS', message: '密码已重置，请使用新密码登录' };
    });
  } catch (error) {
    // 不记录请求参数，避免密码和验证码进入日志。
    console.error('[resetPassword] 重置失败:', error.code || 'SYSTEM_ERROR');
    return { success: false, code: 'RESET_FAILED', message: '密码重置失败，请稍后重试' };
  }
};
