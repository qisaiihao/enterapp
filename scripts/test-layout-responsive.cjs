const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');

function loadEsModule(relPath, extraGlobals = {}) {
  const fullPath = path.join(ROOT, relPath);
  const raw = fs.readFileSync(fullPath, 'utf8');
  const transformed = raw
    .replace(/import\s+[^;]+;\s*/g, '')
    .replace(/export\s+default\s+[\s\S]*?;\s*(?=\n*if\s*\(typeof module|$)/g, '')
    .replace(/export\s+\{[\s\S]*?\};\s*/g, '');
  const mod = { exports: {} };
  const sandbox = {
    module: mod,
    exports: mod.exports,
    console,
    setTimeout,
    clearTimeout,
    ...extraGlobals
  };
  vm.runInNewContext(transformed, sandbox, { filename: fullPath });
  return mod.exports;
}

function testConfigIntegrity() {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
  const pages = JSON.parse(fs.readFileSync(path.join(ROOT, 'pages.json'), 'utf8'));
  const harmonyModule = fs.readFileSync(path.join(ROOT, 'harmony-configs/entry/src/main/module.json5'), 'utf8');

  assert.deepEqual(
    manifest['app-plus'].screenOrientation,
    ['portrait-primary', 'portrait-secondary', 'landscape-primary', 'landscape-secondary'],
    'manifest.json 必须开启四方向旋转'
  );
  assert.equal(manifest['app-plus'].distribute.ios.devices, 'universal', 'iOS 须声明 universal 设备支持 iPad / iPhone Duo');
  assert.equal(manifest['app-plus'].distribute.ios.UIRequiresFullScreen, false, 'iOS 须允许分屏/台前调度多窗口');
  assert.equal(manifest['app-plus'].distribute.android.resizeableActivity, true, 'Android 须开启 resizeableActivity 支持平板分屏与折叠屏展开');

  assert.equal(pages.globalStyle.pageOrientation, 'auto', 'pages.json 须启用 pageOrientation: auto');
  assert.equal(pages.globalStyle.rpxCalcMaxDeviceWidth, 500, 'rpxCalcMaxDeviceWidth 须限制在 500 防止折叠屏/平板 rpx 巨型化');
  assert.equal(pages.globalStyle.rpxCalcBaseDeviceWidth, 400, 'rpxCalcBaseDeviceWidth 须为 400');
  assert.equal(pages.globalStyle.rpxCalcIncludeWidth, 750);

  assert.ok(harmonyModule.includes('"tablet"'), '鸿蒙配置须包含 tablet');
  assert.ok(harmonyModule.includes('"follow_desktop"'), '鸿蒙 EntryAbility 须配置 follow_desktop（手机随桌面锁竖屏、平板/折叠屏支持旋转）');
}

function testNoSafeAreaTimesTwoInCorePages() {
  const files = [
    'pages/index/index.vue',
    'pages/poem-square/poem-square.vue'
  ];
  for (const rel of files) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    assert.equal(/safeAreaTop\s*\*\s*2/.test(src), false, `${rel} 不得保留 safeAreaTop * 2 竖屏硬编码`);
  }

  const detailSrc = fs.readFileSync(path.join(ROOT, 'pages/post-detail/post-detail.vue'), 'utf8');
  assert.equal(
    /top:\s*calc\(90rpx\s*\+\s*env\(safe-area-inset-top/.test(detailSrc),
    false,
    'post-detail 不得在 App 端叠加 90rpx 与 env(safe-area-inset-top) 导致 iOS 顶部留白过大'
  );
  assert.equal(
    /padding-top:\s*calc\(160rpx\s*\+\s*env\(safe-area-inset-top/.test(detailSrc),
    false,
    'post-detail 不得在 App 端叠加 160rpx 与 env(safe-area-inset-top) 导致 iOS 顶部留白过大'
  );
  assert.ok(
    detailSrc.includes('top: var(--app-safe-area-top, env(safe-area-inset-top, 0px));'),
    'post-detail 顶部按钮须复用 --app-safe-area-top'
  );
  assert.ok(
    detailSrc.includes('padding-top: calc(88rpx + var(--app-safe-area-top, env(safe-area-inset-top, 0px)));'),
    'post-detail 内容容器须复用 --app-safe-area-top'
  );

  // 宽屏多列分页自补与防自锁回归检查（防止桌面 H5 首屏不满屏卡死无法滚动触发加载）
  const poemSquareSrc = fs.readFileSync(path.join(ROOT, 'pages/poem-square/poem-square.vue'), 'utf8');
  assert.ok(poemSquareSrc.includes('checkViewportFill('), 'poem-square 须在宽屏首屏不满屏时自动补载下一页');
  assert.equal(
    /this\._loadingLock\s*=\s*true;\s*this\.showPageIndicator\s*=\s*true;\s*this\.getPostList\(/.test(poemSquareSrc),
    false,
    'poem-square onPageScroll 不得在调用 getPostList 前提前置 _loadingLock=true 导致请求自锁跳过'
  );
  const feedListSrc = fs.readFileSync(path.join(ROOT, 'components/FeedList.vue'), 'utf8');
  assert.ok(feedListSrc.includes('checkViewportFill('), 'FeedList 须在宽屏双列不满屏时自动补载下一页');
  assert.ok(feedListSrc.includes('@scrolltolower="handleScrollToLower"'), 'FeedList 须绑定 scrolltolower 兜底触底加载');
  const activitySrc = fs.readFileSync(path.join(ROOT, 'pages/activity/activity.vue'), 'utf8');
  assert.ok(activitySrc.includes('checkViewportFill('), 'activity 须在宽屏三列不满屏时自动补载下一页');
}

function testAspectRatioWrapperSwiperFillsContainer() {
  const wrapperFiles = [
    'components/PostItem.vue',
    'pages-content/favorite-content/favorite-content.vue',
    'pages-user/poet-profile/poet-profile.vue'
  ];
  for (const rel of wrapperFiles) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    assert.equal(
      /<swiper[\s\S]*?class="image-swiper"[\s\S]*?:style="[^"]*220px/.test(src),
      false,
      `${rel} 的 .image-container-wrapper 内 swiper 不得写死 220px 行内高度，否则横屏宽列下会在底部露出灰边`
    );
    assert.ok(
      /\.image-container-wrapper\s+\.post-image,\s*\.image-container-wrapper\s+\.image-swiper\s*\{[\s\S]*?height:\s*100%;/.test(src),
      `${rel} 须让 .image-swiper 100% 填满 .image-container-wrapper`
    );
  }
}

function testLayoutBreakpointsAndRpx() {
  const emitted = [];
  const orientationCalls = [];
  let resizeCallback = null;
  let currentWindow = { windowWidth: 390, windowHeight: 844, statusBarHeight: 44, safeAreaInsets: { top: 44, right: 0, bottom: 34, left: 0 } };
  const uni = {
    $emit: (event, payload) => emitted.push({ event, payload }),
    onWindowResize: (cb) => { resizeCallback = cb; }
  };
  const plus = {
    screen: {
      lockOrientation: (mode) => orientationCalls.push(`lock:${mode}`),
      unlockOrientation: () => orientationCalls.push('unlock')
    }
  };

  const layout = loadEsModule('utils/layout.js', {
    uni,
    plus,
    getWindowInfoCompat: () => currentWindow,
    getStatusBarHeightCompat: () => currentWindow.statusBarHeight || 0
  });

  // 1. 手机竖屏 compact
  const phone = layout.buildLayoutSnapshot(currentWindow, { mpWeixin: false });
  assert.equal(phone.sizeClass, 'compact');
  assert.equal(phone.isLargeScreenDevice, false);
  assert.equal(phone.isWide, false);
  assert.equal(phone.isSplitDetail, false);
  assert.equal(phone.navMode, 'bottom');
  assert.equal(phone.navRailWidth, 0);
  assert.equal(phone.feedColumns, 1);
  assert.equal(phone.activityColumns, 1);

  // 1b. iPad 窄分屏 (windowWidth 320, screen 1024x768)：UI 走紧凑单列，但设备本身仍是大屏不锁竖屏
  const ipadNarrowSplit = layout.buildLayoutSnapshot({
    windowWidth: 320, windowHeight: 768,
    screenWidth: 1024, screenHeight: 768,
    safeAreaInsets: { top: 24, right: 0, bottom: 20, left: 0 }
  }, { mpWeixin: false });
  assert.equal(ipadNarrowSplit.sizeClass, 'compact');
  assert.equal(ipadNarrowSplit.isLargeScreenDevice, true);

  // 2. 折叠屏 / iPhone Duo 展开 medium (720x840)
  const duo = layout.buildLayoutSnapshot({
    windowWidth: 720, windowHeight: 840,
    safeAreaInsets: { top: 24, right: 0, bottom: 20, left: 0 }
  }, { mpWeixin: false });
  assert.equal(duo.sizeClass, 'medium');
  assert.equal(duo.isLargeScreenDevice, true);
  assert.equal(duo.isWide, true);
  assert.equal(duo.isSplitDetail, true);
  assert.equal(duo.navMode, 'rail');
  assert.equal(duo.navRailWidth, 80);
  assert.equal(duo.feedColumns, 2);
  assert.equal(duo.poemColumns, 2);
  assert.equal(duo.activityColumns, 2);

  // 3. iPad / 鸿蒙平板横屏 expanded (1194x834)
  const ipad = layout.buildLayoutSnapshot({
    windowWidth: 1194, windowHeight: 834,
    safeAreaInsets: { top: 24, right: 0, bottom: 20, left: 16 }
  }, { mpWeixin: false });
  assert.equal(ipad.sizeClass, 'expanded');
  assert.equal(ipad.isLargeScreenDevice, true);
  assert.equal(ipad.isLandscape, true);
  assert.equal(ipad.isShortLandscape, false);
  assert.equal(ipad.navMode, 'sidebar');
  assert.equal(ipad.navRailWidth, 156 + 16);
  assert.equal(ipad.feedColumns, 2);
  assert.equal(ipad.activityColumns, 3);

  // 4. 手机横屏 short landscape (844x390)：宽度虽 >= 840，但高度 < 500 应回退窄轨 rail 省空间，且不判为大屏、不启用双栏详情
  const phoneLandscape = layout.buildLayoutSnapshot({
    windowWidth: 844, windowHeight: 390,
    statusBarHeight: 59,
    safeAreaInsets: { top: 0, right: 44, bottom: 21, left: 44 }
  }, { mpWeixin: false });
  assert.equal(phoneLandscape.isLargeScreenDevice, false);
  assert.equal(phoneLandscape.isShortLandscape, true);
  assert.equal(phoneLandscape.isSplitDetail, false);
  assert.equal(phoneLandscape.navMode, 'rail');
  assert.equal(phoneLandscape.navRailWidth, 80 + 44);
  assert.equal(phoneLandscape.safeAreaInsets.top, 0, '手机横屏隐藏状态栏时应保持 top 为 0');

  // 4b. Android/iOS 竖屏下 safeAreaInsets.top 为 0 或偏小时，不得丢弃 statusBarHeight
  const androidPortrait = layout.buildLayoutSnapshot({
    windowWidth: 393, windowHeight: 852,
    statusBarHeight: 36,
    safeAreaInsets: { top: 0, right: 0, bottom: 0, left: 0 }
  }, { mpWeixin: false });
  assert.equal(androidPortrait.safeAreaInsets.top, 36);

  const iosDynamicIsland = layout.buildLayoutSnapshot({
    windowWidth: 393, windowHeight: 852,
    statusBarHeight: 59,
    safeAreaInsets: { top: 24, right: 0, bottom: 34, left: 0 }
  }, { mpWeixin: false });
  assert.equal(iosDynamicIsland.safeAreaInsets.top, 59);

  // 5. 微信小程序宽屏保留底栏不启用左侧导航栏，仍启用多列与双栏详情
  const mpPad = layout.buildLayoutSnapshot({ windowWidth: 1024, windowHeight: 768 }, { mpWeixin: true });
  assert.equal(mpPad.navMode, 'bottom');
  assert.equal(mpPad.navRailWidth, 0);
  assert.equal(mpPad.isWide, true);
  assert.equal(mpPad.feedColumns, 2);

  // 6. rpxToPx 与 pages.json (500 / 400 / 750) 对齐
  assert.ok(Math.abs(layout.rpxToPx(100, 375) - 50) < 0.01);
  assert.ok(Math.abs(layout.rpxToPx(100, 768) - (100 / 750) * 400) < 0.01);
  assert.ok(Math.abs(layout.rpxToPx(100, 1194) - (100 / 750) * 400) < 0.01);
  assert.ok(Math.abs(layout.rpxToPx(750, 1194) - 1194) < 0.01);

  // 7. CSS 变量完整输出四向安全区与导航轨道宽度
  const vars = layout.getLayoutCssVars(ipad);
  assert.equal(vars['--app-safe-area-top'], '24px');
  assert.equal(vars['--app-safe-area-left'], '16px');
  assert.equal(vars['--app-nav-rail-width'], '172px');

  // 8. onWindowResize 触发全局 layout:changed 事件，且按大屏/直板手机自动锁定或解锁竖屏
  layout.installLayoutListener();
  assert.equal(typeof resizeCallback, 'function');
  assert.deepEqual(orientationCalls, ['lock:portrait-primary'], '直板手机启动应锁定 portrait-primary');
  emitted.length = 0;

  // 模拟折叠屏展开 / 平板大屏：自动解锁旋转
  currentWindow = { windowWidth: 1024, windowHeight: 768, screenWidth: 1024, screenHeight: 768, safeAreaInsets: { top: 20, right: 0, bottom: 0, left: 0 } };
  resizeCallback({ size: { windowWidth: 1024, windowHeight: 768 } });
  assert.equal(emitted.length, 1);
  assert.equal(emitted[0].event, layout.LAYOUT_CHANGED_EVENT);
  assert.equal(emitted[0].payload.sizeClass, 'expanded');
  assert.deepEqual(orientationCalls, ['lock:portrait-primary', 'unlock'], '大屏展开应自动解锁方向');

  // 重复大屏尺寸不重复调用 unlockOrientation
  resizeCallback({ size: { windowWidth: 1194, windowHeight: 834 } });
  assert.deepEqual(orientationCalls, ['lock:portrait-primary', 'unlock']);

  // 模拟折叠屏合上回到外屏（直板手机尺寸）：重新锁定竖屏
  currentWindow = { windowWidth: 390, windowHeight: 844, screenWidth: 390, screenHeight: 844, safeAreaInsets: { top: 44, right: 0, bottom: 34, left: 0 } };
  resizeCallback({ size: { windowWidth: 390, windowHeight: 844 } });
  assert.deepEqual(orientationCalls, ['lock:portrait-primary', 'unlock', 'lock:portrait-primary'], '合上回到小屏应重新锁定竖屏');
}

async function testPostGalleryRecalculatesOnResize() {
  const listeners = {};
  let boxWidth = 350;
  const uni = {
    $on: (ev, fn) => { listeners[ev] = fn; },
    $off: (ev) => { delete listeners[ev]; },
    createSelectorQuery: () => ({
      in() { return this; },
      select() { return this; },
      boundingClientRect(cb) { this._cb = cb; return this; },
      exec() { this._cb && this._cb({ width: boxWidth }); }
    })
  };

  const raw = fs.readFileSync(path.join(ROOT, 'mixins/postGallery.js'), 'utf8')
    .replace(/import\s+[^;]+;\s*/g, '')
    .replace(/export\s+default\s+postGalleryMixin;\s*/g, '')
    .replace(/export\s+\{[\s\S]*?\};\s*/g, '');
  const mod = { exports: {} };
  vm.runInNewContext(`${raw}\nmodule.exports = postGalleryMixin;`, {
    module: mod,
    exports: mod.exports,
    uni,
    LAYOUT_CHANGED_EVENT: 'layout:changed',
    getLayoutSnapshot: () => ({ windowWidth: 390 }),
    setTimeout,
    clearTimeout
  });
  const mixin = mod.exports;
  const instance = Object.assign(mixin.data(), mixin.methods, { swiperHeights: {}, imageClampHeights: {}, imageCache: {} });
  mixin.created.call(instance);

  instance.onImageLoad({
    detail: { width: 1000, height: 1000 },
    currentTarget: { dataset: { postindex: 0, imgindex: 0, type: 'multi' } }
  });
  assert.equal(instance.swiperHeights[0], 350);

  // 模拟旋转/展开后卡片宽度变为 520px
  boxWidth = 520;
  listeners['layout:changed']({ windowWidth: 1194 });
  await new Promise((resolve) => setTimeout(resolve, 160));
  assert.equal(instance.swiperHeights[0], 520, '窗口宽度变化后 swiperHeights 须自动重算');
  mixin.beforeUnmount.call(instance);
}

function testMultiImageSwiperGestureIsolation() {
  const postItemSrc = fs.readFileSync(path.join(ROOT, 'components/PostItem.vue'), 'utf8');
  const feedListSrc = fs.readFileSync(path.join(ROOT, 'components/FeedList.vue'), 'utf8');
  const indexSrc = fs.readFileSync(path.join(ROOT, 'pages/index/index.vue'), 'utf8');

  assert.ok(postItemSrc.includes('@touchstart.stop="onMultiSwiperTouchStart"'), 'PostItem 多图 swiper 须阻止 touchstart 冒泡到外层页面 swiper');
  assert.ok(postItemSrc.includes('@touchend.stop="onMultiSwiperTouchEnd"'), 'PostItem 多图 swiper 须阻止 touchend 冒泡到外层页面 swiper');
  assert.ok(postItemSrc.includes('shouldSuppressMultiTap'), 'PostItem 多图点击预览须拦截滑动后的误触 tap');
  assert.ok(feedListSrc.includes('@inner-swiper-touch-change='), 'FeedList 须透传内层多图 swiper 触摸状态');
  assert.ok(indexSrc.includes(':disable-touch="isInnerSwiperTouching"'), '首页外层 page-swiper 在操作多图轮播时须临时禁用滑动');
  assert.ok(indexSrc.includes('onInnerSwiperTouchChange'), '首页须响应 inner-swiper-touch-change');
}

function testScrollViewFlexPagesHaveDefiniteHeight() {
  const flexScrollPages = [
    {
      file: 'pages-content/portfolio/portfolio.vue',
      rootClass: '.portfolio-page',
      scrollClass: '.portfolio-list'
    },
    {
      file: 'pages-content/favorite-folders/favorite-folders.vue',
      rootClass: '.favorite-folders-page',
      scrollClass: '.folders-list'
    },
    {
      file: 'pages-content/portfolio-detail/portfolio-detail.vue',
      rootClass: '.portfolio-detail-page',
      scrollClass: '.content-scroll'
    },
    {
      file: 'pages-content/other-portfolio/other-portfolio.vue',
      rootClass: '.other-portfolio-page',
      scrollClass: '.content-scroll'
    }
  ];

  for (const { file, rootClass, scrollClass } of flexScrollPages) {
    const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const escapedRoot = rootClass.replace('.', '\\.');
    const rootRuleMatch = src.match(new RegExp(`${escapedRoot}\\s*\\{([\\s\\S]*?)\\}`));
    assert.ok(rootRuleMatch, `${file} 须定义 ${rootClass} 容器样式`);
    assert.match(
      rootRuleMatch[1],
      /(?:^|[\s;])height:\s*100vh\s*;/,
      `${file} 的 ${rootClass} 须声明确定的 height: 100vh，避免 iOS WebKit 下内部 scroll-view (height: 100% + height: 0) 塌缩为 0px 白屏`
    );
    const escapedScroll = scrollClass.replace('.', '\\.');
    const scrollRuleMatch = src.match(new RegExp(`${escapedScroll}\\s*\\{([\\s\\S]*?)\\}`));
    assert.ok(scrollRuleMatch, `${file} 须定义 ${scrollClass} 滚动区样式`);
    assert.match(scrollRuleMatch[1], /flex:\s*1\s*;/);
  }
}

function testCollectionAndSecondaryPagesWideAdaptation() {
  for (const rel of [
    'pages-content/portfolio/portfolio.vue',
    'pages-content/favorite-folders/favorite-folders.vue'
  ]) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    assert.ok(src.includes('folder-grid--two-max'), `${rel} 须支持 <=2 文件夹双列上限与多文件夹三列响应式切换`);
    assert.match(src, /@media\s+screen\s+and\s+\(min-width:\s*600px\)[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/, `${rel} 宽屏须切换双列卡片网格`);
    assert.match(src, /@media\s+screen\s+and\s+\(min-width:\s*1024px\)[\s\S]*?grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/, `${rel} 大屏须支持三列卡片网格`);
  }

  for (const rel of [
    'pages-content/portfolio-detail/portfolio-detail.vue',
    'pages-content/other-portfolio/other-portfolio.vue'
  ]) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    assert.ok(src.includes('useTwoColumnPoems'), `${rel} 须在宽屏多首作品时启用双列瀑布流`);
    assert.ok(src.includes('app-masonry-columns portfolio-poem-masonry'), `${rel} 须复用 app-masonry-columns 双列瀑布流结构`);
    assert.ok(src.includes('post-list-container--single-wide'), `${rel} 单首作品在宽屏下须居中收敛`);
    assert.ok(src.includes('checkViewportFill('), `${rel} 须在宽屏双列不满屏时自动补载下一页`);
    assert.equal(/width:\s*100vw/.test(src), false, `${rel} 不得使用 100vw 导致桌面端横向滚动条溢出`);
  }

  const portfolioDetailSrc = fs.readFileSync(path.join(ROOT, 'pages-content/portfolio-detail/portfolio-detail.vue'), 'utf8');
  assert.ok(portfolioDetailSrc.includes('posts-list-simple--grid'), 'portfolio-detail 批量添加弹窗须在宽屏支持双列网格');

  for (const [rel, masonryHook] of [
    ['pages-content/favorite-content/favorite-content.vue', 'useTwoColumnFavorites'],
    ['pages-user/my-likes/my-likes.vue', 'useTwoColumnLikes']
  ]) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    assert.ok(src.includes(masonryHook), `${rel} 须在宽屏启用双列帖子瀑布流`);
    assert.ok(src.includes('app-masonry-columns'), `${rel} 须使用 app-masonry-columns 容器`);
    assert.ok(src.includes('checkViewportFill('), `${rel} 须在宽屏不满屏时自动补载下一页`);
  }

  const rootClassPairs = [
    ['pages-content/favorite-content/favorite-content.vue', 'favorite-content-page'],
    ['pages-content/draft-box/draft-box.vue', 'draft-box-page'],
    ['pages-user/my-likes/my-likes.vue', 'my-likes-page'],
    ['pages-user/following/following.vue', 'following-page'],
    ['pages-user/fans/fans.vue', 'fans-page'],
    ['pages-user/blocked-users/blocked-users.vue', 'blocked-users-page']
  ];
  const responsiveCss = fs.readFileSync(path.join(ROOT, 'styles/responsive-layout.css'), 'utf8');
  for (const [rel, cls] of rootClassPairs) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    assert.ok(src.includes(cls), `${rel} 须挂载 ${cls} 根类名以接入全站安全区收敛规则`);
    assert.ok(responsiveCss.includes(`.${cls}`), `responsive-layout.css 须包含 .${cls}`);
  }
}

async function main() {
  testConfigIntegrity();
  testNoSafeAreaTimesTwoInCorePages();
  testAspectRatioWrapperSwiperFillsContainer();
  testMultiImageSwiperGestureIsolation();
  testScrollViewFlexPagesHaveDefiniteHeight();
  testCollectionAndSecondaryPagesWideAdaptation();
  testLayoutBreakpointsAndRpx();
  await testPostGalleryRecalculatesOnResize();
  console.log('[test-layout-responsive] PASS: config, breakpoints, rpxToPx, safe-area vars, resize broadcast, collection/secondary wide layouts & gallery recalc');
}

main().catch((error) => {
  console.error('[test-layout-responsive] FAIL:', error);
  process.exitCode = 1;
});
