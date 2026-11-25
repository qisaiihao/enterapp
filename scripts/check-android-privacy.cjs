#!/usr/bin/env node
/**
 * 检查 Android 隐私配置，也可切换 HBuilderX 云打包使用的弹窗模式。
 *
 * 1. 普通包使用 none，由开屏页展示自定义弹窗。华为包使用 template，
 *    由 DCloud 在应用启动前展示原生提示框。
 * 2. androidPrivacy.json 的 version 必须与 utils/privacyConsent.js 的
 *    PRIVACY_CONSENT_VERSION 一致，隐私政策升级时两处同步重新弹窗。
 * 3. manifest.json 必须显式关闭启动时的电话状态权限申请
 *    （permissionPhoneState.request = none），否则应用启动会申请
 *    READ_PHONE_STATE，被检测为同意隐私政策前获取 IMEI。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PRIVACY_CONFIG = path.join(ROOT, 'androidPrivacy.json');
const CONSENT_SOURCE = path.join(ROOT, 'utils', 'privacyConsent.js');
const MANIFEST = path.join(ROOT, 'manifest.json');
const prompts = new Map([['default', 'none'], ['huawei', 'template']]);

const failures = [];

function fail(message) {
  failures.push(message);
}

function readJson(file, label) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    fail(`${label} 读取或解析失败: ${error.message}`);
    return null;
  }
}

function main() {
  const args = process.argv.slice(2);
  const [action, profile] = args;
  if (args.length && (args.length !== 2 || action !== '--set' || !prompts.has(profile))) {
    console.error('用法: node scripts/check-android-privacy.cjs [--set default|huawei]');
    process.exit(1);
  }

  let config = null;
  if (!fs.existsSync(PRIVACY_CONFIG)) {
    fail('缺少 androidPrivacy.json，无法检查 Android 安装包的隐私弹窗模式');
  } else {
    config = readJson(PRIVACY_CONFIG, 'androidPrivacy.json');
  }

  if (config) {
    if (config.prompt !== 'none' && config.prompt !== 'template') {
      fail(`androidPrivacy.json 的 prompt 必须为 none 或 template，当前为 ${JSON.stringify(config.prompt)}`);
    }
    if (!String(config.message || '').trim()) {
      fail('androidPrivacy.json 缺少 message，华为包的原生隐私提示框将无正文');
    }
  }

  let consentVersion = null;
  try {
    const source = fs.readFileSync(CONSENT_SOURCE, 'utf8');
    const policy = source.match(/PRIVACY_POLICY_VERSION\s*=\s*'([^']+)'/);
    const agreement = source.match(/USER_AGREEMENT_VERSION\s*=\s*'([^']+)'/);
    if (!policy || !agreement) {
      fail('无法从 utils/privacyConsent.js 读取隐私政策/用户协议版本');
    } else {
      consentVersion = `${policy[1]}:${agreement[1]}`;
    }
  } catch (error) {
    fail(`读取 utils/privacyConsent.js 失败: ${error.message}`);
  }

  if (config && consentVersion && config.version !== consentVersion) {
    fail(`androidPrivacy.json 的 version (${config.version}) 必须等于 PRIVACY_CONSENT_VERSION (${consentVersion})`);
  }

  const manifest = readJson(MANIFEST, 'manifest.json');
  if (manifest) {
    const android = manifest['app-plus']
      && manifest['app-plus'].distribute
      && manifest['app-plus'].distribute.android;
    if (!android) {
      fail('manifest.json 缺少 app-plus.distribute.android 配置');
    } else {
      const policy = android.permissionPhoneState && android.permissionPhoneState.request;
      if (policy !== 'none') {
        fail(`manifest.json 需配置 app-plus.distribute.android.permissionPhoneState.request = "none"，当前为 ${JSON.stringify(policy)}`);
      }
    }
  }

  if (failures.length) {
    console.error('[check-android-privacy] FAIL');
    failures.forEach((message) => console.error(`  ${message}`));
    process.exit(1);
  }
  if (action === '--set' && config.prompt !== prompts.get(profile)) {
    config.prompt = prompts.get(profile);
    const nextConfig = `${PRIVACY_CONFIG}.${process.pid}.tmp`;
    try {
      fs.writeFileSync(nextConfig, `${JSON.stringify(config, null, 2)}\n`);
      fs.renameSync(nextConfig, PRIVACY_CONFIG);
    } finally {
      fs.rmSync(nextConfig, { force: true });
    }
  }

  const activeProfile = config.prompt === 'template' ? 'huawei' : 'default';
  console.log(`[check-android-privacy] PASS (${activeProfile}: ${config.prompt}, version ${config.version}, permissionPhoneState none)`);
}

main();
