'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { handle } = require('../functions/checkAppUpdate/handler');
const { fromCloudBase } = require('../uniCloud-aliyun/cloudfunctions/common/app-update/bridge');
const policy = require('../functions/_shared/app-update');
const domain = require('./app-versions/domain.cjs');
const manager = require('./app-versions/manager.cjs');
const { ensurePackageProtection, protectedWriteRule } = require('./app-versions/storage-protection.cjs');
const tests = []; const test = (name, fn) => tests.push([name, fn]);
const appid = '__UNI__E0A1A41';
const request = { appid, platform: 'android', appVersion: '1.7.8', wgtVersion: '1.7.8', protocolVersion: 2 };
const native = { _id: 'migration', appid, platform: ['Android'], uni_platform: 'android', version: '1.7.9', type: 'native_app', url: 'https://files.example.test/migration.apk', stable_publish: true, legacy_migration: true };
function cloud(records) {
  return { database: () => ({ collection(name) {
    assert.equal(name, 'app_update_releases');
    return { where() { return this; }, orderBy() { return this; }, skip() { return this; }, limit() { return this; }, get: async () => ({ data: records }) };
  } }) };
}
test('CloudBase SDK and HTTP return the same public policy with no admin actions', async () => {
  const sdk = await handle(request, {}, cloud([native]));
  assert.equal(sdk.code, 102);
  const http = await handle({ httpMethod: 'POST', body: JSON.stringify(request) }, {}, cloud([native]));
  assert.deepEqual(JSON.parse(http.body), sdk);
  assert.equal(http.headers['Cache-Control'], 'no-store');
  assert.equal((await handle({ ...request, appid: 'other' }, {}, cloud([]))).code, -102);
  assert.equal((await handle({ ...request, mode: 'publish' }, {}, cloud([]))).code, -102);
  assert.equal(JSON.parse((await handle({ httpMethod: 'POST', body: '{bad' }, {}, cloud([]))).body).code, -102);
  const bad = await handle(request, {}, { database() { throw Error('down'); } });
  assert.equal(bad.code, -100);
});
test('bridge covers current, old native plugin and WGT fallback without changing contracts', async () => {
  for (const [mode, code] of [['current', 102], ['legacy', 102], ['legacy-wgt', -10]]) {
    const c = { httpclient: { async request(url, options) {
      assert.equal(options.timeout, 5000);
      const result = await handle(options.data, {}, cloud([native]));
      return { status: 200, data: result };
    } } };
    const res = await fromCloudBase(request, { OS: 'Android' }, c, mode);
    assert.equal(res.code, code);
    if (mode === 'legacy-wgt') assert.equal(res.url, undefined);
  }
});
test('bridge failure, malformed data and no replacement preserve uniCloud fallback', async () => {
  for (const response of [null, { status: 500, data: {} }, { status: 200, data: { updateSource: 'cloudbase', code: 0, hasUpdate: false } },
    { status: 200, data: { updateSource: 'cloudbase', code: 102, type: 'native_app', version: '179', url: native.url } },
    { status: 200, data: { ...native, updateSource: 'cloudbase', code: 101, type: 'wgt', min_uni_version: '2.0.0' } }]) {
    const c = { httpclient: { request: async () => { if (!response) throw Error('timeout'); return response; } } };
    assert.equal(await fromCloudBase(request, {}, c, 'current'), null);
  }
});
test('CloudBase endpoint only returns unicloud-only releases to bridged HTTP callers', async () => {
  const old = { ...native, _id: 'old', version: '1.8.0', legacy_migration: false, unicloud_only: true, url: 'https://files.example.test/180.apk' };
  assert.equal((await handle(request, {}, cloud([old]))).code, 0);
  const http = JSON.parse((await handle({ httpMethod: 'POST', body: JSON.stringify(request) }, {}, cloud([old]))).body);
  assert.equal(http.code, 102);
  assert.equal(http.version, '1.8.0');
  assert.equal(http.unicloud_only, true);
});
test('bridge marks forwarded checks as uniCloud so unicloud-only releases survive revalidation', async () => {
  const old = { ...native, version: '1.8.0', legacy_migration: false, unicloud_only: true };
  let forwarded;
  const c = { httpclient: { async request(url, options) {
    forwarded = options.data;
    const response = await handle({ httpMethod: 'POST', body: JSON.stringify(options.data) }, {}, cloud([old]));
    return { status: 200, data: JSON.parse(response.body) };
  } } };
  const res = await fromCloudBase(request, {}, c, 'current');
  assert.equal(forwarded.via, 'unicloud');
  assert.equal(res.code, 102);
  assert.equal(res.version, '1.8.0');
});
test('draft keeps unicloud-only targeting and domain rejects a non-boolean flag', () => {
  assert.equal(domain.draft({ ...input, unicloud_only: true }, artifact).unicloud_only, true);
  assert.equal(domain.draft(input, artifact).unicloud_only, false);
  const bad = domain.draft(input, artifact);
  bad.unicloud_only = 'yes';
  assert.throws(() => domain.validate(bad), /unicloud_only/);
});
const artifact = { appid, version: '1.7.9', type: 'native_app', cloudbase_ready: true, sha256: 'a'.repeat(64), size: 2, url: native.url };
const input = { ...native, title: '更新', contents: '修复', legacy_migration: true };
test('draft validation blocks false migration packages and version/address mismatch', () => {
  assert.equal(domain.draft(input, artifact).stable_publish, false);
  assert.throws(() => domain.draft(input, { ...artifact, cloudbase_ready: false }), /迁移入口/);
  assert.throws(() => domain.draft({ ...input, version: '1.8.0' }, artifact), /不一致/);
  assert.throws(() => domain.draft(input, { ...artifact, url: native.url + '?sign=expired' }), /长期有效/);
  assert.throws(() => domain.draft({ ...input, type: 'wgt' }, artifact), /最低原生版本/);
  assert.throws(() => domain.draft({ ...input, is_mandatory: true, is_silently: true }, artifact), /静默/);
});
function memoryDB() {
  const records = new Map();
  const db = { collection() { return { where() { return this; }, orderBy() { return this; }, skip() { return this; }, limit() { return this; },
    get: async () => ({ data: [...records.values()] }), doc(id) { return {
    get: async () => ({ data: records.has(id) ? [structuredClone(records.get(id))] : [] }),
    set: async value => { records.set(id, { ...structuredClone(value), _id: id }); },
    update: async value => { records.set(id, { ...records.get(id), ...value }); }
  }; } }; }, runTransaction: async fn => fn(db) };
  return { db, records };
}
test('save revision checks reject stale edits and never mutate a live release', async () => {
  const { db, records } = memoryDB();
  const record = await manager.save(db, { record: input, artifact });
  assert.equal(record.revision, 1);
  await assert.rejects(manager.save(db, { record: input, artifact }), /其他窗口/);
  records.get(record._id).stable_publish = true;
  await assert.rejects(manager.save(db, { record: input, artifact, revision: 1 }), /不能直接修改/);
  assert.equal(records.get(record._id).stable_publish, true);
});
test('withdraw retains artifact and stale request cannot withdraw newer revision', async () => {
  const { db, records } = memoryDB();
  const r = await manager.save(db, { record: input, artifact });
  records.get(r._id).stable_publish = true;
  await assert.rejects(manager.setPublished(db, { id: r._id, revision: 0 }, false), /刷新/);
  const withdrawn = await manager.setPublished(db, { id: r._id, revision: 1 }, false);
  assert.equal(withdrawn.stable_publish, false);
  assert.equal(records.get(r._id).url, artifact.url);
});
test('historical uniCloud packages can be archived but cannot be published as a CloudBase update', async () => {
  const { db, records } = memoryDB();
  const row = await manager.save(db, { record: { ...input, legacy_migration: false }, artifact: { ...artifact, cloudbase_ready: false } });
  await assert.rejects(manager.setPublished(db, { id: row._id, revision: 1 }, true), /历史包/);
  assert.equal(records.get(row._id).stable_publish, false);
});
test('publication waits for storage write rules to propagate', async () => {
  const { db, records } = memoryDB();
  const row = await manager.save(db, { record: input, artifact: { ...artifact, protectionReadyAt: Date.now() + 180000 } });
  await assert.rejects(manager.setPublished(db, { id: row._id, revision: 1 }, true), /写保护正在生效/);
  assert.equal(records.get(row._id).stable_publish, false);
});
test('client has no uniCloud update fallback and update check bypasses business login guard', () => {
  const client = fs.readFileSync('utils/appUpdate.js', 'utf8');
  assert.ok(!client.includes('uniCloud'));
  assert.match(client, /cloudCall\('checkAppUpdate'/);
  const main = fs.readFileSync('main.js', 'utf8');
  assert.match(main, /'getPhoneNumberByToken', 'checkAppUpdate'\]\.includes/);
});
test('publish rejects a corrupted CDN file and only publishes the verified revision', async () => {
  const { db, records } = memoryDB();
  const bytes = Buffer.from('apk-test');
  const a = { ...artifact, size: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
  const r = await manager.save(db, { record: input, artifact: a });
  const originalFetch = global.fetch;
  try {
    global.fetch = async url => ({ ok: true, url, body: [Buffer.from('bad-test')] });
    await assert.rejects(manager.setPublished(db, { id: r._id, revision: 1 }, true), /校验值不同/);
    assert.equal(records.get(r._id).stable_publish, false);
    global.fetch = async url => ({ ok: true, url, body: [bytes] });
    const published = await manager.setPublished(db, { id: r._id, revision: 1 }, true);
    assert.equal(published.stable_publish, true);
    assert.equal(published.revision, 2);
    await assert.rejects(manager.setPublished(db, { id: r._id, revision: 1 }, true), /刷新/);
  } finally { global.fetch = originalFetch; }
});
test('directory protection replaces per-package rules without changing ordinary write access', () => {
  const packages = Array.from({ length: 8 }, (_, index) => `app-updates/${appid}/wgt/1.8.${index}/${'a'.repeat(64)}.wgt`);
  const legacy = packages.reduce((write, key) => `(${write}) && resource.path != '${key}'`, 'true');
  assert.ok(legacy.length > 1024);
  const write = protectedWriteRule(legacy);
  assert.equal(write, protectedWriteRule('true'));
  assert.ok(write.length < 1024);
  const allowed = new Function('resource', `return ${write}`);
  for (const path of [...packages, 'app-updates/', 'app-updates/future.apk']) assert.equal(allowed({ path }), false, path);
  for (const path of ['user_avatars/a.jpg', 'app-updates-extra/a.jpg', 'app-updates0/a.jpg', 'app-updates', '拼贴/a.jpg']) {
    assert.equal(allowed({ path }), true, path);
  }
});
test('directory protection preserves custom expressions and does not rewrite an installed rule', async () => {
  const base = "resource.path != 'locked/a.jpg' && auth.uid != null";
  const write = protectedWriteRule(base);
  const allowed = new Function('resource', 'auth', `return ${write}`);
  assert.equal(allowed({ path: 'user_avatars/a.jpg' }, { uid: 'user' }), true);
  assert.equal(allowed({ path: 'user_avatars/a.jpg' }, { uid: null }), false);
  assert.equal(allowed({ path: 'locked/a.jpg' }, { uid: 'user' }), false);
  assert.equal(allowed({ path: 'app-updates/future.apk' }, { uid: 'user' }), false);
  const actions = [];
  await ensurePackageProtection({ commonService: () => ({ async call({ Action }) {
    actions.push(Action);
    return { Rule: JSON.stringify({ read: 'true', write }) };
  } }) });
  assert.deepEqual(actions, ['DescribeStorageSafeRule']);
});
test('business upload guards reserve packages but preserve normal image paths', () => {
  for (const name of ['upload', 'uploadAvatar', 'uploadCollagePoetry']) {
    const guard = require(`../functions/${name}/release-path`);
    for (const key of ['app-updates/a.apk', '/app-updates/a.wgt', 'app-updates\\a.apk', '%61pp-updates/a.apk']) assert.equal(guard(key), true);
    for (const key of ['avatars/a.png', 'collage-poetry/a.jpg', 'posts/a.jpg']) assert.equal(guard(key), false);
  }
});
(async () => {
  for (const [name, fn] of tests) { await fn(); console.log('PASS ' + name); }
  console.log(`${tests.length} CloudBase migration tests passed`);
})().catch(error => { console.error(error); process.exitCode = 1; });
