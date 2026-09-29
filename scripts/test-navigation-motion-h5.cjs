const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const puppeteer = require('puppeteer-core');

async function main() {
  const browser = await puppeteer.launch({ executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.goto((process.env.H5_URL || 'http://127.0.0.1:8081/') + '#/pages/login/login', { waitUntil: 'networkidle2' });
    await page.waitForFunction(() => typeof getCurrentPages === 'function' && getCurrentPages().at(-1)?.$vm);
    await page.evaluate(async () => {
      const source = await (await fetch('/components/overlay/AppActionSheet.vue')).text();
      const { h, render, nextTick } = await import(source.match(/from "([^"\n]*vue\.runtime\.esm\.js[^"\n]*)"/)[1]);
      const overlay = await import(source.match(/from "([^"\n]*utils\/appOverlay\.js[^"\n]*)"/)[1]);
      const originals = {};
      for (const [kind, file] of Object.entries({ sidebar: '/pages/profile/Sidebar.vue', home: '/pages/index/index.vue', poem: '/pages/poem-square/poem-square.vue' })) originals[kind] = (await import(file)).default;
      const container = document.createElement('div'); container.id = 'navigation-motion-review'; document.body.appendChild(container);
      const context = getCurrentPages().at(-1).$vm.$.appContext;
      const review = window.__navMotion = { events: [], loads: 0 };
      uni.navigateTo = options => review.events.push(['navigate', options.url, !!container.querySelector('.sidebar')]);
      review.mount = async (kind, mode) => {
        render(null, container); uni.hideToast();
        uni.setStorageSync('poementerThemeMode', mode); uni.$emit('theme:changed', { mode });
        review.events = []; review.loads = 0; review.kind = kind; review.tapBlocked = false;
        const original = originals[kind];
        const component = { ...original, methods: { ...original.methods,
          getPostList() { review.loads++; }, getIndexData() { review.loads++; }, tapDisabled() { return review.tapBlocked; },
          setData(values, callback) { Object.assign(this, values); callback?.(); }
        } };
        if (kind !== 'sidebar') for (const key of Object.keys(component)) {
          if (/^on[A-Z]/.test(key) || ['created', 'mounted', 'beforeMount', 'beforeUnmount', 'unmounted'].includes(key)) delete component[key];
        }
        review.draw = () => {
          const node = h(component, kind === 'sidebar' ? { isVisible: review.visible, isDarkTheme: mode === 'dark', userInfo: { nickName: '过渡测试' },
            onClose: () => { review.events.push(['close']); review.visible = false; review.draw(); },
            onLogoutConfirm: () => review.events.push(['logout', !!container.querySelector('.sidebar')])
          } : {});
          node.appContext = context; render(node, container); review.instance = node.component.proxy;
        };
        review.visible = true; review.draw(); await nextTick();
        if (kind === 'home') { review.instance.safeAreaTop = 0; review.instance.swiperCurrent = 0; review.instance.showNormalPostsOnly = false; }
        if (kind === 'poem') review.instance.safeAreaTop = 0;
        await nextTick();
      };
      review.back = () => overlay.dismissCurrentOverlay();
      review.hide = async () => {
        if (review.kind === 'sidebar') { review.visible = false; review.draw(); }
        else originals[review.kind].onHide.call(review.instance);
        await nextTick();
      };
      review.clear = () => render(null, container);
    });
    const q = selector => '#navigation-motion-review ' + selector;
    const finishEnter = selector => page.$eval(q(selector), el => Promise.all(el.getAnimations({ subtree: true }).map(a => a.finished)));
    const output = path.join(os.tmpdir(), 'enterkey-overlay-review'); fs.mkdirSync(output, { recursive: true });
    for (const mode of ['light', 'dark']) {
      await page.evaluate(mode => window.__navMotion.mount('sidebar', mode), mode);
      await page.waitForSelector(q('.sidebar'));
      await finishEnter('.app-sidebar-mask');
      const sidebar = await page.$eval(q('.sidebar'), el => ({ duration: getComputedStyle(el).animationDuration, left: el.getBoundingClientRect().left }));
      assert.equal(sidebar.duration, '0.18s'); assert.ok(Math.abs(sidebar.left) < 1);
      await page.screenshot({ path: path.join(output, `sidebar-motion-${mode}.png`) });
      await page.click(q('.logout-item'));
      assert.equal(await page.evaluate(() => window.__navMotion.events.length), 0, 'logout waits for exit');
      await page.waitForSelector(q('.sidebar'), { hidden: true });
      await page.waitForFunction(() => window.__navMotion.events.length === 2);
      assert.deepEqual(await page.evaluate(() => window.__navMotion.events), [['close'], ['logout', false]]);

      for (const kind of ['home', 'poem']) {
        await page.evaluate(({ kind, mode }) => window.__navMotion.mount(kind, mode), { kind, mode });
        await page.click(q(`.${kind}-filter-trigger`));
        await page.waitForSelector(q(`.${kind}-filter-panel`));
        await finishEnter('.app-motion-popover');
        const rect = await page.$eval(q(`.${kind}-filter-panel`), el => {
          const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, duration: getComputedStyle(el).animationDuration };
        });
        assert.ok(rect.left >= 0 && rect.right <= 390 && rect.top > 0, `${kind}: panel remains anchored within viewport`);
        assert.equal(rect.duration, '0.15s');
        await page.screenshot({ path: path.join(output, `${kind}-filter-motion-${mode}.png`) });
        await page.click(q(`.${kind}-filter-option:last-child`));
        assert.equal(await page.evaluate(() => window.__navMotion.loads), 0, 'list update waits for exit');
        await page.evaluate(() => { window.__navMotion.tapBlocked = true; });
        await page.waitForSelector(q(`.${kind}-filter-panel`), { hidden: true });
        await page.waitForFunction(() => window.__navMotion.loads === 1);
        assert.equal(await page.evaluate(kind => window.__navMotion.instance[kind === 'home' ? 'showNormalPostsOnly' : 'showFollowingOnly'], kind), true);

        await page.evaluate(({ kind, mode }) => window.__navMotion.mount(kind, mode), { kind, mode });
        await page.click(q(`.${kind}-filter-trigger`)); await finishEnter('.app-motion-popover');
        await page.click(q(`.${kind}-filter-mask`), { offset: { x: 10, y: 400 } });
        await page.waitForSelector(q(`.${kind}-filter-panel`), { hidden: true });
        assert.equal(await page.evaluate(() => window.__navMotion.loads), 0, 'mask only dismisses');
        await page.click(q(`.${kind}-filter-trigger`)); await finishEnter('.app-motion-popover');
        assert.equal(await page.evaluate(() => window.__navMotion.back()), true);
        await page.waitForSelector(q(`.${kind}-filter-panel`), { hidden: true });

        await page.click(q(`.${kind}-filter-trigger`)); await finishEnter('.app-motion-popover');
        await page.evaluate(async kind => {
          const i = window.__navMotion.instance;
          if (kind === 'home') i.setNormalPostsFilter(true); else i.setFollowingFilterMode(true);
          await window.__navMotion.hide();
        }, kind);
        await page.waitForSelector(q(`.${kind}-filter-panel`), { hidden: true });
        assert.equal(await page.evaluate(() => window.__navMotion.loads), 0, 'page hide cancels pending filter changes');
      }
    }
    await page.evaluate(() => window.__navMotion.mount('sidebar', 'light'));
    await finishEnter('.app-sidebar-mask');
    await page.evaluate(() => { window.__navMotion.instance.navigateToMyLikes(); window.__navMotion.instance.showLogoutConfirm(); });
    await page.waitForFunction(() => window.__navMotion.events.length === 2);
    assert.deepEqual(await page.evaluate(() => window.__navMotion.events), [['close'], ['navigate', '/pages-user/my-likes/my-likes', false]], 'first action wins');
    await page.evaluate(() => window.__navMotion.mount('sidebar', 'light'));
    await page.evaluate(async () => { window.__navMotion.instance.showLogoutConfirm(); await window.__navMotion.hide(); });
    await page.waitForSelector(q('.sidebar'), { hidden: true });
    assert.deepEqual(await page.evaluate(() => window.__navMotion.events), [], 'external close cancels logout');
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.evaluate(() => window.__navMotion.mount('sidebar', 'light'));
    assert.equal(await page.$eval(q('.sidebar'), el => getComputedStyle(el).animationDuration), '0.001s');
    await page.evaluate(() => window.__navMotion.clear());
    console.log('[test-navigation-motion-h5] PASS: sidebar/mask, logout/navigation sequencing, duplicate actions, both filters, anchoring, both themes, mask/back, hide cancellation and reduced motion; no network writes');
    console.log(`Screenshots: ${output}`);
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
