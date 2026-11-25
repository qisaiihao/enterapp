const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const puppeteer = require('puppeteer-core');

async function main() {
  const appUrl = new URL(process.env.H5_URL || 'http://127.0.0.1:8081/');
  const executablePath = [process.env.PUPPETEER_EXECUTABLE_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(file => file && fs.existsSync(file));
  assert.ok(executablePath, 'Chrome or Edge required');

  let signatureBytes;
  const requests = [];
  const imageServer = http.createServer((req, res) => {
    requests.push({ path: req.url, origin: req.headers.origin });
    res.setHeader('Content-Type', 'image/png');
    if (req.url === '/allowed.png') res.setHeader('Access-Control-Allow-Origin', appUrl.origin);
    res.end(signatureBytes);
  });
  await new Promise(resolve => imageServer.listen(0, '127.0.0.1', resolve));
  const imageOrigin = `http://127.0.0.1:${imageServer.address().port}`;
  let browser;
  try {
    browser = await puppeteer.launch({ executablePath, headless: true });
    const page = await browser.newPage();
    page.setDefaultTimeout(20000);
    await page.setViewport({ width: 430, height: 932, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    await page.setRequestInterception(true);
    page.on('request', request => {
      const url = new URL(request.url());
      const isLocal = [appUrl.origin, imageOrigin].includes(url.origin) || ['data:', 'blob:'].includes(url.protocol);
      return isLocal ? request.continue() : request.abort();
    });
    await page.goto(`${appUrl.href}#/pages/login/login`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof uni !== 'undefined' && getCurrentPages().at(-1)?.$vm);
    const signature = await page.evaluate(async origin => {
      const consent = await import('/utils/privacyConsent.js');
      consent.acceptPrivacyConsent();
      const auth = (await import('/utils/auth.js')).default;
      auth.getOpenId = async () => 'viewer';
      const { patchAppState } = await import('/utils/app-state.js');
      patchAppState({ openid: 'viewer' });
      const canvas = document.createElement('canvas');
      canvas.width = 240;
      canvas.height = 80;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#de078d';
      ctx.fillRect(20, 20, 200, 40);
      const signatureDataUrl = canvas.toDataURL('image/png');
      window.signatureCalls = [];
      const tcb = uni.$tcb || getApp().$tcb;
      tcb.__skipAuth = true;
      tcb.callFunction = async ({ name, data }) => {
        if (name === 'getPostDetail' && data.action === 'getCardSignature') {
          window.signatureCalls.push(data.postId);
          return { result: { success: true, signatureDataUrl } };
        }
        if (name === 'getPostDetail') return { result: { success: true, post: {
          _id: data.postId, _openid: 'author', isPoem: true, isOriginal: true, authorName: '测试作者',
          title: '测试诗歌', content: '测试诗句', backgroundColor: '#a4c4bd', textColor: '#333333',
          authorSignature: `${origin}/${data.postId}.png`
        } } };
        return { result: { success: true, openid: 'viewer', comments: [] } };
      };
      return signatureDataUrl;
    }, imageOrigin);
    signatureBytes = Buffer.from(signature.split(',')[1], 'base64');

    for (const postId of ['denied', 'allowed']) {
      await page.evaluate(id => new Promise((resolve, reject) => uni.navigateTo({
        url: `/pages/post-detail/post-detail?id=${id}`, success: resolve, fail: reject
      })), postId);
      await page.waitForFunction(id => getCurrentPages().at(-1)?.$vm?.post?._id === id, {}, postId);
      await page.tap('uni-page-body .share-icon-container');
      await page.waitForFunction(() => getCurrentPages().at(-1)?.$vm?.shareImageFilePath?.startsWith('data:image/jpeg'));
      const pixels = await page.evaluate(async () => {
        const detail = getCurrentPages().at(-1).$vm;
        const saved = new Image();
        saved.src = detail.shareImageFilePath;
        await saved.decode();
        const canvas = document.createElement('canvas');
        canvas.width = saved.width;
        canvas.height = saved.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(saved, 0, 0);
        const rgba = ctx.getImageData(0, 0, saved.width, saved.height).data;
        let signaturePixels = 0;
        for (let i = 0; i < rgba.length; i += 4) {
          if (rgba[i] > 170 && rgba[i + 1] < 60 && rgba[i + 2] > 95) signaturePixels += 1;
        }
        return { signaturePixels, sharedPreview: detail.shareImageUrl === detail.shareImageFilePath };
      });
      assert.ok(pixels.signaturePixels > 1000, `${postId} exported JPEG is missing the signature pixels`);
      assert.ok(pixels.sharedPreview, 'Preview and save must use the same generated image');
      await page.evaluate(() => new Promise((resolve, reject) => uni.navigateBack({ success: resolve, fail: reject })));
    }
    assert.deepEqual(await page.evaluate(() => window.signatureCalls), ['denied']);
    for (const id of ['denied', 'allowed']) {
      assert.ok(requests.some(req => req.path === `/${id}.png` && req.origin === appUrl.origin), `${id} must try a browser CORS request`);
    }
    console.log('[test-share-card-signature-h5] PASS: detail-page JPEG includes the signature with and without storage CORS');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => imageServer.close(resolve));
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
