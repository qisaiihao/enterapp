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
  const outputDir = path.join(os.tmpdir(), 'enterkey-overlay-review');
  fs.mkdirSync(outputDir, { recursive: true });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await page.goto((process.env.H5_URL || 'http://127.0.0.1:8081/') + '#/pages/login/login', { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForFunction(() => typeof getCurrentPages === 'function' && getCurrentPages().at(-1)?.$vm);
    async function waitForSheet() {
      await page.waitForSelector('.app-sheet-plain');
      await page.$eval('.app-sheet-plain', element => Promise.all(element.getAnimations({ subtree: true }).map(animation => animation.finished)));
    }
    await page.evaluate(async () => {
      const source = await (await fetch('/components/DeleteModal.vue')).text();
      const runtimeUrl = source.match(/from "([^"\n]*vue\.runtime\.esm\.js[^"\n]*)"/)[1];
      const { h, render } = await import(runtimeUrl);
      const { default: DeleteModal } = await import('/components/DeleteModal.vue');
      const { default: ActionMenu } = await import('/components/ActionMenu.vue');
      // HMR can version module URLs; use the same adapter instance as the rendered sheet.
      const sheetSource = await (await fetch('/components/overlay/AppActionSheet.vue')).text();
      const overlayUrl = sheetSource.match(/from "([^"\n]*utils\/appOverlay\.js[^"\n]*)"/)[1];
      const container = document.createElement('div');
      document.body.appendChild(container);
      const context = getCurrentPages().at(-1).$vm.$.appContext;
      const review = window.__deleteModalReview = { events: [], visible: false, menuVisible: false, isHidden: false };
      const finish = event => {
        review.events.push(event);
        review.visible = false;
        review.menuVisible = false;
        review.render();
      };
      review.render = () => {
        const vnode = h('div', [h(ActionMenu, {
          visible: review.menuVisible,
          onClose: () => finish('cancel'),
          onDelete: () => {
            review.events.push('open-delete');
            review.menuVisible = false;
            review.visible = true;
            review.render();
          }
        }), h(DeleteModal, {
          visible: review.visible, isHidden: review.isHidden,
          onClose: () => finish('cancel'), onSaveDraft: () => finish('draft'),
          onHide: () => finish('hide'), onConfirm: () => finish('delete')
        })]);
        // These two roots are mounted without a parent component, so both need the page mixins.
        for (const child of vnode.children) child.appContext = context;
        vnode.appContext = context;
        render(vnode, container);
      };
      review.open = (isHidden = false) => {
        review.isHidden = isHidden;
        review.visible = true;
        review.render();
      };
      review.openMenu = () => {
        review.visible = false;
        review.menuVisible = true;
        review.render();
      };
      review.back = async () => {
        const { appOverlayPageMixin } = await import(overlayUrl);
        return appOverlayPageMixin.onBackPress({ from: 'backbutton' });
      };
      review.open();
    });

    for (const mode of ['light', 'dark']) {
      await page.evaluate(mode => {
        uni.setStorageSync('poementerThemeMode', mode);
        uni.$emit('theme:changed', { mode });
        window.__deleteModalReview.open();
      }, mode);
      await page.waitForFunction(mode => {
        const mask = document.querySelector('.app-sheet-plain');
        return mask && mask.classList.contains('overlay-dark') === (mode === 'dark');
      }, {}, mode);
      await waitForSheet();
      const layout = await page.$eval('.app-sheet-plain .app-sheet', element => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return { left: rect.left, right: rect.right, bottom: rect.bottom, bg: style.backgroundColor, border: style.borderTopWidth };
      });
      assert.equal(layout.left, 0);
      assert.equal(layout.right, 390);
      assert.equal(layout.bottom, 844);
      assert.equal(layout.border, '0px');
      assert.equal(layout.bg, mode === 'dark' ? 'rgb(39, 39, 44)' : 'rgb(255, 255, 255)');
      assert.equal(await page.$('.app-sheet-plain .app-sheet-header'), null);
      assert.deepEqual(await page.$$eval('.app-sheet-plain .app-sheet-item-text', nodes => nodes.map(node => node.textContent)),
        ['删除并存为草稿', '仅自己可见', '删除帖子']);
      await page.screenshot({ path: path.join(outputDir, `delete-sheet-${mode}.png`) });
      await page.click('.app-sheet-plain .app-sheet-cancel');
      await page.waitForSelector('.app-sheet-plain', { hidden: true });
    }

    for (const [index, expected] of [[0, 'draft'], [1, 'hide'], [2, 'delete']]) {
      await page.evaluate(() => window.__deleteModalReview.open());
      await waitForSheet();
      await page.click(`.app-sheet-plain .app-sheet-item:nth-child(${index + 1})`);
      await page.waitForSelector('.app-sheet-plain', { hidden: true });
      assert.equal(await page.evaluate(() => window.__deleteModalReview.events.at(-1)), expected);
    }
    await page.evaluate(() => window.__deleteModalReview.open(true));
    await waitForSheet();
    assert.equal(await page.$eval('.app-sheet-plain .app-sheet-item:nth-child(2)', element => element.hasAttribute('disabled')), true);
    assert.equal(await page.evaluate(() => window.__deleteModalReview.back()), true);
    await page.waitForSelector('.app-sheet-plain', { hidden: true });
    assert.equal(await page.evaluate(() => window.__deleteModalReview.events.at(-1)), 'cancel');
    await page.evaluate(() => window.__deleteModalReview.open());
    await waitForSheet();
    await page.touchscreen.tap(195, 120);
    await page.waitForSelector('.app-sheet-plain', { hidden: true });
    assert.equal(await page.evaluate(() => window.__deleteModalReview.events.at(-1)), 'cancel');

    await page.evaluate(() => window.__deleteModalReview.openMenu());
    await page.waitForSelector('.app-sheet-enter');
    const motion = await page.$eval('.app-sheet-enter', element => {
      const animations = element.getAnimations({ subtree: true });
      for (const animation of animations) { animation.pause(); animation.currentTime = 120; }
      const panel = element.querySelector('.app-sheet');
      const transform = new DOMMatrix(getComputedStyle(panel).transform);
      const duration = getComputedStyle(panel).animationDuration;
      const position = transform.m42;
      for (const animation of animations) animation.play();
      return { position, height: panel.offsetHeight, duration, animations: animations.length };
    });
    assert.equal(motion.animations, 2, 'both backdrop and sheet animate');
    assert.equal(motion.duration, '0.24s');
    assert.ok(motion.position > 0 && motion.position < motion.height, 'sheet passes through an intermediate slide position');
    await waitForSheet();
    await page.click('.app-sheet-item:last-child');
    await page.waitForFunction(() => window.__deleteModalReview.events.at(-1) === 'open-delete');
    await waitForSheet();
    assert.equal(await page.$$eval('.app-sheet-plain', elements => elements.length), 1, 'only the next sheet remains after the handoff');
    assert.equal(await page.$eval('.app-sheet-item:first-child', element => element.textContent), '删除并存为草稿');
    await page.click('.app-sheet-cancel');
    await page.waitForSelector('.app-sheet-plain', { hidden: true });
    console.log('[test-delete-modal-h5] PASS: light/dark layout, all actions, hidden state, mask/back, slide/fade and menu handoff');
    console.log(`Screenshots: ${outputDir}`);
  } finally {
    await browser.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
