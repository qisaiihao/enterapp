const assert = require('node:assert/strict');
const puppeteer = require('puppeteer-core');

// Render actual components with local fixtures; never submit account or content changes.
const cases = [
  ['login', { showBindPhoneModal: true }, '.modal-content'],
  ['register', { showBindAccountDialog: true }, '.modal-content'],
  ['register', { showBindPhoneModal: true }, '.modal-content'],
  ['editor', { showEditPhoneModal: true }, '.modal-content'],
  ['favorites', { showCreateModal: true }, '.modal-content'],
  ['favorites', { showEditModal: true }, '.modal-content'],
  ['portfolio', { showCreateModal: true }, '.modal-content'],
  ['portfolio', { showEditModal: true }, '.modal-content'],
  ['detail', { showAddModal: true }, '.modal-content'],
  ['admin', { showTypePicker: true }, '.modal-content'],
  ['post', { showEditModal: true }, '.edit-modal'],
  ['tag', {}, '.tag-selector'],
  ['highlight', {}, '.highlight-modal-content'],
  ['share', {}, '.share-modal'],
  ['material', {}, '.app-sheet'],
  ['dialog', {}, '.app-dialog'],
  ['sheet', {}, '.app-sheet'],
  ['folderPicker', { showCreateModal: true }, '.create-modal'],
  ['portfolioPicker', { showCreateModal: true }, '.create-modal']
];

async function main() {
  const browser = await puppeteer.launch({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 320, height: 568, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    await page.goto((process.env.H5_URL || 'http://127.0.0.1:8081/') + '#/pages/login/login', { waitUntil: 'networkidle2' });
    await page.waitForFunction(() => typeof getCurrentPages === 'function' && getCurrentPages().at(-1)?.$vm);
    await page.evaluate(async () => {
      const source = await (await fetch('/components/overlay/AppDialog.vue')).text();
      const { h, render, nextTick } = await import(source.match(/from "([^"\n]*vue\.runtime\.esm\.js[^"\n]*)"/)[1]);
      const files = {
        login: '/pages/login/login.vue', register: '/pages/register/register.vue',
        editor: '/pages-user/profile-edit/profile-edit.vue', favorites: '/pages-content/favorite-folders/favorite-folders.vue',
        portfolio: '/pages-content/portfolio/portfolio.vue', detail: '/pages-content/portfolio-detail/portfolio-detail.vue',
        admin: '/pages-admin/admin-posts/admin-posts.vue', post: '/pages/post-detail/post-detail.vue',
        tag: '/components/TagSelectorModal.vue', highlight: '/components/HighlightSelectorModal.vue',
        share: '/components/ShareModal.vue', material: '/components/OfficialMaterialPicker.vue',
        dialog: '/components/overlay/AppDialog.vue', sheet: '/components/overlay/AppActionSheet.vue',
        folderPicker: '/components/folder-selector/folder-selector.vue', portfolioPicker: '/components/portfolio-selector/portfolio-selector.vue'
      };
      const components = {};
      for (const [name, file] of Object.entries(files)) {
        const original = (await import(file)).default;
        components[name] = { ...original };
        for (const hook of ['onLoad', 'onShow', 'onReady', 'mounted', 'created']) delete components[name][hook];
        if (name.endsWith('Picker')) components[name].methods = {
          ...original.methods,
          loadFolders() { this.folders = []; this.isLoading = false; },
          loadPortfolios() { this.portfolios = []; this.isLoading = false; }
        };
      }
      const container = document.createElement('div');
      container.id = 'overlay-layout-review';
      document.body.appendChild(container);
      const context = getCurrentPages().at(-1).$vm.$.appContext;
      window.__layoutReview = async (name, state, theme) => {
        render(null, container);
        uni.hideToast();
        uni.setStorageSync('poementerThemeMode', theme);
        uni.$emit('theme:changed', { mode: theme });
        const node = h(components[name], {
          show: !name.endsWith('Picker'), visible: true, isDark: theme === 'dark',
          contentLines: ['春水初生', '春林初盛'],
          title: '显示检查', message: '长内容滚动检查。'.repeat(150),
          items: Array.from({ length: 25 }, (_, i) => `选项 ${i + 1}`),
          imageUrl: '/static/images/newicons/save_share.png',
          shareConfig: { fontSize: 38, fontFamily: 'default', backgroundColor: '#ffffff', textColor: '#333333' }
        });
        node.appContext = context;
        render(node, container);
        if (name.endsWith('Picker')) node.component.proxy.showClone = true;
        Object.assign(node.component.proxy, state);
        await nextTick();
        await Promise.all(container.getAnimations({ subtree: true }).filter(a => a.effect.getTiming().iterations !== Infinity).map(a => a.finished));
      };
    });
    const failures = [];
    let checked = 0;
    for (const [width, height] of [[320, 568], [390, 844], [844, 390], [390, 400]]) {
      await page.setViewport({ width, height, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
      for (const theme of ['light', 'dark']) {
        for (const [name, state, selector] of cases) {
          const label = `${name} ${JSON.stringify(state)} ${width}x${height} ${theme}`;
          try {
            await page.evaluate((...args) => window.__layoutReview(...args), name, state, theme);
            const result = await page.$eval('#overlay-layout-review ' + selector, el => {
              const r = el.getBoundingClientRect();
              const hit = document.elementFromPoint(Math.max(1, r.left + r.width / 2), Math.max(1, r.top + Math.min(r.height / 2, 40)));
              el.scrollTop = el.scrollHeight;
              const action = el.querySelector('.modal-footer > :last-child, .app-dialog-actions > :last-child, .app-sheet-cancel, .modal-cancel-btn, .modal-confirm');
              const a = action?.getBoundingClientRect();
              const actionHit = a && document.elementFromPoint(a.left + a.width / 2, a.top + a.height / 2);
              const actionVisible = !a || (a.top >= 0 && a.bottom <= innerHeight && (action.contains(actionHit) || (getComputedStyle(action).pointerEvents === 'none' && el.contains(actionHit))));
              return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height, covered: !el.contains(hit), actionVisible,
                action: a && { top: a.top, bottom: a.bottom, hit: actionHit?.className, pointerEvents: getComputedStyle(action).pointerEvents } };
            });
            assert.ok(result.width > 0 && result.height > 0, 'must be visible');
            assert.ok(result.left >= -1 && result.right <= width + 1 && result.top >= -1 && result.bottom <= height + 1,
              'outside viewport: ' + JSON.stringify(result));
            assert.equal(result.covered, false, 'another layer covers the panel');
            assert.equal(result.actionVisible, true, 'bottom action must remain reachable by scrolling the panel: ' + JSON.stringify(result.action));
            checked++;
          } catch (error) { failures.push(`${label}: ${error.message}`); }
        }
      }
    }
    assert.deepEqual(failures, [], `${checked} layouts passed; failures:\n${failures.join('\n')}`);
    console.log(`[test-overlay-layouts-h5] PASS: ${checked} real-component layouts, four viewport sizes, both themes, long dialog/menu content and action hit testing`);
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
