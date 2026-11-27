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
      vm._homeFeedRequestId = (vm._homeFeedRequestId || 0) + 1000;
      const samplePosts = [
        {
          _id: 'fixture-1',
          title: '春夜读诗记',
          content: '窗外的雨落得很轻\n檐下旧灯摇曳着微光\n我们在回车键里停顿了一秒',
          authorName: '回车君',
          isPoem: true,
          isOriginal: true,
          imageUrls: ['/static/images/filter.png', '/static/images/seed.png'],
          imageStyle: 'height: 0; padding-bottom: 75%;',
          tags: ['春日', '夜雨'],
          formattedCreateTime: '刚刚',
          votes: 12,
          commentCount: 3
        },
        {
          _id: 'fixture-2',
          title: '山风吹过旧书架',
          content: '翻到夹着银杏叶的那一页\n字迹已经微微泛黄\n可句子还带着秋天的温度',
          authorName: '林间客',
          isPoem: true,
          isOriginal: true,
          imageUrls: ['/static/images/seed.png'],
          imageStyle: 'height: 0; padding-bottom: 75%;',
          tags: ['读书', '银杏'],
          formattedCreateTime: '5分钟前',
          votes: 28,
          commentCount: 7
        },
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
      await page.evaluate(() => window.dispatchEvent(new Event('resize')));
      await new Promise((r) => setTimeout(r, 220));
      await page.evaluate(async () => {
        const vm = getCurrentPages().at(-1)?.$vm;
        if (vm) {
          vm._homeFeedRequestId = (vm._homeFeedRequestId || 0) + 1000;
          vm.useRecommendFeed = false;
          vm.isLoading = false;
          vm.homeHasEverLoaded = true;
          if (!vm.postList || !vm.postList.some((p) => p && p._id === 'fixture-1')) {
            vm.postList = [
              {
                _id: 'fixture-1',
                title: '春夜读诗记',
                content: '窗外的雨落得很轻\n檐下旧灯摇曳着微光',
                authorName: '回车君',
                isPoem: true,
                isOriginal: true,
                imageUrls: ['/static/images/filter.png', '/static/images/seed.png'],
                imageStyle: 'height: 0; padding-bottom: 75%;',
                tags: ['春日'],
                formattedCreateTime: '刚刚',
                votes: 12,
                commentCount: 3
              },
              {
                _id: 'fixture-2',
                title: '山风吹过旧书架',
                content: '翻到夹着银杏叶的那一页\n字迹已经微微泛黄',
                authorName: '林间客',
                isPoem: true,
                isOriginal: true,
                imageUrls: ['/static/images/seed.png'],
                imageStyle: 'height: 0; padding-bottom: 75%;',
                tags: ['读书'],
                formattedCreateTime: '5分钟前',
                votes: 28,
                commentCount: 7
              }
            ];
          }
          if (typeof vm.$nextTick === 'function') await vm.$nextTick();
        }
      });

      const metrics = await page.evaluate(() => {
        const root = document.documentElement;
        const tabBar = document.querySelector('.tab-bar');
        const tabRect = tabBar ? tabBar.getBoundingClientRect() : null;
        const masonry = document.querySelector('.feed-masonry');
        const cols = masonry ? masonry.querySelectorAll('.app-masonry-column').length : 0;
        const topBar = document.querySelector('.top-bar-container');
        const topRect = topBar ? topBar.getBoundingClientRect() : null;
        const imageWrappers = Array.from(document.querySelectorAll('#post-list-container .image-container-wrapper')).map((wrapper) => {
          const wRect = wrapper.getBoundingClientRect();
          const swiper = wrapper.querySelector('.image-swiper');
          const img = wrapper.querySelector('.post-image');
          const sRect = swiper ? swiper.getBoundingClientRect() : null;
          return {
            wrapper: { width: Math.round(wRect.width), height: Math.round(wRect.height) },
            swiper: sRect ? { width: Math.round(sRect.width), height: Math.round(sRect.height) } : null,
            image: img ? { width: Math.round(img.offsetWidth), height: Math.round(img.offsetHeight) } : null
          };
        });
        return {
          sizeClass: root.getAttribute('data-layout-size'),
          navMode: root.getAttribute('data-nav-mode'),
          overflowX: root.scrollWidth > window.innerWidth + 2,
          rootFontSize: parseFloat(getComputedStyle(root).fontSize),
          tabRect: tabRect ? { left: Math.round(tabRect.left), top: Math.round(tabRect.top), width: Math.round(tabRect.width), height: Math.round(tabRect.height) } : null,
          topRect: topRect ? { left: Math.round(topRect.left), width: Math.round(topRect.width), height: Math.round(topRect.height) } : null,
          masonryColumns: cols,
          imageWrappers
        };
      });

      assert.equal(metrics.sizeClass, vp.expectedSize, `${vp.name}: unexpected sizeClass ${metrics.sizeClass}`);
      assert.equal(metrics.navMode, vp.expectedNav, `${vp.name}: unexpected navMode ${metrics.navMode}`);
      assert.equal(metrics.overflowX, false, `${vp.name}: horizontal overflow detected`);
      assert.ok(metrics.rootFontSize <= 22, `${vp.name}: rpx root fontSize exploded (${metrics.rootFontSize}px)`);
      assert.ok(metrics.tabRect, `${vp.name}: tab-bar must be visible`);
      assert.ok(metrics.imageWrappers.length >= 2, `${vp.name}: expected image wrapper fixtures`);
      for (const box of metrics.imageWrappers) {
        assert.ok(box.wrapper.width > 100 && box.wrapper.height > 100, `${vp.name}: invalid image wrapper size ${JSON.stringify(box)}`);
        if (box.swiper) {
          assert.ok(
            Math.abs(box.swiper.width - box.wrapper.width) <= 2 && Math.abs(box.swiper.height - box.wrapper.height) <= 2,
            `${vp.name}: swiper must fill image-container-wrapper without bottom grey gap ${JSON.stringify(box)}`
          );
        }
        if (box.image) {
          assert.ok(
            Math.abs(box.image.width - box.wrapper.width) <= 2 && Math.abs(box.image.height - box.wrapper.height) <= 2,
            `${vp.name}: image must fill image-container-wrapper ${JSON.stringify(box)}`
          );
        }
      }

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

    // 验证 iPad 横屏下滑动多图轮播：不误触大图预览、不带动外层 page-swiper 切到关注页，且纯净点击仍可打开预览
    await page.setViewport({ width: 1194, height: 834, deviceScaleFactor: 1, isMobile: false, hasTouch: true });
    await page.evaluate(() => window.dispatchEvent(new Event('resize')));
    await new Promise((r) => setTimeout(r, 260));
    const swiperBox = await page.evaluate(() => {
      const vm = getCurrentPages().at(-1)?.$vm;
      if (vm) {
        vm.swiperCurrent = 0;
        vm.currentTab = 'square';
        vm.currentPage = 'home';
      }
      window.__previewCalls = [];
      const origPreview = uni.previewImage;
      window.__origPreviewImage = origPreview;
      uni.previewImage = (opts) => {
        window.__previewCalls.push(opts);
      };
      const el = document.querySelector('#post-list-container .image-swiper');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { left: r.left, top: r.top, width: r.width, height: r.height };
    });
    assert.ok(swiperBox && swiperBox.width > 150, 'ipad-landscape: multi-image swiper must be visible for gesture test');

    const startX = swiperBox.left + swiperBox.width * 0.78;
    const endX = swiperBox.left + swiperBox.width * 0.22;
    const midY = swiperBox.top + swiperBox.height * 0.5;

    const beforeSwipeDot = await page.evaluate(() => {
      const dots = Array.from(document.querySelectorAll('#post-list-container .image-swiper .uni-swiper-dot'));
      return dots.findIndex((d) => d.classList.contains('uni-swiper-dot-active'));
    });

    // 1) 触摸滑动多图 swiper（模拟平板/手机手指横滑）
    await page.evaluate(({ sx, ex, y }) => {
      const target = document.querySelector('#post-list-container .image-swiper .post-image') || document.querySelector('#post-list-container .image-swiper');
      if (!target || typeof Touch === 'undefined') return;
      const makeTouch = (x) => new Touch({ identifier: 1, target, clientX: x, clientY: y, pageX: x, pageY: y });
      const t0 = makeTouch(sx);
      target.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, cancelable: true, touches: [t0], targetTouches: [t0], changedTouches: [t0] }));
      for (let i = 1; i <= 6; i += 1) {
        const curX = sx + ((ex - sx) * i) / 6;
        const ti = makeTouch(curX);
        target.dispatchEvent(new TouchEvent('touchmove', { bubbles: true, cancelable: true, touches: [ti], targetTouches: [ti], changedTouches: [ti] }));
      }
      const tEnd = makeTouch(ex);
      target.dispatchEvent(new TouchEvent('touchend', { bubbles: true, cancelable: true, touches: [], targetTouches: [], changedTouches: [tEnd] }));
      target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: ex, clientY: y }));
    }, { sx: startX, ex: endX, y: midY });
    await new Promise((r) => setTimeout(r, 340));

    const afterTouchSwipe = await page.evaluate(() => {
      const vm = getCurrentPages().at(-1)?.$vm;
      const dots = Array.from(document.querySelectorAll('#post-list-container .image-swiper .uni-swiper-dot'));
      return {
        innerDot: dots.findIndex((d) => d.classList.contains('uni-swiper-dot-active')),
        swiperCurrent: vm ? vm.swiperCurrent : -1,
        currentTab: vm ? vm.currentTab : '',
        previewCount: (window.__previewCalls || []).length,
        isInnerSwiperTouching: vm ? !!vm.isInnerSwiperTouching : false
      };
    });
    assert.notEqual(afterTouchSwipe.innerDot, beforeSwipeDot, `inner multi-image swiper must advance slide on touch swipe (before=${beforeSwipeDot}, after=${afterTouchSwipe.innerDot})`);
    assert.equal(afterTouchSwipe.swiperCurrent, 0, `touch swipe on multi-image carousel must NOT swipe page to following (got ${afterTouchSwipe.swiperCurrent})`);
    assert.equal(afterTouchSwipe.currentTab, 'square', `touch swipe on multi-image carousel must stay on square tab (got ${afterTouchSwipe.currentTab})`);
    assert.equal(afterTouchSwipe.previewCount, 0, `touch swipe on multi-image carousel must NOT trigger image preview (got ${afterTouchSwipe.previewCount})`);
    assert.equal(afterTouchSwipe.isInnerSwiperTouching, false, 'outer page-swiper touch lock must release after inner touch swipe ends');

    // 2) 鼠标拖拽多图 swiper（模拟横屏触控板/鼠标滑动）
    await page.mouse.move(startX, midY);
    await page.mouse.down();
    await page.mouse.move((startX + endX) / 2, midY, { steps: 6 });
    await page.mouse.move(endX, midY, { steps: 6 });
    await page.mouse.up();
    await new Promise((r) => setTimeout(r, 340));

    const afterSwipe = await page.evaluate(() => {
      const vm = getCurrentPages().at(-1)?.$vm;
      return {
        swiperCurrent: vm ? vm.swiperCurrent : -1,
        currentTab: vm ? vm.currentTab : '',
        previewCount: (window.__previewCalls || []).length,
        isInnerSwiperTouching: vm ? !!vm.isInnerSwiperTouching : false
      };
    });
    assert.equal(afterSwipe.swiperCurrent, 0, `swiping multi-image carousel must NOT swipe page to following (got ${afterSwipe.swiperCurrent})`);
    assert.equal(afterSwipe.currentTab, 'square', `swiping multi-image carousel must stay on square tab (got ${afterSwipe.currentTab})`);
    assert.equal(afterSwipe.previewCount, 0, `swiping multi-image carousel must NOT trigger image preview (got ${afterSwipe.previewCount})`);
    assert.equal(afterSwipe.isInnerSwiperTouching, false, 'outer page-swiper touch lock must release after inner swipe ends');

    // 3) 滑动结束后纯净点击图片，仍可正常打开大图预览
    await page.mouse.click(swiperBox.left + swiperBox.width * 0.5, midY);
    await new Promise((r) => setTimeout(r, 120));
    const afterCleanTap = await page.evaluate(() => {
      const count = (window.__previewCalls || []).length;
      if (window.__origPreviewImage) {
        uni.previewImage = window.__origPreviewImage;
      }
      return count;
    });
    assert.equal(afterCleanTap, 1, `clean tap on multi-image post must still open preview (got ${afterCleanTap})`);

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
      const inlinePanel = document.querySelector('.sidebar-inline-panel');
      const inlineGrid = document.querySelector('.sidebar-inline-grid');
      const drawer = document.querySelector('.sidebar');
      if (!leftCol || !hero || !vTab || !body || !inlinePanel || !inlineGrid) return null;
      const l = leftCol.getBoundingClientRect();
      const h = hero.getBoundingClientRect();
      const t = vTab.getBoundingClientRect();
      const b = body.getBoundingClientRect();
      const g = inlineGrid.getBoundingClientRect();
      return {
        hasDrawer: !!drawer,
        inlineExpandedByDefault: getComputedStyle(inlinePanel).display !== 'none' && g.height > 100,
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
    assert.equal(profileMetrics.inlineExpandedByDefault, true, 'inline profile menu must be expanded by default on wide screens');
    assert.ok(profileMetrics.buttonCount >= 10, `inline button panel must include sidebar actions (got ${profileMetrics.buttonCount})`);
    assert.ok(profileMetrics.heroWidth >= 380, `profile card should be wider (${profileMetrics.heroWidth}px)`);
    assert.ok(profileMetrics.tabTop >= profileMetrics.heroBottom - 2, 'vertical tabs must sit below the profile card');
    assert.ok(profileMetrics.tabLeft >= profileMetrics.gridRight - 2, 'vertical tabs must sit to the right of inline buttons');
    assert.ok(profileMetrics.bodyLeft >= profileMetrics.leftRight - 2, 'post list must sit to the right of the left column');
    // 点击原侧边栏按钮可收起，再点重新展开
    const collapsed = await page.evaluate(async () => {
      const vm = getCurrentPages().at(-1)?.$vm;
      vm.toggleSidebar();
      await new Promise(r => setTimeout(r, 80));
      const hidden = getComputedStyle(document.querySelector('.sidebar-inline-panel')).display === 'none';
      vm.toggleSidebar();
      await new Promise(r => setTimeout(r, 80));
      const reopened = getComputedStyle(document.querySelector('.sidebar-inline-panel')).display !== 'none';
      return { hidden, reopened };
    });
    assert.equal(collapsed.hidden, true, 'toggling sidebar button in wide profile must collapse inline buttons');
    assert.equal(collapsed.reopened, true, 'toggling sidebar button again must re-expand inline buttons');
    await page.screenshot({ path: path.join(outDir, 'profile-ipad-landscape.png') });

    // 验证活动页在平板横屏下顶部公告双图并排展示，显著压缩高度
    await page.evaluate(() => uni.switchTab({ url: '/pages/activity/activity' }));
    await page.waitForFunction(() => getCurrentPages().at(-1)?.route === 'pages/activity/activity');
    await new Promise((r) => setTimeout(r, 260));
    const activityMetrics = await page.evaluate(() => {
      const carousel = document.querySelector('.activity-notice-carousel--two-up');
      const viewport = document.querySelector('.notice-viewport--two-up');
      if (!carousel || !viewport) return null;
      const v = viewport.getBoundingClientRect();
      return { width: Math.round(v.width), height: Math.round(v.height) };
    });
    assert.ok(activityMetrics, 'activity notice carousel must switch to two-up mode on wide screens');
    assert.ok(activityMetrics.height > 120 && activityMetrics.height <= 340, `two-up banner height must stay compact (got ${activityMetrics.height}px)`);
    await page.screenshot({ path: path.join(outDir, 'activity-ipad-landscape.png') });

    console.log(`[test-responsive-layout-h5] PASS: ${VIEWPORTS.length} index viewports + dual-pane post-detail + wide profile + two-up activity carousel verified; screenshots saved to ${outDir}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error('[test-responsive-layout-h5] FAIL:', error);
  process.exitCode = 1;
});
