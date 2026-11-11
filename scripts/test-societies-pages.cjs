'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parse } = require('@babel/parser');

function component(file, overrides = {}) {
  let source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
  const globals = { console, SOCIETY_TABS: [], MANAGE_TABS: [], ROLE_LABELS: {}, RECRUITMENT_LABELS: {}, RECRUITMENT_OPTIONS: [], CALL_SCOPE_OPTIONS: [], CALL_SCOPE_LABELS: {}, SOCIETY_AVATAR: '', openSocietyPage() {}, societyDate() {}, showSocietyError(error) { throw error; }, ...overrides };
  for (const node of parse(source, { sourceType: 'module' }).program.body.reverse()) {
    if (node.type === 'ImportDeclaration') {
      for (const specifier of node.specifiers) if (!(specifier.local.name in globals)) globals[specifier.local.name] = {};
      source = source.slice(0, node.start) + source.slice(node.end);
    }
  }
  const options = vm.runInNewContext(source.replace('export default', 'globalThis.options ='), globals);
  const instance = { ...options.data(), $emit() {} };
  for (const [key, method] of Object.entries(options.methods)) instance[key] = method.bind(instance);
  for (const [key, getter] of Object.entries(options.computed || {})) Object.defineProperty(instance, key, { get: getter.bind(instance) });
  return { instance, options };
}
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const detail = name => ({ society: { name }, relationship: {}, viewerId: '', members: [], membersMore: true, membersNextSkip: 50, news: [], works: [], events: [], calls: [], contentPages: { events: { hasMore: true, nextSkip: 20 } } });

async function main() {
  const requests = [];
  const { instance: society } = component('pages-community/society/society.vue', {
    societyRequest(action, payload) { const pending = deferred(); requests.push({ action, payload, ...pending }); return pending.promise; }
  });
  society.id = 'a';
  const old = society.load(), latest = society.load();
  requests[1].resolve(detail('最新资料')); await latest;
  requests[0].resolve(detail('过期资料')); await old;
  assert.equal(society.society.name, '最新资料', 'a slow previous refresh cannot overwrite the latest detail');
  assert.equal(society.membersNextSkip, 50);
  society.tab = 'events';
  const page = society.moreContent();
  assert.equal(requests[2].action, 'societyContent');
  assert.equal(requests[2].payload.skip, 20);
  society.tab = 'calls';
  requests[2].resolve({ records: [{ _id: 'event-21' }], nextSkip: 21, hasMore: false }); await page;
  assert.equal(society.events[0]._id, 'event-21', 'a tab switch keeps the response in its original list');
  assert.equal(society.calls.length, 0);
  assert.equal(society.contentPages.events.hasMore, false);
  const members = society.moreMembers();
  assert.equal(requests[3].payload.skip, 50, 'member pages advance by scanned rows');
  requests[3].resolve({ members: [{ userId: 'member-51' }], hasMore: false, nextSkip: 51 }); await members;
  assert.equal(society.membersNextSkip, 51);

  const memberRequests = [];
  const { instance: directory } = component('pages-community/members/members.vue', {
    societyRequest: async (_action, payload) => {
      memberRequests.push(payload);
      return { society: {}, managers: [], members: payload.skip ? [{ userId: 'tail' }] : [], nextSkip: payload.skip ? 21 : 20, hasMore: !payload.skip };
    }
  });
  await directory.load(false); await directory.load(true);
  assert.equal(memberRequests[1].skip, 20, 'an entirely unavailable member page still advances');
  assert.equal(directory.members[0].userId, 'tail');

  const contentPending = deferred(); let contentCalls = 0;
  const { instance: manager } = component('pages-community/manage/manage.vue', {
    societyRequest: () => { contentCalls++; return contentPending.promise; }
  });
  manager.loading = false;
  const loading = manager.loadContent(true);
  await manager.loadContent(true);
  assert.equal(contentCalls, 1, 'repeated load-more clicks share the in-flight page');
  manager.tab = 'members'; await manager.loadContent(false);
  contentPending.resolve({ records: [{ _id: 'stale' }] }); await loading;
  assert.equal(manager.records.length, 0, 'the previous tab response is discarded');
  assert.equal(manager.contentLoading, false, 'switching to members clears the cancelled loading state');

  for (const operation of ['remove', 'shift']) {
    const uploaded = deferred(); let uploadStarted;
    const started = new Promise(resolve => { uploadStarted = resolve; });
    const { instance: editor } = component('pages-community/components/society/SocietyEditor.vue', {
      getCurrentUserId: () => 'alice',
      uni: { chooseImage(options) { options.success({ tempFilePaths: ['avatar.jpg'] }); } },
      societyRequest: async () => ({ uploadPrefix: 'societies/test' }),
      uploadFile: () => { uploadStarted(); return uploaded.promise; },
      societyFileUrls: async () => ({ 'cloud://avatar': 'https://example.test/avatar' })
    });
    editor.actor = 'alice';
    const first = { name: '第一位', avatarUrl: '' }, second = { name: '第二位', avatarUrl: '' };
    editor.form.guests = [first, second];
    editor.form.coverImage = 'cloud://cover';
    const upload = editor.upload(operation === 'remove' ? 0 : 1); await started;
    editor.form.guests.splice(0, 1);
    uploaded.resolve('cloud://avatar'); await upload;
    assert.equal(editor.form.coverImage, 'cloud://cover', 'a removed guest upload must not become the cover');
    assert.equal(second.avatarUrl, operation === 'shift' ? 'cloud://avatar' : '', 'uploads remain attached to their original guest after reordering');
  }
  console.log('societies pages: PASS — stale refreshes, content pagination, member cursors, repeated loads and guest upload ownership');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
