'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { connect, setup, config } = require('./app-versions/manager.cjs');
const root = path.resolve(__dirname, '..');
async function deploy() {
  execFileSync(process.execPath, ['scripts/sync-app-update.cjs', '--check'], { cwd: root });
  const { manager } = await connect();
  await setup(manager);
  const backupDir = path.join(root, 'unpackage/app-update-migration/deploy', new Date().toISOString().replace(/[:.]/g, '-'));
  fs.mkdirSync(backupDir, { recursive: true });
  const existing = await manager.functions.listFunctions(100, 0);
  const found = existing.find(row => row.FunctionName === 'checkAppUpdate');
  if (found) {
    const download = await manager.functions.getFunctionDownloadUrl('checkAppUpdate');
    const response = await fetch(download.Url);
    if (!response.ok) throw Error('旧腾讯云更新函数备份失败');
    fs.writeFileSync(path.join(backupDir, 'checkAppUpdate-before.zip'), Buffer.from(await response.arrayBuffer()));
  }
  const definition = require('../cloudbaserc.app-update.json').functions[0];
  await manager.functions.createFunction({
    func: { name: definition.name, runtime: definition.runtime, handler: definition.handler, timeout: definition.timeout,
      memorySize: definition.memory, installDependency: true, isWaitInstall: true },
    functionPath: path.join(root, 'functions/checkAppUpdate'), force: !!found
  });
  const routes = await manager.access.getAccessList({ path: '/app-update/check' });
  if (routes.APISet.some(route => route.Name !== 'checkAppUpdate')) throw Error('更新地址已被其他服务占用，未修改路由');
  if (!routes.APISet.length) await manager.access.createAccess({ path: '/app-update/check', name: 'checkAppUpdate', auth: false });
  const request = { appid: config.appid, platform: 'android', appVersion: '1.7.8', wgtVersion: '1.7.8', protocolVersion: 2 };
  const response = await fetch(config.checkUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request), signal: AbortSignal.timeout(30000) });
  const result = await response.json();
  if (!response.ok || result.updateSource !== 'cloudbase' || result.code < 0) throw Error('腾讯云 HTTP 更新入口验证失败');
  const direct = await manager.functions.invokeFunction('checkAppUpdate', request);
  if (direct.InvokeResult !== 0 || JSON.parse(direct.RetMsg).updateSource !== 'cloudbase') throw Error('腾讯云 SDK 更新入口验证失败');
  const verification = { envId: config.envId, checkedAt: new Date().toISOString(), http: result, sdk: JSON.parse(direct.RetMsg) };
  fs.writeFileSync(path.join(backupDir, 'verification.json'), JSON.stringify(verification, null, 2));
  console.log(JSON.stringify(verification));
}
if (require.main === module) deploy().catch(error => { console.error(error.code || error.message); process.exitCode = 1; });
module.exports = { deploy };
