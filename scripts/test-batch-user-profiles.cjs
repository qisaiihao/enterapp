const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function runtime({ authenticated = true, fail = false } = {}) {
  const calls = [], urlCalls = [];
  const db = {
    command: { in: ids => ids },
    collection: name => {
      assert.equal(name, 'users');
      let ids, fields, limit;
      const query = {
        where: value => { ids = value._openid; return query; },
        field: value => { fields = value; return query; },
        limit: value => { limit = value; return query; },
        get: async () => {
          if (fail) throw new Error('database unavailable');
          calls.push({ ids, fields, limit });
          // 故意返回额外字段，同时验证应用层白名单不会泄露数据。
          return { data: ids.slice(0, limit || 20).map(_openid => ({
            _id: `doc-${_openid}`, _openid, nickName: _openid, bio: 'public', avatarUrl: `cloud://${_openid}`,
            password: 'do-not-return', phoneNumber: 'private', githubEmail: 'private', birthday: 'private', futureSecret: 'private'
          })) };
        }
      };
      return query;
    }
  };
  const cloud = {
    init() {}, DYNAMIC_CURRENT_ENV: 'test', database: () => db,
    getWXContext: () => ({ OPENID: authenticated ? 'viewer' : '' }),
    getTempFileURL: async ({ fileList }) => {
      assert.ok(fileList.length <= 50);
      urlCalls.push(fileList);
      return { fileList: fileList.map(fileID => ({ fileID, status: 0, tempFileURL: `https://img/${fileID}` })) };
    }
  };
  const scope = { exports: {}, console: { error() {} }, require: name => {
    assert.equal(name, 'wx-server-sdk'); return cloud;
  } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../functions/getBatchUserProfiles/index.js'), 'utf8'), scope);
  return { main: scope.exports.main, calls, urlCalls };
}

(async () => {
  const ids = Array.from({ length: 65 }, (_, i) => `user-${i}`);
  const app = runtime();
  const result = await app.main({ userIds: [...ids, ids[0], null, ''] });
  assert.equal(result.success, true);
  assert.equal(result.userProfiles.length, 65, 'more than default query limit is complete');
  assert.equal(app.calls.length, 4);
  assert.deepEqual(app.urlCalls.map(ids => ids.length), [50, 15]);
  assert.ok(app.calls.every(call => call.fields.password === undefined && call.fields._openid === 1 && call.limit >= call.ids.length));
  for (const profile of result.userProfiles) {
    assert.deepEqual(Object.keys(profile).sort(), ['_id', '_openid', 'avatarFileID', 'avatarUrl', 'bio', 'nickName'].sort());
    assert.ok(profile.avatarUrl.startsWith('https://'), 'old clients retain display URLs');
    assert.ok(profile.avatarFileID.startsWith('cloud://'));
  }
  const raw = runtime();
  const rawResult = await raw.main({ userIds: ids, rawAvatar: true });
  assert.equal(rawResult.userProfiles.length, 65);
  assert.equal(raw.urlCalls.length, 0, 'new clients resolve through unified client URL cache');
  assert.ok(rawResult.userProfiles.every(user => user.avatarUrl.startsWith('cloud://')));
  const noAuth = runtime({ authenticated: false });
  assert.equal((await noAuth.main({ userIds: ids })).code, 'NO_OPENID');
  assert.equal(noAuth.calls.length, 0);
  assert.equal((await runtime({ fail: true }).main({ userIds: ids })).success, false);
  for (const userIds of [[], null, [''], Array.from({ length: 101 }, (_, i) => `u${i}`)]) {
    const invalid = runtime();
    assert.equal((await invalid.main({ userIds })).success, false);
    assert.equal(invalid.calls.length, 0);
  }
  console.log('[test-batch-user-profiles] PASS: public allowlist, 65 users, bounded URL batches, old/new clients, auth, validation and failure');
})().catch(error => { console.error(error); process.exitCode = 1; });
