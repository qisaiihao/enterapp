const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
(async () => {
  const cli = createRequire(path.join(process.env.APPDATA, 'npm/node_modules/@cloudbase/cli/package.json'));
  const auth = await cli('./lib/utils/auth.js').authSupevisor.getLoginState();
  if (!auth || !auth.secretId || !auth.secretKey) throw Error('TCB CLI 未登录');
  const { envId } = require('../../cloudbaserc.json');
  const Manager = cli('@cloudbase/manager-node');
  const manager = new Manager({ envId, secretId: auth.secretId, secretKey: auth.secretKey, token: auth.token });
  const before = path.join(__dirname, 'cloud-before');
  const after = path.join(__dirname, 'cloud-after');
  const config = require('./configuration.json');
  const probe = { openid: '__home_runtime_readonly_probe__', limit: 3, skip: 0 };
  async function invoke(params) {
    const response = await manager.functions.invokeFunction('getPostList', { ...probe, ...params });
    assert.equal(response.InvokeResult, 0, '云函数执行失败');
    return JSON.parse(response.RetMsg);
  }
  if (process.argv[2] === 'prepare') {
    const result = await invoke({ isPoem: true, isOriginal: true });
    assert.equal(result.success, false);
    assert.match(result.error.message, /Object.fromEntries is not a function/);
    console.log('Cloud failure reproduced: Object.fromEntries is not a function');
    assert.ok(!fs.existsSync(after), '部署目录已经存在');
    fs.cpSync(before, after, { recursive: true });
    const oldQuery = fs.readFileSync(path.join(before, '_lib/posts/query.js'), 'utf8');
    const fixedQuery = fs.readFileSync(path.join(__dirname, '../../functions/_shared/posts/query.js'), 'utf8');
    assert.ok(oldQuery.includes('return Object.fromEntries('));
    fs.writeFileSync(path.join(after, '_lib/posts/query.js'), fixedQuery);
    console.log('Prepared one-file patch on the backed-up cloud package, preserving installed dependencies.');
  } else if (process.argv[2] === 'deploy') {
    assert.ok(fs.existsSync(path.join(after, '_lib/posts/query.js')));
    await manager.functions.updateFunctionCode({
      func: { name: 'getPostList', runtime: config.runtime, handler: config.handler, installDependency: false },
      functionPath: after
    });
    console.log('getPostList code update submitted.');
  } else if (process.argv[2] === 'verify') {
    const detail = await manager.functions.getFunctionDetail('getPostList');
    assert.equal(detail.Status, 'Active');
    assert.equal(detail.Runtime, config.runtime);
    assert.equal(detail.Timeout, config.timeout);
    assert.equal(detail.MemorySize, config.memory);
    const checks = [];
    for (const params of [{ isPoem: true, isOriginal: true }, { homeRanking: true },
      { homeRanking: true, skip: 3 }, { isPoem: false, isDiscussion: false }]) {
      const result = await invoke(params);
      assert.equal(result.success, true, JSON.stringify(result.error || result.code));
      assert.ok(Array.isArray(result.posts));
      assert.ok(result.posts.length <= probe.limit);
      checks.push({ params, success: true, count: result.posts.length });
    }
    const evidence = { verifiedAt: new Date().toISOString(), runtime: detail.Runtime, checks };
    fs.writeFileSync(path.join(__dirname, 'verification.json'), JSON.stringify(evidence, null, 2));
    console.log(JSON.stringify(evidence));
  } else throw Error('Expected prepare/deploy/verify');
})().catch(error => { console.error(error.code || error.name, error.message); process.exitCode = 1; });
