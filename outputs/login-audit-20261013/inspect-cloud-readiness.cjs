// Read-only cloud inspection. Downloads code backups locally, never updates cloud resources.
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const { manager, envId } = require(path.join(root, '回车键新网站/scripts/cloud-admin.cjs'));
const cliModules = path.join(process.env.CLOUDBASE_GLOBAL_ROOT || path.join(process.env.APPDATA, 'npm/node_modules'), '@cloudbase/cli/node_modules');
const AdmZip = require(path.join(cliModules, 'adm-zip'));
const targets = {
  loginWithCredentials: 'functions/loginWithCredentials',
  loginWithPhone: 'functions/loginWithPhone',
  loginWithWechat: 'functions/loginWithWechat',
  registerUser: 'functions/registerUser',
  'github-auth': 'functions/github-auth',
  webReader: '回车键新网站/cloudfunctions/webReader'
};
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const normalize = value => value.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').trim();
const safeError = error => ({ code: typeof error.code === 'string' ? error.code : error.name || 'ERROR' });
const redactDependencySpecs = deps => Object.fromEntries(Object.entries(deps || {}).map(([name, spec]) => [name,
  typeof spec === 'string' && /^[~^<>=*|.\d\svx+-]+$/.test(spec) ? spec : '[non-registry spec redacted]']));

async function downloadZip(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw Object.assign(new Error('Code backup download failed'), { code: `HTTP_${response.status}` });
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > 150 * 1024 * 1024) throw Object.assign(new Error('Backup exceeds inspection size limit'), { code: 'ZIP_TOO_LARGE' });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function inspectFunction(app, name, localPath) {
  let detail;
  try { detail = await app.functions.getFunctionDetail(name); }
  catch (error) { return { name, exists: false, inspectError: safeError(error) }; }
  const result = {
    name, exists: true, runtime: detail.Runtime, timeout: detail.Timeout,
    memorySize: detail.MemorySize, handler: detail.Handler, status: detail.Status,
    installDependency: detail.InstallDependency == null ? 'not returned by GetFunction' : detail.InstallDependency,
    layerCount: Array.isArray(detail.Layers) ? detail.Layers.length : 0,
    codeSha256: detail.CodeSha256 || null
  };
  try {
    const address = await app.functions.getFunctionDownloadUrl(name);
    const buffer = await downloadZip(address.Url);
    const destination = path.join(__dirname, 'cloud-before', `${name}.zip`);
    await fs.writeFile(destination, buffer);
    const zip = new AdmZip(buffer);
    const entries = zip.getEntries();
    const entryAt = filename => entries.find(entry => !entry.isDirectory && entry.entryName === filename) ||
      entries.find(entry => !entry.isDirectory && entry.entryName.endsWith(`/${filename}`) && !entry.entryName.includes('node_modules/'));
    const packageEntry = entryAt('package.json');
    const remotePackage = packageEntry ? JSON.parse(packageEntry.getData().toString('utf8')) : null;
    const localPackage = JSON.parse(await fs.readFile(path.join(root, localPath, 'package.json'), 'utf8'));
    const indexEntry = entryAt('index.js');
    const remoteIndex = indexEntry ? indexEntry.getData().toString('utf8') : null;
    let baselineIndex;
    try { baselineIndex = execFileSync('git', ['show', `HEAD:${localPath}/index.js`], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); }
    catch (_) { baselineIndex = null; }
    const localIndex = await fs.readFile(path.join(root, localPath, 'index.js'), 'utf8');
    result.backup = {
      file: path.relative(root, destination).replace(/\\/g, '/'), bytes: buffer.length,
      zipSha256: hash(buffer), entries: entries.length,
      hasBundledDependencies: entries.some(entry => entry.entryName.startsWith('node_modules/') || entry.entryName.includes('/node_modules/')),
      indexPath: indexEntry ? indexEntry.entryName : null
    };
    result.dependencies = remotePackage ? redactDependencySpecs(remotePackage.dependencies) : null;
    result.localDependencies = redactDependencySpecs(localPackage.dependencies);
    result.dependencySpecsEqual = !!remotePackage && JSON.stringify(remotePackage.dependencies || {}) === JSON.stringify(localPackage.dependencies || {});
    result.indexComparison = {
      baselineAvailable: baselineIndex !== null,
      remoteEqualsGitHead: remoteIndex !== null && baselineIndex !== null && normalize(remoteIndex) === normalize(baselineIndex),
      remoteEqualsCurrentLocal: remoteIndex !== null && normalize(remoteIndex) === normalize(localIndex),
      remoteSha256: remoteIndex === null ? null : hash(normalize(remoteIndex)),
      gitHeadSha256: baselineIndex === null ? null : hash(normalize(baselineIndex)),
      currentLocalSha256: hash(normalize(localIndex)),
      remoteLines: remoteIndex === null ? null : normalize(remoteIndex).split('\n').length,
      gitHeadLines: baselineIndex === null ? null : normalize(baselineIndex).split('\n').length,
      currentLocalLines: normalize(localIndex).split('\n').length
    };
    // Only summarize known implementation markers; never print source or runtime environment variables.
    const markers = ['prepareWechatLogin', 'safeUser', 'wechatLogin', 'runTransaction', 'recordLogin', 'login-log', 'loginAudit', 'lastLoginAt', 'clientInfo'];
    result.sourceMarkers = Object.fromEntries(markers.map(marker => [marker, {
      remote: !!remoteIndex && remoteIndex.includes(marker), baseline: !!baselineIndex && baselineIndex.includes(marker), local: localIndex.includes(marker)
    }]));
  } catch (error) { result.backupError = safeError(error); }
  return result;
}

(async () => {
  await fs.mkdir(path.join(__dirname, 'cloud-before'), { recursive: true });
  const app = await manager();
  // Initialize cloud environment once before parallel, read-only requests.
  await app.env.getEnvInfo();
  let collection;
  try {
    const table = await app.database.describeCollection('login_logs');
    collection = { name: 'login_logs', exists: true, indexes: (table.Indexes || []).map(item => ({ name: item.Name, keys: item.Keys, unique: item.Unique })) };
  } catch (error) { collection = { name: 'login_logs', exists: false, inspectError: safeError(error) }; }
  const results = await Promise.allSettled(Object.entries(targets).map(([name, localPath]) => inspectFunction(app, name, localPath)));
  const functions = results.map((result, index) => result.status === 'fulfilled' ? result.value : {
    name: Object.keys(targets)[index], inspectError: safeError(result.reason)
  });
  const report = { envId, inspectedAt: new Date().toISOString(), mode: 'read-only', collection, functions };
  await fs.writeFile(path.join(__dirname, 'cloud-readiness.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
})().catch(error => { console.error(JSON.stringify({ inspectError: safeError(error) })); process.exitCode = 1; });
