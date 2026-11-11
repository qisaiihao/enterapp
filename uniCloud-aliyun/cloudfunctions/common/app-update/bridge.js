'use strict';
const { selectUpdate } = require('./policy');
const config = require('./cloudbase.json');

async function fromCloudBase(event, context, cloud, mode) {
  if (!config.enabled || !cloud.httpclient || !cloud.httpclient.request) return null;
  const request = { ...event, mode };
  if (mode === 'legacy') request.platform = String(context && context.OS || request.platform || '').toLowerCase();
  if (selectUpdate([], request, mode).code < 0) return null;
  try {
    const response = await cloud.httpclient.request(config.url, {
      method: 'POST', contentType: 'json', dataType: 'json',
      data: request, timeout: 5000
    });
    let data = response.data;
    if (typeof data === 'string') data = JSON.parse(data);
    if (response.status !== 200 || data?.updateSource !== 'cloudbase') throw Error('INVALID_RESPONSE');
    if (data.code === 101 || data.code === 102) {
      // Re-run policy locally so a malformed bridge response can never install
      // an incompatible WGT or convert a legacy WGT request into an APK.
      const checked = selectUpdate([{ ...data, appid: request.appid, stable_publish: true, legacy_migration: data.type === 'native_app' }], request, mode);
      if (checked.code !== data.code || checked.version !== data.version) throw Error('INVALID_UPDATE');
      return checked;
    }
    if (mode === 'legacy-wgt' && data.code === -10 && data.needNativeUpdate === true) {
      return { code: -10, hasUpdate: false, needNativeUpdate: true, message: '请通过整包更新升级应用', minVersion: data.minVersion };
    }
    // Keep the old published releases until a replacement release exists.
  } catch (_) {
    console.warn('[app-update] CloudBase 暂不可用，使用保留的 uniCloud 版本记录');
  }
  return null;
}
module.exports = { fromCloudBase };
