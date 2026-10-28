const net = require('net');

const COLLECTION = 'login_logs';
const CLIENT_FIELDS = {
  os: 32, osVersion: 64, deviceModel: 128, deviceBrand: 64,
  appVersion: 64, appVersionCode: 32, sdkVersion: 64, userAgent: 512
};
const PLATFORMS = new Set(['app', 'app-harmony', 'h5', 'mp-weixin', 'unknown']);
const METHODS = new Set(['password', 'sms', 'wechat', 'register', 'github']);

function boundedText(value, length) {
  return typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, length) : '';
}

function normalizeClientInfo(value) {
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const info = { platform: PLATFORMS.has(raw.platform) ? raw.platform : 'unknown' };
  for (const [key, length] of Object.entries(CLIENT_FIELDS)) info[key] = boundedText(raw[key], length);
  return info;
}

// These fields come from the cloud runtime's second argument, never the client's event.
// CloudBase has both JSON environment and legacy semicolon-separated environ formats.
function runtimeEnvironment(context = {}) {
  if (typeof context.environment === 'string') {
    try {
      const parsed = JSON.parse(context.environment);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch (_) {}
  }
  const result = {};
  if (typeof context.environ === 'string') {
    for (const entry of context.environ.split(';')) {
      const separator = entry.indexOf('=');
      if (separator > 0) result[entry.slice(0, separator)] = entry.slice(separator + 1);
    }
  }
  return result;
}

function validIp(value) {
  const ip = boundedText(value, 64);
  return net.isIP(ip) ? ip : '';
}

function validPort(value) {
  if (typeof value !== 'number' && (typeof value !== 'string' || !/^\d{1,5}$/.test(value))) return null;
  const port = Number(value);
  return Number.isInteger(port) && port >= 1 && port <= 65535 ? port : null;
}

function trustedNetwork(wxContext = {}, context = {}, env = process.env) {
  const runtime = runtimeEnvironment(context);
  let runtimeLabel = 'context.environ';
  if (typeof context.environment === 'string') {
    try {
      const parsed = JSON.parse(context.environment);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) runtimeLabel = 'context.environment';
    } catch (_) {}
  }
  const sources = [
    { value: wxContext, label: 'wxContext', ips: ['CLIENTIP', 'CLIENTIPV6'], ports: ['CLIENTPORT'] },
    { value: runtime, label: runtimeLabel, ips: ['WX_CLIENTIP', 'WX_CLIENTIPV6', 'TCB_SOURCE_IP'], ports: ['WX_CLIENTPORT', 'TCB_SOURCE_PORT'] },
    { value: context, label: 'context', ips: ['CLIENTIP', 'CLIENTIPV6', 'TCB_SOURCE_IP'], ports: ['CLIENTPORT', 'TCB_SOURCE_PORT'] },
    { value: env, label: 'runtime.env', ips: ['WX_CLIENTIP', 'WX_CLIENTIPV6', 'TCB_SOURCE_IP'], ports: ['WX_CLIENTPORT', 'TCB_SOURCE_PORT'] }
  ];
  for (const source of sources) {
    for (const key of source.ips) {
      const clientIp = validIp(source.value[key]);
      if (!clientIp) continue;
      // Only use the same provider's port. Never substitute a destination port or a client field.
      const portKeys = key === 'TCB_SOURCE_IP'
        ? source.ports.filter(field => field === 'TCB_SOURCE_PORT')
        : source.ports.filter(field => field !== 'TCB_SOURCE_PORT');
      for (const portKey of portKeys) {
        const sourcePort = validPort(source.value[portKey]);
        if (sourcePort !== null) return { clientIp, sourcePort, ipSource: `${source.label}.${key}`, portSource: `${source.label}.${portKey}` };
      }
      return { clientIp, sourcePort: null, ipSource: `${source.label}.${key}`, portSource: 'unavailable' };
    }
  }
  return { clientIp: null, sourcePort: null, ipSource: 'unavailable', portSource: 'unavailable' };
}

async function recordSuccessfulLogin({ db, user, event = {}, context = {}, wxContext = {}, loginMethod, databaseApi = 'wx' }) {
  try {
    if (!user || typeof user._id !== 'string' || !user._id || !METHODS.has(loginMethod)) throw new Error('invalid audit identity');
    const runtime = runtimeEnvironment(context);
    const row = {
      schemaVersion: 1,
      userId: boundedText(user._id, 128),
      userOpenid: boundedText(user._openid, 128),
      poemId: boundedText(user.poemId, 128),
      loginTime: new Date(),
      loginMethod,
      clientInfo: normalizeClientInfo(event.clientInfo),
      clientInfoSource: 'client_reported',
      cloudSource: boundedText(wxContext.SOURCE || runtime.TCB_SOURCE || process.env.TCB_SOURCE, 64),
      network: trustedNetwork(wxContext, context),
      requestId: boundedText(context.request_id || context.requestId || runtime.TCB_SEQID, 128)
    };
    // wx-server-sdk wraps database input in { data }, whereas CloudBase Node SDK takes the row directly.
    const result = await db.collection(COLLECTION).add(databaseApi === 'cloudbase' ? row : { data: row });
    return result._id || result.id;
  } catch (_) {
    // A successful authentication must be durable before a login response is returned.
    // Avoid logging raw exceptions: database errors can include documents and credentials.
    console.error('[login-audit] LOGIN_AUDIT_UNAVAILABLE');
    const error = new Error('登录记录保存失败，请稍后重试');
    error.code = 'LOGIN_AUDIT_UNAVAILABLE';
    throw error;
  }
}

module.exports = { COLLECTION, normalizeClientInfo, runtimeEnvironment, trustedNetwork, validIp, validPort, recordSuccessfulLogin };
