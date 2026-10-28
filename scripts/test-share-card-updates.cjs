const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parse } = require('@babel/parser');

function loadModule(file, globals = {}) {
  let source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  if (file.endsWith('.vue')) source = source.match(/<script>([\s\S]*?)<\/script>/)[1];
  const bindings = {};
  for (const node of parse(source, { sourceType: 'module' }).program.body.slice().reverse()) {
    if (node.type === 'ImportDeclaration') {
      for (const specifier of node.specifiers) bindings[specifier.local.name] = () => {};
      source = source.slice(0, node.start) + source.slice(node.end);
    } else if (node.type === 'ExportNamedDeclaration') {
      source = source.slice(0, node.start) + source.slice(node.declaration ? node.declaration.start : node.end);
    } else if (node.type === 'ExportDefaultDeclaration') {
      source = source.slice(0, node.start) + 'module.exports = ' + source.slice(node.declaration.start);
    }
  }
  const sandbox = {
    ...bindings, module: { exports: {} }, getApp: () => ({}),
    console: { log() {}, warn() {}, error() {} }, ...globals
  };
  vm.runInNewContext(source, sandbox, { filename: file });
  return sandbox.module.exports;
}

function fakeClock() {
  const timers = new Map();
  let now = 0;
  let id = 0;
  const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
  return {
    setTimeout(callback, delay = 0) {
      timers.set(++id, { callback, at: now + delay });
      return id;
    },
    clearTimeout(timerId) { timers.delete(timerId); },
    async advance(ms) {
      const target = now + ms;
      await flush();
      for (;;) {
        const due = [...timers].filter(([, timer]) => timer.at <= target)
          .sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
        if (!due) break;
        const [timerId, timer] = due;
        timers.delete(timerId);
        now = timer.at;
        timer.callback();
        await flush();
      }
      now = target;
      await flush();
    },
    flush
  };
}

const original = Object.freeze({ backgroundColor: '#ACCAB2', textColor: '#D44720' });
const navy = Object.freeze({ backgroundColor: '#28374D', textColor: '#DDE6ED' });
const warm = Object.freeze({ backgroundColor: '#E9A752', textColor: '#78614D' });
const plain = value => JSON.parse(JSON.stringify(value));

function deferred() {
  let resolve;
  const promise = new Promise(accept => { resolve = accept; });
  return { promise, resolve };
}

function createPage(globals = {}) {
  const clock = fakeClock();
  const pageOptions = loadModule('pages/post-detail/post-detail.vue', {
    setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout,
    getCurrentPlatform: () => 'app', uni: { hideLoading() {}, showToast() {} }, ...globals
  });
  const generated = [];
  const page = {
    showShareModal: true, shareRenderToken: 0, regenerateTimeout: null,
    shareImageUrl: 'old-preview.jpg', shareImageFilePath: 'old-preview.jpg',
    shareConfig: { fontFamily: 'system', fontSize: 38, titleFontSize: 46, fontScale: 1, ...original },
    post: Object.freeze({ _id: 'poem', title: '标题', content: '正文', authorName: '作者', ...original }),
    $nextTick(callback) { Promise.resolve().then(callback); },
    setData(data) { Object.assign(this, data); }
  };
  for (const [name, method] of Object.entries(pageOptions.methods)) page[name] = method.bind(page);
  page.generateShareImage = () => generated.push(plain(page.shareConfig));
  return { page, pageOptions, clock, generated };
}

async function main() {
  await checkPendingFontPreview();
  await checkLatestRequestAndClose();
  await checkSingleColorEvent();
  await checkLateCanvasAndExport();
  await checkPaintedColors();
  console.log('[test-share-card-updates] PASS: font/color updates, latest requests, close cancellation, late draws/exports and painted colors');
}

async function checkPendingFontPreview() {
  const { page, clock, generated } = createPage();
  page.onFontSizePreview(44);
  page.onColorChange(navy);
  await clock.advance(400);
  assert.equal(page.shareConfig.backgroundColor, navy.backgroundColor,
    'A pending font preview must not restore the old background after selecting a color');
  assert.equal(page.shareConfig.textColor, navy.textColor,
    'A pending font preview must not restore the old text color');
  assert.equal(page.shareConfig.fontSize, 44, 'The latest font preview remains selected');
  assert.equal(generated.length, 1, 'Selecting a color supersedes the pending font preview render');
  assert.deepEqual(plain(page.post), {
    _id: 'poem', title: '标题', content: '正文', authorName: '作者', ...original
  });
}

async function checkLatestRequestAndClose() {
  const latest = createPage();
  latest.page.onColorChange(navy);
  latest.page.onColorChange(warm);
  await latest.clock.advance(400);
  assert.equal(latest.generated.length, 1, 'Rapid color selections generate only the latest card');
  assert.equal(latest.generated[0].backgroundColor, warm.backgroundColor);
  assert.equal(latest.generated[0].textColor, warm.textColor);

  const forced = createPage();
  forced.page.onColorChange(navy);
  forced.page.forceRegenerateCanvas();
  await forced.clock.advance(400);
  assert.equal(forced.generated.length, 1, 'A force request supersedes the scheduled regeneration');
  assert.equal(forced.generated[0].backgroundColor, navy.backgroundColor);

  for (const close of ['hide', 'unload']) {
    const state = createPage();
    const oldToken = state.page.shareRenderToken;
    state.page.onFontFamilyPreview('文楷');
    state.page.forceRegenerateCanvas();
    if (close === 'hide') state.page.hideShareModal();
    else state.pageOptions.onUnload.call(state.page);
    await state.clock.advance(1000);
    assert.equal(state.generated.length, 0, `${close} cancels delayed regeneration and font preview`);
    assert.equal(state.page.regenerateTimeout, null);
    assert.ok(state.page.shareRenderToken > oldToken, `${close} invalidates unfinished renders`);
  }
}

async function checkSingleColorEvent() {
  const { page, clock, generated } = createPage();
  const modal = loadModule('components/ShareModal.vue', {
    setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout
  });
  const events = [];
  const state = {
    showColorPicker: true,
    $nextTick: page.$nextTick,
    $emit(name, value) {
      events.push(name);
      if (name === 'color-change') page.onColorChange(value);
      if (name === 'force-regenerate') page.forceRegenerateCanvas();
    }
  };
  modal.methods.onColorSelect.call(state, navy);
  await clock.advance(500);
  assert.equal(state.showColorPicker, false);
  assert.deepEqual(events, ['color-change'], 'Selecting a color must not issue a second force request');
  assert.equal(generated.length, 1);
  assert.equal(generated[0].backgroundColor, navy.backgroundColor);
}

async function checkLateCanvasAndExport() {
  const pendingDraw = deferred();
  let draws = 0;
  let drawingStarted = false;
  const state = createPage({
    uni: {
      createCanvasContext: () => ({ clearRect() {}, draw() { draws++; } }),
      hideLoading() {}, showToast() {}
    },
    calculateShareCardHeight: async () => ({ canvasHeight: 1000 }),
    drawShareCardContent: () => { drawingStarted = true; return pendingDraw.promise; }
  });
  state.page.shareRenderToken = 1;
  const task = state.page.drawCanvas(1);
  await state.clock.advance(100);
  assert.equal(drawingStarted, true, 'The old render must be awaiting its signature/content drawing');
  state.page.onColorChange(navy);
  pendingDraw.resolve();
  await state.clock.flush();
  await task;
  assert.equal(draws, 0, 'A render superseded during async drawing cannot submit its old canvas');

  const first = deferred();
  const second = deferred();
  const responses = [first, second];
  const exported = createPage({ exportShareCanvas: () => responses.shift().promise });
  exported.page.shareRenderToken = 1;
  const oldExport = exported.page.exportCanvas(750, 1000, 1);
  exported.page.onColorChange(navy);
  const newExport = exported.page.exportCanvas(750, 1000, exported.page.shareRenderToken);
  second.resolve({ tempFilePath: 'file:///latest.jpg', scale: 1 });
  await newExport;
  assert.equal(exported.page.shareImageFilePath, 'file:///latest.jpg');
  const latestPreview = exported.page.shareImageUrl;
  first.resolve({ tempFilePath: 'file:///stale.jpg', scale: 1 });
  await oldExport;
  assert.equal(exported.page.shareImageFilePath, 'file:///latest.jpg',
    'A late export cannot replace the file used for saving');
  assert.equal(exported.page.shareImageUrl, latestPreview,
    'The preview and save path must retain the latest selected-color export');
}

async function checkPaintedColors() {
  const painted = [];
  let fillColor;
  const ctx = {
    clearRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, arcTo() {},
    quadraticCurveTo() {}, closePath() {}, save() {}, restore() {}, stroke() {},
    setLineWidth() {}, setStrokeStyle() {}, setTextAlign() {}, setFontSize() {},
    setFillStyle(color) { fillColor = color; },
    fill() { painted.push({ kind: 'background', color: fillColor }); },
    fillText(text) { painted.push({ kind: 'text', text, color: fillColor }); },
    measureText(text) { return { width: text.length * 20 }; },
    draw(reserve, callback) { callback(); }
  };
  const canvas = loadModule('utils/shareCanvas.js');
  const state = createPage({
    ...canvas,
    uni: { createCanvasContext: () => ctx, hideLoading() {}, showToast() {} }
  });
  const before = plain(state.page.post);
  let drawing;
  state.page.generateShareImage = state.pageOptions.methods.generateShareImage.bind(state.page);
  state.page.loadFontAndDraw = token => { drawing = state.page.drawCanvas(token); };
  state.page.exportCanvas = () => {};
  for (const colors of [navy, warm]) {
    painted.length = 0;
    state.page.onColorChange(colors);
    await state.clock.advance(500);
    await drawing;
    assert.equal(painted.find(item => item.kind === 'background').color, colors.backgroundColor);
    for (const text of [state.page.post.title, state.page.post.content, state.page.post.authorName]) {
      assert.equal(painted.find(item => item.text === text).color, colors.textColor,
        `${text} must use the latest selected text color`);
    }
  }
  assert.deepEqual(plain(state.page.post), before, 'Card customization must not change original post colors');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
