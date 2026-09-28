'use strict';

// Shared locally by all endpoints: no cloud-to-cloud invocation or extra billing.
const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const PLATFORM_LABEL = { android: 'Android', ios: 'iOS' };

function isVersion(value) {
  return typeof value === 'string' && VERSION.test(value) &&
    value.split('.').every(part => Number.isSafeInteger(Number(part)));
}

function compareVersion(a, b) {
  if (!isVersion(a) || !isVersion(b)) throw new Error('版本必须采用 major.minor.patch 格式');
  const left = a.split('.').map(Number);
  const right = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if (left[i] !== right[i]) return left[i] > right[i] ? 1 : -1;
  }
  return 0;
}

function normalizePlatform(value) {
  const platform = typeof value === 'string' ? value.toLowerCase() : '';
  return PLATFORM_LABEL[platform] ? platform : '';
}

function matchesPlatform(record, platform) {
  // platform is authoritative when present; uni_platform supports older records.
  const values = Array.isArray(record.platform) ? record.platform :
    record.platform ? [record.platform] : [record.uni_platform];
  return values.some(value => normalizePlatform(value) === platform);
}

function validURL(url) {
  return typeof url === 'string' && /^https:\/\/[^\s/]+(?:\/[^\s]*)?$/.test(url);
}

function validateRecord(record) {
  if (!isVersion(record.version) || !validURL(record.url)) return false;
  if (record.type === 'wgt') {
    if (!isVersion(record.min_uni_version)) return false;
    if (record.max_uni_version && (!isVersion(record.max_uni_version) ||
      compareVersion(record.max_uni_version, record.min_uni_version) < 0)) return false;
  }
  return ['wgt', 'native_app'].includes(record.type);
}

function responseFor(record, platform) {
  return {
    code: record.type === 'wgt' ? 101 : 102, hasUpdate: true,
    type: record.type, version: record.version, url: record.url,
    title: record.title || '发现新版本', contents: record.contents || '',
    platform: [PLATFORM_LABEL[platform]], uni_platform: platform,
    min_uni_version: record.min_uni_version || '', max_uni_version: record.max_uni_version || '',
    is_mandatory: record.is_mandatory === true,
    is_silently: record.type === 'wgt' && record.is_silently === true && record.is_mandatory !== true,
    _id: record._id
  };
}

function latest() {
  return { code: 0, type: 'latest', hasUpdate: false, message: '已是最新版本' };
}

function selectUpdate(records, request, mode = 'current') {
  const platform = normalizePlatform(request.platform);
  if (typeof request.appid !== 'string' || !request.appid || !platform || !isVersion(request.wgtVersion)) {
    return { code: -102, message: '应用、平台或资源版本参数无效' };
  }
  if (mode === 'current' && (request.protocolVersion !== 2 || !isVersion(request.appVersion))) {
    return { code: -102, message: '请使用协议 2，并传入原生版本名称' };
  }
  const relevant = records.filter(record => record.appid === request.appid &&
    record.stable_publish === true && matchesPlatform(record, platform) &&
    ['native_app', 'wgt'].includes(record.type));

  // Old resource versionCode cannot identify the native version: never infer
  // 168 -> 1.6.8. Only send an explicitly designated full migration package.
  if (mode !== 'current') {
    const migration = relevant.filter(record => record.type === 'native_app' && record.legacy_migration === true);
    if (migration.some(record => !validateRecord(record))) {
      return { code: -422, message: '迁移整包配置无效，请检查版本与 HTTPS 下载地址' };
    }
    const target = migration.filter(record => compareVersion(record.version, request.wgtVersion) >= 0)
      .sort((a, b) => compareVersion(b.version, a.version))[0];
    if (!target) return latest();
    if (mode === 'legacy-wgt') {
      return { code: -10, hasUpdate: false, needNativeUpdate: true,
        message: '请通过整包更新升级应用', minVersion: target.version };
    }
    return { ...responseFor(target, platform), is_mandatory: true, is_silently: false };
  }

  // Malformed live records must not become a cached "latest" response.
  if (relevant.some(record => !validateRecord(record))) {
    return { code: -422, message: '已发布版本配置无效，请检查版本格式、兼容范围与 HTTPS 地址' };
  }
  const sorted = relevant.slice().sort((a, b) => compareVersion(b.version, a.version));
  const native = sorted.find(record => record.type === 'native_app' &&
    compareVersion(record.version, request.appVersion) > 0 &&
    compareVersion(record.version, request.wgtVersion) >= 0);
  if (native) return responseFor(native, platform);
  const newerWgts = sorted.filter(record => record.type === 'wgt' &&
    compareVersion(record.version, request.wgtVersion) > 0 &&
    compareVersion(record.version, request.appVersion) > 0);
  const wgt = newerWgts.find(record => compareVersion(request.appVersion, record.min_uni_version) >= 0 &&
    (!record.max_uni_version || compareVersion(request.appVersion, record.max_uni_version) <= 0));
  if (wgt) return responseFor(wgt, platform);
  if (newerWgts.some(record => compareVersion(request.appVersion, record.min_uni_version) < 0)) {
    return { code: -10, type: 'need_native', hasUpdate: false, needNativeUpdate: true,
      message: '有新资源版本，但当前原生版本不支持，且暂无可用整包' };
  }
  return latest();
}

async function readReleases(db, appid) {
  const records = [];
  const pageSize = 100;
  for (let offset = 0; offset < 10000; offset += pageSize) {
    const result = await db.collection('opendb-app-versions')
      .where({ appid, stable_publish: true }).orderBy('_id', 'asc').skip(offset).limit(pageSize).get();
    if (!Array.isArray(result.data)) throw new Error('版本查询响应无效');
    records.push(...result.data);
    if (result.data.length < pageSize) return records;
  }
  throw new Error('有效发布记录过多，请下线历史版本');
}

async function checkUpdate(event, context, cloud, mode = 'current') {
  const request = { ...event };
  request.platform = mode === 'legacy' ? normalizePlatform(context && context.OS) || request.platform : request.platform;
  const validation = selectUpdate([], request, mode);
  if (validation.code < 0) return validation;
  try {
    return selectUpdate(await readReleases(cloud.database(), request.appid), request, mode);
  } catch (error) {
    console.error('[app-update] query failed:', error.message);
    return { code: -100, hasUpdate: false, message: '检查更新失败，请稍后重试' };
  }
}

module.exports = { isVersion, compareVersion, selectUpdate, readReleases, checkUpdate };
