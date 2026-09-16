const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../functions/vote/index.js'), 'utf8');
const clone = value => structuredClone(value);

// 模拟并发事务的快照、文档版本冲突和回滚；不把请求串行执行来掩盖竞态。
function runtime(seed, { failUpdate, forceConflict = false } = {}) {
  const tables = clone(seed);
  const versions = new Map();
  let nextId = 0;
  const stats = { conflicts: 0, attempts: 0 };
  const command = { inc: value => ({ increment: value }) };
  const keyOf = (name, id) => `${name}:${id}`;
  const matches = (row, filter) => Object.entries(filter).every(([key, value]) => row[key] === value);
  const rows = (data, name) => data[name] ||= [];

  function updateRow(row, data) {
    for (const [key, value] of Object.entries(data)) {
      const parts = key.split('.');
      let target = row;
      for (const part of parts.slice(0, -1)) target = target[part] ||= {};
      const last = parts.at(-1);
      target[last] = value && typeof value === 'object' && 'increment' in value
        ? (target[last] || 0) + value.increment : clone(value);
    }
  }

  function collection(name, tx) {
    const data = tx ? tx.data : tables;
    const touch = (id, write = false) => {
      const key = keyOf(name, id);
      if (tx) {
        tx.reads.set(key, tx.versions.get(key) || 0);
        if (write) tx.writes.set(key, { name, id });
      } else if (write) versions.set(key, (versions.get(key) || 0) + 1);
    };
    return {
      doc(id) {
        return {
          async get() {
            touch(id);
            return { data: clone(rows(data, name).find(row => row._id === id) || null) };
          },
          async update({ data: changes }) {
            if (name === failUpdate) throw new Error('injected write failure');
            const row = rows(data, name).find(row => row._id === id);
            assert.ok(row, `missing update target ${name}/${id}`);
            touch(id, true);
            updateRow(row, changes);
            return { stats: { updated: 1 } };
          },
          async remove() {
            touch(id, true);
            const previous = rows(data, name);
            data[name] = previous.filter(row => row._id !== id);
            return { stats: { removed: previous.length - data[name].length } };
          }
        };
      },
      where(filter) {
        assert.ok(!tx, 'CloudBase transactions only support document operations, not where');
        let limit = Infinity;
        const query = {
          limit(value) { limit = value; return query; },
          async get() { return { data: clone(rows(data, name).filter(row => matches(row, filter)).slice(0, limit)) }; },
          async update({ data: changes }) {
            const selected = rows(data, name).filter(row => matches(row, filter));
            for (const row of selected) { touch(row._id, true); updateRow(row, changes); }
            return { stats: { updated: selected.length } };
          }
        };
        return query;
      },
      async add({ data: value }) {
        const row = { ...clone(value), _id: `new-${++nextId}` };
        touch(row._id, true);
        rows(data, name).push(row);
        return { _id: row._id };
      }
    };
  }

  const db = {
    command, serverDate: () => new Date(), collection: name => collection(name),
    async runTransaction(callback) {
      for (let attempt = 0; attempt < 4; attempt++) {
        stats.attempts++;
        const tx = { data: clone(tables), versions: new Map(versions), reads: new Map(), writes: new Map() };
        const result = await callback({ collection: name => collection(name, tx) });
        const conflict = [...tx.reads].some(([key, version]) => (versions.get(key) || 0) !== version);
        if (conflict || forceConflict) {
          forceConflict = false;
          stats.conflicts++;
          continue;
        }
        for (const [key, { name, id }] of tx.writes) {
          const row = rows(tx.data, name).find(item => item._id === id);
          tables[name] = rows(tables, name).filter(item => item._id !== id);
          if (row) tables[name].push(clone(row));
          versions.set(key, (versions.get(key) || 0) + 1);
        }
        return result;
      }
      throw new Error('transaction retry limit');
    }
  };
  const sandbox = {
    exports: {}, console: { log() {}, warn() {}, error() {} },
    require(name) {
      assert.equal(name, 'wx-server-sdk');
      return { init() {}, database: () => db, getWXContext: () => ({ OPENID: 'viewer' }) };
    }
  };
  vm.runInNewContext(source, sandbox);
  return { vote: sandbox.exports.main, tables, stats };
}

function fixture(votes = 0, postFields = {}) {
  const counts = { seed: 0, leaf: 0, flower: 0, peach: 0 };
  if (votes > 0) counts[votes < 4 ? 'seed' : votes < 8 ? 'leaf' : votes < 16 ? 'flower' : 'peach'] = 1;
  return {
    posts: [{ _id: 'post', _openid: 'author', votes, ...postFields }],
    users: [{ _id: 'author-doc', _openid: 'author', nickName: 'Author', growthCounts: counts }],
    votes_log: Array.from({ length: votes }, (_, index) => ({
      _id: `legacy-${index}`, _openid: `old-liker-${index}`, postId: 'post', type: 'post'
    })),
    messages: []
  };
}

async function main() {
  for (const [start, expected] of [
    [0, { seed: 1, leaf: 0, flower: 0, peach: 0 }],
    [3, { seed: 0, leaf: 1, flower: 0, peach: 0 }],
    [7, { seed: 0, leaf: 0, flower: 1, peach: 0 }],
    [15, { seed: 0, leaf: 0, flower: 0, peach: 1 }]
  ]) {
    const r = runtime(fixture(start));
    const results = await Promise.all(['liker-a', 'liker-b'].map(openid => r.vote({ postId: 'post', openid })));
    assert.ok(results.every(result => result.success && result.isLiked));
    assert.equal(r.tables.posts[0].votes, start + 2);
    assert.equal(r.tables.votes_log.length, start + 2);
    assert.deepEqual(r.tables.users[0].growthCounts, expected, `concurrent threshold ${start}`);
    assert.equal(r.tables.messages.length, 2, 'transaction retries must not duplicate notifications');
    assert.ok(r.stats.conflicts > 0, 'the test must exercise a real overlapping snapshot conflict');
  }

  for (const start of [0, 1]) {
    const r = runtime(fixture(start));
    const results = await Promise.all([0, 1].map(() => r.vote({ postId: 'post', openid: 'old-liker-0' })));
    assert.ok(results.every(result => result.success));
    assert.equal(r.tables.posts[0].votes, start, 'two same-user toggles restore the initial vote count');
    assert.equal(r.tables.votes_log.length, start, 'legacy random-ID logs must still be cancellable');
    assert.equal(r.tables.users[0].growthCounts.seed, start);
    assert.equal(r.tables.messages.length, 1);
  }

  for (const start of [1, 4, 8, 16]) {
    const r = runtime(fixture(start));
    const result = await r.vote({ postId: 'post', openid: 'old-liker-0' });
    assert.equal(result.success, true);
    assert.equal(result.isLiked, false);
    assert.equal(result.votes, start - 1);
    assert.deepEqual(r.tables.users[0].growthCounts, fixture(start - 1).users[0].growthCounts);
  }

  const twoPosts = fixture();
  twoPosts.posts.push({ ...twoPosts.posts[0], _id: 'other-post' });
  const sameAuthor = runtime(twoPosts);
  const results = await Promise.all(['post', 'other-post'].map(postId => sameAuthor.vote({ postId })));
  assert.ok(results.every(result => result.success));
  assert.equal(sameAuthor.tables.users[0].growthCounts.seed, 2, 'concurrent posts must not lose a shared author update');
  assert.equal(sameAuthor.tables.messages.length, 2);

  const failed = runtime(fixture(3), { failUpdate: 'users' });
  assert.equal((await failed.vote({ postId: 'post' })).success, false);
  assert.deepEqual(failed.tables, fixture(3), 'failed growth update must roll back the vote and log');

  const retry = runtime(fixture(), { forceConflict: true });
  assert.equal((await retry.vote({ postId: 'post' })).success, true);
  assert.equal(retry.tables.posts[0].votes, 1);
  assert.equal(retry.tables.votes_log.length, 1);
  assert.equal(retry.tables.messages.length, 1);

  const anonymous = runtime(fixture(0, { _openid: '123456', isAnonymous: true, realAuthorOpenid: 'author' }));
  assert.equal((await anonymous.vote({ postId: 'post' })).success, true);
  assert.equal(anonymous.tables.users[0].growthCounts.seed, 1);
  assert.equal(anonymous.tables.messages[0].toUserId, 'author');
  assert.equal(anonymous.tables.users.length, 1, 'do not create the shared anonymous account');
  const cancelled = await anonymous.vote({ postId: 'post' });
  assert.equal(cancelled.isLiked, false);
  assert.equal(anonymous.tables.users[0].growthCounts.seed, 0);

  const self = runtime(fixture(0, { _openid: '123456', isAnonymous: true, realAuthorOpenid: 'author' }));
  await self.vote({ postId: 'post', openid: 'author' });
  assert.equal(self.tables.messages.length, 0, 'anonymous self-likes must not notify the author');

  const ownerMissing = runtime(fixture(0, { _openid: '123456', isAnonymous: true }));
  assert.equal((await ownerMissing.vote({ postId: 'post' })).success, true);
  assert.equal(ownerMissing.tables.messages.length, 0);
  assert.equal(ownerMissing.tables.users.length, 1);
  assert.equal(ownerMissing.tables.users[0].growthCounts.seed, 0);

  const legacyAnonymous = runtime(fixture(0, { isAnonymous: true }));
  await legacyAnonymous.vote({ postId: 'post' });
  assert.equal(legacyAnonymous.tables.messages[0].toUserId, 'author', 'legacy anonymous posts with a real _openid retain their author');

  const removedAuthorSeed = fixture();
  removedAuthorSeed.users = [];
  const removedAuthor = runtime(removedAuthorSeed);
  assert.equal((await removedAuthor.vote({ postId: 'post' })).success, true);
  assert.equal(removedAuthor.tables.users.length, 0, 'liking a post must not recreate a removed account');
  console.log('[test-vote-consistency] PASS: concurrent thresholds, retries, rollback, legacy logs, anonymous author and self-likes');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
