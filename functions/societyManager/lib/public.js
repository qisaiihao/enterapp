'use strict';
const { error, text, id, page, read, list, listAll, oneOf, pick, publicSociety, activeSociety, membership, hash, profileTextMatches } = require('./common');

async function publicMemberPage(db, societyId, pagination = { skip: 0, limit: 50 }) {
  const members = await list(db, 'society_members', { societyId, status: 'active' }, { ...pagination, order: 'joinedAt' });
  const users = await Promise.all(members.map(member => read(db, 'users', member.userDocId)));
  return { members: members.flatMap((member, index) => users[index] ? [{ userId: member.userId, role: member.role, joinedAt: member.joinedAt,
    nickName: users[index].nickName || '诗友', avatarUrl: users[index].avatarUrl || '' }] : []),
    hasMore: members.length === pagination.limit, nextSkip: (pagination.skip || 0) + members.length };
}
async function publicMembers(db, societyId, pagination) {
  return (await publicMemberPage(db, societyId, pagination)).members;
}
async function memberList(db, event) {
  const society = await activeSociety(db, event.societyId);
  const pagination = page(event);
  return publicMemberPage(db, society._id, pagination);
}
async function publicMemberDirectory(db, societyId, pagination = { skip: 0, limit: 20 }) {
  const [owners, admins, members] = await Promise.all([
    list(db, 'society_members', { societyId, status: 'active', role: 'owner' }, { limit: 10, order: 'joinedAt' }),
    list(db, 'society_members', { societyId, status: 'active', role: 'admin' }, { limit: 100, order: 'joinedAt' }),
    list(db, 'society_members', { societyId, status: 'active', role: 'member' }, { ...pagination, order: 'joinedAt' })
  ]);
  const managers = [...owners, ...admins];
  const users = await Promise.all([...managers, ...members].map(member => read(db, 'users', member.userDocId)));
  const present = (member, index) => users[index] ? { userId: member.userId, role: member.role, joinedAt: member.joinedAt,
    nickName: users[index].nickName || '诗友', avatarUrl: users[index].avatarUrl || '' } : null;
  return {
    managers: managers.map((member, index) => present(member, index)).filter(Boolean),
    members: members.map((member, index) => present(member, managers.length + index)).filter(Boolean),
    hasMore: members.length === pagination.limit, nextSkip: (pagination.skip || 0) + members.length
  };
}
async function memberDirectory(db, event) {
  const society = await activeSociety(db, event.societyId);
  const pagination = page(event);
  return { society: publicSociety(society), ...(await publicMemberDirectory(db, society._id, pagination)) };
}
async function presentWorks(db, relations, viewerId = '', userId = '') {
  const posts = await Promise.all(relations.map(row => read(db, 'posts', row.postId)));
  const societies = await Promise.all(relations.map(row => read(db, 'societies', row.societyId)));
  const blocks = viewerId ? await list(db, 'blocks', { blockerId: viewerId }, { limit: 100 }) : [];
  const blockedIds = new Set(blocks.map(row => row.blockedId));
  const seen = new Set();
  const result = [];
  relations.forEach((relation, index) => {
    const post = posts[index];
    if (!post || societies[index]?.status !== 'active' || post.isHidden === true || post.isDeleted === true ||
      post.isAnonymous === true || post.isAnonymous === 'true' || post._openid === '123456' ||
      (post.auditStatus && post.auditStatus !== 'approved') ||
      (post.publishMode ? post.publishMode !== 'poem' : post.isPoem !== true) ||
      post._openid !== relation.authorId || (userId && post._openid !== userId) || blockedIds.has(post._openid) || seen.has(post._id)) return;
    seen.add(post._id);
    result.push({ ...pick(post, ['_id', '_openid', 'title', 'content', 'authorName', 'authorAvatar', 'authorSignature',
      'createTime', 'backgroundColor', 'textColor', 'highlightLines', 'isSeries', 'seriesBlocks', 'votes', 'commentCount', 'isOriginal']),
      isPoem: true, displayContent: post.content || '', displayHighlightLines: post.highlightLines || [],
      societyId: relation.societyId, societyPublishedAt: relation.publishedAt });
  });
  if (result.length) {
    let votedIds = new Set();
    if (viewerId) {
      const votes = await db.collection('votes_log').where({ _openid: viewerId, postId: db.command.in(result.map(row => row._id)) })
        .field({ postId: true }).limit(200).get();
      votedIds = new Set(votes.data.map(row => row.postId));
    }
    for (const row of result) row.isVoted = votedIds.has(row._id);
  }
  return result;
}
async function works(db, { societyId, userId, cursor = '', limit = 12, viewerId = '' } = {}) {
  const skip = Math.max(0, Math.min(10000, Math.floor(Number(cursor) || 0)));
  const filter = { status: 'published' };
  if (societyId) filter.societyId = societyId;
  if (userId) filter.authorId = userId;
  const relations = await list(db, 'society_publications', filter, { skip, limit, order: 'publishedAt' });
  return { works: await presentWorks(db, relations, viewerId, userId), cursor: String(skip + relations.length), hasMore: relations.length === limit };
}
async function societyWorks(db, event, user) {
  const society = await activeSociety(db, event.societyId);
  const pagination = page({ skip: event.cursor, limit: event.limit || 12 });
  return works(db, { societyId: society._id, cursor: String(pagination.skip), limit: pagination.limit, viewerId: user?._openid });
}
async function approvedCallWorks(db, callId, viewerId = '', limit = 20) {
  const rows = await list(db, 'society_submissions', { callId, status: 'approved' }, { limit, order: 'reviewedAt' });
  const relations = rows.map(row => ({ societyId: row.societyId, postId: row.postId, authorId: row.userId, publishedAt: row.reviewedAt }));
  return presentWorks(db, relations, viewerId);
}
async function withFollowing(db, societies, user) {
  if (!user?._openid || !societies.length) return societies;
  const follows = await Promise.all(societies.map(society => read(db, 'society_follows', hash('follow', society._id, user._openid))));
  return societies.map((society, index) => ({ ...society, following: follows[index]?.following === true }));
}
async function listSocieties(db, event, user) {
  const pagination = page(event);
  const query = text(event.query || '', 40);
  const region = text(event.region || '', 30);
  const conditions = [{ status: 'active' }];
  const escaped = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (query) conditions.push(db.command.or([{ name: db.RegExp({ regexp: escaped(query), options: 'i' }) }, { school: db.RegExp({ regexp: escaped(query), options: 'i' }) }, { region: db.RegExp({ regexp: escaped(query), options: 'i' }) }]));
  if (region) conditions.push({ region: db.RegExp({ regexp: escaped(region), options: 'i' }) });
  const societies = await list(db, 'societies', conditions.length === 1 ? conditions[0] : db.command.and(conditions), pagination);
  return { societies: await withFollowing(db, societies.map(publicSociety), user), hasMore: societies.length === pagination.limit };
}
async function publicOpportunities(db, kind, societyId, limit = 6) {
  const rows = await list(db, kind === 'call' ? 'society_calls' : 'society_events', kind === 'call' && societyId ? db.command.and([{ status: 'published' }, db.command.or([{ societyId }, { hostSocietyIds: societyId }])]) : { status: 'published', ...(societyId ? { societyId } : {}) }, { limit });
  const owners = await Promise.all(rows.map(row => read(db, 'societies', row.societyId)));
  return rows.flatMap((row, index) => owners[index]?.status === 'active' ? [{ ...pick(row, ['_id', 'title', 'category', 'coverImage', 'location', 'deadline', 'startTime', 'endTime', 'registrationEnd', 'societyId', 'registrationCount', 'submissionCount', 'hostSocietyIds', 'audience']),
    societyName: owners[index].name,
    statusLabel: (kind === 'call' ? row.deadline : row.registrationEnd)
      ? (new Date(kind === 'call' ? row.deadline : row.registrationEnd).getTime() < Date.now()
        ? '已截止' : kind === 'call' ? '征稿中' : '报名中') : ''
  }] : []);
}
async function societyContent(db, event) {
  const society = await activeSociety(db, event.societyId);
  if (!['news', 'event', 'call'].includes(event.kind)) throw error('内容类型无效');
  const pagination = page(event);
  let filter = { societyId: society._id, status: 'published' };
  let owners = new Map([[society._id, society]]);
  if (event.kind === 'call') {
    owners = new Map((await listAll(db, 'societies', { status: 'active' })).map(row => [row._id, row]));
    filter = db.command.and([{ status: 'published' }, oneOf(db, 'societyId', [...owners.keys()]), db.command.or([{ societyId: society._id }, { hostSocietyIds: society._id }])]);
  }
  const table = { news: 'society_news', event: 'society_events', call: 'society_calls' }[event.kind];
  const order = [...(event.kind === 'news' ? [['pinned', 'desc']] : []), ['createdAt', 'desc'], ['_id', 'desc']];
  const [rows, count] = await Promise.all([list(db, table, filter, { ...pagination, order }), db.collection(table).where(filter).count()]);
  const records = rows.map(row => event.kind === 'news' ? pick(row, ['_id', 'title', 'content', 'pinned', 'createdAt']) : {
    ...callItem(row, owners.get(row.societyId)),
    statusLabel: (event.kind === 'call' ? row.deadline : row.registrationEnd)
      ? new Date(event.kind === 'call' ? row.deadline : row.registrationEnd).getTime() <= Date.now() ? '已截止' : event.kind === 'call' ? '征稿中' : '报名中' : ''
  });
  return { records, nextSkip: pagination.skip + rows.length, hasMore: pagination.skip + rows.length < count.total };
}
function deadlineAt(row) { return row.deadline ? new Date(row.deadline).getTime() : 0; }
function callItem(row, owner, now = Date.now()) {
  return { ...pick(row, ['_id', 'title', 'category', 'coverImage', 'location', 'deadline', 'startTime', 'endTime', 'registrationEnd', 'societyId', 'registrationCount', 'submissionCount', 'hostSocietyIds', 'audience']),
    societyName: owner.name, statusLabel: row.deadline ? (deadlineAt(row) <= now ? '已截止' : '征稿中') : '' };
}
function normalizedText(value) { return String(value || '').trim().toLowerCase(); }
function shuffle(rows) {
  const result = [...rows];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}
async function recommendedSocieties(db, user, limit = 3) {
  const rows = await list(db, 'societies', { status: 'active' }, { limit: 200 });
  const school = normalizedText(user && user.school);
  const region = normalizedText(user && user.region);
  const picked = [];
  const seen = new Set();
  const take = candidates => {
    for (const row of shuffle(candidates)) {
      if (picked.length >= limit) return;
      if (seen.has(row._id)) continue;
      seen.add(row._id);
      picked.push(row);
    }
  };
  if (school) take(rows.filter(row => profileTextMatches(row.school, school)));
  if (region) take(rows.filter(row => profileTextMatches(row.region, region)));
  take(rows);
  return picked.map(publicSociety);
}
async function publicCalls(db, event = {}, user, societies, now = Date.now()) {
  const filter = ['current', 'ending', 'past'].includes(event.filter) ? event.filter : 'current';
  const pagination = page(event);
  societies ||= await listAll(db, 'societies', { status: 'active' });
  if (!societies.length) return { calls: [], hasMore: false, total: 0 };
  const owners = new Map(societies.map(row => [row._id, row]));
  const conditions = [{ status: 'published', deadline: filter === 'past' ? db.command.lte(new Date(now)) : db.command.gt(new Date(now)) }, oneOf(db, 'societyId', [...owners.keys()])];
  if (event.availableOnly === true) {
    const memberships = user?._openid ? await listAll(db, 'society_members', { userId: user._openid, status: 'active' }) : [];
    const memberIds = memberships.map(row => row.societyId).filter(societyId => owners.has(societyId));
    const schoolIds = societies.filter(row => profileTextMatches(row.school, user?.school)).map(row => row._id);
    const audience = [db.command.and([{ audience: db.command.neq('school') }, { audience: db.command.neq('members') }])];
    for (const [scope, ids] of [['school', schoolIds], ['members', memberIds]]) {
      if (ids.length) audience.push(db.command.and([{ audience: scope }, db.command.or([oneOf(db, 'societyId', ids), oneOf(db, 'hostSocietyIds', ids)])]));
    }
    conditions.push(db.command.or(audience));
  }
  const where = db.command.and(conditions);
  const order = [[filter === 'current' ? 'createdAt' : 'deadline', filter === 'ending' ? 'asc' : 'desc'], ['_id', 'desc']];
  const [rows, count] = await Promise.all([list(db, 'society_calls', where, { ...pagination, order }), db.collection('society_calls').where(where).count()]);
  return { calls: rows.map(row => callItem(row, owners.get(row.societyId), now)), hasMore: pagination.skip + rows.length < count.total, total: count.total };
}
async function latestWorksFromSocieties(db, societyIds, options) {
  const results = await Promise.all(societyIds.map(societyId => works(db, { ...options, societyId })));
  const seen = new Set();
  return results.flatMap(result => result.works)
    .filter(item => !seen.has(item._id) && seen.add(item._id))
    .sort((a, b) => new Date(b.societyPublishedAt).getTime() - new Date(a.societyPublishedAt).getTime())
    .slice(0, options.limit);
}
async function home(db, user) {
  const now = Date.now();
  const [societies, events, active, memberships] = await Promise.all([
    recommendedSocieties(db, user), publicOpportunities(db, 'event'),
    listAll(db, 'societies', { status: 'active' }),
    user?._openid ? list(db, 'society_members', { userId: user._openid, status: 'active' }, { limit: 100 }) : []
  ]);
  const memberSocietyIds = [...new Set(memberships.map(row => row.societyId))];
  const worksOptions = { limit: 3, viewerId: user?._openid };
  const poems = memberSocietyIds.length ? await latestWorksFromSocieties(db, memberSocietyIds, worksOptions) : (await works(db, worksOptions)).works;
  const [current, past] = await Promise.all([publicCalls(db, { filter: 'ending', limit: 6 }, user, active, now), publicCalls(db, { filter: 'past', limit: 6 }, user, active, now)]);
  return { societies: await withFollowing(db, societies, user), events, calls: current.calls, pastCalls: past.calls, currentCallTotal: current.total, pastCallTotal: past.total, works: poems };
}
async function detail(db, user, event) {
  const society = await activeSociety(db, event.societyId);
  const [member, follow, join, members, poems, news, events, calls] = await Promise.all([
    membership(db, society._id, user?._openid),
    user ? read(db, 'society_follows', hash('follow', society._id, user._openid)) : null,
    user ? read(db, 'society_join_requests', hash('join', society._id, user._openid)) : null,
    publicMemberPage(db, society._id), works(db, { societyId: society._id, viewerId: user?._openid }),
    ...['news', 'event', 'call'].map(kind => societyContent(db, { societyId: society._id, kind, limit: 20 }))
  ]);
  return { society: publicSociety(society), viewerId: user?._openid || '',
    relationship: { role: member?.role || '', following: follow?.following === true, joinStatus: join?.status || '' },
    members: members.members, membersMore: members.hasMore, membersNextSkip: members.nextSkip,
    works: poems.works, worksCursor: poems.cursor, worksMore: poems.hasMore,
    news: news.records, events: events.records, calls: calls.records,
    contentPages: Object.fromEntries([['news', news], ['events', events], ['calls', calls]].map(([kind, result]) => [kind, { nextSkip: result.nextSkip, hasMore: result.hasMore }])) };
}
async function profile(db, user, event) {
  const society = await activeSociety(db, event.societyId);
  const userId = id(event.userId);
  const [users, member, poems] = await Promise.all([
    db.collection('users').where({ _openid: userId }).field({ nickName: true, avatarUrl: true, bio: true }).limit(1).get(),
    membership(db, society._id, userId), works(db, { societyId: society._id, userId, cursor: event.cursor, viewerId: user?._openid })
  ]);
  if (!users.data.length) throw error('作者不存在', 'NOT_FOUND');
  return { society: publicSociety(society), profile: { ...pick(users.data[0], ['nickName', 'avatarUrl', 'bio']), role: member?.role || '', joinedAt: member?.joinedAt || null }, ...poems };
}
async function opportunity(db, event, user) {
  if (!['call', 'event'].includes(event.kind)) throw error('内容类型无效');
  const row = await read(db, event.kind === 'call' ? 'society_calls' : 'society_events', id(event.id));
  if (!row || row.status !== 'published') throw error('内容不存在或尚未发布', 'NOT_FOUND');
  const society = await activeSociety(db, row.societyId);
  const hostIds = row.hostSocietyIds?.length ? row.hostSocietyIds : [row.societyId];
  const hosts = await Promise.all(hostIds.map(host => read(db, 'societies', host)));
  const [registration, approved] = await Promise.all([
    user && event.kind === 'event' ? read(db, 'society_registrations', hash('registration', row._id, user._openid)) : null,
    event.kind === 'call' ? approvedCallWorks(db, row._id, user?._openid) : []
  ]);
  return { registered: registration?.status === 'registered', hosts: hosts.filter(host => host?.status === 'active').map(publicSociety), works: approved, item: { ...pick(row, ['_id', 'title', 'description', 'requirements', 'category', 'coverImage', 'startTime', 'endTime', 'timeText', 'location', 'deadline', 'societyId', 'guests', 'registrationEnd', 'registrationCount', 'capacity', 'audience', 'submissionCount']), societyName: society.name, societyAvatar: society.avatarUrl } };
}
module.exports = { publicMembers, publicMemberPage, memberList, publicMemberDirectory, memberDirectory, works, societyWorks, societyContent, approvedCallWorks, listSocieties, publicOpportunities, publicCalls, home, detail, profile, opportunity };
