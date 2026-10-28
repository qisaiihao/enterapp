const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const cloud = require('wx-server-sdk');
const { memoryDb } = require('./helpers/posts-memory-db.cjs');

cloud.init({ env: 'cancel-account-test' });
const command = cloud.database().command;
const root = path.resolve(__dirname, '..');
const quiet = { log() {}, warn() {}, error() {} };

function runtimeLoader(db, runtime) {
  const context = vm.createContext({ Date, process: { env: {} }, console: quiet });
  const cache = new Map();
  function load(filename) {
    filename = require.resolve(filename);
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} };
    cache.set(filename, module);
    const localRequire = id => {
      if (id === 'wx-server-sdk') {
        return {
          init() {},
          database: () => db,
          getWXContext: () => ({ OPENID: runtime.wxid }),
          deleteFile: async ({ fileList }) => {
            runtime.deletedFiles.push(...fileList);
            if (runtime.fileError) throw runtime.fileError;
            return { fileList: fileList.map(fileID => ({ fileID, status: runtime.fileStatus || 0 })) };
          }
        };
      }
      if (id === 'crypto') return require('node:crypto');
      if (id.startsWith('.')) return load(path.resolve(path.dirname(filename), id));
      throw new Error('Unexpected dependency: ' + id);
    };
    vm.runInContext('(function(require,module,exports){\n' + fs.readFileSync(filename, 'utf8') + '\n})', context, { filename })(localRequire, module, module.exports);
    return module.exports;
  }
  return load;
}

function fixture() {
  const openid = 'openid-owner';
  const peer = 'openid-peer';
  const ownerHash = require('node:crypto').createHash('sha256').update(`wx:${openid}`).digest('hex').slice(0, 32);
  const rows = {
    users: [
      { _id: 'user-owner', _openid: openid, user_id: 'u_owner', poemId: 'poemOwner', password: 'secret', nickName: '原作者', phoneNumber: '13800138000', wechatOpenId: 'wx-bound', avatarUrl: 'cloud://avatar-owner' },
      { _id: 'user-peer', _openid: peer, user_id: 'u_peer', poemId: 'poemPeer', password: 'peer', nickName: '路人' }
    ],
    drafts: [{ _id: 'd1', _openid: openid }, { _id: 'd2', _openid: peer }],
    moderation_review: [
      { _id: 'review-pending', submitterOpenid: openid, submitterName: '原作者', status: 'pending', data: { _openid: openid, content: '未公开正文', imageUrls: ['cloud://shared-public-image'] } },
      { _id: 'review-approved', submitterOpenid: openid, status: 'approved', data: { realAuthorOpenid: openid }, resultPostId: 'post-public' },
      { _id: 'review-rejected', submitterOpenid: openid, status: 'rejected', snapshot: { content: '私密快照' } },
      { _id: 'review-peer', submitterOpenid: peer, status: 'pending', data: { content: '他人提交' } }
    ],
    favorites: [{ _id: 'fav1', _openid: openid, postId: 'post-public' }, { _id: 'fav2', userId: openid, postId: 'post-public' }, { _id: 'fav3', _openid: peer }, { _id: 'fav-peer-ref', _openid: peer, postId: 'post-public' }],
    favorite_folders: [{ _id: 'ff1', _openid: openid }],
    portfolio_items: [{ _id: 'pi1', _openid: openid }, { _id: 'pi-peer-ref', _openid: peer, postId: 'post-public' }],
    portfolio_folders: [{ _id: 'pf1', _openid: openid }],
    follows: [{ _id: 'fo1', followerId: openid, followedId: peer }, { _id: 'fo2', followerId: peer, followedId: openid }],
    blocks: [{ _id: 'b1', blockerId: openid, blockedId: peer }, { _id: 'b2', blockerId: peer, blockedId: openid }],
    messages: [{ _id: 'm1', fromUserId: openid, toUserId: peer }, { _id: 'm2', fromUserId: peer, toUserId: openid }, { _id: 'm3', fromUserId: peer, toUserId: peer }, { _id: 'm-reply-ref', fromUserId: peer, toUserId: peer, replyId: 'fr-admin', replyContent: '本人管理员回复' }],
    votes_log: [
      { _id: 'v1', _openid: openid, type: 'post', postId: 'post-public' },
      { _id: 'v2', _openid: openid, type: 'post', postId: 'post-public' },
      { _id: 'v3', _openid: openid, type: 'comment', commentId: 'c-retained' },
      { _id: 'v4', _openid: openid, type: 'post', postId: 'post-peer' },
      { _id: 'v-peer-ref', _openid: peer, type: 'post', postId: 'post-public' }
    ],
    search_logs: [{ _id: 's1', openid }, { _id: 's2', openid: peer }],
    login_logs: [
      {
        _id: 'login-owner', schemaVersion: 1, userId: 'user-owner', userOpenid: openid, poemId: 'poemOwner',
        loginTime: new Date('2026-10-13T02:03:04.000Z'), loginMethod: 'password',
        clientInfo: { platform: 'app', os: 'android', osVersion: '14', deviceModel: 'Owner model', deviceBrand: 'Owner brand', appVersion: '1.7.5', appVersionCode: '175', sdkVersion: '4.0', userAgent: '' },
        clientInfoSource: 'client_reported', cloudSource: 'client',
        network: { clientIp: '192.0.2.1', sourcePort: 49152, ipSource: 'wxContext.CLIENTIP', portSource: 'wxContext.CLIENTPORT' },
        requestId: 'owner-login-request'
      },
      {
        _id: 'login-peer', schemaVersion: 1, userId: 'user-peer', userOpenid: peer, poemId: 'poemPeer',
        loginTime: new Date('2026-10-13T05:06:07.000Z'), loginMethod: 'wechat',
        clientInfo: { platform: 'mp-weixin', os: 'ios', osVersion: '18', deviceModel: 'Peer model', deviceBrand: 'Peer brand', appVersion: '1.7.5', appVersionCode: '', sdkVersion: '3.0', userAgent: '' },
        clientInfoSource: 'client_reported', cloudSource: 'wx_client',
        network: { clientIp: '2001:db8::2', sourcePort: null, ipSource: 'wxContext.CLIENTIPV6', portSource: 'unavailable' },
        requestId: 'peer-login-request'
      }
    ],
    api_rate_limits: [{ _id: 'r1', openid }],
    view_events: [{ _id: 've1', _openid: openid }],
    view_log: [{ _id: 'vl1', _openid: openid }],
    weekly_issue_views: [{ _id: 'wv1', _openid: openid }],
    images: [{ _id: 'i1', _openid: openid, fileID: 'cloud://img-1' }],
    collage_ocr_cache: [{ _id: 'co1', owner: 'unrelated', fileID: 'cloud://ocr-other' }, { _id: 'co-owner', owner: ownerHash, fileID: 'cloud://ocr-owner' }],
    collage_ocr_usage: [{ _id: 'cu1', owner: 'unrelated' }, { _id: `day-2026-10-13-${ownerHash}`, count: 2 }],
    feedback: [{ _id: 'fb1', userOpenid: openid, userName: '原作者' }, { _id: 'fb-peer', userOpenid: peer, lastReply: '本人管理员回复', lastReplyRole: 'admin', replyCount: 2 }],
    feedbackReplies: [{ _id: 'fr1', senderId: openid, senderName: '原作者' }, { _id: 'fr2', senderId: 'admin', senderName: '客服', feedbackId: 'fb1' }, { _id: 'fr-peer', senderId: peer, feedbackId: 'fb-peer', content: '他人反馈回复', sequence: 1, role: 'user' }, { _id: 'fr-admin', senderId: openid, feedbackId: 'fb-peer', content: '本人管理员回复', sequence: 2, role: 'admin' }],
    moderation_logs: [{ _id: 'ml1', openid, _openid: openid, excerpt: 'x' }],
    poets: [{ _id: 'p1', name: '原作者', creatorOpenid: openid }],
    sms_codes: [{ _id: 'sc1', phone: '13800138000' }, { _id: 'sc2', phone: '+8613800138000' }, { _id: 'sc3', phone: '13900139000' }, { _id: 'login_rate_' + require('node:crypto').createHash('sha256').update('13800138000').digest('hex'), count: 1 }],
    sms_logs: [{ _id: 'sl1', phone: '138****8000' }, { _id: 'sl2', phone: '139****9000' }],
    wechat_bindings: [
      { _id: require('node:crypto').createHash('sha256').update('openid-owner').digest('hex'), userId: 'user-owner' },
      { _id: require('node:crypto').createHash('sha256').update('wx-bound').digest('hex'), userId: 'user-owner' }
    ],
    wechat_binding_grants: [{ _id: 'g1', userId: 'user-owner', wxid: 'wx-bound' }, { _id: 'g-old-wx', userId: 'user-owner', wxid: 'wx-old' }, { _id: 'g2', userId: 'user-peer', wxid: 'wx-peer' }],
    user_identities: [{ _id: 'id1', user_id: 'u_owner', provider: 'weapp', subject_id: 'openid-owner' }, { _id: 'id2', user_id: 'u_peer', provider: 'weapp', subject_id: peer }],
    comments: [
      { _id: 'c-owner', _openid: openid, postId: 'post-peer', authorName: '原作者', likes: 2 },
      { _id: 'c-peer', _openid: peer, postId: 'post-public', authorName: '路人', likes: 5 },
      { _id: 'c-retained', _openid: peer, postId: 'post-peer', authorName: '路人', likes: 5 },
      { _id: 'c-reply', _openid: peer, postId: 'post-peer', parentId: 'c-owner', replyToAuthorName: '原作者', imageUrls: ['cloud://reply-image'] },
      { _id: 'c-anon', _openid: '123456', realAuthorOpenid: openid, postId: 'post-peer', authorName: '佚名' }
    ],
    posts: [
      { _id: 'post-public', schemaVersion: 2, publishMode: 'poem', _openid: openid, title: '本人诗标题', author: '原作者', authorName: '原作者', votes: 3, quotedPostAuthor: '', imageUrls: ['cloud://post-image'], poemBgImage: 'cloud://env/collage-backgrounds/public.jpg' },
      { _id: 'post-anon', schemaVersion: 2, publishMode: 'poem', isAnonymous: true, _openid: '123456', realAuthorOpenid: openid, authorName: '佚名', votes: 1 },
      { _id: 'post-peer', schemaVersion: 2, publishMode: 'discussion', _openid: peer, authorName: '路人', votes: 2, commentCount: 4, title: '关于「本人诗标题」的讨论', content: '路人的评论', sentenceGroups: [{ sentences: ['本人诗句'], comment: '路人的点评' }], highlightLines: ['本人诗句'], quotedPostId: 'post-public', quotedPostTitle: '本人诗标题', quotedPostAuthorId: openid, quotedPostAuthor: '原作者', quotedPostContent: '本人正文快照' }
    ],
    post_reports: [
      { _id: 'report-owner', reporterOpenid: openid, postId: 'post-peer', evidenceImages: ['cloud://report-image'] },
      { _id: 'report-target', reporterOpenid: peer, postId: 'post-public', postOwnerOpenid: openid, postSnapshot: { content: '本人正文' } },
      { _id: 'report-peer', reporterOpenid: peer, postId: 'post-peer' }
    ],
    weekly_issues: [{ _id: 'weekly1', featuredPostIds: ['post-public', 'post-peer'], featuredSnapshots: [{ postId: 'post-public', authorName: '原作者', content: '本人正文' }, { postId: 'post-peer', authorName: '路人', title: '关于「本人诗标题」的讨论', highlightLines: ['本人诗句'] }], rankingSnapshot: [{ postId: 'post-anon', realAuthorOpenid: openid, content: '匿名正文' }, { postId: 'post-peer' }] }],
    weekly_topics: [{ _id: 'topic1', selectedPostIds: ['post-anon', 'post-peer'], selectedSnapshots: [{ postId: 'post-anon', content: '匿名正文' }, { postId: 'post-peer' }] }],
    web_reader_sessions: [{ _id: 'web-owner', owner: openid, caller: 'tcb-owner' }, { _id: 'web-peer', owner: peer, caller: 'tcb-peer' }],
    adminConfig: [{ _id: 'admin', adminPoemIds: ['poemOwner', 'poemPeer'], version: 1 }]
  };
  return { openid, peer, rows };
}

async function call(loader, runtime, event) {
  const main = loader(path.join(root, 'functions/cancelAccount/index.js')).main;
  return main(event, runtime.context || {});
}

function createHarness(options = {}) {
  const data = fixture();
  const runtime = { wxid: '', deletedFiles: [], collectionAccesses: [] };
  const mem = memoryDb(data.rows, command);
  const expectedLoginLogs = structuredClone(mem.tables.login_logs);
  const originalCollection = mem.db.collection.bind(mem.db);
  mem.db.collection = name => {
    runtime.collectionAccesses.push(name);
    if (name === 'login_logs' && options.loginLogsError) throw options.loginLogsError;
    return originalCollection(name);
  };
  if (options.moderationReviewRemove || options.moderationReviewGet || options.beforeRemove) {
    const collection = mem.db.collection.bind(mem.db);
    mem.db.collection = name => {
      const ref = collection(name);
      function wrap(query) {
        const wrapped = { ...query, remove: async () => {
          if (options.beforeRemove) await options.beforeRemove(name, query);
          if (name === 'moderation_review' && options.moderationReviewRemove) return options.moderationReviewRemove(query);
          return query.remove();
        } };
        if (name === 'moderation_review' && options.moderationReviewGet) wrapped.get = () => options.moderationReviewGet(query);
        for (const method of ['where', 'doc', 'limit', 'skip', 'field', 'orderBy']) wrapped[method] = (...args) => wrap(query[method](...args));
        return wrapped;
      }
      return wrap(ref);
    };
  }
  const loader = runtimeLoader(mem.db, runtime);
  const harness = { ...data, mem, runtime, expectedLoginLogs };
  harness.call = async event => {
    const result = await call(loader, runtime, event);
    // This assertion applies to successful, repeated, denied and partially failed cancellation attempts.
    assertLoginLogsRetained(harness);
    return result;
  };
  return harness;
}

function ids(table, harness) {
  return harness.mem.tables[table].map(row => row._id).sort();
}

function assertLoginLogsRetained(harness) {
  assert.deepEqual(harness.mem.tables.login_logs, harness.expectedLoginLogs,
    '注销按用户选定策略完整保留本人和他人的登录审计日志，所有字段均不得改变');
  assert.ok(!harness.runtime.collectionAccesses.includes('login_logs'),
    '注销不得查询、更新或删除 login_logs');
}

(async () => {
  {
    const harness = createHarness();
    harness.runtime.wxid = harness.openid;
    const result = await harness.call({ dryRun: true });
    assert.equal(result.success, true);
    assert.equal(result.dryRun, true);
    assert.equal(result.hasAccount, true);
    assert.equal(result.requiresPassword, true);
    assert.equal(harness.mem.tables.users.length, 2, '预检不删除账号');
    assert.equal(ids('drafts', harness).length, 2, '预检不改动数据');
    assert.equal(ids('moderation_review', harness).length, 4, '预检不删除复核记录');
  }

  {
    const harness = createHarness();
    harness.runtime.wxid = harness.openid;
    const required = await harness.call({});
    assert.equal(required.success, false);
    assert.equal(required.code, 'PASSWORD_REQUIRED');
    const mismatch = await harness.call({ password: 'wrong' });
    assert.equal(mismatch.success, false);
    assert.equal(mismatch.code, 'PASSWORD_MISMATCH');
    assert.equal(harness.mem.tables.users.length, 2, '密码错误不删除账号');
    assert.equal(ids('moderation_review', harness).length, 4, '密码错误不删除复核内容');
    const done = await harness.call({ password: 'secret' });
    assert.equal(done.success, true, JSON.stringify(done));
  }

  {
    const harness = createHarness();
    harness.runtime.wxid = 'wx-bound';
    const mismatch = await harness.call({ openid: 'openid-peer' });
    assert.equal(mismatch.success, false);
    assert.equal(mismatch.code, 'IDENTITY_MISMATCH', '微信身份与上报账号不符时拒绝');
    assert.equal(harness.mem.tables.users.length, 2);

    const done = await harness.call({ openid: harness.openid, password: 'secret' });
    assert.equal(done.success, true, JSON.stringify(done));
  }

  {
    const harness = createHarness();
    harness.runtime.wxid = harness.openid;
    const done = await harness.call({ password: 'secret' });
    assert.equal(done.success, true);
    assert.equal(Object.prototype.hasOwnProperty.call(done, 'realAuthorOpenid'), false);

    assert.deepEqual(ids('users', harness), ['user-peer']);
    for (const table of ['drafts', 'favorite_folders', 'portfolio_items', 'portfolio_folders', 'search_logs', 'api_rate_limits', 'view_events', 'view_log', 'weekly_issue_views', 'images']) {
      assert.ok(harness.mem.tables[table].every(row => row._openid !== harness.openid && row.openid !== harness.openid), `${table} 应清空本人数据`);
    }
    assert.deepEqual(ids('favorites', harness), ['fav3'], '同时清理 _openid 与旧 userId 字段');
    assert.deepEqual(ids('follows', harness), [], '双向关注都清理');
    assert.deepEqual(ids('blocks', harness), [], '双向拉黑都清理');
    assert.deepEqual(ids('messages', harness), ['m3'], '双方消息都清理');
    assert.deepEqual(ids('moderation_review', harness), ['review-peer'], '本人所有状态复核记录删除，他人的提交保留');
    assert.deepEqual(ids('votes_log', harness), []);
    assert.deepEqual(ids('sms_codes', harness), ['sc3']);
    assert.deepEqual(ids('sms_logs', harness), ['sl2']);
    assert.deepEqual(ids('login_logs', harness), ['login-owner', 'login-peer'], '注销后完整保留本人和他人的登录日志');
    assertLoginLogsRetained(harness);
    assert.deepEqual(ids('collage_ocr_cache', harness), ['co1']);
    assert.deepEqual(ids('collage_ocr_usage', harness), ['cu1'], 'OCR按owner哈希匹配每日无owner字段记录');
    assert.deepEqual(ids('web_reader_sessions', harness), ['web-peer'], '网站阅读会话被吊销');
    assert.deepEqual(harness.mem.tables.adminConfig[0].adminPoemIds, ['poemPeer'], '再次注册相同Poem ID不能继承管理员');
    assert.deepEqual(ids('wechat_binding_grants', harness), ['g2']);
    assert.deepEqual(ids('user_identities', harness), ['id2']);
    assert.equal(harness.mem.tables.wechat_bindings.length, 0, '两个微信绑定映射都删除');
    for (const file of ['cloud://img-1', 'cloud://avatar-owner', 'cloud://post-image', 'cloud://reply-image', 'cloud://report-image', 'cloud://shared-public-image']) {
      assert.ok(harness.runtime.deletedFiles.includes(file), `${file} 云存储文件一并删除`);
    }
    assert.ok(!harness.runtime.deletedFiles.includes('cloud://env/collage-backgrounds/public.jpg'), '共享背景素材不误删');

    const posts = Object.fromEntries(harness.mem.tables.posts.map(post => [post._id, post]));
    assert.deepEqual(ids('posts', harness), ['post-peer'], '公开及匿名帖子彻底删除');
    assert.equal(posts['post-peer']._openid, harness.peer, '他人帖子不受影响');
    for (const key of ['quotedPostId', 'quotedPostAuthor', 'quotedPostAuthorId', 'quotedPostContent']) {
      assert.ok(!posts['post-peer'][key], `${key} 引用快照清除`);
    }
    assert.equal(posts['post-peer'].votes, 1, '本人对他人帖子的点赞回退');
    assert.equal(posts['post-peer'].commentCount, 1, '删除本人评论及其回复后回算评论数');
    assert.equal(posts['post-peer'].title, '讨论', '自动生成的讨论标题不再包含已删作品标题');
    assert.equal(posts['post-peer'].content, '路人的评论', '其他用户独立创作的正文保留');
    assert.equal(posts['post-peer'].sentenceGroups[0].comment, '路人的点评', '讨论点评保留');
    assert.ok(!JSON.stringify(posts['post-peer'].sentenceGroups).includes('本人诗句'), '结构化引用诗句快照清除');

    const comments = Object.fromEntries(harness.mem.tables.comments.map(item => [item._id, item]));
    assert.deepEqual(ids('comments', harness), ['c-retained'], '本人评论、匿名评论、回复及被删除帖子下评论一并删除');
    assert.equal(comments['c-retained'].likes, 4, '删除的评论点赞回退计数');
    assert.equal(comments['c-retained'].authorName, '路人', '无关他人评论不受影响');

    assert.deepEqual(ids('feedback', harness), ['fb-peer'], '本人反馈彻底删除，他人反馈保留');
    assert.deepEqual(ids('feedbackReplies', harness), ['fr-peer'], '本人反馈的客服回复删除，无关回复保留');
    assert.equal(harness.mem.tables.feedback[0].lastReply, '他人反馈回复', '他人反馈上的本人回复快照清除');
    assert.equal(harness.mem.tables.feedback[0].replyCount, 1);
    assert.deepEqual(ids('moderation_logs', harness), [], '本人审核日志删除');
    assert.deepEqual(ids('post_reports', harness), ['report-peer'], '本人举报和本人帖子相关举报删除');
    const issue = harness.mem.tables.weekly_issues[0];
    assert.deepEqual(issue.featuredPostIds, ['post-peer']);
    assert.deepEqual(issue.featuredSnapshots.map(row => row.postId), ['post-peer']);
    assert.deepEqual(issue.rankingSnapshot.map(row => row.postId), ['post-peer']);
    assert.ok(!JSON.stringify(issue).includes('本人诗标题'), '引用讨论的周刊快照同步清除派生标题');
    assert.ok(!JSON.stringify(issue).includes('本人诗句'), '引用讨论的周刊快照同步清除诗句');
    assert.deepEqual(harness.mem.tables.weekly_topics[0].selectedPostIds, ['post-peer']);
    assert.deepEqual(harness.mem.tables.weekly_topics[0].selectedSnapshots.map(row => row.postId), ['post-peer']);
    assert.equal(harness.mem.tables.poets[0].creatorOpenid, undefined);
  }

  {
    const harness = createHarness();
    harness.runtime.wxid = harness.openid;
    harness.mem.tables.users = harness.mem.tables.users.filter(user => user._openid !== harness.openid);
    const done = await harness.call({});
    assert.equal(done.success, true, '账号已不存在时仍可清理残留并成功');
    assert.deepEqual(ids('drafts', harness), ['d2']);
    assert.deepEqual(ids('moderation_review', harness), ['review-peer'], '账号已删除时仍可重试清理复核私密数据');
  }

  {
    const harness = createHarness({ moderationReviewGet: async () => {
      throw Object.assign(new Error('collection not exists'), { errCode: -502005 });
    } });
    harness.runtime.wxid = harness.openid;
    delete harness.mem.tables.moderation_review;
    const done = await harness.call({ password: 'secret' });
    assert.equal(done.success, true, '未上线新集合的环境仍可注销');
  }

  {
    let failed = true;
    const harness = createHarness({ moderationReviewRemove: async query => {
      if (failed) throw Object.assign(new Error('database temporarily unavailable'), { errCode: -1 });
      return query.remove();
    } });
    harness.runtime.wxid = harness.openid;
    const incomplete = await harness.call({ password: 'secret' });
    assert.equal(incomplete.code, 'CANCEL_INCOMPLETE', '新集合清理失败需要明确重试');
    assert.deepEqual([...incomplete.failed], ['posts', 'moderation_review'], '帖子删除依赖复核清理，失败时保留原帖子作为重试锚点');
    assert.equal(ids('moderation_review', harness).length, 4);
    failed = false;
    assert.deepEqual(ids('users', harness), ['user-owner', 'user-peer'], '未完成时保留账号与身份，确保重试仍需验证');
    assert.equal((await harness.call({ password: 'wrong' })).code, 'PASSWORD_MISMATCH');
    assert.equal((await harness.call({ password: 'secret' })).success, true);
    assert.deepEqual(ids('moderation_review', harness), ['review-peer']);
  }

  {
    const harness = createHarness();
    harness.runtime.wxid = '';
    const noIdentity = await harness.call({});
    assert.equal(noIdentity.success, false);
    assert.equal(noIdentity.code, 'NO_OPENID');
  }

  {
    const harness = createHarness();
    delete harness.mem.tables.users[0].password;
    const before = JSON.stringify(harness.mem.tables);
    const forged = await harness.call({ openid: harness.openid });
    assert.equal(forged.success, false, '跨端无密码账号不能只凭客户端openid删除');
    assert.equal(forged.code, 'IDENTITY_REQUIRED');
    assert.equal(JSON.stringify(harness.mem.tables), before, '无身份凭据不改动任何数据');
    harness.runtime.wxid = 'wx-bound';
    assert.equal((await harness.call({ openid: harness.openid })).success, true, '无密码账号通过可信绑定微信身份注销');
  }

  {
    const harness = createHarness();
    delete harness.mem.tables.users[0].password;
    harness.runtime.wxid = harness.openid;
    const rebound = await harness.call({ openid: harness.openid });
    assert.equal(rebound.code, 'IDENTITY_MISMATCH', '换绑后旧微信openid不再拥有注销权限');
    delete harness.mem.tables.users[0].wechatOpenId;
    harness.mem.tables.users[0].wechatLoginDisabled = true;
    assert.equal((await harness.call({ openid: harness.openid })).code, 'IDENTITY_MISMATCH', '禁用微信登录后旧openid不能注销');
  }

  {
    const harness = createHarness();
    const wrong = await harness.call({ openid: harness.openid, password: 'wrong' });
    assert.equal(wrong.code, 'PASSWORD_MISMATCH', 'App/H5同样需要密码验证');
    assert.equal((await harness.call({ openid: harness.openid, password: 'secret' })).success, true);
    const repeat = await harness.call({ openid: harness.openid });
    assert.equal(repeat.success, false, '账号已不存在时客户端openid仍不能成为删除授权');
  }

  {
    const harness = createHarness();
    harness.runtime.wxid = harness.openid;
    const result = await harness.call({ password: 'secret' });
    assert.equal(result.success, true);
    const retained = JSON.stringify(harness.mem.tables);
    assert.equal((await harness.call({})).success, true, '可信微信重复注销幂等');
    assert.equal(JSON.stringify(harness.mem.tables), retained, '重复注销不影响别人数据或计数');
    assertLoginLogsRetained(harness);
  }

  for (const loginLogsError of [
    new Error('login_logs permission denied'),
    Object.assign(new Error('login_logs collection not exists'), { errCode: -502005 })
  ]) {
    const harness = createHarness({ loginLogsError });
    harness.runtime.wxid = harness.openid;
    const result = await harness.call({ password: 'secret' });
    assert.equal(result.success, true, '保留日志策略不依赖登录日志集合的权限或可用性');
    assert.deepEqual(ids('users', harness), ['user-peer'], '登录日志集合出错也不阻止删除本人账号');
    assertLoginLogsRetained(harness);
  }

  for (const context of [{ environment: '{"TCB_UUID":"tcb-session-owner"}' }, { environ: 'TCB_UUID=tcb-session-owner;TCB_ENV=example' }]) {
    const harness = createHarness();
    harness.runtime.context = context;
    const hash = require('node:crypto').createHash('sha256').update('tcb:tcb-session-owner').digest('hex').slice(0, 32);
    harness.mem.tables.collage_ocr_cache.push({ _id: 'ocr-runtime', owner: hash, fileID: 'cloud://ocr-runtime-image' });
    harness.mem.tables.collage_ocr_usage.push({ _id: `day-2026-10-13-${hash}`, count: 1 });
    const result = await harness.call({ openid: harness.openid, password: 'secret', TCB_UUID: 'unrelated-client-value' });
    assert.equal(result.success, true);
    assert.deepEqual(ids('collage_ocr_cache', harness), ['co1'], 'App/H5 OCR归属取可信调用上下文中的TCB_UUID');
    assert.deepEqual(ids('collage_ocr_usage', harness), ['cu1']);
    assert.ok(harness.runtime.deletedFiles.includes('cloud://ocr-runtime-image'));
    assert.ok(!harness.runtime.deletedFiles.includes('cloud://ocr-other'));
  }

  for (const mode of ['throw', 'status']) {
    const harness = createHarness();
    harness.runtime.wxid = harness.openid;
    if (mode === 'throw') harness.runtime.fileError = new Error('storage unavailable');
    else harness.runtime.fileStatus = -1;
    const failed = await harness.call({ password: 'secret' });
    assert.equal(failed.code, 'CANCEL_INCOMPLETE', `${mode} 文件删除失败不能报告注销成功`);
    assert.ok(ids('users', harness).includes('user-owner'), '文件失败保留账号以验证重试');
    assert.ok(ids('posts', harness).includes('post-public'), '先删除文件再删除源记录，失败时可重试找回文件');
    assertLoginLogsRetained(harness);
    harness.runtime.fileError = null;
    harness.runtime.fileStatus = 0;
    assert.equal((await harness.call({ password: 'secret' })).success, true, '云文件恢复后可完成注销');
    assertLoginLogsRetained(harness);
  }

  {
    let unavailable = true;
    const harness = createHarness({ beforeRemove: async name => {
      if (name === 'drafts' && unavailable) throw new Error('drafts unavailable');
    } });
    harness.runtime.wxid = harness.openid;
    assert.equal((await harness.call({ password: 'secret' })).code, 'CANCEL_INCOMPLETE');
    assertLoginLogsRetained(harness);
    const votes = harness.mem.tables.posts.find(row => row._id === 'post-peer').votes;
    const likes = harness.mem.tables.comments.find(row => row._id === 'c-retained').likes;
    assert.equal(votes, 1);
    assert.equal(likes, 4);
    unavailable = false;
    assert.equal((await harness.call({ password: 'secret' })).success, true);
    assertLoginLogsRetained(harness);
    assert.equal(harness.mem.tables.posts.find(row => row._id === 'post-peer').votes, votes, '重试不会重复减帖子点赞');
    assert.equal(harness.mem.tables.comments.find(row => row._id === 'c-retained').likes, likes, '重试不会重复减评论点赞');
  }

  {
    const harness = createHarness();
    harness.runtime.wxid = harness.openid;
    for (let index = 0; index < 1105; index += 1) {
      harness.mem.tables.posts.push({ _id: `bulk-post-${index}`, _openid: harness.openid, imageUrls: [`cloud://bulk-${index}`] });
      harness.mem.tables.images.push({ _id: `bulk-image-${index}`, _openid: harness.openid, fileID: `cloud://bulk-file-${index}` });
    }
    assert.equal((await harness.call({ password: 'secret' })).success, true, '大量记录跨分页清理');
    assert.deepEqual(ids('posts', harness), ['post-peer']);
    assert.deepEqual(ids('images', harness), []);
    assert.ok(harness.runtime.deletedFiles.includes('cloud://bulk-1104'));
    assert.ok(harness.runtime.deletedFiles.includes('cloud://bulk-file-1104'), '不受旧1000条上限影响');
  }

  await testSettingsFlow();

  console.log('PASS cancelAccount: dry-run, identity/password gate, deletion, preserved login audit logs without collection access, dependencies, snapshots, files, pagination, failure retry and settings flow');
})().catch(error => { console.error(error); process.exitCode = 1; });

function loadVue(file, globals = {}) {
  const { parse } = require('@babel/parser');
  let source = fs.readFileSync(path.join(root, file), 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
  const imports = {};
  for (const node of parse(source, { sourceType: 'module' }).program.body.reverse()) {
    if (node.type === 'ImportDeclaration') {
      node.specifiers.forEach(spec => { imports[spec.local.name] = {}; });
      source = source.slice(0, node.start) + source.slice(node.end);
    } else if (node.type === 'ExportDefaultDeclaration') {
      source = source.slice(0, node.start) + 'module.exports = ' + source.slice(node.declaration.start);
    } else if (node.type === 'ExportNamedDeclaration') {
      source = source.slice(0, node.start) + source.slice(node.declaration ? node.declaration.start : node.end);
    }
  }
  const context = { ...imports, console: quiet, module: { exports: {} }, ...globals };
  vm.runInNewContext(source, context, { filename: file });
  return context.module.exports;
}

async function testSettingsFlow() {
  const toasts = [], redirects = [], timers = [], removedKeys = [], calls = { cancel: [], teardown: 0, logout: 0 };
  const localFiles = [];
  const storage = new Map([
    ['userOpenId', 'openid-owner'],
    ['collage-workspace-v1:openid-owner', { sources: [{ file: 'local-source' }], materials: [{ file: 'local-material' }], backgroundImage: { file: 'local-background' } }],
    ['collage-workspace-v1:openid-peer', { sources: [{ file: 'peer-source' }] }]
  ]);
  const appState = { isLoggedIn: true, openid: 'openid-owner', userInfo: { _openid: 'openid-owner' } };
  const publisher = { discardWorkingDraftOnExit: false, workingDraftSaveTimer: 'draft-timer' };
  const cancelledTimers = [];
  let dryRunResult = { success: true, requiresPassword: true };
  let cancelError = null;
  let pendingCancel = null;
  const page = loadVue('pages/settings/settings.vue', {
    versionName: '1.0.0',
    READ_FONT_LEVELS: { normal: { label: '标准' } },
    READ_FONT_LEVEL_NAMES: ['normal'],
    getReadFontSizeLevel: () => 'normal',
    setReadFontSize: value => value,
    getSystemInfoCompat: () => ({}),
    checkAndUpdate: async () => ({}),
    getAppVersionInfo: async () => ({ wgtVersion: '1.0.0' }),
    cancelAccount: async (payload) => {
      calls.cancel.push(payload);
      if (cancelError) throw cancelError;
      if (pendingCancel) await pendingCancel;
      if (payload.dryRun) return dryRunResult;
      return { success: true };
    },
    logout: async () => { calls.logout += 1; return { anonymousOpenid: 'anon-1' }; },
    resetAllCachesOnAccountChange: async () => { calls.teardown += 1; },
    removeCollageFile: async file => { localFiles.push(file); },
    clearCachedAdminFlag: () => {},
    clearUserSession: () => { appState.isLoggedIn = false; appState.openid = null; appState.userInfo = null; },
    getAppState: () => appState,
    patchAppState: patch => Object.assign(appState, patch),
    getCurrentPages: () => [{ route: 'pages-publish/add/add', $vm: publisher }],
    uni: {
      showToast: options => toasts.push(options.title),
      getStorageSync: key => storage.get(key),
      getStorageInfoSync: () => ({ keys: [...storage.keys()] }),
      removeStorageSync: key => { removedKeys.push(key); storage.delete(key); },
      setStorageSync: (key, value) => storage.set(key, value),
      reLaunch: options => redirects.push(options.url)
    },
    setTimeout: (callback, delay) => { timers.push({ callback, delay }); return timers.length; },
    clearTimeout: timer => cancelledTimers.push(timer)
  });

  function createPage() {
    const instance = page.data();
    for (const [name, method] of Object.entries(page.methods)) instance[name] = method.bind(instance);
    instance.isLoggedIn = true;
    return instance;
  }

  const instance = createPage();
  instance.openCancelAccount();
  assert.equal(instance.showCancelExplain, true);

  await instance.proceedCancelAccount();
  assert.equal(instance.showCancelExplain, false);
  assert.equal(instance.showCancelPassword, true, '有密码进入密码确认');
  assert.equal(instance.showCancelFinal, false);
  assert.equal(instance.cancelling, false);

  cancelError = { result: { code: 'PASSWORD_MISMATCH' } };
  await instance.confirmCancelWithPassword('bad');
  assert.equal(instance.showCancelPassword, true, '密码错误保留弹窗可重试');
  assert.equal(toasts[toasts.length - 1], '密码不正确，请重新输入');

  cancelError = null;
  await instance.confirmCancelWithPassword('secret');
  assert.equal(instance.showCancelPassword, false);
  assert.equal(calls.teardown, 1, '注销成功后清空缓存');
  assert.equal(calls.logout, 1, '重新初始化匿名 openid');
  assert.equal(appState.isLoggedIn, false);
  assert.equal(appState.openid, 'anon-1');
  assert.equal(publisher.discardWorkingDraftOnExit, true, '旧发布页面卸载不得写回已删除的草稿');
  assert.ok(cancelledTimers.includes('draft-timer'), '停止旧页面待执行的草稿保存');
  assert.deepEqual(localFiles.sort(), ['local-background', 'local-material', 'local-source']);
  assert.ok(storage.has('collage-workspace-v1:openid-peer'), '其他账号本机拼贴工作区不误删');
  for (const key of ['userInfo', 'userOpenId', 'openid', 'github_access_token', 'github_temp_data', 'publish_working_draft_v1', 'publish_draft', 'discussion_drafts', 'collage_poem_draft']) {
    assert.ok(removedKeys.includes(key), `${key} 本地个人信息清除`);
  }
  assert.equal(toasts[toasts.length - 1], '账号已注销');
  assert.equal(redirects.length, 0);
  timers[timers.length - 1].callback();
  assert.deepEqual(redirects, ['/pages/login/login']);

  dryRunResult = { success: true, requiresPassword: false };
  const second = createPage();
  second.openCancelAccount();
  await second.proceedCancelAccount();
  assert.equal(second.showCancelFinal, true, '无密码账号走最终确认');
  assert.equal(second.showCancelPassword, false);
  await second.confirmCancelAccount();
  assert.equal(second.showCancelFinal, false);
  assert.equal(calls.teardown, 2);

  const third = createPage();
  third.openCancelAccount();
  cancelError = { result: { code: 'IDENTITY_REQUIRED' } };
  await third.proceedCancelAccount();
  assert.equal(third.showCancelExplain, true, '预检失败保留说明供重试');
  assert.match(toasts[toasts.length - 1], /设置密码/);
  cancelError = null;
  let resolvePending;
  pendingCancel = new Promise(resolve => { resolvePending = resolve; });
  const beforeCalls = calls.cancel.length;
  const firstAttempt = third.proceedCancelAccount();
  assert.equal(third.cancelling, true);
  await third.proceedCancelAccount();
  assert.equal(calls.cancel.length, beforeCalls + 1, '重复点击只发起一次预检');
  resolvePending();
  await firstAttempt;
  pendingCancel = null;
  cancelError = { result: { code: 'CANCEL_INCOMPLETE' } };
  await third.confirmCancelAccount();
  assert.equal(third.showCancelFinal, true, '云端部分失败保留确认供重试');
  assert.equal(calls.teardown, 2, '部分删除失败不清登录态');
  assert.match(toasts[toasts.length - 1], /继续清理/);
}
