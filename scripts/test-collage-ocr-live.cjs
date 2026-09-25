// Explicitly opt in: one real GeneralAccurateOCR request; never part of check:quality.
// Only a generated test page is sent. Credentials stay in memory and are never printed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const puppeteer = require('puppeteer-core');
const { createTencentRecognizer } = require('../functions/collageOcr/provider');
const { normalizeTencent } = require('../functions/collageOcr/core');

async function main() {
  if (!process.argv.includes('--live')) throw new Error('This test uses one OCR request. Run with --live to opt in.');
  const root = process.env.CLOUDBASE_GLOBAL_ROOT || (process.platform === 'win32' ? path.join(process.env.APPDATA, 'npm/node_modules') : execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim());
  const { authSupevisor } = require(path.join(root, '@cloudbase/cli/lib/utils/auth.js'));
  const auth = await authSupevisor.getLoginState();
  if (!auth?.secretId || !auth?.secretKey) throw new Error('请先执行 tcb login');
  const executablePath = [process.env.PUPPETEER_EXECUTABLE_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => p && fs.existsSync(p));
  assert.ok(executablePath, 'Chrome/Edge required to draw the test page');
  const browser = await puppeteer.launch({ executablePath, headless: true });
  let base64;
  try {
    const page = await browser.newPage();
    base64 = await page.evaluate(() => {
      const canvas = document.createElement('canvas'); canvas.width = 900; canvas.height = 1200;
      const ctx = canvas.getContext('2d'); ctx.fillStyle = '#f5f0e6'; ctx.fillRect(0, 0, 900, 1200);
      ctx.fillStyle = '#202820'; ctx.font = '48px "Microsoft YaHei", sans-serif';
      ctx.fillText('风从遥远的山谷吹来', 70, 200);
      ctx.fillText('我们把月光折成纸船', 70, 340);
      ctx.fillText('小字测试：春天，山川与河流。', 70, 480);
      return canvas.toDataURL('image/jpeg', .95).split(',')[1];
    });
  } finally { await browser.close(); }
  const out = path.join(__dirname, '../unpackage/collage-tests/ocr-live');
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'source.jpg'), Buffer.from(base64, 'base64'));
  console.log('Calling GeneralAccurateOCR once with a generated test page (no automatic retries).');
  const recognize = createTencentRecognizer({ secretId: auth.secretId, secretKey: auth.secretKey, token: auth.token });
  const raw = await recognize(base64);
  const data = { ...normalizeTencent(raw), width: 900, height: 1200 };
  fs.writeFileSync(path.join(out, 'response.json'), JSON.stringify(raw, null, 2));
  fs.writeFileSync(path.join(out, 'normalized.json'), JSON.stringify(data, null, 2));
  const line = data.lines.find(line => line.text === '风从遥远的山谷吹来');
  assert.ok(line, 'recognized the expected Chinese line');
  assert.equal(line.chars.length, Array.from(line.text).length, 'one coordinate entry per character');
  assert.ok(line.chars.every(char => char.polygon?.length === 4), 'original-image character polygons returned');
  const report = { requestId: raw.RequestId, lines: data.lines.length, characters: data.lines.reduce((n, line) => n + line.chars.length, 0), artifactDirectory: out };
  console.log(JSON.stringify(report, null, 2));
  console.log('[test-collage-ocr-live] PASS: real Tencent OCR text and per-character coordinates');
}
main().catch(error => { console.error('[test-collage-ocr-live]', error.code || error.name, error.code ? 'Real request failed; not retried. Check OCR permission/service status.' : error.message); process.exitCode = 1; });
