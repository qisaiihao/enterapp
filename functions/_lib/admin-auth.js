const ADMIN_POEM_IDS = ['qisaihao', 'jingmikun', 'ZOUHE', 'qwertyuiop'];
const NORMALIZED_ADMIN_POEM_IDS = new Set(
  ADMIN_POEM_IDS.map((item) => String(item || '').trim().toLowerCase()).filter(Boolean)
);

async function isAdminByPoemId({ db, command, openid, loggerPrefix = 'admin-auth' } = {}) {
  if (!db || !openid) {
    return false;
  }

  try {
    const result = await db.collection('users').where({
      _openid: openid
    }).limit(1).get();
    const user = Array.isArray(result.data) && result.data.length ? result.data[0] : null;
    const poemId = String((user && user.poemId) || '').trim().toLowerCase();
    return !!poemId && NORMALIZED_ADMIN_POEM_IDS.has(poemId);
  } catch (error) {
    console.error(`[${loggerPrefix}] 管理员权限校验失败:`, error);
    return false;
  }
}

module.exports = {
  ADMIN_POEM_IDS,
  isAdminByPoemId
};
