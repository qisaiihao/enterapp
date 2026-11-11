'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { connect, list } = require('./app-versions/manager.cjs');
const root = path.resolve(__dirname, '..');
async function protect() {
  const { manager, db } = await connect();
  const dir = path.join(root, 'unpackage/app-update-migration/storage-protection', Date.now().toString());
  fs.mkdirSync(dir, { recursive: true });
  for (const row of await list(db)) {
    if (row.artifact?.cloudPath) await require('./app-versions/storage-protection.cjs').protectArtifact(manager, row.artifact.cloudPath);
  }
  // Server SDK bypasses storage rules. Apply just the directory guard to the
  // downloaded live code, preserving any unrelated production-only changes.
  for (const name of ['upload', 'uploadAvatar', 'uploadCollagePoetry']) {
    const info = await manager.functions.getFunctionDetail(name);
    const download = await manager.functions.getFunctionDownloadUrl(name);
    const response = await fetch(download.Url);
    if (!response.ok) throw Error(`备份失败：${name}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(path.join(dir, `${name}-before.zip`), bytes);
    const zip = new (require('adm-zip'))(bytes);
    const stage = path.join(dir, name);
    fs.mkdirSync(stage, { recursive: true });
    for (const entry of zip.getEntries()) {
      const dest = path.resolve(stage, entry.entryName);
      if (!dest.startsWith(stage + path.sep)) throw Error('备份文件路径异常');
      if (entry.isDirectory) fs.mkdirSync(dest, { recursive: true });
      else { fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.writeFileSync(dest, entry.getData()); }
    }
    const index = path.join(stage, 'index.js');
    let code = fs.readFileSync(index, 'utf8');
    if (!code.includes("require('./release-path')")) {
      const pattern = /exports\.main\s*=\s*async\s*\(event, context\)\s*=>\s*\{/;
      if (!pattern.test(code)) throw Error(`未知入口结构：${name}`);
      code = code.replace(pattern, match => match + "\n  if (require('./release-path')(event.cloudPath)) return { success: false, code: 'RELEASE_PATH_RESERVED', message: '安装包只能通过版本管理工具上传' };\n");
      fs.writeFileSync(index, code);
    }
    fs.copyFileSync(path.join(root, 'functions', name, 'release-path.js'), path.join(stage, 'release-path.js'));
    await manager.functions.updateFunctionCode({ func: { name, runtime: info.Runtime, handler: info.Handler, installDependency: true, isWaitInstall: true }, functionPath: stage });
    const result = await manager.functions.invokeFunction(name, { cloudPath: 'app-updates/blocked-probe.apk' });
    if (result.InvokeResult !== 0 || JSON.parse(result.RetMsg).code !== 'RELEASE_PATH_RESERVED') throw Error(`目录保护验证失败：${name}`);
    console.log(`${name}: 安装包目录已保护`);
  }
  console.log('版本包文件已写保护，通用上传禁止写入发布目录；现有业务文件规则保留');
}
if (require.main === module) protect().catch(error => { console.error(error.code || error.message); process.exitCode = 1; });
