const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const cloud = require('wx-server-sdk');
const { memoryDb } = require('./helpers/posts-memory-db.cjs');
const { createPostsDatabase, resolveOwner } = require('../functions/adminManager/_lib/posts');
const { queueModerationReview, listModerationReviews, getModerationReview, resolveModerationReview } = require('../functions/adminManager/_lib/moderation-review');
cloud.init({ env: 'moderation-reviews-test' });
const command = cloud.database().command;
const audit = { success: false, passed: false, code: 'CONTENT_BLOCKED', suggestion: 'Block', failedType: 'text', requestId: 'audit-id', message: '文本未通过' };

function fixture(options = {}) {
  const now = Date.now();
  const memory = memoryDb({
    adminConfig: [{ _id: 'admin', adminPoemIds: ['moderator'], version: 1 }],
    users: [
      { _id: 'u', _openid: 'author', nickName: '作者', avatarUrl: 'author.png' },
      { _id: 'a', _openid: 'admin', poemId: 'moderator', nickName: '管理员' },
      { _id: 'o', _openid: 'other', nickName: '其他作者' }
    ],
    posts: [{ _id: 'base', _openid: 'author', title: '原帖', content: '原正文', joinedActivityId: 'old', votes: 7, commentCount: 0 },
      { _id: 'quoted', _openid: 'other', title: '引用', content: '原诗', discussionCount: 0 }],
    activities: [
      { _id: 'old', postCount: 1, status: 'published', startTime: new Date(now - 3600000), endTime: new Date(now + 3600000) },
      { _id: 'new', postCount: 0, status: 'published', startTime: new Date(now - 3600000), endTime: new Date(now + 3600000) }
    ],
    comments: [{ _id: 'reply-parent', _openid: 'other', postId: 'base', content: '被回复' }],
    messages: [], moderation_review: [], poets: []
  }, command, options);
  return { ...memory, db: createPostsDatabase(memory.db) };
}
const request = (overrides = {}) => ({ openid: 'author', source: 'createPost', kind: 'post', audit,
  data: { _openid: 'author', title: '待复核', content: '待复核正文', authorName: '作者', createTime: new Date(), votes: 0, commentCount: 0 }, ...overrides });
const row = (f, collection, id) => f.tables[collection].find(item => item._id === id);
const resolve = (f, reviewId, decision = 'approve', extras = {}) => resolveModerationReview(f.db, { reviewId, decision, ...extras }, 'admin');

function adminRuntime(f) {
  let openid = 'author';
  const filename = path.join(__dirname, '../functions/adminManager/index.js');
  const nativeRequire = createRequire(filename);
  const context = { exports: {}, console: { log() {}, error() {}, warn() {} }, require(id) {
    if (id === 'wx-server-sdk') return { init() {}, database: () => f.db, getWXContext: () => ({ OPENID: openid }) };
    return nativeRequire(id);
  } };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), context, { filename });
  return { run: event => context.exports.main(event), setOpenid: value => { openid = value; } };
}

async function main() {
  const previousNotifications = process.env.MODERATION_REVIEW_NOTIFY_ADMINS;
  process.env.MODERATION_REVIEW_NOTIFY_ADMINS = 'false';
  try {
    const isolated = fixture();
    const result = await queueModerationReview(isolated.db, request());
    assert.equal(result.code, 'REVIEW_PENDING');
    assert.equal(row(isolated, 'moderation_review', result.reviewId).status, 'pending');
    assert.equal(isolated.tables.messages.length, 0, 'Isolated smoke tests store reviews without notifying real administrators');
  } finally {
    if (previousNotifications === undefined) delete process.env.MODERATION_REVIEW_NOTIFY_ADMINS;
    else process.env.MODERATION_REVIEW_NOTIFY_ADMINS = previousNotifications;
  }
  const f = fixture();
  const prepared = request({ data: { ...request().data, imageUrls: ['cloud://image'], highlightLines: ['高光'], seriesCoverHighlight: '封面高光', sentenceGroups: [{ comment: '句子评论', sentences: ['原句'] }] } });
  const queued = await queueModerationReview(f.db, prepared);
  assert.equal(queued.code, 'REVIEW_PENDING');
  assert.equal(queued.reviewQueued, true);
  assert.equal(queued.reviewStored, true);
  assert.equal(f.tables.posts.length, 2, 'interception never publishes content');
  const stored = row(f, 'moderation_review', queued.reviewId);
  assert.equal(stored.audit.requestId, 'audit-id');
  assert.equal(stored.snapshot.seriesCoverHighlight, '封面高光');
  assert.deepEqual(stored.snapshot.highlightLines, ['高光']);
  assert.equal(f.tables.messages.length, 1);
  assert.equal(f.tables.messages[0].type, 'content_review_new');
  assert.equal(f.tables.messages[0].toUserId, 'admin');
  prepared.data.content = '客户端后来变更';
  assert.equal(stored.data.content, '待复核正文', 'stored prepared data is immutable');
  const same = request({ data: { ...stored.data, createTime: new Date(Date.now() + 50000) } });
  const [retry, retry2] = await Promise.all([queueModerationReview(f.db, same), queueModerationReview(f.db, same)]);
  assert.equal(retry.reviewId, queued.reviewId);
  assert.equal(retry2.reviewId, queued.reviewId);
  assert.equal(f.tables.moderation_review.length, 1);
  assert.equal(f.tables.messages.length, 1, 'pending retries notify once');
  const unavailable = { success: false, code: 'MODERATION_UNAVAILABLE', message: '服务故障' };
  assert.equal(await queueModerationReview(f.db, request({ audit: unavailable })), unavailable);
  assert.equal(await queueModerationReview(f.db, request({ audit: { success: false, code: 'CONTENT_TOO_LARGE' } })).then(result => result.code), 'CONTENT_TOO_LARGE');
  assert.equal(f.tables.moderation_review.length, 1, 'service errors and oversize submissions cannot enter review');
  const pending = await listModerationReviews(f.db, { status: 'pending', limit: 1 });
  assert.equal(pending.reviews[0]._id, queued.reviewId);
  assert.equal(pending.reviews[0].data, undefined, 'list exposes display snapshot rather than replay data');
  assert.equal((await getModerationReview(f.db, { reviewId: queued.reviewId })).review.snapshot.content, '待复核正文');
  await assert.rejects(getModerationReview(f.db, { reviewId: 'invalid' }), /标识无效/);

  const runtime = adminRuntime(f);
  for (const action of ['listModerationReviews', 'getModerationReview', 'resolveModerationReview']) {
    const denied = await runtime.run({ action, reviewId: queued.reviewId, decision: 'approve', openid: 'admin' });
    assert.equal(denied.success, false, 'authenticated non-admin cannot spoof event.openid');
  }
  runtime.setOpenid('admin');
  assert.equal((await runtime.run({ action: 'getModerationReview', reviewId: queued.reviewId })).success, true);
  assert.equal((await runtime.run({ action: 'queueModerationReview', ...prepared })).success, false, 'there is no public/admin enqueue bypass');
  const approved = await runtime.run({ action: 'resolveModerationReview', reviewId: queued.reviewId, decision: 'approve', data: { content: '伪造放行内容' } });
  assert.equal(approved.success, true, approved.error);
  assert.equal(row(f, 'posts', approved.postId).content, '待复核正文', 'approval publishes only saved server content');
  assert.equal(row(f, 'moderation_review', queued.reviewId).status, 'approved');
  assert.equal(f.tables.messages.filter(item => item.type === 'content_review_approved').length, 1);
  const again = await resolve(f, queued.reviewId);
  assert.equal(again.alreadyHandled, true);
  assert.equal(again.postId, approved.postId);
  assert.equal(f.tables.posts.length, 3);
  assert.equal(f.tables.messages.length, 2);
  await assert.rejects(resolve(f, queued.reviewId, 'reject'), /已经处理/);
  const replay = await queueModerationReview(f.db, same);
  assert.equal(replay.code, 'REVIEW_ALREADY_APPROVED');
  assert.equal(replay.success, false, 'resubmission never fabricates an addComment/create response');
  assert.equal(replay.resultPostId, approved.postId);
  assert.equal(replay.reviewStored, true, 'resolved replay still owns stored assets');

  const rejected = await queueModerationReview(f.db, request({ data: { ...request().data, content: '另一个被拒绝的提交' } }));
  await resolve(f, rejected.reviewId, 'reject', { note: '请修改措辞' });
  assert.equal(f.tables.posts.length, 3);
  const rejectedMessage = f.tables.messages.find(item => item.type === 'content_review_rejected');
  assert.equal(rejectedMessage.note, '请修改措辞');
  assert.match(rejectedMessage.content, /请修改措辞/);
  assert.equal((await queueModerationReview(f.db, request({ data: { ...request().data, content: '另一个被拒绝的提交' } }))).code, 'REVIEW_ALREADY_REJECTED');
  await assert.rejects(resolve(f, rejected.reviewId, 'approve'), /已经处理/);
  await assert.rejects(resolve(f, rejected.reviewId, 'reject', { note: '长'.repeat(501) }), /最多500字/);
  await assert.rejects(resolve(f, rejected.reviewId, 'reject', { note: 42 }), /参数无效/);
  assert.equal((await listModerationReviews(f.db, { status: 'all', limit: 1 })).hasMore, true);

  const concurrent = fixture();
  const collision = request();
  const queuedPair = await Promise.all([queueModerationReview(concurrent.db, collision), queueModerationReview(concurrent.db, collision)]);
  assert.equal(queuedPair[0].reviewId, queuedPair[1].reviewId);
  assert.equal(concurrent.tables.moderation_review.length, 1);
  const decisions = await Promise.allSettled([resolve(concurrent, queuedPair[0].reviewId), resolve(concurrent, queuedPair[0].reviewId, 'reject')]);
  assert.equal(decisions.filter(item => item.status === 'fulfilled').length, 1);
  assert.equal(concurrent.tables.posts.length, 3, 'concurrent approvals publish exactly once');

  for (const source of ['createPost', 'contentCheck']) {
    const account = fixture();
    const q = await queueModerationReview(account.db, request({ source }));
    await account.db.collection('users').doc('u').update({ data: { postingBanned: true } });
    await assert.rejects(resolve(account, q.reviewId), /限制发帖/);
    assert.equal(row(account, 'moderation_review', q.reviewId).status, 'pending');
    assert.equal(account.tables.posts.length, 2);
  }

  const anonymous = fixture();
  const aq = await queueModerationReview(anonymous.db, request({ data: { ...request().data, _openid: '123456', realAuthorOpenid: 'author', isAnonymous: true, anonymousAuthorName: '匿名诗人', authorName: '匿名诗人', authorAvatar: '/static/images/avatar.png' } }));
  const ar = await resolve(anonymous, aq.reviewId);
  assert.equal(resolveOwner(row(anonymous, 'posts', ar.postId)), 'author');
  assert.equal(row(anonymous, 'posts', ar.postId)._openid, '123456');
  assert.equal(row(anonymous, 'posts', ar.postId).authorName, '匿名诗人');

  const discussion = fixture();
  const dq = await queueModerationReview(discussion.db, request({ source: 'createDiscussionPost', related: { quotedPostId: 'quoted' }, data: { ...request().data, quotedPostId: 'quoted', isDiscussion: true } }));
  await Promise.all([resolve(discussion, dq.reviewId), resolve(discussion, dq.reviewId)]);
  assert.equal(row(discussion, 'posts', 'quoted').discussionCount, 1);
  const missingQuote = fixture();
  const mq = await queueModerationReview(missingQuote.db, request({ source: 'createDiscussionPost', related: { quotedPostId: 'quoted' } }));
  await missingQuote.db.collection('posts').doc('quoted').remove();
  await assert.rejects(resolve(missingQuote, mq.reviewId), /引用的帖子/);
  assert.equal(missingQuote.tables.posts.length, 1);

  const poem = fixture();
  const pq = await queueModerationReview(poem.db, request({ source: 'contentCheck', data: { ...request().data, isPoem: true, isOriginal: false, author: '诗人名字', joinedActivityId: 'new' } }));
  await Promise.all([resolve(poem, pq.reviewId), resolve(poem, pq.reviewId)]);
  assert.equal(poem.tables.poets.length, 1);
  assert.equal(poem.tables.poets[0].name, '诗人名字');
  assert.equal(row(poem, 'activities', 'new').postCount, 1);
  const closed = fixture();
  const cq = await queueModerationReview(closed.db, request({ source: 'contentCheck', data: { ...request().data, joinedActivityId: 'new' } }));
  await closed.db.collection('activities').doc('new').update({ data: { endTime: new Date(Date.now() - 1) } });
  await assert.rejects(resolve(closed, cq.reviewId), /活动已结束/);
  assert.equal(row(closed, 'activities', 'new').postCount, 0);
  const official = fixture();
  const officialRequest = request({ openid: 'admin', source: 'contentCheck', data: { ...request().data, _openid: 'admin', isActivityPost: true, activityId: 'new' } });
  const officialQueue = await queueModerationReview(official.db, officialRequest);
  await resolve(official, officialQueue.reviewId);
  assert.equal(row(official, 'activities', 'new').postCount, 1);
  const lostPermission = fixture();
  const officialPending = await queueModerationReview(lostPermission.db, officialRequest);
  await lostPermission.db.collection('users').doc('a').update({ data: { poemId: 'former-admin' } });
  await assert.rejects(resolve(lostPermission, officialPending.reviewId), /失去管理员权限/);
  assert.equal(lostPermission.tables.posts.length, 2);

  const edit = fixture();
  const basePost = (await edit.db.collection('posts').doc('base').get()).data;
  const eq = await queueModerationReview(edit.db, request({ kind: 'post_edit', source: 'updatePostContent', postId: 'base', basePost,
    data: { content: '审核后的修改', joinedActivityId: 'new', updateTime: new Date() }, related: { oldActivityId: 'old', newActivityId: 'new' } }));
  await edit.db.collection('posts').doc('base').update({ data: { votes: command.inc(2) } });
  await resolve(edit, eq.reviewId);
  assert.equal(row(edit, 'posts', 'base').content, '审核后的修改');
  assert.equal(row(edit, 'posts', 'base').votes, 9, 'content approval preserves newer counters');
  assert.equal(row(edit, 'activities', 'old').postCount, 0);
  assert.equal(row(edit, 'activities', 'new').postCount, 1);
  const hidden = fixture();
  await hidden.db.collection('posts').doc('base').update({ data: { isHidden: true } });
  const hiddenBase = (await hidden.db.collection('posts').doc('base').get()).data;
  const hiddenQueue = await queueModerationReview(hidden.db, request({ kind: 'post_edit', source: 'updatePostContent', postId: 'base', basePost: hiddenBase, data: { content: '隐藏帖子的新正文' } }));
  await resolve(hidden, hiddenQueue.reviewId);
  assert.equal(row(hidden, 'posts', 'base').content, '隐藏帖子的新正文');
  assert.equal(row(hidden, 'posts', 'base').isHidden, true, 'owner edit approval preserves existing visibility');
  const conflict = fixture();
  const oldPost = (await conflict.db.collection('posts').doc('base').get()).data;
  const fq = await queueModerationReview(conflict.db, request({ kind: 'post_edit', source: 'updatePostContent', postId: 'base', basePost: oldPost, data: { content: '旧修改' } }));
  await conflict.db.collection('posts').doc('base').update({ data: { content: '更新的原帖' } });
  await assert.rejects(resolve(conflict, fq.reviewId), /原帖已被修改/);
  assert.equal(row(conflict, 'posts', 'base').content, '更新的原帖');
  assert.equal(row(conflict, 'moderation_review', fq.reviewId).status, 'pending');
  const refreshedBase = (await conflict.db.collection('posts').doc('base').get()).data;
  const refreshed = await queueModerationReview(conflict.db, request({ kind: 'post_edit', source: 'updatePostContent', postId: 'base', basePost: refreshedBase, data: { content: '旧修改' } }));
  assert.notEqual(refreshed.reviewId, fq.reviewId, 'resubmission after a changed original can create a fresh review');
  await resolve(conflict, refreshed.reviewId);
  assert.equal(row(conflict, 'posts', 'base').content, '旧修改');

  for (const isAnonymous of [false, true]) {
    const comments = fixture();
    const data = { _openid: 'author', postId: 'base', parentId: 'reply-parent', content: '复核评论', authorName: isAnonymous ? '匿名用户' : '作者', authorAvatar: '', isAnonymous, likes: 0, createTime: new Date() };
    const q = await queueModerationReview(comments.db, request({ kind: 'comment', source: 'addComment', postId: 'base', data }));
    const [first, second] = await Promise.all([resolve(comments, q.reviewId), resolve(comments, q.reviewId)]);
    assert.equal(first.commentId, second.commentId);
    assert.equal(comments.tables.comments.length, 2);
    assert.equal(row(comments, 'posts', 'base').commentCount, 1);
    assert.equal(comments.tables.messages.filter(item => item.type === 'comment').length, isAnonymous ? 0 : 1);
    if (!isAnonymous) assert.equal(comments.tables.messages.find(item => item.type === 'comment').toUserId, 'other');
    assert.equal((await queueModerationReview(comments.db, request({ kind: 'comment', source: 'addComment', postId: 'base', data }))).code, 'REVIEW_ALREADY_APPROVED');
  }
  const orphan = fixture();
  const oq = await queueModerationReview(orphan.db, request({ kind: 'comment', source: 'addComment', postId: 'base', data: { _openid: 'author', postId: 'base', parentId: 'reply-parent', content: '回复' } }));
  await orphan.db.collection('comments').doc('reply-parent').remove();
  await assert.rejects(resolve(orphan, oq.reviewId), /回复的评论/);
  assert.equal(row(orphan, 'posts', 'base').commentCount, 0);
  for (const kind of ['post', 'post_edit', 'comment']) {
    const canceled = fixture();
    const basePost = (await canceled.db.collection('posts').doc('base').get()).data;
    const q = await queueModerationReview(canceled.db, request({ kind, postId: 'base', basePost, data: kind === 'comment' ? { postId: 'base', content: '评论' } : { ...request().data } }));
    await canceled.db.collection('users').doc('u').remove();
    await assert.rejects(resolve(canceled, q.reviewId), /账号已不存在/);
    assert.equal(row(canceled, 'moderation_review', q.reviewId).status, 'pending');
  }

  let failQueue = true;
  const queueFailure = fixture({ beforeWrite({ name, op }) { if (failQueue && name === 'messages' && op === 'set') throw new Error('notification failed'); } });
  const failedQueue = await queueModerationReview(queueFailure.db, request());
  assert.equal(failedQueue.code, 'REVIEW_QUEUE_FAILED');
  assert.equal(failedQueue.reviewQueued, false);
  assert.equal(queueFailure.tables.moderation_review.length, 0, 'queue+notifications commit together');
  assert.equal(queueFailure.tables.posts.length, 2);
  failQueue = false;
  assert.equal((await queueModerationReview(queueFailure.db, request())).reviewQueued, true);

  let failResolve = false;
  const atomic = fixture({ beforeWrite({ name, data }) { if (failResolve && name === 'messages' && data.type === 'content_review_approved') throw new Error('result notification failed'); } });
  const atq = await queueModerationReview(atomic.db, request({ source: 'contentCheck', data: { ...request().data, joinedActivityId: 'new', isPoem: true, author: '事务诗人' } }));
  failResolve = true;
  await assert.rejects(resolve(atomic, atq.reviewId), /result notification failed/);
  assert.equal(atomic.tables.posts.length, 2, 'publishing rolls back if result state cannot commit');
  assert.equal(atomic.tables.poets.length, 0);
  assert.equal(row(atomic, 'activities', 'new').postCount, 0);
  assert.equal(row(atomic, 'moderation_review', atq.reviewId).status, 'pending');
  assert.equal(atomic.tables.messages.length, 1);
  failResolve = false;
  await resolve(atomic, atq.reviewId);
  assert.equal(atomic.tables.posts.length, 3);
  assert.equal(row(atomic, 'activities', 'new').postCount, 1);
  assert.equal(atomic.tables.poets.length, 1);
  console.log('Moderation review tests passed: authorization, immutable data, dedup, decisions, eligibility, side effects, concurrency and atomic rollback');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
