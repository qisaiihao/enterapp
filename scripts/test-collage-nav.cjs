const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parse } = require('@babel/parser');
const { preprocess } = require('@dcloudio/uni-cli-shared/lib/preprocess');

function runtime(platform, windowInfo, menuRect = {}) {
  const filename = path.join(__dirname, '../utils/collage/nav.js');
  // Use the build's preprocessor so platform branches are tested independently.
  const context = { [platform.replace(/-/g, '_')]: true };
  let source = preprocess(fs.readFileSync(filename, 'utf8'), context, { type: 'js' });
  for (const node of parse(source, { sourceType: 'module' }).program.body.reverse()) {
    if (node.type === 'ImportDeclaration' || node.type === 'ExportDefaultDeclaration') {
      source = source.slice(0, node.start) + source.slice(node.end);
    } else if (node.type === 'ExportNamedDeclaration') {
      source = source.slice(0, node.start) + source.slice(node.declaration.start);
    }
  }
  source += '\nmodule.exports = { getCollageNavStyle };';
  const calls = { window: 0, menu: 0 };
  const sandbox = {
    module: { exports: {} },
    getWindowInfoCompat() { calls.window++; return windowInfo; },
    getMenuButtonBoundingClientRectCompat() { calls.menu++; return menuRect; }
  };
  vm.runInNewContext(source, sandbox, { filename });
  return {
    calls,
    style() {
      // Normalize the VM realm without changing the module's returned values.
      return JSON.parse(JSON.stringify(sandbox.module.exports.getCollageNavStyle()));
    },
    setWindowInfo(value) { windowInfo = value; }
  };
}

function testAppSafeArea() {
  for (const top of [0, 24, 44, 54, 59]) {
    const app = runtime('APP-PLUS', { safeAreaInsets: { top }, statusBarHeight: top });
    assert.deepEqual(app.style(), { '--collage-safe-top': `${top}px` },
      `App exposes the ${top}px native safe area without adding a second CSS inset`);
    assert.equal(app.calls.menu, 0, 'App does not reserve space for a WeChat capsule');
  }
  const app = runtime('APP-PLUS', { safeAreaInsets: { top: 44 }, statusBarHeight: 24 });
  assert.equal(app.style()['--collage-safe-top'], '44px', 'safe-area inset protects a taller cutout');
  app.setWindowInfo({ safeAreaInsets: { top: 24 }, statusBarHeight: 59 });
  assert.equal(app.style()['--collage-safe-top'], '59px', 'a stale smaller inset cannot hide the status bar');
  app.setWindowInfo({ safeAreaInsets: { top: 0 }, statusBarHeight: 54 });
  assert.equal(app.style()['--collage-safe-top'], '54px', 'a zero inset does not discard a valid status-bar height');
  app.setWindowInfo({ statusBarHeight: '44' });
  assert.equal(app.style()['--collage-safe-top'], '44px', 'numeric API values remain usable');
  app.setWindowInfo({ safeAreaInsets: { top: '0' } });
  assert.equal(app.style()['--collage-safe-top'], '0px', 'an explicit zero must not become a guessed status bar');
}

function testAppFallbacks() {
  for (const info of [undefined, null, {}, { safeAreaInsets: {} },
    { safeAreaInsets: { top: null }, statusBarHeight: '' },
    { safeAreaInsets: { top: -1 }, statusBarHeight: Infinity },
    { safeAreaInsets: { top: 'unknown' }, statusBarHeight: NaN }]) {
    assert.deepEqual(runtime('APP-PLUS', info).style(), { '--collage-safe-top': '24px' },
      'missing or invalid native dimensions use the bounded 24px fallback');
  }
  for (const info of [
    { safeAreaInsets: { top: -1 }, statusBarHeight: 0 },
    { safeAreaInsets: { top: 0 }, statusBarHeight: 'unknown' },
    { safeAreaInsets: { top: Infinity }, statusBarHeight: 59 }
  ]) {
    const expected = info.statusBarHeight === 59 ? '59px' : '0px';
    assert.equal(runtime('APP-PLUS', info).style()['--collage-safe-top'], expected,
      'one valid API dimension is enough; invalid companion data must not replace it');
  }
}

function testWeChatCapsule() {
  const mp = runtime('MP-WEIXIN', {
    windowWidth: 390, safeAreaInsets: { top: 44 }, statusBarHeight: 24
  }, { left: 260 });
  assert.deepEqual(mp.style(), { '--collage-nav-top': '48px', '--collage-capsule-right': '138px' },
    'WeChat keeps its current top gap and right-hand capsule clearance');
  assert.equal(mp.calls.menu, 1);
  assert.deepEqual(runtime('MP-WEIXIN', {
    screenWidth: 390, statusBarHeight: 24
  }, { left: 340 }).style(), { '--collage-nav-top': '28px', '--collage-capsule-right': '100px' },
  'small capsule clearance still keeps the existing minimum');
  assert.deepEqual(runtime('MP-WEIXIN', undefined, undefined).style(), {
    '--collage-nav-top': '28px', '--collage-capsule-right': '100px'
  }, 'missing WeChat metrics retain the existing fallback');
}

function testH5Unchanged() {
  const h5 = runtime('H5', { safeAreaInsets: { top: 59 }, statusBarHeight: 59 }, { left: 200 });
  assert.equal(h5.style(), null, 'H5 keeps its CSS environment insets rather than adding App offsets');
  assert.deepEqual(h5.calls, { window: 0, menu: 0 }, 'H5 does not read native navigation metrics');
}

function main() {
  for (const test of [testAppSafeArea, testAppFallbacks, testWeChatCapsule, testH5Unchanged]) {
    test();
    console.log(`PASS ${test.name}`);
  }
}

if (require.main === module) main();
module.exports = { main };
