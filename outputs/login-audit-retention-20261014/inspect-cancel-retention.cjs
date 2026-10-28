// Read-only cloud inspection. Saves local evidence and never mutates cloud resources.
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync, spawnSync } = require('node:child_process');
const acorn = require('acorn');
const root = path.resolve(__dirname, '../..');
const { manager, envId } = require(path.join(root, '回车键新网站/scripts/cloud-admin.cjs'));
const cliModules = path.join(process.env.CLOUDBASE_GLOBAL_ROOT || path.join(process.env.APPDATA, 'npm/node_modules'), '@cloudbase/cli/node_modules');
const AdmZip = require(path.join(cliModules, 'adm-zip'));
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const normalize = value => value.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').trim();
const safeError = error => ({ code: typeof error.code === 'string' ? error.code : error.name || 'ERROR' });
const configurationFields = ['Runtime', 'Timeout', 'MemorySize', 'Handler', 'InstallDependency', 'Environment',
  'VpcConfig', 'Role', 'Layers', 'DeadLetterConfig', 'AsyncRunEnable', 'TraceEnable', 'CfsConfig',
  'PublicNetConfig', 'L5Enable', 'UseGpu', 'DnsCache', 'InstanceConcurrencyConfig', 'Description', 'Tags',
  'Type', 'EipConfig', 'Triggers', 'InitTimeout', 'InstanceType', 'WebService', 'HTTPServiceConfig',
  'ProtocolType', 'GPUConfig', 'ClsLogsetId', 'ClsTopicId', 'Stamp'];
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
}
function analyze(code) {
  const ast = acorn.parse(code, { ecmaVersion: 2022, sourceType: 'script', locations: true });
  const auditReferences = [];
  const collectionCalls = [];
  const cleanupCalls = [];
  const enumerationCalls = [];
  const collectionArrays = [];
  const safeCollections = /^[a-zA-Z][a-zA-Z0-9_]*$/;
  function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'Literal' && node.value === 'login_logs') auditReferences.push(node.loc.start.line);
    if (node.type === 'ArrayExpression' && node.elements.length && node.elements.every(item => item && item.type === 'Literal' && typeof item.value === 'string' && safeCollections.test(item.value))) {
      collectionArrays.push({ line: node.loc.start.line, values: node.elements.map(item => item.value) });
    }
    if (node.type === 'CallExpression') {
      const callee = node.callee;
      const method = callee.type === 'MemberExpression' ? callee.property.name : callee.name;
      const first = node.arguments[0];
      const argument = first && first.type === 'Literal' && typeof first.value === 'string' && safeCollections.test(first.value)
        ? first.value : first && first.type === 'Identifier' ? `[variable:${first.name}]` : '[expression]';
      if (method === 'collection') collectionCalls.push({ line: node.loc.start.line, collection: argument });
      if (['removeWhere', 'updateWhere', 'updateMatching', 'drain'].includes(method)) cleanupCalls.push({ line: node.loc.start.line, helper: method, collection: argument });
      if (['listCollections', 'listTables', 'listCollectionNames', 'getCollections'].includes(method)) enumerationCalls.push({ line: node.loc.start.line, method });
    }
    for (const [key, value] of Object.entries(node)) {
      if (key === 'loc' || key === 'start' || key === 'end') continue;
      if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value === 'object') walk(value);
    }
  }
  walk(ast);
  return { auditCollectionLiteralLines: auditReferences, collectionCalls, cleanupCalls, collectionArrays, enumerationCalls };
}
async function download(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw Object.assign(new Error('Download failed'), { code: `HTTP_${response.status}` });
  const chunks = [];
  let bytes = 0;
  for await (const chunk of response.body) {
    bytes += chunk.length;
    if (bytes > 150 * 1024 * 1024) throw Object.assign(new Error('Download limit'), { code: 'SOURCE_ZIP_TOO_LARGE' });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

(async () => {
  const backupDirectory = path.join(__dirname, 'cloud-before');
  await fs.mkdir(backupDirectory, { recursive: true });
  const snapshotPath = path.join(__dirname, 'cancelAccount-local-start.js');
  const localSnapshot = await fs.readFile(snapshotPath, 'utf8');
  const localCurrent = await fs.readFile(path.join(root, 'functions/cancelAccount/index.js'), 'utf8');
  const app = await manager();
  await app.env.getEnvInfo();
  const detail = await app.functions.getFunctionDetail('cancelAccount');
  const address = await app.functions.getFunctionDownloadUrl('cancelAccount');
  const buffer = await download(address.Url);
  const zipPath = path.join(backupDirectory, 'cancelAccount.zip');
  await fs.writeFile(zipPath, buffer, { flag: 'wx' });
  const zip = new AdmZip(buffer);
  const entries = zip.getEntries().filter(entry => !entry.isDirectory);
  const indexEntry = zip.getEntry('index.js');
  if (!indexEntry) throw Object.assign(new Error('Index missing'), { code: 'INDEX_MISSING' });
  const remoteCode = indexEntry.getData().toString('utf8');
  const sourcePath = path.join(backupDirectory, 'cancelAccount-index.js');
  await fs.writeFile(sourcePath, remoteCode, { flag: 'wx' });
  const packageEntry = zip.getEntry('package.json');
  const packageJson = packageEntry ? JSON.parse(packageEntry.getData().toString('utf8')) : null;
  const dependencies = packageJson ? Object.fromEntries(Object.entries(packageJson.dependencies || {}).map(([name, version]) => [name,
    typeof version === 'string' && /^[~^<>=*|.\d\svx+-]+$/.test(version) ? version : '[non-registry spec redacted]'])) : null;
  let gitHead;
  try { gitHead = execFileSync('git', ['show', 'HEAD:functions/cancelAccount/index.js'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); }
  catch (_) { gitHead = null; }
  const fileSha256 = Object.fromEntries(entries.map(entry => [entry.entryName, sha(entry.getData())]));
  const analysis = analyze(remoteCode);
  const configuration = Object.fromEntries(configurationFields.filter(key => detail[key] !== undefined).map(key => [key, detail[key]]));
  const diff = spawnSync('git', ['diff', '--no-index', '--numstat', sourcePath, snapshotPath], { cwd: root, encoding: 'utf8' });
  const counts = diff.stdout.trim().split('\t');
  const report = {
    mode: 'read-only', envId, inspectedAt: new Date().toISOString(), functionName: 'cancelAccount',
    runtime: detail.Runtime, timeout: detail.Timeout, memorySize: detail.MemorySize, handler: detail.Handler,
    status: detail.Status, installDependency: detail.InstallDependency, layerCount: (detail.Layers || []).length,
    configurationSha256: sha(JSON.stringify(canonical(configuration))), dependencies,
    backup: { file: path.relative(root, zipPath).replace(/\\/g, '/'), zipSha256: sha(buffer), bytes: buffer.length,
      sourceFile: path.relative(root, sourcePath).replace(/\\/g, '/'), regularFileCount: entries.length,
      hasBundledDependencies: entries.some(entry => entry.entryName.startsWith('node_modules/')) },
    sourceComparison: { remoteSha256: sha(remoteCode), localSnapshotSha256: sha(localSnapshot), currentLocalSha256: sha(localCurrent),
      snapshotAlreadyHadRetentionComment: localSnapshot.includes('login logs are retained after cancellation'),
      remoteEqualsSnapshot: normalize(remoteCode) === normalize(localSnapshot),
      remoteEqualsCurrent: normalize(remoteCode) === normalize(localCurrent), remoteEqualsGitHead: gitHead !== null && normalize(remoteCode) === normalize(gitHead),
      remoteLines: normalize(remoteCode).split('\n').length, snapshotLines: normalize(localSnapshot).split('\n').length,
      localAddedLines: Number(counts[0]), localRemovedLines: Number(counts[1]) },
    analysis,
    fileSha256
  };
  await fs.writeFile(path.join(__dirname, 'cancelAccount-readiness.json'), JSON.stringify(report, null, 2));
  const { fileSha256: omitted, ...summary } = report;
  console.log(JSON.stringify(summary, null, 2));
})().catch(error => { console.error(JSON.stringify({ inspectError: safeError(error) })); process.exitCode = 1; });
