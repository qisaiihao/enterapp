const assert = require('node:assert/strict');
const puppeteer = require('puppeteer-core');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const VIEWPORTS = [
  { name: 'phone-portrait', width: 390, height: 844, expectedSize: 'compact', expectedNav: 'bottom' },
  { name: 'phone-landscape', width: 844, height: 390, expectedSize: 'expanded', expectedNav: 'rail' },
  { name: 'duo-unfolded-portrait', width: 720, height: 840, expectedSize: 'medium', expectedNav: 'rail' },
  { name: 'duo-unfolded-landscape', width: 840, height: 720, expectedSize: 'expanded', expectedNav: 'sidebar' },
  { name: 'ipad-landscape', width: 1194, height: 834, expectedSize: 'expanded', expectedNav: 'sidebar' },
  { name: 'harmony-tablet', width: 1280, height: 800, expectedSize: 'expanded', expectedNav: 'sidebar' }
];

async function main() {
  const outDir = path.join(os.tmpdir(), 'enterkey-responsive-review');
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true
  });
  try {
    const page = await browser.newPage();
    const baseUrl = process.env.H5_URL || 'http://localhost:5174/';
    // 预设隐私同意版本号，避免测试会话被重定向至开屏页
    await page.evaluateOnNewDocument(() => {
      try {
        localStorage.setItem('privacyConsentVersion', JSON.stringify({ type: 'string', data: '2026-11-23:1' }));
      } catch (_) {}
    });

    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    await page.goto(baseUrl + '#/pages/index/index', { waitUntil: 'networkidle2' });
    await page.waitForFunction(() => typeof getCurrentPages === 'function' && getCurrentPages().at(-1)?.$vm);
    await page.evaluate(() => {
      try { uni.setStorageSync('privacyConsentVersion', '2026-11-23:1'); } catch (_) {}
    });
    const currentRoute = await page.evaluate(() => getCurrentPages().at(-1)?.route || '');
    if (currentRoute !== 'pages/index/index') {
      await page.evaluate(() => uni.switchTab({ url: '/pages/index/index' }));
      await page.waitForFunction(() => getCurrentPages().at(-1)?.route === 'pages/index/index');
    }

    // 注入本地示例帖子以验证真实双列瀑布流排版，不发起写入请求
    await page.evaluate(() => {
      const vm = getCurrentPages().at(-1)?.$vm;
      if (!vm) return;
      const samplePosts = [
        { _id: 'fixture-1', title: '春夜读诗记', content: '窗外的雨落得很轻\n檐下旧灯摇曳着微光\n我们在回车键里停顿了一秒', authorName: '回车君', isPoem: true, isOriginal: true, tags: ['春日', '夜雨'], formattedCreateTime: '刚刚', votes: 12, commentCount: 3 },
        { _id: 'fixture-2', title: '山风吹过旧书架', content: '翻到夹着银杏叶的那一页\n字迹已经微微泛黄\n可句子还带着秋天的温度', authorName: '林间客', isPoem: true, isOriginal: true, tags: ['读书', '银杏'], formattedCreateTime: '5分钟前', votes: 28, commentCount: 7 },
        { _id: 'fixture-3', title: '关于现代诗分行节奏的讨论', content: '大家在写长句时更习惯自然呼吸断行，还是刻意制造跨行停顿？', authorName: '诗社编辑', isPoem: false, isOriginal: false, tags: ['讨论', '分行'], formattedCreateTime: '18分钟前', votes: 19, commentCount: 9 },
        { _id: 'fixture-4', title: '海边车站', content: '末班车驶离后\n月台只剩潮声和站牌的回音', authorName: '南风', isPoem: true, isOriginal: true, tags: ['海边'], formattedCreateTime: '1小时前', votes: 42, commentCount: 5 }
      ];
      vm.useRecommendFeed = false;
      vm.isLoading = false;
      vm.homeHasEverLoaded = true;
      vm.discoverHasEverLoaded = true;
      vm.discoverIsLoading = false;
      vm.postList = samplePosts;
      vm.discoverPostList = samplePosts;
    });

    for (const vp of VIEWPORTS) {
      await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 1, isMobile: vp.width < 600, hasTouch: true });
      await page.evaluate(() => {
        const vm = getCurrentPages().at(-1)?.$vm;
        if (vm) {
          vm.useRecommendFeed = false;
          vm.isLoading = false;
          vm.homeHasEverLoaded = true;
          if (!vm.postList || vm.postList.length === 0) {
            vm.postList = [
              { _id: 'fixture-1', title: '春夜读诗记', content: '窗外的雨落得很轻\n檐下旧灯摇曳着微光', authorName: '回车君', isPoem: true, isOriginal: true, tags: ['春日'], formattedCreateTime: '刚刚', votes: 12, commentCount: 3 },
              { _id: 'fixture-2', title: '山风吹过旧书架', content: '翻到夹着银杏叶的那一页\n字迹已经微微泛黄', authorName: '林间客', isPoem: true, isOriginal: true, tags: ['读书'], formattedCreateTime: '5分钟前', votes: 28, commentCount: 7 }
            ];
          }
        }
        window.dispatchEvent(new Event('resize'));
      });
      await new Promise((r) => setTimeout(r, 220));

      const metrics = await page.evaluate(() => {
        const root = document.documentElement;
        const tabBar = document.querySelector('.tab-bar');
        const tabRect = tabBar ? tabBar.getBoundingClientRect() : null;
        const masonry = document.querySelector('.feed-masonry');
        const cols = masonry ? masonry.querySelectorAll('.app-masonry-column').length : 0;
        const topBar = document.querySelector('.top-bar-container');
        const topRect = topBar ? topBar.getBoundingClientRect() : null;
        return {
          sizeClass: root.getAttribute('data-layout-size'),
          navMode: root.getAttribute('data-nav-mode'),
          overflowX: root.scrollWidth > window.innerWidth + 2,
          rootFontSize: parseFloat(getComputedStyle(root).fontSize),
          tabRect: tabRect ? { left: Math.round(tabRect.left), top: Math.round(tabRect.top), width: Math.round(tabRect.width), height: Math.round(tabRect.height) } : null,
          topRect: topRect ? { left: Math.round(topRect.left), width: Math.round(topRect.width), height: Math.round(topRect.height) } : null,
          masonryColumns: cols
        };
      });

      assert.equal(metrics.sizeClass, vp.expectedSize, `${vp.name}: unexpected sizeClass ${metrics.sizeClass}`);
      assert.equal(metrics.navMode, vp.expectedNav, `${vp.name}: unexpected navMode ${metrics.navMode}`);
      assert.equal(metrics.overflowX, false, `${vp.name}: horizontal overflow detected`);
      assert.ok(metrics.rootFontSize <= 22, `${vp.name}: rpx root fontSize exploded (${metrics.rootFontSize}px)`);
      assert.ok(metrics.tabRect, `${vp.name}: tab-bar must be visible`);

      if (vp.expectedNav === 'rail') {
        assert.ok(metrics.tabRect.width >= 76 && metrics.tabRect.width <= 96, `${vp.name}: rail width mismatch ${JSON.stringify(metrics.tabRect)}`);
        assert.equal(metrics.masonryColumns, 2, `${vp.name}: wide feed must use 2-column masonry`);
        assert.ok(metrics.topRect && metrics.topRect.left >= metrics.tabRect.width - 2, `${vp.name}: top-bar must not overlap left rail`);
      } else if (vp.expectedNav === 'sidebar') {
        assert.ok(metrics.tabRect.width >= 148 && metrics.tabRect.width <= 172, `${vp.name}: sidebar width mismatch ${JSON.stringify(metrics.tabRect)}`);
        assert.equal(metrics.masonryColumns, 2, `${vp.name}: wide feed must use 2-column masonry`);
        assert.ok(metrics.topRect && metrics.topRect.left >= metrics.tabRect.width - 2, `${vp.name}: top-bar must not overlap left sidebar`);
      } else {
        assert.equal(metrics.masonryColumns, 0, `${vp.name}: compact phone must keep single-column feed`);
      }
      await page.screenshot({ path: path.join(outDir, `index-${vp.name}.png`) });
    }

    // 验证帖子详情页在 iPad 横屏下的左诗右评双栏布局
    await page.setViewport({ width: 1194, height: 834, deviceScaleFactor: 1, isMobile: false, hasTouch: true });
    await page.evaluate(() => uni.navigateTo({ url: '/pages/post-detail/post-detail?id=fixture-1' }));
    await page.waitForFunction(() => getCurrentPages().at(-1)?.route === 'pages/post-detail/post-detail');
    await page.evaluate(() => {
      const vm = getCurrentPages().at(-1)?.$vm;
      if (!vm) return;
      vm.isLoading = false;
      vm.isCommentLoading = false;
      vm.post = {
        _id: 'fixture-1',
        title: '春夜读诗记',
        content: '窗外的雨落得很轻\n檐下旧灯摇曳着微光\n我们在回车键里停顿了一秒\n\n风穿过阳台与纸页\n把未写完的诗句折进夜色',
        authorName: '回车君',
        author: '回车君',
        isPoem: true,
        isOriginal: true,
        tags: ['春日', '夜雨', '现代诗'],
        formattedCreateTime: '2026-11-27 13:00',
        votes: 12,
        commentCount: 2
      };
      vm.comments = [
        { _id: 'c-1', authorName: '林间客', content: '“在回车键里停顿了一秒”很有画面感！', formattedCreateTime: '3分钟前', likes: 4 },
        { _id: 'c-2', authorName: '南风', content: '横屏左诗右评的阅读体验太舒服了。', formattedCreateTime: '1分钟前', likes: 2 }
      ];
      vm.commentCount = 2;
      window.dispatchEvent(new Event('resize'));
    });
    await new Promise((r) => setTimeout(r, 240));
    const detailMetrics = await page.evaluate(() => {
      const primary = document.querySelector('.detail-layout--split .detail-primary-pane');
      const secondary = document.querySelector('.detail-layout--split .detail-secondary-pane');
      const bar = document.querySelector('.bottom-action-bar--split');
      if (!primary || !secondary || !bar) return null;
      const p = primary.getBoundingClientRect();
      const s = secondary.getBoundingClientRect();
      const b = bar.getBoundingClientRect();
      return {
        primary: { left: Math.round(p.left), right: Math.round(p.right), width: Math.round(p.width) },
        secondary: { left: Math.round(s.left), right: Math.round(s.right), width: Math.round(s.width) },
        bar: { left: Math.round(b.left), right: Math.round(b.right), width: Math.round(b.width) }
      };
    });
    assert.ok(detailMetrics, 'post-detail must render split dual-pane layout on iPad landscape');
    assert.ok(detailMetrics.secondary.left > detailMetrics.primary.right, 'right comment pane must sit to the right of poem pane with crease gap');
    assert.ok(detailMetrics.bar.left >= detailMetrics.primary.right, 'split comment action bar must dock under right pane');
    await page.screenshot({ path: path.join(outDir, 'post-detail-ipad-landscape.png') });

    // 验证个人主页宽屏三段布局（左名片+展开双列按钮、中竖排三Tab、右内容流）
    await page.evaluate(() => {
      try {
        const mockUser = { _openid: 'u-fixture', nickName: 'Álvaro de Campos', poemId: 'qisaihao', bio: '谁此时孤独，就永远孤独' };
        uni.setStorageSync('userInfo', mockUser);
        const app = getApp();
        if (app && app.globalData) {
          app.globalData.isLoggedIn = true;
          app.globalData.userInfo = mockUser;
          app.globalData.openid = mockUser._openid;
        }
      } catch (_) {}
      uni.switchTab({ url: '/pages/profile/profile' });
    });
    await page.waitForFunction(() => getCurrentPages().at(-1)?.route === 'pages/profile/profile');
    await page.evaluate(() => {
      const vm = getCurrentPages().at(-1)?.$vm;
      if (!vm) return;
      vm.isLoading = false;
      vm.hasInitialSnapshot = true;
      vm.isViewingSelf = true;
      vm.userInfo = { _openid: 'u-fixture', nickName: 'Álvaro de Campos', poemId: 'qisaihao', bio: '谁此时孤独，就永远孤独' };
      vm.followerCount = 72;
      vm.currentTab = 'posts';
      vm.isSidebarOpen = true;
      vm.myPosts = [
        { _id: 'p-1', title: '春夜读诗记', content: '窗外的雨落得很轻\n檐下旧灯摇曳着微光', authorName: 'Álvaro de Campos', isPoem: true, formattedCreateTime: '1天前' },
        { _id: 'p-2', title: '拼贴诗', content: '金融债务 潮来潮去', authorName: 'Álvaro de Campos', isPoem: true, formattedCreateTime: '2026-11-16' }
      ];
      window.dispatchEvent(new Event('resize'));
    });
    await new Promise((r) => setTimeout(r, 260));
    const profileMetrics = await page.evaluate(() => {
      const leftCol = document.querySelector('.profile-left-column');
      const hero = document.querySelector('.profile-hero-section');
      const vTab = document.querySelector('.tab-navigation--vertical');
      const body = document.querySelector('.profile-body-shell');
      const inlineGrid = document.querySelector('.sidebar-inline-grid');
      const drawer = document.querySelector('.sidebar');
      if (!leftCol || !hero || !vTab || !body || !inlineGrid) return null;
      const l = leftCol.getBoundingClientRect();
      const h = hero.getBoundingClientRect();
      const t = vTab.getBoundingClientRect();
      const b = body.getBoundingClientRect();
      const g = inlineGrid.getBoundingClientRect();
      return {
        hasDrawer: !!drawer,
        buttonCount: inlineGrid.querySelectorAll('.sidebar-inline-btn').length,
        heroWidth: Math.round(h.width),
        heroBottom: Math.round(h.bottom),
        leftRight: Math.round(l.right),
        tabTop: Math.round(t.top),
        tabLeft: Math.round(t.left),
        tabRight: Math.round(t.right),
        bodyLeft: Math.round(b.left),
        gridRight: Math.round(g.right)
      };
    });
    assert.ok(profileMetrics, 'profile page must render wide card + lower inline grid & vertical tab rail on tablet');
    assert.equal(profileMetrics.hasDrawer, false, 'wide split profile must replace drawer with inline button panel');
    assert.ok(profileMetrics.buttonCount >= 10, `inline button panel must include sidebar actions (got ${profileMetrics.buttonCount})`);
    assert.ok(profileMetrics.heroWidth >= 380, `profile card should be wider (${profileMetrics.heroWidth}px)`);
    assert.ok(profileMetrics.tabTop >= profileMetrics.heroBottom - 2, 'vertical tabs must sit below the profile card');
    assert.ok(profileMetrics.tabLeft >= profileMetrics.gridRight - 2, 'vertical tabs must sit to the right of inline buttons');
    assert.ok(profileMetrics.bodyLeft >= profileMetrics.leftRight - 2, 'post list must sit to the right of the left column');
    await page.screenshot({ path: path.join(outDir, 'profile-ipad-landscape.png') });

    console.log(`[test-responsive-layout-h5] PASS: ${VIEWPORTS.length} index viewports + dual-pane post-detail + wide profile verified; screenshots saved to ${outDir}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error('[test-responsive-layout-h5] FAIL:', error);
  process.exitCode = 1;
});
