// Replays the saved real OCR response through the real frontend/service code.
// Storage/database and cloud transport are local substitutes. No paid calls.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('puppeteer-core');
const { imageSize } = require('../functions/collageOcr/node_modules/image-size');
const { createService } = require('../functions/collageOcr/core');
const { createStore } = require('../functions/collageOcr/store');
const { memoryDb } = require('./test-collage-studio.cjs');

async function main() {
  const directory = path.join(__dirname, '../unpackage/collage-tests/ocr-live');
  const raw = JSON.parse(fs.readFileSync(path.join(directory, 'response.json'), 'utf8'));
  const source = 'data:image/jpeg;base64,' + fs.readFileSync(path.join(directory, 'source.jpg')).toString('base64');
  const db = memoryDb(), files = new Map(), actions = [];
  let providerCalls = 0, failStatus = false;
  const providerSizes = [];
  const service = createService({
    enabled: true, store: createStore(db), dimensions: imageSize,
    fileForPath: async cloudPath => `cloud://replay.bucket/${cloudPath}`,
    download: async fileID => { assert.ok(files.has(fileID)); return files.get(fileID); },
    cleanup: async fileID => { files.delete(fileID); },
    recognize: async base64 => {
      providerCalls++;
      const size = imageSize(Buffer.from(base64, 'base64')); providerSizes.push({ width: size.width, height: size.height });
      if (size.width === 900 && size.height === 1200) return raw;
      assert.equal(size.width, 480, 'provider receives only the selected region');
      assert.ok([110, 130].includes(size.height));
      const index = size.height === 110 ? 0 : 1, offset = { x: 50, y: index ? 280 : 130 };
      const line = structuredClone(raw.TextDetections[index]);
      const localPoints = points => points.map(point => ({ X: point.X - offset.x, Y: point.Y - offset.y }));
      line.Polygon = localPoints(line.Polygon);
      line.WordCoordPoint = line.WordCoordPoint.map(word => ({ WordCoordinate: localPoints(word.WordCoordinate) }));
      return { ...raw, TextDetections: [line] };
    }
  });
  const executablePath = [process.env.PUPPETEER_EXECUTABLE_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => p && fs.existsSync(p));
  const browser = await puppeteer.launch({ executablePath, headless: true });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    await page.setRequestInterception(true);
    page.on('request', request => /^(data:|blob:|http:\/\/127\.0\.0\.1:)/.test(request.url()) ? request.continue() : request.abort());
    await page.exposeFunction('__replayCloud', async event => { actions.push(event.action); if (failStatus && event.action === 'status') return { success: true, enabled: false, message: '测试服务暂不可用' }; return service(event, 'tcb:ocr-replay'); });
    await page.exposeFunction('__replayUpload', async (cloudPath, base64) => {
      const fileID = `cloud://replay.bucket/${cloudPath}`; files.set(fileID, Buffer.from(base64, 'base64')); return fileID;
    });
    await page.goto(`${process.env.COLLAGE_TEST_URL || 'http://127.0.0.1:8081/'}#/pages-collage/collage-studio/collage-studio`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.studio');
    await page.evaluate(async source => {
      window.__ENTERAPP_HIDE_BOOT_MASK__?.(); document.getElementById('app-loading-mask')?.remove();
      window.ocrVm = () => { let c = document.querySelector('.studio').__vueParentComponent; while (c && !c.proxy?.workspace) c = c.parent; return c.proxy; };
      uni.setStorageSync('userOpenId', 'ocr-replay');
      const vm = window.ocrVm();
      vm.$tcb = {
        __skipAuth: true,
        callFunction: async ({ name, data }) => { if (name !== 'collageOcr') throw new Error('Unexpected cloud call'); return { result: await window.__replayCloud(data) }; },
        uploadFile: async ({ cloudPath, file }) => {
          const base64 = await new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result.split(',')[1]); reader.readAsDataURL(file); });
          return { fileID: await window.__replayUpload(cloudPath, base64) };
        }
      };
      uni.chooseImage = options => options.success({ tempFilePaths: [source] });
    }, source);
    await page.waitForFunction(() => !window.ocrVm().busy);
    const tap = async text => {
      const handle = await page.evaluateHandle(text => [...document.querySelectorAll('.studio uni-button')].find(el => (el.getAttribute('aria-label') || el.textContent.trim()) === text && el.getClientRects().length), text);
      const el = handle.asElement(); assert.ok(el, text);
      await el.scrollIntoView(); assert.equal(await el.evaluate(el => el.hasAttribute('disabled')), false, text);
      await el.tap(); await handle.dispose();
      await page.waitForFunction(() => !window.ocrVm().busy);
    };
    await tap('导入图片'); await tap('识字选取');
    assert.equal(await page.$('.image-scroll'), null, 'entering OCR hides the original-image editor');
    assert.equal(await page.$('.zoom-slider'), null, 'OCR mode hides zoom controls');
    assert.equal(await page.evaluate(() => document.querySelector('.studio').textContent.includes('看原图')), false);
    assert.equal(await page.evaluate(() => document.querySelector('.ocr-panel').textContent.includes('从文字中挑选')), false);
    assert.equal(await page.evaluate(() => window.ocrVm().effectivePadding), 6, 'OCR defaults to six pixels of padding');
    assert.equal(await page.evaluate(() => window.ocrVm().error), '');
    assert.equal(await page.$$eval('.ocr-line', els => els.length), 3);
    assert.deepEqual(actions.slice(0, 3), ['status', 'prepare', 'recognize']);
    assert.equal(files.size, 0, 'recognition cleans up the uploaded original');
    const callsAfterRecognition = actions.length;
    await tap('手动框选'); assert.ok(await page.$('.image-scroll'), 'manual mode restores the original editor');
    await tap('识字选取'); await tap('识字选取');
    assert.equal(actions.length, callsAfterRecognition, 'reentering OCR reuses existing results without another request');
    const firstLine = (await page.$$('.ocr-line'))[0];
    const letters = await firstLine.$$('.character');
    assert.equal(letters.length, 9);
    await letters[2].scrollIntoView(); await letters[2].tap(); await letters[6].tap();
    const selected = await page.evaluate(() => { const vm = window.ocrVm(); return { crop: { ...vm.crop }, text: vm.materialName }; });
    assert.equal(selected.text, '遥远的山谷');
    await page.waitForFunction(() => !!window.ocrVm().cutPreview && !window.ocrVm().previewTask);
    assert.equal(await page.evaluate(() => document.querySelector('.studio').textContent.includes('预览纸片')), false, 'preview no longer needs a button');
    await tap('加入素材库');
    const material = await page.evaluate(async () => {
      const vm = window.ocrVm(), material = vm.workspace.materials[0];
      const image = new Image(); image.src = vm.urls[material.id]; await image.decode();
      return { name: material.name, width: image.width, height: image.height, crop: { ...material.baseRect }, error: vm.error };
    });
    assert.equal(material.error, ''); assert.equal(material.name, selected.text);
    assert.deepEqual(material.crop, selected.crop);
    assert.equal(material.width, selected.crop.width + 12); assert.equal(material.height, selected.crop.height + 12);
    const pickRange = async (lineIndex, start, end) => {
      const line = (await page.$$('.ocr-line'))[lineIndex], chars = await line.$$('.character');
      await chars[start].scrollIntoView(); await chars[start].tap(); await chars[end].scrollIntoView(); await chars[end].tap();
    };
    await pickRange(0, 0, 1); await pickRange(0, 5, 6); await pickRange(1, 2, 4);
    assert.equal(await page.evaluate(() => window.ocrVm().ocrSelections.length), 3, 'disjoint ranges across lines accumulate');
    const removePart = (await page.$$('.selection-remove'))[1]; await removePart.scrollIntoView(); await removePart.tap();
    assert.equal(await page.evaluate(() => window.ocrVm().ocrSelections.length), 2, 'one selected range can be removed');
    const wholeLine = await (await page.$$('.ocr-line'))[2].$('uni-button');
    await wholeLine.scrollIntoView(); await wholeLine.tap();
    await wholeLine.tap();
    assert.equal(await page.evaluate(() => window.ocrVm().ocrSelections.length), 3, 'whole line can join the batch without accidental duplicates');
    await tap('撕纸');
    const pending = await page.evaluate(() => window.ocrVm().ocrSelections.map(part => ({ text: part.text, seed: part.seed, rect: { ...part.rect } })));
    assert.equal(new Set(pending.map(part => part.seed)).size, 3, 'each paper has its own torn-edge seed');
    await (await page.$('.ocr-selections')).screenshot({ path: path.join(directory, 'batch-selections.png') });
    await tap('一次制作 3 张');
    const batch = await page.evaluate(() => {
      const vm = window.ocrVm(); return { materials: vm.workspace.materials.slice(1).map(item => ({ name: item.name, seed: item.seed, rect: { ...item.baseRect }, padding: item.padding, edge: item.edge })), remaining: vm.ocrSelections.length, error: vm.error };
    });
    assert.equal(batch.error, ''); assert.equal(batch.remaining, 0);
    assert.deepEqual(batch.materials, pending.map(part => ({ name: part.text, seed: part.seed, rect: part.rect, padding: 6, edge: 'torn' })), 'each selected range produces its own padded paper');
    // Interrupt the second save, then retry: the first saved material must not duplicate.
    await pickRange(0, 2, 3); await pickRange(1, 5, 6);
    await page.evaluate(() => {
      const vm = window.ocrVm(); window.ocrOriginalPersist = vm.persist; let attempts = 0;
      vm.persist = () => ++attempts === 2 ? false : window.ocrOriginalPersist();
    });
    await tap('一次制作 2 张');
    assert.deepEqual(await page.evaluate(() => ({ count: window.ocrVm().workspace.materials.length, remaining: window.ocrVm().ocrSelections.length })), { count: 5, remaining: 1 });
    assert.match(await page.evaluate(() => window.ocrVm().error), /已保存 1 张/);
    await page.evaluate(() => { window.ocrVm().persist = window.ocrOriginalPersist; });
    await tap('加入素材库');
    assert.deepEqual(await page.evaluate(() => ({ count: window.ocrVm().workspace.materials.length, remaining: window.ocrVm().ocrSelections.length })), { count: 6, remaining: 0 });
    // Slow image decoding to exercise a selection change while a preview is in flight.
    await page.evaluate(() => {
      const vm = window.ocrVm(); window.ocrNativeImage = window.Image;
      window.Image = class extends window.ocrNativeImage {
        set onload(handler) { super.onload = event => setTimeout(() => handler?.call(this, event), 180); }
      };
      vm.pickLine(vm.currentOcr.lines[0]); window.olderPreview = vm.previewCut();
    });
    await page.waitForFunction(() => !!window.ocrVm().previewTask);
    const nextLine = await (await page.$$('.ocr-line'))[1].$('uni-button');
    await nextLine.scrollIntoView(); await nextLine.tap();
    assert.equal(await page.evaluate(() => window.ocrVm().materialName), '我们把月光折成纸船', 'selection remains responsive during preview');
    await page.waitForFunction(() => !!window.ocrVm().cutPreview && !window.ocrVm().previewTask && !window.ocrVm().previewQueued);
    const latestPreview = await page.evaluate(async () => {
      window.Image = window.ocrNativeImage;
      const vm = window.ocrVm(); const image = new Image(); image.src = vm.cutPreview; await image.decode();
      return { width: image.width, height: image.height, expectedWidth: vm.cutBounds.width, expectedHeight: vm.cutBounds.height };
    });
    assert.equal(latestPreview.width, latestPreview.expectedWidth); assert.equal(latestPreview.height, latestPreview.expectedHeight);
    await tap('清空');
    assert.equal(await page.evaluate(() => window.ocrVm().cutPreview), '', 'clearing selection clears automatic preview');
    await page.screenshot({ path: path.join(directory, 'selection.png'), fullPage: true });
    await tap('手动框选');
    const beforeSmallRegion = actions.length;
    await page.evaluate(() => { window.ocrVm().crop = { x: 10, y: 10, width: 8, height: 8 }; });
    await tap('识字选取');
    assert.match(await page.evaluate(() => window.ocrVm().error), /区域太小/);
    assert.equal(actions.length, beforeSmallRegion, 'too-small region is rejected before any upload or OCR call');
    await tap('手动框选');
    await page.evaluate(() => { window.ocrVm().crop = { x: 50, y: 130, width: 480, height: 110 }; });
    await tap('识字选取');
    assert.deepEqual(providerSizes.at(-1), { width: 480, height: 110 });
    const regionResult = await page.evaluate(() => JSON.parse(JSON.stringify(window.ocrVm().currentOcr)));
    assert.equal(regionResult.lines.length, 1);
    assert.equal(regionResult.lines[0].text, '风从遥远的山谷吹来');
    assert.deepEqual(regionResult.lines[0].polygon, raw.TextDetections[0].Polygon.map(p => ({ x: p.X, y: p.Y })), 'line coordinates map back to parent image');
    assert.deepEqual(regionResult.lines[0].chars[2].polygon, raw.TextDetections[0].WordCoordPoint[2].WordCoordinate.map(p => ({ x: p.X, y: p.Y })), 'character coordinates map back to parent image');
    await pickRange(0, 2, 6);
    await page.waitForFunction(() => !!window.ocrVm().cutPreview && !window.ocrVm().previewTask);
    const regionPreview = await page.evaluate(async () => { const vm = window.ocrVm(); const image = new Image(); image.src = vm.cutPreview; await image.decode(); return { name: vm.materialName, rect: { ...vm.crop }, width: image.width, height: image.height }; });
    assert.equal(regionPreview.name, '遥远的山谷');
    assert.deepEqual(regionPreview.rect, selected.crop, 'local OCR selects the same source pixels as whole-page OCR');
    assert.equal(regionPreview.width, selected.crop.width + 12); assert.equal(regionPreview.height, selected.crop.height + 12);
    const callsAfterRegion = actions.length;
    await tap('手动框选'); await tap('识字选取');
    assert.equal(actions.length, callsAfterRegion, 'same manual region reuses its cache, not the selected text crop');
    await tap('手动框选');
    await page.evaluate(() => { window.ocrVm().crop = { x: 50, y: 280, width: 480, height: 130 }; });
    await tap('识字选取');
    assert.deepEqual(providerSizes.at(-1), { width: 480, height: 130 });
    assert.equal(await page.evaluate(() => window.ocrVm().currentOcr.lines[0].text), '我们把月光折成纸船');
    assert.equal(await page.evaluate(() => window.ocrVm().ocrSelections.length), 0, 'changing OCR region clears old pending selections');
    assert.equal(await page.evaluate(() => uni.getStorageSync(window.ocrVm().storageKey).sources[0].ocrRegions.length), 2, 'region results and cleanup metadata persist with their parent');
    await tap('手动框选'); await page.evaluate(() => { window.ocrVm().crop = null; }); await tap('识字选取');
    assert.equal(await page.evaluate(() => window.ocrVm().currentOcr.lines.length), 3, 'no selection restores whole-page results');
    assert.equal(providerCalls, 3, 'whole page and two regions each need only one provider request');
    await tap('导入图片');
    assert.equal(providerCalls, 3, 'reimporting identical content reuses recognition cache');
    failStatus = true;
    const recognizedBeforeFailure = actions.filter(action => action === 'recognize').length;
    await tap('导入图片');
    assert.match(await page.evaluate(() => window.ocrVm().error), /测试服务暂不可用/);
    assert.equal(actions.filter(action => action === 'recognize').length, recognizedBeforeFailure, 'unavailable service does not automatically retry paid recognition');
    failStatus = false; await tap('重试识别');
    assert.equal(await page.evaluate(() => window.ocrVm().error), '');
    assert.equal(providerCalls, 3, 'explicit retry still uses the content cache');
    await page.evaluate(() => { window.ocrVm().confirm = async () => true; });
    for (let i = 0; i < 3; i++) {
      const remove = await page.$('.source-remove'); await remove.scrollIntoView(); await remove.tap();
      await page.waitForFunction(() => !window.ocrVm().busy);
    }
    assert.equal(await page.evaluate(() => window.ocrVm().workspace.sources.length), 0);
    assert.equal(await page.evaluate(() => window.ocrVm().workspace.materials.length), 6, 'deleting originals retains the cut PNGs');
    assert.equal([...db.records.keys()].filter(key => key.startsWith('collage_ocr_cache/')).length, 0, 'source indices and final OCR cache are deleted');
    assert.equal(files.size, 0);
    console.log('[test-collage-ocr-replay] PASS: automatic recognition and preview, whole image/regions, real-response adaptation, 6px padding, multiple ranges/lines, cancellation, independent torn PNGs, partial failure/retry without duplicates, content cache and source cleanup; no external network');
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
