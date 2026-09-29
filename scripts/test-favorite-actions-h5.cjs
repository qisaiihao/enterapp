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
      const overlay = await import(source.match(/from "([^"\n]*utils\/appOverlay\.js[^"\n]*)"/)[1]);
      const menu = (await import('/components/FavoriteActionMenu.vue')).default;
      const folder = (await import('/components/folder-selector/folder-selector.vue')).default;
      const profile = (await import('/pages/profile/profile.vue')).default;
      const content = (await import('/pages-content/favorite-content/favorite-content.vue')).default;
      const review = window.__favoriteReview = { calls: [], dismiss: overlay.dismissCurrentOverlay };
      const fakeFolder = { ...folder, methods: { ...folder.methods,
        loadFolders() { this.folders = [{ _id: 'folder-target', name: '春日诗集', itemCount: 1 }]; this.isLoading = false; },
        $requireOpenid: () => 'fixture-user',
        callCloudFunction(name, data) {
          review.calls.push({ name, data });
          return Promise.resolve({ result: { success: true } });
        }
      } };
      // Use actual UI/handlers; only the folder network boundary is replaced with local fixtures.
      const fixtureMenu = { ...menu, components: { ...menu.components, FolderSelector: fakeFolder } };
      const container = document.createElement('div'); container.id = 'favorite-actions-review'; document.body.appendChild(container);
      const context = getCurrentPages().at(-1).$vm.$.appContext;
      review.mount = async (kind, theme) => {
        render(null, container); uni.hideToast(); review.calls = [];
        uni.setStorageSync('poementerThemeMode', theme); uni.$emit('theme:changed', { mode: theme });
        const original = kind === 'profile' ? profile : content;
        const fixture = { ...original, mixins: [], watch: {}, components: { ...original.components, FavoriteActionMenu: fixtureMenu },
          computed: { ...original.computed, isFullBackground: () => false, isHeaderBackground: () => false, appBackgroundPageStyle: () => ({}) }
        };
        for (const key of Object.keys(fixture)) {
          if (/^on[A-Z]/.test(key) || ['created', 'mounted', 'beforeMount', 'beforeUnmount', 'unmounted'].includes(key)) delete fixture[key];
        }
        for (const key of Object.keys(fixture.components)) {
          if (!['PostItem', 'FavoriteActionMenu', 'ActionMenu'].includes(key)) fixture.components[key] = { render: () => null };
        }
        const data = original.data;
        fixture.data = function () {
          const item = { _id: 'post-fixture', postId: 'post-fixture', favoriteId: 'favorite-fixture', title: '春日', postTitle: '春日',
            content: '春水初生，春林初盛。', postContent: '春水初生，春林初盛。', authorName: '测试作者', postAuthorName: '测试作者',
            authorAvatar: '/static/images/avatar.png', postAuthorAvatar: '/static/images/avatar.png', imageUrls: [],
            formattedFavoriteTime: '刚刚', formattedCreateTime: '刚刚', isPoem: true, isOriginal: false };
          return { ...data.call(this), isLoading: false, hasMore: false, hasInitialSnapshot: true, currentTab: 'favorites',
            userInfo: { nickName: '收藏测试', avatarUrl: '/static/images/avatar.png' }, favoriteList: [item], favorites: [item], myPosts: [item] };
        };
        const node = h(fixture); node.appContext = context; render(node, container);
        review.instance = node.component.proxy;
        await nextTick();
      };
    });
    const base = '#favorite-actions-review';
    async function settle() {
      await page.$eval(base, async el => {
        await Promise.all(el.getAnimations({ subtree: true }).filter(a => a.effect.getTiming().iterations !== Infinity).map(a => a.finished));
      });
    }
    for (const kind of ['profile', 'folder']) {
      for (const theme of ['light', 'dark']) {
        await page.evaluate((kind, theme) => window.__favoriteReview.mount(kind, theme), kind, theme);
        assert.equal(await page.$(base + ' .remove-favorite-btn'), null);
        await page.click(base + ' .more-menu-btn-top-right');
        await page.waitForSelector(base + ' .app-sheet'); await settle();
        assert.deepEqual(await page.$$eval(base + ' .app-sheet-item-text', nodes => nodes.map(n => n.textContent)), ['放入收藏夹', '取消收藏']);
        const warningColor = theme === 'dark' ? 'rgb(240, 138, 138)' : 'rgb(196, 61, 61)';
        assert.equal(await page.$eval(base + ' .app-sheet-item:nth-child(2)', el => getComputedStyle(el).color), warningColor);
        assert.equal(await page.$eval(base + ' .app-sheet-cancel', el => getComputedStyle(el).color), warningColor);
        assert.notEqual(await page.$eval(base + ' .app-sheet-item:first-child', el => getComputedStyle(el).color), warningColor);
        const bounds = await page.$eval(base + ' .app-sheet', el => ({ bottom: el.getBoundingClientRect().bottom, height: innerHeight }));
        assert.ok(Math.abs(bounds.bottom - bounds.height) < 2);
        assert.ok(await page.evaluate(() => location.hash.includes('/pages/login/login')), 'menu tap must not navigate to the post');
        await page.screenshot({ path: path.join(output, `favorite-menu-${kind}-${theme}.png`) });
        await page.click(base + ' .app-sheet-cancel');
        await page.waitForSelector(base + ' .app-sheet', { hidden: true });
        assert.equal(await page.evaluate(() => window.__favoriteReview.instance.favoriteActionTarget), null);

        await page.click(base + ' .more-menu-btn-top-right'); await settle();
        await page.evaluate(() => window.__favoriteReview.dismiss());
        await page.waitForSelector(base + ' .app-sheet', { hidden: true });

        await page.click(base + ' .more-menu-btn-top-right'); await settle();
        await page.click(base + ' .app-sheet-item:first-child');
        await page.waitForSelector(base + ' .folder-item'); await settle();
        assert.equal(await page.$(base + ' .app-sheet-item'), null, 'menu closes before the folder selector opens');
        await page.click(base + ' .folder-item');
        await page.waitForFunction(() => window.__favoriteReview.calls.length === 1);
        const call = await page.evaluate(() => window.__favoriteReview.calls[0]);
        assert.equal(call.data.action, 'addToFavorite');
        assert.equal(call.data.postId, 'post-fixture');
        assert.equal(call.data.folderId, 'folder-target');
        await page.waitForSelector(base + ' .app-sheet', { hidden: true });
        assert.equal(await page.evaluate(kind => window.__favoriteReview.instance[kind === 'profile' ? 'favoriteList' : 'favorites'].length, kind), 1);
      }
    }
    console.log('[test-favorite-actions-h5] PASS: both pages/themes, three-dot hit target, bottom menu, cancel/back, folder selection and original favorite preservation; no live writes');
    console.log('Screenshots: ' + output);
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
