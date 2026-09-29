const assert = require('node:assert/strict');
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
      const tag = (await import('/components/TagSelectorModal.vue')).default;
      const post = (await import('/components/PostItem.vue')).default;
      const container = document.createElement('div'); container.id = 'motion-review'; document.body.appendChild(container);
      const review = window.__motionReview = { events: [], visible: true };
      const context = getCurrentPages().at(-1).$vm.$.appContext;
      review.draw = async (component, props) => {
        const node = h(component, props); node.appContext = context; render(node, container); await nextTick();
        review.instance = node.component.proxy;
      };
      review.tag = async () => {
        render(null, container); review.events = []; review.visible = true;
        const draw = () => review.draw(tag, { show: review.visible, selectedTags: [], tagCategories: [],
          onClose: () => { review.events.push('close'); review.visible = false; draw(); } });
        await draw();
      };
      review.post = async (id, votes, voted) => review.draw(post, { index: 0, showVoteSection: true,
        item: { _id: id, votes, isVoted: voted, authorName: '测试', content: '测试诗歌', imageUrls: [] } });
      review.clear = () => render(null, container);
    });
    for (const mode of ['light', 'dark']) {
      await page.evaluate(mode => {
        uni.setStorageSync('poementerThemeMode', mode); uni.$emit('theme:changed', { mode });
        window.__motionReview.events = [];
        uni.showModal({ title: '过渡验证', content: '确认后关闭', success: () => window.__motionReview.events.push('confirm') });
      }, mode);
      await page.waitForSelector('.app-dialog');
      assert.deepEqual(await page.$eval('.app-dialog-mask', mask => [getComputedStyle(mask).animationDuration, getComputedStyle(mask.querySelector('.app-dialog')).animationDuration]), ['0.18s', '0.18s']);
      await page.$eval('.app-dialog-mask', mask => Promise.all(mask.getAnimations({ subtree: true }).map(a => a.finished)));
      const leaving = await page.evaluate(async () => {
        document.querySelector('.app-dialog-button--confirm').click();
        document.querySelector('.app-dialog-button--confirm').click();
        await new Promise(requestAnimationFrame);
        return { callbacks: window.__motionReview.events.length, leaving: !!document.querySelector('.app-dialog-mask.app-motion-leave'), duration: getComputedStyle(document.querySelector('.app-dialog')).animationDuration };
      });
      assert.deepEqual(leaving, { callbacks: 0, leaving: true, duration: '0.12s' });
      await page.waitForSelector('.app-dialog', { hidden: true });
      assert.deepEqual(await page.evaluate(() => window.__motionReview.events), ['confirm']);
      await page.evaluate(() => window.__motionReview.tag());
      await page.waitForSelector('#motion-review .tag-selector');
      assert.equal(await page.$eval('#motion-review .tag-selector', el => getComputedStyle(el).animationDuration), '0.18s');
      await page.$eval('#motion-review .tag-selector-mask', el => Promise.all(el.getAnimations({ subtree: true }).map(a => a.finished)));
      await page.click('#motion-review .tag-selector-mask', { offset: { x: 10, y: 10 } });
      await page.waitForSelector('#motion-review .tag-selector', { hidden: true });
      assert.deepEqual(await page.evaluate(() => window.__motionReview.events), ['close']);
    }
    await page.evaluate(() => window.__motionReview.post('a', 0, false));
    assert.equal(await page.$('#motion-review .app-vote-pop'), null, 'initial data does not simulate a like');
    await page.evaluate(() => window.__motionReview.post('a', 1, true));
    await page.waitForSelector('#motion-review .app-vote-pop');
    assert.deepEqual(await page.$$eval('#motion-review .app-vote-pop, #motion-review .app-vote-number-pop', els => els.map(el => getComputedStyle(el).animationDuration)), ['0.2s', '0.16s']);
    const version = await page.evaluate(() => window.__motionReview.instance.voteMotionVersion);
    await page.evaluate(() => window.__motionReview.post('a', 0, false));
    assert.equal(await page.evaluate(() => window.__motionReview.instance.voteMotionVersion), version + 1, 'repeat/rollback updates retrigger feedback');
    await page.evaluate(() => window.__motionReview.post('b', 99, true));
    assert.equal(await page.$('#motion-review .app-vote-pop'), null, 'recycled rows cannot inherit another post animation');
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.evaluate(() => window.__motionReview.tag());
    await page.waitForSelector('#motion-review .tag-selector');
    assert.equal(await page.$eval('#motion-review .tag-selector', el => getComputedStyle(el).animationDuration), '0.001s');
    await page.evaluate(() => window.__motionReview.clear());
    console.log('[test-dialog-motion-h5] PASS: actual dialog/tag enter and exit timing, duplicate clicks, mask dismissal, both themes, vote/repeat/row identity and reduced motion');
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
