const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');

const root = path.resolve(__dirname, '..');
const quiet = { log() {}, warn() {}, error() {} };
const user = {
  _id: 'verified-user', _openid: 'verified-owner', poemId: 'verified-poet', nickName: '测试用户',
  password: 'private-password', phoneNumber: '13800138000', isPhoneVerified: true,
  passwordHash: 'private-password-hash', passwordSalt: 'private-password-salt',
  accessToken: 'private-access-token', refreshToken: 'private-refresh-token', resetToken: 'private-reset-token'
};
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const clientInfo = {
  platform: 'app', os: 'android', osVersion: '14', deviceModel: 'Test device', deviceBrand: 'Test brand',
  appVersion: '1.7.0', appVersionCode: '170', sdkVersion: '4.0', userAgent: 'Test agent'
};

// Run the actual cloud entry and its independently packaged helpers, with only the cloud SDK mocked.
function runtime(seed = [user], wxContext = { OPENID: user._openid }) {
  let tables = {
    users: Object.fromEntries(seed.map(item => [item._id, structuredClone(item)])),
    login_logs: {}, sms_codes: {},
    wechat_binding_grants: {}, wechat_bindings: {}, portfolio_folders: {}
  };
  let nextId = 0;
  const state = { failedCollection: '', writes: [] };
  const matches = (row, filter) => Object.entries(filter).every(([key, value]) => row[key] === value);
  function collection(name, tx) {
    assert.ok(Object.hasOwn(tables, name), `Unexpected collection ${name}`);
    const rows = () => (tx ? tx.tables : tables)[name];
    function write() {
      if (name === state.failedCollection) throw Error('injected audit persistence failure');
      state.writes.push(name);
    }
    const result = {
      doc(id) {
        return {
          async get() { return { data: structuredClone(rows()[id] || null) }; },
          async set({ data }) { write(); rows()[id] = { ...structuredClone(data), _id: id }; },
          async update({ data }) { write(); assert.ok(rows()[id]); Object.assign(rows()[id], structuredClone(data)); }
        };
      },
      async add({ data }) {
        write();
        const id = data._id || `record-${++nextId}`;
        if (rows()[id]) throw Error('duplicate id');
        rows()[id] = { ...structuredClone(data), _id: id };
        return { _id: id };
      },
      where(filter) {
        let limit = Infinity;
        const selected = () => Object.values(rows()).filter(row => matches(row, filter)).slice(0, limit);
        const query = {
          limit(value) { limit = value; return query; },
          async get() { return { data: structuredClone(selected()) }; },
          async update({ data }) { write(); const values = selected(); values.forEach(row => Object.assign(row, structuredClone(data))); return { stats: { updated: values.length } }; }
        };
        return query;
      }
    };
    return result;
  }
  const db = {
    collection: name => collection(name),
    serverDate: () => new Date(),
    async runTransaction(callback) {
      const tx = { tables: structuredClone(tables) };
      const outcome = await callback({ collection: name => collection(name, tx) });
      tables = tx.tables;
      return outcome;
    }
  };
  return {
    db, state,
    get tables() { return tables; },
    get logs() { return Object.values(tables.login_logs); },
    async call(name, event, context = {}) {
      const filename = path.join(root, 'functions', name, 'index.js');
      const localRequire = createRequire(filename);
      const module = { exports: {} };
      const cloud = { init() {}, database: () => db, getWXContext: () => wxContext };
      vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
        module, exports: module.exports, console: quiet, Buffer,
        require: id => id === 'wx-server-sdk' ? cloud : localRequire(id)
      }, { filename });
      return module.exports.main(event, context);
    },
    seedSms(code = '654321') {
      const requestId = 'private-sms-request';
      tables.sms_codes[`login_${digest(user.phoneNumber)}`] = {
        phone: user.phoneNumber, scene: 'login', status: 'sent', used: false, attempts: 0,
        requestId, codeHash: digest(`${requestId}:${code}`), expiredAt: new Date(Date.now() + 60000)
      };
      return code;
    }
  };
}

const events = {
  loginWithCredentials: app => ({ account: user.poemId, password: user.password }),
  loginWithPhone: app => ({ phoneNumber: user.phoneNumber, code: app.seedSms() }),
  loginWithWechat: () => ({}),
  registerUser: () => ({ poemId: 'new-poet', password: 'private-new-password', nickName: '新用户', phoneNumber: user.phoneNumber })
};
const methods = { loginWithCredentials: 'password', loginWithPhone: 'sms', loginWithWechat: 'wechat', registerUser: 'register' };

function assertPrivateDataAbsent(logs) {
  const serialized = JSON.stringify(logs);
  for (const secret of [user.password, user.phoneNumber, user.passwordHash, user.passwordSalt,
    user.accessToken, user.refreshToken, user.resetToken, 'private-new-password', '654321', 'private-client-token']) {
    assert.ok(!serialized.includes(secret), `Audit log leaked ${secret}`);
  }
  function inspect(value) {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      assert.ok(!/^(password|passwordHash|passwordSalt|phone|phoneNumber|code|token|accessToken|refreshToken|resetToken)$/i.test(key), `Audit log contains ${key}`);
      inspect(child);
    }
  }
  logs.forEach(inspect);
}

async function entryTests() {
  for (const name of Object.keys(events)) {
    const wx = { OPENID: name === 'registerUser' ? 'new-owner' : user._openid, CLIENTIP: '203.0.113.11', CLIENTPORT: 49152 };
    const app = runtime(name === 'registerUser' ? [] : [user], wx);
    const before = Date.now();
    const result = await app.call(name, {
      ...events[name](app), clientInfo,
      userId: 'forged-user', userOpenid: 'forged-owner', loginTime: '2000-01-01',
      clientIp: '192.0.2.200', sourcePort: 9, headers: { 'x-forwarded-for': '192.0.2.200' },
      accessToken: 'private-client-token'
    }, { requestId: 'trusted-request' });
    const after = Date.now();
    assert.equal(result.success, true, name);
    assert.equal(app.logs.length, 1, `${name} must write exactly one successful login`);
    const log = app.logs[0];
    assert.equal(log.schemaVersion, 1);
    assert.equal(log.userId, result.userInfo._id);
    assert.equal(log.userOpenid, result.openid);
    assert.equal(log.poemId, result.userInfo.poemId);
    assert.equal(log.loginMethod, methods[name]);
    assert.ok(new Date(log.loginTime).getTime() >= before && new Date(log.loginTime).getTime() <= after, 'login time comes from the server');
    assert.equal(log.network.clientIp, '203.0.113.11');
    assert.equal(log.network.sourcePort, 49152);
    assert.equal(log.requestId, 'trusted-request');
    assert.deepEqual(log.clientInfo, clientInfo);
    assert.equal(log.clientInfoSource, 'client_reported');
    assert.deepEqual(Object.keys(log).sort(), [
      '_id', 'schemaVersion', 'userId', 'userOpenid', 'poemId', 'loginTime', 'loginMethod',
      'clientInfo', 'clientInfoSource', 'cloudSource', 'network', 'requestId'
    ].sort(), 'only the audit schema may be persisted');
    assertPrivateDataAbsent(app.logs);
  }

  // Verification errors cannot create audit entries.
  const failures = [
    ['loginWithCredentials', [user], {}, { account: user.poemId, password: 'wrong' }],
    ['loginWithPhone', [user], {}, { phoneNumber: user.phoneNumber, code: '654321' }],
    ['loginWithWechat', [user], {}, { openid: user._openid }],
    ['registerUser', [user], { OPENID: 'new-owner' }, { ...events.registerUser(), poemId: user.poemId }]
  ];
  for (const [name, seed, wx, event] of failures) {
    const app = runtime(seed, wx);
    const result = await app.call(name, event);
    assert.equal(result.success, false, name);
    assert.equal(app.logs.length, 0, name);
  }

  // Fail closed if the required audit write fails, across every login route.
  for (const name of Object.keys(events)) {
    for (const failedCollection of ['login_logs']) {
      const app = runtime(name === 'registerUser' ? [] : [user], { OPENID: name === 'registerUser' ? 'new-owner' : user._openid });
      app.state.failedCollection = failedCollection;
      const result = await app.call(name, events[name](app));
      assert.equal(result.success, false, `${name}: ${failedCollection}`);
      assert.equal(result.code, 'LOGIN_AUDIT_UNAVAILABLE', `${name}: ${failedCollection}`);
      assert.equal(result.userInfo, undefined);
      assert.equal(app.logs.length, 0);
    }
  }

  // A legacy client needs no newly required request fields, and unavailable network data remains explicit.
  const old = runtime([user], {});
  assert.equal((await old.call('loginWithCredentials', { poemId: user.poemId, password: user.password })).success, true);
  assert.equal(old.logs.length, 1);
  assert.equal(old.logs[0].network.clientIp, null);
  assert.equal(old.logs[0].network.sourcePort, null);
  assert.deepEqual(old.logs[0].clientInfo, { ...Object.fromEntries(Object.keys(clientInfo).map(key => [key, ''])), platform: 'unknown' });

  const completing = runtime([{ _id: 'incomplete-user', _openid: 'completing-owner', poemId: 'old-poet', nickName: '旧昵称' }], { OPENID: 'completing-owner' });
  const completed = await completing.call('registerUser', { poemId: 'completed-poet', password: 'private-new-password', nickName: '完成注册' });
  assert.equal(completed.success, true);
  assert.equal(completing.logs.length, 1, 'completing an existing account is also an authenticated login');
  assert.equal(completing.logs[0].userId, 'incomplete-user');
  assert.equal(completing.logs[0].poemId, 'completed-poet');
  const newWechat = runtime([], { OPENID: 'fresh-wechat' });
  const newWechatResult = await newWechat.call('loginWithWechat', {});
  assert.equal(newWechatResult.success, true);
  assert.equal(newWechatResult.isNewUser, true);
  assert.equal(newWechat.logs.length, 1, 'automatic WeChat account creation records the completed login');
  assert.equal(newWechat.logs[0].userId, newWechatResult.userInfo._id);
}

async function networkTests() {
  const { recordSuccessfulLogin, trustedNetwork, runtimeEnvironment, normalizeClientInfo } = require('../functions/_shared/login-audit');
  async function network(wxContext, context = {}, event = {}) {
    const app = runtime();
    await recordSuccessfulLogin({ db: app.db, user, event, context, wxContext, loginMethod: 'password' });
    assert.equal(app.logs.length, 1);
    return app.logs[0].network;
  }
  for (const ip of ['203.0.113.1', '2001:db8::1', '::1', '::ffff:192.0.2.1']) {
    assert.equal((await network({ CLIENTIP: ip })).clientIp, ip);
  }
  for (const ip of ['203.0.113.999', 'not-an-ip', '203.0.113.1, 192.0.2.1', '2001:db8:::1', {}, 2130706433]) {
    assert.equal((await network({ CLIENTIP: ip })).clientIp, null, String(ip));
  }
  for (const port of [1, 80, 65535, '49152']) {
    assert.equal((await network({ CLIENTIP: '203.0.113.1', CLIENTPORT: port })).sourcePort, Number(port));
  }
  for (const port of [0, -1, 65536, 1.5, '443junk', '1e3', {}, true]) {
    assert.equal((await network({ CLIENTIP: '203.0.113.1', CLIENTPORT: port })).sourcePort, null, String(port));
  }
  assert.equal((await network({ CLIENTIP: '203.0.113.1' }, {}, { sourcePort: 443, clientPort: 443 })).sourcePort, null);
  const forged = await network({}, {}, { CLIENTIP: '192.0.2.1', CLIENTPORT: 443,
    clientIp: '192.0.2.1', sourcePort: 443, context: { CLIENTIP: '192.0.2.1' },
    headers: { 'x-forwarded-for': '192.0.2.1', 'x-real-ip': '192.0.2.1', 'x-client-port': '443' } });
  assert.equal(forged.clientIp, null);
  assert.equal(forged.sourcePort, null);

  assert.deepEqual(trustedNetwork({ CLIENTIPV6: '2001:db8::2', CLIENTPORT: '443' }, {}, {}), {
    clientIp: '2001:db8::2', sourcePort: 443, ipSource: 'wxContext.CLIENTIPV6', portSource: 'wxContext.CLIENTPORT'
  });
  const jsonContext = { environment: JSON.stringify({ TCB_SOURCE_IP: '192.0.2.1', TCB_SOURCE_PORT: '12345' }) };
  assert.deepEqual(trustedNetwork({}, jsonContext, {}), {
    clientIp: '192.0.2.1', sourcePort: 12345, ipSource: 'context.environment.TCB_SOURCE_IP', portSource: 'context.environment.TCB_SOURCE_PORT'
  });
  const legacyContext = { environ: 'WX_CLIENTIP=203.0.113.20;WX_CLIENTPORT=56789;OTHER=value=with=equals' };
  assert.equal(trustedNetwork({}, legacyContext, {}).sourcePort, 56789);
  assert.equal(trustedNetwork({}, legacyContext, {}).ipSource, 'context.environ.WX_CLIENTIP');
  assert.equal(trustedNetwork({}, legacyContext, {}).portSource, 'context.environ.WX_CLIENTPORT');
  assert.equal(runtimeEnvironment(legacyContext).OTHER, 'value=with=equals');
  assert.equal(trustedNetwork({}, { TCB_SOURCE_IP: '192.0.2.2', TCB_SOURCE_PORT: 80 }, {}).ipSource, 'context.TCB_SOURCE_IP');
  assert.equal(trustedNetwork({}, {}, { WX_CLIENTIP: '192.0.2.3', WX_CLIENTPORT: 8080 }).portSource, 'runtime.env.WX_CLIENTPORT');
  assert.equal(trustedNetwork({}, { environment: 'malformed-json', environ: 'WX_CLIENTIP=203.0.113.4;WX_CLIENTPORT=443' }, {}).clientIp, '203.0.113.4');
  assert.equal(trustedNetwork({ CLIENTIP: 'invalid' }, jsonContext, { WX_CLIENTIP: '192.0.2.3' }).clientIp, '192.0.2.1', 'skip invalid higher-priority addresses');
  assert.equal(trustedNetwork({}, { environment: JSON.stringify({ TCB_SOURCE_IP: '192.0.2.1' }), TCB_SOURCE_IP: '192.0.2.2' }, { TCB_SOURCE_IP: '192.0.2.3' }).clientIp, '192.0.2.1');
  const sameProvider = trustedNetwork({ CLIENTIP: '203.0.113.1' }, { TCB_SOURCE_IP: '192.0.2.2', TCB_SOURCE_PORT: 80 }, {});
  assert.equal(sameProvider.clientIp, '203.0.113.1');
  assert.equal(sameProvider.sourcePort, null, 'do not attach a lower-priority provider port to another IP');
  assert.equal(trustedNetwork({}, { environment: JSON.stringify({ WX_CLIENTIP: '192.0.2.4', TCB_SOURCE_PORT: 8080 }) }, {}).sourcePort, null, 'do not mix WX and TCB network fields');
  assert.equal(trustedNetwork({}, { PORT: 443, serverPort: 443 }, {}).sourcePort, null, 'destination ports are not client source ports');

  const sanitized = normalizeClientInfo({
    ...clientInfo, platform: 'invented-platform', os: '  android\u0000\n ',
    userAgent: 'x'.repeat(600), deviceModel: { value: 'not a string' },
    password: 'private-password', phoneNumber: user.phoneNumber, token: 'private-client-token', arbitrary: 'ignored'
  });
  assert.equal(sanitized.platform, 'unknown');
  assert.equal(sanitized.os, 'android');
  assert.equal(sanitized.userAgent.length, 512);
  assert.equal(sanitized.deviceModel, '');
  assert.deepEqual(Object.keys(sanitized).sort(), Object.keys(clientInfo).sort());
  assertPrivateDataAbsent([sanitized]);
  const limits = { os: 32, osVersion: 64, deviceModel: 128, deviceBrand: 64, appVersion: 64, appVersionCode: 32, sdkVersion: 64, userAgent: 512 };
  const tooLong = normalizeClientInfo(Object.fromEntries(Object.keys(limits).map(key => [key, 'x'.repeat(1024)])));
  for (const [key, limit] of Object.entries(limits)) assert.equal(tooLong[key].length, limit, key);
  for (const value of [null, [], 'invalid-client-info', 1]) {
    assert.deepEqual(normalizeClientInfo(value), oldClientInfo(), 'malformed client metadata is optional');
  }
  function oldClientInfo() { return { ...Object.fromEntries(Object.keys(clientInfo).map(key => [key, ''])), platform: 'unknown' }; }
}

async function packagingTests() {
  for (const helper of ['login-audit']) {
    const source = fs.readFileSync(path.join(root, 'functions/_shared', `${helper}.js`), 'utf8');
    for (const name of [...Object.keys(events), 'github-auth']) {
      assert.equal(fs.readFileSync(path.join(root, 'functions', name, '_lib', `${helper}.js`), 'utf8'), source,
        `${name} must package the canonical ${helper} helper`);
    }
    assert.equal(fs.readFileSync(path.join(root, '回车键新网站/cloudfunctions/webReader/_lib', `${helper}.js`), 'utf8'), source,
      `webReader must package the canonical ${helper} helper`);
  }
}

async function databaseApiTests() {
  const { recordSuccessfulLogin } = require('../functions/_shared/login-audit');
  // Both SDKs are used by production login entries and have different add/response shapes.
  for (const databaseApi of [undefined, 'wx', 'cloudbase']) {
    const logs = [];
    let writes = 0;
    const direct = databaseApi === 'cloudbase';
    const db = { collection(name) {
      assert.equal(name, 'login_logs');
      return { async add(request) {
        writes++;
        const row = direct ? request : request.data;
        if (direct) assert.equal(Object.hasOwn(request, 'data'), false, 'CloudBase add requires a direct document');
        else assert.deepEqual(Object.keys(request), ['data'], 'WeChat add requires a data wrapper');
        assert.equal(row.schemaVersion, 1);
        assert.equal(row.userId, user._id);
        assert.equal(Object.hasOwn(row, 'data'), false);
        logs.push(structuredClone(row));
        return direct ? { id: 'cloudbase-log-id' } : { _id: 'wx-log-id' };
      } };
    } };
    const id = await recordSuccessfulLogin({ db, user, event: { clientInfo }, loginMethod: 'password', databaseApi });
    assert.equal(id, direct ? 'cloudbase-log-id' : 'wx-log-id', 'support each SDK document ID response');
    assert.equal(writes, 1);
    assert.equal(logs.length, 1);
    assert.deepEqual(Object.keys(logs[0]).sort(), [
      'schemaVersion', 'userId', 'userOpenid', 'poemId', 'loginTime', 'loginMethod',
      'clientInfo', 'clientInfoSource', 'cloudSource', 'network', 'requestId'
    ].sort());
    assertPrivateDataAbsent(logs);

    let failedWrites = 0;
    const failedDb = { collection(name) {
      assert.equal(name, 'login_logs');
      return { async add(request) {
        failedWrites++;
        if (direct) assert.equal(Object.hasOwn(request, 'data'), false);
        else assert.deepEqual(Object.keys(request), ['data']);
        throw Error('private-client-token database failure');
      } };
    } };
    await assert.rejects(recordSuccessfulLogin({ db: failedDb, user, loginMethod: 'password', databaseApi }), error => {
      assert.equal(error.code, 'LOGIN_AUDIT_UNAVAILABLE');
      assert.equal(error.message, '登录记录保存失败，请稍后重试');
      assert.ok(!error.message.includes('private-client-token'));
      return true;
    });
    assert.equal(failedWrites, 1);
  }
}

(async () => {
  await packagingTests();
  await entryTests();
  await networkTests();
  await databaseApiTests();
  console.log('Login audit tests passed: all login routes, server identity/time/network, sensitive data exclusion, fail-closed writes, both database SDKs, IP/port validation and legacy clients.');
})().catch(error => { console.error(error); process.exitCode = 1; });
