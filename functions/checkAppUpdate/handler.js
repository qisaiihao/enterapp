'use strict';
const { checkUpdate } = require('./_lib/policy');
const APP_ID = '__UNI__E0A1A41';

async function handle(event = {}, context = {}, cloud) {
  const http = typeof event.httpMethod === 'string';
  let result;
  try {
    if (http && event.httpMethod !== 'POST') throw Error('请使用 POST');
    const raw = http ? (event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : event.body) : event;
    if (typeof raw === 'string' && raw.length > 8192) throw Error('请求过大');
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!data || data.appid !== APP_ID) throw Error('应用参数无效');
    const mode = data.mode || 'current';
    if (!['current', 'legacy', 'legacy-wgt'].includes(mode)) throw Error('更新协议无效');
    result = await checkUpdate(data, context, cloud, mode, 'app_update_releases');
    // Log only protocol/version for transition monitoring; no account/device identifiers.
    console.log('[app-update-cloudbase]', JSON.stringify({ mode, version: data.wgtVersion, code: result.code }));
  } catch (_) {
    result = { code: -102, hasUpdate: false, message: '更新请求参数无效' };
  }
  result = { ...result, updateSource: 'cloudbase' };
  return http ? { statusCode: 200, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, isBase64Encoded: false, body: JSON.stringify(result) } : result;
}
module.exports = { handle };
