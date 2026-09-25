const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

module.exports = async ({ memoryDb, createService, createStore, hash }) => {
  const identity = 'tcb:cleanup-user', owner = hash(identity).slice(0, 32);
  const prefix = `collage-ocr/${owner}/`;
  const db = memoryDb(), store = createStore(db), files = new Map();
  let paidCalls = 0, failCleanup = false, resolveOcr, ocrStarted;
  const dependencies = {
    enabled: true, store, limit: 1000, dimensions: () => ({ width: 800, height: 1000 }),
    fileForPath: async cloudPath => `cloud://test.bucket/${cloudPath}`,
    download: async fileID => { if (!files.has(fileID)) throw new Error('NOT_FOUND'); return files.get(fileID); },
    cleanup: async fileID => { if (failCleanup) throw new Error('PARTIAL_DELETE_FAILED'); files.delete(fileID); },
    recognize: async () => { paidCalls++; if (ocrStarted) { ocrStarted(); return new Promise(resolve => { resolveOcr = resolve; }); } return { TextDetections: [] }; }
  };
  const service = createService(dependencies), disabled = createService({ ...dependencies, enabled: false });
  const prepare = async (sourceId, bytes = 'identical image') => {
    const result = await service({ action: 'prepare', sourceId }, identity);
    assert.equal(result.success, true); files.set(result.fileID, Buffer.from(bytes));
    return { action: 'recognize', sourceId, fileID: result.fileID, token: result.token, width: 800, height: 1000 };
  };
  const remove = (sourceId, server = disabled) => server({ action: 'delete', sourceId, uploadPrefix: prefix }, identity);
  const cacheRecords = () => [...db.records.entries()].filter(([key]) => key.startsWith('collage_ocr_cache/'));
  const a = await prepare('a'); assert.equal((await service(a, identity)).success, true);
  const b = await prepare('b'); assert.equal((await service(b, identity)).cached, true);
  assert.equal(paidCalls, 1, 'same content shares OCR cache across source thumbnails');
  const counters = [...db.records.entries()].filter(([key]) => key.startsWith('collage_ocr_usage/'));
  assert.equal((await disabled({ action: 'delete', sourceId: 'a', uploadPrefix: prefix }, 'tcb:other-user')).success, false);
  assert.equal((await disabled({ action: 'delete', sourceId: 'a' }, '')).success, false);
  assert.equal((await remove('a')).success, true, 'cleanup remains available with paid OCR disabled');
  assert.equal(cacheRecords().length, 2, 'other thumbnail keeps its source link and shared cache');
  failCleanup = true;
  assert.equal((await remove('b')).success, false);
  assert.equal(cacheRecords().length, 2, 'file cleanup failure preserves retry metadata');
  failCleanup = false;
  assert.equal((await remove('b')).success, true);
  assert.equal(cacheRecords().length, 0, 'last source deletion removes OCR data and source index');
  assert.equal((await remove('b')).success, true, 'repeat deletion is idempotent');
  for (const [key, value] of counters) assert.deepEqual(db.records.get(key), value, 'deletion never refunds consumed OCR quota');

  const waiting = new Promise(resolve => { ocrStarted = resolve; });
  const c = await prepare('c', 'third image');
  const inFlight = service(c, identity); await waiting;
  assert.equal((await remove('c')).success, true);
  resolveOcr({ TextDetections: [] });
  assert.equal((await inFlight).success, false, 'late recognition cannot recreate deleted records');
  assert.equal(cacheRecords().length, 0);
  assert.equal((await service(c, identity)).success, false, 'stale upload token cannot recreate a deleted source');
  ocrStarted = null;

  const legacyImage = Buffer.from('legacy image'), legacyKey = hash(`${owner}:${hash(legacyImage)}:tencent-accurate-v1`);
  db.records.set(`collage_ocr_cache/${legacyKey}`, { owner, state: 'done', data: { lines: [] } });
  const legacy = await disabled({ action: 'prepare', sourceId: 'legacy', cleanupOnly: true }, identity);
  files.set(legacy.fileID, legacyImage);
  const beforeLegacy = paidCalls;
  assert.equal((await remove('legacy')).success, true);
  assert.equal(cacheRecords().length, 0);
  assert.equal(files.size, 0);
  assert.equal(paidCalls, beforeLegacy, 'legacy cleanup does not invoke paid OCR');

  // Run the actual frontend module with external calls stubbed at its boundary.
  const raw = fs.readFileSync(path.join(__dirname, '../api-cache/collage-ocr.js'), 'utf8');
  const code = raw.replace(/^import .*;\r?\n/gm, '') + '\nreturn { recognizeCollageSource, deleteCollageSource };';
  const calls = [], api = new Function('cloudCall', 'uploadFile', 'readFileAsBase64', code.replace(/export /g, ''))(
    async (_name, event) => {
      calls.push(event.action);
      return { result: await service(event, identity) };
    },
    async cloudPath => { calls.push('upload'); const fileID = `cloud://test.bucket/${cloudPath}`; files.set(fileID, Buffer.from('client image')); return fileID; },
    async () => 'base64'
  );
  const source = { id: 'frontend', width: 800, height: 1000 }, context = { persist: () => { calls.push('persist'); return true; } };
  source.ocr = await api.recognizeCollageSource(source, 'local.jpg', context);
  assert.deepEqual(calls.slice(0, 6), ['status', 'persist', 'prepare', 'persist', 'upload', 'recognize']);
  failCleanup = true;
  await assert.rejects(api.deleteCollageSource(source, 'local.jpg', context), /清理未完成/);
  assert.ok(source.cloudRef, 'frontend keeps cloud reference after cleanup failure');
  failCleanup = false; await api.deleteCollageSource(source, 'local.jpg', context);
  assert.equal(cacheRecords().length, 0);
  calls.length = 0;
  await api.deleteCollageSource({ id: 'manual-only' }, 'local.jpg', context);
  assert.equal(calls.length, 0, 'manual-only originals delete offline without cloud calls');
  calls.length = 0;
  await assert.rejects(api.recognizeCollageSource({ id: 'no-space' }, 'local.jpg', { persist: () => false }), /存储空间/);
  assert.deepEqual(calls, ['status'], 'no cloud writes if local cleanup intent cannot be persisted');
};
