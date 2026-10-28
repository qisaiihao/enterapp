const crypto = require('crypto');
const cloud = require('wx-server-sdk');
const { withPostResponse } = require('./_lib/posts');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const rawDb = cloud.database({ throwOnNotFound: false });
const _ = rawDb.command;
const PAGE_SIZE = 100;
const FILE_BATCH_SIZE = 50;
const collageOwner = identity => crypto.createHash('sha256').update(identity).digest('hex').slice(0, 32);

function runtimeEnvironment(context = {}) {
  for (const value of [context.environment, context.environ]) {
    if (value && typeof value === 'object' && !Array.isArray(value)) return value;
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
      } catch (_) {}
    }
  }
  const result = {};
  if (typeof context.environ === 'string') {
    for (const entry of context.environ.split(';')) {
      const separator = entry.indexOf('=');
      if (separator > 0) result[entry.slice(0, separator)] = entry.slice(separator + 1);
    }
  }
  return result;
}

function isMissingCollection(error) {
  const code = error && (error.errCode != null ? error.errCode : error.code);
  const message = String(error && (error.message || error.errMsg) || '');
  return Number(code) === -502005 || code === 'DATABASE_COLLECTION_NOT_EXIST' ||
    /DATABASE_COLLECTION_NOT_EXIST|collection.*(?:does not exist|not exists?)/i.test(message);
}

async function readDoc(ref) {
  try { return (await ref.get()).data || null; }
  catch (error) {
    const code = error && (error.errCode != null ? error.errCode : error.code);
    if (Number(code) === -502006 || code === 'DATABASE_DOCUMENT_NOT_EXIST') return null;
    if (/document.*(?:does not exist|not exist)|record not found/i.test(String(error.errMsg || error.message || error))) return null;
    throw error;
  }
}

async function optionalCollection(action) {
  try { return await action(); }
  catch (error) {
    // Older deployments may not have initialized every optional feature.
    // Permission, network and storage failures remain visible and retryable.
    if (isMissingCollection(error)) return 0;
    throw error;
  }
}

async function runStep(failures, name, action) {
  try { return await action(); }
  catch (error) {
    console.error(`【cancelAccount】${name}失败`, error);
    failures.push(name);
    return null;
  }
}

// Drain the first page: skipping offsets would miss rows as they are removed.
async function drain(collection, where, remove = row => rawDb.collection(collection).doc(row._id).remove()) {
  return optionalCollection(async () => {
    let removed = 0;
    for (;;) {
      const page = await rawDb.collection(collection).where(where).limit(PAGE_SIZE).get();
      const rows = page.data || [];
      if (!rows.length) return removed;
      for (const row of rows) {
        await remove(row);
        removed++;
      }
    }
  });
}

async function removeWhere(collection, where) { return drain(collection, where); }

async function updateWhere(collection, where, data, beforeUpdate) {
  return optionalCollection(async () => {
    // Updates can stop matching the filter; paginate by immutable IDs.
    let after = '';
    for (;;) {
      const filter = after ? _.and([where, { _id: _.gt(after) }]) : where;
      const page = await rawDb.collection(collection).where(filter).orderBy('_id', 'asc').limit(PAGE_SIZE).get();
      const rows = page.data || [];
      if (!rows.length) return;
      for (const row of rows) {
        // Clean dependent snapshots before removing the fields that locate them.
        if (beforeUpdate) await beforeUpdate(row);
        await rawDb.collection(collection).doc(row._id).update({ data: typeof data === 'function' ? data(row) : data });
      }
      after = rows[rows.length - 1]._id;
    }
  });
}

function collectFileIds(data, keys = ['fileID', 'fileId', 'imageUrl', 'imageUrls', 'originalImageUrl',
  'originalImageUrls', 'fileIDs', 'originalFileIDs', 'poemBgImage', 'seriesCoverImage', 'evidenceImages']) {
  const files = new Set();
  const add = value => {
    if (Array.isArray(value)) value.forEach(add);
    else if (typeof value === 'string' && value.startsWith('cloud://') &&
      !/\/(?:fonts|sticker|static|collage-backgrounds|poet_avatars)\//i.test(value)) files.add(value);
  };
  const visit = value => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) return value.forEach(visit);
    for (const [key, child] of Object.entries(value)) {
      if (keys.includes(key)) add(child);
      else if (child && typeof child === 'object') visit(child);
    }
  };
  visit(data);
  return Array.from(files);
}

async function deleteCloudFiles(fileList) {
  const unique = Array.from(new Set(fileList.filter(Boolean)));
  for (let index = 0; index < unique.length; index += FILE_BATCH_SIZE) {
    const batch = unique.slice(index, index + FILE_BATCH_SIZE);
    const result = await cloud.deleteFile({ fileList: batch });
    // A resolved request can still contain individual storage errors.
    const entries = result && result.fileList;
    if (!Array.isArray(entries) || batch.some(id => {
      const entry = entries.find(item => (item.fileID || item.fileId) === id);
      if (!entry) return true;
      return entry.status !== 0 && !['SUCCESS', 'STORAGE_FILE_NONEXIST', 'FILE_NOT_EXIST'].includes(entry.code) &&
        !/(?:not exist|nonexist|not found)/i.test(String(entry.errMsg || entry.message || ''));
    })) throw new Error('CLOUD_FILE_DELETE_FAILED');
  }
}

async function removeWithFiles(collection, row, keys) {
  // Keep the source until storage succeeds so retries retain every file ID.
  await deleteCloudFiles(collectFileIds(row, keys));
  await rawDb.collection(collection).doc(row._id).remove();
}

const bucketOf = votes => votes < 1 ? null : votes < 4 ? 'seed' : votes < 8 ? 'leaf' : votes < 16 ? 'flower' : 'peach';

async function removeVote(row) {
  await rawDb.runTransaction(async tx => {
    const voteRef = tx.collection('votes_log').doc(row._id);
    const vote = await readDoc(voteRef);
    if (!vote) return;
    const isComment = vote.type === 'comment';
    const targetId = isComment ? vote.commentId : vote.postId;
    const targetRef = targetId ? tx.collection(isComment ? 'comments' : 'posts').doc(targetId) : null;
    const target = targetRef ? await readDoc(targetRef) : null;
    const oldCount = Math.max(0, Number(target && target[isComment ? 'likes' : 'votes']) || 0);
    const newCount = Math.max(0, oldCount - 1);
    const from = bucketOf(oldCount), to = bucketOf(newCount);
    const authorOpenid = target && (target.realAuthorOpenid || target._openid);
    let authorRef = null, author = null;
    if (!isComment && target && from !== to && authorOpenid && authorOpenid !== '123456') {
      const authors = await rawDb.collection('users').where({ _openid: authorOpenid }).limit(1).get();
      if (authors.data && authors.data[0]) {
        authorRef = tx.collection('users').doc(authors.data[0]._id);
        author = await readDoc(authorRef);
      }
    }
    // Counter updates and log removal commit together, so retries cannot decrement twice.
    if (target) await targetRef.update({ data: { [isComment ? 'likes' : 'votes']: newCount } });
    if (author) {
      const counts = { ...(author.growthCounts || {}) };
      if (from) counts[from] = Math.max(0, (Number(counts[from]) || 0) - 1);
      if (to) counts[to] = (Number(counts[to]) || 0) + 1;
      await authorRef.update({ data: { growthCounts: counts, growthUpdatedAt: new Date() } });
    }
    await voteRef.remove();
  });
}

async function removeFolderItem(collection, row) {
  await rawDb.runTransaction(async tx => {
    const ref = tx.collection(collection).doc(row._id);
    const item = await readDoc(ref);
    if (!item) return;
    const folderRef = item.folderId ? tx.collection(collection === 'favorites' ? 'favorite_folders' : 'portfolio_folders').doc(item.folderId) : null;
    const folder = folderRef ? await readDoc(folderRef) : null;
    if (folder) {
      const patch = { itemCount: Math.max(0, (Number(folder.itemCount) || 0) - 1), updateTime: new Date() };
      if (collection === 'portfolio_items') patch.postCount = Math.max(0, (Number(folder.postCount) || 0) - 1);
      await folderRef.update({ data: patch });
    }
    await ref.remove();
  });
}

async function removeReports(where) {
  return drain('post_reports', where, async row => {
    await removeWhere('messages', { reportId: row._id });
    // Snapshot media belongs to the reported post, not necessarily its reporter.
    await removeWithFiles('post_reports', { ...row, postSnapshot: null }, ['evidenceImages']);
  });
}

async function removeReviews(where) {
  return drain('moderation_review', where, async row => {
    await removeWhere('messages', { reviewId: row._id });
    // Preserve the existing missing-collection compatibility; delete private prepared writes.
    await deleteCloudFiles(collectFileIds(row.data || {}));
    await rawDb.collection('moderation_review').doc(row._id).remove();
  });
}

const quotePatch = () => ({ quotedPostId: _.remove(), quotedPostTitle: _.remove(),
  quotedPostAuthor: _.remove(), quotedPostAuthorId: _.remove(), parentPostId: _.remove(),
  quotedPostContent: _.remove(), quotedPostImage: _.remove(), quotedPostImageUrl: _.remove(),
  quotedPostImageUrls: _.remove(), quotedPostAuthorAvatar: _.remove(), quotedPostAuthorSignature: _.remove() });

function discussionQuotePatch(row) {
  const patch = quotePatch();
  if (row.publishMode === 'discussion' || row.isDiscussion === true) {
    for (const key of ['sentenceGroups', 'discussionSentences']) if (Array.isArray(row[key])) {
      patch[key] = row[key].map(group => ({ sentences: [], comment: typeof group.comment === 'string' ? group.comment : '' }));
    }
    patch.highlightLines = _.remove();
    patch.highlightSentence = _.remove();
    if (row.title === `关于「${row.quotedPostTitle}」的讨论` || row.title === `关于「${row.quotedPostTitle}」的多句讨论`) patch.title = '讨论';
  }
  return patch;
}

function scrubDiscussionSnapshot(snapshot, source) {
  const clean = { ...snapshot };
  for (const key of Object.keys(quotePatch()).concat(['sentenceGroups', 'discussionSentences', 'highlightLines', 'highlightSentence'])) delete clean[key];
  const patch = discussionQuotePatch(source);
  clean.title = patch.title || source.title || '';
  clean.content = source.content || '';
  clean.copy = String(source.content || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean).slice(0, 4).join('\n') || clean.title;
  return clean;
}

async function removeWeeklyReferences(postId, fileIds, discussion = null) {
  const media = new Set(fileIds);
  for (const collection of ['weekly_issues', 'weekly_topics']) await optionalCollection(async () => {
    let after = '';
    for (;;) {
      const where = after ? { _id: _.gt(after) } : {};
      const page = await rawDb.collection(collection).where(where).orderBy('_id', 'asc').limit(PAGE_SIZE).get();
      const rows = page.data || [];
      if (!rows.length) return;
      for (const row of rows) await rawDb.runTransaction(async tx => {
        const ref = tx.collection(collection).doc(row._id);
        const current = await readDoc(ref);
        if (!current) return;
        const patch = {};
        for (const key of ['featuredPostIds', 'selectedPostIds']) if (!discussion && Array.isArray(current[key]) && current[key].includes(postId)) {
          patch[key] = current[key].filter(id => id !== postId);
        }
        for (const key of ['featuredSnapshots', 'rankingSnapshot', 'selectedSnapshots']) if (Array.isArray(current[key])) {
          const matching = item => item && (item.postId || item._id || item.id) === postId;
          if (discussion) {
            if (current[key].some(matching)) patch[key] = current[key].map(item => matching(item) ? scrubDiscussionSnapshot(item, discussion) : item);
          } else {
            const filtered = current[key].filter(item => !matching(item));
            if (filtered.length !== current[key].length) patch[key] = filtered;
          }
        }
        if (media.has(current.coverImage)) patch.coverImage = _.remove();
        if (Array.isArray(current.heroItems)) {
          const filtered = current.heroItems.filter(item => !item ||
            (!media.has(item.image) && !media.has(item.imageUrl) && !media.has(item.coverImage)));
          if (filtered.length !== current.heroItems.length) patch.heroItems = filtered;
        }
        if (Object.keys(patch).length) await ref.update({ data: patch });
      });
      after = rows[rows.length - 1]._id;
    }
  });
}

async function clearQuotedPosts(where) {
  await updateWhere('posts', where, discussionQuotePatch, async row => {
    if (row.publishMode === 'discussion' || row.isDiscussion === true) await removeWeeklyReferences(row._id, [], row);
  });
}

async function removeComment(row, ancestors = new Set()) {
  if (ancestors.has(row._id)) throw new Error('COMMENT_PARENT_CYCLE');
  const path = new Set(ancestors); path.add(row._id);
  await drain('comments', _.or([{ parentId: row._id }, { parentCommentId: row._id }, { replyToCommentId: row._id }]), child => removeComment(child, path));
  await drain('votes_log', { commentId: row._id }, removeVote);
  await removeWhere('messages', { commentId: row._id });
  await removeReviews(_.or([{ 'data.parentId': row._id }, { 'related.parentId': row._id }, { resultCommentId: row._id }]));
  await deleteCloudFiles(collectFileIds(row));
  await rawDb.runTransaction(async tx => {
    const ref = tx.collection('comments').doc(row._id);
    const comment = await readDoc(ref);
    if (!comment) return;
    const postRef = comment.postId ? tx.collection('posts').doc(comment.postId) : null;
    const post = postRef ? await readDoc(postRef) : null;
    if (post) await postRef.update({ data: { commentCount: Math.max(0, (Number(post.commentCount) || 0) - 1) } });
    await ref.remove();
  });
}

async function removePost(row) {
  await drain('comments', { postId: row._id }, removeComment);
  await drain('votes_log', { postId: row._id }, removeVote);
  await drain('favorites', { postId: row._id }, item => removeFolderItem('favorites', item));
  await drain('portfolio_items', { postId: row._id }, item => removeFolderItem('portfolio_items', item));
  await removeWhere('messages', { postId: row._id });
  await removeReports({ postId: row._id });
  await removeReviews(_.or([{ postId: row._id }, { 'data.postId': row._id }, { 'related.postId': row._id },
    { 'data.quotedPostId': row._id }, { 'related.quotedPostId': row._id }, { resultPostId: row._id }]));
  for (const collection of ['view_events', 'view_log']) await removeWhere(collection, { postId: row._id });
  await clearQuotedPosts(_.or([{ quotedPostId: row._id }, { parentPostId: row._id }]));
  await removeWeeklyReferences(row._id, collectFileIds(row));
  await removeWithFiles('posts', row);
}

async function removeFeedback(where) {
  return drain('feedback', where, async row => {
    await drain('feedbackReplies', { feedbackId: row._id }, reply => removeWithFiles('feedbackReplies', reply));
    await removeWhere('messages', { feedbackId: row._id });
    await removeWithFiles('feedback', row);
  });
}

async function removeFeedbackReply(row) {
  await removeWhere('messages', { replyId: row._id });
  await deleteCloudFiles(collectFileIds(row));
  await rawDb.runTransaction(async tx => {
    const ref = tx.collection('feedbackReplies').doc(row._id);
    const reply = await readDoc(ref);
    if (!reply) return;
    const parentRef = reply.feedbackId ? tx.collection('feedback').doc(reply.feedbackId) : null;
    const parent = parentRef ? await readDoc(parentRef) : null;
    let patch = null;
    if (parent) {
      // Reading the parent inside this transaction serializes against new replies.
      // CloudBase transactions only support doc reads, so query remaining replies
      // through the database before any transactional writes.
      const remaining = rawDb.collection('feedbackReplies').where({ feedbackId: reply.feedbackId, _id: _.neq(reply._id) });
      const count = await remaining.count();
      const last = await remaining.orderBy('sequence', 'desc').limit(1).get();
      const latest = last.data && last.data[0];
      patch = { replyCount: Number(count.total) || 0 };
      if (!latest || Number(reply.sequence) >= Number(latest.sequence) || parent.lastReply === reply.content) {
        patch.lastReply = latest ? latest.content || '' : _.remove();
        patch.lastReplyRole = latest ? latest.role || '' : _.remove();
      }
    }
    if (patch) await parentRef.update({ data: patch });
    await ref.remove();
  });
}

function maskPhone(phone) {
  if (!phone || phone.length < 7) return phone;
  return phone.startsWith('+86') ? phone.substring(0, 6) + '****' + phone.substring(phone.length - 4)
    : phone.substring(0, 3) + '****' + phone.substring(phone.length - 4);
}

function phoneVariants(phone) {
  const raw = String(phone || '').trim();
  if (!raw) return [];
  const local = raw.replace(/^\+86/, '');
  return Array.from(new Set([raw, local, `+86${local}`]));
}

async function scrubAdministrativeReferences(openid, user) {
  for (const collection of ['activities', 'activity_notices', 'collage_materials', 'collage_material_groups',
    'weekly_issues', 'weekly_topics', 'adminConfig']) {
    for (const field of ['createdBy', 'updatedBy']) await updateWhere(collection, { [field]: openid }, { [field]: _.remove() });
  }
  for (const collection of ['post_reports', 'moderation_review']) {
    for (const field of ['processingBy', 'handledBy', 'reviewedBy']) await updateWhere(collection, { [field]: openid }, { [field]: _.remove() });
  }
  for (const field of ['processedBy', 'deletedBy']) await updateWhere('feedback', { [field]: openid }, { [field]: _.remove() });
  await updateWhere('users', { postingBanUpdatedBy: openid }, { postingBanUpdatedBy: _.remove() });
  await updateWhere('poets', { creatorOpenid: openid }, { creatorOpenid: _.remove() });
  if (user && user.poemId) await optionalCollection(() => rawDb.runTransaction(async tx => {
    const ref = tx.collection('adminConfig').doc('admin');
    const config = await readDoc(ref);
    if (config && Array.isArray(config.adminPoemIds) && config.adminPoemIds.includes(user.poemId)) {
      await ref.update({ data: { adminPoemIds: config.adminPoemIds.filter(id => id !== user.poemId),
        version: (Number(config.version) || 0) + 1, updatedAt: new Date() } });
    }
  }));
}

async function finishAccount(user) {
  if (!user) return;
  await optionalCollection(async () => {
    for (;;) {
      const page = await rawDb.collection('wechat_bindings').where({ userId: user._id }).limit(PAGE_SIZE).get();
      const links = page.data || [];
      if (!links.length) return;
      await rawDb.runTransaction(async tx => {
        const owned = [];
        for (const link of links) {
          const ref = tx.collection('wechat_bindings').doc(link._id);
          const current = await readDoc(ref);
          if (current && current.userId === user._id) owned.push(ref);
        }
        for (const ref of owned) await ref.remove();
      });
    }
  });
  await rawDb.runTransaction(async tx => {
    const ref = tx.collection('users').doc(user._id);
    const current = await readDoc(ref);
    if (!current) return;
    if (current._openid !== user._openid || (current.password || '') !== (user.password || '')) throw new Error('ACCOUNT_CHANGED');
    await ref.remove();
  });
}

async function removeIdentities(openid, user, wxids) {
  const refs = Array.from(new Set([user && user.user_id, user && user._id].filter(Boolean)));
  await removeWhere('user_identities', _.or([
    { _openid: openid }, ...refs.flatMap(id => [{ user_id: id }, { userId: id }])
  ]));
  for (const wxid of wxids) {
    // Old native IDs can have been rebound to another account. Never erase its identity.
    const link = await optionalCollection(() => readDoc(rawDb.collection('wechat_bindings').doc(
      crypto.createHash('sha256').update(wxid).digest('hex'))));
    if (link && link.userId && (!user || link.userId !== user._id)) continue;
    const bound = await rawDb.collection('users').where({ wechatOpenId: wxid }).limit(2).get();
    if ((bound.data || []).some(account => !user || account._id !== user._id)) continue;
    await optionalCollection(async () => {
      let after = '';
      for (;;) {
        const where = { provider: 'weapp', subject_id: wxid, ...(after ? { _id: _.gt(after) } : {}) };
        const page = await rawDb.collection('user_identities').where(where).orderBy('_id', 'asc').limit(PAGE_SIZE).get();
        const rows = page.data || [];
        if (!rows.length) return;
        for (const row of rows) {
          const owner = row.user_id || row.userId;
          if (!owner || refs.includes(owner)) await rawDb.collection('user_identities').doc(row._id).remove();
        }
        after = rows[rows.length - 1]._id;
      }
    });
  }
}

async function cancelAccount(openid, user, wxContext) {
  const failures = [];
  const owned = _.or([{ _openid: openid }, { realAuthorOpenid: openid }]);
  const wxids = Array.from(new Set([openid, user && user.wechatOpenId].filter(Boolean)));
  const userRefs = Array.from(new Set([openid, user && user._id, user && user.user_id].filter(Boolean)));
  const ownRef = _.or([{ _openid: openid }, ...userRefs.map(userId => ({ userId }))]);

  await runStep(failures, 'posts', () => drain('posts', owned, removePost));
  await runStep(failures, 'comments', () => drain('comments', owned, removeComment));
  await runStep(failures, 'quoted_authors', () => clearQuotedPosts({ quotedPostAuthorId: openid }));
  await runStep(failures, 'drafts', () => drain('drafts', { _openid: openid }, row => removeWithFiles('drafts', row)));
  await runStep(failures, 'moderation_review', () => removeReviews({ submitterOpenid: openid }));
  await runStep(failures, 'post_reports', () => removeReports({ reporterOpenid: openid }));
  await runStep(failures, 'favorites', () => drain('favorites', ownRef, row => removeFolderItem('favorites', row)));
  await runStep(failures, 'favorite_folders', () => drain('favorite_folders', ownRef, row => removeWithFiles('favorite_folders', row, ['coverUrl'])));
  await runStep(failures, 'portfolio_items', () => drain('portfolio_items', ownRef, row => removeFolderItem('portfolio_items', row)));
  await runStep(failures, 'portfolio_folders', () => drain('portfolio_folders', ownRef, row => removeWithFiles('portfolio_folders', row, ['coverUrl', 'coverImage'])));
  await runStep(failures, 'follows', () => removeWhere('follows', _.or([{ _openid: openid }, { followerId: openid }, { followedId: openid }])));
  await runStep(failures, 'blocks', () => removeWhere('blocks', _.or([{ _openid: openid }, { blockerId: openid }, { blockedId: openid }])));
  await runStep(failures, 'messages', () => removeWhere('messages', _.or([{ _openid: openid }, { fromUserId: openid }, { toUserId: openid }, ...userRefs.map(userId => ({ userId }))])));
  await runStep(failures, 'votes_log', () => drain('votes_log', { _openid: openid }, removeVote));
  // Security/filing login logs are retained after cancellation; never delete or rewrite login_logs here.
  for (const collection of ['search_logs', 'api_rate_limits', 'view_events', 'view_log', 'weekly_issue_views', 'moderation_logs']) {
    await runStep(failures, collection, () => removeWhere(collection, _.or([{ openid }, { _openid: openid }, { userOpenid: openid }, ...userRefs.map(userId => ({ userId }))])));
  }
  await runStep(failures, 'web_reader_sessions', () => removeWhere('web_reader_sessions', { owner: openid }));
  await runStep(failures, 'images', () => drain('images', { _openid: openid }, row => removeWithFiles('images', row)));
  await runStep(failures, 'collage_ocr', async () => {
    const identities = wxids.flatMap(wxid => [`wx:${wxid}`, `tcb:${wxid}`]);
    if (wxContext.TCB_UUID || wxContext.UID) identities.push(`tcb:${wxContext.TCB_UUID || wxContext.UID}`);
    const owners = Array.from(new Set(identities.map(collageOwner)));
    await drain('collage_ocr_cache', _.or(owners.map(owner => ({ owner }))), row => removeWithFiles('collage_ocr_cache', row));
    await drain('collage_ocr_usage', _.or(owners.map(owner => ({ owner }))));
    // Daily documents have no owner field; the trusted owner is embedded in their IDs.
    for (const owner of owners) await drain('collage_ocr_usage', { _id: rawDb.RegExp({ regexp: `^day-.*-${owner}$` }) });
  });
  await runStep(failures, 'feedback', () => removeFeedback({ userOpenid: openid }));
  await runStep(failures, 'feedbackReplies', () => drain('feedbackReplies', { senderId: openid }, removeFeedbackReply));
  await runStep(failures, 'administrative_references', () => scrubAdministrativeReferences(openid, user));
  await runStep(failures, 'sms', async () => {
    const variants = phoneVariants(user && user.phoneNumber);
    if (!variants.length) return;
    await removeWhere('sms_codes', _.or(variants.map(phone => ({ phone }))));
    const local = variants[0].replace(/^\+86/, '');
    const rateId = 'login_rate_' + crypto.createHash('sha256').update(local).digest('hex');
    await removeWhere('sms_codes', { _id: rateId });
    await removeWhere('sms_logs', _.or(Array.from(new Set(variants.map(maskPhone))).map(phone => ({ phone }))));
  });
  await runStep(failures, 'wechat_grants', () => removeWhere('wechat_binding_grants', _.or(userRefs.map(userId => ({ userId })))));
  await runStep(failures, 'user_identities', () => removeIdentities(openid, user, wxids));
  await runStep(failures, 'profile_files', () => deleteCloudFiles(collectFileIds(user, ['avatarUrl', 'avatarFileID', 'signatureUrl', 'signature', 'signatureImage', 'backgroundImage'])));

  // Keep identity and credentials until every dependency succeeds, allowing owner retries.
  if (!failures.length) await runStep(failures, 'users', () => finishAccount(user));
  return failures;
}

exports.main = async (event = {}, context = {}) => {
  const runtime = runtimeEnvironment(context);
  const wxContext = { ...(cloud.getWXContext() || {}), TCB_UUID: runtime.TCB_UUID };
  const trustedWxid = wxContext.OPENID || '';
  const claimed = typeof event.openid === 'string' ? event.openid.trim() : '';
  const openid = claimed || trustedWxid;
  const password = typeof event.password === 'string' ? event.password : '';
  if (!openid) return { success: false, code: 'NO_OPENID', message: '无法获取用户标识，请重新登录' };

  try {
    const result = await rawDb.collection('users').where({ _openid: openid }).limit(2).get();
    const candidates = result.data || [];
    if (candidates.length > 1) return { success: false, code: 'AMBIGUOUS_ACCOUNT', message: '账号标识重复，请联系管理员核查' };
    const user = candidates[0] || null;
    // Explicit rebind/disabled state wins over an obsolete native _openid.
    const linked = !!trustedWxid && (!user ? trustedWxid === openid : user.wechatOpenId
      ? user.wechatOpenId === trustedWxid : user._openid === trustedWxid && user.wechatLoginDisabled !== true);
    if (trustedWxid && claimed && !linked) return { success: false, code: 'IDENTITY_MISMATCH', message: '当前微信与账号不匹配，请重新登录' };
    const requiresPassword = !!(user && user.password);
    if (!linked && !requiresPassword) return { success: false, code: 'IDENTITY_REQUIRED', message: '请先设置账号密码，再尝试注销' };
    if (event.dryRun === true) return { success: true, dryRun: true, hasAccount: !!user, requiresPassword };
    if (requiresPassword && password !== user.password) return {
      success: false, code: password ? 'PASSWORD_MISMATCH' : 'PASSWORD_REQUIRED',
      message: password ? '密码不正确，请重新输入' : '请输入账号密码以确认注销'
    };
    const failures = await cancelAccount(openid, user, wxContext);
    if (failures.length) return { success: false, code: 'CANCEL_INCOMPLETE', message: '注销未全部完成，请重试', failed: failures };
    console.log('【cancelAccount】账号及关联信息已删除');
    return { success: true, message: '账号及全部关联信息已删除' };
  } catch (error) {
    console.error('【cancelAccount】注销失败', error);
    return { success: false, code: 'CANCEL_ERROR', message: '注销失败，请重试' };
  }
};

exports.main = withPostResponse(exports.main);
