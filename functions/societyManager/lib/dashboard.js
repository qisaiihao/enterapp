'use strict';
const { manager, list, page } = require('./common');
async function manageContent(db, user, event) {
  await manager(db, event.societyId, user);
  const tables = { news: 'society_news', event: 'society_events', call: 'society_calls' };
  if (!tables[event.kind]) throw require('./common').error('内容类型无效');
  const pagination = page(event);
  const filter = event.kind === 'call' ? db.command.and([{ status: 'published' }, db.command.or([
    { societyId: event.societyId }, { hostSocietyIds: event.societyId }, { invitedSocietyIds: event.societyId }
  ])]) : { societyId: event.societyId, status: 'published' };
  return { records: await list(db, tables[event.kind], filter, pagination), ...pagination };
}
async function statistics(db, user, event) {
  const society = await manager(db, event.societyId, user);
  const now = new Date();
  // Calendar week in Asia/Shanghai, independent of the cloud runtime timezone.
  const local = new Date(now.getTime() + 8 * 3600000);
  const week = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - (local.getUTCDay() + 6) % 7) - 8 * 3600000);
  const count = async (table, filter) => (await db.collection(table).where(filter).count()).total;
  const since = db.command.gte(week);
  const [members, works, submissions, registrations, activeEvents] = await Promise.all([
    count('society_members', { societyId: society._id, status: 'active', joinedAt: since }),
    count('society_publications', { societyId: society._id, status: 'published', publishedAt: since }),
    count('society_submissions', { societyId: society._id, submittedAt: since, status: db.command.neq('withdrawn') }),
    count('society_registrations', { societyId: society._id, status: 'registered' }),
    count('society_events', { societyId: society._id, status: 'published', endTime: db.command.gt(now) })
  ]);
  const totalSubmissions = await count('society_submissions', { societyId: society._id, status: db.command.neq('withdrawn') });
  return { statistics: { members: society.memberCount || 0, works: society.workCount || 0, registrations, submissions: totalSubmissions,
    weekMembers: members, weekWorks: works, weekSubmissions: submissions, activeEvents } };
}
module.exports = { manageContent, statistics };
