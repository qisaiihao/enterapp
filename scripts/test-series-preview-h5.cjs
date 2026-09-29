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
    await page.goto((process.env.H5_URL || 'http://127.0.0.1:8081/') + '#/pages/login/login', { waitUntil: 'networkidle2' });
    await page.waitForFunction(() => typeof getCurrentPages === 'function' && getCurrentPages().at(-1)?.$vm);
    await page.evaluate(async () => {
      const source = await (await fetch('/components/overlay/AppDialog.vue')).text();
      const { h, render, nextTick } = await import(source.match(/from "([^"\n]*vue\.runtime\.esm\.js[^"\n]*)"/)[1]);
      const original = (await import('/pages-publish/preview/preview.vue')).default;
      const node = h({ ...original, onLoad: undefined, onShow: undefined, onReady: undefined });
      const container = document.createElement('div');
      container.id = 'series-preview-review';
      container.style.cssText = 'position:fixed;inset:0;z-index:9999;overflow:auto;background:white';
      document.body.appendChild(container);
      node.appContext = getCurrentPages().at(-1).$vm.$.appContext;
      render(node, container);
      const instance = node.component.proxy;
      const first = { id: 'one', subtitle: '第一首', content: '　第一首第一行\n第一首第二行' };
      const second = { id: 'two', subtitle: '第二首', content: '第二首正文' };
      const raw = {
        isSeries: true, isExpanded: true, content: first.content + '\n\n' + second.content,
        seriesBlocks: [first, { subtitle: ' ', content: '\n ' }, second],
        highlightLines: ['封面高光'], authorSignature: '/static/images/avatar.png',
        editData: { publishMode: 'poem', isSeries: true, seriesBlocks: [first, second], selectedBackgroundColor: '#a4c4bd', selectedTextColor: '#333333' }
      };
      window.__seriesPreview = {
        instance, raw, before: JSON.stringify(raw), nextTick,
        async load(value) { instance.post = instance.preparePreviewPost(value); await nextTick(); }
      };
      await window.__seriesPreview.load(raw);
    });

    const root = '#series-preview-review';
    const card = root + ' .post-content-navigator';
    const content = () => page.$eval(card, el => el.textContent);
    const indicator = () => page.$eval(root + ' .preview-series-pagination', el => el.textContent.trim());
    assert.match(await content(), /封面高光/);
    assert.doesNotMatch(await content(), /第二首正文/);
    assert.equal(await page.$(root + ' .preview-series-pagination'), null, 'Cover has no page indicator or reading prompt');
    assert.doesNotMatch(await page.$eval(root, el => el.textContent), /点击逐首阅读|点击查看下一首|点击回到封面|共 2 首/);
    assert.equal(await page.$(root + ' .preview-series-item'), null, 'Do not repeat all poems below the card');
    await page.click(card);
    await page.waitForFunction(() => window.__seriesPreview.instance.currentPreviewSeriesPoem?.subtitle === '第一首');
    assert.match(await content(), /第一首第一行/);
    assert.doesNotMatch(await content(), /第二首正文|封面高光|　/);
    assert.equal(await indicator(), '1 / 2');
    assert.ok(await page.$(card + ' .signature-image'));
    await page.click(card);
    await page.waitForFunction(() => window.__seriesPreview.instance.currentPreviewSeriesPoem?.subtitle === '第二首');
    assert.match(await content(), /第二首正文/);
    assert.doesNotMatch(await content(), /第一首第一行/);
    assert.equal(await indicator(), '2 / 2');
    const output = path.join(__dirname, '../unpackage/series-preview-review');
    fs.mkdirSync(output, { recursive: true });
    await page.screenshot({ path: path.join(output, 'second-poem.png') });
    await page.click(card);
    await page.waitForFunction(() => !window.__seriesPreview.instance.post.seriesExpanded);
    assert.match(await content(), /封面高光/);
    assert.equal(await page.$(root + ' .preview-series-pagination'), null);
    assert.equal(await page.evaluate(() => JSON.stringify(window.__seriesPreview.raw) === window.__seriesPreview.before), true);

    // Cache restoration and legacy seriesPoems must also start on a bounded cover.
    await page.evaluate(async () => {
      const review = window.__seriesPreview;
      await review.load({ ...review.raw, seriesBlocks: [], seriesPoems: review.raw.editData.seriesBlocks,
        seriesExpanded: true, currentSeriesIndex: 1, highlightLines: [] });
    });
    assert.match(await content(), /第一首第一行/);
    assert.doesNotMatch(await content(), /第二首正文/);
    assert.equal(await page.$(root + ' .preview-series-pagination'), null);
    await page.click(card);
    await page.waitForFunction(() => window.__seriesPreview.instance.post.seriesExpanded);
    assert.equal(await indicator(), '1 / 2');

    // A single valid poem retains ordinary expand/collapse behavior, including anonymity.
    await page.evaluate(async () => {
      const review = window.__seriesPreview;
      await review.load({ ...review.raw, isExpanded: false, isAnonymous: true,
        seriesBlocks: [review.raw.seriesBlocks[0]], content: '单首全文', highlightLines: ['单首高光'] });
    });
    assert.equal(await page.$(root + ' .preview-series-pagination'), null);
    assert.match(await content(), /单首高光/);
    await page.click(card);
    await page.waitForFunction(() => window.__seriesPreview.instance.post.isExpanded);
    assert.match(await content(), /单首全文/);
    assert.equal(await page.$(card + ' .signature-image'), null);
    await page.click(card);
    await page.waitForFunction(() => !window.__seriesPreview.instance.post.isExpanded);
    assert.match(await content(), /单首高光/);
    console.log('[test-series-preview-h5] PASS (cover, ordered tap navigation, page count, last-page reset, no duplicate content, cache/legacy input, source preservation, single poem, signature/anonymity)');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
