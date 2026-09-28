// Real browser regression: a preview response without Vary: Origin must not
// poison the subsequent CORS fetch used to persist the image in IndexedDB.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const puppeteer = require('puppeteer-core');

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a/JkAAAAASUVORK5CYII=', 'base64');
const modules = new Map(['storage', 'geometry', 'debug'].map(name => [
  `/${name}.js`, fs.readFileSync(path.join(__dirname, `../utils/collage/${name}.js`), 'utf8')
    .replace(/\/\/ #ifndef H5[\s\S]*?\/\/ #endif/g, '')
]));
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`)));
const close = server => new Promise(resolve => server.close(resolve));

async function main() {
  const executablePath = [process.env.PUPPETEER_EXECUTABLE_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => p && fs.existsSync(p));
  assert.ok(executablePath, 'Chrome/Edge required');
  const requests = [];
  const images = http.createServer((req, res) => {
    requests.push({ url: req.url, origin: req.headers.origin });
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    // Mirrors the cloud image: ACAO only when Origin is supplied, no Vary.
    if (req.headers.origin && req.url !== '/denied.png') res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
    res.statusCode = req.url === '/missing.png' ? 404 : 200;
    res.end(png);
  });
  const app = http.createServer((req, res) => {
    res.setHeader('Content-Type', modules.has(req.url) ? 'text/javascript' : 'text/html');
    res.end(modules.get(req.url) || '<!doctype html><title>Collage CORS regression</title>');
  });
  let browser;
  try {
    const remote = await listen(images);
    const origin = await listen(app);
    browser = await puppeteer.launch({ executablePath, headless: true });
    const page = await browser.newPage();
    // Keep Chromium's HTTP cache enabled: interception / disabled cache would
    // hide the exact regression this test exercises.
    await page.goto(origin);
    const url = `${remote}/preview.png?signature=keep-original-query`;
    const before = await page.evaluate(async url => {
      const preview = new Image();
      preview.src = url;
      document.body.append(preview);
      await preview.decode();
      try { await fetch(url); return 'unexpected success'; }
      catch (error) { return error.name; }
    }, url);
    assert.equal(before, 'TypeError', 'fixture must reproduce the cached preview CORS failure');

    const ref = await page.evaluate(async url => {
      const storage = await import('/storage.js');
      return storage.persistFile(url);
    }, url);
    assert.match(ref, /^idb:/);
    assert.equal(requests.filter(req => req.url.startsWith('/preview.png')).length, 2, 'persistence must make a new network request');
    assert.equal(requests[0].origin, undefined, 'preview does not send Origin');
    assert.equal(requests[1].origin, origin, 'fresh import sends Origin');
    assert.equal(requests[1].url, '/preview.png?signature=keep-original-query', 'signed URL must remain unchanged');

    await page.reload();
    const exported = await page.evaluate(async ref => {
      const storage = await import('/storage.js');
      const image = new Image();
      image.src = await storage.resolveFile(ref);
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      canvas.getContext('2d').drawImage(image, 0, 0);
      const output = canvas.toDataURL('image/png');
      await storage.removeFile(ref);
      return output;
    }, ref);
    assert.match(exported, /^data:image\/png;base64,/, 'restored image must export without tainting Canvas');
    const failures = await page.evaluate(async remote => {
      const { persistFile } = await import('/storage.js');
      const result = [];
      for (const name of ['denied', 'missing']) {
        try { await persistFile(`${remote}/${name}.png`); result.push('unexpected success'); }
        catch (error) { result.push(name === 'denied' ? error.name : error.message); }
      }
      // Local import paths must still work.
      const blob = new Blob([await (await fetch(`${remote}/local.png`)).arrayBuffer()], { type: 'image/png' });
      const url = URL.createObjectURL(blob);
      const localRef = await persistFile(url);
      URL.revokeObjectURL(url);
      result.push(localRef);
      return result;
    }, remote);
    assert.equal(failures[0], 'TypeError', 'genuine CORS denial must still fail');
    assert.equal(failures[1], '读取图片失败', 'HTTP errors must not be saved');
    assert.match(failures[2], /^idb:/, 'blob imports must still persist');
    console.log('[test-collage-cors] PASS: preview cache reproduction, fresh CORS download, IndexedDB reload, Canvas export, signed URL, local import and download failures');
  } finally {
    if (browser) await browser.close();
    await Promise.all([close(app), close(images)]);
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
