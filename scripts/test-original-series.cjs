const assert = require('node:assert/strict');
const { load, deferred } = require('./test-splash-startup.cjs');
const display = load('utils/poemDisplay.js');
const card = load('components/poem/PoemCard.vue');
const blocks = Array.from({ length: 7 }, (_, index) => ({
  id: `part-${index}`, subtitle: `第${index + 1}首`, content: `  第${index + 1}首正文`,
  poemTextStyles: [{ start: 2, end: 4, fontSize: 18 }]
}));
const full = () => ({ _id: 'seven', isSeries: true, seriesBlockCount: 7, seriesBlocks: blocks });
const partial = () => ({ ...full(), seriesBlocks: blocks.slice(0, 3), seriesPoems: blocks.slice(0, 3) });

function createPage(fetchDetail = async () => ({ post: full() })) {
  const calls = [], toasts = [];
  const options = load('pages/poem-square/poem-square.vue', {
    ...display, ORIGINAL_POEMS_PAGE_SIZE: 10,
    getLatestLikeStatus: () => null,
    likeIcon: { getLikeIcon: () => '/static/images/seed.png' },
    getPostDetail: async (...args) => { calls.push(args); return fetchDetail(...args); },
    uni: { showToast: event => toasts.push(event.title) }, formatErrorForLog: String
  });
  const page = options.data();
  for (const [name, method] of Object.entries(options.methods)) page[name] = method.bind(page);
  page.applyLocalState = patch => Object.assign(page, patch);
  page.generateRandomBackgroundColor = () => '#a4c4bd';
  page._postListRequestId = 1;
  page.setPosts = posts => { page.postList = posts.map(post => page.normalizePoemCardPost({ ...post })); };
  return { page, calls, toasts };
}

function rendered(post) {
  const context = { post, enableSeries: true };
  for (const [name, getter] of Object.entries(card.computed)) {
    Object.defineProperty(context, name, { get: () => getter.call(context) });
  }
  return context;
}

async function readSeven(page) {
  for (let index = 0; index < 7; index++) {
    const view = rendered(page.postList[0]);
    assert.equal(view.seriesExpanded, true, `Poem ${index + 1} must remain expanded`);
    assert.equal(view.currentSeriesIndex, index);
    assert.equal(view.seriesPoems.length, 7, 'Page indicator denominator remains seven');
    assert.equal(view.currentSeriesPoem.content, blocks[index].content);
    assert.deepEqual(JSON.parse(JSON.stringify(view.currentSeriesPoem.poemTextStyles)), blocks[index].poemTextStyles);
    await page.onPoemCardTap({ index: 0 });
  }
  assert.equal(page.postList[0].seriesExpanded, false, 'Return to cover only after the seventh poem');
}

async function main() {
  const complete = createPage();
  complete.page.setPosts([{ ...full(), seriesPoems: blocks.slice(0, 3) }]);
  await complete.page.onPoemCardTap({ index: 0 });
  await readSeven(complete.page);
  assert.equal(complete.calls.length, 0, 'A complete source array does not fetch detail');

  const pending = deferred();
  const repaired = createPage(() => pending.promise);
  repaired.page.setPosts([partial()]);
  const opening = repaired.page.onPoemCardTap({ index: 0 });
  await repaired.page.onPoemCardTap({ index: 0 });
  assert.equal(repaired.calls.length, 1, 'Repeated taps coalesce while detail is loading');
  assert.equal(repaired.calls[0][0], 'seven');
  assert.equal(repaired.calls[0][1].forceRefresh, true, 'Bypass incomplete/old detail caches');
  assert.equal(repaired.page.postList[0].seriesExpanded, false, 'Do not show three as the complete set');
  repaired.page.postList[0] = { ...repaired.page.postList[0], votes: 9, isVoted: true };
  repaired.page._postListRequestId++;
  repaired.page.postList.push({ _id: 'next-page-post' });
  pending.resolve({ post: full() });
  await opening;
  assert.equal(repaired.page.postList[0].votes, 9, 'Detail completion preserves an in-flight like update');
  assert.equal(repaired.page.postList[0].isVoted, true);
  await readSeven(repaired.page);
  await repaired.page.onPoemCardTap({ index: 0 });
  assert.equal(repaired.calls.length, 1, 'Reopening the repaired card reuses its complete poems');

  let fail = true;
  const retry = createPage(async () => { if (fail) throw Error('offline'); return { post: full() }; });
  retry.page.setPosts([partial()]);
  await retry.page.onPoemCardTap({ index: 0 });
  assert.equal(retry.page.postList[0].seriesExpanded, false);
  assert.equal(retry.page.postList[0].seriesLoading, false);
  assert.equal(retry.toasts.length, 1);
  fail = false;
  await retry.page.onPoemCardTap({ index: 0 });
  await readSeven(retry.page);

  const incomplete = createPage(async () => ({ post: partial() }));
  incomplete.page.setPosts([partial()]);
  await incomplete.page.onPoemCardTap({ index: 0 });
  assert.equal(incomplete.page.postList[0].seriesExpanded, false, 'Incomplete detail must not silently truncate');
  assert.equal(incomplete.toasts.length, 1);

  for (const reject of [false, true]) {
    const stale = deferred();
    const refresh = createPage(() => stale.promise);
    refresh.page.setPosts([partial()]);
    const old = refresh.page.onPoemCardTap({ index: 0 });
    refresh.page._postListRequestId++;
    refresh.page.setPosts([full()]);
    if (reject) stale.reject(Error('late failure'));
    else stale.resolve({ post: full() });
    await old;
    assert.equal(refresh.page.postList[0]._id, 'seven');
    assert.equal(refresh.page.postList[0].seriesExpanded, false, 'Old detail cannot expand a new reading session');
    assert.equal(refresh.toasts.length, 0, 'Ignore failures from a previous reading session');
  }

  const legacy = createPage();
  legacy.page.setPosts([{ ...full(), seriesBlocks: [], seriesPoems: blocks }]);
  await legacy.page.onPoemCardTap({ index: 0 });
  await readSeven(legacy.page);
  assert.equal(legacy.calls.length, 0);
  console.log('Original series: PASS — seven-poem navigation, stale display caches, partial-feed recovery, retries, duplicate taps and refresh races');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
