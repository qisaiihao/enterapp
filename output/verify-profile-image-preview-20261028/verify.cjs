const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('puppeteer-core');
const base = 'http://127.0.0.1:8081/';
const output = __dirname;

(async () => {
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
    const errors = [], fixturesLoaded = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setRequestInterception(true);
    page.on('request', request => {
      if (request.url().startsWith(base + '__profile-preview/')) {
        const name = new URL(request.url()).pathname.split('/').pop();
        const original = name.startsWith('original');
        fixturesLoaded.push(name);
        const body = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200"><rect width="900" height="1200" fill="${original ? '#e7efdf' : '#efdfd4'}"/><text x="40" y="600" font-size="46" fill="#334033">${name}</text></svg>`;
        request.respond({ status: 200, contentType: 'image/svg+xml', body });
      } else if (/^(data:|blob:|about:)/.test(request.url()) || request.url().startsWith(base)) request.continue();
      else request.abort();
    });
    await page.evaluateOnNewDocument(() => {
      localStorage.clear();
      const user = { _openid: 'preview-fixture', poemId: 'preview-fixture', nickName: 'Preview fixture', avatarUrl: '/static/images/avatar.png' };
      const image = name => `${location.origin}/__profile-preview/${name}.png`;
      const posts = [
        { _id: 'preview-single', _openid: user._openid, authorName: user.nickName, title: 'Single original preview',
          imageUrls: [image('thumb-single')], originalImageUrls: ['cloud://preview-fixture/original-single.png'], createTime: 3 },
        { _id: 'preview-multi', _openid: user._openid, authorName: user.nickName, title: 'Multiple original preview',
          imageUrls: [image('thumb-first'), image('thumb-second')],
          originalImageUrls: ['cloud://preview-fixture/original-first.png', 'cloud://preview-fixture/original-second.png'], createTime: 2 }
      ];
      window.__profilePreviewFixture = { user, posts, conversions: [], previews: [] };
      window.__tcbAppInstance = {
        __skipAuth: true,
        async getTempFileURL() { return { fileList: [] }; },
        async callFunction({ name }) {
          if (name === 'login') return { result: { openid: user._openid } };
          return { result: { success: true, userInfo: { ...user }, user: { ...user }, posts: JSON.parse(JSON.stringify(posts)), activities: [],
            folders: [], count: 0, total: 0, followerCount: 0, followingCount: 0, unreadCount: 0, config: { enabled: false }, passed: true } };
        }
      };
    });
    await page.goto(base + '#/pages/login/login', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof getCurrentPages === 'function' && getCurrentPages().at(-1)?.$vm);
    await page.evaluate(async () => {
      const state = await import('/utils/app-state.js');
      const { user } = window.__profilePreviewFixture;
      state.setUserSession(user, user._openid);
      state.patchAppState({ _loginProcessCompleted: true });
      uni.setStorageSync('userInfo', user); uni.setStorageSync('userOpenId', user._openid);
      const source = await (await fetch('/utils/imagePreview.js')).text();
      const cachePath = source.match(/from "([^"]*\/cache\/core\/file-url\.js[^"]*)"/)[1];
      const cache = (await import(cachePath)).default;
      cache.invalidate(); cache.setBatchDelay(0);
      cache.setResolver(async ids => {
        window.__profilePreviewFixture.conversions.push(ids);
        return Object.fromEntries(ids.map(id => [id, { url: `${location.origin}/__profile-preview/${id.split('/').pop()}` }]));
      });
      uni.addInterceptor('previewImage', { invoke(options) {
        window.__profilePreviewFixture.previews.push({ current: options.current, urls: [...options.urls] });
      } });
      await uni.switchTab({ url: '/pages/profile/profile' });
      window.__ENTERAPP_HIDE_BOOT_MASK__?.(); document.getElementById('app-loading-mask')?.remove();
    });
    await page.waitForSelector('#single-image-preview-single', { timeout: 25000 });
    await page.waitForFunction(() => !getCurrentPages().at(-1).$vm.isAtomicRefreshing);
    await page.$eval('#single-image-preview-single', element => element.scrollIntoView({ block: 'center' }));
    await (await page.$('#single-image-preview-single')).tap();
    await page.waitForFunction(() => window.__profilePreviewFixture.previews.length === 1);
    await page.waitForFunction(() => [...document.querySelectorAll('#u-a-p img')].some(image => image.src.includes('/original-single.png') && image.naturalWidth > 0));
    await page.screenshot({ path: path.join(output, 'single-original.png') });
    await page.evaluate(() => uni.closePreviewImage());
    await page.waitForFunction(() => !document.querySelector('#u-a-p uni-swiper'));
    await page.$eval('#swiper-preview-multi', element => element.scrollIntoView({ block: 'center' }));
    const point = await page.$eval('#swiper-preview-multi', element => { const r = element.getBoundingClientRect(); return { x: r.left + r.width * .8, y: r.top + r.height / 2, width: r.width }; });
    const touch = await page.createCDPSession();
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: point.x, y: point.y }] });
    for (let step = 1; step <= 8; step++) await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: point.x - point.width * .6 * step / 8, y: point.y }] });
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForFunction(() => { const r = document.querySelector('#swiper-preview-multi [data-imgindex="1"]').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; });
    await (await page.$('#swiper-preview-multi [data-imgindex="1"]')).tap();
    await page.waitForFunction(() => window.__profilePreviewFixture.previews.length === 2);
    await page.waitForFunction(() => [...document.querySelectorAll('#u-a-p img')].some(image => image.src.includes('/original-second.png') && image.naturalWidth > 0));
    await page.screenshot({ path: path.join(output, 'second-original.png') });
    const result = await page.evaluate(() => window.__profilePreviewFixture);
    assert.equal(result.previews[0].current, base + '__profile-preview/original-single.png');
    assert.equal(result.previews[1].current, base + '__profile-preview/original-second.png');
    assert.deepEqual(result.previews[1].urls, [base + '__profile-preview/original-first.png', base + '__profile-preview/original-second.png']);
    assert.ok(result.previews.every(preview => preview.urls.every(url => !url.startsWith('cloud://'))));
    assert.equal(errors.length, 0, errors.join('\n'));
    const report = { previews: result.previews, conversions: result.conversions, fixturesLoaded, errors };
    fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
