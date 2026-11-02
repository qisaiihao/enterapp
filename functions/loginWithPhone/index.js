const cloud = require('wx-server-sdk');
const crypto = require('crypto');
const { prepareWechatLogin, safeUser } = require('./_lib/wechat-auth');
const { recordSuccessfulLogin } = require('./_lib/login-audit');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database({ throwOnNotFound: false });
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const invalidCode = () => ({ success: false, code: 'CODE_INVALID', message: '验证码不正确或无效，请使用本次登录获取的验证码' });
const sendingCode = () => ({ success: false, code: 'CODE_SENDING', message: '验证码发送确认中，请稍后再提交' });

exports.main = async (event, context) => {
  const { phoneNumber: rawPhone, code: rawCode } = event || {};
  const phoneNumber = typeof rawPhone === 'string' ? rawPhone.trim().replace(/^\+86/, '') : '';
  const code = typeof rawCode === 'string' ? rawCode.trim() : '';
  if (!/^1[3-9]\d{9}$/.test(phoneNumber)) {
    return { success: false, code: 'INVALID_PHONE', message: '请输入正确的手机号' };
  }
  if (!/^\d{6}$/.test(code)) {
    return { success: false, code: 'INVALID_CODE', message: '请输入6位短信验证码' };
  }

  try {
    // 验证、错误计数与消费在同一事务中，保证并发登录仅成功一次。
    const verification = await db.runTransaction(async transaction => {
      const ref = transaction.collection('sms_codes').doc(`login_${digest(phoneNumber)}`);
      const { data: record } = await ref.get();
      const now = new Date();
      const isSending = async (matchSubmittedCode = false) => {
        const { data: pending } = await transaction.collection('sms_codes').doc(`login_${digest(phoneNumber)}_pending`).get();
        if (!pending || pending.phone !== phoneNumber || pending.scene !== 'login' ||
            pending.status !== 'sending' || !(new Date(pending.expiredAt) > now)) return false;
        if (!matchSubmittedCode) return true;
        const expected = typeof pending.codeHash === 'string' ? Buffer.from(pending.codeHash, 'hex') : Buffer.alloc(0);
        const actual = Buffer.from(digest(`${pending.requestId}:${code}`), 'hex');
        return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
      };
      if (!record || record.phone !== phoneNumber || record.scene !== 'login' || record.status !== 'sent') {
        return await isSending() ? sendingCode() : invalidCode();
      }
      if (record.used || !(new Date(record.expiredAt) > now)) {
        if (await isSending()) return sendingCode();
        return record.used
          ? { success: false, code: 'CODE_USED', message: '该验证码已使用，请重新获取' }
          : { success: false, code: 'CODE_EXPIRED', message: '验证码已过期，请重新获取' };
      }
      if (record.attempts >= 5) {
        if (await isSending()) return sendingCode();
        return { success: false, code: 'CODE_ATTEMPTS_EXCEEDED', message: '验证码错误次数过多，请重新获取' };
      }
      const expected = typeof record.codeHash === 'string' ? Buffer.from(record.codeHash, 'hex') : Buffer.alloc(0);
      const actual = Buffer.from(digest(`${record.requestId}:${code}`), 'hex');
      if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
        if (await isSending(true)) return sendingCode();
        const attempts = (record.attempts || 0) + 1;
        await ref.update({ data: { attempts } });
        return attempts >= 5
          ? { success: false, code: 'CODE_ATTEMPTS_EXCEEDED', message: '验证码错误次数过多，请重新获取' }
          : invalidCode();
      }
      await ref.update({ data: { used: true, usedAt: now } });
      return { success: true };
    });
    if (!verification.success) return verification;

    const userRes = await db.collection('users').where({ phoneNumber }).limit(2).get();
    if (userRes.data.length === 0) {
      return { success: false, code: 'PHONE_NOT_REGISTERED', message: '该手机号尚未注册，请先注册并绑定手机号' };
    }
    if (userRes.data.length > 1) {
      return { success: false, code: 'AMBIGUOUS_ACCOUNT', message: '手机号绑定多个账号，请使用 Poem ID 和密码登录' };
    }
    const userInfo = safeUser(userRes.data[0]);
    const currentOpenid = cloud.getWXContext().OPENID;
    const { needBindWechat } = await prepareWechatLogin(db, userRes.data[0], currentOpenid);
    await recordSuccessfulLogin({ db, user: userRes.data[0], event, context, wxContext: cloud.getWXContext(), loginMethod: 'sms' });
    return {
      success: true, message: '登录成功', userInfo, openid: userInfo._openid, currentOpenid,
      needBindWechat, isPhoneVerified: true
    };
  } catch (error) {
    if (error.code === 'LOGIN_AUDIT_UNAVAILABLE') return {
      success: false, code: error.code, message: '登录记录保存失败，验证码已使用，请重新获取验证码后重试'
    };
    console.error('[loginWithPhone] 登录失败:', error);
    return { success: false, code: 'LOGIN_ERROR', message: '登录失败，请重新获取验证码后重试' };
  }
};
