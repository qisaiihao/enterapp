// Shared identity helpers for user_id migration (dual-channel with _openid)
const cloud = require('wx-server-sdk');

// Do not call cloud.init() here; each function initializes its own env.
const db = cloud.database();
const _ = db.command;

function genUserId() {
  return 'u_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
}

async function ensureUserHasUserIdByDoc(userDoc) {
  if (!userDoc) return null;
  if (userDoc.user_id) return userDoc.user_id;
  const user_id = genUserId();
  try {
    await db.collection('users').doc(userDoc._id).update({ data: { user_id } });
  } catch (e) {
    // Best-effort; if update fails, try to read back latest document
  }
  return user_id;
}

async function findUserByPoemId(poemidOrPoemId) {
  if (!poemidOrPoemId) return null;
  const res = await db.collection('users')
    .where(_.or([{ poemId: poemidOrPoemId }, { poemid: poemidOrPoemId }]))
    .limit(1)
    .get();
  return res.data && res.data.length ? res.data[0] : null;
}

async function upsertWeappIdentity({ user_id, appid, openid }) {
  if (!user_id || !openid || !appid) return false;
  const coll = db.collection('user_identities');
  const exists = await coll.where({ provider: 'weapp', appid, subject_id: openid }).limit(1).get();
  if (exists.data && exists.data.length) return true;
  try {
    await coll.add({ data: { user_id, provider: 'weapp', appid, subject_id: openid, createdAt: Date.now() } });
    return true;
  } catch (e) {
    return false;
  }
}

async function resolveUserId({ userId, poemid, openid, appid }) {
  // Priority: explicit userId -> poemid -> weapp(openid)
  if (userId) return userId;

  if (poemid) {
    const userDoc = await findUserByPoemId(poemid);
    if (userDoc) return await ensureUserHasUserIdByDoc(userDoc);
  }

  if (openid) {
    if (appid) {
      const map = await db.collection('user_identities')
        .where({ provider: 'weapp', appid, subject_id: openid })
        .limit(1)
        .get();
      if (map.data && map.data.length) return map.data[0].user_id;
    }
    // Fallback to users._openid matching (legacy)
    const u = await db.collection('users').where({ _openid: openid }).limit(1).get();
    if (u.data && u.data.length) {
      const userDoc = u.data[0];
      const user_id = await ensureUserHasUserIdByDoc(userDoc);
      if (appid) await upsertWeappIdentity({ user_id, appid, openid });
      return user_id;
    }
  }

  return null;
}

function dualWriteUserRef(base = {}, { user_id, openid }) {
  const data = Object.assign({}, base);
  if (user_id) data.user_id = user_id;
  if (openid) data._openid = openid; // legacy compatibility
  return data;
}

module.exports = {
  genUserId,
  resolveUserId,
  dualWriteUserRef,
  upsertWeappIdentity,
  ensureUserHasUserIdByDoc
};

