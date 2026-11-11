'use strict';
// Local privileged tool. No admin API, key or account identifier is shipped to App.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { createManager, listCollectionNames } = require('../init-societies-db.cjs');
const domain = require('./domain.cjs');
const config = require('./config.json');
const root = path.resolve(__dirname, '../..');
const output = path.join(root, 'unpackage/app-update-migration');
const { assert } = domain;

function inspect(filename) {
  let stdout;
  try { stdout = execFileSync('python', [path.join(__dirname, 'inspect-package.py'), filename], { encoding: 'utf8', windowsHide: true, timeout: 180000 }); }
  catch (error) {
    let message = '无法校验安装包，请检查 Python 和 HBuilderX 安装';
    try { message = JSON.parse(error.stdout).error || message; } catch (_) {}
    throw Error(message);
  }
  return JSON.parse(stdout);
}
async function connect() {
  // The CLI maps transient errors in its read-only login check to AUTH_REQUIRED.
  // Retry that check only; never replay a publish/database mutation blindly.
  let manager;
  for (let attempt = 0; attempt < 3; attempt++) {
    try { manager = await createManager(config); break; }
    catch (error) {
      if (error.code !== 'AUTH_REQUIRED' || attempt === 2) throw error;
      await new Promise(resolve => setTimeout(resolve, 800));
    }
  }
  const credentials = manager.getManagerConfig();
  const app = require('@cloudbase/node-sdk').init({ env: config.envId, region: config.region,
    secretId: credentials.secretId, secretKey: credentials.secretKey, sessionToken: credentials.token,
    proxy: credentials.proxy, timeout: 30000 });
  return { manager, db: app.database() };
}
async function read(ref) {
  const result = await ref.get();
  return Array.isArray(result.data) ? result.data[0] || null : result.data || null;
}
async function list(db) {
  const rows = [];
  for (let offset = 0; offset < 10000; offset += 100) {
    const res = await db.collection(config.collection).where({ appid: config.appid }).orderBy('_id', 'asc').skip(offset).limit(100).get();
    rows.push(...res.data);
    if (res.data.length < 100) return rows.sort((a, b) => domain.compareVersion(b.version, a.version));
  }
  throw Error('版本记录超过上限，请先整理历史版本');
}
function backup(record, action) {
  fs.mkdirSync(path.join(output, 'history'), { recursive: true });
  fs.writeFileSync(path.join(output, 'history', `${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${action}.json`), JSON.stringify(record, null, 2));
}
async function verifyDownload(url, expected) {
  assert(new URL(url).protocol === 'https:', '下载地址必须为 HTTPS');
  const response = await fetch(url, { signal: AbortSignal.timeout(180000) });
  assert(response.ok && new URL(response.url).protocol === 'https:', '安装包无法通过 HTTPS 直接下载');
  const hash = crypto.createHash('sha256'); let size = 0;
  for await (const chunk of response.body) {
    hash.update(chunk); size += chunk.length;
    if (size > expected.size) { await response.body.cancel().catch(() => {}); throw Error('下载文件大小不匹配'); }
  }
  assert(size === expected.size && hash.digest('hex') === expected.sha256, '云端下载文件与本地校验值不同，未发布');
}
async function upload(manager, filename) {
  const suffix = path.extname(filename).toLowerCase();
  assert(['.apk', '.wgt'].includes(suffix), '请选择 APK 或 WGT 文件');
  fs.mkdirSync(path.join(output, 'staging'), { recursive: true });
  const snapshot = path.join(output, 'staging', crypto.randomUUID() + suffix);
  fs.copyFileSync(filename, snapshot);
  try {
    const artifact = inspect(snapshot);
    artifact.filename = path.basename(filename);
    const cloudPath = `app-updates/${config.appid}/${artifact.type}/${artifact.version}/${artifact.sha256}${suffix}`;
    await require('./storage-protection.cjs').protectArtifact(manager, cloudPath);
    // Security rules propagate asynchronously. Do not publish a new key until
    // its client write protection has had the documented three minutes.
    const protectionReadyAt = Date.now() + 185000;
    await manager.storage.uploadFile({ localPath: snapshot, cloudPath });
    const url = `${config.downloadBase.replace(/\/$/, '')}/${cloudPath}`;
    await verifyDownload(url, artifact);
    const result = { ...artifact, cloudPath, url, protectionReadyAt, verifiedAt: new Date().toISOString() };
    backup(result, 'uploaded');
    return result;
  } finally { fs.unlinkSync(snapshot); }
}
async function save(db, request) {
  const next = domain.draft(request.record, request.artifact);
  const previous = await read(db.collection(config.collection).doc(next._id));
  if (previous) backup(previous, 'before-save');
  return db.runTransaction(async tx => {
    const ref = tx.collection(config.collection).doc(next._id);
    const current = await read(ref);
    assert(!current?.stable_publish, '已发布版本不能直接修改，请先下线或创建新版本');
    assert((current?.revision || 0) === (request.revision || 0), '版本已被其他窗口修改，请刷新后重试');
    const record = { ...next, revision: (current?.revision || 0) + 1, createdAt: current?.createdAt || Date.now(), updatedAt: Date.now() };
    const { _id, ...data } = record;
    await ref.set(data);
    return record;
  });
}
async function setPublished(db, request, publish) {
  assert(typeof request.id === 'string' && request.id.startsWith(config.appid + '-'), '请选择本应用的版本');
  const previous = await read(db.collection(config.collection).doc(request.id));
  assert(previous, '版本不存在');
  if (publish) {
    domain.validate(previous);
    assert((previous.type === 'native_app' && previous.uni_platform === 'ios') || previous.cloudbase_ready === true,
      '历史包可以归档，但不能作为腾讯云新版本发布；请使用包含腾讯云更新逻辑的安装包');
    if (previous.artifact?.protectionReadyAt > Date.now()) {
      throw Error(`安装包写保护正在生效，请在 ${Math.ceil((previous.artifact.protectionReadyAt - Date.now()) / 1000)} 秒后发布`);
    }
    if (previous.artifact) await verifyDownload(previous.url, previous.artifact);
    const records = await list(db);
    if (previous.artifact?.versionCode) {
      const others = records.filter(row => row._id !== previous._id && row.stable_publish && row.uni_platform === previous.uni_platform && row.type === 'native_app');
      for (const other of others) {
        if (domain.compareVersion(previous.version, other.version) > 0 && other.artifact?.versionCode) {
          assert(previous.artifact.versionCode > other.artifact.versionCode, 'Android versionCode 未递增，无法覆盖安装');
        }
      }
    }
  }
  backup(previous, publish ? 'before-publish' : 'before-withdraw');
  return db.runTransaction(async tx => {
    const ref = tx.collection(config.collection).doc(request.id);
    const current = await read(ref);
    assert(current && current.revision === request.revision && current.revision === previous.revision, '版本已改变，请刷新后重试');
    await ref.update({ stable_publish: publish, revision: current.revision + 1, updatedAt: Date.now(), ...(publish ? { publishedAt: Date.now() } : {}) });
    return { ...current, stable_publish: publish, revision: current.revision + 1 };
  });
}
async function setup(manager) {
  const names = await listCollectionNames(manager.database);
  if (!names.has(config.collection)) await manager.database.createCollection(config.collection);
  await manager.commonService().call({ Action: 'ModifyDatabaseACL', Param: { EnvId: config.envId, CollectionName: config.collection, AclTag: 'ADMINONLY' } });
  const acl = await manager.commonService().call({ Action: 'DescribeDatabaseACL', Param: { EnvId: config.envId, CollectionName: config.collection } });
  assert(acl.AclTag === 'ADMINONLY', '版本库权限校验失败');
  const table = await manager.database.describeCollection(config.collection);
  if (!table.Indexes.some(index => index.Name === 'app_published_id')) {
    await manager.database.updateCollection(config.collection, { CreateIndexes: [{ IndexName: 'app_published_id', MgoKeySchema: {
      MgoIndexKeys: [{ Name: 'appid', Direction: '1' }, { Name: 'stable_publish', Direction: '1' }, { Name: '_id', Direction: '1' }], MgoIsUnique: false
    } }] });
  }
  return { ready: true, envId: config.envId };
}
async function run(request) {
  if (request.action === 'inspect') return inspect(request.file);
  if (request.action === 'config') return { appid: config.appid, envId: config.envId, downloadBase: config.downloadBase };
  const { manager, db } = await connect();
  if (request.action === 'setup') return setup(manager);
  if (request.action === 'list') return list(db);
  if (request.action === 'upload') return upload(manager, request.file);
  if (request.action === 'save') return save(db, request);
  if (request.action === 'publish') return setPublished(db, request, true);
  if (request.action === 'withdraw') return setPublished(db, request, false);
  if (request.action === 'preview') {
    const records = await list(db);
    return domain.selectUpdate(records, { ...request.device, appid: config.appid, protocolVersion: 2 }, request.mode || 'current');
  }
  throw Error('不支持的操作');
}
module.exports = { run, connect, setup, save, setPublished, list, upload, verifyDownload, inspect, config };
if (require.main === module) {
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', value => { input += value; });
  process.stdin.on('end', async () => {
    try { const data = await run(JSON.parse(input)); console.log(JSON.stringify({ success: true, data })); }
    catch (error) { console.log(JSON.stringify({ success: false, error: error.code ? `${error.code}：云端操作失败，请检查 tcb login 登录态、权限和网络` : error.message })); process.exitCode = 1; }
  });
}
