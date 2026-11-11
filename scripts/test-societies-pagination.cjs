'use strict';
const assert = require('node:assert/strict');
const { runtime, ok } = require('./test-societies.cjs');
const { membershipId } = require('../functions/societyManager/lib/common');

async function main() {
  const { INDEXES, indexName } = require('./deploy-societies.cjs');
  for (const definitions of Object.values(INDEXES)) assert.equal(new Set(definitions.map(indexName)).size, definitions.length, 'ascending and descending index definitions need distinct names');
  const app = runtime();
  const now = Date.now();
  const future = hours => new Date(now + hours * 3600000);
  app.seed('societies', [
    { _id: 'a', name: '甲诗社', school: '广州大学', status: 'active' },
    { _id: 'b', name: '乙诗社', school: '深圳大学', status: 'active' },
    { _id: 'off', name: '停用诗社', school: '珠海大学', status: 'inactive' }
  ]);
  const call = (id, societyId = 'a', extra = {}) => ({ _id: id, societyId, title: id, status: 'published', deadline: future(24), createdAt: new Date(now), ...extra });
  app.seed('society_calls', [
    ...Array.from({ length: 225 }, (_, index) => call(`past-${index}`, 'a', { deadline: new Date(now - 3600000), createdAt: new Date(now + index) })),
    call('older-current', 'a', { createdAt: new Date(0) })
  ]);
  assert.deepEqual((await ok(app.call({ action: 'callList' }))).calls.map(row => row._id), ['older-current'], 'a current call beyond 200 newer rows must remain discoverable');
  assert.equal((await ok(app.call({ action: 'home' }))).pastCallTotal, 225, 'home totals cover the full collection');

  app.seed('society_calls', [
    ...Array.from({ length: 25 }, (_, index) => call(`visible-${String(index).padStart(2, '0')}`, 'a', { deadline: future(index + 1) })),
    ...Array.from({ length: 22 }, (_, index) => call(`hidden-${index}`, 'off', { createdAt: future(1) }))
  ]);
  const first = await ok(app.call({ action: 'callList', limit: 20 }));
  const second = await ok(app.call({ action: 'callList', skip: 20, limit: 20 }));
  assert.equal(first.total, 25, 'inactive owners do not inflate counts');
  assert.equal(first.calls.length, 20, 'inactive owners do not occupy visible page slots');
  assert.equal(first.hasMore, true);
  assert.equal(second.calls.length, 5);
  assert.equal(second.hasMore, false);
  assert.equal(new Set([...first.calls, ...second.calls].map(row => row._id)).size, 25, 'equal timestamps paginate deterministically');
  const ending = await ok(app.call({ action: 'callList', filter: 'ending', limit: 2 }));
  assert.deepEqual(ending.calls.map(row => row._id), ['visible-00', 'visible-01']);
  const home = await ok(app.call({ action: 'home' }));
  assert.equal(home.currentCallTotal, 25);
  assert.equal(home.calls.length, 6);

  app.user('bob').school = '深圳';
  app.seed('society_members', [{ _id: membershipId('b', 'bob'), societyId: 'b', userId: 'bob', role: 'owner', status: 'active' }]);
  app.seed('society_calls', [
    call('open-legacy', 'a'),
    call('confirmed-school', 'a', { audience: 'school', hostSocietyIds: ['a', 'b'] }),
    call('invited-school', 'a', { audience: 'school', hostSocietyIds: ['a'], invitedSocietyIds: ['b'] }),
    call('confirmed-member', 'a', { audience: 'members', hostSocietyIds: ['a', 'b'] })
  ]);
  const eligible = await ok(app.call({ action: 'callList', availableOnly: true }, 'bob'));
  assert.deepEqual(eligible.calls.map(row => row._id).sort(), ['confirmed-member', 'confirmed-school', 'open-legacy']);
  assert.deepEqual((await ok(app.call({ action: 'callList', availableOnly: true }))).calls.map(row => row._id), ['open-legacy']);
  app.tables.societies.find(row => row._id === 'b').status = 'inactive';
  assert.deepEqual((await ok(app.call({ action: 'callList', availableOnly: true }, 'bob'))).calls.map(row => row._id), ['open-legacy'], 'inactive co-hosts no longer confer eligibility');
  app.seed('posts', [{ _id: 'poem', _openid: 'bob', isPoem: true, isOriginal: true, auditStatus: 'approved', title: '诗', content: '诗行' }]);
  for (const id of ['confirmed-member', 'confirmed-school']) assert.equal((await app.call({ action: 'submitWork', id, postId: 'poem' }, 'bob')).code, 'FORBIDDEN');

  const rows = Array.from({ length: 25 }, (_, index) => call(`entry-${String(index).padStart(2, '0')}`, 'a', { content: '正文', pinned: index === 0, createdAt: new Date(index * 1000), registrationEnd: future(24) }));
  for (const table of ['society_news', 'society_events', 'society_calls']) app.seed(table, rows);
  const detail = await ok(app.call({ action: 'detail', societyId: 'a' }));
  assert.equal(detail.news[0]._id, 'entry-00', 'an old pinned announcement appears before pagination');
  for (const [tab, kind] of [['news', 'news'], ['events', 'event'], ['calls', 'call']]) {
    assert.equal(detail[tab].length, 20);
    const pagination = detail.contentPages[tab];
    assert.equal(pagination.hasMore, true);
    const more = await ok(app.call({ action: 'societyContent', societyId: 'a', kind, skip: pagination.nextSkip, limit: 20 }));
    assert.equal(more.records.length, 5);
    assert.equal(more.hasMore, false);
    assert.equal(new Set([...detail[tab], ...more.records].map(row => row._id)).size, 25);
  }
  assert.equal((await app.call({ action: 'societyContent', societyId: 'a', kind: '__proto__' })).code, 'INVALID_REQUEST');
  assert.equal((await app.call({ action: 'societyContent', societyId: 'off', kind: 'event' })).code, 'NOT_FOUND');

  const users = Array.from({ length: 25 }, (_, index) => ({ _id: `member-${index}`, _openid: `member-${index}`, nickName: `成员${index}` }));
  app.tables.users.push(...users);
  app.seed('society_members', [
    { _id: membershipId('a', 'alice'), societyId: 'a', userId: 'alice', userDocId: 'alice-doc', role: 'owner', status: 'active', joinedAt: new Date(0) },
    ...Array.from({ length: 27 }, (_, index) => ({ _id: `membership-${index}`, societyId: 'a', userId: `member-${index}`, userDocId: `member-${index}`, role: 'member', status: 'active', joinedAt: new Date(index * 1000) }))
  ]);
  for (const action of ['publicMembers', 'memberList', 'memberDirectory']) {
    const result = await ok(app.call({ action, societyId: 'a', limit: 20 }, 'alice'));
    assert.equal(result.members.length, 18, `${action}: unavailable profiles are omitted`);
    assert.equal(result.hasMore, true, `${action}: unavailable profiles must not end pagination`);
    assert.equal(result.nextSkip, 20);
    const more = await ok(app.call({ action, societyId: 'a', skip: result.nextSkip, limit: 20 }, 'alice'));
    const expected = action === 'memberDirectory' ? 25 : 26;
    assert.equal(new Set([...result.members, ...more.members].map(row => row.userId)).size, expected, `${action}: no duplicate or skipped visible members`);
    assert.equal(more.hasMore, false);
  }
  console.log('societies pagination: PASS — full call queries, inactive owners, scopes, pinned news, content pages and missing member profiles');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
