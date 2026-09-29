const crypto = require('crypto');
const BINDINGS = 'wechat_bindings';
const GRANTS = 'wechat_binding_grants';
const GRANT_TTL_MS = 5 * 60 * 1000;
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const bindingId = wxid => digest(wxid);
const grantId = (wxid, userId) => digest(JSON.stringify([wxid, userId]));
const failure = (code, message, extra = {}) => Object.assign({ success: false, code, message }, extra);

function safeUser(user) {
  const result = Object.assign({}, user);
  ['password', 'passwordHash', 'passwordSalt', 'resetToken', 'accessToken', 'refreshToken'].forEach(key => delete result[key]);
  return result;
}

function linked(user, wxid) {
  if (!user || !wxid) return false;
  if (user.wechatOpenId) return user.wechatOpenId === wxid;
  return user._openid === wxid && user.wechatLoginDisabled !== true;
}

function credentialFingerprint(user, salt) {
  return digest(JSON.stringify([salt, user._id, user._openid, user.poemId,
    user.password || '', user.passwordHash || '', user.phoneNumber || '']));
}

async function readDoc(ref) {
  const result = await ref.get();
  return result && result.data || null;
}

// Called only after password/SMS verification. The grant is never returned to the client.
// This also supports 1.7.0's existing { poemId, forceRebind } binding request.
async function prepareWechatLogin(db, user, wxid) {
  const needBindWechat = !!wxid && !linked(user, wxid);
  if (needBindWechat) {
    const salt = crypto.randomBytes(16).toString('hex');
    await db.collection(GRANTS).doc(grantId(wxid, user._id)).set({ data: {
      purpose: 'bind-wechat', userId: user._id, wxid, salt,
      fingerprint: credentialFingerprint(user, salt), used: false,
      expiresAt: new Date(Date.now() + GRANT_TTL_MS)
    } });
  }
  return { needBindWechat, currentOpenid: wxid || null };
}

async function findLegacy(db, wxid) {
  const bound = await db.collection('users').where({ wechatOpenId: wxid }).limit(2).get();
  const native = await db.collection('users').where({ _openid: wxid }).limit(2).get();
  if (bound.data.length > 1 || native.data.length > 1) return { ambiguous: true };
  return { bound: bound.data[0] || null, native: native.data[0] || null };
}

function accountHint(user) {
  const hasPoemId = !!user.poemId;
  const hasPassword = !!(user.password || user.passwordHash);
  return { poemId: user.poemId || '', nickName: user.nickName || '', hasPoemId, hasPassword,
    canLogin: hasPoemId && hasPassword };
}

async function bindWechat(db, wxid, event = {}) {
  const poemId = typeof event.poemId === 'string' ? event.poemId.trim() : '';
  if (!wxid || !poemId) return failure('INVALID_BIND_REQUEST', '请在微信小程序登录后绑定');
  const targets = await db.collection('users').where({ poemId }).limit(2).get();
  if (targets.data.length !== 1) return failure('INVALID_BIND_TARGET', '账号不存在或标识重复，请重新登录');
  const targetId = targets.data[0]._id;
  const legacy = await findLegacy(db, wxid);
  if (legacy.ambiguous) return failure('AMBIGUOUS_WECHAT', '微信关联了重复账号，请联系管理员核查');

  return db.runTransaction(async tx => {
    const linkRef = tx.collection(BINDINGS).doc(bindingId(wxid));
    const link = await readDoc(linkRef);
    const targetRef = tx.collection('users').doc(targetId);
    const target = await readDoc(targetRef);
    if (!target || target.poemId !== poemId) return failure('BIND_AUTH_REQUIRED', '账号信息已变化，请重新登录后绑定');
    const ownerId = link ? link.userId : ((legacy.bound || (linked(legacy.native, wxid) ? legacy.native : null)) || {})._id;
    const owner = ownerId ? await readDoc(tx.collection('users').doc(ownerId)) : null;
    const original = legacy.native ? await readDoc(tx.collection('users').doc(legacy.native._id)) : null;
    if (ownerId && (!owner || !linked(owner, wxid))) return failure('BIND_STATE_CHANGED', '微信绑定状态已变化，请重新尝试');

    // Already bound to this same account: idempotent, no repeated warning or writes.
    if (ownerId === targetId && linked(target, wxid)) return { success: true, alreadyBound: true, isRebind: false };
    const proofRef = tx.collection(GRANTS).doc(grantId(wxid, targetId));
    const proof = await readDoc(proofRef);
    if (!proof || proof.used || proof.purpose !== 'bind-wechat' || proof.userId !== targetId || proof.wxid !== wxid ||
        !(new Date(proof.expiresAt).getTime() > Date.now()) || proof.fingerprint !== credentialFingerprint(target, proof.salt)) {
      return failure('BIND_AUTH_REQUIRED', '绑定凭据已失效，请重新使用密码或短信登录后绑定');
    }

    const oldCandidate = target.wechatOpenId || target._openid;
    const oldLinkRef = oldCandidate && oldCandidate !== wxid ? tx.collection(BINDINGS).doc(bindingId(oldCandidate)) : null;
    const oldLink = oldLinkRef ? await readDoc(oldLinkRef) : null;
    const oldWxid = oldLinkRef && (target.wechatOpenId || (oldLink && oldLink.userId === targetId)) ? oldCandidate : null;
    const originalConflict = original && original._id !== targetId && linked(original, wxid);
    const ownerConflict = owner && owner._id !== targetId;
    if (event.forceRebind !== true) {
      if (originalConflict) return failure('OPENID_CONFLICT', '当前微信已有注册账号', {
        conflictType: '_openid', conflictAccount: accountHint(original), targetWechatBound: !!oldWxid
      });
      if (ownerConflict || oldWxid) return failure('WECHAT_ALREADY_BOUND', '换绑前需要确认', {
        conflictType: ownerConflict ? 'wechatOpenId' : 'targetWechat',
        boundAccount: accountHint(ownerConflict ? owner : target), targetWechatBound: !!oldWxid
      });
    }

    // All reads precede writes; only doc operations are used inside CloudBase transactions.
    const now = new Date();
    const displaced = new Map();
    if (ownerConflict) displaced.set(owner._id, owner);
    if (originalConflict) displaced.set(original._id, original);
    for (const entry of displaced.values()) {
      const patch = { updatedAt: now };
      if (entry.wechatOpenId === wxid) patch.wechatOpenId = db.command.remove();
      if (entry._openid === wxid) patch.wechatLoginDisabled = true;
      await tx.collection('users').doc(entry._id).update({ data: patch });
    }
    if (oldWxid && (!oldLink || oldLink.userId === targetId)) {
      await oldLinkRef.set({ data: { userId: '', updatedAt: now } });
    }
    await targetRef.update({ data: { wechatOpenId: wxid, wechatLoginDisabled: false, updatedAt: now } });
    await linkRef.set({ data: { userId: targetId, updatedAt: now } });
    await proofRef.update({ data: { used: true, usedAt: now } });
    return { success: true, isRebind: !!(ownerConflict || originalConflict || oldWxid), message: '绑定成功' };
  });
}

async function wechatLogin(db, wxid) {
  if (!wxid) return failure('NO_WECHAT_IDENTITY', '获取微信用户标识失败，请从微信小程序登录');
  const legacy = await findLegacy(db, wxid);
  if (legacy.ambiguous) return failure('AMBIGUOUS_WECHAT', '微信关联了重复账号，请联系管理员核查');
  const newId = `wx_${digest(wxid)}`;
  let poemId = `wx_${digest(wxid).slice(0, 12)}`;
  // Only allocate an ID if registration might be needed; bound logins do not query this field.
  if (!legacy.bound && !legacy.native) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const existing = await db.collection('users').where({ poemId }).limit(1).get();
      if (!existing.data.length) break;
      if (attempt === 4) return failure('POEM_ID_CONFLICT', '暂时无法生成账号，请重试');
      poemId = `wx_${digest(wxid).slice(0, 8)}${crypto.randomBytes(4).toString('hex')}`;
    }
  }
  const outcome = await db.runTransaction(async tx => {
    const linkRef = tx.collection(BINDINGS).doc(bindingId(wxid));
    const link = await readDoc(linkRef);
    const legacyOwner = legacy.bound || (linked(legacy.native, wxid) ? legacy.native : null);
    const ownerId = link ? link.userId : legacyOwner && legacyOwner._id;
    if (ownerId) {
      const user = await readDoc(tx.collection('users').doc(ownerId));
      if (!linked(user, wxid)) return failure('BIND_STATE_CHANGED', '微信绑定状态已变化，请使用账号密码登录');
      // Lock the same mapping used by rebind: concurrent login cannot finalize an obsolete owner.
      await linkRef.set({ data: { userId: ownerId, updatedAt: new Date() } });
      return { success: true, user, isNewUser: false };
    }
    // A displaced native account must never silently reappear via _openid fallback.
    if (legacy.native) return failure('WECHAT_UNBOUND', '该微信的原账号已换绑，请使用 Poem ID 或手机号登录');
    const userRef = tx.collection('users').doc(newId);
    const prior = await readDoc(userRef);
    if (prior) return failure('BIND_STATE_CHANGED', '账号状态已变化，请使用账号密码登录');
    const now = new Date();
    const user = { _openid: wxid, wechatOpenId: wxid, poemId, nickName: '微信用户', avatarUrl: '',
      signature: '', isPhoneVerified: false, phoneNumber: '', showGrowthStats: false,
      createdAt: now, updatedAt: now, bio: '', occupation: '', region: '', followingCount: 0,
      fansCount: 0, likesCount: 0, postsCount: 0 };
    await userRef.set({ data: user });
    await linkRef.set({ data: { userId: newId, updatedAt: now } });
    return { success: true, user: Object.assign({ _id: newId }, user), isNewUser: true };
  });
  if (!outcome.success) return outcome;
  return { success: true, needRegister: false, isNewUser: outcome.isNewUser,
    userInfo: safeUser(outcome.user), openid: outcome.user._openid,
    isPhoneVerified: !!outcome.user.isPhoneVerified, isBoundAccount: outcome.user._openid !== wxid,
    ...(outcome.isNewUser ? { defaultPoemId: outcome.user.poemId } : {}) };
}

module.exports = { prepareWechatLogin, bindWechat, wechatLogin, safeUser, linked, bindingId, grantId, GRANT_TTL_MS };
