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
  assert.ok(harmonyModule.includes('"auto_rotation_restricted"'), '鸿蒙 EntryAbility 须配置自动旋转');
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
}

function testLayoutBreakpointsAndRpx() {
  const emitted = [];
  let resizeCallback = null;
  let currentWindow = { windowWidth: 390, windowHeight: 844, statusBarHeight: 44, safeAreaInsets: { top: 44, right: 0, bottom: 34, left: 0 } };
  const uni = {
    $emit: (event, payload) => emitted.push({ event, payload }),
    onWindowResize: (cb) => { resizeCallback = cb; }
  };

  const layout = loadEsModule('utils/layout.js', {
    uni,
    getWindowInfoCompat: () => currentWindow,
    getStatusBarHeightCompat: () => currentWindow.statusBarHeight || 0
  });

  // 1. 手机竖屏 compact
  const phone = layout.buildLayoutSnapshot(currentWindow, { mpWeixin: false });
  assert.equal(phone.sizeClass, 'compact');
  assert.equal(phone.isWide, false);
  assert.equal(phone.isSplitDetail, false);
  assert.equal(phone.navMode, 'bottom');
  assert.equal(phone.navRailWidth, 0);
  assert.equal(phone.feedColumns, 1);
  assert.equal(phone.activityColumns, 1);

  // 2. 折叠屏 / iPhone Duo 展开 medium (720x840)
  const duo = layout.buildLayoutSnapshot({
    windowWidth: 720, windowHeight: 840,
    safeAreaInsets: { top: 24, right: 0, bottom: 20, left: 0 }
  }, { mpWeixin: false });
  assert.equal(duo.sizeClass, 'medium');
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
  assert.equal(ipad.isLandscape, true);
  assert.equal(ipad.isShortLandscape, false);
  assert.equal(ipad.navMode, 'sidebar');
  assert.equal(ipad.navRailWidth, 156 + 16);
  assert.equal(ipad.feedColumns, 2);
  assert.equal(ipad.activityColumns, 3);

  // 4. 手机横屏 short landscape (844x390)：宽度虽 >= 840，但高度 < 500 应回退窄轨 rail 省空间
  const phoneLandscape = layout.buildLayoutSnapshot({
    windowWidth: 844, windowHeight: 390,
    statusBarHeight: 59,
    safeAreaInsets: { top: 0, right: 44, bottom: 21, left: 44 }
  }, { mpWeixin: false });
  assert.equal(phoneLandscape.isShortLandscape, true);
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

  // 8. onWindowResize 触发全局 layout:changed 事件
  layout.installLayoutListener();
  assert.equal(typeof resizeCallback, 'function');
  emitted.length = 0;
  currentWindow = { windowWidth: 1024, windowHeight: 768, safeAreaInsets: { top: 20, right: 0, bottom: 0, left: 0 } };
  resizeCallback({ size: { windowWidth: 1024, windowHeight: 768 } });
  assert.equal(emitted.length, 1);
  assert.equal(emitted[0].event, layout.LAYOUT_CHANGED_EVENT);
  assert.equal(emitted[0].payload.sizeClass, 'expanded');
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

async function main() {
  testConfigIntegrity();
  testNoSafeAreaTimesTwoInCorePages();
  testLayoutBreakpointsAndRpx();
  await testPostGalleryRecalculatesOnResize();
  console.log('[test-layout-responsive] PASS: config, breakpoints, rpxToPx, safe-area vars, resize broadcast & gallery recalc');
}

main().catch((error) => {
  console.error('[test-layout-responsive] FAIL:', error);
  process.exitCode = 1;
});
