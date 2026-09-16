const { createHash } = require('crypto');

// 云函数独立部署：使用方的 _lib 副本须与本文件保持一致。
async function ensureDefaultPortfolio(db, openid, { isPublic = true } = {}) {
  if (!openid) throw new Error('缺少用户 openid');

  const folders = db.collection('portfolio_folders');
  const existing = await folders.where({ _openid: openid }).limit(1).get();
  if (existing.data.length > 0) {
    return { folder: existing.data[0], created: false };
  }

  const now = new Date();
  const folder = {
    // 注册与首次打开列表可能并发；固定 ID 的插入避免创建多个默认作品集。
    _id: `default_${createHash('sha256').update(openid).digest('hex').slice(0, 32)}`,
    _openid: openid,
    name: '我的作品集',
    description: '这是我的默认作品集',
    itemCount: 0,
    postCount: 0,
    items: [],
    createTime: now,
    updateTime: now,
    // 与当前列表按需创建的默认公开行为一致；显式私有补建入口可覆盖。
    isPublic,
    coverUrl: '',
    coverImage: '',
    tags: [],
    isDefault: true
  };

  try {
    await folders.add({ data: folder });
    return { folder, created: true };
  } catch (error) {
    // 并发插入或写入成功后响应丢失时复用记录，不能用 set 覆盖用户数据。
    const saved = await folders.where({ _id: folder._id, _openid: openid }).limit(1).get();
    if (saved.data.length > 0) return { folder: saved.data[0], created: false };
    throw error;
  }
}

module.exports = { ensureDefaultPortfolio };
