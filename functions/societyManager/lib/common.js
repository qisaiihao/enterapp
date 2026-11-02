'use strict';
const { createHash } = require('crypto');
const hash = (...parts) => createHash('sha256').update(JSON.stringify(parts)).digest('hex');
const error = (message, code = 'INVALID_REQUEST') => Object.assign(new Error(message), { code });
function text(value, max = 100, min = 0, label = '内容') {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) throw error(`${label}需为${min}—${max}字`);
  return value.trim();
}
function id(value) { return text(value, 128, 1, '标识'); }
function page(event = {}) { return { skip: Math.min(10000, Math.max(0, Math.floor(Number(event.skip) || 0))), limit: Math.min(20, Math.max(1, Math.floor(Number(event.limit) || 12))) }; }
async function read(db, collection, documentId) {
  try { const result = await db.collection(collection).doc(documentId).get(); return result?.data || null; }
  catch (err) { if (/document with _id .+ does not exist/.test(String(err.errMsg || err.message))) return null; throw err; }
}
async function list(db, collection, filter, { skip = 0, limit = 20, order = 'createdAt' } = {}) {
  return (await db.collection(collection).where(filter).orderBy(order, 'desc').skip(skip).limit(limit).get()).data || [];
}
function pick(row, fields) { return Object.fromEntries(fields.filter(key => row[key] !== undefined).map(key => [key, row[key]])); }
function normalizedText(value) { return String(value || '').trim().toLowerCase(); }
function profileTextMatches(value, target) {
  const rowText = normalizedText(value);
  const profileText = normalizedText(target);
  if (!rowText || !profileText) return false;
  if (rowText === profileText) return true;
  return (profileText.length >= 2 && rowText.includes(profileText)) || (rowText.length >= 2 && profileText.includes(rowText));
}
function publicSociety(row) { return pick(row, ['_id', 'name', 'school', 'region', 'motto', 'description', 'avatarUrl', 'foundedAt', 'memberCount', 'workCount', 'eventCount', 'callCount', 'createdAt', 'recruitment']); }
async function activeSociety(db, societyId) {
  const row = await read(db, 'societies', id(societyId));
  if (!row || row.status !== 'active') throw error('诗社不存在或尚未开放', 'NOT_FOUND');
  return row;
}
const membershipId = (societyId, userId) => hash('member', societyId, userId);
async function membership(db, societyId, userId) {
  if (!userId) return null;
  const row = await read(db, 'society_members', membershipId(societyId, userId));
  return row?.status === 'active' ? row : null;
}
async function manager(db, societyId, user) {
  const [society, member] = await Promise.all([activeSociety(db, societyId), membership(db, societyId, user._openid)]);
  if (!member || !['owner', 'admin'].includes(member.role)) throw error('你没有这个诗社的管理权限', 'FORBIDDEN');
  return society;
}
async function platformAdmin(db, user) {
  // Fail closed if platform configuration is unavailable; never grant a role from client input.
  const config = await read(db, 'adminConfig', 'admin');
  if (!config || !Array.isArray(config.adminPoemIds) || !config.adminPoemIds.includes(user.poemId)) throw error('仅平台管理员可以审核入驻申请', 'FORBIDDEN');
}
module.exports = { hash, error, text, id, page, read, list, pick, publicSociety, activeSociety, membershipId, membership, manager, platformAdmin, profileTextMatches };
