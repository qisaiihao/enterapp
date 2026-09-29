const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const cloudSdk = require('wx-server-sdk');
const { memoryDb } = require('./helpers/posts-memory-db.cjs');
const root = path.resolve(__dirname, '..');
cloudSdk.init({ env: 'image-link-test' });
const command = cloudSdk.database().command;
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const quiet = { log() {}, warn() {}, error() {} };
const sourceId = 'cloud://test/shared.png';

function backend(name) {
  let conversions = 0;
  const common = { _openid: 'author', auditStatus: 'approved', createTime: new Date(),
    imageUrls: [sourceId], originalImageUrls: [sourceId], authorAvatar: sourceId,
    authorSignature: sourceId, poemBgImage: sourceId, isOriginal: true, votes: 10, tags: ['test'] };
  const mem = memoryDb({ posts: [{ ...common, _id: 'poem', isPoem: true }, { ...common, _id: 'discussion', isDiscussion: true }],
    users: [{ _id: 'author-user', _openid: 'author', avatarUrl: sourceId, signatureUrl: sourceId, nickName: 'Author' }],
    follows: [{ _id: 'follow', followerId: 'viewer', followedId: 'author' }],
    votes_log: [], api_rate_limits: [] }, command);
  // This suite verifies media handling, not ranking/lookup (covered by the posts suites).
  // Supply the post-aggregation rows for endpoints whose lookups exceed memoryDb's operators.
  if (name !== 'getPostList' && name !== 'getFollowingPosts') {
    const collection = mem.db.collection.bind(mem.db);
    mem.db.collection = table => {
      const query = collection(table);
      query.aggregate = () => {
        const rows = table === 'posts' ? [{ ...common, _id: 'poem', isPoem: true, authorName: 'Author', userVote: [] }] : [];
        const aggregate = new Proxy({}, { get(_, method) {
          if (method === 'end') return async () => ({ list: structuredClone(rows) });
          return () => aggregate;
        } });
        return aggregate;
      };
      return query;
    };
  }
  const cloud = { init() {}, database: () => mem.db, getWXContext: () => ({ OPENID: 'viewer' }),
    async getTempFileURL({ fileList }) { conversions++; return { fileList: fileList.map(fileID => ({ fileID, status: 0, tempFileURL: 'https://server.example/image.png' })) }; } };
  const exports = {};
  vm.runInNewContext(read(`functions/${name}/index.js`), { exports, console: quiet, require(id) {
    if (id === 'wx-server-sdk') return cloud;
    if (id.includes('get-blocked-user-ids')) return async () => [];
    if (id === './_lib/posts') return require('../functions/_shared/posts');
    throw new Error(id);
  } }, { filename: name });
  return { run: exports.main, count: () => conversions };
}

function esModule(file, globals, names) {
  const source = read(file).replace(/^import .*;\r?$/gm, '').replace(/export /g, '');
  const context = { ...globals, console: quiet };
  vm.runInNewContext(source + `\nthis.api = { ${names.join(',')} };`, context, { filename: file });
  return context.api;
}

(async () => {
  const names = ['getPostList', 'getHotFeed', 'getFollowingPosts', 'getDiscussionPosts', 'getRecommendationFeed'];
  for (const name of names) {
    const b = backend(name);
    for (const rawImages of [undefined, true, false]) {
      const before = b.count();
      const result = await b.run({ limit: 10, ...(rawImages === undefined ? {} : { rawImages }) }, {});
      assert.equal(result.success, true, `${name}: ${JSON.stringify(result)}`);
      assert.ok(result.posts.length, `${name} fixture reaches the image branch`);
      assert.equal(result.posts[0].authorAvatar, rawImages === true ? sourceId : 'https://server.example/image.png', name);
      assert.equal(b.count() > before, rawImages !== true, `${name}: raw mode skips server conversion; 1.7.0 remains compatible`);
    }
  }

  // Real file cache: concurrent endpoint responses share a batch, subsequent reads reuse links.
  const managerSource = read('cache/core/manager.js').replace(/export \{[^}]*\};?/g, '').replace('export default singleton;', 'this.manager = singleton;');
  const box = { console: quiet, setTimeout, clearTimeout }; vm.runInNewContext(managerSource, box);
  const fileSource = read('cache/core/file-url.js').replace(/^import .*;\r?$/gm, '').replace(/export \{[^}]*\};?/g, '').replace(/export default ([^;]+);/, 'this.urls = $1;');
  const fileBox = { cacheManager: box.manager, console: quiet, setTimeout, clearTimeout };
  vm.runInNewContext(fileSource, fileBox);
  const urls = fileBox.urls; urls.setBatchDelay(0);
  let batches = 0, generation = 1;
  urls.setResolver(async ids => { batches++; return Object.fromEntries(ids.map(id => [id, { url: `https://client.example/${generation}/${id.split('/').pop()}` }])); });
  const hydrate = esModule('cache/core/hydrate.js', { fileUrlCache: urls }, ['hydrateTempUrls', 'warmTempUrlsFromPosts']);
  const protocol = esModule('utils/cloudPostImages.js', hydrate, ['prepareCloudPostImages', 'resolveCloudPostImages']);
  const image = () => ({ imageUrls: [sourceId, 'https://public.example/a.png'], authorAvatar: sourceId, authorSignature: sourceId });
  const first = { result: { success: true, posts: [image()] } };
  const second = { result: { success: true, posts: [image()] } };
  await Promise.all([protocol.resolveCloudPostImages('getPostList', first), protocol.resolveCloudPostImages('getHotFeed', second)]);
  assert.equal(batches, 1);
  await hydrate.hydrateTempUrls(first.result.posts); assert.equal(batches, 1);
  assert.equal(first.result.posts[0].imageUrls[1], 'https://public.example/a.png');
  generation = 2; urls.invalidate(sourceId);
  const persisted = JSON.parse(JSON.stringify(first.result.posts));
  await hydrate.hydrateTempUrls(persisted);
  assert.equal(batches, 2);
  assert.equal(persisted[0].authorAvatar, 'https://client.example/2/shared.png', 'persisted/cloned posts retain source IDs for renewal');
  persisted[0].authorAvatar = 'https://new.example/avatar.png';
  await hydrate.hydrateTempUrls(persisted);
  assert.equal(persisted[0].authorAvatar, 'https://new.example/avatar.png', 'changed images never revert to saved sources');
  await hydrate.hydrateTempUrls([null, {}, undefined]);
  const request = {}; protocol.prepareCloudPostImages('getPostList', request); assert.equal(request.rawImages, true);
  const rollback = { rawImages: false }; protocol.prepareCloudPostImages('getPostList', rollback); assert.equal(rollback.rawImages, false);
  const unrelated = {}; protocol.prepareCloudPostImages('getFontFile', unrelated); assert.equal(unrelated.rawImages, undefined);
  const clientBox = { ...protocol, console: quiet, auth: { getOpenId: async () => 'viewer' },
    getCloudFunctionMethod: () => 'tcb', formatErrorForLog: error => error.message };
  const clientSource = read('utils/cloudCall.js').replace(/^import .*;\r?$/gm, '')
    .replace('export async function cloudCall', 'async function cloudCall').replace('export default', 'const helpers =');
  vm.runInNewContext(clientSource + '\nthis.call = cloudCall;', clientBox);
  let sent;
  const input = { limit: 10 };
  const response = await clientBox.call('getPostList', input, { context: { $tcb: { __skipAuth: true,
    async callFunction(options) { sent = options; return { result: { success: true, posts: [image()] } }; }
  } } });
  assert.equal(sent.data.rawImages, true);
  assert.equal(input.rawImages, undefined, 'caller input remains unchanged');
  assert.equal(response.result.posts[0].authorAvatar, 'https://client.example/2/shared.png', 'cloudCall resolves before passing data to pages');
  console.log('[test-post-image-links] PASS: five real endpoints, 1.7.0 HTTPS compatibility, raw opt-in, shared batches, reuse, source preservation/renewal and changed images');
})().catch(error => { console.error(error); process.exitCode = 1; });
