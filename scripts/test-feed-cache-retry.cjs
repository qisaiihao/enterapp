const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const quiet = { log() {}, warn() {}, error() {} };
function manager() {
  const box = { console: quiet };
  vm.runInNewContext(read('cache/core/manager.js').replace(/export \{[^}]*\};?/g, '').replace('export default singleton;', 'this.cache = singleton;'), box);
  return box.cache;
}
function load(file, globals, name) {
  const box = { console: quiet, ...globals };
  vm.runInNewContext(read(file).replace(/^import .*;\r?$/gm, '').replace(/export /g, '') + `\nthis.run = ${name};`, box);
  return box.run;
}
(async () => {
  for (const [file, name, options] of [
    ['home-posts', 'getHomePosts', {}], ['tag-posts', 'getTagPosts', { tag: 'test' }],
    ['discussion', 'getDiscussionPosts', {}], ['discover', 'getDiscoverFeed', {}]
  ]) {
    let requests = 0;
    const run = load(`api-cache/${file}.js`, { cacheManager: manager(), buildCacheKey: () => 'page:0',
      withTimeout: value => value,
      async cloudCall() { requests++; return { result: requests === 1 ? { success: false, message: 'temporary failure' } : { success: true, posts: [{ _id: 'ok' }], hasMore: true } }; }
    }, name);
    await assert.rejects(run(options), /temporary failure/);
    await run(options); await run(options);
    assert.equal(requests, 2, `${file}: failure is retryable; success is cached`);
  }
  const cache = manager(); const resolve = [];
  const list = load('api-cache/post-list.js', { cacheManager: cache, buildCacheKey: () => 'page:0', withTimeout: value => value,
    callCloudAndUnwrap: () => new Promise(done => resolve.push(done))
  }, 'getPostList');
  const old = list({ forceRefresh: true }); await Promise.resolve();
  const fresh = list({ forceRefresh: true }); await Promise.resolve();
  resolve[1]({ posts: [{ _id: 'new' }] }); await fresh;
  resolve[0]({ posts: [{ _id: 'old' }] }); await old;
  assert.equal((await list({}))[0]._id, 'new', 'late forced refresh cannot overwrite the newer result');
  assert.equal(resolve.length, 2);
  console.log('[test-feed-cache-retry] PASS: four feed failures retry, successes cache, forced-refresh stale write prevented');
})().catch(error => { console.error(error); process.exitCode = 1; });
