const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const filename = path.join(root, 'functions/github-auth/index.js');
const quiet = { log() {}, warn() {}, error() {} };
const githubId = 123456;
const githubOpenid = `github_${githubId}`;
const privateCode = 'private-oauth-code';
const privateToken = 'private-oauth-access-token';
const privateEmail = 'private-github-email@example.test';
const user = {
  _id: 'registered-github-user', _openid: githubOpenid, poemId: 'registered-poet',
  password: 'private-password', accessToken: 'private-stored-token',
  githubEmail: privateEmail, phoneNumber: '13800138000'
};

// Exercise the HTTP callback entry with the real independently packaged audit helper.
// Only GitHub requests and the cloud SDK/database are replaced.
function runtime(seed = [user], { failAudit = false } = {}) {
  const users = seed.map(item => structuredClone(item));
  const logs = [];
  const state = { auditAttempts: 0, userUpdates: 0, queries: [] };
  const db = {
    collection(name) {
      assert.ok(['users', 'login_logs'].includes(name), `Unexpected collection ${name}`);
      if (name === 'login_logs') return {
        // @cloudbase/node-sdk adds the document directly, unlike wx-server-sdk.
        async add(data) {
          state.auditAttempts++;
          assert.equal(Object.hasOwn(data, 'data'), false, 'CloudBase documents must not nest the audit schema inside data');
          assert.equal(data.schemaVersion, 1, 'CloudBase add receives the audit row itself');
          if (failAudit) throw Error(`injected failure containing ${privateToken}`);
          const row = { ...structuredClone(data), _id: 'github-audit-record' };
          logs.push(row);
          return { id: row._id };
        }
      };
      return {
        where(filter) {
          state.queries.push(structuredClone(filter));
          return {
            async get() {
              return { data: structuredClone(users.filter(item =>
                Object.entries(filter).every(([key, value]) => item[key] === value))) };
            }
          };
        },
        doc(id) {
          return {
            async update({ data }) {
              const found = users.find(item => item._id === id);
              assert.ok(found, 'only an existing account may be updated');
              Object.assign(found, structuredClone(data));
              state.userUpdates++;
            }
          };
        }
      };
    }
  };
  const axios = {
    async post(url, data) {
      assert.equal(url, 'https://github.com/login/oauth/access_token');
      assert.equal(data.code, privateCode);
      return { data: { access_token: privateToken } };
    },
    async get(url, options) {
      assert.equal(options.headers.Authorization, `token ${privateToken}`);
      if (url === 'https://api.github.com/user') return {
        data: { id: githubId, login: 'github-poet', name: 'GitHub Poet', avatar_url: 'https://example.test/avatar.png' }
      };
      assert.equal(url, 'https://api.github.com/user/emails');
      return { data: [{ email: privateEmail, primary: true }] };
    }
  };
  const cloud = {
    SYMBOL_CURRENT_ENV: Symbol('current-env'),
    init(options) {
      assert.equal(options.env, cloud.SYMBOL_CURRENT_ENV);
      return { database: () => db };
    }
  };
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
    module, exports: module.exports, console: quiet,
    process: { env: { GITHUB_CLIENT_ID: 'test-id', GITHUB_CLIENT_SECRET: 'test-secret',
      GITHUB_REDIRECT_URI: 'https://example.test/oauth', FRONTEND_URL: 'https://example.test' } },
    require(id) {
      if (id === 'axios') return axios;
      if (id === '@cloudbase/node-sdk') return cloud;
      if (id === './_lib/login-audit') return require('../functions/github-auth/_lib/login-audit');
      throw Error(`Unexpected dependency ${id}`);
    }
  }, { filename });
  return {
    state, logs, users,
    callback(platform = 'h5', context = {}) {
      return module.exports.main({
        queryStringParameters: { code: privateCode, state: `${platform}::test-state` },
        userId: 'forged-user', userOpenid: 'forged-owner', loginTime: '2000-01-01',
        CLIENTIP: '192.0.2.200', CLIENTPORT: 9,
        clientInfo: { platform: 'app', accessToken: privateToken, userAgent: privateEmail },
        headers: { 'x-forwarded-for': '192.0.2.200', 'x-client-port': '9' }
      }, context);
    }
  };
}

function redirectData(response) {
  assert.equal(response.statusCode, 302);
  const url = new URL(response.headers.Location);
  const params = new URLSearchParams(url.hash ? url.hash.split('?')[1] : url.search);
  return { type: params.get('type'), data: JSON.parse(params.get('data')) };
}

function assertPrivateDataAbsent(log) {
  const serialized = JSON.stringify(log);
  for (const secret of [privateCode, privateToken, privateEmail, user.password, user.accessToken, user.phoneNumber]) {
    assert.ok(!serialized.includes(secret), `Login audit leaked ${secret}`);
  }
  function inspect(value) {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      assert.ok(!/^(code|token|accessToken|refreshToken|password|phoneNumber|email|githubEmail)$/i.test(key),
        `Login audit contains sensitive field ${key}`);
      inspect(child);
    }
  }
  inspect(log);
}

async function callbackTests() {
  const trustedContext = {
    requestId: 'trusted-github-request',
    environment: JSON.stringify({ TCB_SOURCE_IP: '203.0.113.21', TCB_SOURCE_PORT: '54321', TCB_SOURCE: 'http' })
  };
  const boundUser = { ...user, _id: 'bound-github-user', _openid: 'original-account-owner', githubOpenid };
  for (const [platform, account] of [['h5', user], ['app', boundUser]]) {
    const app = runtime([account]);
    const before = Date.now();
    const result = redirectData(await app.callback(platform, trustedContext));
    const after = Date.now();
    assert.equal(result.type, 'login');
    assert.equal(result.data.user._id, account._id);
    assert.equal(app.state.auditAttempts, 1);
    assert.equal(app.logs.length, 1, 'a registered GitHub account writes exactly one completed login');
    const log = app.logs[0];
    assert.equal(Object.hasOwn(log, 'data'), false, 'audit fields are stored at the document top level');
    assert.equal(log.schemaVersion, 1);
    assert.equal(log.userId, account._id);
    assert.equal(log.userOpenid, account._openid, 'a bound account keeps its application owner identity');
    assert.equal(log.poemId, account.poemId);
    assert.equal(log.loginMethod, 'github');
    assert.ok(new Date(log.loginTime).getTime() >= before && new Date(log.loginTime).getTime() <= after,
      'login time comes from the server');
    assert.deepEqual(log.network, {
      clientIp: '203.0.113.21', sourcePort: 54321,
      ipSource: 'context.environment.TCB_SOURCE_IP', portSource: 'context.environment.TCB_SOURCE_PORT'
    });
    assert.equal(log.cloudSource, 'http');
    assert.equal(log.requestId, trustedContext.requestId);
    assert.equal(log.clientInfo.platform, 'unknown', 'the OAuth callback cannot establish the originating client platform');
    assert.equal(log.clientInfo.userAgent, '');
    assert.deepEqual(Object.keys(log).sort(), [
      '_id', 'schemaVersion', 'userId', 'userOpenid', 'poemId', 'loginTime', 'loginMethod',
      'clientInfo', 'clientInfoSource', 'cloudSource', 'network', 'requestId'
    ].sort());
    assertPrivateDataAbsent(log);
    assert.equal(app.state.userUpdates, 1);
    assert.equal(app.state.queries.length, account === boundUser ? 2 : 1);
  }

  // OAuth users awaiting registration have no completed application login to audit.
  for (const platform of ['h5', 'app']) {
    const app = runtime([], { failAudit: true });
    const result = redirectData(await app.callback(platform, trustedContext));
    assert.equal(result.type, 'register');
    assert.equal(result.data.openid, githubOpenid);
    assert.equal(app.state.auditAttempts, 0);
    assert.equal(app.logs.length, 0);
    assert.equal(app.state.userUpdates, 0);
    assert.equal(app.users.length, 0);
  }

  // Persistence failure redirects to an error before any successful session payload is returned.
  for (const platform of ['h5', 'app']) {
    const app = runtime([user], { failAudit: true });
    const response = await app.callback(platform, trustedContext);
    const result = redirectData(response);
    assert.equal(result.type, 'error');
    assert.equal(result.data.success, false);
    assert.equal(result.data.message, '登录记录保存失败，请稍后重试');
    for (const key of ['user', 'userInfo', 'openid', 'accessToken', 'isNewUser']) {
      assert.equal(result.data[key], undefined, `failed login must not expose ${key}`);
    }
    assert.ok(!JSON.stringify(response).includes(privateToken), 'raw database errors must not reach the redirect');
    assert.equal(app.state.auditAttempts, 1);
    assert.equal(app.logs.length, 0);
  }
}

callbackTests().then(() => {
  console.log('GitHub login audit tests passed: registered and bound callback accounts, trusted network, private data exclusion, registration deferral and fail-closed redirects.');
}).catch(error => { console.error(error); process.exitCode = 1; });
