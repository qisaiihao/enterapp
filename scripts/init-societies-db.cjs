'use strict';

// Local administration only. No authentication or cloud requests without --apply.
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const COLLECTIONS = Object.freeze([
  'societies',
  'society_applications',
  'society_names',
  'society_members',
  'society_join_requests',
  'society_follows',
  'society_publications',
  'society_news',
  'society_events',
  'society_calls',
  'society_audit_logs',
  'society_sessions',
  'society_auth_attempts',
  'society_registrations',
  'society_submissions',
  'society_notifications'
]);
const HELP = `高校诗社集合初始化（在本机运行，不是云函数）

  npm run init:societies-db                     仅预览，不连接云端
  npm run init:societies-db -- --apply           创建集合并设置管理端权限
  npm run init:societies-db -- --apply --env ENV_ID --region ap-shanghai

默认环境取自项目 cloudbaserc.json，地域沿用 CloudBase CLI 配置。
执行前请安装 CloudBase CLI 并运行 tcb login。
已有集合不重建；这 15 个集合的权限统一为 ADMINONLY，并逐一回读验证。
不会增删业务数据，不部署云函数，不创建索引，不修改其他集合或云存储。`;
const HINTS = {
  INVALID_ARGUMENT: '参数不正确，请运行 npm run init:societies-db -- --help。',
  INVALID_ENV: '环境 ID 缺失或格式不正确，请检查 cloudbaserc.json 或 --env。',
  INVALID_REGION: '地域格式不正确，例如 ap-shanghai。',
  CONFIG_UNREADABLE: '无法读取项目 cloudbaserc.json，请检查文件或用 --env 指定环境。',
  CLI_UNAVAILABLE: '未找到兼容的 CloudBase CLI。请安装 npm install -g @cloudbase/cli；自定义安装位置可设置 CLOUDBASE_GLOBAL_ROOT。',
  AUTH_REQUIRED: '无法取得有效的 CloudBase 登录凭据，请运行 tcb login 后重试。',
  INVALID_COLLECTION_LIST: '云端集合列表返回异常，已停止；请检查 CloudBase CLI/SDK 版本。',
  ACL_NOT_VERIFIED: '权限回读不是 ADMINONLY，未将此集合标记为完成。请检查云端规则后重试。'
};
function failure(code) { return Object.assign(new Error(HINTS[code] || code), { code }); }

function parseArgs(args) {
  const options = { apply: false, help: false };
  const seen = new Set();
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (seen.has(arg)) throw failure('INVALID_ARGUMENT');
    seen.add(arg);
    if (arg === '--apply') options.apply = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--env' || arg === '--region') {
      const value = args[++i];
      if (!value || value.startsWith('-')) throw failure('INVALID_ARGUMENT');
      options[arg === '--env' ? 'envId' : 'region'] = value;
    } else throw failure('INVALID_ARGUMENT');
  }
  return options;
}

function readConfig() {
  try { return JSON.parse(fs.readFileSync(path.join(root, 'cloudbaserc.json'), 'utf8').replace(/^\uFEFF/, '')); }
  catch { throw failure('CONFIG_UNREADABLE'); }
}

async function createManager({ envId, region }) {
  // Reuse the CLI's login/refresh logic; never copy credentials into project files.
  let cliRoot;
  let cliRequire;
  let checkAndGetCredential;
  let CloudBase;
  let getRegion;
  let getProxy;
  try {
    if (process.env.CLOUDBASE_GLOBAL_ROOT) {
      cliRoot = path.join(process.env.CLOUDBASE_GLOBAL_ROOT, '@cloudbase', 'cli');
    } else {
      try { cliRoot = path.dirname(require.resolve('@cloudbase/cli/package.json')); }
      catch {
        const globalRoot = process.platform === 'win32'
          ? path.join(process.env.APPDATA || '', 'npm', 'node_modules')
          : execFileSync('npm', ['root', '-g'], { encoding: 'utf8', timeout: 10000 }).trim();
        cliRoot = path.join(globalRoot, '@cloudbase', 'cli');
      }
    }
    cliRequire = createRequire(path.join(cliRoot, 'package.json'));
    ({ checkAndGetCredential } = cliRequire('./lib/utils/net/credential.js'));
    const managerModule = cliRequire('@cloudbase/manager-node');
    CloudBase = managerModule.default || managerModule;
    ({ getRegion } = cliRequire('@cloudbase/toolbox'));
    ({ getProxy } = cliRequire('./lib/utils/net/proxy.js'));
  } catch { throw failure('CLI_UNAVAILABLE'); }
  let credentials;
  try { credentials = await checkAndGetCredential(true); }
  catch { throw failure('AUTH_REQUIRED'); }
  if (!credentials?.secretId || !credentials?.secretKey) throw failure('AUTH_REQUIRED');
  return new CloudBase({
    envId,
    region: region || await getRegion(),
    proxy: getProxy(),
    secretId: credentials.secretId,
    secretKey: credentials.secretKey,
    token: credentials.token
  });
}

async function listCollectionNames(database) {
  const names = new Set();
  const limit = 100;
  for (let offset = 0; ; offset += limit) {
    // Unlike checkCollectionExists(), listing must propagate auth/network errors.
    const result = await database.listCollections({ MgoLimit: limit, MgoOffset: offset });
    if (!Array.isArray(result?.Collections) || result.Collections.length > limit) throw failure('INVALID_COLLECTION_LIST');
    for (const row of result.Collections) {
      if (!row || typeof row.CollectionName !== 'string' || !row.CollectionName || names.has(row.CollectionName)) {
        throw failure('INVALID_COLLECTION_LIST');
      }
      names.add(row.CollectionName);
    }
    if (result.Collections.length < limit) return names;
  }
}

async function initialize(manager, envId, log) {
  const state = { created: 0, existing: 0, ready: 0, stage: 'list', collection: null };
  try {
    const existing = await listCollectionNames(manager.database);
    const service = manager.commonService();
    for (const name of COLLECTIONS) {
      state.collection = name;
      state.stage = 'create';
      if (existing.has(name)) {
        state.existing++;
        log(`[已有] ${name}，跳过创建`);
      } else {
        await manager.database.createCollection(name);
        state.created++;
        log(`[创建] ${name}`);
      }
      // Reconcile existing collections too, so a failed ACL request is repaired on rerun.
      state.stage = 'permission';
      await service.call({
        Action: 'ModifyDatabaseACL',
        Param: { EnvId: envId, CollectionName: name, AclTag: 'ADMINONLY' }
      });
      state.stage = 'verify';
      const acl = await service.call({
        Action: 'DescribeDatabaseACL',
        Param: { EnvId: envId, CollectionName: name }
      });
      if (acl?.AclTag !== 'ADMINONLY') throw failure('ACL_NOT_VERIFIED');
      state.ready++;
      log(`[就绪] ${name}，ADMINONLY 已验证`);
    }
    return state;
  } catch (error) {
    // Wrap without logging raw SDK messages, requests, or credential-bearing objects.
    const wrapped = new Error('INITIALIZATION_FAILED');
    wrapped.cause = error;
    wrapped.progress = { ...state };
    throw wrapped;
  }
}

function safeError(error) {
  const source = error?.cause || error;
  const code = typeof source?.code === 'string' && /^[A-Za-z0-9_.-]{1,80}$/.test(source.code)
    ? source.code : 'UNKNOWN_ERROR';
  const requestId = source?.requestId || source?.RequestId;
  const suffix = typeof requestId === 'string' && /^[a-fA-F0-9-]{16,64}$/.test(requestId)
    ? `，RequestId=${requestId}` : '';
  return `${code}${suffix}。${HINTS[code] || '请检查目标环境、账号权限和网络后重试。'}`;
}

async function run(args, dependencies = {}) {
  const log = dependencies.log || console.log;
  const warn = dependencies.error || console.error;
  try {
    const options = parseArgs(args);
    if (options.help) { log(HELP); return 0; }
    const envId = options.envId || (dependencies.readConfig || readConfig)().envId;
    if (typeof envId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(envId)) throw failure('INVALID_ENV');
    if (options.region && !/^[a-z]+-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(options.region)) throw failure('INVALID_REGION');
    log(`目标环境：${envId}；地域：${options.region || '沿用 CloudBase CLI 配置'}`);
    log(`${options.apply ? '执行' : '预览'} ${COLLECTIONS.length} 个集合：\n${COLLECTIONS.map(name => `  ${name}`).join('\n')}`);
    log('已有集合不重建；统一设置 ADMINONLY；不写业务数据、不建索引、不部署云函数。');
    if (!options.apply) {
      log('预览完成，未连接云端。执行命令：npm run init:societies-db -- --apply（环境覆盖参数需保留）');
      return 0;
    }
    const manager = await (dependencies.createManager || createManager)({ envId, region: options.region });
    const state = await initialize(manager, envId, log);
    log(`完成：新建 ${state.created}，已有 ${state.existing}，权限验证 ${state.ready}/${COLLECTIONS.length}。`);
    return 0;
  } catch (error) {
    if (error.progress) {
      const { created, existing, ready, collection, stage } = error.progress;
      warn(`已停止：新建 ${created}，已有 ${existing}，就绪 ${ready}/${COLLECTIONS.length}；位置 ${collection || '集合列表'} / ${stage}。`);
      warn('已经完成的操作会保留，排除错误后可用原命令重试。');
    }
    warn(`初始化失败：${safeError(error)}`);
    return 1;
  }
}

module.exports = { createManager, COLLECTIONS, parseArgs, listCollectionNames, initialize, run };
if (require.main === module) run(process.argv.slice(2)).then(code => { process.exitCode = code; });
