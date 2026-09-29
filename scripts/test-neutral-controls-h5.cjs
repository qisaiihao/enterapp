const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const puppeteer = require('puppeteer-core');

// Render real components with local data; never submit content or call write APIs.
async function main() {
  const output = path.join(os.tmpdir(), 'enterkey-neutral-controls');
  fs.mkdirSync(output, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true
  });
  try {
    for (const kind of ['tags', 'search', 'portfolio', 'collage']) {
      const page = await browser.newPage();
      await page.setViewport({ width: 320, height: 844, isMobile: true, hasTouch: true });
      await page.goto((process.env.H5_URL || 'http://127.0.0.1:8081/') + '#/pages/login/login', { waitUntil: 'networkidle2' });
      await page.waitForFunction(() => typeof getCurrentPages === 'function' && getCurrentPages().at(-1)?.$vm);
      await page.evaluate(async kind => {
        const source = await (await fetch('/components/TagSelectorModal.vue')).text();
        const { h, render, nextTick } = await import(source.match(/from "([^"\n]*vue\.runtime\.esm\.js[^"\n]*)"/)[1]);
        const files = { tags: '/components/TagSelectorModal.vue', search: '/pages-tools/search/search.vue', portfolio: '/pages-content/portfolio-detail/portfolio-detail.vue', collage: '/pages-collage/collage-compose/collage-compose.vue' };
        const original = (await import(files[kind])).default;
        const fixture = { ...original, watch: {} };
        for (const key of Object.keys(fixture)) {
          if (/^on[A-Z]/.test(key) || ['created', 'mounted', 'beforeMount', 'beforeUnmount', 'unmounted'].includes(key)) delete fixture[key];
        }
        const context = getCurrentPages().at(-1).$vm.$.appContext;
        document.querySelector('uni-app').style.display = 'none';
        const container = document.createElement('div');
        container.id = 'neutral-review'; document.body.appendChild(container);
        const reviewStyle = document.createElement('style');
        reviewStyle.textContent = '#app { display: none !important; } #neutral-review { position: fixed; inset: 0; z-index: 2000000; overflow: auto; background: var(--app-page-bg, #fff); } #neutral-review * { animation: none !important; transition: none !important; }';
        document.head.appendChild(reviewStyle);
        const theme = await import('/utils/theme.js');
        window.mountNeutralReview = async mode => {
          render(null, container); theme.setThemeMode(mode); uni.hideToast();
          const props = kind === 'tags' ? {
            show: true, isDark: mode === 'dark', selectedTags: ['原创'],
            tagCategories: [{ name: '主题', icon: '◇', tags: ['原创', '生活', '山川', '长一些的标签'] }, { name: '形式', icon: '○', tags: ['自由诗'] }],
            onUpdate: tags => { window.updatedTags = tags; }
          } : {};
          const node = h(fixture, props); node.appContext = context; render(node, container);
          const vm = node.component.proxy; window.reviewVm = vm;
          if (kind === 'tags') { vm.matchedTags = ['生活随想', '生活记录']; vm.showMatchedTags = true; }
          if (kind === 'search') { vm.searchKeyword = '诗歌'; vm.isSearching = false; vm.searchSuggestions = ['原创诗歌', '生活']; vm.searchResults = [{ _id: 'sample', title: '山川与日常', content: '在日常中发现诗意', authorName: '示例作者' }]; }
          if (kind === 'portfolio') { vm.isLoading = false; vm.showAddModal = true; vm.myPostsLoading = false; vm.myPosts = [{ _id: 'a', title: '山川与日常', createTime: Date.now() }, { _id: 'b', title: '窗前的光', createTime: Date.now() }]; vm.selectedPostIds = ['a']; }
          if (kind === 'collage') { vm.wordsPool = ['山川', '日常', '光', '落在', '窗前']; vm.poemWords = ['山川']; vm.dropHighlight = true; }
          await nextTick();
        };
      }, kind);
      for (const width of [320, 390]) {
        await page.setViewport({ width, height: 844, isMobile: true, hasTouch: true });
        for (const mode of ['light', 'dark']) {
          await page.evaluate(mode => window.mountNeutralReview(mode), mode);
          const selectors = {
            tags: ['.category-item.active', '.preset-tag.selected', '.custom-tag-input uni-button'],
            search: ['.filter-item.active', '.sort-item.active'],
            portfolio: ['.selected-check-simple', '.modal-btn.confirm'],
            collage: ['.chip.active']
          }[kind];
          const styles = await page.evaluate(selectors => selectors.map(selector => {
            const el = document.querySelector('#neutral-review ' + selector);
            if (!el) throw Error('Missing ' + selector);
            const style = getComputedStyle(el), rect = el.getBoundingClientRect();
            return { selector, bg: style.backgroundColor, color: style.color, radius: parseFloat(style.borderRadius), left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
          }), selectors);
          for (const style of styles) {
            const label = `${kind}/${mode}/${width} ${style.selector}`;
            assert.equal(style.bg, mode === 'light' ? 'rgb(51, 51, 51)' : 'rgb(244, 241, 234)', label);
            assert.equal(style.color, mode === 'light' ? 'rgb(255, 255, 255)' : 'rgb(39, 39, 44)', label);
            assert.ok(style.radius >= 8, label + ' rounded');
            assert.ok(style.left >= 0 && style.right <= width + 1, label + ' inside viewport');
            assert.ok(style.top >= 0 && style.bottom <= 844, label + ' visible vertically');
          }
          await page.screenshot({ path: path.join(output, `${kind}-${mode}-${width}.png`) });
          if (kind === 'tags') {
            await page.click('#neutral-review .preset-tag:not(.selected)');
            assert.deepEqual(await page.evaluate(() => window.updatedTags), ['原创', '生活']);
          }
          if (kind === 'portfolio') {
            await page.click('#neutral-review .post-item-simple:not(.selected)');
            assert.deepEqual(await page.evaluate(() => [...window.reviewVm.selectedPostIds]), ['a', 'b']);
          }
          console.log(`PASS ${kind}/${mode}/${width}`);
        }
      }
      await page.close();
    }
    console.log('Screenshots: ' + output);
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

