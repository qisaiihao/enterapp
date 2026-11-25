'use strict';
const fs = require('node:fs');
const path = require('node:path');
const config = require('./config.json');
const bucket = '636c-cloud1-5gb0pbyl400845f5-1378788263';
const packageDirectory = 'app-updates/';
// CloudBase can't negate test(). Match paths that end before the full prefix
// or differ from it at the first mismatched character.
const alternatives = Array.from(packageDirectory, (character, index) => {
  const shared = packageDirectory.slice(0, index);
  const different = character === '/' ? '\\/' : character;
  return `^${shared}$|^${shared}[^${different}]`;
}).join('|');
const directoryGuard = `/${alternatives}/.test(resource.path)`;
const legacyGuard = /^\(([\s\S]*)\) && resource\.path != 'app-updates\/[A-Za-z0-9_./-]+'$/;

function protectedWriteRule(write) {
  if (typeof write !== 'boolean' && (typeof write !== 'string' || !write.trim())) throw Error('云存储写入规则格式无效');
  let base = write;
  let match;
  while ((match = legacyGuard.exec(base))) base = match[1];
  // The legacy uploader added this chain to the shared bucket's public rule.
  // Carry other policies forward verbatim when applying the directory guard.
  if (base === true || base === 'true') return directoryGuard;
  const withGuard = `${directoryGuard} && (`;
  if (write === directoryGuard || (typeof write === 'string' && write.startsWith(withGuard) && write.endsWith(')'))) return write;
  return `${withGuard}${write})`;
}

async function ensurePackageProtection(manager) {
  const params = { EnvId: config.envId, Bucket: bucket };
  const api = manager.commonService();
  const existing = await api.call({ Action: 'DescribeStorageSafeRule', Param: params });
  const rule = JSON.parse(existing.Rule);
  const write = protectedWriteRule(rule.write);
  if (write === rule.write) return;
  const dir = path.resolve(__dirname, '../../unpackage/app-update-migration/storage-rules');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${Date.now()}-directory.json`), JSON.stringify(existing, null, 2));
  await api.call({ Action: 'ModifyStorageSafeRule', Param: { ...params, AclTag: 'CUSTOM', Rule: JSON.stringify({ ...rule, write }) } });
  const check = JSON.parse((await api.call({ Action: 'DescribeStorageSafeRule', Param: params })).Rule);
  if (check.write !== write || check.read !== rule.read) throw Error('安装包写保护回读失败');
}
module.exports = { ensurePackageProtection, protectedWriteRule, packageDirectory };
