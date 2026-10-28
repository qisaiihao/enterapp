const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parse } = require('@babel/parser');
const { fakeTime, deferred, drain } = require('./test-splash-startup.cjs');

// Keep the transition module intact; replace only the browser's async .vue loader.
function loadTransition(globals) {
  const filename = path.join(__dirname, '../utils/h5TabTransition.js');
  let source = fs.readFileSync(filename, 'utf8').replace(/\bimport\s*\(/g, '__importPage(');
  for (const node of parse(source, { sourceType: 'module' }).program.body.reverse()) {
    if (node.type === 'ExportNamedDeclaration') {
      source = source.slice(0, node.start) + source.slice(node.declaration.start);
    }
  }
  source += '\nmodule.exports = { switchTabH5, cancelH5TabTransition, h5TabTransitionMixin };';
  const context = { ...globals, module: { exports: {} } };
  vm.runInNewContext(source, context, { filename });
  return context.module.exports;
}

function eventTarget() {
  const listeners = new Map();
  return {
    addEventListener(type, callback) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(callback);
    },
    removeEventListener(type, callback) { listeners.get(type)?.delete(callback); },
    emit(type, event = { type }) { for (const callback of [...listeners.get(type) || []]) callback(event); },
    listenerCount() { return [...listeners.values()].reduce((sum, set) => sum + set.size, 0); }
  };
}

function element(tagName = 'DIV') {
  const node = {
    ...eventTarget(), tagName, children: [], attributes: new Map(), style: { cssText: '' },
    scrollTop: 0, scrollLeft: 0,
    setAttribute(name, value) { this.attributes.set(name, value); },
    getAttribute(name) { return this.attributes.get(name) ?? null; },
    removeAttribute(name) { this.attributes.delete(name); },
    appendChild(child) { child.parentNode = this; this.children.push(child); return child; },
    remove() {
      if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(child => child !== this);
      this.parentNode = null;
    },
    querySelectorAll(selector) {
      const descendants = this.children.flatMap(child => [child, ...child.querySelectorAll('*')]);
      return selector === '[id]' ? descendants.filter(child => child.attributes.has('id')) : descendants;
    },
    getBoundingClientRect() { return { top: 0, left: 0, width: 390, height: 844 }; },
    cloneNode(deep) {
      const copy = element(this.tagName);
      copy.attributes = new Map(this.attributes);
      copy.style = { ...this.style };
      if (deep) for (const child of this.children) copy.appendChild(child.cloneNode(true));
      return copy;
    }
  };
  return node;
}

function runtime() {
  const time = fakeTime(), calls = [], imports = [], frames = new Map();
  let frameId = 0;
  const source = { route: 'pages/poem-square/poem-square' };
  const target = { route: 'pages/mountain/mountain', $nextTick: callback => Promise.resolve().then(callback) };
  let current = source;
  const body = element('BODY'), sourceElement = element('UNI-PAGE');
  sourceElement.setAttribute('data-page', source.route);
  sourceElement.setAttribute('id', 'source-page');
  const scroller = element();
  scroller.setAttribute('id', 'poem-list');
  scroller.scrollTop = 384;
  sourceElement.appendChild(scroller);
  body.appendChild(sourceElement);
  const document = { ...eventTarget(), body, hidden: false,
    createElement: name => element(name.toUpperCase()),
    querySelectorAll: () => [sourceElement] };
  const window = eventTarget();
  const api = loadTransition({
    ...time.globals, document, window, getComputedStyle: () => ({ backgroundColor: '#0f1115' }),
    getCurrentPages: () => current ? [current] : [],
    requestAnimationFrame(callback) { const id = ++frameId; frames.set(id, callback); return id; },
    cancelAnimationFrame: id => frames.delete(id),
    __importPage(specifier) {
      const request = { specifier, ...deferred() };
      imports.push(request);
      return request.promise;
    },
    uni: { switchTab: options => { calls.push(options); } }
  });
  return { ...api, time, imports, calls, frames, source, target, sourceElement, document, window,
    setPage: page => { current = page; },
    page: () => current,
    covers: () => body.children.filter(child => child.attributes.has('data-tab-transition-cover')),
    async paint() {
      const pending = [...frames.values()]; frames.clear();
      for (const callback of pending) callback();
      await drain();
    }
  };
}

function assertReleased(app) {
  assert.equal(app.covers().length, 0, '完成或取消后移除旧页快照');
  assert.equal(app.frames.size, 0, '不保留绘制回调');
  assert.equal(app.time.pending(), 0, '不保留超时任务');
  assert.equal(app.document.listenerCount() + app.window.listenerCount(), 0, '释放页面可见性监听');
}

async function beginCold(app, options = {}) {
  app.switchTabH5({ url: '/pages/mountain/mountain', ...options });
  app.imports.at(-1).resolve({});
  await drain();
  assert.equal(app.covers().length, 1);
  app.setPage(app.target);
}

async function testColdToWarm() {
  for (const readyFirst of [false, true]) {
    const app = runtime();
    app.switchTabH5({ url: '/pages/mountain/mountain' });
    await app.time.tick(100);
    assert.equal(app.calls.length, 0, '页面模块尚未加载时保留当前路由');
    assert.equal(app.page(), app.source);
    assert.equal(app.covers().length, 0, '模块等待阶段源页面保持实时显示');
    assert.equal(app.switchTabH5({ url: '/pages/index/index' }), false, '等待期间连点不启动并发切页');
    app.imports[0].resolve({}); await drain();
    assert.equal(app.calls.length, 1);
    const snapshot = app.covers()[0].children[0];
    assert.equal(snapshot.getAttribute('data-page'), null, '快照不冒充真实路由页面');
    assert.equal(snapshot.getAttribute('id'), null);
    assert.equal(snapshot.querySelectorAll('[id]').length, 0, '快照不干扰业务 ID 查询');
    assert.equal(snapshot.children[0].scrollTop, 384, '切页时保留旧页滚动位置');
    assert.equal(app.sourceElement.getAttribute('id'), 'source-page', '不改写真实页面属性');
    for (const type of ['wheel', 'touchmove', 'click']) {
      let prevented = false;
      app.covers()[0].emit(type, { preventDefault() { prevented = true; }, stopPropagation() {} });
      assert.equal(prevented, true, '过渡画面下的目标页不会被手势滚动');
    }
    app.setPage(app.target);
    if (readyFirst) app.h5TabTransitionMixin.onReady.call(app.target);
    else app.calls[0].success({});
    await drain();
    assert.equal(app.frames.size, 0, '路由成功和目标挂载缺一不可');
    assert.equal(app.covers().length, 1);
    if (readyFirst) app.calls[0].success({});
    else app.h5TabTransitionMixin.onReady.call(app.target);
    await drain();
    await app.paint();
    assert.equal(app.covers().length, 1, '首个绘制机会仍保留旧画面');
    await app.paint(); assertReleased(app);

    app.setPage(app.source);
    app.switchTabH5({ url: '/pages/mountain/mountain' });
    assert.equal(app.calls.length, 2, '再次进入已绘制页面直接切换');
    assert.equal(app.imports.length, 1);
    assert.equal(app.covers().length, 0, '已加载页面不冻结按钮和内容');
    app.setPage(app.target);
    app.h5TabTransitionMixin.onShow.call(app.target);
    app.calls[1].success({}); await drain(); assertReleased(app);
  }
}

async function testPendingModuleCancellation() {
  for (const reason of ['reject', 'timeout', 'cancel', 'hidden', 'pagehide', 'source-unload', 'other-page', 'source-replaced']) {
    const app = runtime(); let failures = 0;
    app.switchTabH5({ url: '/pages/mountain/mountain', fail: () => failures++ });
    if (reason === 'reject') app.imports[0].reject(new Error('offline'));
    if (reason === 'timeout') await app.time.tick(20000);
    if (reason === 'cancel') app.cancelH5TabTransition();
    if (reason === 'hidden') { app.document.hidden = true; app.document.emit('visibilitychange'); }
    if (reason === 'pagehide') app.window.emit('pagehide');
    if (reason === 'source-unload') app.h5TabTransitionMixin.onUnload.call(app.source);
    if (reason === 'other-page') {
      const other = { route: 'pages/profile/profile' }; app.setPage(other);
      app.h5TabTransitionMixin.onShow.call(other);
    }
    if (reason === 'source-replaced') app.setPage({ ...app.source });
    app.imports[0].resolve({}); await drain();
    assert.equal(app.calls.length, 0, `${reason}: 迟到模块结果不再导航`);
    assert.equal(failures, 1, `${reason}: 失败回调只执行一次，释放按钮状态`);
    assertReleased(app);
    app.setPage(app.source); app.document.hidden = false;
    app.switchTabH5({ url: '/pages/mountain/mountain' });
    assert.equal(app.imports.length, 2, `${reason}: 可以重新尝试切页`);
    app.cancelH5TabTransition(); assertReleased(app);
  }
}

async function testNavigationCleanup() {
  for (const reason of ['fail', 'timeout', 'cancel', 'hidden', 'target-unload', 'other-page']) {
    const app = runtime(); let failures = 0, successes = 0;
    await beginCold(app, { fail: () => failures++, success: () => successes++ });
    if (reason === 'fail') app.calls[0].fail({ errMsg: 'switchTab:fail offline' });
    if (reason === 'timeout') await app.time.tick(20000);
    if (reason === 'cancel') app.cancelH5TabTransition();
    if (reason === 'hidden') { app.document.hidden = true; app.document.emit('visibilitychange'); }
    if (reason === 'target-unload') app.h5TabTransitionMixin.onUnload.call(app.target);
    if (reason === 'other-page') {
      const other = { route: 'pages/profile/profile' }; app.setPage(other);
      app.h5TabTransitionMixin.onShow.call(other);
    }
    app.calls[0].success({});
    app.h5TabTransitionMixin.onReady.call(app.target);
    await drain(); await app.paint();
    assert.equal(failures, 1, `${reason}: 导航未成功时只报告一次失败`);
    assert.equal(successes, 0, `${reason}: 迟到成功不得反转失败状态`);
    assertReleased(app);
    app.document.hidden = false; app.setPage(app.source);
    app.switchTabH5({ url: '/pages/mountain/mountain' });
    assert.equal(app.imports.length, 2, `${reason}: 未交接首帧的目标不能误判为已加载`);
    app.cancelH5TabTransition(); assertReleased(app);
  }

  const app = runtime(); let failures = 0;
  await beginCold(app, { fail: () => failures++ });
  app.calls[0].success({});
  app.h5TabTransitionMixin.onReady.call(app.target); await drain();
  await app.paint(); app.cancelH5TabTransition(); await app.paint();
  assert.equal(failures, 0, '导航成功后取消交接不再报告路由失败');
  assertReleased(app);
}

async function testPageInstanceLifetime() {
  const app = runtime();
  const oldTicks = [], newTicks = [];
  const oldPage = { route: app.target.route, $nextTick: callback => oldTicks.push(callback) };
  const newPage = { route: app.target.route, $nextTick: callback => newTicks.push(callback) };
  await beginCold(app); app.calls[0].success({});
  app.setPage(oldPage); app.h5TabTransitionMixin.onReady.call(oldPage);
  app.setPage(newPage); app.h5TabTransitionMixin.onReady.call(newPage);
  app.h5TabTransitionMixin.onUnload.call(oldPage);
  oldTicks.forEach(callback => callback()); await drain();
  assert.equal(app.covers().length, 1, '旧实例迟到卸载不取消同路由的新实例交接');
  assert.equal(app.frames.size, 0, '旧实例 nextTick 不替新实例确认渲染');
  newTicks.forEach(callback => callback()); await drain();
  await app.paint(); await app.paint(); assertReleased(app);

  app.h5TabTransitionMixin.onUnload.call(newPage);
  app.setPage(app.source); app.switchTabH5({ url: '/pages/mountain/mountain' });
  assert.equal(app.imports.length, 2, '页面卸载后再次进入仍保护首帧');
  app.cancelH5TabTransition(); assertReleased(app);

  const replaced = runtime();
  replaced.h5TabTransitionMixin.onReady.call(replaced.target);
  const replacement = { ...replaced.target };
  replaced.h5TabTransitionMixin.onReady.call(replacement);
  replaced.h5TabTransitionMixin.onUnload.call(replaced.target);
  replaced.switchTabH5({ url: '/pages/mountain/mountain' });
  assert.equal(replaced.calls.length, 1, '旧实例卸载不删除同路由替代实例的就绪记录');
  assert.equal(replaced.imports.length, 0);
  replaced.cancelH5TabTransition(); assertReleased(replaced);
}

async function testReplacementDuringPaint() {
  const app = runtime(), ticks = [];
  await beginCold(app); app.calls[0].success({});
  app.h5TabTransitionMixin.onReady.call(app.target); await drain();
  const replacement = { route: app.target.route, $nextTick: callback => ticks.push(callback) };
  app.setPage(replacement); app.h5TabTransitionMixin.onReady.call(replacement);
  app.h5TabTransitionMixin.onUnload.call(app.target);
  await app.paint(); await app.paint();
  assert.equal(app.covers().length, 1, '旧实例已经排入的绘制回调不能提前交出新实例画面');
  ticks.forEach(callback => callback()); await drain();
  await app.paint(); await app.paint(); assertReleased(app);
}

async function testFallbackRoutes() {
  const app = runtime();
  const options = { url: '/pages/mountain/mountain' };
  app.setPage({ route: 'pages/login/login' });
  app.switchTabH5(options);
  assert.equal(app.calls[0], options, '登录/开屏等非 Tab 来源沿用原路由语义');
  assert.equal(app.imports.length, 0);
  assertReleased(app);
  app.setPage(app.source);
  assert.equal(app.switchTabH5({ url: '/pages/poem-square/poem-square' }), false, '重复点击当前 Tab 不发起导航');
  assert.equal(app.calls.length, 1);

  const noDom = loadTransition({
    getCurrentPages: () => [app.source],
    uni: { switchTab: received => received },
    __importPage: () => { throw new Error('unexpected module load without DOM'); }
  });
  assert.equal(noDom.switchTabH5(options), options, '无浏览器 DOM 时保持平台原有回调和返回值');
}

async function main() {
  for (const test of [testColdToWarm, testPendingModuleCancellation, testNavigationCleanup, testPageInstanceLifetime, testReplacementDuringPaint, testFallbackRoutes]) {
    await test(); console.log('PASS ' + test.name);
  }
}

if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { main };
