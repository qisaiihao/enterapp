const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const puppeteer = require('puppeteer-core');

const root = '#tab-motion-review';
const selector = suffix => `${root} ${suffix}`;

async function main() {
  const output = path.join(os.tmpdir(), 'enterkey-tab-motion-review');
  fs.mkdirSync(output, { recursive: true });
  const base = new URL(process.env.H5_URL || 'http://127.0.0.1:8081/');
  const browser = await puppeteer.launch({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true
  });
  try {
    const page = await browser.newPage();
    const blocked = [];
    await page.setRequestInterception(true);
    page.on('request', request => {
      const url = new URL(request.url());
      const localAsset = url.origin === base.origin && ['GET', 'HEAD'].includes(request.method());
      if (['data:', 'blob:', 'about:'].includes(url.protocol) || localAsset) request.continue();
      else { blocked.push({ method: request.method(), origin: url.origin }); request.abort(); }
    });
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await page.goto(new URL('#/pages/login/login', base).href, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof getCurrentPages === 'function' && getCurrentPages().at(-1)?.$vm);
    await page.evaluate(async () => {
      const source = await (await fetch('/custom-tab-bar/index.vue')).text();
      const runtime = source.match(/from "([^"\n]*vue\.runtime\.esm\.js[^"\n]*)"/);
      if (!runtime) throw new Error('Cannot find the application Vue runtime');
      const { h, render, nextTick } = await import(runtime[1]);
      const original = (await import('/custom-tab-bar/index.vue')).default;
      const theme = await import('/utils/theme.js');
      const context = getCurrentPages().at(-1).$vm.$.appContext;
      const container = document.createElement('div');
      container.id = 'tab-motion-review';
      container.style.cssText = 'position:fixed;inset:0;z-index:2147480000;background:var(--app-page-bg,#fff);';
      document.body.appendChild(container);
      const review = window.__tabMotion = { calls: [], refreshes: 0, modals: 0, behavior: 'success' };
      getApp().globalData.isLoggedIn = true;
      uni.vibrateShort = () => {};
      uni.navigateTo = uni.redirectTo = uni.reLaunch = () => { throw new Error('Unexpected page navigation'); };
      uni.showModal = options => { review.modals++; options.success?.({ confirm: false, cancel: true }); };
      uni.switchTab = options => {
        review.calls.push({
          url: options.url,
          time: performance.now(),
          touching: !!container.querySelector('.tab-bar-item--touching')
        });
        if (review.behavior === 'throw') throw new Error('review switch failure');
        if (review.behavior === 'fail') options.fail?.({ errMsg: 'switchTab:fail review' });
        else if (review.behavior === 'hold') review.pending = options;
        else options.success?.({ errMsg: 'switchTab:ok review' });
      };
      review.mount = async mode => {
        render(null, container);
        uni.hideToast();
        theme.setThemeMode(mode);
        const component = { ...original, methods: { ...original.methods, refreshCurrentPage() { review.refreshes++; } } };
        const node = h(component);
        node.appContext = context;
        render(node, container);
        review.instance = node.component.proxy;
        await nextTick();
        await review.reset({ selected: 0 });
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      };
      review.reset = async ({ selected = 0, behavior = 'success' } = {}) => {
        review.calls = []; review.refreshes = 0; review.modals = 0; review.pending = null; review.behavior = behavior;
        review.instance._switchingTab = false;
        review.instance.lastTapTime = 0;
        review.instance.lastTapIndex = -1;
        review.instance.updateSelected(selected);
        await nextTick();
      };
      review.finish = result => {
        const pending = review.pending;
        review.pending = null;
        if (result === 'fail') pending?.fail?.({ errMsg: 'switchTab:fail review' });
        else pending?.success?.({ errMsg: 'switchTab:ok review' });
      };
      review.clear = () => { render(null, container); container.remove(); };
    });
    const touch = await page.createCDPSession();
    const pointAt = async index => page.$eval(selector(`.tab-bar-item:nth-child(${index + 1}) .icon-wrap`), el => {
      const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    const touchStart = async point => touch.send('Input.dispatchTouchEvent', {
      type: 'touchStart', touchPoints: [{ ...point, radiusX: 1, radiusY: 1, force: 1, id: 1 }]
    });
    const touchEnd = () => touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const metrics = index => page.$eval(selector(`.tab-bar-item:nth-child(${index + 1}) .icon-wrap`), el => {
      const style = getComputedStyle(el);
      const matrix = new DOMMatrixReadOnly(style.transform);
      const inner = el.querySelector('.icon-inner');
      const layer = pseudo => {
        const shadow = getComputedStyle(el, pseudo);
        return { opacity: Number(shadow.opacity), shadow: shadow.boxShadow, duration: shadow.transitionDuration, property: shadow.transitionProperty };
      };
      return {
        scale: matrix.a, y: matrix.f, duration: style.transitionDuration, property: style.transitionProperty,
        selected: el.classList.contains('is-selected'),
        innerTransform: getComputedStyle(inner).transform,
        innerShadow: getComputedStyle(inner).boxShadow,
        innerOverlayShadow: getComputedStyle(inner, '::after').boxShadow,
        floating: layer('::before'), pressed: layer('::after')
      };
    });
    const assertFloating = (visual, label) => {
      assert.ok(Math.abs(visual.scale - 1) < 0.002 && Math.abs(visual.y) < 0.002, `${label}: button rests at its original size and height`);
      assert.equal(visual.innerTransform, 'none', `${label}: selection does not sink the inner surface`);
      assert.equal(visual.innerShadow, 'none', `${label}: inner surface has no shadow`);
      assert.equal(visual.innerOverlayShadow, 'none', `${label}: inner surface has no inset overlay`);
      assert.equal(visual.floating.opacity, 1, `${label}: floating shadow is visible`);
      assert.equal(visual.pressed.opacity, 0, `${label}: pressed shadow is hidden`);
      for (const layer of [visual.floating, visual.pressed]) {
        assert.ok(layer.shadow !== 'none' && !layer.shadow.includes('inset'), `${label}: depth is drawn by exterior shadows`);
        assert.equal(layer.property, 'opacity', `${label}: only shadow opacity is animated`);
      }
    };
    const finishAnimations = () => page.$eval(root, el => Promise.all(el.getAnimations({ subtree: true }).map(animation => animation.finished.catch(() => {}))));
    const state = () => page.evaluate(() => ({
      calls: window.__tabMotion.calls, refreshes: window.__tabMotion.refreshes, selected: window.__tabMotion.instance.selected,
      switching: !!window.__tabMotion.instance._switchingTab, cached: uni.getStorageSync('currentTabIndex'), modals: window.__tabMotion.modals
    }));

    for (const width of [320, 375, 390, 430]) {
      await page.setViewport({ width, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
      for (const mode of ['light', 'dark']) {
        await page.evaluate(mode => window.__tabMotion.mount(mode), mode);
        await page.waitForFunction(() => [...document.querySelectorAll('#tab-motion-review .icon-img img')].every(image => image.complete && image.naturalWidth > 0));
        await finishAnimations();
        const geometry = await page.$eval(root, el => {
          const rect = element => { const r = element.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; };
          const items = [...el.querySelectorAll('.tab-bar-item')];
          const indexAt = (x, y) => items.indexOf(document.elementFromPoint(x, y)?.closest('.tab-bar-item'));
          return {
            bar: rect(el.querySelector('.tab-bar')),
            items: items.map((item, index) => {
              const cell = rect(item), icon = rect(item.querySelector('.icon-wrap'));
              let clipped = false;
              for (let parent = item.querySelector('.icon-wrap').parentElement; parent && parent !== document.body; parent = parent.parentElement) {
                const box = rect(parent), style = getComputedStyle(parent);
                if (/(hidden|clip|scroll|auto)/.test(style.overflowX) && (icon.left < box.left - 0.5 || icon.right > box.right + 0.5)) clipped = true;
                if (/(hidden|clip|scroll|auto)/.test(style.overflowY) && (icon.top < box.top - 0.5 || icon.bottom > box.bottom + 0.5)) clipped = true;
              }
              return { cell, icon, clipped, hit: indexAt((cell.left + cell.right) / 2, (cell.top + cell.bottom) / 2), iconHit: indexAt((icon.left + icon.right) / 2, (icon.top + icon.bottom) / 2) };
            }),
            edgeHits: [indexAt(1, innerHeight - 3), indexAt(innerWidth - 1, innerHeight - 3)],
            transitions: [...el.querySelectorAll('.icon-wrap,.icon-inner,.icon-img,.tab-bar-text')].map(node => getComputedStyle(node).transitionProperty)
          };
        });
        assert.equal(geometry.items.length, 4);
        const margin = width <= 320 ? 15 : width <= 375 ? 30 : width <= 414 ? 35 : 40;
        for (const [index, item] of geometry.items.entries()) {
          assert.ok(Math.abs(item.cell.width - width / 4) < 1, `${width}/${mode}: tab ${index} covers one quarter`);
          assert.ok(Math.abs(item.cell.left - index * width / 4) < 1);
          assert.equal(item.hit, index, `${width}/${mode}: slot center hits its tab`);
          assert.equal(item.iconHit, index, `${width}/${mode}: visible icon hits its own tab`);
          assert.ok(item.icon.left >= 0 && item.icon.right <= width && item.icon.top >= 0 && item.icon.bottom <= 844 && !item.clipped, `${width}/${mode}: icon remains visible without clipping: ${JSON.stringify({ item, bar: geometry.bar })}`);
          const originalCenter = (375 + (index - 1.5) * (88 + 2 * margin)) * width / 750;
          assert.ok(Math.abs((item.icon.left + item.icon.right) / 2 - originalCenter) < 1, `${width}/${mode}: icon center is preserved`);
        }
        assert.deepEqual(geometry.edgeHits, [0, 3], 'outer blank space is tappable');
        assert.ok(geometry.transitions.every(value => !/(?:box-shadow|filter|\ball\b)/.test(value)), 'expensive properties are not animated');
        for (let index = 0; index < 4; index++) {
          const visual = await metrics(index);
          assert.equal(visual.selected, index === 0, `${width}/${mode}: current tab remains highlighted`);
          assertFloating(visual, `${width}/${mode}/tab ${index}`);
        }
        await page.screenshot({ path: path.join(output, `tab-${width}-${mode}.png`) });
        for (let index = 0; index < 4; index++) {
          await page.evaluate(selected => window.__tabMotion.reset({ selected }), (index + 1) % 4);
          const r = geometry.items[index].cell;
          await page.touchscreen.tap((r.left + r.right) / 2, (r.top + r.bottom) / 2);
          const result = await state();
          assert.equal(result.calls.length, 1, `${width}/${mode}: slot ${index} starts navigation`);
          assert.equal(result.selected, index);
        }
      }
    }

    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    for (const mode of ['light', 'dark']) {
      await page.evaluate(mode => window.__tabMotion.mount(mode), mode);
      await page.evaluate(() => window.__tabMotion.reset({ behavior: 'hold' }));
      await finishAnimations();
      const target = await pointAt(1);
      const resting = await metrics(1);
      assertFloating(resting, `${mode}: before touch`);
      await touchStart(target);
      await page.waitForSelector(selector('.tab-bar-item--touching'));
      assert.equal((await metrics(1)).duration, '0.08s', 'press uses an 80ms transform');
      await finishAnimations();
      const pressed = await metrics(1);
      assert.ok(Math.abs(pressed.scale - 0.96) < 0.002, 'trusted touchstart reaches scale 0.96');
      assert.ok(Math.abs(pressed.y - 4 * 390 / 750) < 0.02, 'trusted touchstart lowers the whole button by 4rpx');
      assert.equal(pressed.innerTransform, 'none', 'press moves the whole button, keeping its surface flat');
      assert.equal(pressed.floating.opacity, 0, 'press hides the raised shadow');
      assert.equal(pressed.pressed.opacity, 1, 'press shows the tighter exterior shadow');
      assert.notEqual(pressed.floating.shadow, pressed.pressed.shadow, 'press and rest use distinct shadows');
      assert.equal((await state()).calls.length, 0, 'touchstart only provides visual feedback');
      await page.screenshot({ path: path.join(output, `tab-touch-pressed-${mode}.png`) });
      await page.evaluate(() => { window.__tabMotion.releaseAt = performance.now(); });
      await touchEnd();
      await page.waitForFunction(() => window.__tabMotion.calls.length === 1);
      const navigation = await page.evaluate(() => ({ ...window.__tabMotion.calls[0], delay: window.__tabMotion.calls[0].time - window.__tabMotion.releaseAt }));
      assert.equal(navigation.touching, true, 'navigation starts while press feedback is still visible');
      assert.ok(navigation.delay < 180, 'navigation does not wait for the 200ms release animation');
      await page.waitForSelector(selector('.tab-bar-item--touching'), { hidden: true });
      assert.equal((await metrics(1)).duration, '0.2s', 'release uses a 200ms transform');
      await finishAnimations();
      const released = await metrics(1);
      assert.equal(released.selected, true, 'new current tab remains highlighted after release');
      assertFloating(released, `${mode}: selected tab after release`);
      assert.equal(released.floating.shadow, resting.floating.shadow, 'selection preserves the original floating shadow');
      await page.screenshot({ path: path.join(output, `tab-touch-released-${mode}.png`) });
      await page.touchscreen.tap(target.x, target.y);
      const result = await state();
      assert.equal(result.calls.length, 1, 'repeated taps cannot start another pending navigation');
      assert.equal(result.refreshes, 0, 'repeated taps cannot refresh a tab that is still opening');
      await page.evaluate(() => window.__tabMotion.finish('success'));
    }

    const target = await pointAt(1);
    await page.evaluate(() => window.__tabMotion.reset({ selected: 1 }));
    await page.touchscreen.tap(target.x, target.y);
    let result = await state();
    assert.equal(result.calls.length, 0, 'a single tap on the current tab does not navigate');
    assert.equal(result.refreshes, 0);
    await page.touchscreen.tap(target.x, target.y);
    assert.equal((await state()).refreshes, 1, 'double tapping the current tab refreshes once');

    for (const behavior of ['fail', 'throw']) {
      await page.evaluate(behavior => window.__tabMotion.reset({ behavior }), behavior);
      const failedTarget = await pointAt(2);
      await page.touchscreen.tap(failedTarget.x, failedTarget.y);
      result = await state();
      assert.equal(result.calls.length, 1);
      assert.equal(result.selected, 0, `${behavior}: failed navigation restores the selected icon`);
      assert.equal(result.cached, 0, `${behavior}: failed navigation restores the cached selection`);
      assert.equal(result.switching, false, `${behavior}: failed navigation unlocks the tab bar`);
    }
    await page.evaluate(() => { getApp().globalData.isLoggedIn = false; return window.__tabMotion.reset(); });
    const profile = await pointAt(3);
    await page.touchscreen.tap(profile.x, profile.y);
    result = await state();
    assert.equal(result.calls.length, 0, 'profile still requires login');
    assert.equal(result.modals, 1);
    await page.evaluate(() => { getApp().globalData.isLoggedIn = true; });

    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.evaluate(() => window.__tabMotion.reset({ behavior: 'hold' }));
    await touchStart(await pointAt(1));
    await page.waitForSelector(selector('.tab-bar-item--touching'));
    const reduced = await metrics(1);
    assert.equal(reduced.property, 'none', 'reduced motion removes transitions');
    assert.equal(reduced.scale, 1, 'reduced motion suppresses press scaling');
    assert.equal(reduced.y, 0, 'reduced motion suppresses press translation');
    assert.equal(reduced.floating.property, 'none', 'reduced motion removes floating shadow transitions');
    assert.equal(reduced.pressed.property, 'none', 'reduced motion removes pressed shadow transitions');
    await page.screenshot({ path: path.join(output, 'tab-reduced-motion.png') });
    await touchEnd();
    await page.waitForFunction(() => window.__tabMotion.calls.length === 1);
    await page.evaluate(() => { window.__tabMotion.finish('success'); window.__tabMotion.clear(); });
    console.log('[test-tab-motion-h5] PASS: real compiled Vue tab bar; 320/375/390/430px, both themes, full-width hit areas, icon bounds/positions, floating selection without inset shadows, trusted touch lowering/exterior-shadow press/release, immediate navigation, current-tab taps, double taps, pending navigation, failures, login and reduced motion. External requests and non-GET requests were blocked.');
    console.log(`Screenshots: ${output}`);
    console.log(`Blocked external/non-GET requests: ${blocked.length}`);
  } finally { await browser.close(); }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
