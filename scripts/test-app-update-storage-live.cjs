'use strict';
// Opt-in live check: creates/deletes only randomly named verification files.
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { connect, config } = require('./app-versions/manager.cjs');
const { protectArtifact } = require('./app-versions/storage-protection.cjs');
async function main() {
  const { manager } = await connect();
  const suffix = crypto.randomUUID();
  const denied = `app-updates/verification-${suffix}.txt`;
  const allowed = `app-update-verification/${suffix}.txt`;
  await protectArtifact(manager, denied);
  console.log('等待云存储权限生效（3 分钟），期间不会操作正式安装包。');
  await new Promise(resolve => setTimeout(resolve, 185000));
  const bundle = await require('esbuild').build({ stdin: { contents: "import cloudbase from '@cloudbase/js-sdk'; window.testCloudbase = cloudbase;", resolveDir: path.resolve(__dirname, '..') }, bundle: true, write: false, format: 'iife', platform: 'browser' });
  const browser = await require('puppeteer-core').launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const page = await browser.newPage();
    page.on('requestfailed', request => console.log(JSON.stringify({ networkFailure: new URL(request.url()).hostname, reason: request.failure()?.errorText })));
    page.on('response', async response => {
      if (response.status() >= 400) console.log(JSON.stringify({ httpFailure: new URL(response.url()).hostname, method: response.request().method(), status: response.status() }));
    });
    // Serve only our test document from an existing CORS-approved app origin.
    // No cloud CORS configuration or live hosting files are changed.
    const origin = new URL(config.checkUrl).origin;
    await page.setRequestInterception(true);
    page.on('request', request => {
      if (request.url() === `${origin}/__app-update-verification`) return request.respond({ status: 200, contentType: 'text/html', body: '<link rel="icon" href="data:,"><script src="/__app-update-sdk.js"></script>' });
      if (request.url() === `${origin}/__app-update-sdk.js`) return request.respond({ status: 200, contentType: 'text/javascript', body: bundle.outputFiles[0].text });
      return request.continue();
    });
    await page.goto(`${origin}/__app-update-verification`);
    const result = await page.evaluate(async ({ envId, denied, allowed }) => {
      const app = window.testCloudbase.init({ env: envId });
      await app.auth({ persistence: 'session' }).signInAnonymously();
      const upload = async (key, contents) => {
        try {
          const result = await app.uploadFile({ cloudPath: key, method: 'post', filePath: new File([contents], 'probe.txt', { type: 'text/plain' }) });
          return { uploaded: !!result.fileID };
        } catch (error) { return { uploaded: false, error: { code: error.code, message: error.message } }; }
      };
      const protectedFile = await upload(denied, 'release-probe');
      const ordinary = await upload(allowed, 'ordinary-probe');
      const update = await app.callFunction({ name: 'checkAppUpdate', data: { appid: '__UNI__E0A1A41', platform: 'android', appVersion: '1.7.9', wgtVersion: '1.7.9', protocolVersion: 2 } });
      return { blocked: !protectedFile.uploaded, protectedFile, ordinary, ordinaryUploaded: ordinary.uploaded, update: update.result };
    }, { envId: config.envId, denied, allowed });
    console.log(JSON.stringify(result));
    assert.equal(result.blocked, true);
    assert.match(result.protectedFile.error.message, /STORAGE_EXCEED_AUTHORITY/);
    assert.equal(result.ordinaryUploaded, true);
    assert.equal(result.update.updateSource, 'cloudbase');
    const dir = path.resolve(__dirname, '../unpackage/app-update-migration');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'storage-live-verification.json'), JSON.stringify(result, null, 2));
  } finally {
    await browser.close();
    // Both exact names are generated in this invocation and cannot refer to a release.
    for (const key of [denied, allowed]) {
      try { await manager.storage.getFileInfo(key); await manager.storage.deleteFile([key]); }
      catch (error) { if (error.statusCode !== 404 && !String(error.message).includes('STORAGE_FILE_NONEXIST')) console.warn('验证文件清理：', error.code || error.message); }
    }
    await require('./app-versions/storage-protection.cjs').removeProbeRules(manager, [denied]);
  }
}
main().catch(error => { console.error(error.code || error.message); process.exitCode = 1; });
