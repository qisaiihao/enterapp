const ADMIN_POEM_IDS = ['qisaihao', 'jingmikun', 'ZOUHE', 'qwertyuioop'];

async function isAdminByPoemId({ db, command, openid, loggerPrefix = 'admin-auth' } = {}) {
  if (!db || !command || !openid) {
    return false;
  }

  try {
    const result = await db.collection('users').where({
      _openid: openid,
      poemId: command.in(ADMIN_POEM_IDS)
    }).limit(1).get();

    return Array.isArray(result.data) && result.data.length > 0;
  } catch (error) {
    console.error(`[${loggerPrefix}] 管理员权限校验失败:`, error);
    return false;
  }
}

async function listAdminUsersByPoemId({ db, command, loggerPrefix = 'admin-auth' } = {}) {
  if (!db || !command) {
    return [];
  }

  try {
    const result = await db.collection('users').where({
      poemId: command.in(ADMIN_POEM_IDS)
    }).get();

    return Array.isArray(result.data) ? result.data : [];
  } catch (error) {
    console.error(`[${loggerPrefix}] 查询管理员用户失败:`, error);
    return [];
  }
}

module.exports = {
  ADMIN_POEM_IDS,
  isAdminByPoemId,
  listAdminUsersByPoemId
};
