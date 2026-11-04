const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('puppeteer-core');
const fixtures = require('./fixtures/society-ui.cjs');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'output/societies-ui-20261102');
fs.mkdirSync(output, { recursive: true });
const apiMock = String.raw`
const f = ${JSON.stringify(fixtures)};
export async function societyRequest(action, payload = {}) {
  window.__societyRequests = window.__societyRequests || [];
  window.__societyRequests.push({ action, payload });
  if (window.__societyFailure) throw Object.assign(new Error('测试网络不可用，请稍后重试'), { code: 'SERVICE_ERROR' });
  if (window.__societyEmpty) return { societies: [], works: [], events: [], calls: [] };
  if (action === 'statistics') return { statistics: { members: 98, works: 134, registrations: 98, submissions: 14, weekMembers: 6, weekWorks: 24, weekSubmissions: 4, activeEvents: 2 } };
  if (action === 'manageContent') return { records: (payload.kind === 'event' ? f.events : payload.kind === 'call' ? f.calls : f.news).map(item => ({ ...item, revision: 1, societyId: 'society-a' })) };
  if (action === 'myWorks') return { works: f.works, hasMore: false };
  if (action === 'societyWorks') return { works: [{ ...f.works[0], _id: 'poem-more' }], cursor: '4', hasMore: false };
  if (action === 'registrations') return { records: [{ _id: 'registration', nickName: '某某某', createdAt: new Date().toISOString() }], hasMore: false };
  if (action === 'registration') return { registered: payload.registered };
  if (action === 'myParticipation') return { records: [{ _id: 'submission', callId: f.calls[0]._id, revision: 1, title: '外滩，三个脚步', status: 'approved', item: f.calls[0], submittedAt: new Date().toISOString() }], hasMore: false };
  if (action === 'submissions' && payload.status === 'deferred') return { records: [{ _id: 'submission-deferred', revision: 2, status: 'deferred', post: { title: '此前待定的诗', content: '下次评审仍能看到我' } }], hasMore: false };
  if (action === 'submissions') return { records: [
    { _id: 'submission', revision: 1, status: 'pending', post: { title: '外滩，三个脚步', authorName: '某某某', content: '当我听到河哗哗作响\n岸上的声音自然就隐去了\n我转身淌入河水\n想趁分流前，牵住你的手\n第一行之后仍有诗句\n再往下是一段长诗\n沿着河岸继续走\n灯光慢慢亮起来\n风吹过空旷的桥\n　　保留原文的缩进\n继续阅读这一首诗\n最后一行也完整可见' } },
    { _id: 'submission-series', revision: 1, status: 'pending', post: { title: '组诗', seriesBlocks: [{ subtitle: '第一节', content: '第一节的正文' }, { subtitle: '第二节', content: '第二节的最后一行' }] } }
  ], hasMore: false };
  if (action === 'editContent') return { item: { ...f.events[0], revision: 1, description: '一起读诗', startTime: '2026-12-02T19:00:00+08:00', endTime: '2026-12-02T21:00:00+08:00', registrationEnd: '2026-12-01T20:00:00+08:00' } };
  if (action === 'home') return { societies: [f.society, { ...f.society, _id: 'society-b', name: 'HOLA诗社', school: 'HOLA大学', memberCount: 124 }], events: f.events, calls: f.calls, pastCalls: [], currentCallTotal: f.calls.length, pastCallTotal: 0, works: f.works };
  if (action === 'callList') return { calls: payload.filter === 'past' ? [] : f.calls, hasMore: false };
  if (action === 'list') return { societies: payload.query === '不存在' ? [] : [f.society], hasMore: false };
  if (action === 'memberDirectory') return { society: f.society, managers: [...f.members.filter(row => row.role === 'owner'), { ...f.members[1], userId: 'carol', nickName: '管理员', role: 'admin' }], members: f.members.filter(row => row.role === 'member'), hasMore: false };
  if (action === 'detail') return { society: f.society, relationship: { role: 'owner', following: true }, viewerId: 'alice', works: f.works.map(item => ({ ...item })), worksCursor: String(f.works.length), worksMore: true, members: f.members, news: f.news, events: f.events, calls: f.calls };
  if (action === 'myApplication') return { application: null, uploadPrefix: 'societies/test' };
  if (action === 'manage') return { society: f.society, managerRole: 'owner', members: f.members, membersMore: false, requests: f.requests, uploadPrefix: 'societies/test', events: f.events, calls: f.calls, news: f.news };
  if (action === 'notifications') return { notifications: window.__societyNotificationsCleared ? [] : [{ _id: 'notice-a', category: 'membership', title: '入社申请已通过', body: '欢迎加入回车键诗社', targetId: 'society-a', targetKind: 'society', read: false, createdAt: '2026-11-02T09:00:00+08:00', societyName: f.society.name, societyAvatar: f.society.avatarUrl }], hasMore: false };
  if (action === 'unreadNotifications') return { count: window.__societyUnreadCount ?? 1 };
  if (action === 'clearNotifications') { window.__societyNotificationsCleared = true; window.__societyUnreadCount = 0; return { deleted: 1 }; }
  if (action === 'profile') return { society: f.society, profile: { nickName: '可以锕', avatarUrl: f.society.avatarUrl, role: 'owner', bio: '以诗友芳邻，无问西与东。' }, works: f.works.filter(item => item._openid === payload.userId), hasMore: false };
  if (action === 'mine') return { societies: [{ ...f.society, role: 'owner', following: true }], requests: f.requests };
  if (action === 'opportunity') return { works: payload.kind === 'call' ? f.works : [], item: { ...(payload.kind === 'call' ? f.calls[0] : f.events[0]), societyAvatar: f.society.avatarUrl, coverImage: payload.kind === 'call' ? '' : f.society.avatarUrl, registrationEnd: '2099-12-01T19:00:00+08:00', startTime: '2099-12-02T19:00:00+08:00', deadline: '2099-12-01T19:00:00+08:00', description: f.society.description, requirements: '1. 欢迎喜欢诗歌的同学参与。\n2. 带上一首你最近在读的诗。\n3. 为一句诗，留一点时间。', guests: [{ role: '嘉宾', name: '某某某', bio: '回车键专业教授，诗人', avatarUrl: f.society.avatarUrl }] }, hosts: payload.kind === 'call' ? [{ _id: f.society._id, name: f.society.name, avatarUrl: f.society.avatarUrl }, { _id: 'society-b', name: 'HOLA诗社', avatarUrl: f.society.avatarUrl }] : [{ _id: f.society._id, name: f.society.name, avatarUrl: f.society.avatarUrl }] };
  if (action === 'listApplications') return { applications: [f.application], hasMore: false };
  return { success: true };
}
export async function societyFileUrls(ids) { return Object.fromEntries(ids.map(id => [id, id])); }
`;

async function main() {
  const base = new URL(process.env.H5_URL || 'http://127.0.0.1:8081/');
  const browser = await puppeteer.launch({ executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setRequestInterception(true);
    page.on('request', request => {
      const url = new URL(request.url());
      if (url.origin === base.origin && url.pathname === '/api-cache/societies.js') return request.respond({ status: 200, contentType: 'application/javascript', body: apiMock });
      if (['data:', 'blob:', 'about:'].includes(url.protocol) || (url.origin === base.origin && ['GET', 'HEAD'].includes(request.method()))) request.continue();
      else request.abort();
    });
    await page.goto(new URL('#/pages/login/login', base).href, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof getCurrentPages === 'function' && getCurrentPages().at(-1)?.$vm);
    await page.evaluate(async () => {
      const source = await (await fetch('/components/poem/PoemCard.vue')).text();
      const { h, render, nextTick } = await import(source.match(/from "([^"\n]*vue\.runtime\.esm\.js[^"\n]*)"/)[1]);
      const { setLoginState } = await import('/utils/auth.js');
      const user = { _openid: 'alice', nickName: '可以锕', poemId: 'alice-poem' };
      uni.setStorageSync('userInfo', user);
      setLoginState(user, 'alice');
      const host = document.createElement('div');
      host.id = 'society-ui-review';
      host.style.cssText = 'position:fixed;inset:0;overflow:auto;z-index:2147480000;background:#fff;';
      document.body.appendChild(host);
      const context = getCurrentPages().at(-1).$vm.$.appContext;
      window.__societyNavigations = [];
      uni.navigateTo = options => window.__societyNavigations.push(options.url);
      window.__showSociety = async (name, options = {}) => {
        render(null, host); host.scrollTop = 0;
        const original = (await import('/pages-community/' + name + '/' + name + '.vue')).default;
        const component = { ...original };
        for (const key of Object.keys(component)) if (/^on[A-Z]/.test(key)) delete component[key];
        const node = h(component); node.appContext = context; render(node, host);
        const instance = node.component.proxy;
        if ('id' in instance) instance.id = options.id || 'society-a';
        if ('userId' in instance) instance.userId = 'alice';
        if ('kind' in instance) instance.kind = options.kind || 'event';
        if (name === 'discover') await instance.search(); else await instance.load();
        if (options.tab) instance.tab = options.tab;
        window.__societyVm = instance;
        await nextTick();
        await Promise.all([...host.querySelectorAll('img')].map(img => img.complete ? Promise.resolve() : new Promise(resolve => { img.onload = resolve; img.onerror = resolve; })));
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      };
    });
    const screens = [['home', {}], ['calls', {}], ['discover', {}], ['notifications', {}], ['society', { tab: 'events' }], ['society', { tab: 'works' }], ['members', {}], ['apply', {}], ['manage', {}], ['manage', { tab: 'calls' }], ['manage', { tab: 'events' }], ['manage', { tab: 'members' }], ['profile', {}], ['mine', {}], ['mine', { tab: 'submissions' }], ['opportunity', {}], ['opportunity', { kind: 'call' }], ['review', {}]];
    for (const width of [390, 320]) {
      await page.setViewport({ width, height: 844, isMobile: true, hasTouch: true });
      for (const [name, options] of screens) {
        await page.evaluate((name, options) => window.__showSociety(name, options), name, options);
        if ((name === 'society' && options.tab === 'works') || name === 'profile') await new Promise(resolve => setTimeout(resolve, 400));
        const overflow = await page.$eval('#society-ui-review', host => ({ scroll: host.scrollWidth, width: host.clientWidth }));
        assert.ok(overflow.scroll <= overflow.width + 1, `${name}/${width}: horizontal overflow ${JSON.stringify(overflow)}`);
        if (width === 390 || name === 'manage' || name === 'apply') await page.screenshot({ path: path.join(output, `${name}-${options.tab || options.kind || 'main'}-${width}.png`) });
        if (width === 390 && ['home', 'apply', 'opportunity'].includes(name)) {
          const height = await page.$eval('#society-ui-review', el => Math.min(4000, Math.max(844, el.scrollHeight)));
          await page.setViewport({ width, height, isMobile: true, hasTouch: true });
          await page.screenshot({ path: path.join(output, `${name}-${options.kind || 'main'}-full-${width}.png`) });
          await page.setViewport({ width, height: 844, isMobile: true, hasTouch: true });
        }
      }
    }
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.evaluate(() => window.__showSociety('home'));
    await page.evaluate(() => window.__societyVm.refreshUnread());
    assert.ok(await page.$('#society-ui-review .notice-button .notice-dot'), 'unread society notifications show a dot on the home button');
    await page.evaluate(async () => { window.__societyUnreadCount = 0; await window.__societyVm.refreshUnread(); });
    assert.equal(await page.$('#society-ui-review .notice-button .notice-dot'), null, 'the dot clears when notifications are read');
    await page.evaluate(async () => { window.__societyUnreadCount = 1; await window.__societyVm.refreshUnread(); });
    await page.evaluate(() => window.__showSociety('notifications'));
    assert.ok(await page.$('#society-ui-review .clear-button'), 'society notifications have a clear action');
    await page.evaluate(() => { window.__originalSocietyModal = uni.showModal; uni.showModal = options => options.success({ confirm: false }); });
    await page.click('#society-ui-review .clear-button');
    assert.ok(await page.$('#society-ui-review .notice-item'), 'cancelling clear keeps notifications');
    await page.evaluate(() => { uni.showModal = options => options.success({ confirm: true }); });
    await page.click('#society-ui-review .clear-button');
    await page.waitForFunction(() => window.__societyNotificationsCleared && window.__societyVm.items.length === 0);
    assert.equal(await page.$('#society-ui-review .notice-item'), null, 'confirmed clear removes the notification list');
    await page.evaluate(() => { uni.showModal = window.__originalSocietyModal; });
    await page.evaluate(() => window.__showSociety('home'));
    assert.ok((await page.$eval('#society-ui-review .society-card .follow-button', el => el.textContent)).includes('已关注'), 'home restores the saved follow state');
    assert.deepEqual(await page.evaluate(() => { const vm = window.__societyVm; vm.currentCallTotal = 4; vm.pastCallTotal = 7; vm.callFilter = 'current'; const current = vm.hasMoreCalls; vm.callFilter = 'ending'; const ending = vm.hasMoreCalls; vm.callFilter = 'past'; const past = vm.hasMoreCalls; return { current, ending, past }; }), { current: false, ending: true, past: true }, 'the more link follows the selected call filter');
    assert.equal(await page.$('#society-ui-review .stack-meta'), null, 'no author, date or page count is shown below the stack');
    assert.ok(await page.$eval('#society-ui-review .stack-avatar', el => (el.querySelector('img')?.getAttribute('src') || '').includes('society-raven.png')), 'front card shows the author avatar');
    assert.ok(await page.$eval('#society-ui-review .stack-avatar', el => {
      const card = el.closest('.poem-stack-card').getBoundingClientRect();
      const avatar = el.getBoundingClientRect();
      return avatar.width > 0 && avatar.width <= 30 && avatar.height <= 30 && avatar.right <= card.right && avatar.top >= card.top;
    }), 'avatar stays small in the upper right of the card');
    assert.ok(await page.$eval('#society-ui-review .stack-signature', el => { const image = el.querySelector('img'); return image?.complete && image.naturalWidth > 0; }), 'signature image loads on the front card');
    await page.evaluate(() => {
      const stack = document.querySelector('#society-ui-review .poem-stack');
      const touch = x => new Touch({ identifier: 1, target: stack, clientX: x, clientY: 160 });
      stack.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, changedTouches: [touch(280)] }));
      stack.dispatchEvent(new TouchEvent('touchend', { bubbles: true, changedTouches: [touch(80)] }));
    });
    await page.waitForFunction(() => document.querySelector('#society-ui-review .stack-copy')?.textContent.includes('夜里有一盏灯'));
    assert.ok((await page.$eval('#society-ui-review .stack-copy', el => el.textContent)).includes('夜里有一盏灯'), 'left swipe shows the next work');
    await page.evaluate(() => {
      const stack = document.querySelector('#society-ui-review .poem-stack');
      const touch = x => new Touch({ identifier: 2, target: stack, clientX: x, clientY: 160 });
      stack.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, changedTouches: [touch(80)] }));
      stack.dispatchEvent(new TouchEvent('touchend', { bubbles: true, changedTouches: [touch(280)] }));
    });
    await page.waitForFunction(() => document.querySelector('#society-ui-review .stack-copy')?.textContent.includes('当我听到河哗哗作响'));
    await page.click('#society-ui-review .society-card');
    assert.equal(await page.evaluate(() => window.__societyNavigations.at(-1)), '/pages-community/society/society?id=society-a');
    await page.evaluate(() => window.__showSociety('society'));
    await page.$$eval('#society-ui-review .community-tab', buttons => buttons.find(button => button.textContent.includes('作品')).click());
    assert.equal(await page.evaluate(() => window.__societyVm.tab), 'works');
    assert.equal(await page.$$('#society-ui-review .society-works--feed .post-item-wrapper').then(items => items.length), fixtures.works.length, 'society works reuse the index feed rows');
    await page.click('#society-ui-review .more-works');
    await page.waitForFunction(count => document.querySelectorAll('#society-ui-review .society-works--feed .post-item-wrapper').length === count, {}, fixtures.works.length + 1);
    assert.ok(await page.evaluate(() => window.__societyRequests.some(row => row.action === 'societyWorks' && row.payload.cursor === '3')), 'society works loads the next page');
    assert.ok(await page.$('#society-ui-review .society-works--feed .vote-section'), 'feed actions are visible');
    assert.ok(await page.$('#society-ui-review .society-works--feed .like-icon--voted'), 'society works keep the viewer like state');
    assert.equal(await page.$('#society-ui-review .society-works--feed .poem-card'), null, 'society works no longer use colored poem cards');
    await page.click('#society-ui-review .society-works--feed .author-info-outside .author-avatar');
    assert.equal(await page.evaluate(() => window.__societyNavigations.at(-1)), '/pages-community/profile/profile?id=society-a&userId=alice');
    await page.evaluate(() => window.__showSociety('profile'));
    assert.equal(await page.$$('#society-ui-review .society-works--feed .post-item-wrapper').then(items => items.length), fixtures.works.filter(item => item._openid === 'alice').length, 'society profile reuses the index feed rows for this author');
    assert.ok(await page.$('#society-ui-review .society-works--feed .vote-section'), 'profile feed actions are visible');
    assert.equal(await page.$('#society-ui-review .society-works--feed .poem-card'), null, 'profile no longer uses colored poem cards');
    await page.evaluate(() => window.__showSociety('discover'));
    assert.ok((await page.$eval('#society-ui-review .society-card .follow-button', el => el.textContent)).includes('已关注'), 'discovery restores the saved follow state');
    await page.evaluate(() => window.__showSociety('calls'));
    await page.click('#society-ui-review .calls-filter-trigger');
    await page.waitForSelector('#society-ui-review .calls-filter-panel');
    await new Promise(resolve => setTimeout(resolve, 400));
    await page.screenshot({ path: path.join(output, 'calls-filter-390.png') });
    await page.click('#society-ui-review .calls-filter-option:nth-child(2)');
    await page.waitForFunction(() => window.__societyVm.availableOnly === true);
    assert.ok(await page.evaluate(() => window.__societyRequests.some(row => row.action === 'callList' && row.payload.availableOnly === true)), 'call filter reloads with the available-only scope');
    for (const [audience, label] of [['all', '公开征稿'], ['school', '仅限本校'], ['members', '限本诗社']]) {
      await page.evaluate(audience => { window.__societyVm.calls[0].audience = audience; }, audience);
      assert.equal(await page.$eval('#society-ui-review .opportunity-card .tag.scope', el => el.textContent), label, `call card displays ${audience} scope`);
    }
    await page.evaluate(async () => { await window.__showSociety('manage'); window.__societyVm.tab = 'calls'; });
    await page.waitForSelector('#society-ui-review .create-fab');
    await page.click('#society-ui-review .create-fab');
    await page.waitForSelector('#society-ui-review .editor');
    assert.deepEqual(await page.evaluate(() => window.__societyVm.$refs.editorForm.callScopeOptions.map(option => option.label)), ['公开征稿', '仅限本校', '限本诗社'], 'call editor offers all three scopes');
    await page.evaluate(() => { window.__societyVm.$refs.editorForm.form.audience = 'members'; });
    assert.ok((await page.$eval('#society-ui-review .editor', el => el.textContent)).includes('限本诗社'), 'call editor displays the selected scope');
    await page.evaluate(() => window.__showSociety('society'));
    await page.click('#society-ui-review .stat-entry');
    assert.equal(await page.evaluate(() => window.__societyNavigations.at(-1)), '/pages-community/members/members?id=society-a', 'member count opens the member directory');
    await page.evaluate(() => window.__showSociety('members'));
    await page.click('#society-ui-review .member-row');
    assert.equal(await page.evaluate(() => window.__societyNavigations.at(-1)), '/pages-community/profile/profile?id=society-a&userId=alice', 'directory member opens the society profile');
    await page.evaluate(async () => { await window.__showSociety('discover'); window.__societyVm.query = '不存在'; await window.__societyVm.search(); });
    assert.ok(await page.$('#society-ui-review .community-state'), 'empty search state is rendered');
    await page.evaluate(async () => { window.__societyFailure = true; await window.__showSociety('home'); });
    assert.ok((await page.$eval('#society-ui-review', el => el.textContent)).includes('重新加载'));
    await page.evaluate(() => { window.__societyFailure = false; });
    await page.click('#society-ui-review .state-action');
    await page.waitForSelector('#society-ui-review .society-card');
    await page.evaluate(async () => { window.__societyEmpty = true; await window.__showSociety('home'); });
    await page.screenshot({ path: path.join(output, 'home-empty-390.png') });
    await page.evaluate(() => { window.__societyEmpty = false; });
    await page.evaluate(async () => {
      const theme = await import('/utils/theme.js');
      if (theme.setThemeMode) theme.setThemeMode('dark');
      await window.__showSociety('society', { tab: 'events' });
    });
    await page.screenshot({ path: path.join(output, 'society-dark-390.png') });
    await page.evaluate(async () => { const theme = await import('/utils/theme.js'); theme.setThemeMode('light'); await window.__showSociety('manage'); window.__societyVm.tab = 'events'; });
    await page.waitForSelector('#society-ui-review .create-fab');
    await page.click('#society-ui-review .create-fab');
    await page.waitForSelector('#society-ui-review .editor');
    await page.screenshot({ path: path.join(output, 'event-editor-390.png') });
    await page.evaluate(async () => {
      const editor = window.__societyVm.$refs.editorForm;
      Object.assign(editor.form, { title: '读诗会', description: '在图书馆读诗', location: '图书馆' });
      editor.days = { startTime: '2099-12-02', endTime: '2099-12-02', registrationEnd: '2099-12-01' };
      editor.times = { startTime: '19:00', endTime: '21:00', registrationEnd: '20:00' };
      await editor.save();
    });
    assert.ok(await page.evaluate(() => window.__societyRequests.some(row => row.action === 'saveContent' && row.payload.form.startTime === '2099-12-02T19:00:00+08:00' && row.payload.requestId)), 'editor publishes through the service with a stable request id');
    await page.evaluate(async () => { await window.__showSociety('manage'); window.__societyVm.tab = 'calls'; });
    await page.waitForFunction(() => window.__societyVm.records.length && window.__societyVm.records[0].societyId);
    await page.evaluate(() => { window.__societyVm.selectedCall = window.__societyVm.records[0]; });
    await page.waitForSelector('#society-ui-review .review-poem-content');
    assert.ok(await page.evaluate(() => window.__societyRequests.some(row => row.action === 'submissions' && row.payload.status === 'pending')), 'review loads pending submissions');
    assert.equal(await page.$('#society-ui-review .review-status'), null, 'review has no status filter');
    assert.equal(await page.$('#society-ui-review .actions .text-button'), null, 'review has no previous or next buttons');
    assert.equal(await page.$('#society-ui-review .poem-stack'), null, 'review displays the poem directly');
    assert.ok(await page.$eval('#society-ui-review .review-poem-content', el => el.textContent.includes('最后一行也完整可见') && getComputedStyle(el).whiteSpace === 'pre-wrap' && el.scrollHeight <= el.clientHeight + 1), 'long poem retains its final line without clipping');
    await page.screenshot({ path: path.join(output, 'submission-review-390.png') });
    await page.click('#society-ui-review .review-actions .defer');
    await page.waitForFunction(() => document.querySelectorAll('#society-ui-review .review-series-block').length === 2);
    assert.ok((await page.$eval('#society-ui-review .review-series-block:last-child', el => el.textContent)).includes('第二节的最后一行'), 'review shows every section of a series');
    assert.equal(await page.evaluate(() => window.__societyRequests.filter(row => row.action === 'reviewWork').length), 0, 'defer skips without writing a review');
    await page.click('#society-ui-review .review-actions .defer');
    await page.waitForFunction(() => document.querySelector('#society-ui-review .review-poem-title')?.textContent.includes('此前待定的诗'));
    assert.ok(await page.evaluate(() => window.__societyRequests.some(row => row.action === 'submissions' && row.payload.status === 'deferred')), 'review also loads previously deferred submissions');
    await page.click('#society-ui-review .review-actions .defer');
    await page.waitForFunction(() => document.querySelector('#society-ui-review .review-empty')?.textContent.includes('本轮评审已结束'));
    await page.evaluate(async () => { await window.__showSociety('manage'); window.__societyVm.tab = 'calls'; });
    await page.waitForFunction(() => window.__societyVm.records.length && window.__societyVm.records[0].societyId);
    await page.evaluate(() => { window.__societyVm.selectedCall = window.__societyVm.records[0]; });
    await page.waitForFunction(() => document.querySelector('#society-ui-review .review-poem-title')?.textContent.includes('外滩，三个脚步'));
    assert.equal(await page.evaluate(() => window.__societyRequests.filter(row => row.action === 'reviewWork').length), 0, 'skipped poems return in a later review session');
    await page.click('#society-ui-review .review-actions .approve');
    await page.waitForFunction(() => window.__societyRequests.some(row => row.action === 'reviewWork' && row.payload.decision === 'approved' && row.payload.revision === 1));
    await page.waitForFunction(() => document.querySelector('#society-ui-review .review-poem-title')?.textContent.includes('组诗'));
    await page.evaluate(() => window.__showSociety('opportunity'));
    const eventHosts = await page.$eval('#society-ui-review', el => el.textContent);
    assert.ok(eventHosts.includes('主办诗社') && !eventHosts.includes('合办诗社'), 'event shows only the main society');
    await page.click('#society-ui-review .detail-footer .primary-button');
    await page.waitForFunction(() => window.__societyVm.registered === true);
    await page.click('#society-ui-review .detail-footer .primary-button');
    await page.waitForFunction(() => window.__societyVm.registered === false);
    await page.evaluate(() => window.__showSociety('opportunity', { kind: 'call' }));
    const callHosts = await page.$eval('#society-ui-review', el => el.textContent);
    assert.ok(callHosts.includes('主办诗社') && callHosts.includes('合办诗社'), 'call separates host and co-host labels');
    for (const [audience, label] of [['all', '公开征稿'], ['school', '仅限本校'], ['members', '限本诗社']]) {
      await page.evaluate(audience => { window.__societyVm.item.audience = audience; }, audience);
      assert.ok((await page.$eval('#society-ui-review', el => el.textContent)).includes(`收稿范围：${label}`), `call detail displays ${audience} scope`);
    }
    await page.click('#society-ui-review .detail-footer .primary-button');
    await page.waitForSelector('#society-ui-review .submission-options');
    await page.click('#society-ui-review .submission-options .secondary-button');
    await page.waitForSelector('#society-ui-review .work-picker .post-item-simple');
    await page.click('#society-ui-review .work-picker .post-item-simple');
    await page.click('#society-ui-review .work-picker .primary-button');
    await page.waitForFunction(() => window.__societyRequests.some(row => row.action === 'submitWork' && row.payload.postId));
    assert.equal(errors.length, 0, errors.join('\n'));
    console.log(`societies H5: PASS — 38 layouts, poem stack swipe/avatar/signature, society and profile feed rows, member directory, editors, registration/cancellation, submission/review, navigation, tabs, empty states and retry; screenshots: ${output}`);
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
