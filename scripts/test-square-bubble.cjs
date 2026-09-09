const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
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
  console.log('广场气泡：权限、校验、保存读取、关闭和跳转页面检查通过');
})().catch(error => { console.error(error); process.exitCode = 1; });
