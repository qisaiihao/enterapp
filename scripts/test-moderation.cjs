const assert = require('node:assert/strict');
const { createModerationService, collectText, collectImages, splitText } = require('../functions/contentCheck/moderation');
const { moderateBeforeWrite } = require('../functions/_shared/moderation-gate');

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

  assert.equal(await moderateBeforeWrite({ async callFunction() { return { result: { success: true, passed: true } }; } }, { content: 'hello' }), null);
  const denied = await moderateBeforeWrite({ async callFunction() { return { result: { success: true, passed: false, code: 'CONTENT_BLOCKED', message: 'blocked' } }; } }, { content: 'bad' });
  assert.equal(denied.code, 'CONTENT_BLOCKED');
  const failed = await moderateBeforeWrite({ async callFunction() { throw new Error('offline'); } }, { content: 'x' });
  assert.equal(failed.code, 'MODERATION_UNAVAILABLE');
  console.log('Moderation mode, Tencent responses and write gate tests passed');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
