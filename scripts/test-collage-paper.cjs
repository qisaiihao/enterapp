const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = name => fs.readFileSync(path.join(__dirname, '../utils/collage', name), 'utf8');
const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;

module.exports = async function testCollagePaper() {
  const paperUrl = moduleUrl(read('tornPaper.js'));
  const { createTornPaper } = await import(paperUrl);
  const flat = (w, h) => Uint8ClampedArray.from({ length: w * h * 4 }, (_, i) => [190, 165, 120, 255][i % 4]);
  const extract = (pixels, width, r) => {
    const data = new Uint8ClampedArray(r.width * r.height * 4);
    for (let y = 0; y < r.height; y++) data.set(pixels.subarray(((r.y + y) * width + r.x) * 4, ((r.y + y) * width + r.x + r.width) * 4), y * r.width * 4);
    return data;
  };
  const put = (pixels, width, r, data) => {
    for (let y = 0; y < r.height; y++) pixels.set(data.subarray(y * r.width * 4, (y + 1) * r.width * 4), ((r.y + y) * width + r.x) * 4);
  };
  const render = (w, h, seed) => {
    const pixels = flat(w, h), paper = createTornPaper(w, h, seed);
    for (const region of paper.regions) {
      const data = extract(pixels, w, region); paper.apply(data, region); put(pixels, w, region, data);
    }
    return pixels;
  };
  const first = render(480, 90, 123);
  assert.deepEqual(first, render(480, 90, 123), 'fixed seed produces identical pixels');
  assert.notDeepEqual(first, render(480, 90, 124), 'different seeds produce different pixels');
  let partial = 0;
  for (let i = 3; i < first.length; i += 4) if (first[i] > 0 && first[i] < 255) partial++;
  assert.ok(partial > 480, 'fiber fringe contains translucent pixels, not just hard polygon clipping');
  for (let y = 18; y < 72; y++) {
    for (let x = 18; x < 462; x++) assert.deepEqual(Array.from(first.subarray((y * 480 + x) * 4, (y * 480 + x) * 4 + 4)), [190, 165, 120, 255], 'central color and opacity remain exact');
  }
  for (const [w, h] of [[1, 1], [3, 8], [80, 24], [1600, 1600]]) {
    const visited = new Uint8Array(w * h);
    for (const r of createTornPaper(w, h, 111).regions) {
      assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.width <= w && r.y + r.height <= h);
      assert.ok(r.width * r.height * 4 <= 160000, 'native transfer bounded to a narrow edge strip');
      for (let y = r.y; y < r.y + r.height; y++) for (let x = r.x; x < r.x + r.width; x++) assert.equal(visited[y * w + x]++, 0, 'regions never overlap and soften pixels twice');
    }
    const pixels = render(w, h, 111);
    assert.equal(pixels.length, w * h * 4);
    if (w > 10 && h > 10) { assert.equal(pixels[3], 0); assert.equal(pixels[(Math.floor(h / 2) * w + Math.floor(w / 2)) * 4 + 3], 255); }
  }

  // Exercise the actual non-H5 renderer with callback-style uni Canvas APIs.
  const nativeCode = read('renderer.js').replace(/\/\/ #ifdef H5[\s\S]*?\/\/ #endif/g, '')
    .replace("'./geometry.js'", JSON.stringify(moduleUrl(read('geometry.js'))))
    .replace("'./tornPaper.js'", JSON.stringify(paperUrl))
    .replace("'./debug.js'", JSON.stringify(moduleUrl(read('debug.js'))));
  const { renderCut } = await import(moduleUrl(nativeCode));
  const { setCollageDebugLevel } = await import(moduleUrl(read('debug.js')));
  setCollageDebugLevel('warn');
  const previousUni = global.uni, calls = [];
  const page = { $nextTick: async () => {} };
  let pixels, failRead = false;
  global.uni = {
    getImageInfo: options => options.success({ path: 'source.jpg' }),
    createCanvasContext: () => new Proxy({}, { get: (_, key) => key === 'draw' ? (_reserve, done) => { calls.push('draw'); pixels = flat(page.renderWidth, page.renderHeight); done(); } : () => {} }),
    canvasGetImageData: (options, owner) => {
      assert.equal(owner, page); assert.equal(options.canvasId, 'collage-render'); calls.push('get');
      if (failRead) options.fail(); else options.success({ data: extract(pixels, page.renderWidth, options) });
    },
    canvasPutImageData: (options, owner) => { assert.equal(owner, page); calls.push('put'); put(pixels, page.renderWidth, options, options.data); options.success({}); },
    canvasToTempFilePath: options => { calls.push('export'); options.success({ tempFilePath: 'cut.png' }); }
  };
  try {
    const rect = { x: 0, y: 0, width: 480, height: 90 };
    await renderCut(page, 'source.jpg', rect, 'torn', 123, 2);
    assert.deepEqual(pixels, first, 'native and browser masks share identical pixel processing');
    assert.deepEqual(calls, ['draw', 'get', 'put', 'get', 'put', 'get', 'put', 'get', 'put', 'export']);
    for (const [style, version] of [['straight', 2], ['scissors', 2], ['torn', 1]]) {
      calls.length = 0; await renderCut(page, 'source.jpg', rect, style, 123, version);
      assert.deepEqual(calls, ['draw', 'export'], 'other styles and legacy torn pieces keep the original renderer');
    }
    calls.length = 0; await renderCut(page, 'source.jpg', { x: 0, y: 0, width: 1600, height: 90 }, 'torn', 77, 2);
    assert.deepEqual(pixels, render(1600, 90, 77), 'wide strips keep the pixel mask identical');
    assert.deepEqual(calls, ['draw', 'get', 'put', 'get', 'put', 'get', 'put', 'get', 'put', 'export']);
    failRead = true; calls.length = 0;
    await renderCut(page, 'source.jpg', rect, 'torn', 123, 2);
    assert.deepEqual(calls, ['draw', 'get', 'draw', 'export'], 'unsupported pixel APIs fall back to the contour torn edge instead of failing the cut');
  } finally { global.uni = previousUni; }
};
