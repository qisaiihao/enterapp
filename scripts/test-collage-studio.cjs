const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createService, normalizeTencent, hash } = require('../functions/collageOcr/core');
const { createStore } = require('../functions/collageOcr/store');

function memoryDb() {
  const records = new Map(); let queue = Promise.resolve();
  const db = {
    records,
    collection(name) { return { doc(id) {
      const key = `${name}/${id}`;
      return {
        get: async () => ({ data: records.has(key) ? structuredClone(records.get(key)) : null }),
        set: async value => { records.set(key, structuredClone(value)); return {}; },
        update: async value => { records.set(key, { ...records.get(key), ...structuredClone(value) }); return {}; },
        remove: async () => { records.delete(key); return {}; }
      };
    } }; },
    runTransaction(fn) { const run = queue.then(() => fn(db)); queue = run.catch(() => {}); return run; }
  };
  return db;
}

async function main() {
  await require('./test-collage-paper.cjs')();
  const code = fs.readFileSync(path.join(__dirname, '../utils/collage/geometry.js'), 'utf8');
  const geometry = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
  assert.deepEqual(geometry.fitSize(4000, 2000), { width: 2560, height: 1280 });
  assert.deepEqual(geometry.orientedSize(4000, 2000, 'up'), { width: 4000, height: 2000 });
  assert.deepEqual(geometry.orientedSize(4000, 2000, 'down'), { width: 4000, height: 2000 });
  assert.deepEqual(geometry.orientedSize(4000, 2000, undefined), { width: 4000, height: 2000 });
  for (const orientation of ['left', 'left-mirrored', 'right', 'right-mirrored']) {
    assert.deepEqual(geometry.orientedSize(4000, 2000, orientation), { width: 2000, height: 4000 }, `${orientation} swaps the working image axes`);
  }
  assert.deepEqual(geometry.clipRect({ x: 5, y: 4, width: 20, height: 12 }, 25, 20, 10), { x: 0, y: 0, width: 25, height: 20 });
  assert.deepEqual(geometry.dragRect({ x: 90, y: 80 }, { x: -10, y: 30 }, 100, 100), { x: 0, y: 30, width: 90, height: 50 });
  const coord = (x, y, w, h) => [{ X: x, Y: y }, { X: x + w, Y: y }, { X: x + w, Y: y + h }, { X: x, Y: y + h }];
  const response = { TextDetections: [{ DetectedText: '山谷', Confidence: 98, Polygon: coord(10, 20, 60, 30), ItemPolygon: { X: 0, Y: 0, Width: 500, Height: 500 }, Words: [{ Character: '山' }, { Character: '谷' }], WordCoordPoint: [{ WordCoordinate: coord(10, 20, 25, 30) }, { WordCoordinate: coord(40, 20, 30, 30) }] }] };
  const normalized = normalizeTencent(response);
  const regionCode = fs.readFileSync(path.join(__dirname, '../utils/collage/ocrRegion.js'), 'utf8');
  const { placeRegionOcr, ocrRegionKey } = await import(`data:text/javascript;base64,${Buffer.from(regionCode).toString('base64')}`);
  const region = { x: 120, y: 180, width: 400, height: 250 };
  const placed = placeRegionOcr(normalized, region, { width: 900, height: 1200 });
  assert.deepEqual(geometry.selectionRect(placed.lines[0], 1, 1), { x: 160, y: 200, width: 30, height: 30 });
  assert.deepEqual(geometry.selectionRect(normalized.lines[0], 1, 1), { x: 40, y: 20, width: 30, height: 30 }, 'placing region does not mutate provider coordinates');
  assert.equal(ocrRegionKey(null), 'full');
  assert.notEqual(ocrRegionKey(region), ocrRegionKey({ ...region, x: 121 }));
  assert.deepEqual(geometry.selectionRect(normalized.lines[0], 1, 0), { x: 10, y: 20, width: 60, height: 30 });
  assert.deepEqual(geometry.selectionRect(normalized.lines[0], 1, 1), { x: 40, y: 20, width: 30, height: 30 });
  const missing = structuredClone(response); missing.TextDetections[0].WordCoordPoint[1] = {};
  assert.equal(geometry.selectionRect(normalizeTencent(missing).lines[0], 0, 1), null);
  assert.equal(geometry.selectionRect(placeRegionOcr(normalizeTencent(missing), region, { width: 900, height: 1200 }).lines[0], 0, 1), null, 'region mapping preserves unavailable character coordinates');
  const mismatch = structuredClone(response); mismatch.TextDetections[0].Words[1].Character = '口';
  assert.equal(normalizeTencent(mismatch).lines[0].chars.length, 0);
  for (const style of ['straight', 'scissors', 'torn']) {
    const points = geometry.edgePath(90, 30, style, 123);
    assert.deepEqual(points, geometry.edgePath(90, 30, style, 123));
    assert.ok(points.every(([x, y]) => x >= 0 && x <= 90 && y >= 0 && y <= 30));
  }
  const identity = 'tcb:test-user', prefix = `collage-ocr/${hash(identity).slice(0, 32)}/`;
  let calls = 0, downloaded = 0, cleaned = 0, clock = Date.parse('2026-09-23T00:00:00Z');
  const db = memoryDb();
  const dependencies = {
    enabled: true, store: createStore(db), limit: 2, dailyLimit: 20, now: () => clock,
    fileForPath: async cloudPath => `cloud://test.bucket/${cloudPath}`,
    dimensions: () => ({ width: 800, height: 1000 }),
    download: async fileID => { downloaded++; return Buffer.from(fileID); },
    cleanup: async () => { cleaned++; },
    recognize: async () => { calls++; return response; }
  };
  const service = createService(dependencies);
  const prepared = {};
  for (const n of [1, 2, 3]) prepared[n] = await service({ action: 'prepare', sourceId: `source-${n}` }, identity);
  const event = n => ({ action: 'recognize', sourceId: `source-${n}`, token: prepared[n].token, fileID: `cloud://test.bucket/${prefix}source-${n}.jpg`, width: 800, height: 1000 });
  assert.equal((await service(event(1), '')).success, false);
  assert.equal((await service({ ...event(1), fileID: 'https://example.com/photo.jpg' }, identity)).success, false);
  assert.equal((await service(event(1), 'tcb:someone-else')).success, false);
  assert.equal(downloaded, 0);
  const disabled = createService({ ...dependencies, enabled: false });
  assert.equal((await disabled({ action: 'status' }, identity)).enabled, false);
  assert.equal((await disabled(event(1), identity)).success, false);
  assert.equal(calls, 0);
  assert.equal((await service({ ...event(1), width: 123 }, identity)).success, false);
  assert.equal(calls, 0);
  const first = await service(event(1), identity);
  assert.equal(first.success, true);
  assert.equal((await service(event(1), identity)).cached, true);
  assert.equal(calls, 1);
  const concurrent = await Promise.all([service(event(2), identity), service(event(2), identity), service(event(3), identity)]);
  assert.equal(calls, 2, 'concurrent requests must never exceed the monthly cap');
  assert.ok(concurrent.some(r => !r.success));
  assert.equal((await service(event(1), identity)).cached, true, 'cached results remain available at quota limit');
  clock = Date.parse('2026-09-30T16:01:00Z');
  assert.equal((await service(event(3), identity)).success, true, 'quota resets at midnight China time');
  assert.equal(calls, 3);
  assert.ok(cleaned > calls);
  const failureDb = memoryDb(); let failures = 0;
  const failureService = createService({ ...dependencies, store: createStore(failureDb), recognize: async () => { failures++; const err = new Error('secret internal message'); err.code = 'ResourceUnavailable.InArrears'; throw err; } });
  const failedPrepare = await failureService({ action: 'prepare', sourceId: 'source-1' }, identity);
  const failedEvent = { ...event(1), token: failedPrepare.token };
  assert.match((await failureService(failedEvent, identity)).message, /额度/);
  await failureService(failedEvent, identity);
  assert.equal(failures, 1, 'do not retry a possibly billable failure immediately');
  assert.equal(failureDb.records.get('collage_ocr_usage/month-2026-10').count, 1, 'failed attempts remain counted conservatively');
  const quotaDb = memoryDb(), quotaStore = createStore(quotaDb);
  const requests = await Promise.all(Array.from({ length: 25 }, (_, i) => quotaStore.reserve({ key: `key${i}`, owner: 'owner', month: '2026-10', day: '2026-10-01', time: clock, limit: 1000, dailyLimit: 3 })));
  assert.equal(requests.filter(r => !r.message).length, 3);
  assert.equal(quotaDb.records.get('collage_ocr_usage/month-2026-10').count, 3);
  await require('./test-collage-cleanup.cjs')({ memoryDb, createService, createStore, hash });
  console.log('[test-collage-studio] PASS: coordinates, missing character fallback, edges, auth, disabled mode, deduplication, concurrent monthly/daily limits, China month rollover and failure cooldown');
}
module.exports = { memoryDb };
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
