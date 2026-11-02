'use strict';
const assert = require('node:assert/strict');
const { COLLECTIONS, run } = require('./init-societies-db.cjs');

function fixture(initial = []) {
  const names = new Set(initial);
  const permissions = new Map();
  const calls = [];
  const manager = {
    database: {
      async listCollections(options) {
        calls.push({ type: 'list', ...options });
        return { Collections: [...names].slice(options.MgoOffset, options.MgoOffset + options.MgoLimit).map(CollectionName => ({ CollectionName })) };
      },
      async createCollection(name) {
        assert.ok(COLLECTIONS.includes(name));
        assert.ok(!names.has(name), 'must not recreate existing collection');
        calls.push({ type: 'create', name });
        names.add(name);
      }
    },
    commonService() {
      return { async call({ Action, Param }) {
        calls.push({ type: Action, ...Param });
        assert.equal(Param.EnvId, 'test-env');
        assert.ok(COLLECTIONS.includes(Param.CollectionName), 'never change unrelated collections');
        if (Action === 'ModifyDatabaseACL') {
          assert.equal(Param.AclTag, 'ADMINONLY');
          permissions.set(Param.CollectionName, Param.AclTag);
          return {};
        }
        assert.equal(Action, 'DescribeDatabaseACL');
        return { AclTag: permissions.get(Param.CollectionName) };
      } };
    }
  };
  return { names, permissions, calls, manager };
}

async function invoke(args, manager, overrides = {}) {
  const output = [];
  let factoryCalls = 0;
  const code = await run(args, {
    readConfig: () => ({ envId: 'test-env' }),
    createManager: async options => {
      factoryCalls++;
      assert.equal(options.envId, 'test-env');
      return manager;
    },
    log: line => output.push(line),
    error: line => output.push(line),
    ...overrides
  });
  return { code, factoryCalls, output: output.join('\n') };
}

async function main() {
  assert.equal(COLLECTIONS.length, 16);
  assert.equal(new Set(COLLECTIONS).size, 16);
  for (const args of [[], ['--help'], ['--env', 'test-env', '--region', 'ap-shanghai']]) {
    const result = await invoke(args);
    assert.equal(result.code, 0);
    assert.equal(result.factoryCalls, 0, 'preview/help must never authenticate or access cloud');
  }
  for (const args of [['--apply', '--env'], ['--apply', '--typo'], ['--apply', '--apply'], ['--apply', '--env', 'bad/env'], ['--apply', '--region', 'bad region']]) {
    const result = await invoke(args);
    assert.equal(result.code, 1);
    assert.equal(result.factoryCalls, 0);
  }
  const override = await invoke(['--env', 'test-env'], null, { readConfig: () => { throw Error('must not read config'); } });
  assert.equal(override.code, 0);

  const cloud = fixture(['users', 'posts', 'adminConfig', 'society_members']);
  const first = await invoke(['--apply'], cloud.manager);
  assert.equal(first.code, 0);
  assert.match(first.output, /新建 15，已有 1，权限验证 16\/16/);
  assert.equal(cloud.calls.filter(call => call.type === 'create').length, 15);
  assert.equal(cloud.permissions.size, 16);
  assert.equal(cloud.names.size, 19);
  const callCount = cloud.calls.length;
  const second = await invoke(['--apply'], cloud.manager);
  assert.equal(second.code, 0);
  assert.match(second.output, /新建 0，已有 16/);
  assert.equal(cloud.calls.slice(callCount).some(call => call.type === 'create'), false);

  const paginated = fixture([...Array.from({ length: 100 }, (_, i) => `other_${i}`), ...COLLECTIONS]);
  assert.equal((await invoke(['--apply'], paginated.manager)).code, 0);
  assert.deepEqual(paginated.calls.filter(call => call.type === 'list').map(call => call.MgoOffset), [0, 100]);
  assert.equal(paginated.calls.some(call => call.type === 'create'), false);

  // An auth/network listing failure must never be interpreted as an empty database.
  for (const code of ['AuthFailure', 'ETIMEDOUT']) {
    const broken = fixture();
    broken.manager.database.listCollections = async () => { throw Object.assign(Error('secret-token-and-request-body'), { code }); };
    const result = await invoke(['--apply'], broken.manager);
    assert.equal(result.code, 1);
    assert.equal(broken.calls.length, 0);
    assert.ok(result.output.includes(code));
    assert.ok(!result.output.includes('secret-token-and-request-body'));
  }
  const malformed = fixture();
  malformed.manager.database.listCollections = async () => ({});
  assert.equal((await invoke(['--apply'], malformed.manager)).code, 1);
  assert.equal(malformed.calls.length, 0);
  const repeating = fixture();
  repeating.manager.database.listCollections = async () => ({ Collections: Array.from({ length: 100 }, (_, i) => ({ CollectionName: `row_${i}` })) });
  assert.equal((await invoke(['--apply'], repeating.manager)).code, 1, 'repeated pagination must stop, not loop forever');
  assert.equal(repeating.calls.length, 0);

  // A successful create followed by ACL failure remains retryable without recreation.
  const interrupted = fixture();
  const service = interrupted.manager.commonService();
  interrupted.manager.commonService = () => ({ async call(request) {
    if (request.Action === 'ModifyDatabaseACL') throw Object.assign(Error('private-data'), { code: 'OperationDenied' });
    return service.call(request);
  } });
  const failed = await invoke(['--apply'], interrupted.manager);
  assert.equal(failed.code, 1);
  assert.match(failed.output, /新建 1，已有 0，就绪 0\/16/);
  assert.match(failed.output, /societies \/ permission/);
  assert.equal(interrupted.names.size, 1);
  interrupted.manager.commonService = () => service;
  const repaired = await invoke(['--apply'], interrupted.manager);
  assert.equal(repaired.code, 0);
  assert.match(repaired.output, /新建 15，已有 1，权限验证 16\/16/);
  assert.equal(interrupted.calls.filter(call => call.type === 'create' && call.name === 'societies').length, 1);

  const wrongAcl = fixture(COLLECTIONS);
  const realService = wrongAcl.manager.commonService();
  wrongAcl.manager.commonService = () => ({ async call(request) {
    return request.Action === 'DescribeDatabaseACL' ? { AclTag: 'READONLY' } : realService.call(request);
  } });
  const rejected = await invoke(['--apply'], wrongAcl.manager);
  assert.equal(rejected.code, 1);
  assert.match(rejected.output, /ACL_NOT_VERIFIED/);
  assert.match(rejected.output, /就绪 0\/16/);
  console.log('PASS society DB initializer: preview, validation, creation, pagination, repeat runs, ACL verification, failure recovery and log redaction');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
