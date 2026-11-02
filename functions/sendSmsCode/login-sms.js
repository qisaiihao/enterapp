const crypto = require('crypto');

const digest = value => crypto.createHash('sha256').update(value).digest('hex');

// 兼容旧版云函数 Node.js：使用安全随机字节，拒绝超出整倍数范围的值以避免取模偏差。
function generateLoginCode() {
  const range = 900000;
  const limit = 0x1000000 - (0x1000000 % range);
  let value;
  do {
    value = crypto.randomBytes(3).readUIntBE(0, 3);
  } while (value >= limit);
  return String(100000 + (value % range));
}

// 登录与找回密码分别保存验证码，共用发送配额；绑定验证码不能作为认证凭据。
module.exports = async function sendLoginSms({ db, phone, clientIP, config, createProvider, scene = 'login' }) {
  const id = `${scene}_${digest(phone)}`;
  const pendingId = `${id}_pending`;
  const code = generateLoginCode();
  const requestId = crypto.randomBytes(16).toString('hex');
  const provider = createProvider(config);
  const reservation = await db.runTransaction(async transaction => {
    const now = Date.now();
    // 待发送记录与可用验证码分开，发送失败不能使用户已收到的验证码失效。
    const ref = transaction.collection('sms_codes').doc(pendingId);
    // 配额记录不设置 expiredAt，避免验证码 TTL 清理后重置发送配额。
    const rateRef = transaction.collection('sms_codes').doc(`login_rate_${digest(phone)}`);
    const { data: previous } = await rateRef.get();
    const elapsed = previous ? now - new Date(previous.createdAt).getTime() : Infinity;
    if (elapsed < config.limits.sendInterval * 1000) {
      return { success: false, code: 'SEND_LIMIT_EXCEEDED', message: '请求过于频繁，请稍后再试',
        data: { remainTime: Math.ceil(config.limits.sendInterval - elapsed / 1000) } };
    }
    const sameDay = previous && now - new Date(previous.windowStartedAt).getTime() < 86400000;
    const sendCount = sameDay ? previous.sendCount : 0;
    if (sendCount >= config.limits.dailyLimitPerPhone) {
      return { success: false, code: 'SEND_LIMIT_EXCEEDED', message: '24小时内发送次数已达上限，请稍后再试' };
    }
    // 手机号和 IP 配额与验证码一起预占，阻止并发绕过发送间隔。
    let ipRef, ipRecord, sameHour;
    if (clientIP && clientIP !== 'unknown') {
      ipRef = transaction.collection('sms_codes').doc(`login_ip_${digest(clientIP)}`);
      ({ data: ipRecord } = await ipRef.get());
      sameHour = ipRecord && now - new Date(ipRecord.windowStartedAt).getTime() < 3600000;
      if (sameHour && ipRecord.sendCount >= config.limits.dailyLimitPerIP) {
        return { success: false, code: 'SEND_LIMIT_EXCEEDED', message: '请求过于频繁，请稍后再试' };
      }
    }
    await ref.set({ data: {
      phone, scene, requestId, codeHash: digest(`${requestId}:${code}`),
      status: 'sending', used: false, attempts: 0,
      createdAt: new Date(now), expiredAt: new Date(now + config.limits.codeExpireTime * 1000)
    } });
    await rateRef.set({ data: {
      scene: 'login-rate-limit', createdAt: new Date(now),
      windowStartedAt: sameDay ? previous.windowStartedAt : new Date(now), sendCount: sendCount + 1
    } });
    if (ipRef) {
      await ipRef.set({ data: {
        scene: 'login-rate-limit', windowStartedAt: sameHour ? ipRecord.windowStartedAt : new Date(now),
        sendCount: (sameHour ? ipRecord.sendCount : 0) + 1
      } });
    }
    return { success: true };
  });
  if (!reservation.success) return reservation;

  let sent;
  try {
    sent = await provider.sendVerificationCode(phone, code);
  } catch (_) {
    sent = { success: false };
  }
  // 确认发送成功后才替换可用验证码；旧请求迟到不能覆盖较新的请求。
  let activated;
  try {
    activated = await db.runTransaction(async transaction => {
      const pendingRef = transaction.collection('sms_codes').doc(pendingId);
      const { data: pending } = await pendingRef.get();
      if (!pending || pending.requestId !== requestId || pending.status !== 'sending') return false;
      await pendingRef.update({ data: { status: sent.success ? 'sent' : 'failed' } });
      if (!sent.success) return false;
      const now = new Date();
      await transaction.collection('sms_codes').doc(id).set({ data: {
        phone, scene, requestId, codeHash: pending.codeHash,
        status: 'sent', used: false, attempts: 0,
        createdAt: now, expiredAt: new Date(now.getTime() + config.limits.codeExpireTime * 1000)
      } });
      return true;
    });
  } catch (error) {
    console.error('[sendSmsCode] 验证码激活失败:', error.code || 'SMS_ACTIVATION_FAILED');
    return { success: false, code: 'SEND_FAILED', message: '验证码发送确认失败，请稍后重新获取' };
  }
  if (!activated) {
    return { success: false, code: 'SEND_FAILED', message: '验证码发送失败，请稍后重试' };
  }
  return { success: true, code: 'SUCCESS', message: '验证码已发送，请注意查收',
    data: { phone, expireTime: config.limits.codeExpireTime, remainTime: config.limits.sendInterval } };
};
