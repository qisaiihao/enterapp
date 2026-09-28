const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parse } = require('@babel/parser');

function loadModule(file, globals = {}) {
  let source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  if (file.endsWith('.vue')) source = source.match(/<script>([\s\S]*?)<\/script>/)[1];
  const nodes = parse(source, { sourceType: 'module' }).program.body;
  const bindings = {};
  for (const node of nodes.slice().reverse()) {
    if (node.type === 'ImportDeclaration') {
      for (const specifier of node.specifiers) bindings[specifier.local.name] = {};
      source = source.slice(0, node.start) + source.slice(node.end);
    } else if (node.type === 'ExportNamedDeclaration') {
      source = source.slice(0, node.start) + source.slice(node.declaration ? node.declaration.start : node.end);
    } else if (node.type === 'ExportDefaultDeclaration') {
      source = source.slice(0, node.start) + 'module.exports = ' + source.slice(node.declaration.start);
    }
  }
  const sandbox = {
    ...bindings, ...globals, module: { exports: {} },
    console: { log() {}, warn() {}, error() {} }
  };
  vm.runInNewContext(source, sandbox, { filename: file });
  return sandbox.module.exports;
}

const listeners = new Map();
const uni = {
  $on(name, handler) {
    if (!listeners.has(name)) listeners.set(name, new Set());
    listeners.get(name).add(handler);
  },
  $off(name, handler) { listeners.get(name)?.delete(handler); },
  $emit(name, payload) { listeners.get(name)?.forEach(handler => handler(payload)); },
  showToast() {}
};
const statuses = new Map();
const likeIcon = loadModule('utils/likeIcon.js');
const poemDisplay = loadModule('utils/poemDisplay.js');
const events = loadModule('utils/events.js', { uni });
let failVote = false;
const service = loadModule('utils/likeService.js', {
  uni, likeIcon, emitLikeChanged: events.emitLikeChanged,
  cacheManager: { getStats: () => ({}) },
  likeStatusCache: {
    updateLikeStatus(postId, votes, isVoted) { statuses.set(postId, { votes, isVoted }); }
  },
  async cloudCall(name, { postId }) {
    assert.equal(name, 'vote');
    if (failVote) return { result: { success: false } };
    const previous = statuses.get(postId) || { votes: 3, isVoted: false };
    return { result: {
      success: true, votes: previous.votes + (previous.isVoted ? -1 : 1), isLiked: !previous.isVoted
    } };
  }
});
const globals = {
  uni, likeIcon, ...poemDisplay, ...service,
  getLatestLikeStatus: id => statuses.get(id),
  syncLikeStatusForPosts() {},
  replayBuiltinHuiwenFontReady() {},
  isUserLoggedIn: () => true,
  formatErrorForLog: String
};
function createPage(file) {
  const options = loadModule(file, globals);
  const page = options.data();
  for (const [name, method] of Object.entries(options.methods)) page[name] = method.bind(page);
  return page;
}
const activity = createPage('pages-content/activity-detail/activity-detail.vue');
const square = createPage('pages/poem-square/poem-square.vue');
square.isBrokenSignatureUrl = () => false;
const poem = {
  _id: 'poem', isPoem: true, votes: 3, isVoted: false,
  content: '  第一行\n　第二行', backgroundColor: '#a4c4bd'
};
activity.postList = [activity.normalizePost({ _id: 'other' }), activity.normalizePost(poem)];
square.postList = [square.normalizePoemCardPost({ ...poem })];
activity.bindGlobalEvents();
uni.$on('like-changed', square.onGlobalLikeChanged);
const settle = () => new Promise(resolve => setImmediate(resolve));
function assertLikes(votes, isVoted) {
  for (const page of [activity, square]) {
    const post = page.postList.find(item => item._id === 'poem');
    assert.equal(post.votes, votes);
    assert.equal(post.isVoted, isVoted);
    assert.equal(post.likeIcon, likeIcon.getLikeIcon(votes, isVoted));
  }
}

async function main() {
  activity.activityId = 'activity-123';
  // 截图中的历史帖：普通入口关联活动，作者名为匿名用户，但旧匿名标记为 false。
  const submission = {
    _id: 'normal-submission', publishMode: 'normal', isPoem: false,
    isAnonymous: false, authorName: '匿名用户', content: '《废稿》\n\n我认识他时',
    joinedActivityId: activity.activityId, backgroundColor: '#a4c4bd', imageUrls: []
  };
  for (const isAnonymous of [false, true]) {
    const card = activity.normalizePost({ ...submission, isAnonymous });
    assert.equal(activity.isPoemCard(card), true);
    assert.equal(card.backgroundColor, '#a4c4bd');
    assert.equal(card.publishMode, 'normal', 'Presentation must not reclassify stored post type');
    assert.equal(card.isAnonymous, isAnonymous, 'Do not infer anonymity from author name');
  }
  for (const patch of [
    { joinedActivityId: '' }, { joinedActivityId: 'another-activity' },
    { isActivityPost: true }, { isDiscussion: true }, { publishMode: 'discussion' },
    { content: '  \n' }, { imageUrls: ['image.jpg'] }, { imageUrl: 'legacy.jpg' },
    { originalImageUrls: ['original.jpg'] }, { originalImageUrl: 'legacy-original.jpg' }
  ]) {
    assert.equal(activity.isPoemCard(activity.normalizePost({ ...submission, ...patch })), false,
      `Keep normal card for ${JSON.stringify(patch)}`);
  }
  assert.equal(activity.isPoemCard({ activityId: activity.activityId, content: '活动公告' }), false);
  assert.equal(activity.isPoemCard({ publishMode: 'poem', imageUrls: ['poem.jpg'] }), true);
  assert.equal(activity.isPoemCard({ isSeries: true }), true);
  const poemCard = loadModule('components/poem/PoemCard.vue', globals);
  assert.equal(poemCard.computed.canShowSignature.call({
    showSignature: true, post: { isAnonymous: true, authorSignature: 'private-signature' }
  }), false);

  // 展示顺序与原始顺序不同时，展开及点赞均须命中同一帖子。
  activity.handlePoemCardTap({ postId: 'poem', index: 0 });
  assert.equal(activity.postList[1].isExpanded, true);
  assert.equal(activity.postList[0].isExpanded, false);
  activity.handleVote({ postId: 'poem', index: 0 });
  await settle();
  assertLikes(4, true);
  assert.equal(square['postList[0]'], undefined);
  square.onVote({ postId: 'poem', index: 0 });
  await settle();
  assertLikes(3, false);

  failVote = true;
  activity.handleVote({ postId: 'poem', index: 0 });
  await settle();
  assertLikes(3, false);
  assert.equal(activity.votingInProgress.poem, false);
  failVote = false;

  // 后到达的旧列表和关注列表缓存不能覆盖最近一次点赞。
  statuses.set('poem', { votes: 4, isVoted: true });
  const stale = square.normalizePoemCardPost({ ...poem });
  assert.equal(stale.isVoted, true);
  assert.equal(stale.votes, 4);
  square.convertCloudUrls = async () => { statuses.set('poem', { votes: 3, isVoted: false }); };
  square.page = 0;
  await square.processPostList([{ ...poem }]);
  assert.equal(square.postList[0].isVoted, false);
  assert.equal(square.postList[0].votes, 3);
  activity.syncLikeStatusFromCache();
  assertLikes(3, false);

  const series = activity.normalizePost({
    _id: 'series', seriesBlocks: [{ content: '　甲' }, { content: '  乙' }]
  });
  assert.equal(series.seriesPoems[0].content, '甲');
  activity.postList.push(series);
  activity.handlePoemCardTap({ postId: 'series', index: 0 });
  assert.equal(activity.postList[2].seriesExpanded, true);
  activity.handlePoemCardTap({ postId: 'series', index: 0 });
  assert.equal(activity.postList[2].currentSeriesIndex, 1);
  activity.handlePoemCardTap({ postId: 'series', index: 0 });
  assert.equal(activity.postList[2].seriesExpanded, false);
  assert.equal(activity.postList[2].currentSeriesIndex, 0);
  activity.unbindGlobalEvents();
  assert.equal(listeners.get('like-changed').size, 1);
  console.log('Activity/poem-square: bidirectional likes, rollback, stale loads and card interactions passed.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
