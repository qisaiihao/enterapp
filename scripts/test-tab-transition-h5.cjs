const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const puppeteer = require('puppeteer-core');

const base = new URL(process.env.H5_URL || 'http://127.0.0.1:8081/');
const sourceRoute = 'pages/poem-square/poem-square';
const mountainRoute = 'pages/mountain/mountain';
const coverSelector = '[data-tab-transition-cover]';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function openReview(browser, mode, behavior = 'delay') {
  const page = await browser.newPage();
  const intercepted = [];
  let interceptedModule = false;
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = new URL(request.url());
    if (['data:', 'blob:', 'about:'].includes(url.protocol)) return request.continue();
    if (url.origin !== base.origin || !['GET', 'HEAD'].includes(request.method())) return request.abort();
    if (!interceptedModule && url.pathname === '/pages/mountain/mountain.vue') {
      interceptedModule = true;
      intercepted.push(behavior);
      if (behavior === 'fail') return request.abort();
      return setTimeout(() => request.continue().catch(() => {}), 700);
    }
    return request.continue();
  });
  await page.goto(new URL(`#/pages/poem-square/poem-square`, base).href, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof getCurrentPages === 'function' && getCurrentPages().at(-1)?.$vm && document.querySelector('uni-page[data-page] .tab-bar'));
  await page.evaluate(async themeMode => {
    const theme = await import('/utils/theme.js');
    theme.setThemeMode(themeMode);
    uni.hideToast();
    const runtime = window.__tabTransitionReview = { calls: [], covers: [], frames: [], recording: false };
    const bounds = element => {
      const rect = element?.getBoundingClientRect();
      return rect ? { top: rect.top, left: rect.left, width: rect.width, height: rect.height } : null;
    };
    const original = uni.switchTab;
    uni.switchTab = options => {
      runtime.calls.push(options.url);
      const cover = document.querySelector('[data-tab-transition-cover]');
      if (cover) {
        const source = document.querySelector('uni-page[data-page]');
        const scroller = cover.querySelector('[data-review-scroll]');
        const wheel = new Event('wheel', { bubbles: true, cancelable: true });
        cover.dispatchEvent(wheel);
        runtime.covers.push({
          inert: cover.querySelector('uni-page').inert,
          hidden: cover.getAttribute('aria-hidden'),
          ids: cover.querySelectorAll('[id]').length,
          background: getComputedStyle(cover).backgroundColor,
          touchAction: getComputedStyle(cover).touchAction,
          wheelBlocked: wheel.defaultPrevented,
          sourceBar: bounds(source.querySelector('.tab-bar')),
          coverBar: bounds(cover.querySelector('.tab-bar')),
          sourceTop: bounds(source.querySelector('.custom-top-bar')),
          coverTop: bounds(cover.querySelector('.custom-top-bar')),
          scrollTop: scroller?.scrollTop,
          scrollLeft: scroller?.scrollLeft
        });
      }
      return original(options);
    };
    runtime.start = () => {
      runtime.frames = [];
      runtime.recording = true;
      const sample = () => {
        const cover = document.querySelector('[data-tab-transition-cover]');
        const current = document.querySelector('uni-page[data-page]');
        const surface = cover || current;
        const bar = surface?.querySelector('.tab-bar');
        const rect = bar?.getBoundingClientRect();
        runtime.frames.push({
          cover: !!cover,
          shell: !!surface?.querySelector('.custom-top-bar'),
          bar: !!rect && rect.width > 0 && rect.height > 0 && rect.top < innerHeight,
          route: getCurrentPages().at(-1)?.route || ''
        });
        if (runtime.recording) requestAnimationFrame(sample);
      };
      sample();
    };
  }, mode);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  return { page, intercepted };
}

async function clickTab(page, index) {
  await page.click(`uni-page[data-page] .tab-bar-item[data-index="${index}"]`);
}

async function waitForRoute(page, route) {
  await page.waitForFunction(target => getCurrentPages().at(-1)?.route === target &&
    !document.querySelector('[data-tab-transition-cover]'), {}, route);
  await sleep(80);
}

async function stopSamples(page) {
  return page.evaluate(() => {
    const review = window.__tabTransitionReview;
    review.recording = false;
    return { frames: review.frames, covers: review.covers, calls: review.calls };
  });
}

function assertContinuous(result, label) {
  assert.ok(result.frames.length > 2, `${label}: collected painted frames`);
  assert.equal(result.frames.filter(frame => !frame.bar || !frame.shell).length, 0,
    `${label}: source, cover, or target must retain both fixed bars on every frame`);
}

async function testColdAndWarm(browser, mode, output) {
  const { page, intercepted } = await openReview(browser, mode);
  try {
    await page.evaluate(() => {
      const source = document.querySelector('uni-page[data-page]');
      const scroller = document.createElement('div');
      scroller.id = 'tab-transition-scroll-fixture';
      scroller.dataset.reviewScroll = '';
      scroller.style.cssText = 'position:fixed;top:300px;left:10px;width:30px;height:30px;overflow:scroll;';
      const content = document.createElement('div');
      content.style.cssText = 'width:200px;height:200px;background:linear-gradient(#888,#ccc);';
      scroller.appendChild(content);
      source.appendChild(scroller);
      scroller.scrollTop = 47;
      scroller.scrollLeft = 29;
      window.scrollTo(0, 100);
      window.__tabTransitionReview.start();
    });
    await clickTab(page, 2);
    await sleep(180);
    assert.equal(await page.evaluate(() => getCurrentPages().at(-1)?.route), sourceRoute, 'module loading retains source page');
    assert.equal(await page.$(coverSelector), null, 'module loading retains live page rather than freezing it');
    await waitForRoute(page, mountainRoute);
    const cold = await stopSamples(page);
    assert.deepEqual(intercepted, ['delay']);
    assertContinuous(cold, `${mode} cold`);
    assert.equal(cold.calls.length, 1);
    assert.equal(cold.covers.length, 1);
    const cover = cold.covers[0];
    assert.equal(cover.inert, true);
    assert.equal(cover.hidden, 'true');
    assert.equal(cover.ids, 0);
    assert.equal(cover.touchAction, 'none');
    assert.equal(cover.wheelBlocked, true);
    assert.equal(cover.scrollTop, 47);
    assert.equal(cover.scrollLeft, 29);
    assert.deepEqual(cover.coverBar, cover.sourceBar, 'fixed bottom bar does not jump in snapshot');
    assert.deepEqual(cover.coverTop, cover.sourceTop, 'fixed top bar does not jump in snapshot');
    assert.equal(cover.background, mode === 'dark' ? 'rgb(15, 17, 21)' : 'rgb(255, 255, 255)');
    await page.screenshot({ path: path.join(output, `${mode}-cold.png`) });

    await page.evaluate(() => window.__tabTransitionReview.start());
    await clickTab(page, 1);
    await waitForRoute(page, sourceRoute);
    await clickTab(page, 2);
    await waitForRoute(page, mountainRoute);
    const warm = await stopSamples(page);
    assertContinuous(warm, `${mode} warm`);
    assert.equal(warm.covers.length, 1, 'warm switches never create a second snapshot');
    assert.equal(warm.calls.length, 3);
    fs.writeFileSync(path.join(output, `${mode}-frames.json`), JSON.stringify({ cold, warm }, null, 2));
  } finally { await page.close(); }
}

async function testFailureAndCancel(browser) {
  for (const action of ['fail', 'cancel']) {
    const { page, intercepted } = await openReview(browser, 'dark', action === 'fail' ? 'fail' : 'delay');
    try {
      await page.evaluate(() => window.__tabTransitionReview.start());
      await clickTab(page, 2);
      if (action === 'cancel') {
        await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
      }
      await sleep(900);
      const result = await stopSamples(page);
      assert.equal(intercepted.length, 1);
      assert.equal(await page.evaluate(() => getCurrentPages().at(-1)?.route), sourceRoute, `${action} keeps source route`);
      assert.equal(result.calls.length, 0, `${action} must not navigate on a late module result`);
      assert.equal(result.covers.length, 0);
      assert.equal(await page.$(coverSelector), null);
      assertContinuous(result, action);
      const selected = await page.$eval('uni-page[data-page] .tab-bar-item[data-index="1"] .icon-wrap', el => el.classList.contains('is-selected'));
      assert.equal(selected, true, `${action} restores source selection`);
    } finally { await page.close(); }
  }
}

async function main() {
  const output = path.join(os.tmpdir(), 'enterkey-tab-transition-review');
  fs.mkdirSync(output, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true
  });
  try {
    for (const mode of ['light', 'dark']) await testColdAndWarm(browser, mode, output);
    await testFailureAndCancel(browser);
    console.log(`PASS H5 tab transition: cold/warm, themes, scroll, failure and cancellation. Evidence: ${output}`);
  } finally { await browser.close(); }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
