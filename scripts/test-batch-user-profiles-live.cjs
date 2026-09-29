// 手动运行的线上只读验收；使用现有 TCB 登录，不输出凭证或用户资料。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const root = path.join(__dirname, '..');

(async () => {
  const cliRoot = process.env.CLOUDBASE_CLI_ROOT || path.join(process.env.APPDATA, 'npm/node_modules/@cloudbase/cli');
  const cliRequire = createRequire(path.join(cliRoot, 'package.json'));
  const { authSupevisor } = cliRequire('./lib/utils/auth.js');
  const auth = await authSupevisor.getLoginState();
  if (!auth?.secretId || !auth?.secretKey) throw new Error('TCB CLI 未登录');
  const CloudBase = cliRequire('@cloudbase/manager-node');
  const { envId } = require('../cloudbaserc.json');
  const manager = new CloudBase({ envId, secretId: auth.secretId, secretKey: auth.secretKey, token: auth.token });
  const functionName = 'getBatchUserProfiles';
  const detail = await manager.functions.getFunctionDetail(functionName);
  assert.equal(detail.Status, 'Active');
  const evidence = {
    verifiedAt: new Date().toISOString(), envId, functionName,
    configuration: { runtime: detail.Runtime, handler: detail.Handler, timeout: detail.Timeout, memory: detail.MemorySize },
    checks: []
  };
  async function invoke(params) {
    const response = await manager.functions.invokeFunction(functionName, params);
    assert.equal(response.InvokeResult, 0, '云函数执行失败');
    return JSON.parse(response.RetMsg);
  }
  assert.equal((await invoke({ userIds: ['probe'] })).code, 'NO_OPENID');
  evidence.checks.push('unauthenticated rejected');

  const { EnvInfo } = await manager.env.getEnvInfo();
  const tag = EnvInfo?.Databases?.[0]?.InstanceId;
  assert.ok(tag);
  const query = await manager.commonService('flexdb').call({ Action: 'Query', Param: {
    TableName: 'users', Tag: tag, MgoQuery: JSON.stringify({ _openid: { $exists: true } }),
    MgoProjection: JSON.stringify({ _id: 0, _openid: 1 }), MgoLimit: 65, MgoOffset: 0
  } });
  const rows = typeof query.Data === 'string' ? JSON.parse(query.Data) : query.Data;
  const ids = [...new Set(rows.map(row => (typeof row === 'string' ? JSON.parse(row) : row)._openid).filter(Boolean))];
  assert.ok(ids.length > 0, '没有可验证的用户记录');
  const allowed = new Set(['_id', '_openid', 'avatarUrl', 'avatarFileID', 'nickName', 'bio']);
  for (const rawAvatar of [true, false]) {
    const response = await invoke({ openid: ids[0], userIds: ids, rawAvatar });
    assert.equal(response.success, true);
    assert.equal(new Set(response.userProfiles.map(user => user._openid)).size, ids.length);
    assert.ok(response.userProfiles.every(user => Object.keys(user).every(key => allowed.has(key))), '发现非公开字段');
    const cloudAvatars = response.userProfiles.filter(user => user.avatarFileID);
    assert.ok(cloudAvatars.every(user => rawAvatar ? user.avatarUrl === user.avatarFileID : /^https?:\/\//.test(user.avatarUrl)));
    evidence.checks.push({ mode: rawAvatar ? 'raw' : 'legacy', users: response.userProfiles.length, cloudAvatars: cloudAvatars.length, publicFieldsOnly: true });
  }
  const missing = await invoke({ openid: ids[0], userIds: ['__codex_missing_profile_probe__'] });
  assert.equal(missing.success, true);
  assert.equal(missing.userProfiles.length, 0);
  assert.equal((await invoke({ openid: ids[0], userIds: Array.from({ length: 101 }, (_, i) => `probe-${i}`) })).success, false);
  evidence.checks.push('missing user returns empty; oversized request rejected');
  const outputDir = path.join(root, 'output/logic-optimization-20260928');
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, 'cloud-verification.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log(JSON.stringify(evidence, null, 2));
})().catch(error => { console.error(error.code || error.name, error.message); process.exitCode = 1; });
