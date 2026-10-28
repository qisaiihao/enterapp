// #ifdef H5
import { switchTabH5, cancelH5TabTransition } from '@/utils/h5TabTransition.js';
// #endif

// App-vue 首次 switchTab 会创建新的 WebView，用原生快照覆盖交接间隙。
// 已确认就绪的页面直接切换，避免再次截图冻结按钮动画。
// Native View.show 显示于所有 WebView 之上，不能 append 到即将隐藏的源页面。
const CAPTURE_BUDGET_MS = 350;
const COVER_BUDGET_MS = 2400;
const WARM_NAVIGATION_BUDGET_MS = 1200;
const COVER_SHOW_INTERVAL_MS = 16;
const COVER_SHOW_BUDGET_MS = 160;
const PAINT_RETRY_MS = 64;
const PAINT_HANDOFF_MS = 32;
let active = null;
let sequence = 0;
const readyPages = new WeakMap();
const readyRoutes = new Map();
const pendingPaintRoutes = new Set();

function routeOf(page) {
  return String(page?.route || page?.$page?.fullPath || page?.$scope?.route || '')
    .split('?')[0].replace(/^\//, '');
}

function currentPage() {
  const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
  return pages[pages.length - 1];
}

function pageRoute(page) {
  const nativePage = currentPage();
  return routeOf(page) || ((nativePage === page || nativePage?.$vm === page) ? routeOf(nativePage) : '');
}

function dispose(state) {
  if (!state || state.closed) return;
  state.closed = true;
  clearTimeout(state.captureTimer);
  clearTimeout(state.coverTimer);
  clearTimeout(state.showTimer);
  clearTimeout(state.probeTimer);
  clearTimeout(state.paintTimer);
  try { state.cover?.close(); } catch (_) {}
  try { state.bitmap?.recycle(); } catch (_) {}
  try { state.probeBitmap?.recycle(); } catch (_) {}
  if (active === state) active = null;
}

export function cancelTabTransition() {
  // #ifdef H5
  if (typeof window !== 'undefined' && typeof document !== 'undefined') cancelH5TabTransition();
  // #endif
  active?.abort({ errMsg: 'switchTab:fail cancelled' });
}

function finishWhenPainted(state) {
  if (!state || state.closed || !state.switched || !state.ready || state.paintTimer) return;
  if (state.warm) { dispose(state); return; }
  if (state.probePending || state.probeTimer) return;
  if (routeOf(currentPage()) !== state.target) { cancelTabTransition(); return; }

  // onReady/nextTick 只确认逻辑层挂载，不能证明原生 WebView 已画出首帧。
  // 用目标 WebView 自己的非空截图确认；全局 Native View 不属于它的截图内容。
  const retry = () => {
    if (state.closed) return;
    state.probePending = false;
    state.probeTimer = setTimeout(() => {
      state.probeTimer = null;
      finishWhenPainted(state);
    }, PAINT_RETRY_MS);
  };
  try {
    const webview = state.page?.$getAppWebview?.() || currentPage()?.$getAppWebview?.();
    if (!webview?.draw) { retry(); return; }
    state.probeBitmap ||= new state.native.Bitmap(`tab-ready-${state.id}`);
    state.probePending = true;
    webview.draw(state.probeBitmap, () => {
      if (state.closed) return;
      state.probePending = false;
      if (routeOf(currentPage()) !== state.target) { cancelTabTransition(); return; }
      pendingPaintRoutes.delete(state.target);
      readyRoutes.set(state.target, state.page);
      state.paintTimer = setTimeout(() => {
        state.paintTimer = null;
        dispose(state);
      }, PAINT_HANDOFF_MS);
    }, retry, { check: true });
  } catch (_) { retry(); }
}

function pageReady(page) {
  const state = active;
  if (!state || state.closed) return;
  const route = pageRoute(page);
  if (route !== state.target) return;
  state.page = page;
  const afterRender = () => {
    if (active !== state || state.closed || state.page !== page || !readyPages.has(page)) return;
    state.ready = true;
    finishWhenPainted(state);
  };
  if (typeof page.$nextTick === 'function') page.$nextTick(afterRender);
  else afterRender();
}

export const appTabTransitionMixin = {
  onReady() {
    const route = pageRoute(this);
    readyPages.set(this, route);
    // 超时/取消后的迟到 onReady 也不能把尚未确认画面的页面登记为可直接切入。
    if (route && !pendingPaintRoutes.has(route)) readyRoutes.set(route, this);
    pageReady(this);
  },
  onShow() {
    const route = pageRoute(this);
    if (active?.navigated && route && route !== active.target) { cancelTabTransition(); return; }
    if (readyPages.has(this)) pageReady(this);
  },
  onUnload() {
    const route = readyPages.get(this) || pageRoute(this);
    if (readyRoutes.get(route) === this) readyRoutes.delete(route);
    readyPages.delete(this);
    if (active?.target === route && (!active.page || active.page === this)) cancelTabTransition();
  },
  onBackPress() { cancelTabTransition(); }
};

export function switchTabSmooth(options) {
  // #ifdef H5
  if (typeof window !== 'undefined' && typeof document !== 'undefined') return switchTabH5(options);
  // #endif
  // #ifdef APP-PLUS
  const native = typeof plus !== 'undefined' && plus.nativeObj;
  const source = currentPage();
  let webview;
  try { webview = source?.$getAppWebview?.(); } catch (_) {}
  if (native?.Bitmap && native?.View && webview?.draw) {
    if (active) return false; // 窗口交接期间忽略连点，防止多次导航和快照互相覆盖。
    const target = routeOf({ route: options.url });
    if (routeOf(source) === target) return false;
    const state = { id: ++sequence, native, target, warm: readyRoutes.has(target), closed: false, navigated: false, ready: false, switched: false };
    if (!state.warm) pendingPaintRoutes.add(target);
    state.abort = error => {
      if (state.closed) return;
      dispose(state);
      if (!state.switched) options.fail?.(error);
    };
    active = state;
    const navigate = () => {
      if (state.closed || state.navigated) return;
      if (currentPage() !== source) { cancelTabTransition(); return; }
      state.navigated = true;
      clearTimeout(state.captureTimer);
      state.coverTimer = setTimeout(() => state.abort({ errMsg: 'switchTab:fail timeout' }),
        state.warm ? WARM_NAVIGATION_BUDGET_MS : COVER_BUDGET_MS);
      try {
        uni.switchTab({
          ...options,
          success: result => {
            if (state.closed) return;
            state.switched = true;
            finishWhenPainted(state);
            options.success?.(result);
          },
          fail: error => state.abort(error)
        });
      } catch (error) { state.abort(error); }
    };
    if (state.warm) {
      navigate();
      return;
    }
    const showCover = (captured) => {
      if (state.closed || state.captureDone) return;
      state.captureDone = true;
      clearTimeout(state.captureTimer);
      if (currentPage() !== source) { cancelTabTransition(); return; }
      try {
        const style = webview.getStyle?.() || {};
        const vm = source.$vm || source;
        const dark = vm.appThemeMode === 'dark';
        const coverStyle = {
          top: style.top || '0px', left: style.left || '0px', width: style.width || '100%',
          backgroundColor: vm.appThemeVars?.['--app-page-bg'] || (dark ? '#0f1115' : '#ffffff'),
          ...(style.height ? { height: style.height } : style.bottom != null ? { bottom: style.bottom } : { height: '100%' })
        };
        state.cover = new native.View(`tab-cover-${state.id}`, coverStyle);
        if (captured) {
          try { state.cover.drawBitmap(state.bitmap); } catch (_) { captured = false; }
        }
        if (!captured) {
          // 截图失败也保留有内容的主题色过渡，不能在慢设备上裸露新建的白色窗口。
          state.cover.drawText('正在打开…', { top: '45%', left: '0px', width: '100%', height: '44px' },
            { size: '14px', color: dark ? '#9ea6b2' : '#777777', align: 'center' });
        }
        state.cover.show();
        let waited = 0;
        const whenShown = () => {
          state.showTimer = null;
          if (state.closed) return;
          waited += COVER_SHOW_INTERVAL_MS;
          let visible = true;
          try { visible = state.cover.isVisible?.() !== false; } catch (_) {}
          if (visible) { navigate(); return; }
          if (waited >= COVER_SHOW_BUDGET_MS) {
            // 原生覆盖能力异常时仍允许路由；不要永久拦住用户。
            try { state.cover.close(); } catch (_) {}
            state.cover = null;
            navigate();
            return;
          }
          state.showTimer = setTimeout(whenShown, COVER_SHOW_INTERVAL_MS);
        };
        // show() 无完成回调，先让出一次原生提交，再检查显示状态。
        state.showTimer = setTimeout(whenShown, COVER_SHOW_INTERVAL_MS);
      } catch (_) {
        try { state.cover?.close(); } catch (_) {}
        state.cover = null;
        navigate();
      }
    };
    state.captureTimer = setTimeout(() => showCover(false), CAPTURE_BUDGET_MS);
    try {
      state.bitmap = new native.Bitmap(`tab-frame-${state.id}`);
      webview.draw(state.bitmap, () => {
        showCover(true);
      }, () => showCover(false), { check: true });
    } catch (_) { showCover(false); }
    return;
  }
  // #endif
  return uni.switchTab(options);
}
