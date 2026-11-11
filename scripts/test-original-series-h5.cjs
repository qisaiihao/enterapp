const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('puppeteer-core');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    await page.goto((process.env.H5_URL || 'http://127.0.0.1:5174/') + '#/pages/login/login', { waitUntil: 'networkidle2' });
    await page.waitForFunction(() => typeof getCurrentPages === 'function' && getCurrentPages().at(-1)?.$vm);
    await page.evaluate(async () => {
      const source = await (await fetch('/components/overlay/AppDialog.vue')).text();
      const { h, render, nextTick } = await import(source.match(/from "([^"\n]*vue\.runtime\.esm\.js[^"\n]*)"/)[1]);
      const original = (await import('/pages/poem-square/poem-square.vue')).default;
      const node = h({ ...original, onLoad: undefined, onShow: undefined, onReady: undefined });
      const container = document.createElement('div');
      container.id = 'original-series-review';
      container.style.cssText = 'position:fixed;inset:0;z-index:9999;overflow:auto;background:white';
      document.body.appendChild(container);
      node.appContext = getCurrentPages().at(-1).$vm.$.appContext;
      render(node, container);
      const instance = node.component.proxy;
      const blocks = Array.from({ length: 7 }, (_, index) => ({
        id: `poem-${index}`, subtitle: `第${index + 1}首`, content: `  第${index + 1}首正文\n风穿过树梢\n留下一片光`
      }));
      instance.postList = [instance.normalizePoemCardPost({
        _id: 'seven-poems', isSeries: true, seriesBlockCount: 7, content: '组诗封面',
        seriesBlocks: blocks, seriesPoems: blocks.slice(0, 3), backgroundColor: '#a4c4bd'
      })];
      instance.isLoading = false;
      instance.hasMore = false;
      await nextTick();
    });
    const root = '#original-series-review';
    await page.click(root + ' .post-content-navigator');
    for (let index = 1; index <= 7; index++) {
      await page.waitForFunction((root, index) => document.querySelector(root + ' .series-page-indicator')?.textContent.trim() === `${index} / 7`, {}, root, index);
      const content = await page.$eval(root + ' .series-single-card', el => el.textContent);
      assert.ok(content.includes(`第${index}首正文`), `Render poem ${index}`);
      if (index === 7) {
        const output = path.resolve(__dirname, '../output/original-series-review');
        fs.mkdirSync(output, { recursive: true });
        await page.screenshot({ path: path.join(output, 'seventh-poem.png') });
      }
      await page.click(root + ' .series-single-card');
    }
    await page.waitForSelector(root + ' .post-content-navigator');
    assert.equal(await page.$(root + ' .series-page-indicator'), null, 'Cover returns only after poem seven');
    console.log('Original series H5: PASS — real card taps render 1/7 through 7/7 and return to cover');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
