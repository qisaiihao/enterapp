const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const cloudSdk = require('wx-server-sdk');
const { memoryDb } = require('./helpers/posts-memory-db.cjs');
const { createModerationService, collectText, collectImages, splitText } = require('../functions/contentCheck/moderation');
const { moderateBeforeWrite } = require('../functions/_shared/moderation-gate');
cloudSdk.init({ env: 'moderation-edit-test' });
const postsCommand = cloudSdk.database().command;

function editRuntime(version, functionName = 'updatePostContent') {
  const mem = memoryDb({
    users: [{ _id: 'owner-user', _openid: 'owner', nickName: '作者' }],
    adminConfig: [{ _id: 'admin', adminPoemIds: [], version: 1 }],
    posts: [{ _id: 'editable', _openid: 'owner', schemaVersion: version,
      publishMode: 'poem', isPoem: true, isOriginal: true, content: '原正文',
      joinedActivityId: 'activity', joinedActivityTitleSnapshot: '原活动' }],
    activities: [{ _id: 'activity', postCount: 1 }]
  }, postsCommand);
  const auditRequests = [], reviewedTexts = [], reviewedImages = [];
  const service = createModerationService({}, { CONTENT_MODERATION_MODE: 'enforce' }, {
    text: { async TextModeration(request) {
      const text = Buffer.from(request.Content, 'base64').toString('utf8');
      reviewedTexts.push(text);
      return { Suggestion: text.includes('待拒绝') ? 'Block' : 'Pass' };
    } },
    image: { async ImageModeration(request) {
      reviewedImages.push(request.FileUrl);
      return { Suggestion: request.FileUrl.includes('/blocked-') ? 'Block' : 'Pass' };
    } }
  });
  const functionRoot = process.env.MODERATION_TEST_FUNCTION_ROOT || path.join(__dirname, '../functions');
  const filename = path.join(functionRoot, functionName, 'index.js');
  const localRequire = createRequire(filename);
  const sandbox = { exports: {}, console: { log() {}, warn() {}, error() {} }, require(id) {
    if (id === 'wx-server-sdk') return {
      init() {}, database: () => mem.db, getWXContext: () => ({ OPENID: 'owner' }),
      async callFunction(options) {
        assert.equal(options.name, 'contentCheck');
        auditRequests.push(options.data);
        return { result: await service.moderate(options.data) };
      }
    };
    return localRequire(id);
  } };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), sandbox, { filename });
  return { mem, auditRequests, reviewedTexts, reviewedImages,
    submit: event => sandbox.exports.main(event, {}),
    edit: data => sandbox.exports.main({ postId: 'editable', data }, {}) };
}

async function testEditedContentModeration() {
  const cases = [
    ['highlightSentence', { highlightSentence: '待拒绝单句' }, '待拒绝单句'],
    ['highlightLines', { highlightLines: ['安全摘句', '待拒绝高亮'] }, '待拒绝高亮'],
    ['seriesCoverHighlight', { seriesCoverHighlight: '待拒绝封面摘句' }, '待拒绝封面摘句'],
    ['series block highlightSentence', { seriesBlocks: [{ content: '安全正文', highlightSentence: '待拒绝段落摘句' }] }, '待拒绝段落摘句'],
    ['series block highlightLines', { seriesBlocks: [{ content: '安全正文', highlightLines: ['待拒绝段落高亮'] }] }, '待拒绝段落高亮'],
    ['seriesCoverImage', { seriesCoverImage: 'https://example.com/blocked-cover.png' }],
    ['display image', { fileIDs: ['https://example.com/blocked-display.png'] }],
    ['original image', { fileIDs: ['https://example.com/display.png'], originalFileIDs: ['https://example.com/blocked-original.png'] }],
    ['originalFileIDs only', { originalFileIDs: ['https://example.com/blocked-original-only.png'] }],
    ['discussionSentences only', { publishMode: 'discussion', isPoem: false, discussionSentences: [{ sentences: ['安全句子'], comment: '待拒绝旧句组' }] }, '待拒绝旧句组'],
    ['empty sentenceGroups with legacy content', { publishMode: 'discussion', isPoem: false, sentenceGroups: [], discussionSentences: [{ sentences: ['安全句子'], comment: '待拒绝空数组后旧句组' }] }, '待拒绝空数组后旧句组'],
    ['independent sentence arrays', { publishMode: 'discussion', isPoem: false, sentenceGroups: [{ sentences: ['标准句子'], comment: '标准句组' }], discussionSentences: [{ sentences: ['旧句子'], comment: '待拒绝独立旧句组' }] }, '待拒绝独立旧句组']
  ];
  for (const version of [1, 2]) {
    for (const [name, data, expectedText] of cases) {
      const runtime = editRuntime(version);
      const before = structuredClone(runtime.mem.tables);
      const result = await runtime.edit(data);
      assert.equal(result.success, false, `V${version} ${name} must be rejected`);
      assert.equal(result.code, 'REVIEW_PENDING', `V${version} ${name} must enter administrator review`);
      assert.equal(result.reviewQueued, true, name);
      assert.ok(result.reviewId, name);
      assert.equal(runtime.auditRequests.length, 1, name);
      if (expectedText) assert.ok(runtime.reviewedTexts.some(text => text.includes(expectedText)), name);
      else assert.ok(runtime.reviewedImages.some(url => url.includes('/blocked-')), name);
      assert.deepEqual(runtime.mem.tables.posts, before.posts, `${name} must preserve the public post`);
      assert.deepEqual(runtime.mem.tables.activities, before.activities, `${name} must preserve activity counts`);
      assert.equal(runtime.mem.tables.moderation_review.length, 1, name);
      const review = runtime.mem.tables.moderation_review[0];
      assert.equal(review.kind, 'post_edit', name);
      assert.equal(review.postId, 'editable', name);
      assert.equal(review.audit.code, 'CONTENT_BLOCKED', `${name} must preserve the blocking audit result`);
      if (data.discussionSentences) {
        assert.deepEqual(review.data.discussionSentences, data.discussionSentences, `${name} must preserve submitted legacy comments`);
        if (data.sentenceGroups && data.sentenceGroups.length) {
          assert.ok(runtime.reviewedTexts.some(text => text.includes('标准句组')), 'Both independently submitted arrays must reach moderation');
          assert.deepEqual(review.data.sentenceGroups, data.sentenceGroups);
        }
      }
      assert.equal(runtime.mem.calls.filter(call => ['posts', 'activities'].includes(call.name) && ['update', 'add', 'remove', 'set'].includes(call.op)).length, 0, `${name} must not publish or change activity counts`);
    }
    const approved = editRuntime(version);
    assert.equal((await approved.edit({ fileIDs: ['https://example.com/display.png'],
      originalFileIDs: ['https://example.com/original.png'] })).success, true);
    assert.deepEqual(approved.reviewedImages, ['https://example.com/original.png'], 'Keep the existing preference for original images');
  }
}

async function testLegacyDiscussionPublication() {
  for (const sentenceGroups of [[], [{ sentences: ['标准句子'], comment: '标准句组' }]]) {
    const runtime = editRuntime(1, 'createPost');
    const discussionSentences = [{ sentences: ['旧句子'], comment: '待拒绝独立旧句组' }];
    const before = structuredClone(runtime.mem.tables.posts);
    const result = await runtime.submit({ title: '安全标题', content: '安全正文', isDiscussion: true,
      publishMode: 'discussion', sentenceGroups, discussionSentences });
    assert.equal(result.code, 'REVIEW_PENDING', 'Legacy discussion comments must be intercepted and saved for review');
    assert.equal(result.reviewQueued, true);
    assert.equal(runtime.auditRequests.length, 1);
    assert.ok(runtime.reviewedTexts.some(text => text.includes('待拒绝独立旧句组')));
    if (sentenceGroups.length) assert.ok(runtime.reviewedTexts.some(text => text.includes('标准句组')));
    const review = runtime.mem.tables.moderation_review[0];
    assert.deepEqual(review.data.sentenceGroups, sentenceGroups);
    assert.deepEqual(review.data.discussionSentences, discussionSentences);
    assert.deepEqual(runtime.mem.tables.posts, before, 'Machine interception never creates the legacy discussion post');
    assert.equal(runtime.mem.calls.filter(call => call.name === 'posts' && ['add', 'update', 'set', 'remove'].includes(call.op)).length, 0);
  }
}

async function main() {
  let textCalls = 0;
  let imageCalls = 0;
  const cloud = {
    async getTempFileURL({ fileList }) {
      return { fileList: fileList.map(fileID => ({ fileID, status: 0, tempFileURL: 'https://example.com/test.png' })) };
    }
  };
  const clients = {
    text: { async TextModeration(request) {
      textCalls += 1;
      assert.equal(request.Type, 'TEXT');
      assert.ok(Buffer.from(request.Content, 'base64').toString('utf8'));
      return { Suggestion: 'Pass', RequestId: 'text-pass' };
    } },
    image: { async ImageModeration(request) {
      imageCalls += 1;
      assert.equal(request.FileUrl, 'https://example.com/test.png');
      return { Suggestion: 'Pass', RequestId: 'image-pass' };
    } }
  };
  const off = createModerationService(cloud, {}, clients);
  assert.equal((await off.moderate({ content: '任意内容', images: ['cloud://test'] })).code, 'MODERATION_OFF');
  assert.equal(textCalls + imageCalls, 0, 'off mode never calls Tencent Cloud');

  const on = createModerationService(cloud, { CONTENT_MODERATION_MODE: 'enforce' }, clients);
  const approved = await on.moderate({ title: '标题', content: '正文', images: ['cloud://test'] });
  assert.equal(approved.passed, true);
  assert.equal(textCalls, 1);
  assert.equal(imageCalls, 1);

  assert.equal(collectText({ content: '甲', seriesBlocks: [{ content: '乙' }] }), '甲\n乙');
  assert.equal(collectText({ sentenceGroups: [{ sentences: ['甲'], comment: '标准句组' }],
    discussionSentences: [{ sentences: ['乙', '甲'], comment: '旧句组' }] }), '标准句组\n甲\n旧句组\n乙');
  assert.deepEqual(collectImages({ fileIDs: ['cloud://a'], images: ['cloud://a', 'cloud://b'] }), ['cloud://a', 'cloud://b']);
  assert.equal(splitText('甲'.repeat(10001)).length, 2);
  assert.equal((await on.moderate({ content: '甲'.repeat(30001) })).code, 'CONTENT_TOO_LARGE');

  const blocked = createModerationService(cloud, { CONTENT_MODERATION_MODE: 'enforce' }, {
    ...clients,
    text: { async TextModeration() { return { Suggestion: 'Block', RequestId: 'blocked-id' }; } }
  });
  assert.equal((await blocked.moderate({ content: 'bad' })).code, 'CONTENT_BLOCKED');
  const review = createModerationService(cloud, { CONTENT_MODERATION_MODE: 'enforce' }, {
    ...clients,
    text: { async TextModeration() { return { Suggestion: 'Review' }; } }
  });
  assert.equal((await review.moderate({ content: 'review' })).code, 'REVIEW_REQUIRED');
  const unavailable = createModerationService(cloud, { CONTENT_MODERATION_MODE: 'enforce' }, {
    ...clients,
    text: { async TextModeration() { throw new Error('temporary failure'); } }
  });
  assert.equal((await unavailable.moderate({ content: 'retry' })).code, 'MODERATION_UNAVAILABLE');

  assert.equal(await moderateBeforeWrite({ async callFunction(options) {
    assert.equal(options.name, 'contentCheck');
    assert.equal(options.timeout, 70000, 'override the SDK default timeout for the moderation call');
    assert.deepEqual(options.data, { content: 'hello', type: 'text' });
    return { result: { success: true, passed: true } };
  } }, { content: 'hello' }), null);
  const denied = await moderateBeforeWrite({ async callFunction() { return { result: { success: true, passed: false, code: 'CONTENT_BLOCKED', message: 'blocked' } }; } }, { content: 'bad' });
  assert.equal(denied.code, 'CONTENT_BLOCKED');
  let legacyCalls = 0;
  const legacyOnly = { sentenceGroups: [], discussionSentences: [{ sentences: ['旧句子'], comment: '待拒绝旧评论' }] };
  const legacyDenied = await moderateBeforeWrite({ async callFunction(options) {
    legacyCalls += 1;
    assert.equal(options.data.type, 'text');
    assert.deepEqual(options.data.discussionSentences, legacyOnly.discussionSentences);
    assert.ok(collectText(options.data).includes('待拒绝旧评论'));
    return { result: { success: true, passed: false, code: 'CONTENT_BLOCKED', suggestion: 'Block' } };
  } }, legacyOnly);
  assert.equal(legacyCalls, 1, 'Legacy-only sentence content cannot skip the cloud text audit');
  assert.equal(legacyDenied.code, 'CONTENT_BLOCKED');
  const failed = await moderateBeforeWrite({ async callFunction() { throw new Error('offline'); } }, { content: 'x' });
  assert.equal(failed.code, 'MODERATION_UNAVAILABLE');
  await testEditedContentModeration();
  await testLegacyDiscussionPublication();
  console.log('Moderation mode, Tencent responses and write gate tests passed');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
