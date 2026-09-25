const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parse } = require('@babel/parser');
const root = path.join(__dirname, '..');

function load(file, globals = {}, named = []) {
  let source = fs.readFileSync(path.join(root, file), 'utf8');
  if (file.endsWith('.vue')) source = source.match(/<script>([\s\S]*?)<\/script>/)[1];
  const nodes = parse(source, { sourceType: 'module' }).program.body;
  for (const node of nodes.reverse()) {
    if (node.type === 'ImportDeclaration' || (node.type === 'ExportNamedDeclaration' && !node.declaration)) {
      source = source.slice(0, node.start) + source.slice(node.end);
    } else if (node.type === 'ExportNamedDeclaration') {
      source = source.slice(0, node.start) + source.slice(node.declaration.start);
    } else if (node.type === 'ExportDefaultDeclaration') {
      source = source.slice(0, node.start) + 'module.exports = ' + source.slice(node.declaration.start);
    }
  }
  if (named.length) source += `\nmodule.exports = { ${named.join(', ')} };`;
  const context = { module: { exports: {} }, console: { log() {}, warn() {}, error() {} }, ...globals };
  vm.runInNewContext(source, context, { filename: file });
  return context.module.exports;
}

function runtime() {
  const listeners = new Map();
  const timers = new Map();
  let nextTimer = 0;
  const state = { isLoggedIn: true, count: 3, calls: 0, fail: false, pending: null };
  const uni = {
    $on(event, handler) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(handler);
    },
    $emit(event, payload) { listeners.get(event)?.forEach(handler => handler(payload)); }
  };
  const EVENTS = { UNREAD_CHANGED: 'unread-changed' };
  const cacheManager = load('cache/core/manager.js');
  const api = load('api-cache/unread.js', {
    cacheManager,
    emitUnreadChanged: payload => uni.$emit(EVENTS.UNREAD_CHANGED, payload),
    async callCloudAndUnwrap(name, data, options) {
      assert.equal(name, 'getUnreadMessageCount');
      assert.equal(options.silent, true, '自动刷新失败不弹出网络提示');
      state.calls++;
      if (state.fail) throw new Error('offline');
      if (state.pending) return state.pending;
      return { count: state.count };
    }
  }, ['getUnreadCount', 'invalidateUnread', 'updateUnreadCache', 'getCachedUnreadCount']);
  const store = load('cache/stores/unread-badge.js', {
    uni, EVENTS, fetchUnreadCount: api.getUnreadCount, invalidateUnread: api.invalidateUnread,
    getAppState: () => state, formatErrorForLog: error => error.message,
    setInterval(callback, delay) {
      assert.equal(delay, 30000);
      timers.set(++nextTimer, callback);
      return nextTimer;
    },
    clearInterval(id) { timers.delete(id); }
  });
  return { store, state, timers, uni, api };
}

const flush = () => new Promise(resolve => setImmediate(resolve));

async function testStore() {
  const { store, state, timers, uni, api } = runtime();
  const first = [], second = [];
  const unsubscribe = store.subscribe(count => first.push(count));
  store.subscribe(count => second.push(count));
  await Promise.all([store.initUnreadCount(), store.refreshUnreadCount(), store.initUnreadCount()]);
  assert.equal(state.calls, 1, '启动和多个顶部栏并发刷新只请求一次');
  assert.deepEqual(first, [0, 3], '先挂载的顶部栏在初始化完成时收到未读数');
  assert.deepEqual(second, [0, 3]);

  uni.$emit('unread-changed', { count: 1 });
  assert.equal(store.getUnreadCount(), 1, '消息页事件同步全局状态');
  uni.$emit('unread-changed', { delta: -1 });
  assert.equal(store.getUnreadCount(), 0, '多订阅者不会重复应用增量');
  assert.equal(first.at(-1), 0);
  const remounted = [];
  store.subscribe(count => remounted.push(count));
  assert.deepEqual(remounted, [0], '新顶部栏不会恢复旧的未读数');

  state.count = 4;
  api.invalidateUnread();
  await flush();
  assert.equal(store.getUnreadCount(), 4, '原有缓存失效刷新仍能驱动红点');
  const beforeRefresh = state.calls;
  state.count = 5;
  await store.refreshUnreadCount();
  assert.equal(state.calls, beforeRefresh + 1, '强制刷新不使用缓存、不重复云调用');
  assert.equal(store.getUnreadCount(), 5);
  state.fail = true;
  await store.refreshUnreadCount();
  assert.equal(store.getUnreadCount(), 5, '断网保留已有红点');
  state.fail = false;
  state.count = 0;
  await store.refreshUnreadCount();
  assert.equal(store.getUnreadCount(), 0, '网络恢复后可重新刷新');

  let resolveRequest;
  state.pending = new Promise(resolve => { resolveRequest = resolve; });
  const pendingRefresh = store.refreshUnreadCount();
  await flush();
  uni.$emit('unread-changed', { count: 0 });
  resolveRequest({ count: 8 });
  await pendingRefresh;
  state.pending = null;
  assert.equal(store.getUnreadCount(), 0, '已读操作之后的旧响应不能重新点亮红点');

  unsubscribe();
  const length = first.length;
  state.count = 2;
  store.startPolling();
  store.startPolling();
  await flush();
  assert.equal(timers.size, 1, '重复显示不会创建多个定时器');
  assert.equal(store.getUnreadCount(), 2, '进入前台立即检查未读');
  state.count = 6;
  await [...timers.values()][0]();
  assert.equal(store.getUnreadCount(), 6, '停留前台可获取其他用户的新点赞/评论');
  assert.equal(first.length, length, '销毁顶部栏后取消订阅');
  store.stopPolling();
  assert.equal(timers.size, 0, '进入后台停止轮询');
  state.count = 7;
  store.startPolling();
  await flush();
  assert.equal(store.getUnreadCount(), 7, '后台返回立即获取新消息');
  store.stopPolling();
  state.isLoggedIn = false;
  const callsBeforeLogout = state.calls;
  store.startPolling();
  await [...timers.values()][0]();
  assert.equal(state.calls, callsBeforeLogout, '未登录时不轮询云函数');
  assert.equal(store.getUnreadCount(), 0);
  store.stopPolling();
}

async function testStartupRetryAndComponents() {
  const { store, state } = runtime();
  state.fail = true;
  await store.initUnreadCount();
  state.fail = false;
  await store.initUnreadCount();
  assert.equal(store.getUnreadCount(), 3, '首次加载失败后允许重试初始化');

  let starts = 0, stops = 0, refreshes = 0, unsubscribed = 0;
  const unreadBadge = {
    startPolling() { starts++; }, stopPolling() { stops++; },
    getUnreadCount: () => 2,
    refreshUnreadCount() { refreshes++; return Promise.resolve(2); },
    subscribe(callback) { callback(2); return () => { unsubscribed++; }; }
  };
  const app = load('App.vue', { unreadBadge });
  app.onShow.call({ runWhenPlusReady() {} });
  app.onHide.call({});
  assert.equal(starts, 1);
  assert.equal(stops, 1);
  const component = load('components/top-bar/top-bar.vue', { unreadBadge });
  const instance = { ...component.data(), ...component.methods, getSafeAreaTop() {}, updateCapsuleAvoidance() {} };
  component.mounted.call(instance);
  assert.equal(instance.unreadMessageCount, 2);
  assert.equal(refreshes, 1, '挂载顶部栏主动获取未读数');
  await instance.refreshUnreadCount();
  assert.equal(refreshes, 2, '暴露的刷新方法请求新数据');
  component.beforeUnmount.call(instance);
  assert.equal(unsubscribed, 1);
}

(async () => {
  await testStore();
  await testStartupRetryAndComponents();
  console.log('[test-unread-badge] PASS: initialization, events, read state, refresh, retry, concurrency, polling and lifecycle');
})().catch(error => { console.error(error); process.exitCode = 1; });
