const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parse } = require('@babel/parser');
const root = path.join(__dirname, '..');
const quiet = { log() {}, warn() {}, error() {} };
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

function platformSource(source, h5) {
  let enabled = true;
  return source.split('\n').filter(line => {
    if (line.includes('// #ifdef H5')) { enabled = h5; return false; }
    if (line.includes('// #ifndef H5')) { enabled = !h5; return false; }
    if (line.includes('// #endif')) { enabled = true; return false; }
    return enabled;
  }).join('\n');
}

function loadLink(h5, calls = []) {
  const navigate = method => options => { calls.push({ method, url: options.url }); options.success?.(); };
  const globals = {
    uni: { navigateTo: navigate('navigateTo'), switchTab: navigate('switchTab'), showToast() {} },
    window: { location: { assign: url => calls.push({ method: 'browser', url }) } }
  };
  vm.runInNewContext(platformSource(read('utils/activityNoticeLink.js'), h5).replace(/export /g, '') +
    '\nglobalThis.api = { normalizeActivityNoticeLink, openActivityNoticeLink, ACTIVITY_NOTICE_LINK_OPTIONS };', globals);
  return globals.api;
}

function loadModule(file, overrides = {}, isVue = true) {
  let source = read(file);
  if (isVue) source = source.match(/<script>([\s\S]*?)<\/script>/)[1];
  const globals = { module: { exports: {} }, console: quiet };
  const imports = parse(source, { sourceType: 'module' }).program.body.filter(node => node.type === 'ImportDeclaration');
  for (const node of imports.reverse()) {
    for (const specifier of node.specifiers) globals[specifier.local.name] = {};
    source = source.slice(0, node.start) + source.slice(node.end);
  }
  Object.assign(globals, overrides);
  vm.runInNewContext(source.replace('export default', 'module.exports =').replace(/export /g, ''), globals);
  return globals.module.exports;
}

function instance(component) {
  const result = component.data ? component.data() : {};
  for (const [key, method] of Object.entries(component.methods || {})) result[key] = method.bind(result);
  return result;
}

async function main() {
  const link = loadLink(false);
  const valid = [
    'https://example.com/article?id=1&title=%E8%AF%97#read',
    'http://example.com/', '/pages-content/weekly-home/weekly-home',
    '/pages-content/activity-detail/activity-detail?activityId=abc%26xyz', '/pages/profile/profile'
  ];
  const invalid = ['javascript:alert(1)', 'data:text/html,hello', 'file:///tmp/a', '//example.com',
    'https://', 'https://user:pass@example.com/', 'https://example.com/\nscript',
    'https://example.com\\@evil.com', '/pages/../admin', '/unknown/page', 'https://example.com/' + 'a'.repeat(2048)];
  for (const url of valid) assert.equal(link.normalizeActivityNoticeLink(` ${url} `), url);
  for (const url of invalid) assert.equal(link.normalizeActivityNoticeLink(url), '', url);

  const rows = new Map();
  let admin = true;
  const db = {
    command: { aggregate: {}, neq: value => ({ neq: value }) },
    async createCollection() {},
    collection(name) {
      assert.equal(name, 'activity_notices');
      let id, where = {}, limit = 20, skip = 0;
      const query = {
        doc(value) { id = value; return query; },
        where(value) { where = value; return query; },
        orderBy() { return query; }, limit(value) { limit = value; return query; }, skip(value) { skip = value; return query; },
        async get() {
          if (id) return { data: rows.get(id) };
          const data = [...rows.values()].filter(row => Object.entries(where).every(([key, value]) =>
            value && typeof value === 'object' && 'neq' in value ? row[key] !== value.neq : row[key] === value));
          return { data: data.slice(skip, skip + limit) };
        },
        async count() { return { total: rows.size }; },
        async add({ data }) { const key = `notice-${rows.size}`; rows.set(key, { _id: key, ...data }); return { _id: key }; },
        async update({ data }) { Object.assign(rows.get(id), data); }
      };
      return query;
    }
  };
  const backendGlobals = () => ({ exports: {}, console: quiet, require(name) {
    if (name === 'wx-server-sdk') return { init() {}, database: () => db };
    if (name.includes('admin-auth')) return { isAdminByPoemId: async () => admin };
    if (name === './_lib/activity') return require(path.join(root, 'functions/_lib/activity.js'));
    return {};
  } });
  const management = backendGlobals();
  vm.runInNewContext(read('functions/adminManager/index.js'), management);
  const publicApi = backendGlobals();
  vm.runInNewContext(read('functions/getRecentActivities/index.js'), publicApi);
  for (const url of invalid) assert.ok(management.buildActivityNoticePayload({ linkUrl: url }).error, url);
  for (const url of valid) assert.equal(management.buildActivityNoticePayload({ linkUrl: ` ${url} ` }).payload.linkUrl, url);

  const create = await management.exports.main({ action: 'createActivityNotice', openid: 'admin', title: '海报', linkUrl: valid[0], status: 'published' });
  assert.equal(create.success, true);
  assert.equal(create.notice.linkUrl, valid[0]);
  assert.equal((await publicApi.exports.main({ noticeOnly: true })).notices[0].linkUrl, valid[0]);
  const update = linkUrl => management.exports.main({ action: 'updateActivityNotice', openid: 'admin', noticeId: create.noticeId, linkUrl });
  await update(valid[2]);
  assert.equal((await management.exports.main({ action: 'listActivityNotices', openid: 'admin' })).notices[0].linkUrl, valid[2]);
  assert.equal((await publicApi.exports.main({ noticeOnly: true })).notices[0].linkUrl, valid[2]);
  await management.exports.main({ action: 'updateActivityNotice', openid: 'admin', noticeId: create.noticeId, title: '旧客户端编辑标题' });
  assert.equal(rows.get(create.noticeId).linkUrl, valid[2], 'updates from older clients preserve the configured link');
  admin = false;
  assert.equal((await update(valid[0])).success, false);
  assert.equal(rows.get(create.noticeId).linkUrl, valid[2]);
  admin = true;
  await update('');
  assert.equal((await publicApi.exports.main({ noticeOnly: true })).notices[0].linkUrl, '', 'removing a link is persisted');
  assert.equal(management.buildActivityNoticeView({ title: '旧海报' }).linkUrl, '');

  const cache = { getOrFetch: async (key, fetch) => fetch(), delete() {}, clear() {} };
  const client = loadModule('api-cache/activity-notices.js', {
    cacheManager: { namespace: () => cache }, ...link,
    cloudCall: async () => ({ result: await publicApi.exports.main({ noticeOnly: true }) })
  }, false);
  await update(valid[0]);
  assert.equal((await client.getActivityNotices()).notices[0].linkUrl, valid[0], 'client normalization must preserve the URL');

  const editorComponent = loadModule('pages-admin/activity-notice-management/activity-notice-management.vue', link);
  const editor = instance(editorComponent);
  editor.loadImagePreview = () => {};
  editor.openEdit(create.notice);
  assert.equal(editor.form.linkUrl, valid[0]);
  assert.equal(editor.buildPayload().linkUrl, valid[0]);
  editor.form.linkUrl = invalid[0];
  assert.ok(editor.validateForm());
  editor.onQuickLinkChange({ detail: { value: 1 } });
  assert.equal(editor.form.linkUrl, valid[2]);
  editor.onQuickLinkChange({ detail: { value: 0 } });
  assert.equal(editor.buildPayload().linkUrl, '');

  const carousel = loadModule('components/activity/ActivityNoticeCarousel.vue', link);
  const card = instance(carousel);
  card.notices = [{ value: 'old', title: '旧海报' }, { value: 'linked', title: '新海报', image: 'broken', linkUrl: valid[0] }];
  const selected = [];
  card.$emit = (event, notice) => selected.push(notice.value);
  let display = carousel.computed.safeNotices.call(card);
  card.handleSelect(display[0]);
  card.handleSelect(display[1]);
  assert.deepEqual(selected, ['linked']);
  card.onImageError(display[1]);
  display = carousel.computed.safeNotices.call(card);
  assert.equal(display[1].image, '');
  assert.equal(display[1].linkUrl, valid[0], 'image fallback keeps its destination');

  for (const h5 of [false, true]) {
    const calls = [];
    const api = loadLink(h5, calls);
    await api.openActivityNoticeLink('/pages/profile/profile');
    await api.openActivityNoticeLink(valid[3]);
    await api.openActivityNoticeLink(valid[0]);
    assert.equal(calls[0].method, 'switchTab');
    assert.equal(calls[1].url, valid[3]);
    assert.equal(calls[2].method, h5 ? 'browser' : 'navigateTo');
    assert.equal(h5 ? calls[2].url : decodeURIComponent(calls[2].url.split('?url=')[1]), valid[0]);
    await api.openActivityNoticeLink(invalid[0]);
    assert.equal(calls.length, 3);
  }
  const web = loadModule('pages-tools/web-link/web-link.vue', link);
  const webPage = instance(web);
  web.onLoad.call(webPage, { url: encodeURIComponent(valid[0]) });
  assert.equal(webPage.url, valid[0]);
  web.onLoad.call(webPage, { url: encodeURIComponent(invalid[0]) });
  assert.equal(webPage.url, '');
  console.log('[test-activity-notice-links] PASS: admin create/edit/clear/auth, public API and cache, editor, carousel fallback, App/MP web page and H5 routing');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
