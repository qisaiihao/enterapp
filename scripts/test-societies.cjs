const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const serviceRoot = path.join(root, 'functions/societyManager');
const { hash, membershipId } = require(path.join(serviceRoot, 'lib/common'));
const { uploadPrefix } = require(path.join(serviceRoot, 'lib/applications'));

function runtime() {
  let version = 0;
  let tables = {
    users: [
      { _id: 'alice-doc', _openid: 'alice', poemId: 'alice-poem', nickName: '小林', password: 'alice-secret' },
      { _id: 'bob-doc', _openid: 'bob', poemId: 'bob-poem', nickName: '小河', password: 'bob-secret' },
      { _id: 'admin-doc', _openid: 'admin', poemId: 'platform-admin', nickName: '平台', password: 'admin-secret' },
      { _id: 'other-doc', _openid: 'other', poemId: 'other-poem', nickName: '另一位作者', password: 'other-secret' }
    ],
    adminConfig: [{ _id: 'admin', adminPoemIds: ['platform-admin'] }]
  };
  let caller = '';
  const state = { failWrite: '', calls: [], conflicts: 0, moderationPassed: true };
  const matches = (row, filter) => {
    if (filter?.$and) return filter.$and.every(item => matches(row, item));
    if (filter?.$or) return filter.$or.some(item => matches(row, item));
    return Object.entries(filter || {}).every(([key, value]) => value?.$regex
      ? new RegExp(value.$regex, value.options).test(row[key] || '') : value?.$in !== undefined ? (Array.isArray(row[key]) ? row[key].some(item => value.$in.includes(item)) : value.$in.includes(row[key])) : value?.$gte !== undefined ? row[key] >= value.$gte : value?.$gt !== undefined ? row[key] > value.$gt : value?.$lte !== undefined ? row[key] != null && row[key] <= value.$lte : value?.$neq !== undefined ? row[key] !== value.$neq : Array.isArray(row[key]) ? row[key].includes(value) : row[key] === value);
  };
  function collection(name, transaction) {
    const data = transaction ? transaction.tables : tables;
    data[name] ||= [];
    const read = () => { if (transaction?.wrote) throw new Error('CloudBase transactions must read before writing'); };
    const write = () => {
      if (state.failWrite === name) throw new Error('Simulated write failure');
      if (transaction) transaction.wrote = true; else version++;
    };
    return {
      doc(documentId) {
        return {
          async get() { read(); return { data: structuredClone(data[name].find(row => row._id === documentId) || null) }; },
          async set({ data: value }) { write(); const index = data[name].findIndex(row => row._id === documentId); const row = { ...structuredClone(value), _id: documentId }; if (index < 0) data[name].push(row); else data[name][index] = row; },
          async update({ data: value }) { write(); const row = data[name].find(row => row._id === documentId); if (!row) throw new Error('Missing document'); Object.assign(row, structuredClone(value)); },
          async remove() { write(); data[name] = data[name].filter(row => row._id !== documentId); }
        };
      },
      where(filter) {
        let skip = 0, limit = 100, fields;
        const orders = [];
        const query = {
          skip(value) { skip = value; return query; }, limit(value) { limit = value; return query; },
          orderBy(key, value) { orders.push([key, value]); return query; }, field(value) { fields = value; return query; },
          async count() { read(); return { total: data[name].filter(row => matches(row, filter)).length }; },
          async remove() { write(); const before = data[name].length; data[name] = data[name].filter(row => !matches(row, filter)); return { stats: { removed: before - data[name].length } }; },
          async get() {
            read();
            let rows = data[name].filter(row => matches(row, filter));
            if (orders.length) rows = rows.sort((a, b) => {
              for (const [key, direction] of orders) {
                const left = a[key] ?? false, right = b[key] ?? false;
                const comparison = (left > right ? 1 : left < right ? -1 : 0) * (direction === 'desc' ? -1 : 1);
                if (comparison) return comparison;
              }
              return 0;
            });
            rows = rows.slice(skip, skip + limit);
            if (fields) rows = rows.map(row => Object.fromEntries(Object.entries(row).filter(([key]) => key === '_id' || fields[key])));
            return { data: structuredClone(rows) };
          }
        };
        return query;
      }
    };
  }
  const db = {
    command: { gte: value => ({ $gte: value }), gt: value => ({ $gt: value }), lte: value => ({ $lte: value }), neq: value => ({ $neq: value }), in: values => ({ $in: values }), and: values => ({ $and: values }), or: values => ({ $or: values }) },
    RegExp: ({ regexp, options }) => ({ $regex: regexp, options }),
    collection: name => collection(name),
    async runTransaction(callback) {
      for (let attempt = 0; attempt < 20; attempt++) {
        const previous = version;
        const transaction = { tables: structuredClone(tables), wrote: false };
        const result = await callback({ collection: name => collection(name, transaction) });
        if (previous !== version) { state.conflicts++; continue; }
        if (transaction.wrote) { tables = transaction.tables; version++; }
        return result;
      }
      throw new Error('Conflict retries exhausted');
    }
  };
  const cloud = {
    init() {}, database: () => db, getWXContext: () => ({ OPENID: caller }),
    async callFunction(request) {
      state.calls.push(request.name);
      if (request.name === 'contentCheck') return { result: { success: true, passed: state.moderationPassed } };
      assert.equal(request.name, 'loginWithCredentials');
      const user = tables.users.find(row => row.poemId === request.data.poemId && row.password === request.data.password);
      return { result: user ? { success: true, openid: user._openid } : { success: false } };
    },
    async getTempFileURL({ fileList }) { return { fileList: fileList.map(fileID => ({ fileID, tempFileURL: 'https://signed.example/' + encodeURIComponent(fileID) })) }; }
  };
  const context = { exports: {}, console: { error() {} }, require(name) { return name === 'wx-server-sdk' ? cloud : require(path.join(serviceRoot, name)); } };
  vm.runInNewContext(fs.readFileSync(path.join(serviceRoot, 'index.js'), 'utf8'), context);
  return {
    state, get tables() { return tables; },
    call(event, wxid = '') { caller = wxid; return context.exports.main(event); },
    seed(name, rows) { tables[name] = structuredClone(rows); version++; },
    user(name) { return tables.users.find(row => row._openid === name); }
  };
}

function form(user, name = '回车键诗社') {
  const prefix = `cloud://test.bucket/${uploadPrefix(user)}`;
  return { name, school: '回车键大学', region: '上海', contactName: '负责人', phone: '13800000000',
    description: '一群热爱诗歌的人在校园里相聚。', motto: '以诗为邻', foundedAt: '2001-02-01',
    avatarUrl: `${prefix}/avatar/avatar.png`, proofFiles: [`${prefix}/proof/proof.png`], agreed: true };
}
async function ok(promise) { const result = await promise; assert.equal(result.success, true, JSON.stringify(result)); return result; }

async function main() {
  const app = runtime();
  assert.equal((await app.call({ action: 'myApplication' })).code, 'AUTH_REQUIRED', 'requests without a logged-in account are rejected');
  const actor = { openid: 'alice' };
  await ok(app.call({ action: 'myApplication', ...actor }));
  await ok(app.call({ action: 'myApplication' }, 'alice'));
  assert.equal((await app.call({ action: 'myApplication', openid: 'bob' }, 'alice')).code, 'AUTH_REQUIRED', 'client account cannot override the verified WeChat identity');
  assert.equal((await app.call({ action: 'listApplications', openid: 'admin' }, 'alice')).code, 'AUTH_REQUIRED');
  assert.equal((await app.call({ action: '__proto__' })).code, 'INVALID_ACTION');
  const aliceForm = form(app.user('alice'));
  const [submission, duplicate] = await Promise.all([
    ok(app.call({ action: 'submitApplication', ...actor, form: aliceForm })),
    ok(app.call({ action: 'submitApplication', ...actor, form: aliceForm }))
  ]);
  assert.equal(submission.applicationId, duplicate.applicationId);
  assert.equal(app.tables.society_applications.length, 1);
  assert.equal(app.tables.society_applications[0].revision, 1);
  assert.equal((await app.call({ action: 'reviewApplication', applicationId: submission.applicationId, revision: 1, decision: 'approved' }, 'bob')).code, 'FORBIDDEN');
  assert.equal((await app.call({ action: 'reviewApplication', applicationId: submission.applicationId, revision: 0, decision: 'approved' }, 'admin')).code, 'STALE_REVIEW');

  app.state.failWrite = 'society_members';
  assert.equal((await app.call({ action: 'reviewApplication', applicationId: submission.applicationId, revision: 1, decision: 'approved' }, 'admin')).success, false);
  assert.equal(app.tables.society_applications[0].status, 'pending');
  assert.equal((app.tables.societies || []).length, 0, 'approval rolls back if owner membership fails');
  app.state.failWrite = '';
  app.state.failWrite = 'society_follows';
  assert.equal((await app.call({ action: 'reviewApplication', applicationId: submission.applicationId, revision: 1, decision: 'approved' }, 'admin')).success, false);
  assert.equal(app.tables.society_applications[0].status, 'pending');
  assert.equal((app.tables.societies || []).length, 0, 'approval rolls back if automatic follow fails');
  app.state.failWrite = '';
  const approvals = await Promise.all([1, 2].map(() => ok(app.call({ action: 'reviewApplication', applicationId: submission.applicationId, revision: 1, decision: 'approved' }, 'admin'))));
  const societyId = approvals[0].societyId;
  assert.equal(app.tables.societies.length, 1);
  assert.equal(app.tables.society_members.length, 1);
  assert.equal(app.tables.societies[0].memberCount, 1);
  assert.equal(app.tables.society_members[0].role, 'owner');
  assert.equal(app.tables.society_follows.find(row => row.societyId === societyId && row.userId === 'alice')?.following, true, 'the founding owner follows their society');
  assert.equal(app.tables.societies[0].recruitment, 'open', 'recruitment defaults to open when omitted');
  const publicHome = await ok(app.call({ action: 'home' }));
  assert.equal(publicHome.societies.length, 1);
  assert.ok(!JSON.stringify(publicHome).includes(aliceForm.phone));
  assert.ok(!JSON.stringify(publicHome).includes('/proof/'));
  assert.ok(!JSON.stringify(publicHome).includes('password'));
  const anonymousDetail = await ok(app.call({ action: 'detail', societyId }));
  assert.equal(anonymousDetail.relationship.role, '');
  const detail = await ok(app.call({ action: 'detail', societyId, ...actor }));
  assert.equal(detail.relationship.role, 'owner');
  assert.equal(detail.relationship.following, true);

  await Promise.all([true, true].map(following => ok(app.call({ action: 'follow', societyId, following }, 'bob'))));
  assert.equal(app.tables.society_follows.length, 2);
  await ok(app.call({ action: 'follow', societyId, following: false }, 'bob'));
  assert.equal((await ok(app.call({ action: 'detail', societyId }, 'bob'))).relationship.following, false);
  assert.equal((await ok(app.call({ action: 'list' }, 'bob'))).societies[0].following, false, 'discovery reflects an existing unfollow');
  const join = await ok(app.call({ action: 'applyJoin', societyId, reason: '我想和大家一起写诗。' }, 'bob'));
  await ok(app.call({ action: 'applyJoin', societyId, reason: '重复提交' }, 'bob'));
  assert.equal(app.tables.society_join_requests.length, 1);
  assert.equal((await app.call({ action: 'manage', societyId }, 'bob')).code, 'FORBIDDEN');
  const manager = await ok(app.call({ action: 'manage', societyId, ...actor }));
  assert.equal(manager.requests.length, 1);
  app.state.failWrite = 'society_follows';
  assert.equal((await app.call({ action: 'reviewJoin', societyId, requestId: join.requestId, revision: 1, decision: 'approved', ...actor })).success, false);
  assert.equal(app.tables.societies[0].memberCount, 1, 'member approval rolls back if automatic follow fails');
  assert.equal(app.tables.society_join_requests[0].status, 'pending');
  app.state.failWrite = '';
  const [joinApproval] = await Promise.all([1, 2].map(() => ok(app.call({ action: 'reviewJoin', societyId, requestId: join.requestId, revision: 1, decision: 'approved', ...actor }))));
  assert.equal(joinApproval.success, true);
  assert.equal(app.tables.societies[0].memberCount, 2, 'concurrent acceptance increments membership exactly once');
  assert.equal(app.tables.society_members.filter(row => row.userId === 'bob').length, 1);
  assert.equal((await app.call({ action: 'cancelJoin', societyId }, 'bob')).success, false);
  const bobMine = await ok(app.call({ action: 'mine' }, 'bob'));
  assert.equal(bobMine.societies[0].role, 'member');
  assert.equal(bobMine.societies[0].following, true);
  assert.equal((await ok(app.call({ action: 'home' }, 'bob'))).societies[0].following, true, 'home reflects the automatic follow');
  assert.equal((await ok(app.call({ action: 'list' }, 'bob'))).societies[0].following, true, 'discovery reflects the automatic follow');
  assert.equal(app.tables.society_follows.filter(row => row.societyId === societyId && row.userId === 'bob').length, 1, 'concurrent approval creates one follow record');
  await ok(app.call({ action: 'follow', societyId, following: false }, 'bob'));
  const unfollowedMember = await ok(app.call({ action: 'detail', societyId }, 'bob'));
  assert.equal(unfollowedMember.relationship.role, 'member');
  assert.equal(unfollowedMember.relationship.following, false, 'members can unfollow after joining');
  assert.equal((await ok(app.call({ action: 'list' }, 'bob'))).societies[0].following, false, 'discovery refreshes the unfollowed state');
  app.tables.society_members.push({ _id: membershipId(societyId, 'admin-user'), societyId, userId: 'admin-user', userDocId: 'admin-doc', role: 'admin', status: 'active', joinedAt: new Date() });
  const directory = await ok(app.call({ action: 'memberDirectory', societyId }));
  assert.deepEqual(directory.managers.map(row => row.role), ['owner', 'admin'], 'owner and admins are pinned first');
  assert.equal(directory.members.length, 1);

  const bobSubmission = await ok(app.call({ action: 'submitApplication', form: form(app.user('bob')) }, 'bob'));
  assert.equal((await app.call({ action: 'reviewApplication', applicationId: bobSubmission.applicationId, revision: 1, decision: 'approved' }, 'admin')).success, false, 'duplicate school and society name cannot be opened');
  await ok(app.call({ action: 'reviewApplication', applicationId: bobSubmission.applicationId, revision: 1, decision: 'rejected', note: '请核实社团名称' }, 'admin'));
  const resubmitted = await ok(app.call({ action: 'submitApplication', form: form(app.user('bob'), '另一间诗社') }, 'bob'));
  assert.equal(resubmitted.revision, 2);
  assert.equal((await app.call({ action: 'reviewApplication', applicationId: bobSubmission.applicationId, revision: 1, decision: 'approved' }, 'admin')).code, 'STALE_REVIEW');
  const second = await ok(app.call({ action: 'reviewApplication', applicationId: bobSubmission.applicationId, revision: 2, decision: 'approved' }, 'admin'));
  assert.equal((await app.call({ action: 'manage', societyId: second.societyId, ...actor })).code, 'FORBIDDEN');
  const otherJoin = await ok(app.call({ action: 'applyJoin', societyId: second.societyId, reason: '申请加入' }, 'other'));
  assert.equal((await app.call({ action: 'reviewJoin', societyId, requestId: otherJoin.requestId, revision: 1, decision: 'approved', ...actor })).code, 'NOT_FOUND');
  await ok(app.call({ action: 'cancelJoin', societyId: second.societyId }, 'other'));
  await ok(app.call({ action: 'applyJoin', societyId: second.societyId, reason: '重新申请' }, 'other'));
  assert.equal((await app.call({ action: 'reviewJoin', societyId: second.societyId, requestId: otherJoin.requestId, revision: 1, decision: 'approved' }, 'bob')).code, 'STALE_REVIEW');

  const posts = [
    { _id: 'visible-a', _openid: 'alice', publishMode: 'poem', auditStatus: 'approved', title: 'A社作品', content: '诗句' },
    { _id: 'visible-b', _openid: 'alice', publishMode: 'poem', title: 'B社作品', content: '诗句' },
    { _id: 'hidden', _openid: 'alice', publishMode: 'poem', isHidden: true },
    { _id: 'private-review', _openid: 'alice', publishMode: 'poem', auditStatus: 'pending' },
    { _id: 'anonymous', _openid: '123456', realAuthorOpenid: 'alice', isAnonymous: true, publishMode: 'poem' },
    { _id: 'wrong-author', _openid: 'bob', publishMode: 'poem' },
    { _id: 'draft', _openid: 'alice', publishMode: 'poem' }
  ];
  app.seed('posts', posts);
  app.seed('society_publications', posts.map((post, index) => ({ _id: 'publication-' + index, societyId: post._id === 'visible-b' ? second.societyId : societyId,
    authorId: 'alice', postId: post._id, status: post._id === 'draft' ? 'draft' : 'published', publishedAt: new Date(2026, 10, 2, ['visible-a', 'visible-b'].includes(post._id) ? 22 + ['visible-a', 'visible-b'].indexOf(post._id) : 0, index) })));
  const profile = await ok(app.call({ action: 'profile', societyId, userId: 'alice' }));
  assert.deepEqual(profile.works.map(row => row._id), ['visible-a'], 'profile excludes other societies, anonymous, hidden, review, draft and mismatched authors');
  assert.ok(!JSON.stringify(profile).includes('realAuthorOpenid'));
  assert.equal(app.tables.posts.length, posts.length, 'read model does not copy or mutate global posts');
  const bProfile = await ok(app.call({ action: 'profile', societyId: second.societyId, userId: 'alice' }));
  assert.deepEqual(bProfile.works.map(row => row._id), ['visible-b']);
  app.seed('votes_log', [{ _id: 'vote-a', _openid: 'alice', postId: 'visible-a', type: 'post' }]);
  const memberHome = await ok(app.call({ action: 'home' }, 'alice'));
  assert.deepEqual(memberHome.works.map(row => row._id), ['visible-a'], 'home works default to the member society');
  assert.equal(memberHome.works[0].isVoted, true, 'society works include the viewer like state');
  const guestHome = await ok(app.call({ action: 'home' }));
  assert.deepEqual(guestHome.works.map(row => row._id).sort(), ['visible-a', 'visible-b'], 'users without a society see works from all societies');
  assert.ok(guestHome.works.every(row => row.isVoted === false), 'anonymous viewers never see a liked state');
  const search = await ok(app.call({ action: 'list', query: '.*' }));
  assert.equal(search.societies.length, 0, 'search input is escaped, not a regex');
  const regionSearch = await ok(app.call({ action: 'list', query: '上海' }));
  assert.equal(regionSearch.societies.length, 2, 'search matches region');
  const review = await ok(app.call({ action: 'listApplications', status: 'approved' }, 'admin'));
  assert.ok(review.applications[0].proofUrls[0].startsWith('https://signed.example/'));
  assert.equal((await app.call({ action: 'listApplications' }, 'bob')).code, 'FORBIDDEN');
  assert.ok(app.state.conflicts > 0, 'transaction conflicts were actually exercised');

  app.user('alice').password = 'changed';
  await ok(app.call({ action: 'myApplication', ...actor }), 'login state is enough; no secondary password check');
  const badMaterial = form(app.user('other')); badMaterial.proofFiles = aliceForm.proofFiles;
  assert.equal((await app.call({ action: 'submitApplication', form: badMaterial }, 'other')).success, false);

  const isolated = runtime();
  isolated.seed('adminConfig', []);
  assert.equal((await isolated.call({ action: 'listApplications' }, 'admin')).code, 'FORBIDDEN', 'missing platform config fails closed');
  const unknown = runtime();
  assert.equal((await unknown.call({ action: 'myApplication', openid: 'nobody' })).code, 'AUTH_REQUIRED', 'unknown accounts are rejected');
  assert.equal((await unknown.call({ action: 'authenticate', openid: 'alice', password: 'alice-secret' })).code, 'INVALID_ACTION', 'password re-authentication is removed');

  const recruitmentApp = runtime();
  const schoolForm = form(recruitmentApp.user('alice'), '本校诗社'); schoolForm.recruitment = 'school';
  const schoolSubmission = await ok(recruitmentApp.call({ action: 'submitApplication', form: schoolForm }, 'alice'));
  const schoolApproval = await ok(recruitmentApp.call({ action: 'reviewApplication', applicationId: schoolSubmission.applicationId, revision: 1, decision: 'approved' }, 'admin'));
  assert.equal(recruitmentApp.tables.societies[0].recruitment, 'school');
  recruitmentApp.user('bob').school = '外校大学';
  assert.equal((await recruitmentApp.call({ action: 'applyJoin', societyId: schoolApproval.societyId, reason: '想加入' }, 'bob')).code, 'FORBIDDEN', 'other schools cannot apply');
  recruitmentApp.user('bob').school = '回车键';
  const schoolJoin = await ok(recruitmentApp.call({ action: 'applyJoin', societyId: schoolApproval.societyId, reason: '本校学生' }, 'bob'));
  recruitmentApp.user('bob').school = '外校大学';
  assert.equal((await recruitmentApp.call({ action: 'reviewJoin', societyId: schoolApproval.societyId, requestId: schoolJoin.requestId, revision: 1, decision: 'approved' }, 'alice')).code, 'FORBIDDEN', 'school is checked again at approval');
  assert.equal(recruitmentApp.tables.society_join_requests[0].status, 'pending');
  recruitmentApp.user('bob').school = '回车键大学';
  await ok(recruitmentApp.call({ action: 'reviewJoin', societyId: schoolApproval.societyId, requestId: schoolJoin.requestId, revision: 1, decision: 'approved' }, 'alice'));
  assert.equal((await ok(recruitmentApp.call({ action: 'mine' }, 'bob'))).societies[0].following, true);
  const badRecruitment = form(recruitmentApp.user('bob'), '无效诗社'); badRecruitment.recruitment = 'invalid';
  assert.equal((await recruitmentApp.call({ action: 'submitApplication', form: badRecruitment }, 'bob')).code, 'INVALID_REQUEST');

  const recommendation = runtime();
  recommendation.seed('societies', [
    { _id: 'same-school', name: '同校诗社', school: '复旦大学', region: '北京', status: 'active', createdAt: new Date(2026, 0, 1) },
    { _id: 'same-region', name: '同城诗社', school: '同济大学', region: '上海', status: 'active', createdAt: new Date(2026, 0, 2) },
    { _id: 'unrelated', name: '远方诗社', school: '清华大学', region: '广东', status: 'active', createdAt: new Date(2026, 0, 3) }
  ]);
  recommendation.user('alice').school = '复旦';
  recommendation.user('alice').region = '上海';
  const schoolFirst = await ok(recommendation.call({ action: 'home' }, 'alice'));
  assert.deepEqual(schoolFirst.societies.map(row => row._id), ['same-school', 'same-region', 'unrelated'], 'recommendations prioritize school, then region, then the rest');
  const regionOnly = await ok(recommendation.call({ action: 'home' }, 'bob'));
  assert.equal(regionOnly.societies.length, 3, 'users without a school or region still receive a full random recommendation');
  assert.deepEqual(regionOnly.societies.map(row => row._id).sort(), ['same-region', 'same-school', 'unrelated']);
  recommendation.user('bob').region = '上海市';
  const regionFirst = await ok(recommendation.call({ action: 'home' }, 'bob'));
  assert.equal(regionFirst.societies[0]._id, 'same-region', 'region uses fuzzy matching when school is not filled');

  const feed = runtime();
  feed.seed('societies', [{ _id: 'poetry-club', name: '诗社', school: '回车键大学', status: 'active' }]);
  feed.seed('posts', Array.from({ length: 13 }, (_, index) => ({ _id: `poem-${index}`, _openid: 'alice', publishMode: 'poem', title: `诗 ${index}`, content: '正文', auditStatus: 'approved' })));
  feed.seed('society_publications', Array.from({ length: 13 }, (_, index) => ({ _id: `publication-${index}`, societyId: 'poetry-club', authorId: 'alice', postId: `poem-${index}`, status: 'published', publishedAt: new Date(2026, 10, 2, 0, index) })));
  const firstWorks = await ok(feed.call({ action: 'detail', societyId: 'poetry-club' }));
  assert.equal(firstWorks.works.length, 12);
  assert.equal(firstWorks.worksMore, true);
  const nextWorks = await ok(feed.call({ action: 'societyWorks', societyId: 'poetry-club', cursor: firstWorks.worksCursor }));
  assert.deepEqual(nextWorks.works.map(row => row._id), ['poem-0'], 'the thirteenth society work remains reachable');
  assert.equal(nextWorks.hasMore, false);

  const crossPlatform = runtime();
  await ok(crossPlatform.call({ action: 'myApplication', openid: 'alice' }, 'tcb-runtime-uid'));
  crossPlatform.user('alice').wechatOpenId = 'wx-alice';
  await ok(crossPlatform.call({ action: 'myApplication', openid: 'alice' }, 'alice'));

  const routes = JSON.parse(fs.readFileSync(path.join(root, 'pages.json'), 'utf8'));
  const community = routes.subPackages.find(item => item.root === 'pages-community');
  assert.equal(community.pages.length, 12);
  const { parse, compileScript, compileTemplate } = require('@vue/compiler-sfc');
  for (const route of community.pages) {
    const filename = path.join(root, community.root, route.path + '.vue');
    const { descriptor, errors } = parse(fs.readFileSync(filename, 'utf8'));
    assert.equal(errors.length, 0, filename);
    compileScript(descriptor, { id: route.path });
    const compiled = compileTemplate({ source: descriptor.template.content, id: route.path, filename });
    assert.equal(compiled.errors.length, 0, JSON.stringify(compiled.errors));
  }
  console.log('societies: PASS — identity, applications, atomic approval, membership, member directory ordering, cross-society permissions, private data, publication scope and 12 page templates');
}
module.exports = { runtime, ok };
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
