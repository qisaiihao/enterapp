const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../functions/getUserProfile/index.js'), 'utf8');
const originals = Array.from({ length: 24 }, (_, index) => ({
  _id: `post-${index}`, _openid: 'author', isOriginal: true, createTime: new Date(2026, 8, 12, 0, 0, 24 - index),
  ...(index < 11 ? { isHidden: true } : {}),
  ...(index === 12 ? { isActivityPost: true } : {}),
  ...(index === 13 ? { isHidden: false, isActivityPost: false } : {})
}));
const posts = [
  ...Array.from({ length: 13 }, (_, index) => ({
    _id: `repost-${index}`, _openid: 'author', createTime: new Date(2026, 8, 13, 0, 0, 13 - index),
    ...(index % 2 ? { isOriginal: false, isPoem: true } : {})
  })),
  ...originals
];
const user = { _openid: 'author', nickName: 'Author', avatarUrl: '/static/avatar.png' };

function runtime(caller = 'viewer', blocked = false, showNonOriginalPoems) {
  const author = { ...user, showNonOriginalPoems };
  function matches(filter, row) {
    return require('./helpers/posts-memory-db.cjs').matches(row, filter, {
      user_openid: author._openid,
      show_non_original_poems: author.showNonOriginalPoems
    });
  }
  const db = {
    command: { aggregate: {} },
    collection(name) {
      let pipeline;
      const query = {
        where() { return query; }, limit() { return query; }, field() { return query; },
        async get() {
          return { data: name === 'users' ? [{ ...author }] : name === 'blocks' && blocked ? [{ blockedId: 'author' }] : [] };
        },
        aggregate() { return query; }, match() { return query; }, project() { return query; },
        lookup(spec) { pipeline = spec.pipeline; return query; },
        async end() {
          let result = structuredClone(posts);
          for (const stage of pipeline) {
            if (stage.$match) result = result.filter(row => matches(stage.$match, row));
            if (stage.$sort) result.sort((a, b) => b.createTime - a.createTime);
            if (stage.$skip !== undefined) result = result.slice(stage.$skip);
            if (stage.$limit !== undefined) result = result.slice(0, stage.$limit);
          }
          return { list: [{ ...author, posts: result }] };
        }
      };
      return query;
    }
  };
  const sandbox = {
    exports: {}, console: { log() {}, warn() {}, error() {} },
    require(name) {
      if (name === './_lib/posts') return require('../functions/_shared/posts');
      if (name === 'wx-server-sdk') return { init() {}, database: () => db, getWXContext: () => ({ OPENID: caller }) };
      if (name.includes('default-avatar')) return { ensureUserDefaultAvatar: async () => user.avatarUrl };
      if (name.includes('get-blocked-user-ids')) return async () => blocked ? ['author'] : [];
      throw new Error(name);
    }
  };
  vm.runInNewContext(source, sandbox);
  return sandbox.exports.main;
}

async function main() {
  const read = runtime('viewer', false, true);
  const first = await read({ userId: 'author', skip: 0, limit: 10 });
  const second = await read({ userId: 'author', skip: 10, limit: 10 });
  const third = await read({ userId: 'author', skip: 20, limit: 10 });
  assert.equal(first.success, true);
  assert.equal(first.posts.length, 10, 'public posts fill the first page');
  const actual = [...first.posts, ...second.posts, ...third.posts].map(post => post._id);
  const expected = posts.filter(post => !post.isHidden && !post.isActivityPost).map(post => post._id);
  assert.deepEqual(actual, expected, 'enabled switch includes reposts and legacy posts before pagination');

  const hiddenRead = runtime('viewer', false, false);
  const hiddenPages = await Promise.all([0, 10, 20].map(skip => hiddenRead({ userId: 'author', skip, limit: 10 })));
  const visibleWhenHidden = posts.filter(post => !post.isHidden && !post.isActivityPost &&
    !(post.isOriginal === false && post.isPoem === true));
  assert.deepEqual(hiddenPages.flatMap(page => page.posts.map(post => post._id)), visibleWhenHidden.map(post => post._id),
    'disabled switch hides non-original poems before pagination while retaining legacy posts');
  const unset = await runtime()({ userId: 'author', skip: 0, limit: 40 });
  assert.deepEqual(unset.posts.map(post => post._id), visibleWhenHidden.map(post => post._id),
    'an account without the setting defaults to hiding non-original poems');
  assert.equal(unset.userInfo.showNonOriginalPoems, false);

  const owner = await runtime('author', false, true)({ userId: 'author', skip: 0, limit: 40 });
  assert.equal(owner.posts.length, 36, 'owner sees hidden posts and non-original poems when the switch is enabled');
  assert.equal(owner.posts.filter(post => post.isHidden).length, 11);
  const hiddenOwner = await runtime('author', false, false)({ userId: 'author', skip: 0, limit: 40 });
  assert.equal(hiddenOwner.posts.length, 30, 'owner also obeys the disabled switch');
  posts.unshift({ _id: 'legacy-anonymous', _openid: 'author', isOriginal: true, isAnonymous: true, createTime: new Date(2099, 0, 1) });
  const withoutAnonymous = await read({ userId: 'author', skip: 0, limit: 10 });
  assert.deepEqual(withoutAnonymous.posts.map(post => post._id), first.posts.map(post => post._id),
    'Anonymous legacy posts must not reveal their author through profile placement or occupy page slots');
  posts.shift();
  assert.equal((await runtime('viewer', true)({ userId: 'author' })).code, 'USER_BLOCKED');

  const profile = await read({ userId: 'author', onlyProfile: true });
  assert.equal(profile.success, true);
  assert.equal(profile.userInfo.nickName, 'Author');
  assert.equal(profile.posts.length, 0);
  console.log('[test-profile-pagination] PASS: visibility setting before pagination, legacy flags, owner visibility, blocking and profile-only reads');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
