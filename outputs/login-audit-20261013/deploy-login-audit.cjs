// Default is local-only preparation. Cloud mutations require the explicit --apply argument.
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const acorn = require('acorn');

const root = path.resolve(__dirname, '../..');
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
const allowedFiles = ['index.js', '_lib/login-audit.js'];
const stageRoot = path.join(__dirname, 'staged');
const packageRoot = path.join(__dirname, 'packages');
const metadataPath = path.join(__dirname, 'deployment-state.json');
const indexes = [
  { name: 'loginTime_desc', keys: [['loginTime', '-1']] },
  { name: 'userId_loginTime_desc', keys: [['userId', '1'], ['loginTime', '-1']] },
  { name: 'poemId_loginTime_desc', keys: [['poemId', '1'], ['loginTime', '-1']] },
  { name: 'platform_loginTime_desc', keys: [['clientInfo.platform', '1'], ['loginTime', '-1']] }
];
const normalize = value => value.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').trim();
const sha = value => crypto.createHash('sha256').update(value).digest('hex');

function fail(code, detail) {
  const error = new Error(detail || code);
  error.code = code;
  error.safeDetail = detail;
  throw error;
}

function safeError(error) {
  const result = { code: typeof error.code === 'string' ? error.code : error.name || 'ERROR' };
  if (error.safeDetail) result.detail = error.safeDetail;
  if (typeof error.requestId === 'string') result.requestId = error.requestId;
  return result;
}

function replaceOnce(source, before, after, label) {
  const parts = source.split(before);
  if (parts.length !== 2) fail('PATCH_ANCHOR_MISMATCH', `webReader: ${label}`);
  return parts[0] + after + parts[1];
}

function patchWebReader(source) {
  let code = source.replace(/\r\n/g, '\n');
  code = replaceOnce(code, 'const cloud = require("wx-server-sdk");',
    'const cloud = require("wx-server-sdk");\nconst { recordSuccessfulLogin } = require("./_lib/login-audit");', 'audit import');
  code = replaceOnce(code, 'exports.main = async (event = {}) => {',
    'exports.main = async (event = {}, context) => {', 'context argument');
  code = replaceOnce(code, '.field({ _openid: true, password: true })',
    '.field({ _openid: true, poemId: true, password: true })', 'account fields');
  code = replaceOnce(code,
    '          data: { owner: account._openid, caller: callerId(), expiresAt },\n        });\n      return {',
    '          data: { owner: account._openid, caller: callerId(), expiresAt },\n        });\n' +
    '      const profile = await ownerProfile(account._openid);\n' +
    "      await recordSuccessfulLogin({ db, user: account, event, context, wxContext: cloud.getWXContext(), loginMethod: 'password' });\n" +
    '      return {', 'profile and durable audit before success');
  code = replaceOnce(code, '        user: await ownerProfile(account._openid),',
    '        user: profile,', 'reuse validated profile');
  code = replaceOnce(code,
    '  } catch (error) {\n    // No event, credentials, access tokens, or user documents in logs/errors.',
    "  } catch (error) {\n    if (error.code === 'LOGIN_AUDIT_UNAVAILABLE') return { success: false, code: error.code, message: error.message };\n" +
    '    // No event, credentials, access tokens, or user documents in logs/errors.', 'audit error response');
  if (code.includes('createPostsDatabase') || code.includes('withPostResponse')) fail('UNEXPECTED_POSTS_ADAPTER', 'webReader must preserve its online database behavior');
  return code;
}

function zipEntries(zipBuffer) {
  const zip = new AdmZip(zipBuffer);
  const entries = new Map();
  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue;
    const name = entry.entryName;
    if (name.startsWith('/') || name.includes('\\') || name.split('/').includes('..') || entries.has(name)) fail('UNSAFE_ZIP_ENTRY');
    const buffer = entry.getData();
    entries.set(name, { sha256: sha(buffer), buffer });
  }
  return entries;
}

function checkSyntax(name, code, runtime) {
  const ecmaVersion = runtime === 'Nodejs10.15' ? 2018 : 2022;
  try { acorn.parse(code, { ecmaVersion, sourceType: 'script', allowHashBang: true }); }
  catch (error) { fail('RUNTIME_SYNTAX_MISMATCH', `${name}, ${runtime}, line ${error.loc && error.loc.line || '?'}`); }
  if (runtime === 'Nodejs10.15' && /require\(['"]node:|\b(?:randomUUID|findLast|findLastIndex|structuredClone)\s*\(/.test(code)) {
    fail('RUNTIME_API_MISMATCH', `${name}: newer Node API`);
  }
}

function sameKeys(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function validateVerifiedReceipt(receipt, envId) {
  if (!receipt || receipt.mode !== 'apply' || receipt.status !== 'complete' || receipt.envId !== envId ||
      !Array.isArray(receipt.functions) || receipt.functions.length !== Object.keys(targets).length ||
      !Array.isArray(receipt.events)) fail('UNVERIFIED_PREVIOUS_RECEIPT');
  for (const name of Object.keys(targets)) {
    const records = receipt.functions.filter(item => item.name === name);
    if (records.length !== 1 || !records[0].files ||
        !sameKeys(Object.keys(records[0].files).sort(), allowedFiles.slice().sort()) ||
        allowedFiles.some(filename => !/^[a-f0-9]{64}$/.test(records[0].files[filename]))) fail('PREVIOUS_RECEIPT_FILES_INVALID', name);
    const verified = receipt.events.some(event => event.name === name &&
      ['deployed-verified', 'already-deployed-verified'].includes(event.status));
    if (!verified) fail('PREVIOUS_RECEIPT_NOT_VERIFIED', name);
  }
  return receipt;
}

async function previousVerifiedDeployment(envId) {
  const savedV1Path = path.join(__dirname, 'deployment-state-v1.json');
  let currentText;
  let current;
  try {
    currentText = await fs.readFile(metadataPath, 'utf8');
    current = JSON.parse(currentText);
  } catch (error) { if (error.code !== 'ENOENT') fail('PREVIOUS_RECEIPT_INVALID'); }
  if (current && current.status === 'complete') {
    validateVerifiedReceipt(current, envId);
    try { await fs.writeFile(savedV1Path, currentText, { flag: 'wx' }); }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      // The first verified receipt is immutable even after later successful releases.
      validateVerifiedReceipt(JSON.parse(await fs.readFile(savedV1Path, 'utf8')), envId);
    }
    return { receipt: current, sha256: sha(currentText) };
  }
  // A retry after an interrupted second rollout may encounter v1 or the new version.
  // Trust only a previously completed, verified receipt; never accept a partial receipt as a baseline.
  try {
    const saved = await fs.readFile(savedV1Path, 'utf8');
    return { receipt: validateVerifiedReceipt(JSON.parse(saved), envId), sha256: sha(saved) };
  } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

async function prepare() {
  const readiness = JSON.parse(await fs.readFile(path.join(__dirname, 'cloud-readiness.json'), 'utf8'));
  const previous = await previousVerifiedDeployment(readiness.envId);
  const sharedHelper = await fs.readFile(path.join(root, 'functions/_shared/login-audit.js'), 'utf8');
  const helperBuffer = Buffer.from(sharedHelper);
  await fs.mkdir(stageRoot, { recursive: true });
  await fs.mkdir(packageRoot, { recursive: true });
  const prepared = [];
  for (const [name, localPath] of Object.entries(targets)) {
    const online = readiness.functions.find(item => item.name === name);
    if (!online || !online.exists || online.status !== 'Active' || !online.backup) fail('READINESS_INCOMPLETE', name);
    const baselineZip = await fs.readFile(path.join(root, online.backup.file));
    if (sha(baselineZip) !== online.backup.zipSha256) fail('BACKUP_HASH_MISMATCH', name);
    const originalEntries = zipEntries(baselineZip);
    const originalIndex = originalEntries.get('index.js');
    if (!originalIndex) fail('MISSING_BASELINE_ENTRY', name);
    const baselineCode = originalIndex.buffer.toString('utf8');
    if (sha(normalize(baselineCode)) !== online.indexComparison.remoteSha256) fail('BASELINE_INDEX_HASH_MISMATCH', name);
    const localCode = await fs.readFile(path.join(root, localPath, 'index.js'), 'utf8');
    let stagedCode;
    if (name === 'webReader') {
      stagedCode = patchWebReader(baselineCode);
      // Confirm the root's current audit change is exactly the same patch, excluding its pre-existing posts wrapper.
      let localWithoutAdapter = replaceOnce(localCode.replace(/\r\n/g, '\n'),
        "const { createPostsDatabase, withPostResponse } = require('./_lib/posts');\n", '', 'remove local-only adapter import');
      localWithoutAdapter = replaceOnce(localWithoutAdapter, 'const db = createPostsDatabase(cloud.database());',
        'const db = cloud.database();', 'preserve online database');
      localWithoutAdapter = replaceOnce(localWithoutAdapter, '\nexports.main = withPostResponse(exports.main);', '', 'preserve online export');
      if (normalize(localWithoutAdapter) !== normalize(stagedCode)) fail('LOCAL_WEBREADER_AUDIT_CHANGED', name);
    } else {
      if (!online.indexComparison.remoteEqualsGitHead) fail('BASELINE_DRIFT', name);
      const head = execFileSync('git', ['show', `HEAD:${localPath}/index.js`], {
        cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']
      });
      if (normalize(head) !== normalize(baselineCode)) fail('GIT_BASELINE_CHANGED', name);
      stagedCode = localCode;
    }
    if (!stagedCode.includes('recordSuccessfulLogin') || !stagedCode.includes('./_lib/login-audit')) fail('AUDIT_PATCH_MISSING', name);
    const copiedHelper = await fs.readFile(path.join(root, localPath, '_lib/login-audit.js'), 'utf8');
    if (copiedHelper !== sharedHelper) fail('STALE_HELPER_COPY', name);
    checkSyntax(`${name}/index.js`, stagedCode, online.runtime);
    checkSyntax(`${name}/_lib/login-audit.js`, sharedHelper, online.runtime);
    const stagedDirectory = path.join(stageRoot, name);
    await fs.mkdir(path.join(stagedDirectory, '_lib'), { recursive: true });
    const stagedIndexBuffer = Buffer.from(stagedCode);
    await fs.writeFile(path.join(stagedDirectory, 'index.js'), stagedIndexBuffer);
    await fs.writeFile(path.join(stagedDirectory, '_lib/login-audit.js'), helperBuffer);
    const zip = new AdmZip();
    zip.addFile('index.js', stagedIndexBuffer);
    zip.addFile('_lib/login-audit.js', helperBuffer);
    const updateZip = zip.toBuffer();
    const packageEntries = zipEntries(updateZip);
    if (!sameKeys(Array.from(packageEntries.keys()).sort(), allowedFiles.slice().sort())) fail('PACKAGE_FILE_ALLOWLIST_MISMATCH', name);
    const packagePath = path.join(packageRoot, `${name}.zip`);
    await fs.writeFile(packagePath, updateZip);
    const previousVerifiedFiles = previous ? previous.receipt.functions.find(item => item.name === name).files : null;
    prepared.push({ name, online, originalEntries, packageEntries, previousVerifiedFiles, updateZip, packagePath,
      summary: { name, status: 'prepared', baselineZipSha256: sha(baselineZip), packageSha256: sha(updateZip),
        originalFileCount: originalEntries.size, previousVerifiedFiles,
        files: Object.fromEntries(Array.from(packageEntries, ([filename, entry]) => [filename, entry.sha256])) } });
  }
  const summary = { mode: 'dry-run', envId: readiness.envId, status: 'prepared', preparedAt: new Date().toISOString(),
    previousReceiptSha256: previous ? previous.sha256 : null, functions: prepared.map(item => item.summary) };
  await fs.writeFile(path.join(__dirname, 'dry-run-plan.json'), JSON.stringify(summary, null, 2));
  return { readiness, prepared, summary };
}

function compareOnlineEntries(item, actualEntries) {
  // Every pre-existing file outside the two audited files must remain byte-for-byte identical.
  for (const [filename, original] of item.originalEntries) {
    if (allowedFiles.includes(filename)) continue;
    if (!actualEntries.has(filename) || actualEntries.get(filename).sha256 !== original.sha256) fail('ONLINE_OTHER_FILE_DRIFT', item.name);
  }
  for (const filename of actualEntries.keys()) {
    if (!item.originalEntries.has(filename) && !allowedFiles.includes(filename)) fail('ONLINE_NEW_FILE_DRIFT', item.name);
  }
  const baseline = allowedFiles.every(filename => {
    const original = item.originalEntries.get(filename);
    const actual = actualEntries.get(filename);
    return original ? !!actual && actual.sha256 === original.sha256 : !actual;
  });
  const deployed = allowedFiles.every(filename => {
    const actual = actualEntries.get(filename);
    return !!actual && actual.sha256 === item.packageEntries.get(filename).sha256;
  });
  const previous = !!item.previousVerifiedFiles && allowedFiles.every(filename => {
    const actual = actualEntries.get(filename);
    return !!actual && actual.sha256 === item.previousVerifiedFiles[filename];
  });
  if (!baseline && !deployed && !previous) fail('ONLINE_AUDIT_FILE_DRIFT', item.name);
  return deployed ? 'already-deployed' : previous ? 'previous-deployment' : 'baseline';
}

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
function configurationSha(detail) {
  return sha(JSON.stringify(canonical(Object.fromEntries(configurationFields.filter(key => detail[key] !== undefined).map(key => [key, detail[key]])))));
}

async function downloadZip(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!response.ok) fail(`HTTP_${response.status}`, 'Cloud source download failed');
  const chunks = [];
  let bytes = 0;
  for await (const chunk of response.body) {
    bytes += chunk.length;
    if (bytes > 150 * 1024 * 1024) fail('SOURCE_ZIP_TOO_LARGE');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function inspectOnline(app, item, label) {
  const detail = await app.functions.getFunctionDetail(item.name);
  if (detail.Status !== 'Active') fail('FUNCTION_NOT_ACTIVE', item.name);
  for (const [localKey, remoteKey] of [['runtime', 'Runtime'], ['timeout', 'Timeout'], ['memorySize', 'MemorySize'], ['handler', 'Handler'], ['installDependency', 'InstallDependency']]) {
    if (item.online[localKey] !== detail[remoteKey]) fail('ONLINE_CONFIGURATION_DRIFT', item.name);
  }
  const { Url } = await app.functions.getFunctionDownloadUrl(item.name);
  const buffer = await downloadZip(Url);
  const actualEntries = zipEntries(buffer);
  const state = compareOnlineEntries(item, actualEntries);
  await fs.mkdir(path.join(__dirname, 'cloud-verification'), { recursive: true });
  await fs.writeFile(path.join(__dirname, 'cloud-verification', `${item.name}-${label}.zip`), buffer);
  return { state, configurationSha256: configurationSha(detail), zipSha256: sha(buffer), unchangedOtherFileCount:
    Array.from(item.originalEntries.keys()).filter(filename => !allowedFiles.includes(filename)).length };
}

async function waitActive(app, name) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const detail = await app.functions.getFunctionDetail(name);
    if (detail.Status === 'Active') return;
    if (/Failed|Error/.test(detail.Status)) fail('FUNCTION_UPDATE_FAILED', name);
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  fail('FUNCTION_UPDATE_TIMEOUT', name);
}

function isMissingCollection(error) {
  return error && (error.code === 'ResourceNotFound' || error.code === 'ResourceNotFound.TableNotFound');
}
function assertIndex(existing, wanted) {
  const keys = (existing.Keys || []).map(key => [key.Name, String(key.Direction)]);
  if (JSON.stringify(keys) !== JSON.stringify(wanted.keys) || existing.Unique !== false) fail('INDEX_DEFINITION_MISMATCH', wanted.name);
}

async function ensureCollection(app, envId, record) {
  let table;
  try { table = await app.database.describeCollection('login_logs'); }
  catch (error) {
    if (!isMissingCollection(error)) throw error;
    const result = await app.database.createCollection('login_logs');
    await record({ scope: 'login_logs', status: 'created', requestId: result.RequestId || null });
    table = await app.database.describeCollection('login_logs');
  }
  const acl = await app.commonService().call({ Action: 'ModifyDatabaseACL',
    Param: { EnvId: envId, CollectionName: 'login_logs', AclTag: 'ADMINONLY' } });
  await record({ scope: 'login_logs', status: 'ADMINONLY', requestId: acl.RequestId || null });
  const missing = [];
  for (const wanted of indexes) {
    const existing = (table.Indexes || []).find(index => index.Name === wanted.name);
    if (existing) assertIndex(existing, wanted);
    else missing.push({ IndexName: wanted.name, MgoKeySchema: {
      MgoIndexKeys: wanted.keys.map(([Name, Direction]) => ({ Name, Direction })), MgoIsUnique: false
    } });
  }
  if (missing.length) {
    const result = await app.database.updateCollection('login_logs', { CreateIndexes: missing });
    await record({ scope: 'login_logs', status: 'indexes-requested', requestId: result.RequestId || null });
  }
  for (let attempt = 0; attempt < 30; attempt++) {
    table = await app.database.describeCollection('login_logs');
    const complete = indexes.every(wanted => {
      const existing = (table.Indexes || []).find(index => index.Name === wanted.name);
      if (!existing) return false;
      assertIndex(existing, wanted);
      return true;
    });
    if (complete) { await record({ scope: 'login_logs', status: 'indexes-verified' }); return; }
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  fail('INDEX_CREATION_TIMEOUT');
}

async function apply(preparation) {
  // Deferred import ensures dry-run never authenticates or calls any cloud API.
  const { manager, envId } = require(path.join(root, '回车键新网站/scripts/cloud-admin.cjs'));
  if (envId !== preparation.readiness.envId) fail('ENVIRONMENT_MISMATCH');
  const app = await manager();
  await app.env.getEnvInfo();
  const state = { mode: 'apply', envId, status: 'preflight', startedAt: new Date().toISOString(), events: [],
    previousReceiptSha256: preparation.summary.previousReceiptSha256,
    functions: preparation.prepared.map(item => item.summary) };
  const record = async event => {
    state.events.push({ time: new Date().toISOString(), ...event });
    await fs.writeFile(metadataPath, JSON.stringify(state, null, 2));
    console.log(JSON.stringify(event));
  };
  try {
    // Inspect every target before the first cloud mutation, so known drift cannot leave a partial rollout.
    for (const item of preparation.prepared) {
      item.before = await inspectOnline(app, item, 'preflight');
      await record({ name: item.name, status: item.before.state, zipSha256: item.before.zipSha256,
        configurationSha256: item.before.configurationSha256 });
    }
    await ensureCollection(app, envId, record);
    const namespace = app.functions.getFunctionConfig().namespace;
    for (const item of preparation.prepared) {
      // Recheck immediately before each update to catch changes made after preflight.
      const current = await inspectOnline(app, item, 'before-update');
      if (current.configurationSha256 !== item.before.configurationSha256) fail('CONFIGURATION_CHANGED_AFTER_PREFLIGHT', item.name);
      if (current.state === 'already-deployed') {
        await record({ name: item.name, status: 'already-deployed-verified', zipSha256: current.zipSha256,
          configurationSha256: current.configurationSha256, unchangedOtherFileCount: current.unchangedOtherFileCount });
        continue;
      }
      const result = await app.commonService('scf').call({ Action: 'UpdateFunctionIncrementalCode',
        Param: { FunctionName: item.name, Namespace: namespace, AddFiles: item.updateZip.toString('base64') } });
      await record({ name: item.name, status: 'update-requested', requestId: result.RequestId || null,
        packageSha256: item.summary.packageSha256 });
      await waitActive(app, item.name);
      const after = await inspectOnline(app, item, 'after-update');
      if (after.state !== 'already-deployed') fail('UPDATE_SOURCE_VERIFICATION_FAILED', item.name);
      if (after.configurationSha256 !== item.before.configurationSha256) fail('UPDATE_CONFIGURATION_CHANGED', item.name);
      await record({ name: item.name, status: 'deployed-verified', zipSha256: after.zipSha256,
        configurationSha256: after.configurationSha256, unchangedOtherFileCount: after.unchangedOtherFileCount });
    }
    state.status = 'complete';
    state.completedAt = new Date().toISOString();
    await fs.writeFile(metadataPath, JSON.stringify(state, null, 2));
    console.log(JSON.stringify({ mode: 'apply', status: 'complete' }));
  } catch (error) {
    state.status = 'failed';
    state.error = safeError(error);
    await fs.writeFile(metadataPath, JSON.stringify(state, null, 2));
    throw error;
  }
}

module.exports = { patchWebReader, zipEntries, checkSyntax, compareOnlineEntries, configurationSha, indexes, validateVerifiedReceipt };

if (require.main === module) (async () => {
  const argumentsList = process.argv.slice(2);
  if (argumentsList.length > 1 || argumentsList.some(argument => !['--dry-run', '--apply'].includes(argument))) fail('INVALID_ARGUMENTS');
  const preparation = await prepare();
  if (argumentsList[0] === '--apply') await apply(preparation);
  else console.log(JSON.stringify(preparation.summary, null, 2));
})().catch(error => { console.error(JSON.stringify({ status: 'failed', error: safeError(error) })); process.exitCode = 1; });
