// App-vue 首次 switchTab 会创建新的 WebView。用当前画面的原生快照
// 覆盖窗口交接间隙，目标页 onReady / 已挂载页 onShow 后再移除。
// Native View.show 显示于所有 WebView 之上，不能 append 到即将隐藏的源页面。
const CAPTURE_BUDGET_MS = 100;
const COVER_BUDGET_MS = 1200;
const PAINT_DELAY_MS = 80;
let active = null;
let sequence = 0;
const readyPages = new WeakSet();

function routeOf(page) {
  return String(page?.route || page?.$page?.fullPath || page?.$scope?.route || '')
    .split('?')[0].replace(/^\//, '');
}

function currentPage() {
  const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
  return pages[pages.length - 1];
}

function dispose(state) {
  if (!state || state.closed) return;
  state.closed = true;
  clearTimeout(state.captureTimer);
  clearTimeout(state.coverTimer);
  clearTimeout(state.paintTimer);
  try { state.cover?.close(); } catch (_) {}
  try { state.bitmap?.recycle(); } catch (_) {}
  if (active === state) active = null;
}

export function cancelTabTransition() {
  dispose(active);
}

function finishWhenPainted(state) {
  if (!state || state.closed || !state.switched || !state.ready || state.paintTimer) return;
  state.paintTimer = setTimeout(() => dispose(state), PAINT_DELAY_MS);
}

function pageReady(page) {
  const state = active;
  if (!state || state.closed) return;
  const nativePage = currentPage();
  const route = routeOf(page) || ((nativePage === page || nativePage?.$vm === page) ? routeOf(nativePage) : '');
  if (route !== state.target) return;
  const afterRender = () => {
    if (active !== state || state.closed) return;
    state.ready = true;
    finishWhenPainted(state);
  };
  if (typeof page.$nextTick === 'function') page.$nextTick(afterRender);
  else afterRender();
}

export const appTabTransitionMixin = {
  onReady() { readyPages.add(this); pageReady(this); },
  onShow() { if (readyPages.has(this)) pageReady(this); },
  onUnload() { readyPages.delete(this); },
  onBackPress() { cancelTabTransition(); }
};

export function switchTabSmooth(options) {
  // #ifdef APP-PLUS
  const native = typeof plus !== 'undefined' && plus.nativeObj;
  const source = currentPage();
  let webview;
  try { webview = source?.$getAppWebview?.(); } catch (_) {}
  if (native?.Bitmap && native?.View && webview?.draw) {
    if (active) return false; // 窗口交接期间忽略连点，防止多次导航和快照互相覆盖。
    const target = String(options.url || '').replace(/^\//, '');
    if (routeOf(source) === target) return false;
    const state = { target, closed: false, navigated: false, ready: false, switched: false };
    active = state;
    const navigate = () => {
      if (state.closed || state.navigated) return;
      if (currentPage() !== source) { dispose(state); return; }
      state.navigated = true;
      clearTimeout(state.captureTimer);
      state.coverTimer = setTimeout(() => dispose(state), COVER_BUDGET_MS);
      try {
        uni.switchTab({
          ...options,
          success: result => {
            state.switched = true;
            finishWhenPainted(state);
            options.success?.(result);
          },
          fail: error => { dispose(state); options.fail?.(error); }
        });
      } catch (error) { dispose(state); options.fail?.(error); }
    };
    const fallback = () => {
      // 截图失败/过慢不拖住用户。迟到的截图不能再次显示或导航。
      try { state.cover?.close(); } catch (_) {}
      try { state.bitmap?.recycle(); } catch (_) {}
      state.cover = null;
      state.bitmap = null;
      navigate();
    };
    state.captureTimer = setTimeout(fallback, CAPTURE_BUDGET_MS);
    try {
      state.bitmap = new native.Bitmap(`tab-frame-${++sequence}`);
      webview.draw(state.bitmap, () => {
        if (state.closed || state.navigated) return;
        if (currentPage() !== source) { dispose(state); return; }
        try {
          const style = webview.getStyle?.() || {};
          state.cover = new native.View(`tab-cover-${sequence}`, {
            top: style.top || '0px', left: style.left || '0px',
            width: style.width || '100%', height: style.height || '100%'
          });
          state.cover.drawBitmap(state.bitmap);
          state.cover.show();
          navigate();
        } catch (_) { fallback(); }
      }, () => { if (!state.closed && !state.navigated) fallback(); }, { check: true });
    } catch (_) { fallback(); }
    return;
  }
  // #endif
  return uni.switchTab(options);
}
