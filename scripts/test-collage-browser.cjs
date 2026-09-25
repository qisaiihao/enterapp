const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('puppeteer-core');

async function main() {
  const executablePath = [process.env.PUPPETEER_EXECUTABLE_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => p && fs.existsSync(p));
  assert.ok(executablePath, 'Chrome/Edge required');
  const browser = await puppeteer.launch({ executablePath, headless: true });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    await page.setRequestInterception(true);
    page.on('request', request => {
      const url = request.url();
      if (/^(data:|blob:|http:\/\/127\.0\.0\.1:)/.test(url)) request.continue();
      else request.abort(); // No production API calls or paid OCR during browser tests.
    });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const touch = await page.createCDPSession();
    const touchDrag = async (start, end, during) => {
      await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
      for (let step = 1; step <= 6; step++) {
        await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start.x + (end.x - start.x) * step / 6, y: start.y + (end.y - start.y) * step / 6 }] });
      }
      if (during) await during();
      await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    };
    const base = process.env.COLLAGE_TEST_URL || 'http://127.0.0.1:8081/';
    await page.goto(`${base}#/pages-collage/collage-studio/collage-studio`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.studio', { timeout: 60000 });
    await page.evaluate(() => {
      window.__ENTERAPP_HIDE_BOOT_MASK__?.();
      document.getElementById('app-loading-mask')?.remove();
      window.collageTestVm = () => {
        let component = document.querySelector('.studio').__vueParentComponent;
        while (component && !component.proxy?.workspace) component = component.parent;
        return component.proxy;
      };
    });
    await page.waitForFunction(() => !window.collageTestVm().busy);
    const tapButton = async text => {
      const handle = await page.evaluateHandle(label => [...document.querySelectorAll('.studio uni-button')].find(button => (button.getAttribute('aria-label') || button.textContent.trim()) === label && button.getClientRects().length), text);
      const button = handle.asElement();
      assert.ok(button, `button visible: ${text}`);
      assert.equal(await button.evaluate(element => element.getAttribute('disabled')), null, `button enabled: ${text}`);
      await button.tap();
      await handle.dispose();
    };
    const tapRemoveSource = async (index = 0) => {
      const buttons = await page.$$('.source-remove');
      assert.ok(buttons[index], 'each thumbnail has its own remove button');
      assert.equal(await buttons[index].evaluate(element => element.getAttribute('disabled')), null);
      await buttons[index].tap();
    };
    // Use the actual import control: direct method calls miss disabled UI regressions.
    await page.evaluate(() => {
      const canvas = document.createElement('canvas'); canvas.width = 900; canvas.height = 1200;
      const ctx = canvas.getContext('2d'); ctx.fillStyle = '#e6dbc0'; ctx.fillRect(0, 0, 900, 1200);
      ctx.fillStyle = '#263e30'; ctx.font = '48px serif'; ctx.fillText('风从遥远的山谷吹来', 70, 200); ctx.fillText('我们把月光折成纸船', 70, 340);
      window.collageTestImage = canvas.toDataURL('image/png');
      uni.chooseImage = options => options.success({ tempFilePaths: [window.collageTestImage] });
    });
    await tapButton('导入图片');
    await page.waitForFunction(() => !window.collageTestVm().busy && window.collageTestVm().workspace.sources.length === 1);
    const imported = await page.evaluate(async () => {
      const vm = window.collageTestVm();
      const stored = new Image(); stored.src = vm.urls[vm.sourceId]; await stored.decode();
      const sample = document.createElement('canvas'); sample.width = 900; sample.height = 1200;
      const sampler = sample.getContext('2d'); sampler.drawImage(stored, 0, 0);
      return { count: vm.workspace.sources.length, error: vm.error, file: vm.currentSource?.file, pixel: Array.from(sampler.getImageData(10, 10, 1, 1).data) };
    });
    assert.equal(imported.count, 1, imported.error);
    assert.match(imported.file, /^idb:/);
    assert.ok(Math.abs(imported.pixel[0] - 230) < 8 && Math.abs(imported.pixel[2] - 192) < 8, `source pixels must survive normalization: ${imported.pixel}`);
    const zoomAnchor = () => page.evaluate(() => {
      const vm = window.collageTestVm(), viewport = document.querySelector('.image-scroll').getBoundingClientRect();
      const stage = document.querySelector('#collage-source-stage').getBoundingClientRect();
      const crop = document.querySelector('.crop-box')?.getBoundingClientRect();
      return crop
        ? { x: crop.left + crop.width / 2 - viewport.left, y: crop.top + crop.height / 2 - viewport.top }
        : { x: (viewport.left + viewport.width / 2 - stage.left) / vm.sourceScale, y: (viewport.top + viewport.height / 2 - stage.top) / vm.sourceScale };
    });
    const assertAnchor = (before, after, message) => {
      assert.ok(Math.abs(before.x - after.x) < 3 && Math.abs(before.y - after.y) < 3, `${message}: ${JSON.stringify({ before, after })}`);
    };
    const zoomTo = async value => {
      await (await page.$('.zoom-slider')).scrollIntoView();
      const track = await page.$eval('.zoom-slider .uni-slider-tap-area', el => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top + r.height / 2, width: r.width }; });
      const current = await page.evaluate(() => window.collageTestVm().zoom);
      const anchor = await zoomAnchor();
      await touchDrag({ x: track.x + track.width * (current - 100) / 200, y: track.y }, { x: track.x + track.width * (value - 100) / 200, y: track.y }, async () => {
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        assertAnchor(anchor, await zoomAnchor(), 'viewport center stays anchored during zoom without a selection');
      });
      assertAnchor(anchor, await zoomAnchor(), 'releasing zoom preserves the anchor');
    };
    await zoomTo(200);
    await tapButton('移动');
    await page.$eval('.image-scroll', el => el.scrollIntoView({ block: 'center' }));
    const panRect = await page.$eval('.image-scroll', el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    const beforePan = await page.evaluate(() => ({ ...window.collageTestVm().sourceScroll }));
    await touchDrag(panRect, { x: panRect.x - 35, y: panRect.y - 50 });
    await page.waitForFunction(before => { const p = window.collageTestVm().sourceScroll; return p.x > before.x + 10 || p.y > before.y + 10; }, {}, beforePan);
    await tapButton('框选');
    await zoomTo(250);
    await (await page.$('.source-thumb')).tap();
    await page.waitForFunction(() => { const vm = window.collageTestVm(); return vm.zoom === 100 && vm.sourceScroll.x === 0 && vm.sourceScroll.y === 0; });
    // Use actual mouse events for the selection surface; touch handlers are tested next.
    await page.waitForFunction(() => !!window.collageTestVm().sourceRect);
    await page.$eval('#collage-source-stage', element => element.scrollIntoView({ block: 'start' }));
    const rect = await page.$eval('#collage-source-stage', element => { const r = element.getBoundingClientRect(); return { x: r.left, y: r.top }; });
    // Mouse coordinates are integer CSS pixels; touch coordinates retain fractions.
    // Use the same actual image-relative offsets for both, including after scrolling.
    const mouseStart = { x: Math.round(rect.x + 20), y: Math.round(rect.y + 55) };
    await page.mouse.move(mouseStart.x, mouseStart.y); await page.mouse.down();
    await page.mouse.move(mouseStart.x + 205, mouseStart.y + 30, { steps: 6 });
    const drawing = await page.evaluate(() => ({ ...window.collageTestVm().crop }));
    await page.mouse.up();
    assert.deepEqual(await page.evaluate(() => ({ ...window.collageTestVm().crop })), drawing, 'release does not enlarge selection');
    await page.waitForFunction(() => !!window.collageTestVm().cutPreview && !window.collageTestVm().previewTask);
    const automaticPreview = await page.evaluate(async () => { const image = new Image(); image.src = window.collageTestVm().cutPreview; await image.decode(); return { width: image.width, height: image.height }; });
    assert.deepEqual(automaticPreview, { width: drawing.width, height: drawing.height }, 'manual crop automatically previews on release without padding');
    const visibleCrop = await page.$eval('.crop-box', element => ({ width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height }));
    assert.ok(Math.abs(visibleCrop.width - 205) < 1 && Math.abs(visibleCrop.height - 30) < 1, `selection follows pointer: ${JSON.stringify(visibleCrop)}`);

    const zoomSlider = await page.$('.zoom-slider');
    await zoomSlider.scrollIntoView();
    const zoomTrack = await page.$eval('.zoom-slider .uni-slider-tap-area', element => { const r = element.getBoundingClientRect(); return { x: r.left, y: r.top + r.height / 2, width: r.width }; });
    const selectionAnchor = await zoomAnchor();
    await touchDrag({ x: zoomTrack.x, y: zoomTrack.y }, { x: zoomTrack.x + zoomTrack.width / 2, y: zoomTrack.y }, async () => {
      assert.ok(await page.evaluate(() => window.collageTestVm().zoom > 150), 'zoom updates while finger is moving');
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      assertAnchor(selectionAnchor, await zoomAnchor(), 'selection center stays in place during zoom');
    });
    assertAnchor(selectionAnchor, await zoomAnchor(), 'selection center stays in place after release');
    assert.deepEqual(await page.evaluate(() => ({ ...window.collageTestVm().crop })), drawing, 'zoom preserves original-image selection coordinates');
    const zoomed = await page.evaluate(() => ({ zoom: window.collageTestVm().zoom, width: document.querySelector('.crop-box').getBoundingClientRect().width }));
    assert.ok(Math.abs(zoomed.width - visibleCrop.width * zoomed.zoom / 100) < 1, 'visible box scales together with image');
    await touchDrag({ x: zoomTrack.x + zoomTrack.width / 2, y: zoomTrack.y }, { x: zoomTrack.x, y: zoomTrack.y });
    assert.equal(await page.evaluate(() => window.collageTestVm().zoom), 100);
    await page.$eval('#collage-source-stage', element => element.scrollIntoView({ block: 'start' }));
    const touchRect = await page.$eval('#collage-source-stage', element => { const r = element.getBoundingClientRect(); return { x: r.left, y: r.top }; });
    await touchDrag({ x: touchRect.x + 100, y: touchRect.y + 70 }, { x: touchRect.x + 115, y: touchRect.y + 80 });
    const movedCrop = await page.evaluate(() => ({ ...window.collageTestVm().crop }));
    assert.equal(movedCrop.width, drawing.width, 'touch moving keeps selection width');
    assert.equal(movedCrop.height, drawing.height, 'touch moving keeps selection height');
    assert.ok(movedCrop.x > drawing.x && movedCrop.y > drawing.y, 'touch moves selected area');
    const corner = await page.$eval('.crop-box .se', element => { const r = element.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await touchDrag(corner, { x: corner.x + 20, y: corner.y + 10 });
    const resizedCrop = await page.evaluate(() => ({ ...window.collageTestVm().crop }));
    assert.ok(resizedCrop.width > movedCrop.width && resizedCrop.height > movedCrop.height, 'touch corner resizes selection');
    // Exercise real two-finger events, including promotion from a crop drag.
    await page.$eval('.image-scroll', el => el.scrollIntoView({ block: 'center' }));
    const viewport = await page.$eval('.image-scroll', el => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; });
    const frame = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const gestureState = () => page.evaluate(() => {
      const vm = window.collageTestVm(), stage = document.querySelector('#collage-source-stage').getBoundingClientRect();
      return { zoom: vm.zoom, crop: vm.crop ? { ...vm.crop } : null, scroll: { ...vm.sourceScroll }, scale: vm.sourceScale, stage: { x: stage.left, y: stage.top }, gesture: vm.sourceGesture?.kind || null, drawing: !!vm.cropGesture };
    });
    const twoFingerDrag = async (start, end, { sequential = false, remaining = false, cancel = false } = {}) => {
      if (sequential) await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start[0]] });
      await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: start });
      await frame();
      for (let step = 1; step <= 6; step++) {
        await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: start.map((p, i) => ({ id: p.id, x: p.x + (end[i].x - p.x) * step / 6, y: p.y + (end[i].y - p.y) * step / 6 })) });
        await frame();
      }
      const during = await gestureState();
      if (remaining) {
        await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [end[0]] });
        await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...end[0], x: end[0].x + 15, y: end[0].y + 15 }] });
        await frame();
        const tail = await gestureState();
        assert.deepEqual(tail.crop, during.crop, 'remaining finger cannot redraw or move the crop');
        assert.deepEqual(tail.scroll, during.scroll, 'remaining finger cannot pan unexpectedly');
        assert.equal(tail.drawing, false);
      }
      await touch.send('Input.dispatchTouchEvent', { type: cancel ? 'touchCancel' : 'touchEnd', touchPoints: [] });
      await frame();
      assert.equal((await gestureState()).gesture, null, 'gesture is cleared on release/cancel');
      return during;
    };
    const center = { x: viewport.x + viewport.width / 2, y: viewport.y + viewport.height / 2 };
    const pair = half => [{ id: 0, x: center.x - half, y: center.y }, { id: 1, x: center.x + half, y: center.y }];
    const pinchStart = await gestureState();
    const enlarged = await twoFingerDrag(pair(40), pair(80), { sequential: true, remaining: true });
    assert.equal(enlarged.zoom, 200, 'spreading two fingers doubles image scale');
    assert.deepEqual(enlarged.crop, resizedCrop, 'a second finger restores the crop present before the first finger landed');
    assertAnchor({ x: (center.x - pinchStart.stage.x) / pinchStart.scale, y: (center.y - pinchStart.stage.y) / pinchStart.scale },
      { x: (center.x - enlarged.stage.x) / enlarged.scale, y: (center.y - enlarged.stage.y) / enlarged.scale }, 'pinch anchors the source pixel between both fingers');
    const panned = await twoFingerDrag(pair(60), pair(60).map(p => ({ ...p, x: p.x - 30, y: p.y - 40 })));
    assert.equal(panned.zoom, 200, 'parallel two-finger movement does not change scale');
    assert.ok(Math.abs(panned.scroll.x - enlarged.scroll.x - 30) < 3 && Math.abs(panned.scroll.y - enlarged.scroll.y - 40) < 3, 'two-finger movement pans in both axes');
    assert.deepEqual(panned.crop, resizedCrop, 'two-finger panning preserves original crop coordinates');
    assert.equal((await twoFingerDrag(pair(30), pair(120))).zoom, 300, 'pinch respects maximum zoom');
    assert.equal((await twoFingerDrag(pair(120), pair(20), { cancel: true })).zoom, 100, 'pinch respects minimum zoom and supports cancellation');
    assert.deepEqual((await gestureState()).crop, resizedCrop);
    // Both fingers can begin on the crop and its handles without moving the selection.
    const pinchCorner = await page.$eval('.crop-box .se', el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    const handlePair = [{ id: 0, ...pinchCorner }, { id: 1, x: pinchCorner.x - 80, y: pinchCorner.y }];
    await twoFingerDrag(handlePair, [{ ...handlePair[0], x: pinchCorner.x + 10 }, { ...handlePair[1], x: pinchCorner.x - 90 }], { sequential: true });
    assert.deepEqual((await gestureState()).crop, resizedCrop, 'pinching from a resize handle leaves the crop intact');
    await tapButton('移动');
    const panModeStart = await gestureState();
    const panModePinch = await twoFingerDrag(pair(40), pair(60));
    assert.equal(panModePinch.zoom, Math.round(panModeStart.zoom * 1.5), 'pinch also works with the existing move-image control enabled');
    await tapButton('框选');
    const combinedStart = await gestureState();
    const combinedEnd = pair(50).map(p => ({ ...p, x: p.x - 15, y: p.y - 20 }));
    const combined = await twoFingerDrag(pair(40), combinedEnd);
    assert.equal(combined.zoom, Math.round(combinedStart.zoom * 1.25), 'one gesture can zoom and pan together');
    assertAnchor({ x: (center.x - combinedStart.stage.x) / combinedStart.scale, y: (center.y - combinedStart.stage.y) / combinedStart.scale },
      { x: (center.x - 15 - combined.stage.x) / combined.scale, y: (center.y - 20 - combined.stage.y) / combined.scale }, 'combined gesture keeps the same image point under the moving midpoint');
    const edgePair = [{ id: 0, x: viewport.x + 30, y: viewport.y + 35 }, { id: 1, x: viewport.x + 80, y: viewport.y + 35 }];
    await twoFingerDrag(edgePair, edgePair.map(p => ({ ...p, x: p.x + 245, y: p.y + 280 })));
    const atEdge = await twoFingerDrag(edgePair, edgePair.map(p => ({ ...p, x: p.x + 245, y: p.y + 280 })));
    assert.deepEqual(atEdge.scroll, { x: 0, y: 0 }, 'panning stops at the image boundary');
    assert.deepEqual(atEdge.crop, resizedCrop);
    await (await page.$('.source-thumb')).tap(); // Reselect to clear the box and avoid its corner handles.
    await page.$eval('#collage-source-stage', element => element.scrollIntoView({ block: 'start' }));
    const redrawRect = await page.$eval('#collage-source-stage', element => { const r = element.getBoundingClientRect(); return { x: r.left, y: r.top }; });
    let touchDrawing;
    const touchStart = { x: redrawRect.x + mouseStart.x - rect.x, y: redrawRect.y + mouseStart.y - rect.y };
    await touchDrag(touchStart, { x: touchStart.x + 205, y: touchStart.y + 30 }, async () => {
      touchDrawing = await page.evaluate(() => ({ ...window.collageTestVm().crop }));
    });
    const redrawn = await page.evaluate(() => ({ ...window.collageTestVm().crop }));
    assert.deepEqual(redrawn, touchDrawing, 'touch release does not expand selection');
    for (const key of ['x', 'y', 'width', 'height']) assert.ok(Math.abs(redrawn[key] - drawing[key]) <= 2, `touch/mouse selection agrees: ${key}; touch=${JSON.stringify(redrawn)}, mouse=${JSON.stringify(drawing)}`);
    const initialTornPreview = await page.evaluate(async () => {
      const vm = window.collageTestVm(); vm.setEdge('torn'); await vm.previewCut();
      return vm.cutPreview;
    });
    await tapButton('换一种撕边');
    await page.waitForFunction(() => !window.collageTestVm().busy && !!window.collageTestVm().cutPreview);
    assert.notEqual(await page.evaluate(() => window.collageTestVm().cutPreview), initialTornPreview, 'reroll button creates a visibly different contour');
    const cut = await page.evaluate(async () => {
      const vm = window.collageTestVm();
      const crop = vm.crop ? { ...vm.crop } : null;
      const preview = vm.cutPreview;
      await vm.previewCut();
      const repeatPreviewMatches = vm.cutPreview === preview;
      vm.materialName = '遥远的山谷';
      await vm.saveCut();
      const material = vm.workspace.materials[0];
      return { crop, count: vm.workspace.materials.length, error: vm.error, url: vm.urls[material?.id], width: material?.width, height: material?.height, padding: material?.padding, repeatPreviewMatches, savedPreviewMatches: vm.cutPreview === preview };
    });
    assert.ok(cut.crop?.width > 100, 'dragging creates original-pixel crop');
    assert.equal(cut.count, 1, cut.error);
    assert.equal(cut.repeatPreviewMatches, true, 'repeated preview keeps the chosen contour');
    assert.equal(cut.savedPreviewMatches, true, 'saved piece matches the chosen preview');
    assert.equal(cut.padding, 0, 'new selection has no hidden padding');
    assert.equal(cut.width, cut.crop.width, 'saved crop width matches selection');
    assert.equal(cut.height, cut.crop.height, 'saved crop height matches selection');
    const alpha = await page.evaluate(async url => {
      const image = new Image(); image.src = url; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
      const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
      const pixels = ctx.getImageData(0, 0, image.width, image.height).data;
      let ink = 0, paper = 0;
      for (let i = 0; i < pixels.length; i += 4) { if (pixels[i + 3] > 240 && pixels[i] < 100) ink++; if (pixels[i + 3] > 240 && pixels[i] > 215 && pixels[i] < 240 && pixels[i + 2] < 205) paper++; }
      return { corner: ctx.getImageData(0, 0, 1, 1).data[3], center: ctx.getImageData(Math.floor(image.width / 2), Math.floor(image.height / 2), 1, 1).data[3], ink, paper };
    }, cut.url);
    assert.equal(alpha.corner, 0, 'torn edge exports transparent corners');
    assert.equal(alpha.center, 255, 'paper center remains opaque');
    assert.ok(alpha.ink > 100, `crop must preserve original text ink, got ${JSON.stringify(alpha)}`);
    assert.ok(alpha.paper > 100, 'crop must preserve original paper color');
    await page.evaluate(() => uni.hideToast());
    assert.equal(await page.$('.padding-slider'), null, 'manual selection has no padding control');
    assert.equal(await page.$('.name-input'), null, 'paper naming input is removed');
    assert.equal(await page.evaluate(() => window.collageTestVm().workspace.materials[0].name), '', 'manual pieces do not acquire custom names');
    await page.evaluate(() => {
      const vm = window.collageTestVm(), rect = { ...vm.crop };
      vm.currentSource.ocrRegions = [{ id: 'fixture-region', regionKey: `${rect.x}-${rect.y}-${rect.width}-${rect.height}`, rect, width: rect.width, height: rect.height, ocr: { provider: 'test-fixture', lines: [] } }];
    });
    await tapButton('识字选取');
    await (await page.$('.padding-slider')).scrollIntoView();
    const paddingTrack = await page.$eval('.padding-slider .uni-slider-tap-area', element => { const r = element.getBoundingClientRect(); return { x: r.left, y: r.top + r.height / 2, width: r.width }; });
    await touchDrag({ x: paddingTrack.x, y: paddingTrack.y }, { x: paddingTrack.x + paddingTrack.width / 2, y: paddingTrack.y });
    const padded = await page.evaluate(async () => {
      const vm = window.collageTestVm();
      await vm.previewCut();
      const image = new Image(); image.src = vm.cutPreview; await image.decode();
      return { padding: vm.padding, crop: { ...vm.crop }, bounds: { ...vm.cutBounds }, width: image.width, height: image.height, editorVisible: !!document.querySelector('.image-scroll') };
    });
    assert.ok(padded.padding > 0, 'padding slider responds to touch');
    assert.deepEqual(padded.crop, cut.crop, 'adding padding leaves base selection intact');
    assert.equal(padded.width, cut.width + padded.padding * 2);
    assert.equal(padded.height, cut.height + padded.padding * 2);
    assert.equal(padded.editorVisible, false, 'OCR mode hides the original-image editor');
    await tapButton('手动框选');
    const manualAgain = await page.evaluate(async () => {
      const vm = window.collageTestVm(); const oldPreviewCleared = !vm.cutPreview;
      await vm.previewCut();
      const image = new Image(); image.src = vm.cutPreview; await image.decode();
      return { oldPreviewCleared, padding: vm.effectivePadding, width: image.width, height: image.height, slider: !!document.querySelector('.padding-slider'), outline: !!document.querySelector('.padding-box') };
    });
    assert.deepEqual(manualAgain, { oldPreviewCleared: true, padding: 0, width: cut.width, height: cut.height, slider: false, outline: false }, 'OCR padding never carries into manual cropping');
    await page.evaluate(() => {
      const vm = window.collageTestVm();
      const line = { id: 'line-0', text: '风从遥远的山谷吹来', polygon: [{ x: 70, y: 150 }, { x: 502, y: 150 }, { x: 502, y: 205 }, { x: 70, y: 205 }], chars: Array.from('风从遥远的山谷吹来').map((text, i) => ({ text, polygon: [{ x: 70 + 48 * i, y: 150 }, { x: 118 + 48 * i, y: 150 }, { x: 118 + 48 * i, y: 205 }, { x: 70 + 48 * i, y: 205 }] })) };
      vm.ocrSource.ocr = { provider: 'test-fixture', lines: [line] }; vm.mode = 'ocr';
    });
    const tapChar = async index => { const chars = await page.$$('.character'); await chars[index].scrollIntoView(); await chars[index].tap(); };
    const selections = () => page.evaluate(() => ({ texts: window.collageTestVm().ocrSelections.map(part => part.text), highlighted: document.querySelectorAll('.character.picked').length }));
    await tapChar(2);
    assert.deepEqual(await selections(), { texts: ['遥'], highlighted: 1 }, 'one tap selects a single character');
    await tapChar(2);
    assert.deepEqual(await selections(), { texts: [], highlighted: 0 }, 'second tap deselects a single character');
    assert.equal(await page.evaluate(() => window.collageTestVm().crop), null, 'last deselection clears the crop');
    await tapChar(6); await tapChar(2);
    assert.deepEqual(await selections(), { texts: ['遥远的山谷'], highlighted: 5 }, 'reverse endpoint selection remains supported');
    await tapChar(8);
    await tapChar(4);
    assert.deepEqual(await selections(), { texts: ['来'], highlighted: 1 }, 'tapping a selected range removes it and preserves other selections');
    await tapChar(8);
    await page.waitForFunction(() => !window.collageTestVm().cutPreview && !window.collageTestVm().previewTask);
    assert.deepEqual(await selections(), { texts: [], highlighted: 0 }, 'cleared selections cannot return through a stale preview');
    await tapButton('整行'); await tapChar(0);
    assert.deepEqual(await selections(), { texts: [], highlighted: 0 }, 'tapping a character can also deselect a whole-line selection');
    await tapChar(2); await tapChar(4); await tapChar(0); await tapChar(6);
    assert.deepEqual(await selections(), { texts: ['遥远的', '风从遥远的山谷'], highlighted: 7 }, 'overlapping ranges can be queued');
    await tapChar(3);
    assert.deepEqual(await selections(), { texts: [], highlighted: 0 }, 'deselecting an overlapping character removes every containing range');
    await tapChar(2); await tapChar(6);
    const ocrCut = await page.evaluate(async () => {
      const vm = window.collageTestVm();
      const crop = { ...vm.crop }; const name = vm.materialName;
      await vm.$nextTick();
      const selected = document.querySelectorAll('.character.picked').length;
      await vm.saveCut();
      return { crop, name, selected, remaining: vm.ocrSelections.length, materials: vm.workspace.materials.length, error: vm.error };
    });
    assert.deepEqual(ocrCut.crop, { x: 166, y: 150, width: 240, height: 55 });
    assert.equal(ocrCut.name, '遥远的山谷'); assert.equal(ocrCut.selected, 5);
    assert.equal(ocrCut.materials, 2, ocrCut.error);
    assert.equal(ocrCut.remaining, 0, 'saved OCR selections leave the batch queue');
    await page.evaluate(() => { const vm = window.collageTestVm(); vm.addToBoard(vm.workspace.materials[0]); });
    for (const [selector, property, min, max] of [['.size-slider', 'width', 40, 850], ['.rotation-slider', 'rotation', -180, 180]]) {
      await page.evaluate(() => { const vm = window.collageTestVm(); vm.selectedItemId = vm.workspace.items[0].id; });
      const before = await page.evaluate(() => { const vm = window.collageTestVm(); return { item: { ...vm.selectedItem }, history: vm.history.length }; });
      await (await page.$(selector)).scrollIntoView();
      const track = await page.$eval(`${selector} .uni-slider-tap-area`, el => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top + r.height / 2, width: r.width }; });
      let during;
      await touchDrag({ x: track.x + track.width * (before.item[property] - min) / (max - min), y: track.y }, { x: track.x + track.width * .75, y: track.y }, async () => {
        during = await page.evaluate(() => { const vm = window.collageTestVm(); return { item: { ...vm.selectedItem }, history: vm.history.length, style: document.querySelector('.board-piece').getAttribute('style') }; });
        assert.notEqual(during.item[property], before.item[property], `${property} changes before release`);
        assert.equal(during.history, before.history + 1, 'continuous slider updates create only one history step');
        assert.ok(during.style.includes(property === 'width' ? 'width:' : `rotate(${during.item.rotation}deg)`), 'live value is reflected in the rendered paper');
      });
      const after = await page.evaluate(() => { const vm = window.collageTestVm(); return { item: { ...vm.selectedItem }, history: vm.history.length, saved: uni.getStorageSync(vm.storageKey).items[0] }; });
      assert.deepEqual(after.item, during.item, 'releasing slider preserves the live preview');
      assert.deepEqual(after.saved, after.item, 'release saves the final value');
      assert.equal(after.history, before.history + 1, 'release does not add a second history step');
      assert.ok(Math.abs(after.item.height / after.item.width - before.item.height / before.item.width) < 1e-10, 'resizing preserves aspect ratio');
      const restored = await page.evaluate(() => {
        const vm = window.collageTestVm(); vm.undo(); const undone = { ...vm.workspace.items[0] };
        vm.redo(); const redone = { ...vm.workspace.items[0] }; vm.undo();
        return { undone, redone };
      });
      assert.deepEqual(restored.undone, before.item, 'one backward step restores the pre-drag paper');
      assert.deepEqual(restored.redone, after.item, 'one forward step restores the complete slider drag');
    }
    await page.evaluate(() => window.collageTestVm().undo());
    const board = await page.evaluate(async () => {
      const vm = window.collageTestVm(); vm.addToBoard(vm.workspace.materials[0]);
      vm.rotateItem({ detail: { value: 12 } }); vm.addToBoard(vm.workspace.materials[0]);
      vm.startItem({ touches: [{ clientX: 100, clientY: 100 }] }, vm.selectedItem);
      vm.moveItem({ touches: [{ clientX: 135, clientY: 170 }] }); vm.endItem();
      const moved = vm.selectedItem.y;
      vm.undo(); const undone = vm.workspace.items[1].y;
      return { count: vm.workspace.items.length, moved, undone, error: vm.error };
    });
    assert.equal(board.count, 2); assert.ok(board.moved > board.undone);
    await tapButton('下载');
    await page.waitForFunction(() => !window.collageTestVm().busy && !!window.collageTestVm().exportedImage);
    const downloaded = await page.evaluate(async () => {
      const vm = window.collageTestVm();
      const image = new Image(); image.src = vm.exportedImage; await image.decode();
      return { width: image.width, height: image.height, error: vm.error };
    });
    assert.equal(downloaded.width, 900, downloaded.error); assert.equal(downloaded.height, 1200);
    const tapHistory = async label => {
      const button = await page.$(`.history-button[aria-label="${label}"]`);
      assert.ok(button, `${label} icon is present`);
      assert.equal(await button.evaluate(el => el.hasAttribute('disabled')), false, `${label} is enabled`);
      await button.scrollIntoView(); await button.tap();
    };
    const beforeRedo = await page.evaluate(() => window.collageTestVm().boardSnapshot());
    await tapHistory('前进');
    assert.equal(await page.evaluate(() => window.collageTestVm().workspace.items[1].y), board.moved, 'forward restores the exact dragged position');
    assert.equal(await page.$eval('.history-button[aria-label="前进"]', el => el.hasAttribute('disabled')), true, 'forward disables at latest state');
    assert.equal(await page.evaluate(() => window.collageTestVm().exportedImage), '', 'history navigation invalidates exported image');
    await tapHistory('后退'); await tapHistory('后退');
    assert.equal(await page.evaluate(() => window.collageTestVm().workspace.items.length), 1, 'second backward step removes the added paper');
    await tapHistory('前进');
    assert.equal(await page.evaluate(() => window.collageTestVm().boardSnapshot()), beforeRedo, 'forward restores dimensions, rotation, order and background');
    const branched = await page.evaluate(async () => {
      const vm = window.collageTestVm(); vm.setBackground('#ffffff');
      const futureCount = vm.redoHistory.length;
      vm.redo(); const background = vm.workspace.background;
      vm.undo();
      const restored = vm.boardSnapshot();
      const saved = uni.getStorageSync(vm.storageKey);
      await vm.exportImage();
      return { futureCount, background, restored, savedItems: saved.items };
    });
    assert.equal(branched.futureCount, 0, 'new edit after backward clears forward history');
    assert.equal(branched.background, '#ffffff', 'forward cannot restore discarded history');
    assert.equal(branched.restored, beforeRedo, 'background change can be undone');
    assert.deepEqual(branched.savedItems, JSON.parse(beforeRedo).items, 'history navigation persists the draft');
    fs.mkdirSync(path.join(__dirname, '../unpackage/collage-tests'), { recursive: true });
    await page.evaluate(() => uni.hideToast());
    await page.waitForFunction(() => [...document.querySelectorAll('.board img, .export-panel img')].every(image => image.complete && image.naturalWidth));
    await page.screenshot({ path: path.join(__dirname, '../unpackage/collage-tests/board.png'), fullPage: true });
    await tapButton('发布');
    await page.waitForSelector('.collage-upload .preview-image');
    const received = await page.evaluate(() => {
      let component = document.querySelector('.collage-upload').__vueParentComponent;
      while (component && !component.proxy?.imageInfo) component = component.parent;
      return { extension: component.proxy.imageInfo.extension, hasImage: !!component.proxy.selectedImage };
    });
    assert.deepEqual(received, { extension: 'png', hasImage: true });
    // Return without submitting the post.
    await page.evaluate(() => uni.navigateBack());
    await page.waitForSelector('.studio');
    await tapButton('裁切');
    await tapButton('手动框选');
    await page.evaluate(() => uni.hideToast());
    await tapButton('导入图片');
    await page.waitForFunction(() => !window.collageTestVm().busy && window.collageTestVm().workspace.sources.length === 2);
    const sourceToDelete = await page.evaluate(() => window.collageTestVm().workspace.sources[0].id);
    const activeSource = await page.evaluate(() => window.collageTestVm().sourceId);
    await (await page.$('.source-strip')).screenshot({ path: path.join(__dirname, '../unpackage/collage-tests/source-thumbnails.png') });
    const dismissDelete = async confirm => {
      const selector = confirm ? '.app-dialog-actions .app-dialog-button:last-child, .uni-modal__btn_primary' : '.app-dialog-actions .app-dialog-button:first-child, .uni-modal__btn_default';
      await page.waitForSelector(selector, { visible: true });
      await (await page.$(selector)).tap();
      await page.waitForFunction(() => !window.collageTestVm().busy);
    };
    await tapRemoveSource();
    await dismissDelete(false);
    assert.equal(await page.evaluate(() => window.collageTestVm().workspace.sources.length), 2, 'cancel keeps both originals');
    assert.equal(await page.evaluate(() => window.collageTestVm().sourceId), activeSource, 'thumbnail remove does not select that source');
    await tapRemoveSource();
    await dismissDelete(true);
    const afterDeletion = await page.evaluate(() => {
      const vm = window.collageTestVm();
      return { sources: vm.workspace.sources.length, current: vm.sourceId, materials: vm.workspace.materials.length, items: vm.workspace.items.length, sourceGone: !vm.workspace.sources.some(source => source.id === vm.workspace.materials[0].sourceId), oldUrl: !!vm.urls[vm.workspace.materials[0].sourceId] };
    });
    assert.deepEqual({ ...afterDeletion, current: undefined }, { sources: 1, current: undefined, materials: 2, items: 2, sourceGone: true, oldUrl: false }, 'source deletion preserves cut PNGs and board');
    assert.notEqual(afterDeletion.current, sourceToDelete, 'remaining source is selected');
    assert.equal(afterDeletion.current, activeSource, 'deleting another thumbnail preserves the current source');
    await tapButton('素材库');
    const libraryCards = await page.$$eval('.material-card', cards => cards.map(card => ({
      actions: [...card.querySelectorAll('uni-button')].map(button => `${button.getAttribute('aria-label') || ''}:${button.innerHTML.includes('add.png') ? 'add' : button.innerHTML.includes('delete.png') ? 'delete' : ''}`).sort(),
      alignment: getComputedStyle(card.querySelector('.material-actions')).justifyContent,
      hasName: !!card.querySelector('.material-name')
    })));
    assert.ok(libraryCards.length > 0, 'library shows saved pieces');
    for (const card of libraryCards) {
      assert.deepEqual(card.actions, ['放到画布:add', '删除:delete'].sort(), 'library card keeps only icon delete and put-on-canvas buttons');
      assert.equal(card.hasName, false, 'piece name is removed from the library card');
      assert.equal(card.alignment, 'flex-end', 'library card actions align right');
    }
    await tapButton('裁切');
    await tapRemoveSource();
    await dismissDelete(true);
    assert.equal(await page.evaluate(() => window.collageTestVm().workspace.sources.length), 0, 'last original can be deleted');
    await tapButton('导入图片');
    await page.waitForFunction(() => !window.collageTestVm().busy && window.collageTestVm().workspace.sources.length === 1);
    await page.evaluate(() => { uni.chooseImage = options => options.fail({ errMsg: 'chooseImage:fail cancel' }); });
    await tapButton('导入图片');
    assert.deepEqual(await page.evaluate(() => ({ count: window.collageTestVm().workspace.sources.length, busy: window.collageTestVm().isBusy })), { count: 1, busy: false }, 'cancelling picker leaves current sources usable');
    // Reload proves both metadata and bitmap files survive beyond temporary URLs.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.studio');
    await page.evaluate(() => {
      window.collageTestVm = () => {
        let component = document.querySelector('.studio').__vueParentComponent;
        while (component && !component.proxy?.workspace) component = component.parent;
        return component.proxy;
      };
    });
    const restored = await page.evaluate(async () => {
      let component = document.querySelector('.studio').__vueParentComponent;
      while (component && !component.proxy?.workspace) component = component.parent;
      const vm = component.proxy;
      while (vm.busy) await new Promise(resolve => setTimeout(resolve, 50));
      const image = new Image(); image.src = vm.urls[vm.workspace.materials[0].id]; await image.decode();
      return { sources: vm.workspace.sources.length, materials: vm.workspace.materials.length, items: vm.workspace.items.length, bitmap: image.width > 0 };
    });
    assert.deepEqual(restored, { sources: 1, materials: 2, items: 2, bitmap: true });
    const repeatedCuts = await page.evaluate(async () => {
      let component = document.querySelector('.studio').__vueParentComponent;
      while (component && !component.proxy?.workspace) component = component.parent;
      const vm = component.proxy;
      vm.crop = { x: 60, y: 140, width: 480, height: 80 }; vm.setEdge('torn');
      await vm.saveCut();
      const first = vm.workspace.materials.at(-1), firstPreview = vm.cutPreview;
      const firstFile = await (await fetch(vm.urls[first.id])).blob();
      await vm.saveCut(); // Same source and selection; a second piece should be different.
      const second = vm.workspace.materials.at(-1), secondPreview = vm.cutPreview;
      const firstFileAfter = await (await fetch(vm.urls[first.id])).blob();
      const firstUnchanged = await firstFile.text() === await firstFileAfter.text();
      return { differentSeeds: first.seed !== second.seed, differentPixels: firstPreview !== secondPreview, firstUnchanged, error: vm.error };
    });
    assert.deepEqual(repeatedCuts, { differentSeeds: true, differentPixels: true, firstUnchanged: true, error: '' });
    const comparison = await page.evaluate(async () => {
      let component = document.querySelector('.studio').__vueParentComponent;
      while (component && !component.proxy?.workspace) component = component.parent;
      const vm = component.proxy;
      const canvas = document.createElement('canvas'); canvas.width = 1280; canvas.height = 900;
      const ctx = canvas.getContext('2d'); ctx.fillStyle = '#eeeae2'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#303832'; ctx.font = '28px sans-serif'; ctx.fillText('旧版：随机折线', 40, 48); ctx.fillText('新版：起伏轮廓与纤维毛边', 660, 48);
      vm.crop = { x: 40, y: 140, width: 560, height: 110 }; vm.padding = 0; vm.edgeStyle = 'torn';
      for (let row = 0; row < 3; row++) {
        for (const version of [1, 2]) {
          vm.edgeVersion = version; vm.edgeSeed = [721, 18293, 57322][row]; vm.lastSavedEdgeSeed = null;
          const rendered = await vm.makeCut(); const image = new Image(); image.src = rendered.path; await image.decode();
          const x = version === 1 ? 40 : 660, y = 80 + row * 270;
          ctx.fillStyle = row === 1 ? '#f9f7f1' : '#34473e'; ctx.fillRect(x - 12, y - 10, 584, 242);
          ctx.drawImage(image, x, y);
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(image, 190, 0, 140, 22, x, y + 130, 560, 88);
          ctx.imageSmoothingEnabled = true;
        }
      }
      return canvas.toDataURL('image/png');
    });
    fs.writeFileSync(path.join(__dirname, '../unpackage/collage-tests/torn-edge-comparison.png'), Buffer.from(comparison.split(',')[1], 'base64'));
    // The rotate button turns the working image 90° clockwise; four clicks restore the original orientation.
    const sourceView = () => page.evaluate(async () => {
      let component = document.querySelector('.studio').__vueParentComponent;
      while (component && !component.proxy?.workspace) component = component.parent;
      const vm = component.proxy;
      const image = new Image(); image.src = vm.urls[vm.sourceId]; await image.decode();
      return { width: vm.currentSource.width, height: vm.currentSource.height, natural: `${image.naturalWidth}x${image.naturalHeight}`, file: vm.currentSource.file, crop: vm.crop, zoom: vm.zoom };
    });
    const waitIdle = () => page.waitForFunction(() => {
      let component = document.querySelector('.studio').__vueParentComponent;
      while (component && !component.proxy?.workspace) component = component.parent;
      return !component.proxy.busy;
    });
    await waitIdle();
    const beforeRotate = await sourceView();
    for (let click = 0; click < 4; click++) { await tapButton('旋转'); await waitIdle(); }
    const afterRotate = await sourceView();
    assert.deepEqual({ width: beforeRotate.width, height: beforeRotate.height, natural: beforeRotate.natural }, { width: 900, height: 1200, natural: '900x1200' }, 'source starts portrait before rotation');
    assert.deepEqual({ width: afterRotate.width, height: afterRotate.height, natural: afterRotate.natural, crop: afterRotate.crop, zoom: afterRotate.zoom }, { width: 900, height: 1200, natural: '900x1200', crop: null, zoom: 100 }, 'four clockwise rotations restore the orientation and reset the cut');
    assert.notEqual(afterRotate.file, beforeRotate.file, 'rotation stores a new working file');
    // Official material library: pick a group first, then a piece, mirroring the color picker.
    await page.evaluate(() => {
      const canvas = document.createElement('canvas'); canvas.width = 900; canvas.height = 1200;
      window.collageTestImage = canvas.toDataURL('image/png');
      const vm = window.collageTestVm();
      const library = vm.officialLibraries.paper;
      library.groups = [
        { id: 'g1', name: '测试分组', materials: [
          { id: 'm1', name: '官方纸片一', url: window.collageTestImage },
          { id: 'm2', name: '官方纸片二', url: window.collageTestImage },
          { id: 'm3', name: '官方纸片三', url: window.collageTestImage }
        ] },
        { id: 'g2', name: '空分组', materials: [] }
      ];
      library.loaded = true; library.loading = false; library.error = '';
      vm.openOfficialPicker('paper');
    });
    await page.waitForSelector('.official-picker .group-card');
    // Wait out the sheet enter animation so taps use the final card positions.
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 350)));
    const groupStep = await page.$$eval('.official-picker .group-card', cards => cards.map(card => ({
      name: card.querySelector('.group-name').textContent.trim(),
      count: card.querySelector('.group-count').textContent.trim(),
      empty: !!card.querySelector('.group-empty')
    })));
    assert.deepEqual(groupStep, [
      { name: '测试分组', count: '3 个素材', empty: false },
      { name: '空分组', count: '0 个素材', empty: true }
    ], 'official picker lists groups with material counts');
    assert.equal(await page.$$eval('.official-picker .group-card:first-child .group-preview uni-image', images => images.length), 3, 'group card previews several pieces of the group in one row');
    await (await page.$$('.official-picker .group-card'))[0].tap();
    await page.waitForSelector('.official-picker .material-card');
    assert.equal(await page.$$eval('.official-picker .material-name', names => names.map(name => name.textContent.trim()).join()), '官方纸片一,官方纸片二,官方纸片三', 'material step lists the selected group pieces');
    await (await page.$('.official-picker .picker-back')).tap();
    await page.waitForSelector('.official-picker .group-card');
    await (await page.$$('.official-picker .group-card'))[0].tap();
    await page.waitForSelector('.official-picker .material-card');
    await (await page.$('.official-picker .material-card')).tap();
    await page.waitForFunction(() => {
      const vm = window.collageTestVm();
      return !vm.busy && vm.workspace.materials.some(material => material.officialId === 'm1');
    });
    const officialImport = await page.evaluate(() => {
      const vm = window.collageTestVm();
      const material = vm.workspace.materials.find(item => item.officialId === 'm1');
      return { name: material.name, mode: material.mode, url: !!vm.urls[material.id], boardItems: vm.workspace.items.length, activeTab: vm.activeTab };
    });
    assert.deepEqual(officialImport, { name: '官方纸片一', mode: 'official', url: true, boardItems: 3, activeTab: 'board' }, 'official piece is stored locally and added to the board');
    // Background pieces are 4:3 (height:width); their picker keeps that frame and lists several per group.
    await page.evaluate(() => {
      const vm = window.collageTestVm();
      const library = vm.officialLibraries.background;
      library.groups = [{ id: 'bg1', name: '背景分组', materials: [
        { id: 'b1', name: '背景一', url: window.collageTestImage },
        { id: 'b2', name: '背景二', url: window.collageTestImage }
      ] }];
      library.loaded = true; library.loading = false; library.error = '';
      vm.openOfficialPicker('background');
    });
    await page.waitForSelector('.official-picker.portrait .group-card');
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 350)));
    const backgroundGroupStep = await page.$$eval('.official-picker.portrait .group-preview uni-image', images => images.map(image => {
      const rect = image.getBoundingClientRect();
      return { ratio: rect.height / rect.width };
    }));
    assert.equal(backgroundGroupStep.length, 2, 'background group previews several backgrounds in one row');
    for (const preview of backgroundGroupStep) assert.ok(Math.abs(preview.ratio - 4 / 3) < 0.05, `background group preview keeps the 4:3 frame: ${preview.ratio}`);
    await (await page.$('.official-picker.portrait .group-card')).tap();
    await page.waitForSelector('.official-picker.portrait .material-card');
    const backgroundMaterials = await page.$$eval('.official-picker.portrait .material-card', cards => cards.map(card => {
      const image = card.querySelector('.material-image').getBoundingClientRect();
      return { top: Math.round(card.getBoundingClientRect().top), ratio: image.height / image.width };
    }));
    assert.equal(backgroundMaterials.length, 2, 'background step lists both backgrounds of the group');
    assert.equal(backgroundMaterials[0].top, backgroundMaterials[1].top, 'background thumbnails stay two per row');
    for (const card of backgroundMaterials) assert.ok(Math.abs(card.ratio - 4 / 3) < 0.05, `background thumbnail keeps the 4:3 frame: ${card.ratio}`);
    await page.evaluate(() => window.collageTestVm().closeOfficialPicker());
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 300)));
    assert.equal(errors.length, 0, errors.join('\n'));
    console.log('[test-collage-browser] PASS: actual import/delete buttons, live slider zoom, two-finger anchored zoom/pan/limits/cancellation, crop-to-pinch transitions and remaining-finger suppression, mouse/touch crop and stable release, corner resizing, exact crop size, original pixels, transparent torn PNG, OCR tap-to-deselect single/range/whole-line/overlapping selections, library, official material group/material picker with multi-piece group previews and portrait background frames, transforms, history, download, publish handoff, deletion and persisted bitmap reload; external requests blocked');
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
