const assert = require('node:assert/strict');
const { moderateBeforeWrite } = require('../functions/_shared/moderation-gate');
const { createModerationService } = require('../functions/contentCheck/moderation');

const images = Array.from({ length: 9 }, (_, index) => `https://example.com/image-${index}.png`);
function harness(respond = () => ({ success: true, passed: true })) {
  const calls = [];
  return { calls, cloud: { async callFunction(options) {
    assert.equal(options.name, 'contentCheck');
    assert.equal(options.timeout, 70000);
    calls.push(options.data);
    return { result: await respond(options.data, calls.length) };
  } } };
}

async function main() {
  const imageOnly = harness();
  assert.equal(await moderateBeforeWrite(imageOnly.cloud, { type: 'batch', images }), null);
  assert.equal(imageOnly.calls.length, 3);
  assert.ok(imageOnly.calls.every(request => request.type === 'image' && request.images.length === 3));
  assert.deepEqual(imageOnly.calls.flatMap(request => request.images), images);

  const mixed = harness();
  const blocks = [{ subtitle: '段落标题', content: '段落正文', imageUrl: images[0] }];
  assert.equal(await moderateBeforeWrite(mixed.cloud, { type: 'batch', content: '完整正文', images, seriesBlocks: blocks }), null);
  assert.equal(mixed.calls.length, 4);
  assert.equal(mixed.calls[0].type, 'text');
  assert.equal(mixed.calls[0].content, '完整正文');
  assert.deepEqual(mixed.calls[0].seriesBlocks, [{ subtitle: '段落标题', content: '段落正文' }]);
  assert.equal(mixed.calls[0].images, undefined);
  assert.ok(mixed.calls.slice(1).every(request => request.type === 'image' && request.images.length <= 3 && request.content === undefined));
  assert.deepEqual(blocks, [{ subtitle: '段落标题', content: '段落正文', imageUrl: images[0] }], 'do not mutate caller content');

  const rejected = harness((data, number) => number === 2
    ? { success: true, passed: false, code: 'CONTENT_BLOCKED', message: '拒绝', suggestion: 'Block', requestId: 'image-block' }
    : { success: true, passed: true });
  assert.deepEqual(await moderateBeforeWrite(rejected.cloud, { images }), {
    success: false, passed: false, code: 'CONTENT_BLOCKED', message: '拒绝', suggestion: 'Block', requestId: 'image-block'
  });
  assert.equal(rejected.calls.length, 2, 'do not audit later batches after rejection');

  const unavailable = harness((data, number) => {
    if (number === 3) throw new Error('third batch unavailable');
    return { success: true, passed: true };
  });
  assert.equal((await moderateBeforeWrite(unavailable.cloud, { images })).code, 'MODERATION_UNAVAILABLE');
  assert.equal(unavailable.calls.length, 3);

  const deduplicated = harness();
  assert.equal(await moderateBeforeWrite(deduplicated.cloud, {
    images: [images[0], ` ${images[0]} `], fileIDs: [images[1]], imageUrls: [images[1]],
    originalImageUrls: [images[2]], imageUrl: images[2], seriesCoverImage: images[3],
    seriesBlocks: [{ imageUrl: images[3] }]
  }), null);
  assert.equal(deduplicated.calls.length, 2);
  assert.deepEqual(deduplicated.calls.flatMap(request => request.images), images.slice(0, 4));

  const oversized = harness();
  assert.equal((await moderateBeforeWrite(oversized.cloud, { images, seriesCoverImage: 'https://example.com/tenth.png' })).code, 'CONTENT_TOO_LARGE');
  assert.equal(oversized.calls.length, 0, 'check the whole image count before splitting');

  let sdkCalls = 0;
  const service = createModerationService({}, { CONTENT_MODERATION_MODE: 'enforce' }, {
    text: { async TextModeration() { sdkCalls += 1; return { Suggestion: 'Pass' }; } },
    image: { async ImageModeration() { sdkCalls += 1; return { Suggestion: 'Pass' }; } }
  });
  const excessiveText = harness(data => service.moderate(data));
  const tooLong = '甲'.repeat(30001);
  assert.equal((await moderateBeforeWrite(excessiveText.cloud, { content: tooLong, images })).code, 'CONTENT_TOO_LARGE');
  assert.equal(excessiveText.calls.length, 1, 'send all text once and stop before image batches');
  assert.equal(excessiveText.calls[0].content.length, 30001);
  assert.equal(sdkCalls, 0, 'oversized text must never reach Tencent APIs');
  console.log('Moderation gate three-image batches, diagnostics and whole-request limits passed');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
