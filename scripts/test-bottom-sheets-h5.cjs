const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const puppeteer = require('puppeteer-core');

async function main() {
  const browser = await puppeteer.launch({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true
  });
  const output = path.join(os.tmpdir(), 'enterkey-overlay-review');
  fs.mkdirSync(output, { recursive: true });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    await page.goto((process.env.H5_URL || 'http://127.0.0.1:8081/') + '#/pages/login/login', { waitUntil: 'networkidle2' });
    await page.waitForFunction(() => typeof getCurrentPages === 'function' && getCurrentPages().at(-1)?.$vm);
    await page.evaluate(async () => {
      const source = await (await fetch('/components/overlay/AppActionSheet.vue')).text();
      const { h, render } = await import(source.match(/from "([^"\n]*vue\.runtime\.esm\.js[^"\n]*)"/)[1]);
      const overlay = await import(source.match(/from "([^"\n]*utils\/appOverlay\.js[^"\n]*)"/)[1]);
      const files = {
        mode: '/components/ModeSelectorModal.vue', color: '/components/ColorPickerModal.vue',
        font: '/components/FontSelectorModal.vue', folder: '/components/folder-selector/folder-selector.vue',
        portfolio: '/components/portfolio-selector/portfolio-selector.vue', tip: '/components/cloudTipModal/index.vue',
        editor: '/pages-user/profile-edit/profile-edit.vue', tag: '/components/TagSelectorModal.vue'
      };
      const components = {};
      for (const [key, file] of Object.entries(files)) components[key] = (await import(file)).default;
      const review = window.__bottomSheetReview = { events: [], calls: [] };
      const folders = [{ _id: 'folder-a', name: '春日诗集', postCount: 3 }, { _id: 'folder-b', name: '夜读', postCount: 0 }];
      for (const kind of ['folder', 'portfolio']) {
        const original = components[kind];
        components[kind] = { ...original, methods: { ...original.methods,
          loadFolders() { this.folders = folders; this.isLoading = false; },
          loadPortfolios() { this.portfolios = folders; this.isLoading = false; },
          $requireOpenid() { return 'fixture-user'; },
          callCloudFunction(name, data) {
            review.calls.push({ name, data });
            return Promise.resolve({ result: { success: false, message: '测试重试状态' } });
          }
        } };
      }
      const font = components.font;
      components.font = { ...font, methods: { ...font.methods,
        async loadFontOptions() {
          this.fontOptions = [
            { name: '系统默认', value: 'default', isLoaded: true, isDefault: true },
            { name: '衬线字体', value: 'serif', isLoaded: true, isDefault: true }
          ];
        }
      } };
      components.editor = { ...components.editor, onLoad: undefined, onShow: undefined, onReady: undefined };
      const container = document.createElement('div');
      container.id = 'bottom-sheet-review';
      document.body.appendChild(container);
      const context = getCurrentPages().at(-1).$vm.$.appContext;
      review.render = () => {
        const node = h(review.component, review.props);
        node.appContext = context;
        render(node, container);
        review.instance = node.component.proxy;
      };
      review.mount = (kind, mode, extra = {}) => {
        render(null, container);
        uni.hideToast();
        uni.setStorageSync('poementerThemeMode', mode);
        uni.$emit('theme:changed', { mode });
        review.events = []; review.calls = [];
        review.component = components[kind];
        const finish = (event, value) => {
          // Copy reactive color objects before Puppeteer's result serialization.
          review.events.push({ event, value: value === undefined ? undefined : JSON.parse(JSON.stringify(value)) });
          review.props.show = false; review.props.showTipProps = false;
          review.render();
        };
        review.props = {
          show: true, showTipProps: true, title: '提示', content: '保存图片后即可分享',
          postId: 'post-fixture', publishMode: 'normal', fontFamily: 'default',
          poemLines: ['春水初生'], colorPalettes: [{ name: '春日', colors: [{ backgroundColor: '#a4c4bd', textColor: '#333333' }] }],
          onClose: () => finish('close'), onHide: () => finish('hide'), onSelect: value => finish('select', value),
          onFontSizePreview: value => review.events.push({ event: 'size', value }),
          onFontFamilyPreview: value => review.events.push({ event: 'font', value }), ...extra
        };
        review.render();
        if (kind === 'editor') review.instance.showStickerPicker = true;
      };
      review.back = () => overlay.appOverlayPageMixin.onBackPress({ from: 'backbutton' });
    });
    const q = selector => '#bottom-sheet-review ' + selector;
    async function open(kind, mode, extra = {}) {
      await page.evaluate(({ kind, mode, extra }) => window.__bottomSheetReview.mount(kind, mode, extra), { kind, mode, extra });
      await page.waitForSelector(q('.app-sheet'));
      await page.$eval(q('.app-sheet-mask'), el => Promise.all(el.getAnimations({ subtree: true }).filter(a => a.effect.getTiming().iterations !== Infinity).map(a => a.finished)));
      const layout = await page.$eval(q('.app-sheet'), el => {
        const rect = el.getBoundingClientRect(); const style = getComputedStyle(el);
        return { left: rect.left, right: rect.right, bottom: rect.bottom, top: rect.top, bg: style.backgroundColor, border: style.borderWidth };
      });
      assert.equal(layout.left, 0, kind);
      assert.equal(layout.right, 390, kind);
      assert.equal(layout.bottom, 844, kind);
      assert.ok(layout.top > 0, kind + ': content must leave room for the mask and cancel');
      assert.equal(layout.bg, mode === 'dark' ? 'rgb(39, 39, 44)' : 'rgb(255, 255, 255)', kind);
      assert.equal(layout.border, '0px', kind);
      assert.equal(await page.$(q('.app-sheet-header')), null, kind);
      assert.ok(await page.$(q('.app-sheet-cancel')), kind);
    }
    async function closed() { await page.waitForSelector(q('.app-sheet'), { hidden: true }); }

    for (const mode of ['light', 'dark']) {
      await open('mode', mode, { isSeries: true });
      assert.equal(await page.$$eval(q('.app-sheet-item'), els => els.length), 2);
      await page.evaluate(() => {
        const buttons = document.querySelectorAll('#bottom-sheet-review .app-sheet-item');
        buttons[0].click(); buttons[1].click();
      });
      assert.equal(await page.evaluate(() => window.__bottomSheetReview.events.length), 0);
      await closed();
      assert.deepEqual(await page.evaluate(() => window.__bottomSheetReview.events), [{ event: 'select', value: { mode: 'poem', isOriginal: true } }]);

      await open('color', mode);
      await page.click(q('.palette-card'));
      await page.waitForSelector(q('.color-option'));
      await page.screenshot({ path: path.join(output, `color-sheet-${mode}.png`) });
      await page.click(q('.color-option'));
      await closed();
      assert.deepEqual(await page.evaluate(() => window.__bottomSheetReview.events), [{ event: 'select', value: { backgroundColor: '#a4c4bd', textColor: '#333333' } }]);

      await open('font', mode);
      await page.evaluate(() => window.__bottomSheetReview.instance.onFontSizeChange({ detail: { value: 42 } }));
      await page.click(q('.font-option:last-child'));
      assert.equal(await page.$eval(q('.font-option-text'), el => getComputedStyle(el).color), mode === 'dark' ? 'rgb(214, 214, 216)' : 'rgb(38, 38, 38)');
      assert.equal(await page.$eval(q('.app-sheet-cancel'), el => el.textContent), '完成');
      await page.screenshot({ path: path.join(output, `font-sheet-${mode}.png`) });
      await page.click(q('.app-sheet-cancel'));
      await closed();
      assert.equal(await page.evaluate(() => window.__bottomSheetReview.events[0].value), 42);
      assert.equal(await page.evaluate(() => window.__bottomSheetReview.events.at(-1).event), 'close');

      for (const kind of ['folder', 'portfolio']) {
        await open(kind, mode);
        await page.waitForSelector(q(`.${kind}-item`));
        await page.click(q(`.${kind}-item`));
        assert.equal(await page.evaluate(() => window.__bottomSheetReview.calls[0].data.folderId), 'folder-a');
        assert.ok(await page.$(q('.app-sheet')), 'failed request keeps the selector available to retry');
        await page.evaluate(() => uni.hideToast());
        await page.screenshot({ path: path.join(output, `${kind}-sheet-${mode}.png`) });
        await page.click(q('.collection-create'));
        await closed();
        await page.waitForSelector(q('.create-modal input'));
        await page.$eval(q('.create-modal'), el => Promise.all(el.getAnimations({ subtree: true }).map(a => a.finished)));
        await page.click(q('.create-footer .outline-btn:first-child'));
        await page.waitForSelector(q('.app-sheet'));
        assert.equal(await page.evaluate(() => window.__bottomSheetReview.back()), true);
        await closed();
        assert.equal(await page.evaluate(() => window.__bottomSheetReview.events.at(-1).event), 'hide');
      }

      await open('editor', mode);
      await page.waitForSelector(q('.sticker-picker-item'));
      const avatar = await page.evaluate(() => window.__bottomSheetReview.instance.defaultAvatarOptions[0]);
      await page.click(q('.sticker-picker-item'));
      await closed();
      assert.equal(await page.evaluate(() => window.__bottomSheetReview.instance.avatarUrl), avatar);
      await page.evaluate(() => { uni.hideToast(); window.__bottomSheetReview.instance.showEditPhoneModal = true; });
      await page.waitForSelector(q('.edit-phone-modal input'));
      assert.equal(await page.$(q('.app-sheet')), null, 'phone verification retains its input form');

      await open('tip', mode);
      await page.click(q('.app-sheet-mask'), { offset: { x: 8, y: 8 } });
      await closed();

      await page.evaluate(mode => window.__bottomSheetReview.mount('tag', mode), mode);
      await page.waitForSelector(q('.custom-tag-input input'));
      assert.equal(await page.$(q('.app-sheet')), null, 'custom tag input retains its existing form');
    }
    console.log('[test-bottom-sheets-h5] PASS: both themes, mode/color/avatar selection, font preview, retry, create form handoff, back/mask dismissal and input exceptions');
    console.log(`Screenshots: ${output}`);
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
