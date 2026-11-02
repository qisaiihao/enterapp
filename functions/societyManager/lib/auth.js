'use strict';
const { createHash } = require('crypto');
const { read, error } = require('./common');

async function wechatUser(db, wxid) {
  const mapping = await read(db, 'wechat_bindings', createHash('sha256').update(wxid).digest('hex'));
  if (mapping) {
    const found = mapping.userId ? await read(db, 'users', mapping.userId) : null;
    return found && (found.wechatOpenId ? found.wechatOpenId === wxid : found._openid === wxid && found.wechatLoginDisabled !== true) ? found : null;
  }
  const bound = (await db.collection('users').where({ wechatOpenId: wxid }).limit(2).get()).data;
  if (bound.length === 1) return bound[0];
  if (bound.length) return null;
  const native = (await db.collection('users').where({ _openid: wxid }).limit(2).get()).data;
  return native.length === 1 && native[0].wechatLoginDisabled !== true && !native[0].wechatOpenId ? native[0] : null;
}

async function resolveUser(db, event, wxContext = {}, required = true) {
  let user = null;
  const clientOpenid = typeof event.openid === 'string' ? event.openid.trim() : '';
  const trustedOpenid = wxContext && typeof wxContext.OPENID === 'string' ? wxContext.OPENID : '';
  if (trustedOpenid) {
    const verified = await wechatUser(db, trustedOpenid);
    if (verified) {
      // A client-supplied account cannot override the verified WeChat identity.
      user = clientOpenid && clientOpenid !== verified._openid ? null : verified;
      if (!user && required) throw error('请先登录后再办理诗社事务', 'AUTH_REQUIRED');
      return user;
    }
  }
  // App/H5 calls authenticate with the account injected by cloudCall. The TCB runtime uid
  // is not a WeChat identity and may differ from the account's own _openid.
  if (clientOpenid) {
    const rows = (await db.collection('users').where({ _openid: clientOpenid }).limit(2).get()).data;
    if (rows.length === 1) user = rows[0];
  }
  if (!user && required) throw error('请先登录后再办理诗社事务', 'AUTH_REQUIRED');
  return user;
}

module.exports = { resolveUser };
