const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parse } = require('@babel/parser');
const root = path.join(__dirname, '..');
let stored, admin = false, writes = 0;
const db = { command: {}, collection(name) {
  assert.equal(name, 'adminConfig');
  return {
    where() { return this; }, limit() { return this; },
    async get() { return { data: stored ? [stored] : [] }; },
    doc(id) { assert.equal(id, 'square_bubble'); return this; },
    async set({ data }) { stored = data; writes++; }
  };
} };
const context = { exports: {}, console, require(name) {
  return name === 'wx-server-sdk'
    ? { init() {}, database: () => db, getWXContext: () => ({ OPENID: 'user' }) }
    : { isAdminByPoemId: async () => admin };
} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'functions/squareBubbleConfig/index.js'), 'utf8'), context);

async function checkReadState() {
  let config = { enabled: true, text: '来看看本期周刊', target: 'weekly' };
  const storage = new Map();
  const navigations = [];
  let activityVisits = 0;
  const globals = {
    module: { exports: {} }, console,
    uni: {
      getStorageSync: key => storage.get(key),
      setStorageSync: (key, value) => storage.set(key, value),
      navigateTo(options) { navigations.push(options.url); options.success?.(); }
    }
  };
  let source = fs.readFileSync(path.join(root, 'pages/poem-square/poem-square.vue'), 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
  const imports = parse(source, { sourceType: 'module' }).program.body.filter(node => node.type === 'ImportDeclaration');
  for (const node of imports.reverse()) {
    for (const specifier of node.specifiers) globals[specifier.local.name] = {};
    source = source.slice(0, node.start) + source.slice(node.end);
  }
  globals.getSquareBubbleConfig = async () => ({ ...config });
  globals.SQUARE_BUBBLE_TARGETS = [
    { value: 'weekly', url: '/pages-content/weekly-home/weekly-home' },
    { value: 'activities', url: '/pages-content/activity-list/activity-list' }
  ];
  globals.activityBadge = { markActivitySeen() { activityVisits++; } };
  vm.runInNewContext(source.replace('export default', 'module.exports ='), globals);
  const page = globals.module.exports;
  function newPage() {
    const instance = page.data();
    for (const [name, method] of Object.entries(page.methods)) instance[name] = method.bind(instance);
    for (const [name, getter] of Object.entries(page.computed)) Object.defineProperty(instance, name, { get: () => getter.call(instance) });
    return instance;
  }
  let instance = newPage();
  assert.equal(instance.showSquareBubble, false, '加载配置前不闪现气泡');
  await instance.loadSquareBubble();
  assert.equal(instance.showSquareBubble, true, '首次显示未读气泡');
  instance.openSquareBubble();
  instance.openSquareBubble();
  assert.deepEqual(navigations, ['/pages-content/weekly-home/weekly-home'], '点击仍然跳转，连续点击不重复导航');
  assert.equal(instance.showSquareBubble, false);
  await instance.loadSquareBubble();
  assert.equal(instance.showSquareBubble, false, '返回广场重新加载配置也保持隐藏');
  instance = newPage();
  await instance.loadSquareBubble();
  assert.equal(instance.showSquareBubble, false, '重建页面从本地恢复已读状态');

  config = { ...config, text: '新的周刊来啦' };
  await instance.loadSquareBubble();
  assert.equal(instance.showSquareBubble, true, '新文案重新提醒');
  instance.openSquareBubble();
  config = { ...config, target: 'activities' };
  await instance.loadSquareBubble();
  assert.equal(instance.showSquareBubble, true, '跳转目标变化重新提醒');
  instance.openSquareBubble();
  assert.equal(activityVisits, 1, '活动气泡保留活动已读标记逻辑');
  instance.navigateToActivityList();
  assert.equal(activityVisits, 2, '气泡隐藏不影响小乌鸦活动入口');

  config = { ...config, enabled: false, text: '未开启的消息' };
  await instance.loadSquareBubble();
  assert.equal(instance.showSquareBubble, false, '后台关闭仍有效');
  config = { ...config, enabled: true, text: '' };
  await instance.loadSquareBubble();
  assert.equal(instance.showSquareBubble, false, '空文案不展示');

  globals.uni.getStorageSync = () => { throw new Error('storage unavailable'); };
  globals.uni.setStorageSync = () => { throw new Error('storage full'); };
  config = { enabled: true, text: '本次会话提示', target: 'weekly' };
  await instance.loadSquareBubble();
  instance.openSquareBubble();
  await instance.loadSquareBubble();
  assert.equal(instance.showSquareBubble, false, '存储异常不阻断跳转，本次会话仍保持隐藏');
}

(async () => {
  const main = context.exports.main;
  assert.equal((await main()).config.target, 'weekly');
  let result = await main({ action: 'save', enabled: true, text: '活动开始啦', target: 'activities' });
  assert.equal(result.success, false);
  assert.equal(writes, 0, '普通用户不能写配置');
  admin = true;
  for (const input of [
    { text: '', target: 'weekly' }, { text: '字'.repeat(33), target: 'weekly' },
    { text: '跳转', target: 'https://example.com' }, { text: '跳转', target: '/pages-admin/admin-menu/admin-menu' }
  ]) {
    assert.equal((await main({ action: 'save', enabled: true, ...input })).success, false);
  }
  assert.equal(writes, 0);
  for (const target of ['weekly', 'activities', 'ranking', 'topics']) {
    result = await main({ action: 'save', enabled: true, text: ' 新消息 ', target });
    assert.equal(result.success, true);
    assert.equal(result.config.text, '新消息');
    const read = await main();
    assert.equal(read.config.target, target);
    assert.equal(read.config.updatedBy, undefined, '公共接口只返回展示字段');
  }
  assert.equal((await main({ action: 'save', enabled: false, text: '', target: 'weekly' })).success, true);
  assert.equal((await main()).config.enabled, false);
  const api = fs.readFileSync(path.join(root, 'api-cache/square-bubble.js'), 'utf8');
  for (const match of api.matchAll(/url: '([^']+)'/g)) {
    assert.ok(fs.existsSync(path.join(root, match[1] + '.vue')), match[1]);
  }
  await checkReadState();
  console.log('广场气泡：权限、配置、跳转、点击已读持久化、更新重新显示和活动入口检查通过');
})().catch(error => { console.error(error); process.exitCode = 1; });
