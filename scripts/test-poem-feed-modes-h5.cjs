const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('puppeteer-core');

async function main() {
  const base = new URL(process.env.H5_URL || 'http://127.0.0.1:8081/');
  const output = path.resolve(__dirname, '../output/poem-feed-modes');
  fs.mkdirSync(output, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    await page.setRequestInterception(true);
    page.on('request', request => {
      const url = new URL(request.url());
      if (['data:', 'blob:', 'about:'].includes(url.protocol) ||
        (url.origin === base.origin && ['GET', 'HEAD'].includes(request.method()))) request.continue();
      else request.abort();
    });
    await page.goto(new URL('#/pages/login/login', base).href, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof getCurrentPages === 'function' && getCurrentPages().at(-1)?.$vm);
    await page.evaluate(async () => {
      (await import('/utils/privacyConsent.js')).acceptPrivacyConsent();
      await new Promise((resolve, reject) => uni.reLaunch({ url: '/pages/login/login', success: resolve, fail: reject }));
    });
    await page.waitForFunction(() => getCurrentPages().at(-1)?.route === 'pages/login/login' && getCurrentPages().at(-1)?.$vm);
    await page.evaluate(async () => {
      const user = { _openid: 'feed-review', nickName: '读者' };
      (await import('/utils/app-state.js')).setUserSession(user, user._openid);
      uni.showToast = () => {};
      uni.$ensureTcbAuthenticated = async () => {};
      let randomBatch = 0;
      const tcb = { __skipAuth: true, async callFunction({ name, data = {} }) {
        let result = { success: true, posts: [], poets: [], activities: [], notices: [], total: 0 };
        if (name === 'getPostList') {
          const original = data.isOriginal !== false;
          const feed = original ? 'original' : 'reading';
          const batch = data.randomPoems ? `${feed}-random-${++randomBatch}` : feed;
          result.posts = data.skip ? [] : [0, 1, 2].map(index => ({
            _id: `${batch}-${index}`, isPoem: true, isOriginal: original,
            title: original ? '窗前' : '晚风', author: data.author || (original ? '林间' : '海子'),
            content: original ? '一阵风经过窗前\n把未说完的话\n留在翻动的书页间' : '晚风轻轻翻过山坡\n灯火在远处亮起\n我们沿着小路回家',
            votes: 3, isVoted: false, imageUrls: [], tags: []
          }));
        }
        if (name === 'getPoetList') result.poets = ['海子', '顾城', '北岛'].map((name, index) => ({ _id: `poet-${index}`, name }));
        if (name === 'getRecentActivities' && !data.noticeOnly) result.activities = [{
          _id: 'activity-review', title: '秋日诗歌共创', summary: '让诗歌在日常相遇',
          coverImage: '/static/images/activity/weekly.png', startTime: '2026-11-01', endTime: '2026-11-30', postCount: 12
        }];
        if (name === 'squareBubbleConfig') result.config = { enabled: false, text: '', target: 'weekly' };
        return { result };
      } };
      getCurrentPages().at(-1).$vm.$.appContext.config.globalProperties.$tcb = tcb;
      uni.$tcb = tcb;
      getApp().$tcb = tcb;
      uni.switchTab({ url: '/pages/poem-square/poem-square' });
    });
    const current = () => page.evaluate(() => ({ route: getCurrentPages().at(-1).route, mode: getCurrentPages().at(-1).$vm.poemMode }));
    const selectFilter = async (label, expectedLabels) => {
      await page.click('.poem-filter-trigger');
      await page.waitForSelector('.poem-filter-option');
      const labels = await page.$$eval('.poem-filter-option', nodes => nodes.map(node => node.textContent.trim()));
      assert.deepEqual(labels, expectedLabels);
      await page.click(`.poem-filter-option:nth-child(${labels.indexOf(label) + 1})`);
      await page.waitForSelector('.poem-filter-option', { hidden: true });
    };
    await page.waitForFunction(() => getCurrentPages().at(-1)?.$vm?.postList?.[0]?._id === 'original-0');
    await page.waitForSelector('.custom-top-bar .poem-mode-tabs');
    await page.waitForFunction(() => document.querySelector('.activity-entry-icon img')?.src.endsWith('/static/images/icons/activities.png'));
    const originalLayout = await page.evaluate(() => {
      const box = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { top: r.top, bottom: r.bottom }; };
      return { tabs: box('.custom-top-bar .poem-mode-tabs'), crow: box('.activity-entry-btn') };
    });
    await page.screenshot({ path: path.join(output, 'original.png') });
    const originalOptions = ['全部诗歌', '只看关注', '随机刷新'];
    for (const batch of [1, 2]) {
      await selectFilter('随机刷新', originalOptions);
      await page.waitForFunction(expected => getCurrentPages().at(-1).$vm.postList?.[0]?._id === expected, {}, `original-random-${batch}-0`);
    }
    await selectFilter('全部诗歌', originalOptions);
    await page.waitForFunction(() => getCurrentPages().at(-1).$vm.postList?.[0]?._id === 'original-0');
    await page.click('.custom-top-bar .poem-mode-tabs .poem-mode-tab:nth-child(2)');
    await page.waitForFunction(() => getCurrentPages().at(-1).$vm.postList?.[0]?._id === 'reading-0' && document.querySelector('.poet-avatar-bar-wrapper .avatar-name'));
    assert.deepEqual(await current(), { route: 'pages/poem-square/poem-square', mode: 'reading' });
    assert.equal(await page.$('.poem-filter-container'), null);
    console.log('PASS H5 original random refresh and reading menu visibility');
    assert.ok(originalLayout.crow.top >= originalLayout.tabs.bottom + 4, '乌鸦与切换栏保持距离');
    const geometry = await page.evaluate(() => {
      const box = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { top: r.top, bottom: r.bottom }; };
      return { poets: box('.poet-avatar-bar-wrapper'), card: box('.poem-card') };
    });
    assert.ok(geometry.poets.bottom <= geometry.card.top, '诗人栏不遮挡诗歌卡片');
    await page.screenshot({ path: path.join(output, 'reading.png') });
    await page.click('.poet-avatar-bar-wrapper .avatar-item:nth-child(2)');
    await page.waitForFunction(() => getCurrentPages().at(-1).$vm.selectedPoetName === '海子' && !getCurrentPages().at(-1).$vm.isLoading);
    await page.click('.custom-top-bar .poem-mode-tabs .poem-mode-tab:nth-child(1)');
    await page.waitForFunction(() => getCurrentPages().at(-1).$vm.postList?.[0]?._id === 'original-0');
    await page.click('.custom-top-bar .poem-mode-tabs .poem-mode-tab:nth-child(2)');
    await page.waitForFunction(() => getCurrentPages().at(-1).$vm.selectedPoetName === '海子' && !!document.querySelector('.poet-avatar-bar-wrapper'));
    await page.click('.tab-bar-item[data-index="2"]');
    await page.waitForFunction(() => getCurrentPages().at(-1)?.route === 'pages/activity/activity' && !document.querySelector('[data-tab-transition-cover]'));
    assert.equal(await page.$('.activity-back-btn'), null);
    assert.equal(await page.$eval('.custom-top-bar .activity-header-title', node => node.textContent), '活动');
    const activityHeader = await page.evaluate(() => {
      const topBar = document.querySelector('.custom-top-bar');
      return {
        icons: [...topBar.querySelectorAll('.top-icon img')].map(img => new URL(img.src).pathname),
        bottom: topBar.getBoundingClientRect().bottom,
        carouselTop: document.querySelector('.activity-notice-carousel').getBoundingClientRect().top
      };
    });
    assert.deepEqual(activityHeader.icons, [
      '/static/images/write_poetry.png',
      '/static/images/newicons/search.png',
      '/static/images/newicons/notification.png'
    ]);
    assert.ok(activityHeader.carouselTop >= activityHeader.bottom - 1, '公告轮播位于共用顶栏下方');
    assert.equal(await page.$$eval('uni-page[data-page] .tab-bar-text', nodes => nodes.map(node => node.textContent).join('/')), '广场/诗歌/活动/我');
    await page.screenshot({ path: path.join(output, 'activity.png') });
    await page.click('.tab-bar-item[data-index="1"]');
    await page.waitForFunction(() => getCurrentPages().at(-1)?.route === 'pages/poem-square/poem-square' && !document.querySelector('[data-tab-transition-cover]'));
    assert.equal((await current()).mode, 'reading', '返回诗歌保留当前模式');
    await page.click('.activity-entry-btn');
    await page.waitForFunction(() => getCurrentPages().at(-1)?.route === 'pages/activity/activity');
    console.log(`PASS H5 poem modes: real APIs with local fixtures, button, poet filter, layout, activity tab and return. Screenshots: ${output}`);
  } finally { await browser.close(); }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
