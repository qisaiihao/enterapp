const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parse } = require('@babel/parser');

const root = path.join(__dirname, '..');
const quiet = { log() {}, warn() {}, error() {} };
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

function loadModule(source, globals) {
  for (const node of parse(source, { sourceType: 'module' }).program.body.filter(n => n.type === 'ImportDeclaration').reverse()) {
    for (const spec of node.specifiers) {
      if (!(spec.local.name in globals)) globals[spec.local.name] = {};
    }
    source = source.slice(0, node.start) + source.slice(node.end);
  }
  globals.module = { exports: {} };
  source = source.replace(/export\s*\{[\s\S]*?\};/g, '').replace('export default', 'module.exports =');
  vm.runInNewContext(source, globals);
  return globals.module.exports;
}

const likeIcon = loadModule(read('utils/likeIcon.js'), {});

async function testPage() {
  const statuses = new Map();
  const handlers = new Map();
  const globals = {
    console: quiet, likeIcon,
    getLatestLikeStatus: id => statuses.get(id),
    getCollageList: async () => ({ posts: [
      { _id: 'liked', votes: 2, isVoted: true, likeIcon: '/static/images/seed.png' },
      { _id: 'other', votes: 4, isVoted: false, likeIcon: '/static/images/seed.png' }
    ], hasMore: false }),
    uni: {
      $on: (name, handler) => handlers.set(name, handler),
      $off: (name, handler) => { if (handlers.get(name) === handler) handlers.delete(name); }
    }
  };
  const page = loadModule(read('pages-collage/collage-square/collage-square.vue').match(/<script>([\s\S]*?)<\/script>/)[1], globals);
  function createPage() {
    const instance = page.data();
    for (const [name, method] of Object.entries(page.methods)) instance[name] = method.bind(instance);
    instance.updateBackgroundImage = () => {};
    return instance;
  }

  const instance = createPage();
  await instance.loadCollageList();
  assert.equal(instance.currentCollage.likeIcon, '/static/images/seedplus.png', 'initial liked icon must ignore legacy server icon');
  assert.equal(instance.collageList[1].likeIcon, '/static/images/leaf.png');

  // Counts and selection can already agree while a cached icon remains stale.
  statuses.set('liked', { votes: 2, isVoted: true });
  instance.currentCollage.likeIcon = '/static/images/seed.png';
  page.onShow.call(instance);
  assert.equal(instance.currentCollage.likeIcon, '/static/images/seedplus.png', 'returning repairs stale icons even if counts match');

  instance.bindGlobalEvents();
  statuses.set('liked', { votes: 1, isVoted: false });
  handlers.get('like-changed')({ postId: 'liked', votes: 1, isLiked: false });
  assert.equal(instance.currentCollage.isVoted, false, 'detail-page unlike updates current collage');
  assert.equal(instance.currentCollage.votes, 1);
  assert.equal(instance.currentCollage.likeIcon, '/static/images/seed.png');
  handlers.get('like-changed')({ postId: 'other', votes: 5, isLiked: true });
  assert.equal(instance.currentCollage._id, 'liked', 'background item updates preserve current selection');
  instance.currentCollageIndex = 1;
  instance.syncCurrentCollageFromList();
  assert.equal(instance.currentCollage.likeIcon, '/static/images/leafplus.png');

  const recreated = createPage();
  await recreated.loadCollageList();
  assert.equal(recreated.currentCollage.isVoted, false, 'reopening uses latest local status over a stale list');
  assert.equal(recreated.currentCollage.votes, 1);

  let resolveVote;
  let calls = 0;
  globals.togglePostLike = () => { calls += 1; return new Promise(resolve => { resolveVote = resolve; }); };
  const tap = { currentTarget: { dataset: { postid: 'liked' } } };
  const pending = recreated.onLike(tap);
  assert.equal(recreated.currentCollage.isVoted, true);
  assert.equal(recreated.currentCollage.likeIcon, '/static/images/seedplus.png');
  await recreated.onLike(tap);
  assert.equal(calls, 1, 'duplicate taps are blocked during a request');
  resolveVote({ success: true, votes: 4, isLiked: true });
  await pending;
  assert.equal(recreated.currentCollage.likeIcon, '/static/images/leafplus.png', 'server result determines count and icon');
  globals.togglePostLike = async () => { throw new Error('offline'); };
  await recreated.onLike(tap);
  assert.equal(recreated.currentCollage.isVoted, true, 'failed unlike rolls back selection');
  assert.equal(recreated.currentCollage.votes, 4);
  assert.equal(recreated.currentCollage.likeIcon, '/static/images/leafplus.png');
  assert.equal(recreated.votingInProgress.liked, false);
  page.onUnload.call(instance);
  assert.equal(handlers.size, 0);
}

async function testBackend() {
  let wxOpenid = 'wechat-account';
  let queriedOpenid;
  const db = {
    command: { in: values => values },
    collection(name) {
      const query = {
        where(filter) { if (name === 'votes_log') queriedOpenid = filter._openid; return query; },
        orderBy() { return query; }, skip() { return query; }, limit() { return query; },
        async get() {
          if (name === 'posts') return { data: [{ _id: 'liked', votes: 4, imageUrls: [] }] };
          assert.equal(name, 'votes_log');
          return { data: queriedOpenid === 'app-account' ? [{ postId: 'liked' }] : [] };
        }
      };
      return query;
    }
  };
  const globals = {
    console: quiet, exports: {},
    require(name) {
      if (name === 'wx-server-sdk') return { init() {}, database: () => db, getWXContext: () => ({ OPENID: wxOpenid }) };
      if (name === './_lib/get-blocked-user-ids') return async () => [];
      throw new Error(name);
    }
  };
  vm.runInNewContext(read('functions/getCollagePoetry/index.js'), globals);
  const result = await globals.exports.main({ openid: 'app-account' }, {});
  assert.equal(result.success, true);
  assert.equal(queriedOpenid, 'app-account', 'list must use the same identity precedence as vote and detail');
  assert.equal(result.data[0].isVoted, true);
  assert.equal(result.data[0].likeIcon, '/static/images/leafplus.png');
  const fallback = await globals.exports.main({}, {});
  assert.equal(queriedOpenid, 'wechat-account');
  assert.equal(fallback.data[0].isVoted, false);
  assert.equal(fallback.data[0].likeIcon, '/static/images/leaf.png');
  for (const count of [0, 1, 3, 4, 7, 8, 15, 16, 50, 100]) {
    for (const liked of [true, false]) {
      assert.equal(globals.getLikeIcon(count, liked), likeIcon.getLikeIcon(count, liked), `icon parity at ${count}/${liked}`);
    }
  }
}

Promise.allSettled([testPage(), testBackend()]).then(results => {
  const failures = results.filter(result => result.status === 'rejected');
  for (const failure of failures) console.error(failure.reason);
  if (failures.length) process.exitCode = 1;
  else console.log('[test-collage-likes] PASS: initial icons, cached return, cross-page events, reopening, duplicate taps, rollback and account identity');
});
