const assert = require('node:assert/strict');
const { load } = require('./test-splash-startup.cjs');

function runtime() {
  const storage = new Map([['poementerThemeMode', 'light'], ['poementerReadFontSize', 'standard']]);
  const listeners = new Map(), reads = new Map(), nativeCalls = [];
  let cssWrites = 0;
  const element = () => ({
    setAttribute() {},
    style: { setProperty() { cssWrites++; }, removeProperty() { cssWrites++; } }
  });
  const document = { documentElement: element(), body: element(), getElementById: () => null };
  const uni = {
    getStorageSync(key) { reads.set(key, (reads.get(key) || 0) + 1); return storage.get(key); },
    setStorageSync(key, value) { storage.set(key, value); },
    $on(event, handler) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(handler);
    },
    $off(event, handler) { listeners.get(event)?.delete(handler); },
    $emit(event, payload) { for (const handler of listeners.get(event) || []) handler(payload); },
    setNavigationBarColor(options) { nativeCalls.push(['navigation', options]); },
    setBackgroundColor(options) { nativeCalls.push(['background', options]); },
    setTabBarStyle(options) { nativeCalls.push(['tab', options]); }
  };
  const theme = load('utils/theme.js', { uni, document }, [
    'getThemeMode', 'getThemeVars', 'applyThemeMode', 'applyNativeThemeChrome', 'setThemeMode', 'THEME_CHANGED_EVENT'
  ]);
  const font = load('utils/fontSize.js', { uni, document });
  return { uni, storage, listeners, reads, document, element, theme, font, nativeCalls, cssWrites: () => cssWrites };
}

function testCachedReadsAndExternalEvents() {
  const app = runtime();
  for (let index = 0; index < 300; index++) {
    assert.equal(app.theme.getThemeMode(), 'light');
    assert.equal(app.font.getReadFontSizeLevel(), 'standard');
  }
  assert.equal(app.reads.get('poementerThemeMode'), 1, '组件复用内存主题，不反复同步读取存储');
  assert.equal(app.reads.get('poementerReadFontSize'), 1, '组件复用内存字号');
  assert.equal(app.listeners.get('theme:changed').size, 1, '整个运行时仅注册一个主题桥接');
  assert.equal(app.listeners.get('read-font-size:changed').size, 1);

  app.storage.set('poementerThemeMode', 'dark');
  app.uni.$emit('theme:changed', { mode: 'dark' });
  assert.equal(app.theme.getThemeMode(), 'dark', '保留直接写存储后发送事件的兼容路径');
  assert.equal(app.nativeCalls.length, 3, '一个主题事件只执行一组原生栏调用');
  assert.equal(app.document.documentElement.style.colorScheme, 'dark');

  app.storage.set('poementerThemeMode', 'light');
  app.uni.$emit('theme:changed');
  assert.equal(app.theme.getThemeMode(), 'light', '无事件载荷时重新读取持久设置');
  app.storage.set('poementerReadFontSize', 'large');
  app.uni.$emit('read-font-size:changed', { level: 'large' });
  assert.equal(app.font.getReadFontSizeLevel(), 'large');
  app.font.setReadFontSize('xlarge');
  assert.equal(app.font.getReadFontSizeLevel(), 'xlarge');
  assert.equal(app.storage.get('poementerReadFontSize'), 'xlarge');
  const before = app.nativeCalls.length;
  app.theme.setThemeMode('dark');
  assert.equal(app.nativeCalls.length - before, 3, 'setter 发出的兼容事件不会再次应用主题');
  assert.equal(app.storage.get('poementerThemeMode'), 'dark');
}

function testDocumentTargets() {
  const app = runtime();
  app.theme.applyThemeMode('dark');
  const initialWrites = app.cssWrites();
  app.theme.applyThemeMode('dark');
  assert.equal(app.cssWrites(), initialWrites, '同一文档相同主题不重写数百个 CSS 变量');
  app.document.documentElement = app.element();
  app.theme.applyThemeMode('dark');
  assert.ok(app.cssWrites() > initialWrites, '独立文档或新根元素仍应用当前主题');
  const darkWrites = app.cssWrites();
  app.theme.applyThemeMode('light');
  assert.ok(app.cssWrites() > darkWrites, '切回浅色仍清除深色专有变量');
}

function testGlobalMixinFanout() {
  const app = runtime(), mixins = [];
  const vueApp = { component() {}, use() {}, mixin(value) { mixins.push(value); } };
  const { createApp } = load('main.js', {
    uni: app.uni, ...app.theme, ...app.font,
    createCollageLogger: () => ({ info() {} }), silenceConsoleInProduction() {},
    markBuiltinHuiwenFontPending() {}, markBuiltinHuiwenFontReady() {},
    appFontManager: { ensureFontAvailable: () => Promise.resolve() },
    ensureTcbReady: () => null, setupRuntimeSideEffects() {},
    cacheManager: { setDebug() {} }, createSSRApp: () => vueApp,
    installRuntimeBindings() {}, installAppOverlays() {}
  }, ['createApp']);
  createApp();
  const mixin = mixins.find(item => item.data && item.methods?.cancelActionStyle);
  const components = Array.from({ length: 300 }, () => {
    const component = mixin.data();
    mixin.created.call(component);
    return component;
  });
  const beforeNative = app.nativeCalls.length, beforeCss = app.cssWrites();
  app.theme.setThemeMode('dark');
  assert.ok(components.every(component => component.appThemeMode === 'dark'));
  assert.equal(app.nativeCalls.length - beforeNative, 3, '300 个组件订阅仅更新状态，不重复调用原生 API');
  assert.ok(app.cssWrites() > beforeCss);
  const afterThemeCss = app.cssWrites();
  for (const component of components) mixin.beforeUnmount.call(component);
  assert.equal(app.listeners.get('theme:changed').size, 1, '组件卸载后只保留运行时主题桥接');
  assert.equal(app.listeners.get('read-font-size:changed').size, 1);
  for (let index = 0; index < 2; index++) mixin.onShow.call({ appThemeMode: 'dark' });
  assert.equal(app.nativeCalls.length - beforeNative, 9, '每个页面显示时仍同步独立 WebView 的原生栏');
  assert.equal(app.cssWrites(), afterThemeCss);
}

for (const test of [testCachedReadsAndExternalEvents, testDocumentTargets, testGlobalMixinFanout]) {
  test();
  console.log('PASS ' + test.name);
}
