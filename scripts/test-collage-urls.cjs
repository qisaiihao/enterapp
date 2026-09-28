const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function load(file, globals, exports, platform = 'H5') {
  let source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  source = source.replace(platform === 'H5'
    ? /\/\/ #ifndef H5[\s\S]*?\/\/ #endif/g
    : /\/\/ #ifdef H5[\s\S]*?\/\/ #endif/g, '');
  source = source.replace(/^import .*;\r?\n/gm, '')
    .replace(/^export default .*;\r?$/gm, '')
    .replace(/^export /gm, '');
  const context = { module: { exports: {} }, setTimeout, clearTimeout, ...globals };
  vm.runInNewContext(`${source}\nmodule.exports = { ${exports} };`, context, { filename: file });
  return context.module.exports;
}

function makeCache(globals = {}) {
  const { FileUrlCache } = load('cache/core/file-url.js', {
    cacheManager: { namespace: () => null }, ...globals
  }, 'FileUrlCache');
  const cache = new FileUrlCache();
  cache.setBatchDelay(60_000); // Tests explicitly flush each batch without sleeps.
  return cache;
}
const fileIDs = Array.from({ length: 101 }, (_, i) => `cloud://env.bucket/background/${i}.jpg`);
const urlFor = id => `https://example.com/${id.split('/').pop()}`;
const records = ids => Object.fromEntries(ids.map(id => [id, { url: urlFor(id) }]));
const sdkResponse = ids => ({ fileList: ids.map(fileID => ({ fileID, tempFileURL: urlFor(fileID) })) });
const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};

async function testBatching() {
  for (const mode of ['injected', 'tcb', 'wx']) {
    const batches = [];
    const getTempFileURL = async ({ fileList }) => {
      assert.ok(fileList.length <= 50, 'SDK rejects more than 50 IDs');
      batches.push(fileList.length);
      return sdkResponse(fileList);
    };
    const cache = makeCache(mode === 'tcb' ? { getApp: () => ({ $tcb: { getTempFileURL } }) }
      : mode === 'wx' ? { wx: { cloud: { getTempFileURL } } } : {});
    if (mode === 'injected') cache.setResolver(async ids => {
      await getTempFileURL({ fileList: ids });
      return records(ids);
    });
    const direct = 'https://example.com/direct.jpg';
    const pending = cache.getTempUrls([...fileIDs, fileIDs[0], direct]);
    await cache._flush();
    const result = await pending;
    assert.deepEqual(batches, [50, 50, 1], `${mode}: 101 unique files must all resolve`);
    for (const id of fileIDs) assert.equal(result[id], urlFor(id));
    assert.equal(result[direct], direct);
    await cache.getTempUrls(fileIDs);
    assert.equal(batches.length, 3, 'resolved files reuse cache');
  }
}

async function testFailureRetry() {
  const cache = makeCache();
  let batch = 0;
  cache.setResolver(async ids => {
    if (++batch === 2) throw new Error('temporary SDK failure');
    return records(ids);
  });
  cache._cache.set(fileIDs[50], { url: 'https://example.com/expired.jpg', expireAt: 1 });
  const first = cache.getTempUrls(fileIDs);
  await cache._flush();
  const partial = await first;
  assert.equal(Object.keys(partial).length, 51, 'failure retains other successful batches');
  assert.equal(partial[fileIDs[50]], undefined, 'expired entry must not hide resolution failure');
  cache.setResolver(async ids => {
    assert.equal(ids.length, 50, 'retry only requests unresolved IDs');
    return records(ids);
  });
  const retry = cache.getTempUrls(fileIDs);
  await cache._flush();
  assert.equal(Object.keys(await retry).length, 101);
}

async function testConcurrentRequests() {
  const cache = makeCache();
  const gates = [deferred(), deferred()];
  let calls = 0;
  cache.setResolver(ids => {
    const gate = gates[calls++];
    return gate.promise.then(() => records(ids));
  });
  const first = cache.getTempUrls([fileIDs[0]]);
  const flushFirst = cache._flush();
  let secondSettled = false;
  const second = cache.getTempUrls([fileIDs[1]]).then(result => {
    secondSettled = true;
    return result;
  });
  gates[0].resolve();
  await flushFirst;
  assert.equal((await first)[fileIDs[0]], urlFor(fileIDs[0]));
  assert.equal(secondSettled, false, 'in-flight flush must not consume later waiters');
  const flushSecond = cache._flush();
  gates[1].resolve();
  await flushSecond;
  assert.equal((await second)[fileIDs[1]], urlFor(fileIDs[1]));
}

async function testLibrary() {
  const cache = makeCache();
  const materials = fileIDs.map((fileID, i) => ({ id: `${i}`, fileID, name: `背景 ${i}` }));
  let fetches = 0;
  const api = load('api-cache/collage-materials.js', {
    fileUrlCache: cache,
    callCloudAndUnwrap: async () => {
      fetches++;
      return { groups: [{ id: 'g1', name: '背景', materials }] };
    }
  }, 'getOfficialMaterials');
  cache.setResolver(async () => ({}));
  const failed = api.getOfficialMaterials({ type: 'background' });
  const rejection = assert.rejects(failed, /素材地址解析失败/);
  await new Promise(setImmediate); // Let the cloud function continuation enqueue file IDs.
  await cache._flush();
  await rejection;
  cache.setResolver(async ids => records(ids));
  const retry = api.getOfficialMaterials({ type: 'background' });
  await new Promise(setImmediate);
  await cache._flush();
  const groups = await retry;
  assert.equal(fetches, 2, 'failed material lists must not be cached');
  assert.equal(groups[0].materials.length, 101);
  assert.ok(groups[0].materials.every(item => item.url.startsWith('https://')));
  assert.equal(await api.getOfficialMaterials({ type: 'background' }), groups);
  assert.equal(fetches, 2);
}

async function testImport() {
  for (const platform of ['H5', 'native']) {
    let resolved = urlFor(fileIDs[0]);
    const downloads = [];
    const persisted = [];
    const { importOfficialImage } = load('utils/collage/official.js', {
      createCollageLogger: () => ({ info() {}, warn() {}, error() {} }),
      fileUrlCache: { getTempUrls: async ids => ({ [ids[0]]: resolved }) },
      persistFile: async url => { persisted.push(url); return 'idb:test'; },
      resolveFile: async () => 'blob:local',
      imageInfo: async () => ({ width: 900, height: 1200 }),
      displaySize: size => size,
      uni: { downloadFile: ({ url, success }) => {
        downloads.push(url);
        success({ statusCode: 200, tempFilePath: '/local/image.jpg' });
      } }
    }, 'importOfficialImage', platform);
    for (const material of [{ url: fileIDs[0] }, { fileID: fileIDs[0] }, { url: resolved }]) {
      const image = await importOfficialImage(material);
      assert.equal(image.width, 900);
      assert.equal(image.height, 1200);
    }
    assert.equal(persisted.length, 3);
    assert.ok((platform === 'H5' ? persisted : downloads).every(url => url === resolved));
    for (const invalid of [undefined, fileIDs[0]]) {
      resolved = invalid;
      await assert.rejects(importOfficialImage({ url: fileIDs[0] }), /素材地址解析失败/);
    }
    assert.equal(persisted.length, 3, 'failed URLs must never reach storage');
    assert.equal(downloads.length, platform === 'H5' ? 0 : 3);
  }
}

async function main() {
  await testBatching();
  await testFailureRetry();
  await testConcurrentRequests();
  await testLibrary();
  await testImport();
  console.log('[test-collage-urls] PASS: 101 files across all resolvers, partial failure/retry, concurrent waiters, library cache and H5/native imports');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
