const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const cloud = require('wx-server-sdk');
const { memoryDb } = require('./helpers/posts-memory-db.cjs');

cloud.init({ env: 'moderation-review-integration' });
const command = cloud.database().command;
const root = path.resolve(__dirname, '..');
const quiet = { log() {}, warn() {}, error() {} };
const blocked = { success: true, passed: false, code: 'CONTENT_BLOCKED',
  message: '文本未通过审核', suggestion: 'Block', failedType: 'text', requestId: 'audit-request' };

function fixture() {
  return memoryDb({
    adminConfig: [{ _id: 'admin', adminPoemIds: ['review-admin'] }],
    users: [
      { _id: 'owner-account', _openid: 'owner', poemId: 'owner', nickName: '投稿人' },
      { _id: 'admin-account', _openid: 'admin', poemId: 'review-admin', nickName: '管理员' },
      { _id: 'source-account', _openid: 'source-owner', poemId: 'source-owner', nickName: '原帖作者' }
    ],
    posts: [{ _id: 'source', _openid: 'source-owner', title: '原诗', content: '原诗正文',
      authorName: '原帖作者', isPoem: true, isOriginal: true, commentCount: 0, discussionCount: 0 },
    { _id: 'editable', _openid: 'owner', title: '修改前', content: '原正文', isPoem: true, isOriginal: true }],
    comments: [], messages: [], moderation_review: [], poets: [],
    activities: [{ _id: 'activity', title: '征稿', status: 'published', allowUserSubmission: true,
      startTime: new Date(Date.now() - 60000), endTime: new Date(Date.now() + 86400000), postCount: 0 }]
  }, command);
}

function backend(mem, name, caller = 'owner', audit = blocked) {
  const filename = path.join(root, 'functions', name, 'index.js');
  const localRequire = createRequire(filename);
  const removedFiles = [];
  const sandbox = { exports: {}, process, Buffer, console: quiet, require(id) {
    if (id === 'wx-server-sdk') return {
      init() {}, database: () => mem.db, getWXContext: () => ({ OPENID: caller }),
      callFunction: async () => ({ result: audit }),
      uploadFile: async () => ({ fileID: 'cloud://env/collage-poetry/owner_test.jpg' }),
      deleteFile: async request => { removedFiles.push(...request.fileList); return {}; },
      getTempFileURL: async ({ fileList }) => ({ fileList: fileList.map(fileID => ({ fileID, status: 0,
        tempFileURL: 'https://example.com/image.jpg' })) })
    };
    return localRequire(id);
  } };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), sandbox, { filename });
  return { call: event => sandbox.exports.main({ ...event, openid: caller }, {}), removedFiles };
}

async function main() {
  const previous = { mode: process.env.CONTENT_MODERATION_MODE, schema: process.env.POSTS_WRITE_SCHEMA };
  process.env.CONTENT_MODERATION_MODE = 'enforce';
  try {
    for (const schema of ['1', '2']) {
      process.env.POSTS_WRITE_SCHEMA = schema;
      const cases = [
        ['contentCheck', { title: '待审诗', content: '待审正文', publishMode: 'poem', isOriginal: true,
          isAnonymous: true, joinActivityId: 'activity' }, 'post'],
        ['createPost', { title: '兼容发布', content: '待审正文', publishMode: 'poem', isOriginal: true }, 'post'],
        ['createDiscussionPost', { quotedPostId: 'source', content: '讨论正文',
          sentenceGroups: [{ sentences: ['原诗正文'], comment: '讨论正文' }] }, 'post'],
        ['updatePostContent', { postId: 'editable', data: { content: '复核修改正文' } }, 'post_edit'],
        ['addComment', { postId: 'source', content: '评论正文' }, 'comment'],
        ['uploadCollagePoetry', { cloudPath: 'collage-poetry/test.jpg', fileContent: 'aGVsbG8=' }, 'post']
      ];
      for (const [name, event, kind] of cases) {
        const mem = fixture();
        const beforePosts = structuredClone(mem.tables.posts);
        const runtime = backend(mem, name);
        const result = await runtime.call({ ...event, skipModeration: true, moderationApproved: true });
        assert.equal(result.success, false, `${name} must not publish until an administrator approves: ${JSON.stringify(result)}`);
        assert.equal(result.reviewQueued, true, `${name} must enqueue the actual rejected submission: ${JSON.stringify(result)}`);
        assert.equal(mem.tables.moderation_review.length, 1, name);
        assert.deepEqual(mem.tables.posts, beforePosts, `${name} must leave published posts unchanged`);
        assert.equal(mem.tables.comments.length, 0, `${name} must leave comments unpublished`);
        assert.equal(mem.tables.activities[0].postCount, 0, `${name} must not increment activity counts while pending`);
        const queued = mem.tables.moderation_review[0];
        assert.equal(queued.kind, kind);
        assert.equal(queued.source, name);
        assert.equal(queued.audit.suggestion, 'Block');
        assert.ok(!JSON.stringify(queued).includes('aGVsbG8='), 'Never persist upload base64 in the review queue');
        if (name === 'uploadCollagePoetry') assert.equal(runtime.removedFiles.length, 0, 'Pending collage image must remain available');

        const unauthorized = await backend(mem, 'adminManager').call({ action: 'resolveModerationReview',
          reviewId: result.reviewId, decision: 'approve' });
        assert.equal(unauthorized.success, false, 'Submitter cannot approve their own blocked content');
        const admin = backend(mem, 'adminManager', 'admin');
        const approved = await admin.call({ action: 'resolveModerationReview', reviewId: result.reviewId,
          decision: 'approve', data: { content: '客户端伪造的替换文本' }, skipModeration: true });
        assert.equal(approved.success, true, `${name} approval: ${JSON.stringify(approved)}`);
        assert.equal(mem.tables.moderation_review[0].status, 'approved');
        const firstCounts = { posts: mem.tables.posts.length, comments: mem.tables.comments.length,
          messages: mem.tables.messages.length, activity: mem.tables.activities[0].postCount };
        const repeated = await admin.call({ action: 'resolveModerationReview', reviewId: result.reviewId, decision: 'approve' });
        assert.equal(repeated.success, true, 'Repeated approval should return the already stored outcome');
        assert.deepEqual({ posts: mem.tables.posts.length, comments: mem.tables.comments.length,
          messages: mem.tables.messages.length, activity: mem.tables.activities[0].postCount }, firstCounts,
        'Repeated approval must not duplicate content, notifications or counters');
        assert.ok(!JSON.stringify(mem.tables.posts).includes('客户端伪造'), 'Approval must use the saved server payload');
        if (kind === 'post_edit') assert.equal(mem.tables.posts.find(post => post._id === 'editable').content, '复核修改正文');
        else if (kind === 'comment') {
          assert.equal(mem.tables.comments[0].content, '评论正文');
          assert.equal(mem.tables.posts.find(post => post._id === 'source').commentCount, 1);
          assert.equal(mem.tables.messages.filter(message => message.type === 'comment').length, 1);
        } else {
          assert.equal(mem.tables.posts.length, beforePosts.length + 1);
          const published = mem.tables.posts.find(post => !beforePosts.some(before => before._id === post._id));
          if (schema === '2') assert.equal(published.schemaVersion, 2);
          if (name === 'contentCheck') {
            assert.equal(published.isAnonymous, true);
            assert.equal(published.realAuthorOpenid, 'owner');
            assert.equal(mem.tables.activities[0].postCount, 1);
          }
          if (name === 'createDiscussionPost') assert.equal(mem.tables.posts.find(post => post._id === 'source').discussionCount, 1);
          if (name === 'uploadCollagePoetry') {
            const replay = await runtime.call(event);
            assert.equal(replay.code, 'REVIEW_ALREADY_APPROVED');
            assert.equal(replay.reviewStored, true);
            assert.equal(runtime.removedFiles.length, 0, 'Resolved review replay must not delete the published collage image');
          }
        }
      }
    }
    const mem = fixture();
    const unavailable = backend(mem, 'createPost', 'owner', { success: false, passed: false,
      code: 'MODERATION_UNAVAILABLE', message: '审核故障' });
    const response = await unavailable.call({ title: '故障测试', content: '正文' });
    assert.equal(response.reviewQueued, undefined, 'Service faults are not human review decisions');
    assert.equal(mem.tables.moderation_review.length, 0);
    const collageEvent = { cloudPath: 'collage-poetry/test.jpg', fileContent: 'aGVsbG8=' };
    const rejectedCollage = fixture();
    const collage = backend(rejectedCollage, 'uploadCollagePoetry');
    const pendingCollage = await collage.call(collageEvent);
    await backend(rejectedCollage, 'adminManager', 'admin').call({ action: 'resolveModerationReview',
      reviewId: pendingCollage.reviewId, decision: 'reject' });
    assert.equal((await collage.call(collageEvent)).code, 'REVIEW_ALREADY_REJECTED');
    assert.equal(collage.removedFiles.length, 0, 'Rejected review replay preserves its saved preview image');
    const failedCollage = backend(fixture(), 'uploadCollagePoetry', 'owner', {
      success: false, passed: false, code: 'MODERATION_UNAVAILABLE', message: '审核故障' });
    assert.equal((await failedCollage.call(collageEvent)).code, 'MODERATION_UNAVAILABLE');
    assert.equal(failedCollage.removedFiles.length, 1, 'A service fault cleans the new image without saving a review');
    console.log('Moderation review integration passed: six write entries, both post schemas, auth, saved content, counters and retries');
  } finally {
    if (previous.mode === undefined) delete process.env.CONTENT_MODERATION_MODE;
    else process.env.CONTENT_MODERATION_MODE = previous.mode;
    if (previous.schema === undefined) delete process.env.POSTS_WRITE_SCHEMA;
    else process.env.POSTS_WRITE_SCHEMA = previous.schema;
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
