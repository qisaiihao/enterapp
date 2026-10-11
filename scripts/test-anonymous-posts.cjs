const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { parse } = require('@babel/parser');
const cloud = require('wx-server-sdk');
const { memoryDb } = require('./helpers/posts-memory-db.cjs');
cloud.init({ env: 'anonymous-posts-test' });
const command = cloud.database().command;
const root = path.resolve(__dirname, '..');
const quiet = { log() {}, warn() {}, error() {} };
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

function load(file, globals = {}) {
  let source = read(file);
  if (file.endsWith('.vue')) source = source.match(/<script>([\s\S]*?)<\/script>/)[1];
  const bindings = {};
  for (const node of parse(source, { sourceType: 'module' }).program.body.reverse()) {
    if (node.type === 'ImportDeclaration') {
      for (const spec of node.specifiers) bindings[spec.local.name] = () => {};
      source = source.slice(0, node.start) + source.slice(node.end);
    } else if (node.type === 'ExportDefaultDeclaration') {
      source = source.slice(0, node.start) + 'module.exports = ' + source.slice(node.declaration.start);
    } else if (node.type === 'ExportNamedDeclaration') {
      source = source.slice(0, node.start) + source.slice(node.declaration ? node.declaration.start : node.end);
    }
  }
  const sandbox = { ...bindings, ...globals, module: { exports: {} }, console: quiet };
  vm.runInNewContext(source, sandbox, { filename: file });
  return sandbox.module.exports;
}
function page(options, overrides = {}) {
  const result = options.data();
  for (const [key, method] of Object.entries(options.methods)) result[key] = method.bind(result);
  return Object.assign(result, { setData(data) { Object.assign(this, data); } }, overrides);
}
function backend(mem, name, caller = 'owner') {
  const filename = path.join(root, 'functions', name, 'index.js');
  const localRequire = createRequire(filename);
  const sandbox = { exports: {}, process, Buffer, console: quiet, require(id) {
    if (id === 'wx-server-sdk') return {
      init() {}, database: () => mem.db, getWXContext: () => ({ OPENID: caller }),
      callFunction: async () => ({ result: { success: true, passed: true, code: 'MODERATION_OFF' } })
    };
    if (id.includes('get-blocked-user-ids')) return async () => [];
    return localRequire(id);
  } };
  vm.runInNewContext(read(`functions/${name}/index.js`), sandbox, { filename });
  return event => sandbox.exports.main(event, {});
}
function assertPrivate(post) {
  assert.equal(post.isAnonymous, true);
  assert.equal(post._openid, '123456');
  assert.equal(post.authorName, '匿名用户');
  assert.ok(!post.authorSignature);
  assert.ok(!JSON.stringify(post).includes('owner'), 'Public response must not contain real identity');
  assert.ok(!('realAuthorOpenid' in post));
}
function fixture() {
  return memoryDb({
    users: [{ _openid: 'owner', nickName: 'owner-name', avatarUrl: 'owner-avatar', signatureUrl: 'owner-signature' }],
    posts: [], votes_log: [], activities: [{ _id: 'activity', status: 'published', title: '活动', allowUserSubmission: true,
      startTime: new Date(Date.now() - 60000), endTime: new Date(Date.now() + 60000) }]
  }, command);
}

async function main() {
  const previous = process.env.POSTS_WRITE_SCHEMA;
  try {
    for (const version of ['1', '2']) {
      process.env.POSTS_WRITE_SCHEMA = version;
      const mem = fixture();
      for (const name of ['contentCheck', 'createPost']) {
        for (const mode of ['normal', 'poem', 'discussion']) {
          const result = await backend(mem, name)({ content: '正文', publishMode: mode,
            isOriginal: true, isDiscussion: mode === 'discussion', isAnonymous: true,
            author: 'owner-name', realAuthorOpenid: 'forged-owner', joinActivityId: 'activity' });
          assert.ok(result.postId, JSON.stringify({ name, mode, result }));
          const stored = mem.tables.posts.find(post => post._id === result.postId);
          assert.equal(stored.isAnonymous, true);
          assert.equal(stored.realAuthorOpenid, 'owner', 'Owner is resolved server-side');
          assert.equal(stored._openid, '123456');
          assert.equal(stored.authorName, '匿名用户');
          assert.ok(!stored.authorSignature);
          if (name === 'contentCheck') assert.equal(stored.joinedActivityId, 'activity');
          for (const caller of ['owner', 'visitor']) {
            const detail = await backend(mem, 'getPostDetail', caller)({ postId: stored._id });
            assert.equal(detail.success, true);
            assertPrivate(detail.post);
            assert.equal(detail.post.isAuthor, caller === 'owner');
          }
          // Older clients send false when editing or linking an activity: keep anonymity.
          for (const privacy of [{}, { isAnonymous: false }, { isAnonymous: 'true' }]) {
            const edit = await backend(mem, 'updatePostContent')({ postId: stored._id,
              data: { title: '编辑', author: 'owner-name', joinedActivityId: 'activity', ...privacy } });
            assert.equal(edit.success, true, JSON.stringify(edit));
            assert.equal(stored.isAnonymous, true);
            assert.equal(stored.realAuthorOpenid, 'owner');
            assert.equal(stored.author, '匿名用户');
            assertPrivate((await backend(mem, 'getPostDetail', 'visitor')({ postId: stored._id })).post);
          }
          assert.equal((await backend(mem, 'updatePostContent', 'visitor')({
            postId: stored._id, data: { content: '禁止修改' }
          })).code, 'FORBIDDEN');
        }
        const ordinary = await backend(mem, name)({ content: '非匿名', isAnonymous: 'false' });
        assert.ok(ordinary.postId);
        assert.notEqual(mem.tables.posts.find(post => post._id === ordinary.postId).isAnonymous, true);
      }
      const activity = await backend(mem, 'getPostList', 'visitor')({ includeActivity: true, activityId: 'activity', limit: 20 });
      assert.equal(activity.success, true);
      assert.ok(activity.posts.length > 0);
      activity.posts.forEach(assertPrivate);
      // Legacy createPost stored the real ID in _openid; getters must mask it without losing ownership.
      mem.tables.posts.push({ _id: 'legacy', _openid: 'owner', isAnonymous: true,
        authorName: 'owner-name', authorAvatar: 'owner-avatar', authorSignature: 'owner-signature',
        content: '正文', commentCount: 0 });
      const legacy = await backend(mem, 'getPostDetail')({ postId: 'legacy' });
      assertPrivate(legacy.post);
      assert.equal(legacy.post.isAuthor, true);
      mem.tables.follows = [{ followerId: 'visitor', followedId: 'owner' }];
      mem.tables.posts.find(post => post._id === 'legacy').auditStatus = 'approved';
      const following = await backend(mem, 'getFollowingPosts', 'visitor')({});
      assert.equal(following.success, true, JSON.stringify(following));
      assert.ok(!following.posts.some(post => post._id === 'legacy'), 'Following feed cannot reveal anonymous authors');
      const orphan = await backend(mem, 'contentCheck', 'missing-account')({ content: '拒绝无归属发帖', isAnonymous: true });
      assert.equal(orphan.errorCode, 'USER_NOT_FOUND');
    }

    const mem = fixture();
    const audit = backend(mem, 'contentCheck');
    const edit = backend(mem, 'updatePostContent');
    let addPage, previewPost, currentUser = 'owner';
    const uni = { getStorageSync: key => key === 'openid' ? currentUser : undefined,
      setStorageSync() {}, showToast() {}, showModal({ success }) { success({ confirm: true }); },
      navigateTo({ success }) { success({ eventChannel: { emit(name, data) { previewPost = data.post; } } }); } };
    const globals = { uni, getApp: () => ({}), colorPalettes: [], poemLines: [], tagCategories: [],
      normalizeSeriesBlocks: () => ({ highlightLines: [] }),
      attachPoemDisplayFields: post => ({ ...post }),
      getCurrentPages: () => [{ $vm: addPage }, {}],
      contentAudit: audit,
      updatePostContent: (postId, payload) => edit({ postId, ...payload }) };
    const add = load('pages-publish/add/add.vue', globals);
    const preview = load('pages-publish/preview/preview.vue', globals);
    addPage = page(add, { content: '普通入口匿名正文', flushWorkingDraft() {} });
    addPage.goToPreview();
    const previewPage = page(preview, { post: previewPost, isLockedAdminActivityMode: false,
      joinActivityEnabled: true, joinedActivityId: 'activity', joinedActivityTitle: '活动',
      executePublish(data) { this.pending = this.submitToDatabase(data, []); },
      publishSuccess(data) { this.result = data; }, publishFail(error) { throw error; } });
    previewPage.publishAnonymously();
    await previewPage.pending;
    const id = previewPage.result._id;
    const detail = await backend(mem, 'getPostDetail')({ postId: id });
    assertPrivate(detail.post);
    assert.equal(detail.post.joinedActivityId, 'activity');
    // Edit the same post through the real add -> preview -> submit -> update path.
    Object.assign(addPage, { isEditMode: true, editingPostId: id, editingPost: detail.post });
    addPage.goToPreview();
    assert.equal(previewPost.isAnonymous, true);
    previewPage.post = previewPage.preparePreviewPost(previewPost);
    previewPage.publishFromAddPage();
    await previewPage.pending;
    assertPrivate((await backend(mem, 'getPostDetail', 'visitor')({ postId: id })).post);
    const missing = { ...previewPost }; delete missing.isAnonymous;
    assert.equal(previewPage.preparePreviewPost(missing).isAnonymous, true, 'Older preview payload uses editing post');

    const detailPage = page(load('pages/post-detail/post-detail.vue', globals), {
      post: detail.post, getCurrentUserId: () => currentUser,
      fetchFollowStatusWithCache() { throw Error('Anonymous post must not request follow status'); }
    });
    detailPage.prepareFollowState('123456');
    assert.equal(detailPage.isOwnPost, true);
    assert.equal(detailPage.showFollowButton, false);
    detailPage.post = { ...detail.post, isAuthor: false };
    currentUser = 'visitor';
    detailPage.prepareFollowState('123456');
    assert.equal(detailPage.isOwnPost, false);

    const avatar = load('utils/defaultAvatar.js');
    const normalizer = load('utils/postNormalizer.js', { ...avatar });
    const unsafe = { _id: id, _openid: 'owner', isAnonymous: true, realAuthorOpenid: 'owner', authorName: 'owner-name', authorSignature: 'owner-signature' };
    assertPrivate(normalizer.normalizePost(unsafe, { withTime: false }));
    const values = new Map();
    const ns = { keys: () => [...values.keys()], get: key => values.get(key), delete: key => values.delete(key),
      set: (key, value) => values.set(key, value),
      async getOrFetch(key, fetcher) { if (!values.has(key)) values.set(key, await fetcher()); return values.get(key); },
      update(key, updater) { if (!values.has(key)) return false; values.set(key, updater(values.get(key))); return true; } };
    let calls = 0;
    const api = load('api-cache/post.js', { cacheManager: { namespace: () => ns },
      getOpenid: () => currentUser, ...normalizer,
      async callCloudAndGetResult(name, payload) {
        calls++;
        assert.equal(payload.openid, currentUser);
        return backend(mem, name, currentUser)(payload);
      } });
    currentUser = 'owner';
    api.prefillPostDetail(detail.post);
    assert.equal((await api.getPostDetail(id)).post.isAuthor, true, 'Partial list must fetch permissions');
    await api.getPostDetail(id);
    assert.equal(calls, 1, 'Same-account cache still saves calls');
    currentUser = 'visitor';
    assert.equal((await api.getPostDetail(id)).post.isAuthor, false, 'Never reuse another account permissions');
    assert.equal(calls, 2);
    assert.equal(api.syncPostDetailCommentCount(id, 4), true);
    assert.equal((await api.getPostDetail(id)).commentCount, 4);
    api.invalidatePostDetail(id);
    assert.equal(values.size, 0);
    console.log('Anonymous posts: V1/V2 create, edit, activity, privacy, ownership, preview and account-scoped detail cache passed');
  } finally {
    if (previous === undefined) delete process.env.POSTS_WRITE_SCHEMA;
    else process.env.POSTS_WRITE_SCHEMA = previous;
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
