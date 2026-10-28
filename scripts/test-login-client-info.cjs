const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parse } = require('@babel/parser');
const root = path.join(__dirname, '..');
const quiet = { log() {}, warn() {}, error() {} };

function load(file, globals = {}, names = [], setup = '') {
  let source = fs.readFileSync(path.join(root, file), 'utf8');
  source = source.replace(/import\.meta\.env/g, 'testEnv');
  for (const node of parse(source, { sourceType: 'module' }).program.body.reverse()) {
    if (node.type === 'ImportDeclaration') {
      source = source.slice(0, node.start) + source.slice(node.end);
    } else if (node.type === 'ExportNamedDeclaration') {
      source = source.slice(0, node.start) + source.slice(node.declaration.start);
    } else if (node.type === 'ExportDefaultDeclaration') {
      source = source.slice(0, node.start) + 'module.exports = ' + source.slice(node.declaration.start);
    }
  }
  source += `\n${setup}\nmodule.exports = { ${names.join(', ')} };`;
  const scope = { module: { exports: {} }, console: quiet, ...globals };
  vm.runInNewContext(source, scope, { filename: file });
  return scope.module.exports;
}

function collector(globals = {}) {
  return load('utils/loginClientInfo.js', globals, ['collectLoginClientInfo', 'isLoginAuditRequest']);
}

function testBasicInfo() {
  const info = collector({
    plus: { runtime: { version: '2.4.1', versionCode: 241 } },
    window: {}, document: {}, navigator: { userAgent: 'App webview' },
    uni: {
      getDeviceInfo: () => ({ platform: 'android', system: 'Android 14', model: 'Pixel 8', brand: 'Google', deviceId: 'never-upload', mac: 'never-upload' }),
      getAppBaseInfo: () => ({ uniPlatform: 'app-plus', SDKVersion: '1.2.3' })
    }
  }).collectLoginClientInfo();
  assert.equal(info.platform, 'app', 'App WebView 不能误报成 H5');
  assert.equal(info.os, 'android');
  assert.equal(info.osVersion, '14');
  assert.equal(info.deviceModel, 'Pixel 8');
  assert.equal(info.appVersion, '2.4.1');
  assert.equal(info.appVersionCode, '241');
  assert.equal(info.sdkVersion, '1.2.3');
  assert.equal(info.userAgent, 'App webview');
  assert.deepEqual(Object.keys(info), ['platform', 'os', 'osVersion', 'deviceModel', 'deviceBrand', 'appVersion', 'appVersionCode', 'sdkVersion', 'userAgent']);
  assert.ok(!JSON.stringify(info).includes('never-upload'), '设备标识和 MAC 不得进入登录信息');

  let miniWrapperReads = 0;
  const mini = collector({
    wx: {
      getDeviceInfo: () => ({ platform: 'ios', system: 'iOS 18.0', brand: 'Apple', model: 'm'.repeat(1000) }),
      getAppBaseInfo: () => ({ SDKVersion: '3.9.0', version: 'WeChat host version' }),
      getAccountInfoSync: () => ({ miniProgram: { version: '3.1.0', appId: 'not-collected' } })
    },
    uni: { getDeviceInfo() { miniWrapperReads++; return {}; } }
  }).collectLoginClientInfo();
  assert.equal(mini.platform, 'mp-weixin');
  assert.equal(mini.os, 'ios');
  assert.equal(mini.osVersion, '18.0');
  assert.equal(mini.deviceModel.length, 128);
  assert.equal(mini.appVersion, '3.1.0', '不能把微信宿主版本记成业务小程序版本');
  assert.equal(miniWrapperReads, 0, 'uni 小程序包装器不能额外生成设备标识');

  let h5DeviceReads = 0;
  const h5 = collector({
    window: {}, document: {}, navigator: { userAgent: 'Mozilla/5.0 (Windows NT 10.0)\r\n' + 'x'.repeat(1000) },
    uni: {
      getAppBaseInfo: () => ({ uniPlatform: 'web', appVersionCode: 31 }),
      getDeviceInfo() { h5DeviceReads++; return {}; },
      getSystemInfoSync() { h5DeviceReads++; return {}; }
    }
  }).collectLoginClientInfo();
  assert.equal(h5.platform, 'h5');
  assert.equal(h5.deviceModel, '');
  assert.equal(h5.os, 'windows');
  assert.equal(h5.osVersion, '10.0');
  assert.equal(h5.userAgent.length, 512);
  assert.ok(!/[\r\n]/.test(h5.userAgent));
  assert.ok(!JSON.stringify(h5).includes('never-upload'));
  assert.equal(h5.appVersionCode, '31');
  assert.equal(h5DeviceReads, 0, 'H5 不能为审计调用会创建设备标识的 API');

  const harmony = collector({ uni: {
    getAppBaseInfo: () => ({ uniPlatform: 'app-harmony', appVersion: '1.0.0' }),
    getDeviceInfo: () => ({ osName: 'harmonyos', osVersion: '5.0' })
  } }).collectLoginClientInfo();
  assert.equal(harmony.platform, 'app-harmony');
  assert.equal(harmony.os, 'harmonyos');
}

function testFailures() {
  const fail = () => { throw new Error('API unavailable'); };
  const empty = collector({ uni: { getDeviceInfo: fail, getAppBaseInfo: fail, getSystemInfoSync: fail } }).collectLoginClientInfo();
  assert.equal(empty.platform, 'unknown');
  assert.equal(empty.deviceModel, '');
  const getterFailure = collector({ navigator: Object.defineProperty({}, 'userAgent', { get: fail }) }).collectLoginClientInfo();
  assert.equal(getterFailure.platform, 'unknown');
  assert.equal(getterFailure.userAgent, '');
  assert.equal(collector({ Object: { keys: Object.keys, fromEntries: undefined } }).collectLoginClientInfo().platform, 'unknown', '低版本 JS 不依赖 Object.fromEntries');
}

function testWebsiteInfo() {
  const loadBrowser = globals => load('回车键新网站/src/lib/login-client-info.js', globals, ['collectBrowserLoginClientInfo']);
  for (const [agent, os, version] of [
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'windows', '10.0'],
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X)', 'ios', '18.1'],
    ['Mozilla/5.0 (Linux; Android 14; Pixel 8)', 'android', '14'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'macos', '10.15.7']
  ]) {
    const info = loadBrowser({ navigator: { userAgent: agent } }).collectBrowserLoginClientInfo();
    assert.equal(info.platform, 'h5');
    assert.equal(info.os, os);
    assert.equal(info.osVersion, version);
  }
  const blocked = loadBrowser({ navigator: Object.defineProperty({}, 'userAgent', { get() { throw new Error('blocked'); } }) }).collectBrowserLoginClientInfo();
  assert.equal(blocked.platform, 'h5');
  assert.equal(blocked.userAgent, '');
  assert.equal(loadBrowser({ navigator: { userAgent: 'x'.repeat(2000) } }).collectBrowserLoginClientInfo().userAgent.length, 512);
}

async function testWebsitePayload() {
  const audit = load('回车键新网站/src/lib/login-client-info.js', { navigator: { userAgent: 'Mozilla/5.0 (Windows NT 10.0)' } }, ['collectBrowserLoginClientInfo']);
  const calls = [];
  const api = load('回车键新网站/src/lib/api.js', {
    testEnv: {},
    demoPosts: [], demoUser: {}, demoActivity: [],
    collectBrowserLoginClientInfo: audit.collectBrowserLoginClientInfo,
    fakeCloudClient: { async callFunction(options) { calls.push(options); return { result: { success: true, token: 'session', user: { nickName: 'test-user' } } }; } }
  }, ['login', 'setMode'], 'client = async () => fakeCloudClient;');
  const user = await api.login(' poet ', 'secret');
  assert.equal(user.nickName, 'test-user');
  assert.equal(calls[0].name, 'webReader');
  assert.equal(calls[0].data.action, 'login');
  assert.equal(calls[0].data.poemId, 'poet');
  assert.equal(calls[0].data.password, 'secret');
  assert.equal(calls[0].data.clientInfo.platform, 'h5');
  assert.equal(calls[0].data.clientInfo.os, 'windows');
  api.setMode('demo');
  await assert.rejects(api.login('poet', 'secret'), /示例模式/);
  assert.equal(calls.length, 1, '网站示例登录不得写入后台真实登录审计');
}

async function testCloudPayload() {
  const audit = collector();
  const calls = [];
  let collections = 0;
  const module = load('utils/cloudCall.js', {
    getCloudFunctionMethod: () => 'tcb',
    auth: { getOpenId: async () => 'caller' },
    formatErrorForLog: String,
    prepareCloudPostImages() {}, resolveCloudPostImages: async (name, result) => result,
    collectLoginClientInfo: () => { collections++; return { platform: 'app', appVersion: '1.0.0' }; },
    isLoginAuditRequest: audit.isLoginAuditRequest,
    uni: { $tcb: { async callFunction(options) { calls.push(options); return { result: { success: true } }; } } }
  }, ['cloudCall']);
  for (const name of ['loginWithCredentials', 'loginWithPhone', 'loginWithWechat', 'registerUser']) {
    const data = { password: 'secret', clientInfo: { platform: 'forged' } };
    await module.cloudCall(name, data);
    assert.equal(calls.at(-1).data.clientInfo.platform, 'app');
    assert.equal(data.clientInfo.platform, 'forged', '调用封装不应改写页面传入的对象');
    assert.equal(calls.at(-1).data.password, 'secret');
  }
  await module.cloudCall('github-auth', { action: 'handleCallback' });
  assert.equal(calls.at(-1).data.clientInfo.platform, 'app');
  for (const [name, data] of [['github-auth', { action: 'getAuthUrl' }], ['login', {}], ['sendSmsCode', {}], ['getPostList', {}]]) {
    await module.cloudCall(name, data);
    assert.equal(calls.at(-1).data.clientInfo, undefined, '非账号登录请求不采集端信息');
  }
  assert.equal(collections, 5);
}

async function main() {
  testBasicInfo();
  testFailures();
  testWebsiteInfo();
  await testWebsitePayload();
  await testCloudPayload();
  console.log('Login client info tests passed.');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
