'use strict';
const { isVersion, compareVersion, selectUpdate } = require('../../functions/_shared/app-update');
const config = require('./config.json');
function assert(value, message) { if (!value) throw Error(message); }
function idFor(record) { return `${record.appid}-${record.uni_platform}-${record.type}-${record.version}`; }
function validate(record) {
  assert(record.appid === config.appid, 'AppID 不匹配');
  assert(['android', 'ios'].includes(record.uni_platform), '请选择 Android 或 iOS');
  assert(isVersion(record.version), '版本号必须为三段数字，例如 1.7.9');
  assert(['native_app', 'wgt'].includes(record.type), '请选择整包或 WGT');
  assert(typeof record.title === 'string' && record.title.trim().length > 0 && record.title.length <= 100, '请输入 1–100 字的更新标题');
  assert(typeof record.contents === 'string' && record.contents.length <= 10000, '更新说明不能超过 10000 字');
  const url = new URL(record.url);
  assert(url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash, '请使用长期有效、无签名参数的 HTTPS 下载地址');
  if (record.type === 'wgt') {
    assert(isVersion(record.min_uni_version), 'WGT 必须设置最低原生版本');
    assert(compareVersion(record.version, record.min_uni_version) > 0, 'WGT 版本必须高于最低原生版本');
    assert(!record.max_uni_version || (isVersion(record.max_uni_version) && compareVersion(record.max_uni_version, record.min_uni_version) >= 0), '最高原生版本不能低于最低版本');
  }
  assert(!(record.is_mandatory && record.is_silently), '强制更新不能同时设置静默安装');
  assert(!record.is_silently || record.type === 'wgt', '只有 WGT 支持静默安装');
  assert(!record.legacy_migration || (record.type === 'native_app' && record.cloudbase_ready === true), '旧版迁移入口必须使用已包含腾讯云更新逻辑的整包');
  if (!(record.type === 'native_app' && record.uni_platform === 'ios')) {
    assert(record.artifact && /^[a-f0-9]{64}$/.test(record.artifact.sha256), '请先选择并上传经过校验的安装包');
    assert(record.artifact.version === record.version && record.artifact.type === record.type, '填写版本/类型与安装包不一致');
    assert(record.artifact.appid === config.appid && record.artifact.url === record.url, '下载地址与校验后的安装包不一致');
    assert(record.cloudbase_ready === record.artifact.cloudbase_ready, '安装包的更新后端标记不一致');
  } else {
    assert(url.hostname === 'apps.apple.com', 'iOS 整包更新请填写 App Store 地址');
    assert(!record.legacy_migration, 'iOS 商店版本不标记为 Android 旧版迁移包');
  }
  return record;
}
function draft(input, artifact) {
  const record = {
    appid: config.appid, uni_platform: input.uni_platform || 'android',
    platform: [(input.uni_platform || 'android') === 'ios' ? 'iOS' : 'Android'],
    type: input.type, version: input.version, title: input.title?.trim(), contents: input.contents || '',
    url: artifact?.url || input.url, min_uni_version: input.min_uni_version || '', max_uni_version: input.max_uni_version || '',
    is_mandatory: input.is_mandatory === true, is_silently: input.is_silently === true,
    legacy_migration: input.legacy_migration === true, cloudbase_ready: artifact?.cloudbase_ready === true,
    artifact: artifact || null, stable_publish: false
  };
  validate(record);
  return { ...record, _id: idFor(record) };
}
module.exports = { validate, draft, idFor, selectUpdate, compareVersion, assert };
