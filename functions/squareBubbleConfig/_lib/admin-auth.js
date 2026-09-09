const DEFAULT_ADMIN_POEM_IDS = ['qisaihao', 'jingmikun', 'ZOUHE', 'qwertyuioop'];
const CONFIG_COLLECTION = 'adminConfig';
const CONFIG_DOC_ID = 'admin';

let cachedConfig = {
  version: null,
  adminPoemIds: DEFAULT_ADMIN_POEM_IDS.slice(),
  loadedAt: 0
};

async function seedAdminConfig({ db, loggerPrefix }) {
  const seedData = {
    adminPoemIds: DEFAULT_ADMIN_POEM_IDS.slice(),
    version: 1,
    updatedAt: new Date()
  };
  await db.collection(CONFIG_COLLECTION).doc(CONFIG_DOC_ID).set({ data: seedData });
  console.log(`[${loggerPrefix}] 已初始化 adminConfig 配置文档`);
  return seedData;
}

async function loadAdminConfig({ db, loggerPrefix }) {
  try {
    const res = await db.collection(CONFIG_COLLECTION).doc(CONFIG_DOC_ID).get();
    const data = res && res.data;
    if (data && Array.isArray(data.adminPoemIds)) {
      cachedConfig = {
        version: data.version != null ? data.version : cachedConfig.version,
        adminPoemIds: data.adminPoemIds.slice(),
        loadedAt: Date.now()
      };
      return data;
    }
    const seeded = await seedAdminConfig({ db, loggerPrefix });
    cachedConfig = {
      version: seeded.version,
      adminPoemIds: seeded.adminPoemIds.slice(),
      loadedAt: Date.now()
    };
    return seeded;
  } catch (error) {
    console.error(`[${loggerPrefix}] 读取管理员配置失败，尝试初始化:`, error);
    try {
      const seeded = await seedAdminConfig({ db, loggerPrefix });
      cachedConfig = {
        version: seeded.version,
        adminPoemIds: seeded.adminPoemIds.slice(),
        loadedAt: Date.now()
      };
      return seeded;
    } catch (seedError) {
      console.error(`[${loggerPrefix}] 初始化管理员配置失败，使用缓存/默认名单兜底:`, seedError);
      return {
        adminPoemIds: cachedConfig.adminPoemIds,
        version: cachedConfig.version
      };
    }
  }
}

async function getAdminPoemIds({ db, loggerPrefix }) {
  const config = await loadAdminConfig({ db, loggerPrefix });
  return Array.isArray(config.adminPoemIds) ? config.adminPoemIds : [];
}

async function isAdminByPoemId({ db, command, openid, loggerPrefix = 'admin-auth' } = {}) {
  if (!db || !command || !openid) {
    return false;
  }

  try {
    const adminPoemIds = await getAdminPoemIds({ db, loggerPrefix });
    if (!adminPoemIds.length) {
      return false;
    }

    const result = await db.collection('users').where({
      _openid: openid,
      poemId: command.in(adminPoemIds)
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
    const adminPoemIds = await getAdminPoemIds({ db, loggerPrefix });
    if (!adminPoemIds.length) {
      return [];
    }

    const result = await db.collection('users').where({
      poemId: command.in(adminPoemIds)
    }).get();

    return Array.isArray(result.data) ? result.data : [];
  } catch (error) {
    console.error(`[${loggerPrefix}] 查询管理员用户失败:`, error);
    return [];
  }
}

module.exports = {
  ADMIN_POEM_IDS: DEFAULT_ADMIN_POEM_IDS,
  DEFAULT_ADMIN_POEM_IDS,
  getAdminPoemIds,
  isAdminByPoemId,
  listAdminUsersByPoemId
};