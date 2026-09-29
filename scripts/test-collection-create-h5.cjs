const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const puppeteer = require('puppeteer-core');

async function main() {
  const browser = await puppeteer.launch({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true
  });
  const output = path.join(os.tmpdir(), 'enterkey-overlay-review');
  fs.mkdirSync(output, { recursive: true });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.goto((process.env.H5_URL || 'http://127.0.0.1:8081/') + '#/pages/login/login', { waitUntil: 'networkidle2' });
    await page.waitForFunction(() => typeof getCurrentPages === 'function' && getCurrentPages().at(-1)?.$vm);
    await page.evaluate(async () => {
      const source = await (await fetch('/components/overlay/AppActionSheet.vue')).text();
      const { h, render, nextTick } = await import(source.match(/from "([^"\n]*vue\.runtime\.esm\.js[^"\n]*)"/)[1]);
      const files = {
        'folder-page': '/pages-content/favorite-folders/favorite-folders.vue',
        'folder-edit': '/pages-content/favorite-folders/favorite-folders.vue',
        'portfolio-page': '/pages-content/portfolio/portfolio.vue',
        'portfolio-edit': '/pages-content/portfolio/portfolio.vue',
        'folder-selector': '/components/folder-selector/folder-selector.vue',
        'portfolio-selector': '/components/portfolio-selector/portfolio-selector.vue'
      };
      const components = {};
      // Load together to catch interference from legacy global modal styles.
      for (const [kind, file] of Object.entries(files)) components[kind] = (await import(file)).default;
      const container = document.createElement('div'); container.id = 'collection-create-review'; document.body.appendChild(container);
      const context = getCurrentPages().at(-1).$vm.$.appContext;
      const review = window.__createReview = {};
      uni.chooseImage = options => options.success({ tempFilePaths: [review.chosenCover] });
      review.mount = async (kind, mode) => {
        render(null, container); uni.hideToast();
        uni.setStorageSync('poementerThemeMode', mode); uni.$emit('theme:changed', { mode });
        const original = components[kind];
        const fixture = { ...original, watch: {}, methods: { ...original.methods,
          loadFolders() {}, loadPortfolios() {}
        } };
        for (const key of Object.keys(fixture)) {
          if (/^on[A-Z]/.test(key) || ['created', 'mounted', 'beforeMount', 'beforeUnmount', 'unmounted'].includes(key)) delete fixture[key];
        }
        const node = h(fixture, { show: true, postId: 'fixture-post' });
        node.appContext = context; render(node, container);
        review.instance = node.component.proxy;
        review.instance.showClone = true;
        if (kind.endsWith('-edit')) review.instance.editFolderName({ _id: 'fixture-folder', name: 'Old', coverUrl: '' });
        else review.instance.showCreateModal = true;
        await nextTick();
      };
    });
    const base = '#collection-create-review .collection-create-dialog';
    let cases = 0;
    for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 568 }, { width: 390, height: 420 }, { width: 844, height: 390 }]) {
      await page.setViewport({ ...viewport, isMobile: true, hasTouch: true });
      for (const kind of ['folder-page', 'folder-edit', 'portfolio-page', 'portfolio-edit', 'folder-selector', 'portfolio-selector']) {
        for (const mode of ['light', 'dark']) {
          await page.evaluate((kind, mode) => window.__createReview.mount(kind, mode), kind, mode);
          await page.waitForSelector(base + ' input');
          const layout = await page.$eval(base, mask => {
            const panel = mask.querySelector('.collection-create-panel');
            const footer = mask.querySelector('.collection-create-footer');
            const rect = el => { const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }; };
            const style = getComputedStyle(panel);
            const buttons = [...mask.querySelectorAll('.collection-create-button')].map(el => ({
              rect: rect(el), bg: getComputedStyle(el).backgroundColor, color: getComputedStyle(el).color, border: getComputedStyle(el).borderWidth,
              afterBorder: getComputedStyle(el, '::after').borderWidth, disabled: el.hasAttribute('disabled')
            }));
            return { panel: rect(panel), footer: rect(footer), bg: style.backgroundColor, border: style.borderWidth, shadow: style.boxShadow,
              radius: parseFloat(style.borderRadius), buttons, width: innerWidth, height: innerHeight };
          });
          const label = `${kind}/${mode}/${viewport.width}x${viewport.height}`;
          assert.ok(layout.panel.left > 0 && layout.panel.right < layout.width, label);
          assert.ok(layout.panel.top > 0 && layout.panel.bottom < layout.height, label);
          assert.ok(Math.abs(layout.panel.top - (layout.height - layout.panel.bottom)) < 2, label + ': centered');
          assert.ok(layout.footer.top > layout.panel.top && layout.footer.bottom < layout.panel.bottom, label + ': footer remains visible');
          assert.equal(layout.border, '0px', label);
          assert.notEqual(layout.shadow, 'none', label);
          assert.ok(layout.radius > 0, label);
          assert.equal(layout.bg, mode === 'dark' ? 'rgb(39, 39, 44)' : 'rgb(255, 255, 255)', label);
          assert.equal(layout.buttons[0].bg, mode === 'dark' ? 'rgb(52, 52, 57)' : 'rgb(245, 246, 247)', label);
          assert.equal(layout.buttons[0].color, mode === 'dark' ? 'rgb(201, 206, 216)' : 'rgb(102, 102, 102)', label);
          assert.equal(layout.buttons[1].bg, mode === 'dark' ? 'rgb(244, 241, 234)' : 'rgb(51, 51, 51)', label);
          for (const button of layout.buttons) {
            assert.equal(button.border, '0px', label);
            assert.equal(button.afterBorder, '0px', label);
          }
          assert.equal(layout.buttons[1].disabled, !kind.endsWith('-edit'), label);
          if (kind.endsWith('-edit')) {
            assert.equal(await page.$eval(base + ' input', el => el.value), 'Old');
            await page.focus(base + ' input');
            await page.keyboard.down('Control'); await page.keyboard.press('KeyA'); await page.keyboard.up('Control');
            await page.keyboard.press('Backspace');
            await page.waitForFunction(selector => document.querySelector(selector).hasAttribute('disabled'), {}, base + ' .create-confirm');
          }
          await page.type(base + ' input', 'Test');
          await page.waitForFunction(selector => !document.querySelector(selector).hasAttribute('disabled'), {}, base + ' .create-confirm');
          await page.waitForFunction(() => (window.__createReview.instance.editingFolderName || window.__createReview.instance.newPortfolioName || window.__createReview.instance.newFolderName) === 'Test');
          if (viewport.width === 390 && viewport.height === 844) {
            await page.screenshot({ path: path.join(output, `create-${kind}-${mode}.png`) });
            if (kind === 'folder-page' || kind.endsWith('-edit')) {
              for (const [index, cover] of ['/static/images/newicons/image.png', '/static/images/newicons/collection.png'].entries()) {
                await page.evaluate(cover => { window.__createReview.chosenCover = cover; }, cover);
                await page.click(base + (index ? ' .cover-preview' : ' .cover-upload-btn'));
                await page.waitForSelector(base + ' .cover-preview');
                assert.equal(await page.evaluate(kind => window.__createReview.instance[kind === 'folder-page' ? 'newFolderCover' : 'editingFolderCover'], kind), cover);
              }
            }
          }
          await page.click(base + ' .create-cancel');
          await page.waitForSelector(base, { hidden: true });
          if (kind.endsWith('selector')) await page.waitForSelector('#collection-create-review .app-sheet');
          cases++;
        }
      }
    }
    console.log(`[test-collection-create-h5] PASS: ${cases} create/edit layouts; both themes, input binding, cover selection/replacement, disabled state, cancel and return to selector; no live writes`);
    console.log(`Screenshots: ${output}`);
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
