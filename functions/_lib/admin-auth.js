const ADMIN_POEM_IDS = ['qisaihao', 'jingmikun', 'ZOUHE'];

async function isAdminByPoemId({ db, command, openid, loggerPrefix = 'admin-auth' } = {}) {
  if (!db || !command || !openid) {
    return false;
  }

  try {
    const result = await db.collection('users').where({
      _openid: openid,
      poemId: command.in(ADMIN_POEM_IDS)
    }).get();

    return Array.isArray(result.data) && result.data.length > 0;
  } catch (error) {
    console.error(`[${loggerPrefix}] 管理员权限校验失败:`, error);
    return false;
  }
}

module.exports = {
  ADMIN_POEM_IDS,
  isAdminByPoemId
};
