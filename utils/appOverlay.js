// 业务确认框与操作菜单适配器。原生权限授权不经过此模块。
const pages = new Map();
let installed = false;
let nativeModal;
let nativeSheet;
let activeOwner = null;

export function isDangerousOverlayAction(text = '') {
  return /删除|清空|移除|解绑|拉黑|注销/.test(text);
}

function currentOwner() {
  if (activeOwner) return activeOwner;
  const stack = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
  const page = stack[stack.length - 1];
  return page && (page.$vm || page);
}

function pageState(owner) {
  if (!pages.has(owner)) pages.set(owner, { requests: [], render: null, dismissers: [] });
  return pages.get(owner);
}

function render(state) {
  if (state.render) state.render(state.requests[0] || null);
}

function callback(fn, value) {
  if (typeof fn !== 'function') return;
  try {
    Promise.resolve(fn(value)).catch(error => console.error('[app-overlay] callback failed', error));
  } catch (error) {
    console.error('[app-overlay] callback failed', error);
  }
}

function finish(owner, request, result, failed = false) {
  const state = pages.get(owner);
  if (!state || !state.requests.includes(request)) return;
  state.requests.splice(state.requests.indexOf(request), 1);
  render(state);
  callback(failed ? request.options.fail : request.options.success, result);
  callback(request.options.complete, result);
  if (failed) request.reject?.(result);
  else request.resolve?.(result);
}

function requestOverlay(kind, options = {}) {
  const owner = currentOwner();
  const stack = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
  const route = owner?.route || stack[stack.length - 1]?.route || '';
  // 启动阶段还没有页面视图时，保留平台兜底。
  if (!owner || route.startsWith('uni_modules/')) return (kind === 'dialog' ? nativeModal : nativeSheet)(options);
  const state = pageState(owner);
  const request = { kind, options: { ...options } };
  const hasCallbacks = ['success', 'fail', 'complete'].some(key => typeof options[key] === 'function');
  const promise = hasCallbacks ? undefined : new Promise((resolve, reject) => {
    request.resolve = resolve;
    request.reject = reject;
  });
  state.requests.push(request);
  render(state);
  return promise;
}

export function installAppOverlays() {
  if (installed) return;
  installed = true;
  nativeModal = uni.showModal.bind(uni);
  nativeSheet = uni.showActionSheet.bind(uni);
  uni.showModal = options => requestOverlay('dialog', options);
  uni.showActionSheet = options => requestOverlay('sheet', options);
}

export function registerOverlayHost(owner, update) {
  const state = pageState(owner);
  state.render = update;
  render(state);
  return () => { if (state.render === update) state.render = null; };
}

export function resolveOverlayOwner(component) {
  const stack = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
  let parent = component;
  while (parent) {
    // 新页面 mounted 时，部分平台的 getCurrentPages 仍停留在上一页。
    if (parent.$mpType === 'page' || parent.$options?.mpType === 'page') return parent;
    const page = stack.find(item => item.$vm === parent || item === parent);
    if (page) return page.$vm || page;
    parent = parent.$parent;
  }
  return currentOwner();
}

export function answerOverlay(owner, request, action, content = '') {
  if (!request) return;
  if (request.kind === 'sheet') {
    const cancelled = action === 'cancel';
    finish(owner, request, cancelled
      ? { errMsg: 'showActionSheet:fail cancel' }
      : { errMsg: 'showActionSheet:ok', tapIndex: action }, cancelled);
  } else {
    finish(owner, request, {
      errMsg: 'showModal:ok', confirm: action === 'confirm', cancel: action !== 'confirm', content
    });
  }
}

export function registerOverlayDismiss(owner, dismiss) {
  const state = pageState(owner);
  state.dismissers.push(dismiss);
  return () => {
    const index = state.dismissers.indexOf(dismiss);
    if (index >= 0) state.dismissers.splice(index, 1);
  };
}

export function dismissCurrentOverlay() {
  const state = pages.get(currentOwner());
  const dismiss = state && state.dismissers[state.dismissers.length - 1];
  if (!dismiss) return false;
  dismiss();
  return true;
}

export function closePageOverlays(owner, unload = false) {
  const state = pages.get(owner);
  if (!state) return;
  for (const request of state.requests.slice()) {
    finish(owner, request, {
      errMsg: `${request.kind === 'dialog' ? 'showModal' : 'showActionSheet'}:fail page closed`
    }, true);
  }
  if (unload) pages.delete(owner);
}

export const appOverlayPageMixin = {
  onLoad() { activeOwner = this; },
  onShow() { activeOwner = this; },
  onHide() {
    if (activeOwner === this) activeOwner = null;
    closePageOverlays(this);
  },
  onUnload() {
    if (activeOwner === this) activeOwner = null;
    closePageOverlays(this, true);
  },
  onBackPress(event = {}) {
    // 弹窗回调可能在组件卸载前主动返回；只拦截用户返回键。
    if (event.from === 'navigateBack') return;
    if (dismissCurrentOverlay()) {
      event.appOverlayHandled = true;
      return true;
    }
  }
};
