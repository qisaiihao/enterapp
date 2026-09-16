const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../functions/getUserProfile/index.js'), 'utf8');
const posts = Array.from({ length: 24 }, (_, index) => ({
  _id: `post-${index}`, _openid: 'author', createTime: new Date(2026, 8, 12, 0, 0, 24 - index),
  ...(index < 11 ? { isHidden: true } : {}),
  ...(index === 12 ? { isActivityPost: true } : {}),
  ...(index === 13 ? { isHidden: false, isActivityPost: false } : {})
}));
const user = { _openid: 'author', nickName: 'Author', avatarUrl: '/static/avatar.png' };

function runtime(caller = 'viewer', blocked = false) {
  function expression(value, row) {
    if (typeof value === 'string' && value.startsWith('$$')) return user._openid;
    if (typeof value === 'string' && value.startsWith('$')) return row[value.slice(1)];
    if (!value || typeof value !== 'object') return value;
    if (value.$and) return value.$and.every(part => expression(part, row));
    if (value.$eq) return expression(value.$eq[0], row) === expression(value.$eq[1], row);
    if (value.$ne) return expression(value.$ne[0], row) !== expression(value.$ne[1], row);
    throw new Error(`unsupported expression ${JSON.stringify(value)}`);
  }
  function matches(filter, row) {
    return Object.entries(filter).every(([key, value]) => {
      if (key === '$expr') return expression(value, row);
      if (value && typeof value === 'object' && '$ne' in value) return row[key] !== value.$ne;
      if (value && typeof value === 'object' && '$nin' in value) return !value.$nin.includes(row[key]);
      return row[key] === value;
    });
  }
  const db = {
    command: { aggregate: {} },
    collection(name) {
      let pipeline;
      const query = {
        where() { return query; }, limit() { return query; }, field() { return query; },
        async get() {
          return { data: name === 'users' ? [{ ...user }] : name === 'blocks' && blocked ? [{ blockedId: 'author' }] : [] };
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
          return { list: [{ ...user, posts: result }] };
        }
      };
      return query;
    }
  };
  const sandbox = {
    exports: {}, console: { log() {}, warn() {}, error() {} },
    require(name) {
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
  const read = runtime();
  const first = await read({ userId: 'author', skip: 0, limit: 10 });
  const second = await read({ userId: 'author', skip: 10, limit: 10 });
  assert.equal(first.success, true);
  assert.equal(first.posts.length, 10, 'hidden posts must not occupy slots in the first page');
  assert.equal(second.posts.length, 2);
  const actual = [...first.posts, ...second.posts].map(post => post._id);
  const expected = posts.filter(post => !post.isHidden && !post.isActivityPost).map(post => post._id);
  assert.deepEqual(actual, expected, 'all public posts, including old documents with missing flags, must be reachable');
  assert.equal((await read({ userId: 'author', skip: 20, limit: 10 })).posts.length, 0);

  const owner = await runtime('author')({ userId: 'author', skip: 0, limit: 30 });
  assert.equal(owner.posts.length, 23, 'owner still sees hidden posts, excluding official activity posts');
  assert.equal(owner.posts.filter(post => post.isHidden).length, 11);
  assert.equal((await runtime('viewer', true)({ userId: 'author' })).code, 'USER_BLOCKED');

  const profile = await read({ userId: 'author', onlyProfile: true });
  assert.equal(profile.success, true);
  assert.equal(profile.userInfo.nickName, 'Author');
  assert.equal(profile.posts.length, 0);
  console.log('[test-profile-pagination] PASS: hidden first page, complete pagination, legacy flags, owner visibility, blocking and profile-only reads');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
