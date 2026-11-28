'use strict';

const assert = require('node:assert/strict');
const cloud = require('wx-server-sdk');
const { memoryDb } = require('./helpers/posts-memory-db.cjs');
const { load } = require('./test-splash-startup.cjs');
const { createPostsDatabase } = require('../functions/getPoemWidgetFeed/_lib/posts');
const { describePoem, loadFeed, handle } = require('../functions/getPoemWidgetFeed/feed');

cloud.init({ env: 'poem-widget-test' });
const command = cloud.database().command;
const widget = load('utils/poemWidget.js', {}, [
  'normalizeWidgetSettings', 'normalizeWidgetColor', 'getPoemWidgetNextToken', 'getPoemWidgetPostId'
]);

function samplePost(id, time, fields = {}) {
  return { _id: id, isPoem: true, isOriginal: true, content: '一行诗', createTime: new Date(time), ...fields };
}

async function verifyFeed() {
  const now = Date.parse('2026-11-27T07:00:00+08:00');
  const start = Date.parse('2026-11-27T00:00:00+08:00');
  const end = Date.parse('2026-11-28T00:00:00+08:00');
  const rows = [
    samplePost('before-midnight', start - 1),
    samplePost('published-at-midnight', start, { votes: 7 }),
    samplePost('repost', now, { isOriginal: false, author: '诗人', authorName: '发布者', votes: 3 }),
    samplePost('legacy-repost', now, { isOriginal: undefined }),
    samplePost('tomorrow', end),
    samplePost('hidden', now, { isHidden: true, votes: 1000 }),
    samplePost('self', now, { visibility: 'self', votes: 1000 }),
    samplePost('society', now, { visibility: 'society', votes: 1000 }),
    samplePost('scheduled', now, { visibility: 'scheduled', hideAt: Date.now() + 3600000, votes: 1000 }),
    samplePost('activity', now, { isActivityPost: true, votes: 1000 }),
    samplePost('deleted', now, { isDeleted: true, votes: 1000 }),
    samplePost('pending', now, { auditStatus: 'pending', votes: 1000 }),
    samplePost('rejected', now, { auditStatus: 'rejected', votes: 1000 }),
    samplePost('normal', now, { isPoem: false, votes: 1000 }),
    samplePost('anonymous-series', now, {
      schemaVersion: 2, publishMode: 'poem', isPoem: undefined,
      isAnonymous: true, realAuthorOpenid: 'private-id', author: '真实姓名', authorName: '匿名诗人',
      content: '', backgroundColor: '#e70', textColor: '#010101',
      seriesBlocks: [{ content: '' }, { content: '正文', highlightLines: ['第一句', '第二句'] }]
    })
  ];
  const memory = memoryDb({ posts: rows }, command, { random: () => 0.41 });
  const database = createPostsDatabase(memory.db, { publicOnly: true });
  const ids = response => response.poems.map(poem => poem.id).sort();
  const today = await loadFeed(database, 'today', now);
  assert.equal(today.day, '2026-11-27');
  assert.deepEqual(ids(today), ['anonymous-series', 'legacy-repost', 'published-at-midnight', 'repost']);
  assert.deepEqual(ids(await loadFeed(database, 'today', end)), ['tomorrow']);
  assert.deepEqual(ids(await loadFeed(database, 'original', now)), ['anonymous-series', 'before-midnight', 'published-at-midnight', 'tomorrow']);
  assert.deepEqual(ids(await loadFeed(database, 'repost', now)), ['legacy-repost', 'repost']);
  assert.deepEqual(ids(await loadFeed(database, 'popular', now)), ['published-at-midnight', 'repost']);
  assert.equal(today.poems.find(poem => poem.id === 'repost').author, '诗人');
  assert.deepEqual(today.poems.find(poem => poem.id === 'anonymous-series'), {
    id: 'anonymous-series',
    excerpt: '第一句\n第二句',
    title: '',
    author: '匿名诗人',
    backgroundColor: '#EE7700',
    textColor: '#010101'
  });
  assert.equal(describePoem({ _id: 'empty', content: ' ' }), null);

  const rankedRows = Array.from({ length: 110 }, (_, index) => samplePost('rank-' + index, now, { votes: index + 1 }));
  const rankedDb = createPostsDatabase(memoryDb({ posts: rankedRows }, command).db, { publicOnly: true });
  const ranked = await loadFeed(rankedDb, 'popular', now);
  assert.equal(ranked.poems.length, 16);
  assert.ok(ranked.poems.every(poem => Number(poem.id.slice(5)) >= 10));

  assert.equal((await handle(database, { httpMethod: 'POST' })).statusCode, 405);
  assert.equal((await handle(database, { httpMethod: 'GET', queryStringParameters: { source: 'self' } })).statusCode, 400);
  const response = await handle(database, { httpMethod: 'GET', queryStringParameters: { source: 'repost' } });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(ids(JSON.parse(response.body)), ['legacy-repost', 'repost']);
}

function verifySettings() {
  const { normalizeWidgetSettings, normalizeWidgetColor, getPoemWidgetNextToken, getPoemWidgetPostId } = widget;
  const options = normalizeWidgetSettings({
    compact: { source: 'today', palette: 'poem' },
    wide: { source: 'popular', palette: 'custom', backgroundColor: '#fbd', textColor: '0f2845' }
  });
  assert.equal(options.compact.source, 'today');
  assert.equal(options.wide.source, 'popular');
  assert.equal(options.wide.backgroundColor, '#FFBBDD');
  assert.equal(options.wide.textColor, '#0F2845');
  assert.equal(normalizeWidgetColor('transparent'), '');
  const token = 'eda20a10-83dd-43d0-9345-b7bdf96179a2';
  assert.equal(getPoemWidgetNextToken('poementer://poem-widget/next?token=' + token), token);
  assert.equal(getPoemWidgetNextToken('poementer://poem-widget/next?token=' + token + '&other=1'), '');
  assert.equal(getPoemWidgetPostId('poementer://poem-widget/detail?id=poem-1'), 'poem-1');
  assert.equal(getPoemWidgetPostId('poem-widget/detail?id=%E8%AF%97%26%2B'), '诗&+');
  for (const path of [null, 'https://poem-widget/detail?id=a', 'poementer://poem-widget/detail?id=',
    'poementer://poem-widget/detail?id=%ZZ', 'poementer://poem-widget/detail?id=%0A',
    'poementer://poem-widget/detail?id=a&id=b', 'poementer://poem-widget/detail?id=a#b',
    'poementer://poem-widget/next?token=' + token]) {
    assert.equal(getPoemWidgetPostId(path), '', `Invalid poem detail link: ${path}`);
  }
}

function verifyNavigation() {
  const splashRoute = 'pages/splash/splash';
  const homeRoute = 'pages/poem-square/poem-square';
  const setupRoute = 'pages-user/profile-setup/profile-setup';
  const detailUrl = id => `/pages/post-detail/post-detail?id=${encodeURIComponent(id)}`;
  const widgetUrl = id => `poementer://poem-widget/detail?id=${encodeURIComponent(id)}`;

  function runtime({ accepted = true, needsSetup = false } = {}) {
    const calls = [];
    const nextTokens = [];
    let newIntent;
    let pages = [];
    const plus = {
      runtime: { arguments: '' },
      globalEvent: { addEventListener(event, callback) { if (event === 'newintent') newIntent = callback; } }
    };
    const uni = {
      removeStorageSync() {}, showToast() {},
      navigateTo: options => calls.push({ method: 'navigateTo', options }),
      reLaunch: options => calls.push({ method: 'reLaunch', options })
    };
    const globals = { uni, plus, getCurrentPages: () => pages, hasAcceptedPrivacyConsent: () => accepted };
    const navigation = load('utils/poemWidgetNavigation.js', globals, ['queuePoemWidgetDetail', 'openPendingPoemWidgetDetail']);
    const app = load('App.vue', {
      ...globals, ...widget, ...navigation,
      installRuntimeBindings() {}, getAppState: () => ({}), markLoginProcessStarted() {}, patchAppState() {},
      syncDeviceOrientationLock() {}, refreshLayoutSnapshot() {}, unreadBadge: { startPolling() {} },
      runAfterPrivacyConsent: callback => { if (accepted) callback(); },
      requestPoemWidgetNext: token => nextTokens.push(token)
    });
    const appVm = { appState: {}, $nextTick() {} };
    for (const [name, method] of Object.entries(app.methods)) appVm[name] = method.bind(appVm);
    const splash = load('pages/splash/splash.vue', {
      ...globals, ...navigation, getAppState: () => ({}), needsProfileSetup: () => needsSetup,
      retainPoemSquarePreload() {}, clearTimeout() {}
    });
    const setup = load('pages-user/profile-setup/profile-setup.vue', { ...globals, ...navigation });
    const splashVm = splash.data();
    return {
      calls, nextTokens,
      acceptPrivacy: () => { accepted = true; },
      show: (args = plus.runtime.arguments) => { plus.runtime.arguments = args; app.onShow.call(appVm); },
      launch: args => { plus.runtime.arguments = args; app.onLaunch.call(appVm); },
      receive: args => { plus.runtime.arguments = args; newIntent(); },
      setPage: route => { pages = [{ route }]; },
      enter: () => splash.methods.navigateAfterSplash.call(splashVm),
      finishSetup: () => setup.methods.leaveForHome(),
      resolve(method, url) {
        assert.ok(calls.length, `Expected ${method} ${url}`);
        const call = calls.shift();
        assert.equal(call.method, method);
        assert.equal(call.options.url, url);
        const target = new URL(url, 'https://example.test');
        const page = { route: target.pathname.slice(1), $page: { options: { id: target.searchParams.get('id') } } };
        pages = method === 'reLaunch' ? [page] : [...pages, page];
        call.options.success?.();
      }
    };
  }

  const cold = runtime({ accepted: false });
  cold.launch(widgetUrl('poem-1'));
  cold.setPage(splashRoute);
  cold.show();
  assert.equal(cold.calls.length, 0, 'Keep the target while privacy consent is pending');
  cold.acceptPrivacy();
  cold.enter();
  cold.resolve('reLaunch', detailUrl('poem-1'));
  assert.equal(cold.calls.length, 0);

  cold.setPage(homeRoute);
  cold.show();
  assert.equal(cold.calls.length, 0, 'Resuming from the app icon does not replay the old URL');
  cold.receive(widgetUrl('poem-1'));
  cold.show();
  cold.receive(widgetUrl('poem-1'));
  cold.resolve('navigateTo', detailUrl('poem-1'));
  assert.equal(cold.calls.length, 0, 'The same detail opens once across overlapping callbacks');
  cold.show(widgetUrl('诗&+'));
  cold.resolve('navigateTo', detailUrl('诗&+'));

  const profile = runtime({ needsSetup: true });
  profile.setPage(splashRoute);
  profile.launch(widgetUrl('poem-2'));
  profile.enter();
  profile.resolve('reLaunch', `/${setupRoute}`);
  assert.equal(profile.calls.length, 0, 'The setup page keeps the pending widget link');
  profile.finishSetup();
  profile.resolve('reLaunch', detailUrl('poem-2'));

  const late = runtime();
  late.setPage(splashRoute);
  late.enter();
  late.show(widgetUrl('poem-3'));
  late.resolve('reLaunch', `/${homeRoute}`);
  late.resolve('navigateTo', detailUrl('poem-3'));
  const token = 'eda20a10-83dd-43d0-9345-b7bdf96179a2';
  late.receive(`poementer://poem-widget/next?token=${token}`);
  assert.deepEqual(late.nextTokens, [token]);
  assert.equal(late.calls.length, 0, 'The legacy next link only changes the widget selection');
}

verifyFeed().then(() => {
  verifySettings();
  verifyNavigation();
  console.log('Poem widget tests passed: feed, settings, privacy, and cold and warm detail links');
}).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
