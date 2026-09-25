// 官方素材库数据表初始化。使用本机已登录的 CloudBase CLI，不打印或复制任何凭证。
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const globalRoot = process.env.CLOUDBASE_GLOBAL_ROOT || (process.platform === 'win32' ? path.join(process.env.APPDATA, 'npm/node_modules') : execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim());
const cliRoot = path.join(globalRoot, '@cloudbase/cli');
const { authSupevisor } = require(path.join(cliRoot, 'lib/utils/auth.js'));
const CloudBase = require(path.join(cliRoot, 'node_modules/@cloudbase/manager-node'));
const envId = 'cloud1-5gb0pbyl400845f5';
const COLLECTIONS = ['collage_materials', 'collage_material_groups'];

async function main() {
  const auth = await authSupevisor.getLoginState();
  if (!auth?.secretId || !auth?.secretKey) throw new Error('请先执行 tcb login');
  const manager = new CloudBase({ envId, secretId: auth.secretId, secretKey: auth.secretKey, token: auth.token });
  const command = process.argv[2] || 'inspect';
  if (command === 'setup') {
    for (const name of COLLECTIONS) {
      await manager.database.createCollectionIfNotExists(name);
      // 客户端只通过云函数读取素材，数据表不允许客户端直连。
      await manager.commonService().call({ Action: 'ModifyDatabaseACL', Param: { EnvId: envId, CollectionName: name, AclTag: 'ADMINONLY' } });
      console.log(`${name}: ready, server access only`);
    }
  } else if (command === 'inspect') {
    for (const name of COLLECTIONS) {
      const exists = await manager.database.checkCollectionExists(name);
      console.log(`${name}: ${exists.Exists ? 'exists' : 'missing'}`);
    }
  } else {
    throw new Error('支持 setup、inspect');
  }
}
main().catch(error => { console.error(error.code || error.name, error.message); process.exitCode = 1; });
