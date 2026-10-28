const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const { manager, envId } = require(path.join(root, '回车键新网站/scripts/cloud-admin.cjs'));
const cliRoot = path.join(process.env.APPDATA, 'npm/node_modules/@cloudbase/cli');
const { authSupevisor } = require(path.join(cliRoot, 'lib/utils/auth.js'));
const cloudbase = require(path.join(root, 'node_modules/@cloudbase/node-sdk'));
const puppeteer = require(path.join(root, 'node_modules/puppeteer-core'));

(async () => {
  assert.ok(process.argv.includes('--run'), 'Explicit --run is required for isolated cloud verification');
  const app = await manager();
  const auth = await authSupevisor.getLoginState();
  const sdk = cloudbase.init({ env: envId, secretId: auth.secretId, secretKey: auth.secretKey, sessionToken: auth.token });
  const db = sdk.database();
  // Recover only the two isolated, malformed test records from the first SDK-shape probes.
  const probes = (await db.collection('users').where({ 'data.nickName': '登录日志隔离验证' }).limit(10).get()).data;
  for (const probe of probes) {
    const value = probe.data;
    if (probe._openid || probe.poemId || !value || !/^[a-f0-9]{20}$/.test(value.loginAuditTestMarker)) continue;
    assert.equal(value._openid, `audit_owner_${value.loginAuditTestMarker}`);
    assert.equal(value.poemId, `audit_${value.loginAuditTestMarker}`);
    assert.ok(new Date(value.createTime).getTime() >= Date.now() - 30 * 60000);
    await db.collection('users').doc(probe._id).remove();
  }
  const nonce = crypto.randomBytes(10).toString('hex');
  const poemId = `audit_${nonce}`;
  const password = crypto.randomBytes(24).toString('hex');
  const owner = `audit_owner_${nonce}`;
  const summary = { envId, verifiedAt: new Date().toISOString(), isolated: true };
  let userId, browser;
  try {
    const created = await db.collection('users').add({
      _openid: owner, poemId, password, nickName: '登录日志隔离验证',
      createTime: new Date(), loginAuditTestMarker: nonce
    });
    userId = created.id || created._id;
    assert.ok(userId);
    const invoke = async event => {
      const response = await app.functions.invokeFunction('loginWithCredentials', event);
      assert.ok(!response.ErrMsg);
      if (response.RetCode !== undefined) assert.equal(response.RetCode, 0);
      const value = response.ReturnMsg === undefined ? response.RetMsg : response.ReturnMsg;
      return typeof value === 'string' ? JSON.parse(value) : value;
    };
    assert.equal((await invoke({ account: poemId, password: 'incorrect-isolated-password' })).code, 'INVALID_CREDENTIALS');
    assert.equal((await db.collection('login_logs').where({ userId }).count()).total, 0);
    assert.equal((await invoke({ account: poemId, password })).success, true);
    const first = (await db.collection('login_logs').where({ userId }).get()).data;
    assert.equal(first.length, 1);
    assert.equal(first[0].userOpenid, owner);
    assert.equal(first[0].poemId, poemId);
    assert.equal(first[0].clientInfo.platform, 'unknown');
    assert.equal(first[0].loginMethod, 'password');
    assert.equal(first[0].network.sourcePort, null);
    summary.legacyCredentialLogin = 'passed';
    summary.failedAuthenticationNotRecorded = 'passed';

    browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    let browserSdkUrl;
    page.on('request', request => {
      const url = request.url();
      if (url.startsWith('http://127.0.0.1:5186/') && /\/node_modules\/\.vite\/deps\/@cloudbase_js-sdk\.js\?/.test(url)) browserSdkUrl = url;
    });
    await page.goto('http://127.0.0.1:5186/#/poems', { waitUntil: 'networkidle0' });
    const website = await page.evaluate(async credentials => {
      const api = await import('/src/lib/api.js');
      api.setMode('cloud');
      await api.login(credentials.poemId, credentials.password);
      const loggedIn = api.hasSession();
      await api.logout();
      return { loggedIn, loggedOut: !api.hasSession() };
    }, { poemId, password });
    assert.equal(website.loggedIn, true);
    assert.equal(website.loggedOut, true);
    assert.ok(browserSdkUrl, 'Use the SDK module URL observed in this test browser');
    const acl = await page.evaluate(async options => {
      const { default: cloudbase } = await import(options.sdkUrl);
      const app = cloudbase.init({ env: options.envId, region: 'ap-shanghai', auth: { persistence: 'local' } });
      const state = await app.auth().getLoginState();
      const database = app.database();
      async function denied(operation) {
        try {
          const result = await operation();
          return { denied: Boolean(result && result.code === 'DATABASE_PERMISSION_DENIED'), code: result && result.code };
        } catch (error) {
          const diagnostic = `${error.code || ''} ${error.errCode || ''} ${error.message || ''}`;
          return { denied: /permission|not allow|not authorized|权限|-502003/i.test(diagnostic), code: error.code, errCode: error.errCode };
        }
      }
      return { hasCloudIdentity: Boolean(state),
        readDenied: await denied(() => database.collection('login_logs').limit(1).get()),
        writeDenied: await denied(() => database.collection('login_logs').add({ userId: options.userId, testAclProbe: true })) };
    }, { sdkUrl: browserSdkUrl, envId, userId });
    assert.equal(acl.hasCloudIdentity, true);
    console.log(JSON.stringify({ stage: 'client-database-acl', acl }));
    assert.equal(acl.readDenied.denied, true);
    assert.equal(acl.writeDenied.denied, true);
    summary.clientDirectDatabaseReadWriteDenied = 'passed';
    const rows = (await db.collection('login_logs').where({ userId }).get()).data;
    assert.equal(rows.length, 2);
    const webLog = rows.find(row => row.clientInfo.platform === 'h5');
    assert.ok(webLog);
    assert.equal(webLog.userOpenid, owner);
    assert.ok(webLog.clientInfo.userAgent);
    assert.equal(webLog.loginMethod, 'password');
    assert.equal(typeof webLog.requestId, 'string');
    for (const row of rows) {
      const raw = JSON.stringify(row);
      assert.ok(!raw.includes(password));
      assert.ok(!raw.includes('incorrect-isolated-password'));
      assert.ok(!('password' in row) && !('accessToken' in row) && !('phoneNumber' in row));
    }
    summary.websiteLogin = 'passed';
    summary.websiteTrustedIpAvailable = Boolean(webLog.network.clientIp);
    summary.websiteSourcePortAvailable = webLog.network.sourcePort !== null;
    const verifiedUser = (await db.collection('users').doc(userId).get()).data[0];
    const { recordSuccessfulLogin } = require(path.join(root, 'functions/_shared/login-audit.js'));
    await recordSuccessfulLogin({ db, user: verifiedUser, loginMethod: 'github', databaseApi: 'cloudbase' });
    const sdkRows = (await db.collection('login_logs').where({ userId, loginMethod: 'github' }).get()).data;
    assert.equal(sdkRows.length, 1);
    assert.equal(sdkRows[0].userOpenid, owner);
    assert.ok(!('data' in sdkRows[0]));
    summary.cloudbaseSdkDatabaseFormat = 'passed';
    summary.sensitiveDataExcluded = 'passed';
    summary.realDeviceVerification = 'pending';
  } finally {
    if (browser) await browser.close();
    if (userId) {
      const current = (await db.collection('users').doc(userId).get()).data;
      const record = Array.isArray(current) ? current[0] : current;
      assert.equal(record.loginAuditTestMarker, nonce, 'Cleanup may only remove the isolated test account');
      assert.equal(record._openid, owner);
      await db.collection('login_logs').where({ userId }).remove();
      await db.collection('web_reader_sessions').where({ owner }).remove();
      // Login limits are keyed by this test's account or browser identity; preserve shared rate-limit records.
      await db.collection('web_reader_limits').doc(crypto.createHash('sha256').update(`account:${poemId}:${Math.floor(Date.now() / (15 * 60000))}`).digest('hex')).remove();
      await db.collection('users').doc(userId).remove();
      assert.equal((await db.collection('login_logs').where({ userId }).count()).total, 0);
      assert.equal((await db.collection('users').where({ _id: userId }).count()).total, 0);
      summary.testDataCleaned = true;
    }
    await fs.writeFile(path.join(__dirname, 'live-verification.json'), JSON.stringify(summary, null, 2));
  }
  console.log(JSON.stringify(summary));
})().catch(error => {
  console.error('Isolated login audit verification failed:', error.code || error.name);
  console.error(String(error.stack || '').split('\n').filter(line => /^\s+at /.test(line)).slice(0, 4).join('\n'));
  process.exitCode = 1;
});
