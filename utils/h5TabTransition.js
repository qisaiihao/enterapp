// H5 的路由成功回调早于异步页面组件挂载。先准备模块，再保留旧页画面交接首帧。
const loaders = {
  'pages/index/index': () => import('@/pages/index/index.vue'),
  'pages/poem-square/poem-square': () => import('@/pages/poem-square/poem-square.vue'),
  'pages/mountain/mountain': () => import('@/pages/mountain/mountain.vue'),
  'pages/profile/profile': () => import('@/pages/profile/profile.vue')
};
const readyPages = new WeakMap();
const readyRoutes = new Map();
const pendingRoutes = new Set();
let active = null;

function routeOf(page) {
  return String(page?.route || page?.$page?.fullPath || page?.$scope?.route || '')
    .split('?')[0].replace(/^\//, '');
}

function currentPage() {
  const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
  return pages[pages.length - 1];
}

function pageRoute(page) {
  const current = currentPage();
  return routeOf(page) || ((current === page || current?.$vm === page) ? routeOf(current) : '');
}

function release(state) {
  if (!state || state.closed) return;
  state.closed = true;
  clearTimeout(state.timer);
  if (state.frame != null) cancelAnimationFrame(state.frame);
  state.cover?.remove();
  document.removeEventListener('visibilitychange', state.onVisibility);
  window.removeEventListener('pagehide', state.abort);
  if (active === state) active = null;
}

export function cancelH5TabTransition() {
  active?.abort({ errMsg: 'switchTab:fail cancelled' });
}

function finishWhenReady(state) {
  if (state.closed || !state.switched || !state.ready || state.frame != null) return;
  if (state.warm) { release(state); return; }
  // 第一次 RAF 让目标进入本帧布局/绘制，第二次才交出旧画面。
  state.frame = requestAnimationFrame(() => {
    state.frame = requestAnimationFrame(() => {
      state.frame = null;
      if (active !== state || state.closed) return;
      if (routeOf(currentPage()) !== state.target || !readyPages.has(state.page)) {
        cancelH5TabTransition();
        return;
      }
      pendingRoutes.delete(state.target);
      readyRoutes.set(state.target, state.page);
      release(state);
    });
  });
}

function pageReady(page) {
  const state = active;
  if (!state || state.closed || pageRoute(page) !== state.target) return;
  if (state.page !== page) {
    state.ready = false;
    if (state.frame != null) cancelAnimationFrame(state.frame);
    state.frame = null;
  }
  state.page = page;
  const rendered = () => {
    if (active !== state || state.closed || state.page !== page || !readyPages.has(page)) return;
    state.ready = true;
    finishWhenReady(state);
  };
  if (typeof page.$nextTick === 'function') page.$nextTick(rendered);
  else rendered();
}

export const h5TabTransitionMixin = {
  onReady() {
    const route = pageRoute(this);
    readyPages.set(this, route);
    if (route && !pendingRoutes.has(route)) readyRoutes.set(route, this);
    pageReady(this);
  },
  onShow() {
    const route = pageRoute(this);
    if (active && route && route !== (active.navigated ? active.target : active.sourceRoute)) {
      cancelH5TabTransition();
      return;
    }
    if (readyPages.has(this)) pageReady(this);
  },
  onUnload() {
    const route = readyPages.get(this) || pageRoute(this);
    if (readyRoutes.get(route) === this) readyRoutes.delete(route);
    readyPages.delete(this);
    if (active && ((active.target === route && (!active.page || active.page === this)) ||
      (!active.navigated && active.sourceRoute === route))) {
      cancelH5TabTransition();
    }
  }
};

function createCover(sourceRoute) {
  const source = Array.from(document.querySelectorAll('uni-page[data-page]'))
    .find(node => node.getAttribute('data-page') === sourceRoute && node.getBoundingClientRect().height > 0);
  if (!source) return null;
  const cover = document.createElement('div');
  cover.setAttribute('data-tab-transition-cover', '');
  cover.setAttribute('aria-hidden', 'true');
  cover.style.cssText = 'position:fixed;inset:0;overflow:hidden;z-index:2147483000;pointer-events:auto;touch-action:none;';
  const blockScroll = event => { event.preventDefault(); event.stopPropagation(); };
  cover.addEventListener('wheel', blockScroll, { passive: false });
  cover.addEventListener('touchmove', blockScroll, { passive: false });
  // 兼容不支持 inert 的旧浏览器，复制出的链接也不能触发默认导航。
  cover.addEventListener('click', blockScroll, true);
  cover.style.background = getComputedStyle(document.body).backgroundColor;
  const snapshot = source.cloneNode(true);
  snapshot.inert = true;
  // 快照不参与路由/业务选择器，也不复制监听器或创建页面实例。
  snapshot.removeAttribute('data-page');
  snapshot.removeAttribute('id');
  snapshot.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
  const sourceRect = source.getBoundingClientRect();
  snapshot.style.cssText += `;position:absolute;top:${sourceRect.top}px;left:${sourceRect.left}px;width:${sourceRect.width}px;height:${sourceRect.height}px;margin:0;`;
  cover.appendChild(snapshot);
  document.body.appendChild(cover);
  const originals = [source, ...source.querySelectorAll('*')];
  const copies = [snapshot, ...snapshot.querySelectorAll('*')];
  originals.forEach((node, index) => {
    const copy = copies[index];
    copy.scrollTop = node.scrollTop;
    copy.scrollLeft = node.scrollLeft;
    if (node.tagName === 'CANVAS') {
      try { copy.getContext('2d')?.drawImage(node, 0, 0); } catch (_) {}
    }
  });
  return cover;
}

export function switchTabH5(options) {
  const target = routeOf({ route: options.url });
  const source = currentPage();
  if (!loaders[target] || !loaders[routeOf(source)] || typeof document === 'undefined') return uni.switchTab(options);
  if (active || routeOf(source) === target) return false;
  const state = { target, sourceRoute: routeOf(source), warm: readyRoutes.has(target), closed: false,
    navigated: false, switched: false, ready: false, frame: null };
  if (!state.warm) pendingRoutes.add(target);
  state.abort = error => {
    if (state.closed) return;
    release(state);
    if (!state.switched) options.fail?.(error?.errMsg ? error : { errMsg: 'switchTab:fail cancelled' });
  };
  state.onVisibility = () => { if (document.hidden) state.abort(); };
  active = state;
  document.addEventListener('visibilitychange', state.onVisibility);
  window.addEventListener('pagehide', state.abort);
  const navigate = () => {
    if (active !== state || state.closed) return;
    if (currentPage() !== source) { state.abort(); return; }
    clearTimeout(state.timer);
    try {
      if (!state.warm) state.cover = createCover(state.sourceRoute);
      state.navigated = true;
      state.timer = setTimeout(() => state.abort({ errMsg: 'switchTab:fail timeout' }), 2400);
      uni.switchTab({
        ...options,
        success: result => {
          if (state.closed) return;
          state.switched = true;
          finishWhenReady(state);
          options.success?.(result);
        },
        fail: error => state.abort(error)
      });
    } catch (error) { state.abort(error); }
  };
  if (state.warm) { navigate(); return; }
  // 加载失败/超时停留原页，迟到的模块下载结果不得再触发导航。
  state.timer = setTimeout(() => state.abort({ errMsg: 'switchTab:fail page preload timeout' }), 8000);
  loaders[target]().then(navigate, error => state.abort({ errMsg: `switchTab:fail page preload: ${error.message || error}` }));
}
