const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('node:assert/strict');
const policy = require('../uniCloud-aliyun/cloudfunctions/common/app-update');
const root = path.resolve(__dirname, '..');
const tests = [];
const test = (name, fn) => tests.push([name, fn]);
const appid = '__UNI__E0A1A41';
const local = { appid, platform: 'android', appVersion: '1.7.0', wgtVersion: '1.7.0', protocolVersion: 2 };
const release = (changes = {}) => ({ appid, platform: ['Android'], stable_publish: true,
  version: '1.7.1', type: 'wgt', min_uni_version: '1.7.0', url: 'https://updates.example.test/app.wgt', ...changes });
const select = (records, request = local, mode) => policy.selectUpdate(records, request, mode);

test('numeric segment comparison, rejects build counters / malformed names', () => {
  assert.equal(policy.compareVersion('1.6.10', '1.6.9'), 1);
  for (const value of ['168', 168, '1.7', '1.7.x', '1.7.0-beta', '01.7.0', '99999999999999999.0.0']) assert.equal(policy.isVersion(value), false);
});
test('one decision gives native priority over WGT', () => {
  assert.equal(select([release(), release({ type: 'native_app', version: '1.8.0' })]).code, 102);
});
test('native comparison does not downgrade current resources', () => {
  assert.equal(select([release({ type: 'native_app', version: '1.7.1' })], { ...local, wgtVersion: '1.7.2' }).code, 0);
});
test('native upgrade may equal resource version, but must exceed native version', () => {
  const record = release({ type: 'native_app', version: '1.7.2' });
  assert.equal(select([record], { ...local, wgtVersion: '1.7.2' }).code, 102);
  assert.equal(select([record], { ...local, appVersion: '1.7.2', wgtVersion: '1.7.2' }).code, 0);
});
test('minimum version compares native version, not updated resource version', () => {
  const response = select([release({ version: '1.9.1', min_uni_version: '1.8.0' })], { ...local, wgtVersion: '1.9.0' });
  assert.equal(response.code, -10);
});
test('chooses highest compatible version instead of last created record', () => {
  const records = [release({ version: '1.7.9', create_date: 20 }), release({ version: '1.7.10', create_date: 10 }),
    release({ version: '1.8.1', min_uni_version: '1.8.0', create_date: 30 })];
  assert.equal(select(records).version, '1.7.10');
});
test('honors inclusive max native version', () => {
  assert.equal(select([release({ max_uni_version: '1.6.9', min_uni_version: '1.5.0' })]).code, 0);
  assert.equal(select([release({ max_uni_version: '1.7.0' })]).code, 101);
});
test('filters app, platform, publication, accepts old platform field fallback', () => {
  assert.equal(select([release({ appid: 'other' }), release({ platform: ['iOS'] }), release({ stable_publish: false })]).code, 0);
  assert.equal(select([release({ platform: undefined, uni_platform: 'android' })]).code, 101);
  assert.equal(select([release({ platform: ['iOS'], uni_platform: 'android' })]).code, 0);
});
test('invalid active config and protocol are errors, never latest', () => {
  for (const changes of [{ version: '171' }, { min_uni_version: '' }, { url: 'http://example.test/a' }]) {
    assert.equal(select([release(changes)]).code, -422);
  }
  assert.equal(select([], { ...local, appVersion: '170' }).code, -102);
  assert.equal(select([], { ...local, protocolVersion: 1 }).code, -102);
});
test('silent WGT works, mandatory WGT and all APKs are never silent', () => {
  assert.equal(select([release({ is_silently: true })]).is_silently, true);
  assert.equal(select([release({ is_silently: true, is_mandatory: true })]).is_silently, false);
  assert.equal(select([release({ type: 'native_app', is_silently: true })]).is_silently, false);
});
test('old integer clients receive explicitly marked migration APK in their old contract', () => {
  const target = release({ version: '1.7.0', type: 'native_app', legacy_migration: true, is_silently: true });
  const result = select([target], { ...local, appVersion: '168', wgtVersion: '1.6.8' }, 'legacy');
  assert.equal(result.code, 102);
  assert.equal(result.type, 'native_app');
  assert.equal(result.version, '1.7.0');
  assert.equal(result.is_mandatory, true);
  assert.equal(result.is_silently, false);
  assert.deepEqual(result.platform, ['Android']);
});
test('old client never receives unmarked native package or WGT', () => {
  assert.equal(select([release(), release({ type: 'native_app' })], local, 'legacy').code, 0);
});
test('old WGT fallback never mistakes APK for a resource package', () => {
  const result = select([release({ type: 'native_app', legacy_migration: true })], local, 'legacy-wgt');
  assert.equal(result.code, -10);
  assert.equal(result.hasUpdate, false);
  assert.equal(result.url, undefined);
});
test('migration never downgrades resources; new client does not loop on migration', () => {
  const target = release({ version: '1.7.0', type: 'native_app', legacy_migration: true });
  assert.equal(select([target], { ...local, wgtVersion: '1.7.1' }, 'legacy').code, 0);
  assert.equal(select([target]).code, 0);
});

function cloudMock(records) {
  return { database: () => ({ collection: () => {
    let offset = 0; let size = 100; let condition;
    return { where(value) { condition = value; return this; }, orderBy() { return this; },
      skip(value) { offset = value; return this; }, limit(value) { size = value; return this; },
      async get() { return { data: records.filter(r => r.appid === condition.appid && r.stable_publish === condition.stable_publish).slice(offset, offset + size) }; } };
  } }) };
}
test('reads beyond database page limit and picks highest version', async () => {
  const records = Array.from({ length: 205 }, (_, i) => release({ version: `1.7.${i + 1}` }));
  assert.equal((await policy.checkUpdate(local, {}, cloudMock(records))).version, '1.7.205');
});
test('query failure is an error; old request can take platform from context', async () => {
  const result = await policy.checkUpdate(local, {}, { database() { throw Error('simulated outage'); } });
  assert.equal(result.code, -100);
  const target = release({ type: 'native_app', legacy_migration: true });
  const legacy = await policy.checkUpdate({ appid, appVersion: '168', wgtVersion: '1.6.8' }, { OS: 'android' }, cloudMock([target]), 'legacy');
  assert.equal(legacy.code, 102);
});
test('actual endpoint adapters use shared code without a second cloud call', async () => {
  const cloud = cloudMock([release({ version: '1.7.0', type: 'native_app', legacy_migration: true })]);
  for (const [file, expected] of [['checkAppUpdate/index.js', 0], ['uni-upgrade-center/checkVersion/index.js', 102], ['checkWgtUpdate/index.js', -10]]) {
    const box = { module: { exports: {} }, exports: {}, uniCloud: cloud,
      require(name) { assert.equal(name, 'app-update'); return policy; } };
    vm.runInNewContext(fs.readFileSync(path.join(root, 'uniCloud-aliyun/cloudfunctions', file), 'utf8'), box);
    const handler = typeof box.module.exports === 'function' ? box.module.exports : box.exports.main;
    const request = expected === 0 ? local : { ...local, appVersion: '168', wgtVersion: '1.6.8' };
    assert.equal((await handler(request, { OS: 'android' })).code, expected);
  }
});

function clientHarness(options = {}) {
  const storage = new Map();
  const calls = { cloud: [], navigation: 0, downloads: 0, installs: 0, restart: 0, toasts: [], opened: [] };
  const timers = new Map();
  let timerId = 0;
  const runtime = { appid, version: options.nativeVersion || '1.7.0',
    getProperty(id, callback) { if (!options.propertyHang) callback({ version: options.resourceVersion || '1.7.0', versionCode: 999 }); },
    install(file, config, success, fail) { calls.installs++; options.installFail ? fail({ message: 'install failed' }) : success(); },
    restart() { calls.restart++; }, openURL(url) { calls.opened.push(url); } };
  const box = {
    APP_ID: appid, console, getDeviceInfoCompat: () => ({ platform: options.platform || 'android' }),
    setTimeout(fn, ms) { const id = ++timerId; timers.set(id, { fn, ms }); return id; },
    clearTimeout(id) { timers.delete(id); }, getCurrentPages: () => [],
    uni: { getStorageSync: key => storage.get(key), setStorageSync: (key, value) => storage.set(key, value), removeStorageSync: key => storage.delete(key),
      showToast: value => calls.toasts.push(value.title), navigateTo(args) { calls.navigation++; options.navigationFail ? args.fail(Error('navigation failed')) : args.success(); } },
    uniCloud: { async callFunction(request) {
      calls.cloud.push(request);
      if (options.cloudHang) return new Promise(() => {});
      return { result: options.result || { code: 0, hasUpdate: false } };
    } },
    plus: { runtime, downloader: { createDownload(url, config, callback) {
      calls.downloads++;
      return { addEventListener() {}, abort() {}, start() {
        if (!options.downloadHang) callback({ filename: config.filename }, options.downloadFail ? 503 : 200);
      } };
    } } }
  };
  if (options.noRuntime) delete box.plus;
  const versionCode = fs.readFileSync(path.join(root, 'utils/updateVersion.js'), 'utf8').replace(/export /g, '');
  const serviceCode = fs.readFileSync(path.join(root, 'utils/appUpdate.js'), 'utf8')
    .replace(/^import .*;\r?\n/gm, '').replace(/export /g, '');
  vm.createContext(box);
  vm.runInContext(versionCode + '\n' + serviceCode, box);
  return { box, calls, storage, timers };
}
const updateResponse = changes => ({ ...release(changes), code: 101, hasUpdate: true, ...changes });

test('new client reads true native name and sends one version-check request', async () => {
  const { box, calls } = clientHarness({ nativeVersion: '1.7.0', resourceVersion: '1.7.2' });
  await box.checkAndUpdate();
  assert.equal(calls.cloud.length, 1);
  assert.equal(calls.cloud[0].name, 'checkAppUpdate');
  assert.equal(calls.cloud[0].data.appVersion, '1.7.0');
  assert.equal(calls.cloud[0].data.wgtVersion, '1.7.2');
});
test('concurrent checks coalesce; manual check bypasses successful latest cache', async () => {
  const { box, calls } = clientHarness();
  await Promise.all([box.checkAndUpdate(), box.checkAndUpdate()]);
  await box.checkAndUpdate();
  assert.equal(calls.cloud.length, 1);
  await box.checkAndUpdate({ manual: true });
  assert.equal(calls.cloud.length, 2);
  assert.equal(calls.toasts.at(-1), '已是最新版本');
});
test('cache invalidates on native version change', async () => {
  const { box, calls } = clientHarness();
  await box.checkAndUpdate();
  box.plus.runtime.version = '1.8.0';
  await box.checkAndUpdate();
  assert.equal(calls.cloud.length, 2);
});
test('cloud error and malformed response never cache latest', async () => {
  for (const result of [{ code: -100, message: 'outage' }, { code: 0 }, { code: 101, hasUpdate: true }]) {
    const { box, calls, storage } = clientHarness({ result });
    await assert.rejects(box.checkAndUpdate());
    await assert.rejects(box.checkAndUpdate());
    assert.equal(calls.cloud.length, 2);
    assert.equal(storage.size, 0);
  }
});
test('bad native compatibility response cannot trigger download', async () => {
  const { box, calls } = clientHarness({ result: updateResponse({ min_uni_version: '1.8.0', is_silently: true }) });
  await assert.rejects(box.checkAndUpdate());
  assert.equal(calls.downloads, 0);
});
test('ordinary update publishes a dialog without leaving the current page', async () => {
  const { box, calls } = clientHarness({ result: updateResponse({}) });
  const states = [];
  const unsubscribe = box.subscribeUpdateDialog(state => states.push(state));
  await box.checkAndUpdate();
  assert.equal(calls.navigation, 0);
  assert.equal(calls.downloads, 0);
  assert.equal(box.getPendingUpdate().version, '1.7.1');
  assert.equal(states.at(-1).update.version, '1.7.1');
  await box.checkAndUpdate();
  assert.equal(states.at(-1).attempted, false);
  box.releaseUpdatePage();
  assert.equal(box.getPendingUpdate(), null);
  assert.equal(states.at(-1).update, null);
  unsubscribe();
});
test('silent WGT installs once and immediately requests one restart', async () => {
  const { box, calls, timers } = clientHarness({ result: updateResponse({ is_silently: true }) });
  assert.equal((await box.checkAndUpdate()).type, 'restart_pending');
  assert.equal(calls.restart, 1, '安装完成后立即重启，避免旧页面与新资源混用');
  await box.checkAndUpdate();
  assert.equal(calls.downloads, 1);
  assert.equal(calls.installs, 1);
  assert.equal(calls.navigation, 0);
  assert.equal(calls.restart, 1, '重复检查不会重复请求重启');
  assert.equal(timers.size, 0);
  await box.checkAndUpdate({ manual: true });
  assert.equal(calls.navigation, 0);
  assert.equal(box.getPendingUpdate().version, '1.7.1');
  box.restartAfterUpdate();
  assert.equal(calls.restart, 1);
});
test('mandatory update is visible even if record also requests silence', async () => {
  const { box, calls } = clientHarness({ result: updateResponse({ is_silently: true, is_mandatory: true }) });
  await box.checkAndUpdate();
  assert.equal(calls.navigation, 0);
  assert.equal(calls.downloads, 0);
  box.releaseUpdatePage();
  assert.equal(box.getPendingUpdate().is_mandatory, true);
});
test('dialog starts WGT update only on confirmation and restarts after install', async () => {
  const { box, calls } = clientHarness({ result: updateResponse({}) });
  const states = [];
  box.subscribeUpdateDialog(state => states.push(state));
  await box.checkAndUpdate();
  assert.equal(calls.downloads, 0);
  await box.startPendingUpdate();
  assert.equal(calls.downloads, 1);
  assert.equal(calls.installs, 1);
  assert.equal(states.at(-1).installed, true);
  assert.equal(states.at(-1).busy, false);
  assert.equal(calls.restart, 1, '确认安装的 WGT 也不能留下混合版本页面');
  await box.startPendingUpdate();
  assert.equal(calls.restart, 1);
});
test('failed dialog update can retry without another version check', async () => {
  const { box, calls } = clientHarness({ result: updateResponse({}), installFail: true });
  const states = [];
  box.subscribeUpdateDialog(state => states.push(state));
  await box.checkAndUpdate();
  await box.startPendingUpdate();
  assert.match(states.at(-1).message, /install failed/);
  assert.equal(states.at(-1).busy, false);
  await box.startPendingUpdate();
  assert.equal(calls.downloads, 2);
  assert.equal(calls.cloud.length, 1);
});
test('optional download can be dismissed without reopening or installing', async () => {
  const { box, calls } = clientHarness({ result: updateResponse({}), downloadHang: true });
  const states = [];
  box.subscribeUpdateDialog(state => states.push(state));
  await box.checkAndUpdate();
  const running = box.startPendingUpdate();
  for (let i = 0; i < 10 && !calls.downloads; i++) await Promise.resolve();
  assert.equal(calls.downloads, 1);
  await box.checkAndUpdate();
  assert.equal(states.at(-1).busy, true);
  box.releaseUpdatePage();
  await running;
  assert.equal(box.getPendingUpdate(), null);
  assert.equal(states.at(-1).update, null);
  assert.equal(calls.installs, 0);
});
test('dismissal during version validation prevents a late download', async () => {
  const { box, calls } = clientHarness({ result: updateResponse({}) });
  await box.checkAndUpdate();
  const running = box.startPendingUpdate();
  box.releaseUpdatePage();
  await running;
  assert.equal(calls.downloads, 0);
  assert.equal(calls.installs, 0);
});
test('download and install errors settle and permit a retry', async () => {
  for (const failure of ['downloadFail', 'installFail']) {
    const { box, calls, timers } = clientHarness({ [failure]: true, result: updateResponse({ is_silently: true }) });
    await assert.rejects(box.checkAndUpdate());
    await assert.rejects(box.checkAndUpdate());
    assert.equal(calls.downloads, 2);
    assert.equal(calls.restart, 0, '下载或安装失败时不得重启');
    assert.equal(timers.size, 0);
  }
});
test('iOS native update opens store without downloading APK', async () => {
  const { box, calls } = clientHarness({ platform: 'ios' });
  const result = await box.downloadAndInstallUpdate(updateResponse({ type: 'native_app', code: 102, version: '1.8.0' }));
  assert.equal(result.type, 'store_opened');
  assert.equal(calls.opened.length, 1);
  assert.equal(calls.downloads, 0);
});
test('APK installer callback reports requested, not confirmed installed', async () => {
  const { box, calls } = clientHarness();
  const result = await box.downloadAndInstallUpdate(updateResponse({ type: 'native_app', code: 102, version: '1.8.0' }));
  assert.equal(result.type, 'installation_requested');
  assert.equal(calls.restart, 0);
});
test('version and cloud timeouts reject, clear the lock and allow retry', async () => {
  for (const option of ['propertyHang', 'cloudHang']) {
    const { box, calls, timers } = clientHarness({ [option]: true });
    const promise = box.checkAndUpdate();
    const rejected = assert.rejects(promise, /超时/);
    for (let i = 0; i < 8; i++) await Promise.resolve();
    for (const timer of [...timers.values()]) timer.fn();
    await rejected;
    if (option === 'cloudHang') assert.equal(calls.cloud.length, 1);
  }
});
test('non-App environments do not request updates', async () => {
  const { box, calls } = clientHarness({ noRuntime: true });
  assert.equal((await box.checkAndUpdate()).type, 'skip');
  assert.equal(calls.cloud.length, 0);
});
test('manifest and route use migrated client, old plugin is absent', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  // 上方 local 仍固定 1.7.0 验证最低支持版本；正式包版本以当前 manifest 为准。
  assert.equal(manifest.versionName, '1.7.2');
  assert.equal(manifest.versionCode, 172);
  assert.ok(manifest['app-plus'].distribute.android.permissions.some(value => value.includes('REQUEST_INSTALL_PACKAGES')));
  assert.ok(!fs.existsSync(path.join(root, 'uni_modules/uni-upgrade-center-app')));
  assert.ok(!fs.readFileSync(path.join(root, 'pages.json'), 'utf8').includes('uni-upgrade-center-app'));
  assert.ok(!fs.readFileSync(path.join(root, 'pages.json'), 'utf8').includes('pages/app-update/app-update'));
  const splash = fs.readFileSync(path.join(root, 'pages/splash/splash.vue'), 'utf8');
  assert.match(splash, /app-overlay-host :suppress-update="true"/);
  const host = fs.readFileSync(path.join(root, 'components/app-overlay-host/app-overlay-host.vue'), 'utf8');
  assert.match(host, /AppUpdateDialog v-if="updateState.update && !suppressUpdate"/);
});

(async () => {
  for (const [name, run] of tests) {
    await run();
    console.log(`PASS ${name}`);
  }
  console.log(`[app-update] ${tests.length} tests passed`);
})().catch(error => { console.error(error); process.exitCode = 1; });
