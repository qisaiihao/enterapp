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
            return { fileList: fileList.map(fileID => ({ fileID, status: 0 })) };
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
  const rows = {
    users: [
      { _id: 'user-owner', _openid: openid, user_id: 'u_owner', poemId: 'poemOwner', password: 'secret', nickName: '原作者', phoneNumber: '13800138000', wechatOpenId: 'wx-bound' },
      { _id: 'user-peer', _openid: peer, user_id: 'u_peer', poemId: 'poemPeer', password: 'peer', nickName: '路人' }
    ],
    drafts: [{ _id: 'd1', _openid: openid }, { _id: 'd2', _openid: peer }],
    favorites: [{ _id: 'fav1', _openid: openid, postId: 'post-public' }, { _id: 'fav2', userId: openid, postId: 'post-public' }, { _id: 'fav3', _openid: peer }],
    favorite_folders: [{ _id: 'ff1', _openid: openid }],
    portfolio_items: [{ _id: 'pi1', _openid: openid }],
    portfolio_folders: [{ _id: 'pf1', _openid: openid }],
    follows: [{ _id: 'fo1', followerId: openid, followedId: peer }, { _id: 'fo2', followerId: peer, followedId: openid }],
    blocks: [{ _id: 'b1', blockerId: openid, blockedId: peer }, { _id: 'b2', blockerId: peer, blockedId: openid }],
    messages: [{ _id: 'm1', fromUserId: openid, toUserId: peer }, { _id: 'm2', fromUserId: peer, toUserId: openid }, { _id: 'm3', fromUserId: peer, toUserId: peer }],
    votes_log: [
      { _id: 'v1', _openid: openid, type: 'post', postId: 'post-public' },
      { _id: 'v2', _openid: openid, type: 'post', postId: 'post-public' },
      { _id: 'v3', _openid: openid, type: 'comment', commentId: 'c-peer' }
    ],
    search_logs: [{ _id: 's1', openid }, { _id: 's2', openid: peer }],
    api_rate_limits: [{ _id: 'r1', openid }],
    view_events: [{ _id: 've1', _openid: openid }],
    view_log: [{ _id: 'vl1', _openid: openid }],
    weekly_issue_views: [{ _id: 'wv1', _openid: openid }],
    images: [{ _id: 'i1', _openid: openid, fileID: 'cloud://img-1' }],
    collage_ocr_cache: [{ _id: 'co1', owner: 'unrelated', fileID: 'cloud://ocr-other' }],
    collage_ocr_usage: [{ _id: 'cu1', owner: 'unrelated' }],
    feedback: [{ _id: 'fb1', userOpenid: openid, userName: '原作者' }],
    feedbackReplies: [{ _id: 'fr1', senderId: openid, senderName: '原作者' }, { _id: 'fr2', senderId: 'admin', senderName: '客服' }],
    moderation_logs: [{ _id: 'ml1', openid, _openid: openid, excerpt: 'x' }],
    poets: [{ _id: 'p1', name: '原作者', creatorOpenid: openid }],
    sms_codes: [{ _id: 'sc1', phone: '13800138000' }, { _id: 'sc2', phone: '+8613800138000' }, { _id: 'sc3', phone: '13900139000' }],
    sms_logs: [{ _id: 'sl1', phone: '138****8000' }, { _id: 'sl2', phone: '139****9000' }],
    wechat_bindings: [
      { _id: require('node:crypto').createHash('sha256').update('openid-owner').digest('hex'), userId: 'user-owner' },
      { _id: require('node:crypto').createHash('sha256').update('wx-bound').digest('hex'), userId: 'user-owner' }
    ],
    wechat_binding_grants: [{ _id: 'g1', userId: 'user-owner', wxid: 'wx-bound' }, { _id: 'g2', userId: 'user-peer', wxid: 'wx-peer' }],
    user_identities: [{ _id: 'id1', user_id: 'u_owner', provider: 'weapp', subject_id: 'openid-owner' }, { _id: 'id2', user_id: 'u_peer', provider: 'weapp', subject_id: peer }],
    comments: [
      { _id: 'c-owner', _openid: openid, postId: 'post-peer', authorName: '原作者', likes: 2 },
      { _id: 'c-peer', _openid: peer, postId: 'post-public', authorName: '路人', likes: 5 }
    ],
    posts: [
      { _id: 'post-public', schemaVersion: 2, publishMode: 'poem', _openid: openid, author: '原作者', authorName: '原作者', votes: 3, quotedPostAuthor: '' },
      { _id: 'post-anon', schemaVersion: 2, publishMode: 'poem', isAnonymous: true, _openid: '123456', realAuthorOpenid: openid, authorName: '佚名', votes: 1 },
      { _id: 'post-peer', schemaVersion: 2, publishMode: 'poem', _openid: peer, authorName: '路人', votes: 0, quotedPostAuthorId: openid, quotedPostAuthor: '原作者' }
    ]
  };
  return { openid, peer, rows };
}

async function call(loader, runtime, event) {
  const main = loader(path.join(root, 'functions/cancelAccount/index.js')).main;
  return main(event);
}

function createHarness() {
  const data = fixture();
  const runtime = { wxid: '', deletedFiles: [] };
  const mem = memoryDb(data.rows, command);
  const loader = runtimeLoader(mem.db, runtime);
  return { ...data, mem, runtime, call: event => call(loader, runtime, event) };
}

function ids(table, harness) {
  return harness.mem.tables[table].map(row => row._id).sort();
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
    assert.deepEqual(ids('votes_log', harness), []);
    assert.deepEqual(ids('sms_codes', harness), ['sc3']);
    assert.deepEqual(ids('sms_logs', harness), ['sl2']);
    assert.deepEqual(ids('wechat_binding_grants', harness), ['g2']);
    assert.deepEqual(ids('user_identities', harness), ['id2']);
    assert.equal(harness.mem.tables.wechat_bindings.length, 0, '两个微信绑定映射都删除');
    assert.deepEqual(harness.runtime.deletedFiles, ['cloud://img-1'], '云存储图片一并删除');

    const posts = Object.fromEntries(harness.mem.tables.posts.map(post => [post._id, post]));
    assert.equal(posts['post-public']._openid, 'deleted_user');
    assert.equal(posts['post-public'].authorName, '已注销用户');
    assert.equal(posts['post-public'].author, '已注销用户');
    assert.equal(posts['post-public'].authorAvatar, '/static/images/avatar.png');
    assert.equal(posts['post-public'].realAuthorOpenid, undefined);
    assert.equal(posts['post-anon']._openid, '123456', '匿名帖保持匿名归属格式');
    assert.equal(posts['post-anon'].realAuthorOpenid, undefined);
    assert.equal(posts['post-anon'].authorName, '已注销用户');
    assert.equal(posts['post-peer']._openid, harness.peer, '他人帖子不受影响');
    assert.equal(posts['post-peer'].quotedPostAuthor, '已注销用户', '引用快照匿名化');
    assert.equal(posts['post-public'].votes, 1, '删除的点赞回退计数');

    const comments = Object.fromEntries(harness.mem.tables.comments.map(item => [item._id, item]));
    assert.equal(comments['c-owner'].authorDeleted, true);
    assert.equal(comments['c-owner'].authorName, '已注销用户');
    assert.equal(comments['c-owner']._openid, 'deleted_user');
    assert.equal(comments['c-peer'].likes, 4, '删除的评论点赞回退计数');
    assert.equal(comments['c-peer'].authorName, '路人', '他人评论不受影响');

    const feedback = harness.mem.tables.feedback[0];
    assert.equal(feedback.userOpenid, 'deleted_user');
    assert.equal(feedback.userName, '已注销用户');
    assert.equal(harness.mem.tables.feedbackReplies[1].senderName, '客服', '客服回复保留');
    assert.equal(harness.mem.tables.moderation_logs[0].openid, 'deleted_user');
    assert.equal(harness.mem.tables.poets[0].creatorOpenid, undefined);
  }

  {
    const harness = createHarness();
    harness.runtime.wxid = harness.openid;
    harness.mem.tables.users = harness.mem.tables.users.filter(user => user._openid !== harness.openid);
    const done = await harness.call({});
    assert.equal(done.success, true, '账号已不存在时仍可清理残留并成功');
    assert.deepEqual(ids('drafts', harness), ['d2']);
  }

  {
    const harness = createHarness();
    harness.runtime.wxid = '';
    const noIdentity = await harness.call({});
    assert.equal(noIdentity.success, false);
    assert.equal(noIdentity.code, 'NO_OPENID');
  }

  await testSettingsFlow();

  console.log('PASS cancelAccount: dry-run, password gate, identity binding, anonymization, cleanup matrix, counters, settings flow and idempotency');
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
  const toasts = [], redirects = [], timers = [], calls = { cancel: [], teardown: 0, logout: 0 };
  let dryRunResult = { success: true, requiresPassword: true };
  let cancelError = null;
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
      if (payload.dryRun) return dryRunResult;
      return { success: true };
    },
    logout: async () => { calls.logout += 1; return { anonymousOpenid: 'anon-1' }; },
    resetAllCachesOnAccountChange: async () => { calls.teardown += 1; },
    clearCachedAdminFlag: () => {},
    clearUserSession: () => {},
    getAppState: () => ({ isLoggedIn: true }),
    patchAppState: () => {},
    uni: {
      showToast: options => toasts.push(options.title),
      removeStorageSync() {},
      setStorageSync() {},
      redirectTo: options => redirects.push(options.url)
    },
    setTimeout: (callback, delay) => { timers.push({ callback, delay }); return timers.length; },
    clearTimeout() {}
  });

  function createPage() {
    const instance = page.data();
    for (const [name, method] of Object.entries(page.methods)) instance[name] = method.bind(instance);
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
}
