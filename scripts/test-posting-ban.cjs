const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const cloud = require('wx-server-sdk');
const { memoryDb } = require('./helpers/posts-memory-db.cjs');

cloud.init({ env: 'posting-ban-test' });
const command = cloud.database().command;
const root = path.resolve(__dirname, '..');
const quiet = { log() {}, warn() {}, error() {} };

function backend(mem, name, caller = 'owner') {
  const filename = path.join(root, 'functions', name, 'index.js');
  const localRequire = createRequire(filename);
  const sandbox = {
    exports: {}, process, Buffer, console: quiet,
    require(id) {
      if (id === 'wx-server-sdk') return {
        DYNAMIC_CURRENT_ENV: 'posting-ban-test', init() {},
        database: () => mem.db, getWXContext: () => ({ OPENID: caller }),
        uploadFile: () => { throw Error('Banned user reached uploadFile'); },
        callFunction: async () => ({ result: { success: true, passed: true } })
      };
      if (id === './_lib/admin-auth') return { isAdminByPoemId: async () => caller === 'admin' };
      if (id === './moderation') return { createModerationService: () => ({
        moderate: async () => ({ success: true, passed: true })
      }) };
      return localRequire(id);
    }
  };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), sandbox, { filename });
  return event => sandbox.exports.main({ ...event, openid: caller }, {});
}

async function main() {
  const mem = memoryDb({
    users: [{ _id: 'user-1', _openid: 'owner', poemId: 'poem-1', nickName: '测试用户' }],
    posts: [{ _id: 'source', _openid: 'owner', title: '原诗', content: '第一行' }]
  }, command);
  const admin = backend(mem, 'adminManager', 'admin');
  const lookup = await admin({ action: 'findPostingUser', poemId: 'poem-1' });
  assert.equal(lookup.success, true);
  assert.equal(lookup.user.postingBanned, false);
  assert.equal('password' in lookup.user, false);
  assert.equal((await backend(mem, 'adminManager')({ action: 'setPostingBan', poemId: 'poem-1', banned: true })).success, false);
  assert.equal(mem.tables.users[0].postingBanned, undefined);
  assert.equal((await admin({ action: 'setPostingBan', poemId: 'poem-1', banned: 'true' })).success, false);
  const banned = await admin({ action: 'setPostingBan', poemId: 'poem-1', banned: true });
  assert.equal(banned.success, true);
  assert.equal(mem.tables.users[0].postingBanned, true);

  const before = mem.tables.posts.length;
  const attempts = [
    ['createPost', { title: '新帖', content: '正文' }],
    ['contentCheck', { title: '新帖', content: '正文' }],
    ['createDiscussionPost', { quotedPostId: 'source', content: '正文', sentenceGroups: [{ sentences: ['第一行'], comment: '评论' }] }],
    ['createSeriesFromSingles', { blocks: [{ postId: 'source' }] }],
    ['uploadCollagePoetry', { fileContent: 'aGVsbG8=', cloudPath: 'collage/test.jpg' }]
  ];
  for (const [name, event] of attempts) {
    const result = await backend(mem, name)(event);
    assert.equal(result.errorCode || result.code, 'POSTING_BANNED', `${name}: ${JSON.stringify(result)}`);
    assert.equal(mem.tables.posts.length, before, `${name} must not create a post`);
  }

  const restored = await admin({ action: 'setPostingBan', poemId: 'poem-1', banned: false });
  assert.equal(restored.success, true);
  assert.equal((await backend(mem, 'createPost')({ title: '恢复后', content: '正文' })).code, 0);
  assert.equal(mem.tables.posts.length, before + 1);
  console.log('Posting ban checks passed');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
