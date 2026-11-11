'use strict';
const fs = require('node:fs');
const path = require('node:path');
const config = require('./config.json');
const bucket = '636c-cloud1-5gb0pbyl400845f5-1378788263';
async function protectArtifact(manager, cloudPath) {
  if (!/^app-updates\/[A-Za-z0-9_./-]+$/.test(cloudPath)) throw Error('安装包存储路径无效');
  const params = { EnvId: config.envId, Bucket: bucket };
  const existing = await manager.commonService().call({ Action: 'DescribeStorageSafeRule', Param: params });
  const rule = JSON.parse(existing.Rule);
  // CloudBase does not support negated regex rules. Protect immutable object
  // keys explicitly, without changing write access anywhere else in the app.
  const guard = `resource.path != '${cloudPath}'`;
  if (String(rule.write).includes(guard)) return;
  const dir = path.resolve(__dirname, '../../unpackage/app-update-migration/storage-rules');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${Date.now()}.json`), JSON.stringify(existing, null, 2));
  const next = { ...rule, write: `(${rule.write}) && ${guard}` };
  await manager.commonService().call({ Action: 'ModifyStorageSafeRule', Param: { ...params, AclTag: 'CUSTOM', Rule: JSON.stringify(next) } });
  const check = await manager.commonService().call({ Action: 'DescribeStorageSafeRule', Param: params });
  if (JSON.parse(check.Rule).write !== next.write) throw Error('安装包写保护回读失败');
}
async function removeProbeRules(manager, paths) {
  if (paths.some(key => !/^app-updates\/verification-[0-9a-f-]{36}\.txt$/.test(key))) throw Error('仅允许清理本工具的随机验证规则');
  const params = { EnvId: config.envId, Bucket: bucket };
  const existing = await manager.commonService().call({ Action: 'DescribeStorageSafeRule', Param: params });
  const rule = JSON.parse(existing.Rule);
  const guards = [];
  let base = rule.write;
  let match;
  // Unwrap only the exact expression shape produced above, preserving any
  // pre-existing business expression and every real package protection.
  while ((match = /^\(([\s\S]*)\) && resource\.path != '(app-updates\/[^']+)'$/.exec(base))) {
    guards.unshift(match[2]); base = match[1];
  }
  const write = guards.filter(key => !paths.includes(key)).reduce((value, key) => `(${value}) && resource.path != '${key}'`, base);
  if (write === rule.write) return;
  const dir = path.resolve(__dirname, '../../unpackage/app-update-migration/storage-rules');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${Date.now()}-probe-cleanup.json`), JSON.stringify(existing, null, 2));
  await manager.commonService().call({ Action: 'ModifyStorageSafeRule', Param: { ...params, AclTag: 'CUSTOM', Rule: JSON.stringify({ ...rule, write }) } });
  const check = await manager.commonService().call({ Action: 'DescribeStorageSafeRule', Param: params });
  if (JSON.parse(check.Rule).write !== write) throw Error('验证规则清理回读失败');
}
module.exports = { protectArtifact, removeProbeRules };
