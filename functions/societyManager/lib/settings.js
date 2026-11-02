'use strict';
const { hash, error, text, id, read, membership, activeSociety } = require('./common');
const { moderateBeforeWrite } = require('../_lib/moderation-gate');
const uploadPrefix = societyId => `societies/${hash('profile-files', societyId).slice(0, 32)}`;
async function updateSociety(db, cloud, user, event) {
  const societyId = id(event.societyId);
  const member = await membership(db, societyId, user._openid);
  if (member?.role !== 'owner' && member?.role !== 'admin') throw error('你没有诗社资料管理权限', 'FORBIDDEN');
  if (user.postingBanned === true) throw error('账号已被限制发布内容', 'FORBIDDEN');
  const form = event.form || {};
  const society = await activeSociety(db, societyId);
  if (form.recruitment !== undefined && form.recruitment !== '' && !['open', 'school'].includes(form.recruitment)) throw error('请选择有效的成员招募范围');
  const value = { name: text(form.name, 40, 2, '诗社名称'), region: text(form.region, 40, 1, '地区'),
    motto: text(form.motto || '', 60), description: text(form.description, 1000, 10, '简介'), avatarUrl: text(form.avatarUrl, 1000, 1, '头像'),
    recruitment: ['open', 'school'].includes(form.recruitment) ? form.recruitment : society.recruitment || 'open' };
  if (!value.avatarUrl.startsWith('cloud://') || !value.avatarUrl.includes(`/${uploadPrefix(societyId)}/avatar/`) && value.avatarUrl !== society.avatarUrl) throw error('头像地址无效');
  const audit = await moderateBeforeWrite(cloud, { title: value.name, content: `${value.motto}\n${value.description}`, images: [value.avatarUrl] });
  if (audit) throw error(audit.message, audit.code);
  return db.runTransaction(async tx => {
    const society = await activeSociety(tx, societyId);
    const current = await membership(tx, societyId, user._openid);
    if (!current || !['owner', 'admin'].includes(current.role)) throw error('管理权限已变化', 'FORBIDDEN');
    const nameKey = hash('name', society.school.replace(/\s/g, '').toLowerCase(), value.name.replace(/\s/g, '').toLowerCase());
    const oldKey = hash('name', society.school.replace(/\s/g, '').toLowerCase(), society.name.replace(/\s/g, '').toLowerCase());
    if (nameKey !== oldKey) {
      const reserved = await read(tx, 'society_names', nameKey);
      if (reserved && reserved.societyId !== societyId) throw error('该学校已有同名诗社');
      await tx.collection('society_names').doc(nameKey).set({ data: { societyId } });
      await tx.collection('society_names').doc(oldKey).remove();
    }
    await tx.collection('societies').doc(societyId).update({ data: { ...value, updatedAt: new Date() } });
    return { society: { ...society, ...value } };
  });
}
module.exports = { updateSociety, uploadPrefix };
