const crypto = require('crypto');
const cloud = require('wx-server-sdk');
const { createPostsDatabase, withPostResponse } = require('./_lib/posts');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const rawDb = cloud.database();
const db = createPostsDatabase(rawDb);
const _ = db.command;

const DELETED_AUTHOR_NAME = '已注销用户';
const DELETED_OPENID = 'deleted_user';
const DEFAULT_AVATAR = '/static/images/avatar.png';
const PAGE_SIZE = 100;
const FILE_BATCH_SIZE = 50;

const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const bindingId = wxid => digest(String(wxid || ''));
const collageOwner = identity => digest(identity).slice(0, 32);

function maskPhone(phone) {
  if (!phone || phone.length < 7) {
    return phone;
  }
  if (phone.startsWith('+86')) {
    return phone.substring(0, 6) + '****' + phone.substring(phone.length - 4);
  }
  return phone.substring(0, 3) + '****' + phone.substring(phone.length - 4);
}

function phoneVariants(phone) {
  const raw = String(phone || '').trim();
  if (!raw) {
    return [];
  }
  const local = raw.replace(/^\+86/, '');
  return Array.from(new Set([raw, local, `+86${local}`]));
}

async function runStep(failures, name, action) {
  try {
    return await action();
  } catch (error) {
    console.error(`【cancelAccount】${name}失败`, error);
    failures.push(name);
    return null;
  }
}

async function removeWhere(collection, where) {
  const result = await rawDb.collection(collection).where(where).remove();
  return result && result.stats ? result.stats.removed : 0;
}

async function updateWhere(collection, where, data) {
  const result = await rawDb.collection(collection).where(where).update({ data });
  return result && result.stats ? result.stats.updated : 0;
}

async function updateMatching(collection, where, buildPatch) {
  const coll = collection === 'posts' ? db.collection('posts') : rawDb.collection(collection);
  const idRef = rawDb.collection(collection);
  let updated = 0;
  for (;;) {
    const page = await idRef.where(where).field({ _id: true }).limit(PAGE_SIZE).get();
    const ids = (page.data || []).map(item => item._id).filter(Boolean);
    if (!ids.length) {
      return updated;
    }
    const result = await coll.where({ _id: _.in(ids) }).update({ data: buildPatch() });
    const changed = result && result.stats ? result.stats.updated : 0;
    updated += changed;
    if (!changed) {
      console.warn(`【cancelAccount】${collection} 批量更新没有进展，停止循环`);
      return updated;
    }
  }
}

async function collectFileIds(collection, where) {
  const page = await rawDb.collection(collection).where(where).field({ fileID: true }).limit(1000).get();
  return (page.data || []).map(item => item.fileID).filter(Boolean);
}

async function deleteCloudFiles(fileList) {
  const unique = Array.from(new Set(fileList.filter(Boolean)));
  for (let index = 0; index < unique.length; index += FILE_BATCH_SIZE) {
    await cloud.deleteFile({ fileList: unique.slice(index, index + FILE_BATCH_SIZE) });
  }
}

async function anonymizePosts(openid) {
  await updateMatching('posts', { _openid: openid }, () => ({
    _openid: DELETED_OPENID,
    realAuthorOpenid: _.remove(),
    authorName: DELETED_AUTHOR_NAME,
    anonymousAuthorName: DELETED_AUTHOR_NAME,
    authorNameSnapshot: DELETED_AUTHOR_NAME,
    author: DELETED_AUTHOR_NAME,
    authorAvatar: DEFAULT_AVATAR,
    authorAvatarSnapshot: DEFAULT_AVATAR,
    authorSignature: _.remove()
  }));
  // v2 匿名帖真实作者在 realAuthorOpenid，_openid 保持 123456 以免匿名判定失效。
  await updateMatching('posts', {
    realAuthorOpenid: openid,
    _openid: _.neq(openid)
  }, () => ({
    realAuthorOpenid: _.remove(),
    authorName: DELETED_AUTHOR_NAME,
    anonymousAuthorName: DELETED_AUTHOR_NAME,
    author: DELETED_AUTHOR_NAME,
    authorAvatar: DEFAULT_AVATAR,
    authorSignature: _.remove()
  }));
  // 其他用户引用该账号帖子时保存的作者快照。
  await updateWhere('posts', { quotedPostAuthorId: openid }, { quotedPostAuthor: DELETED_AUTHOR_NAME });
}

async function anonymizeComments(openid) {
  await updateMatching('comments', {
    _openid: openid
  }, () => ({
    _openid: DELETED_OPENID,
    realAuthorOpenid: _.remove(),
    authorDeleted: true,
    authorName: DELETED_AUTHOR_NAME,
    authorAvatar: DEFAULT_AVATAR,
    isAnonymous: _.remove()
  }));
  await updateMatching('comments', {
    realAuthorOpenid: openid,
    _openid: _.neq(openid)
  }, () => ({
    realAuthorOpenid: _.remove(),
    authorDeleted: true,
    authorName: DELETED_AUTHOR_NAME,
    authorAvatar: DEFAULT_AVATAR
  }));
}

async function adjustVoteCounters(openid) {
  const votes = await rawDb.collection('votes_log').where({ _openid: openid }).limit(1000).get();
  const postDeltas = new Map();
  const commentDeltas = new Map();
  for (const row of votes.data || []) {
    const target = row.type === 'comment' ? commentDeltas : postDeltas;
    const id = row.type === 'comment' ? row.commentId : row.postId;
    if (id) {
      target.set(id, (target.get(id) || 0) + 1);
    }
  }
  await Promise.all([
    ...Array.from(postDeltas.entries()).map(([postId, count]) =>
      rawDb.collection('posts').doc(postId).update({ data: { votes: _.inc(-count) } }).catch(() => {})),
    ...Array.from(commentDeltas.entries()).map(([commentId, count]) =>
      rawDb.collection('comments').doc(commentId).update({ data: { likes: _.inc(-count) } }).catch(() => {}))
  ]);
}

async function cancelAccount(openid, user) {
  const failures = [];
  const userId = user ? user.user_id : null;
  const wxids = Array.from(new Set([openid, user && user.wechatOpenId].filter(Boolean)));
  const phone = user && user.phoneNumber;

  await runStep(failures, 'anonymizePosts', () => anonymizePosts(openid));
  await runStep(failures, 'anonymizeComments', () => anonymizeComments(openid));

  await runStep(failures, 'drafts', () => removeWhere('drafts', { _openid: openid }));
  await runStep(failures, 'favorites', () => removeWhere('favorites', _.or([{ _openid: openid }, { userId: openid }])));
  await runStep(failures, 'favorite_folders', () => removeWhere('favorite_folders', { _openid: openid }));
  await runStep(failures, 'portfolio_items', () => removeWhere('portfolio_items', { _openid: openid }));
  await runStep(failures, 'portfolio_folders', () => removeWhere('portfolio_folders', { _openid: openid }));
  await runStep(failures, 'follows', () => removeWhere('follows', _.or([{ followerId: openid }, { followedId: openid }])));
  await runStep(failures, 'blocks', () => removeWhere('blocks', _.or([{ blockerId: openid }, { blockedId: openid }])));
  await runStep(failures, 'messages', () => removeWhere('messages', _.or([
    { fromUserId: openid }, { toUserId: openid }, { userId: openid }
  ])));
  await runStep(failures, 'votes_log', async () => {
    await adjustVoteCounters(openid);
    return removeWhere('votes_log', { _openid: openid });
  });
  await runStep(failures, 'search_logs', () => removeWhere('search_logs', { openid }));
  await runStep(failures, 'api_rate_limits', () => removeWhere('api_rate_limits', { openid }));
  await runStep(failures, 'view_events', () => removeWhere('view_events', { _openid: openid }));
  await runStep(failures, 'view_log', () => removeWhere('view_log', { _openid: openid }));
  await runStep(failures, 'weekly_issue_views', () => removeWhere('weekly_issue_views', { _openid: openid }));

  await runStep(failures, 'images', async () => {
    const fileIds = await collectFileIds('images', { _openid: openid });
    await removeWhere('images', { _openid: openid });
    await deleteCloudFiles(fileIds);
  });

  await runStep(failures, 'collage_ocr', async () => {
    const owners = wxids.map(wxid => [collageOwner(`wx:${wxid}`), collageOwner(`tcb:${wxid}`)]).flat();
    const fileIds = await collectFileIds('collage_ocr_cache', _.or(owners.map(owner => ({ owner }))));
    await removeWhere('collage_ocr_cache', _.or(owners.map(owner => ({ owner }))));
    await removeWhere('collage_ocr_usage', _.or(owners.map(owner => ({ owner }))));
    await deleteCloudFiles(fileIds);
  });

  await runStep(failures, 'feedback', async () => {
    await updateWhere('feedback', { userOpenid: openid }, {
      userOpenid: DELETED_OPENID,
      userName: DELETED_AUTHOR_NAME
    });
    await updateWhere('feedbackReplies', { senderId: openid }, {
      senderId: DELETED_OPENID,
      senderName: DELETED_AUTHOR_NAME
    });
  });

  await runStep(failures, 'moderation_logs', () => updateWhere('moderation_logs',
    _.or([{ openid }, { _openid: openid }]),
    { openid: DELETED_OPENID, _openid: DELETED_OPENID }));

  await runStep(failures, 'poets', () => updateWhere('poets', { creatorOpenid: openid }, { creatorOpenid: _.remove() }));

  await runStep(failures, 'sms', async () => {
    if (!phone) {
      return 0;
    }
    const variants = phoneVariants(phone);
    await removeWhere('sms_codes', _.or(variants.map(value => ({ phone: value }))));
    await removeWhere('sms_logs', { phone: maskPhone(phoneVariants(phone)[0]) });
  });

  await runStep(failures, 'wechat_grants', () => removeWhere('wechat_binding_grants', _.or([
    ...(userId ? [{ userId }] : []),
    ...wxids.map(wxid => ({ wxid }))
  ])));
  await runStep(failures, 'wechat_bindings', async () => {
    for (const wxid of wxids) {
      await rawDb.collection('wechat_bindings').doc(bindingId(wxid)).remove().catch(() => {});
    }
  });
  await runStep(failures, 'user_identities', () => removeWhere('user_identities', _.or([
    ...(userId ? [{ user_id: userId }] : []),
    ...wxids.map(wxid => ({ provider: 'weapp', subject_id: wxid }))
  ])));

  await runStep(failures, 'users', () => removeWhere('users', { _openid: openid }));

  return failures;
}

exports.main = async (event = {}) => {
  const wxContext = cloud.getWXContext();
  const trustedWxid = wxContext.OPENID || '';
  const claimed = typeof event.openid === 'string' ? event.openid.trim() : '';
  const openid = claimed || trustedWxid;
  const password = typeof event.password === 'string' ? event.password : '';

  if (!openid) {
    return { success: false, code: 'NO_OPENID', message: '无法获取用户标识，请重新登录' };
  }

  try {
    const userResult = await rawDb.collection('users').where({ _openid: openid }).limit(2).get();
    const candidates = userResult.data || [];
    if (candidates.length > 1) {
      return { success: false, code: 'AMBIGUOUS_ACCOUNT', message: '账号标识重复，请联系管理员核查' };
    }
    const user = candidates[0] || null;

    // 微信内调用时，客户端上报的账号必须绑定当前微信，防止借道注销他人账号。
    if (trustedWxid && claimed && claimed !== trustedWxid) {
      const linked = !!user && (user._openid === trustedWxid || user.wechatOpenId === trustedWxid);
      if (!linked) {
        return { success: false, code: 'IDENTITY_MISMATCH', message: '当前微信与账号不匹配，请重新登录' };
      }
    }

    if (event.dryRun === true) {
      return {
        success: true,
        dryRun: true,
        hasAccount: !!user,
        requiresPassword: !!(user && user.password)
      };
    }

    if (user && user.password && password !== user.password) {
      return {
        success: false,
        code: password ? 'PASSWORD_MISMATCH' : 'PASSWORD_REQUIRED',
        message: password ? '密码不正确，请重新输入' : '请输入账号密码以确认注销'
      };
    }

    const failures = await cancelAccount(openid, user);
    if (failures.length) {
      return {
        success: false,
        code: 'CANCEL_INCOMPLETE',
        message: '注销未全部完成，请重试',
        failed: failures
      };
    }

    console.log('【cancelAccount】账号已注销', { openid, hadAccount: !!user });
    return { success: true, message: '账号已注销' };
  } catch (error) {
    console.error('【cancelAccount】注销失败', error);
    return { success: false, code: 'CANCEL_ERROR', message: '注销失败，请重试' };
  }
};

exports.main = withPostResponse(exports.main);
