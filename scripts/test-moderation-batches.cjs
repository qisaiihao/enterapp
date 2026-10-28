const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const cloudSdk = require('wx-server-sdk');
const { memoryDb } = require('./helpers/posts-memory-db.cjs');

const root = path.resolve(__dirname, '..');
const functionRoot = path.resolve(process.env.MODERATION_TEST_FUNCTION_ROOT || path.join(root, 'functions'));
const filename = path.join(functionRoot, 'contentCheck', 'index.js');
const moderationModule = require(path.join(functionRoot, 'contentCheck', 'moderation'));
const localRequire = createRequire(filename);
const source = fs.readFileSync(filename, 'utf8');
const quiet = { log() {}, warn() {}, error() {} };
const images = Array.from({ length: 9 }, (_, index) => `https://example.com/moderation/${index + 1}.jpg`);
cloudSdk.init({ env: 'moderation-batches-test' });
const command = cloudSdk.database().command;

function runtime({ mode = 'enforce', user = false, blockedImage = '', sdkFailureImage = '', cloudFailureBatch = 0 } = {}) {
  const mem = memoryDb({ users: user ? [{ _id: 'owner-user', _openid: 'owner', nickName: '测试用户' }] : [], posts: [] }, command);
  const calls = [], reviewedTexts = [], reviewedImages = [], timeline = [];
  const pushDbCall = mem.calls.push.bind(mem.calls);
  mem.calls.push = (...entries) => {
    timeline.push(...entries.map(entry => ({ kind: 'database', ...entry })));
    return pushDbCall(...entries);
  };
  let imageBatch = 0;
  let handler;
  const cloud = {
    DYNAMIC_CURRENT_ENV: 'moderation-batches-test', init() {},
    database: () => mem.db, getWXContext: () => ({ OPENID: 'owner' }),
    async getTempFileURL() { throw new Error('HTTPS fixtures must not request signed cloud URLs'); },
    async callFunction(options) {
      assert.equal(options.name, 'contentCheck');
      const data = structuredClone(options.data);
      calls.push(data);
      timeline.push({ kind: 'cloud-start', type: data.type });
      assert.ok(calls.length <= 12, 'Pure moderation calls must terminate rather than recursively re-enter batching');
      if (data.type === 'image' && ++imageBatch === cloudFailureBatch) {
        const error = new Error('Synthetic second-batch cloud failure');
        error.code = 'TEST_CLOUD_UNAVAILABLE';
        throw error;
      }
      const result = await handler(data, {});
      timeline.push({ kind: 'cloud-finish', type: data.type });
      return { result };
    }
  };
  const clients = {
    text: { async TextModeration(request) {
      assert.equal(request.Type, 'TEXT');
      reviewedTexts.push(Buffer.from(request.Content, 'base64').toString('utf8'));
      timeline.push({ kind: 'text-finish' });
      return { Suggestion: 'Pass', RequestId: 'test-text-pass' };
    } },
    image: { async ImageModeration(request) {
      reviewedImages.push(request.FileUrl);
      timeline.push({ kind: 'image-finish', url: request.FileUrl });
      if (request.FileUrl === sdkFailureImage) throw new Error('Synthetic second-batch Tencent failure');
      return { Suggestion: request.FileUrl === blockedImage ? 'Block' : 'Pass', RequestId: 'test-image-result' };
    } }
  };
  const env = { ...process.env, CONTENT_MODERATION_MODE: mode };
  const sandbox = {
    exports: {}, Buffer, process: { env }, console: quiet,
    require(id) {
      if (id === 'wx-server-sdk') return cloud;
      if (id === './moderation') return {
        ...moderationModule,
        createModerationService: sdkCloud => moderationModule.createModerationService(sdkCloud, env, clients)
      };
      return localRequire(id);
    }
  };
  vm.runInNewContext(source, sandbox, { filename });
  handler = sandbox.exports.main;
  return { mem, calls, reviewedTexts, reviewedImages, timeline,
    invoke: event => handler(event, {}) };
}

function assertImageBatches(result, expectedImages = images) {
  const batches = result.calls.filter(call => call.type === 'image');
  assert.equal(batches.length, Math.ceil(expectedImages.length / 3));
  const submittedImages = [];
  for (const batch of batches) {
    const batchImages = moderationModule.collectImages(batch);
    assert.ok(batchImages.length > 0 && batchImages.length <= 3, 'Every actual contentCheck image invocation contains at most three images');
    assert.equal(moderationModule.collectText(batch), '', 'Image calls must not repeat text moderation');
    submittedImages.push(...batchImages);
  }
  assert.deepEqual(submittedImages.slice().sort(), expectedImages.slice().sort(), 'All unique images are submitted exactly once');
  assert.deepEqual(result.reviewedImages.slice().sort(), expectedImages.slice().sort(), 'Every submitted image reaches the actual moderation service');
  assert.ok(result.calls.every(call => ['text', 'image'].includes(call.type)), 'Internal calls select terminal moderation routes');
  for (const textCall of result.calls.filter(call => call.type === 'text')) {
    assert.equal(moderationModule.collectImages(textCall).length, 0, 'The text invocation cannot retain image aliases or nested images');
  }
}

function writes(result) {
  return result.mem.calls.filter(call => ['add', 'update', 'remove', 'set'].includes(call.op));
}

function assertModerationBeforeUserLookup(result) {
  const lookup = result.timeline.findIndex(entry => entry.kind === 'database' && entry.name === 'users');
  assert.ok(lookup >= 0, 'Successful legacy moderation proceeds to user lookup');
  assert.ok(result.timeline.slice(lookup).every(entry => !['text-finish', 'image-finish', 'cloud-finish'].includes(entry.kind)),
    'All SDK checks and nested contentCheck calls finish before the legacy user lookup');
}

async function testDirectBatch() {
  const result = runtime();
  const response = await result.invoke({
    type: 'batch', title: '安全标题', content: '安全正文',
    images: [images[0], images[1], images[2], images[0]], fileIDs: [images[3], images[4]],
    imageUrls: [images[5]], originalImageUrls: [images[6]], imageUrl: images[7],
    seriesBlocks: [{ subtitle: '段落标题', content: '段落正文', imageUrl: images[8] }],
    seriesCoverImage: images[8]
  });
  assert.equal(response.success, true);
  assert.equal(response.passed, true);
  assert.equal(result.calls.length, 4, 'Nine images plus text become one text call and three image calls');
  assert.equal(result.reviewedTexts.length, 1);
  for (const fragment of ['安全标题', '安全正文', '段落标题', '段落正文']) {
    assert.ok(result.reviewedTexts[0].includes(fragment), `Text moderation includes ${fragment}`);
  }
  assertImageBatches(result);
  assert.equal(result.mem.calls.length, 0, 'Direct moderation and its nested calls must never query users or publish posts');
}

async function testTerminalRoutes() {
  const text = runtime();
  assert.equal((await text.invoke({ type: 'text', content: '安全文字' })).passed, true);
  assert.equal(text.calls.length, 0, 'An internal text request reaches the service without another cloud invocation');
  assert.equal(text.reviewedTexts.length, 1);
  const image = runtime();
  assert.equal((await image.invoke({ type: 'image', images: images.slice(0, 3) })).passed, true);
  assert.equal(image.calls.length, 0, 'An image request at the three-image boundary reaches the service directly');
  assert.deepEqual(image.reviewedImages, images.slice(0, 3));
  const oversizedImage = runtime();
  assert.equal((await oversizedImage.invoke({ type: 'image', images })).passed, true);
  assert.equal(oversizedImage.calls.length, 3, 'A direct image request exceeding three images also splits');
  assertImageBatches(oversizedImage);
  assert.equal(oversizedImage.mem.calls.length, 0);
}

async function testLegacyPublication() {
  for (const user of [false, true]) {
    const result = runtime({ user });
    const response = await result.invoke({ title: '九图帖子', content: '安全正文', publishMode: 'normal', fileIDs: images, originalFileIDs: images });
    assertImageBatches(result);
    assert.equal(result.reviewedTexts.length, 1);
    assertModerationBeforeUserLookup(result);
    if (user) {
      assert.equal(response.success, true);
      assert.ok(response.postId);
      assert.equal(result.mem.calls.filter(call => call.name === 'posts' && call.op === 'add').length, 1,
        'Only the outer legacy invocation publishes the approved post');
      assert.equal(result.mem.tables.posts.length, 1);
    } else {
      assert.equal(response.errorCode, 'USER_NOT_FOUND');
      assert.equal(writes(result).length, 0, 'A missing user cannot publish even after all batches pass');
    }
  }
}

async function testFailedSecondBatch() {
  const failures = [
    [{ blockedImage: images[3] }, 'CONTENT_BLOCKED'],
    [{ sdkFailureImage: images[3] }, 'MODERATION_UNAVAILABLE'],
    [{ cloudFailureBatch: 2 }, 'MODERATION_UNAVAILABLE']
  ];
  for (const [options, expectedCode] of failures) {
    for (const legacy of [false, true]) {
      const queued = legacy && expectedCode === 'CONTENT_BLOCKED';
      const result = runtime({ ...options, user: queued });
      const event = legacy
        ? { title: '待审核帖子', content: '正文', publishMode: 'normal', fileIDs: images }
        : { type: 'batch', content: '正文', images };
      const response = await result.invoke(event);
      if (queued) {
        assert.equal(response.code, 'REVIEW_PENDING', 'Blocked publication is saved for administrator review');
        assert.equal(response.success, false, 'A queued publication must not report published success');
        assert.equal(response.reviewQueued, true);
        assert.ok(response.reviewId);
        assert.equal(result.mem.tables.moderation_review.length, 1);
        const review = result.mem.tables.moderation_review[0];
        assert.equal(review.audit.code, expectedCode, 'The review preserves the original second-batch moderation error');
        assert.equal(review.audit.suggestion, 'Block');
        assert.equal(review.audit.requestId, 'test-image-result');
        assert.deepEqual(review.data.imageUrls, images, 'The finalized pending publication retains all submitted images');
        assert.equal(writes(result).filter(call => call.name === 'posts').length, 0, 'A blocked legacy publication never writes a public post');
        assertModerationBeforeUserLookup(result);
      } else {
        assert.equal(response.errorCode || response.code, expectedCode, `${legacy ? 'Legacy' : 'Direct batch'} second-batch failure must preserve its moderation error`);
        assert.equal(response.passed, false);
        assert.equal(result.mem.calls.length, 0, 'A direct rejection or service fault stops before any user lookup or database write');
      }
      assert.equal(result.calls.filter(call => call.type === 'image').length, 2, 'The second-batch failure stops the remaining image batch');
      assert.equal(result.mem.tables.posts.length, 0);
    }
  }
}

async function testOffMode() {
  for (const event of [
    { type: 'batch', content: '正文', images },
    { type: 'image', images },
    { title: '关闭审核的帖子', content: '正文', publishMode: 'normal', fileIDs: images }
  ]) {
    const result = runtime({ mode: 'off' });
    const response = await result.invoke(event);
    if (event.type) {
      assert.equal(response.passed, true);
      assert.equal(response.code, 'MODERATION_OFF');
      assert.equal(result.mem.calls.length, 0);
    } else assert.equal(response.errorCode, 'USER_NOT_FOUND');
    assert.equal(result.calls.length, 0, 'Off mode never invokes another moderation cloud function');
    assert.equal(result.reviewedTexts.length + result.reviewedImages.length, 0, 'Off mode never calls a Tencent moderation SDK');
    assert.equal(writes(result).length, 0);
  }
}

async function main() {
  await testDirectBatch();
  await testTerminalRoutes();
  await testLegacyPublication();
  await testFailedSecondBatch();
  await testOffMode();
  console.log('Real contentCheck routing, three-image batches, failure ordering and off-mode checks passed');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
