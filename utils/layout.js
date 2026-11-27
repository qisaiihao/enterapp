import { getStatusBarHeightCompat, getWindowInfoCompat } from './system-info.js';

const LAYOUT_CHANGED_EVENT = 'layout:changed';

const RPX_CALC_MAX_DEVICE_WIDTH = 500;
const RPX_CALC_BASE_DEVICE_WIDTH = 400;
const RPX_CALC_INCLUDE_WIDTH = 750;

const MEDIUM_MIN_WIDTH = 600;
const EXPANDED_MIN_WIDTH = 840;
const DETAIL_SPLIT_MIN_WIDTH = 720;
const SHORT_LANDSCAPE_MAX_HEIGHT = 500;
// 行业通用的大屏短边阈值（略低于 sw600dp 以兼容全部折叠屏展开态，远高于直板手机 360-440px）
const LARGE_SCREEN_MIN_EDGE = 560;

const NAV_RAIL_WIDTH_MEDIUM = 80;
const NAV_RAIL_WIDTH_EXPANDED = 156;

let cachedSnapshot = null;
let listenerInstalled = false;
let resizeTimer = null;
let lastOrientationLockState = '';
const localListeners = new Set();

function isMpWeixinRuntime() {
  // #ifdef MP-WEIXIN
  return true;
  // #endif
  return false;
}

function toFiniteNonNegative(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function toPositiveNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function resolveSafeAreaInsets(rawInfo = {}, windowWidth = 375, windowHeight = 667) {
  const statusBarTop = toFiniteNonNegative(rawInfo.statusBarHeight, 0);
  const isShortLandscape = windowWidth > windowHeight && windowHeight < SHORT_LANDSCAPE_MAX_HEIGHT;
  const resolveTop = (candidateTop) => {
    const parsed = toFiniteNonNegative(candidateTop, NaN);
    if (!Number.isFinite(parsed)) {
      return statusBarTop;
    }
    // 手机横屏隐藏状态栏时保留 0；其余场景防止 safeAreaInsets.top 为 0 或偏小导致内容顶进状态栏
    if (parsed === 0 && isShortLandscape) {
      return 0;
    }
    return Math.max(parsed, statusBarTop);
  };

  const insets = rawInfo.safeAreaInsets;
  if (insets && typeof insets === 'object') {
    const top = resolveTop(insets.top);
    const right = toFiniteNonNegative(insets.right, 0);
    const bottom = toFiniteNonNegative(insets.bottom, 0);
    const left = toFiniteNonNegative(insets.left, 0);
    return { top, right, bottom, left };
  }

  const safeArea = rawInfo.safeArea;
  if (safeArea && typeof safeArea === 'object') {
    const top = resolveTop(safeArea.top);
    const left = toFiniteNonNegative(safeArea.left, 0);
    const saRight = toPositiveNumber(safeArea.right, 0);
    const saBottom = toPositiveNumber(safeArea.bottom, 0);
    const right = saRight > 0 && windowWidth > 0 ? Math.max(0, windowWidth - saRight) : 0;
    const bottom = saBottom > 0 && windowHeight > 0 ? Math.max(0, windowHeight - saBottom) : 0;
    return { top, right, bottom, left };
  }

  let fallbackTop = statusBarTop;
  if (!fallbackTop) {
    try {
      fallbackTop = toFiniteNonNegative(getStatusBarHeightCompat(), 0);
    } catch (_) {
      fallbackTop = 0;
    }
  }
  return { top: fallbackTop, right: 0, bottom: 0, left: 0 };
}

function readRawWindowInfo(override = null) {
  if (override && typeof override === 'object') {
    return override;
  }

  let compatInfo = {};
  try {
    compatInfo = getWindowInfoCompat() || {};
  } catch (_) {
    compatInfo = {};
  }

  // H5 / 浏览器窗口尺寸在视口缩放或旋转时以 window.innerWidth 为实时基准
  if (typeof window !== 'undefined' && toPositiveNumber(window.innerWidth, 0) > 0) {
    return Object.assign({}, compatInfo, {
      windowWidth: window.innerWidth,
      windowHeight: toPositiveNumber(window.innerHeight, toPositiveNumber(compatInfo.windowHeight, 667))
    });
  }

  return compatInfo;
}

function buildLayoutSnapshot(rawInfo = null, options = {}) {
  const info = readRawWindowInfo(rawInfo);
  const windowWidth = Math.round(
    toPositiveNumber(info.windowWidth, toPositiveNumber(info.screenWidth, 375))
  );
  const windowHeight = Math.round(
    toPositiveNumber(info.windowHeight, toPositiveNumber(info.screenHeight, 667))
  );

  const safeAreaInsets = resolveSafeAreaInsets(info, windowWidth, windowHeight);
  const screenWidth = Math.round(toPositiveNumber(info.screenWidth, windowWidth));
  const screenHeight = Math.round(toPositiveNumber(info.screenHeight, windowHeight));
  const minWindowEdge = Math.min(windowWidth, windowHeight);
  const minScreenEdge = Math.min(screenWidth, screenHeight);
  const isLargeScreenDevice = Math.max(minScreenEdge, minWindowEdge) >= LARGE_SCREEN_MIN_EDGE;

  const isLandscape = windowWidth > windowHeight;
  const isShortLandscape = isLandscape && windowHeight < SHORT_LANDSCAPE_MAX_HEIGHT;

  let sizeClass = 'compact';
  if (windowWidth >= EXPANDED_MIN_WIDTH) {
    sizeClass = 'expanded';
  } else if (windowWidth >= MEDIUM_MIN_WIDTH) {
    sizeClass = 'medium';
  }

  const isCompact = sizeClass === 'compact';
  const isMedium = sizeClass === 'medium';
  const isExpanded = sizeClass === 'expanded';
  const isWide = !isCompact;
  const isSplitDetail = windowWidth >= DETAIL_SPLIT_MIN_WIDTH && !isShortLandscape;

  const mpWeixin = typeof options.mpWeixin === 'boolean' ? options.mpWeixin : isMpWeixinRuntime();
  let navMode = 'bottom';
  if (!mpWeixin && isWide) {
    navMode = (isExpanded && !isShortLandscape) ? 'sidebar' : 'rail';
  }

  let navRailInnerWidth = 0;
  if (navMode === 'sidebar') {
    navRailInnerWidth = NAV_RAIL_WIDTH_EXPANDED;
  } else if (navMode === 'rail') {
    navRailInnerWidth = NAV_RAIL_WIDTH_MEDIUM;
  }

  const navRailWidth = navRailInnerWidth > 0 ? navRailInnerWidth + safeAreaInsets.left : 0;
  const contentWidth = Math.max(0, windowWidth - navRailWidth - safeAreaInsets.right);
  const feedColumns = isWide ? 2 : 1;
  const poemColumns = isWide ? 2 : 1;
  const activityColumns = isExpanded ? 3 : (isMedium ? 2 : 1);
  const contentMaxWidth = isExpanded ? 840 : (isMedium ? 720 : windowWidth);

  return Object.freeze({
    windowWidth,
    windowHeight,
    screenWidth,
    screenHeight,
    isLargeScreenDevice,
    isLandscape,
    isShortLandscape,
    sizeClass,
    isCompact,
    isMedium,
    isExpanded,
    isWide,
    isSplitDetail,
    navMode,
    navRailInnerWidth,
    navRailWidth,
    contentWidth,
    feedColumns,
    poemColumns,
    activityColumns,
    contentMaxWidth,
    safeAreaInsets: Object.freeze(safeAreaInsets)
  });
}

function isSameSnapshot(a, b) {
  if (!a || !b) return false;
  return (
    a.windowWidth === b.windowWidth &&
    a.windowHeight === b.windowHeight &&
    a.sizeClass === b.sizeClass &&
    a.navMode === b.navMode &&
    a.safeAreaInsets.top === b.safeAreaInsets.top &&
    a.safeAreaInsets.right === b.safeAreaInsets.right &&
    a.safeAreaInsets.bottom === b.safeAreaInsets.bottom &&
    a.safeAreaInsets.left === b.safeAreaInsets.left
  );
}

function rpxToPx(value, windowWidth) {
  const n = Number(value);
  if (!Number.isFinite(n) || n === 0) {
    return 0;
  }
  const width = toPositiveNumber(windowWidth, getLayoutSnapshot().windowWidth || 375);
  const effectiveWidth =
    n === RPX_CALC_INCLUDE_WIDTH || width <= RPX_CALC_MAX_DEVICE_WIDTH
      ? width
      : RPX_CALC_BASE_DEVICE_WIDTH;
  return (n / 750) * effectiveWidth;
}

function getLayoutCssVars(snapshot = getLayoutSnapshot()) {
  const safe = snapshot.safeAreaInsets || { top: 0, right: 0, bottom: 0, left: 0 };
  return {
    '--app-safe-area-top': `${safe.top}px`,
    '--app-safe-area-right': `${safe.right}px`,
    '--app-safe-area-bottom': `${safe.bottom}px`,
    '--app-safe-area-left': `${safe.left}px`,
    '--safe-area-inset-top': `${safe.top}px`,
    '--safe-area-inset-right': `${safe.right}px`,
    '--safe-area-inset-bottom': `${safe.bottom}px`,
    '--safe-area-inset-left': `${safe.left}px`,
    '--status-bar-height': `${safe.top}px`,
    '--app-window-width': `${snapshot.windowWidth}px`,
    '--app-window-height': `${snapshot.windowHeight}px`,
    '--app-nav-rail-width': `${snapshot.navRailWidth}px`,
    '--app-nav-rail-inner-width': `${snapshot.navRailInnerWidth}px`,
    '--app-content-width': `${snapshot.contentWidth}px`,
    '--app-content-max-width': `${snapshot.contentMaxWidth}px`,
    '--app-feed-columns': String(snapshot.feedColumns),
    '--app-poem-columns': String(snapshot.poemColumns),
    '--app-activity-columns': String(snapshot.activityColumns)
  };
}

function applyLayoutToDocument(snapshot = getLayoutSnapshot()) {
  if (typeof document === 'undefined' || !document.documentElement) {
    return;
  }
  try {
    const root = document.documentElement;
    root.setAttribute('data-layout-size', snapshot.sizeClass);
    root.setAttribute('data-nav-mode', snapshot.navMode);
    root.setAttribute('data-landscape', snapshot.isLandscape ? 'true' : 'false');
    root.setAttribute('data-short-landscape', snapshot.isShortLandscape ? 'true' : 'false');
    const vars = getLayoutCssVars(snapshot);
    Object.keys(vars).forEach((key) => {
      root.style.setProperty(key, vars[key]);
    });
  } catch (_) {}
}

function getLayoutSnapshot() {
  if (!cachedSnapshot) {
    cachedSnapshot = buildLayoutSnapshot();
    applyLayoutToDocument(cachedSnapshot);
  }
  return cachedSnapshot;
}

function notifyLayoutChange(snapshot) {
  localListeners.forEach((listener) => {
    try {
      listener(snapshot);
    } catch (_) {}
  });
  try {
    if (typeof uni !== 'undefined' && typeof uni.$emit === 'function') {
      uni.$emit(LAYOUT_CHANGED_EVENT, snapshot);
    }
  } catch (_) {}
}

function syncDeviceOrientationLock(snapshot = getLayoutSnapshot(), options = {}) {
  if (!snapshot) return '';
  const desired = snapshot.isLargeScreenDevice ? 'unlocked' : 'portrait';
  if (!options.force && lastOrientationLockState === desired) {
    return desired;
  }

  // #ifdef APP-PLUS
  try {
    if (typeof plus !== 'undefined' && plus && plus.screen) {
      if (desired === 'portrait' && typeof plus.screen.lockOrientation === 'function') {
        plus.screen.lockOrientation('portrait-primary');
        lastOrientationLockState = desired;
        return desired;
      }
      if (desired === 'unlocked' && typeof plus.screen.unlockOrientation === 'function') {
        plus.screen.unlockOrientation();
        lastOrientationLockState = desired;
        return desired;
      }
    }
  } catch (_) {}
  // #endif

  return '';
}

function refreshLayoutSnapshot(override = null, options = {}) {
  const next = buildLayoutSnapshot(override, options);
  const changed = !isSameSnapshot(cachedSnapshot, next);
  cachedSnapshot = next;
  applyLayoutToDocument(next);
  syncDeviceOrientationLock(next);
  if (changed || options.force) {
    notifyLayoutChange(next);
  }
  return next;
}

function scheduleLayoutRefresh(override = null) {
  if (resizeTimer) {
    clearTimeout(resizeTimer);
  }
  resizeTimer = setTimeout(() => {
    resizeTimer = null;
    refreshLayoutSnapshot(override);
  }, 32);
}

function installLayoutListener() {
  const initial = refreshLayoutSnapshot();
  if (listenerInstalled) {
    return initial;
  }
  listenerInstalled = true;

  try {
    if (typeof uni !== 'undefined' && typeof uni.onWindowResize === 'function') {
      uni.onWindowResize((res) => {
        const size = res && res.size ? res.size : res;
        if (size && toPositiveNumber(size.windowWidth, 0) > 0) {
          const base = readRawWindowInfo();
          refreshLayoutSnapshot(Object.assign({}, base, {
            windowWidth: size.windowWidth,
            windowHeight: toPositiveNumber(size.windowHeight, base.windowHeight || 667)
          }));
        } else {
          refreshLayoutSnapshot();
        }
      });
    }
  } catch (_) {}

  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('resize', () => {
      scheduleLayoutRefresh();
    });
    window.addEventListener('orientationchange', () => {
      scheduleLayoutRefresh();
      setTimeout(() => refreshLayoutSnapshot(), 120);
    });
  }

  return initial;
}

function subscribeLayoutChange(listener) {
  if (typeof listener !== 'function') {
    return () => {};
  }
  localListeners.add(listener);
  return () => {
    localListeners.delete(listener);
  };
}

function resetLayoutStateForTest() {
  cachedSnapshot = null;
  listenerInstalled = false;
  lastOrientationLockState = '';
  if (resizeTimer) {
    clearTimeout(resizeTimer);
    resizeTimer = null;
  }
  localListeners.clear();
}

export {
  LAYOUT_CHANGED_EVENT,
  RPX_CALC_MAX_DEVICE_WIDTH,
  RPX_CALC_BASE_DEVICE_WIDTH,
  RPX_CALC_INCLUDE_WIDTH,
  MEDIUM_MIN_WIDTH,
  EXPANDED_MIN_WIDTH,
  DETAIL_SPLIT_MIN_WIDTH,
  LARGE_SCREEN_MIN_EDGE,
  NAV_RAIL_WIDTH_MEDIUM,
  NAV_RAIL_WIDTH_EXPANDED,
  buildLayoutSnapshot,
  getLayoutSnapshot,
  getLayoutCssVars,
  applyLayoutToDocument,
  syncDeviceOrientationLock,
  refreshLayoutSnapshot,
  installLayoutListener,
  subscribeLayoutChange,
  rpxToPx,
  resetLayoutStateForTest
};

export default {
  LAYOUT_CHANGED_EVENT,
  RPX_CALC_MAX_DEVICE_WIDTH,
  RPX_CALC_BASE_DEVICE_WIDTH,
  RPX_CALC_INCLUDE_WIDTH,
  MEDIUM_MIN_WIDTH,
  EXPANDED_MIN_WIDTH,
  DETAIL_SPLIT_MIN_WIDTH,
  LARGE_SCREEN_MIN_EDGE,
  NAV_RAIL_WIDTH_MEDIUM,
  NAV_RAIL_WIDTH_EXPANDED,
  buildLayoutSnapshot,
  getLayoutSnapshot,
  getLayoutCssVars,
  applyLayoutToDocument,
  syncDeviceOrientationLock,
  refreshLayoutSnapshot,
  installLayoutListener,
  subscribeLayoutChange,
  rpxToPx,
  resetLayoutStateForTest
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    LAYOUT_CHANGED_EVENT,
    RPX_CALC_MAX_DEVICE_WIDTH,
    RPX_CALC_BASE_DEVICE_WIDTH,
    RPX_CALC_INCLUDE_WIDTH,
    MEDIUM_MIN_WIDTH,
    EXPANDED_MIN_WIDTH,
    DETAIL_SPLIT_MIN_WIDTH,
    LARGE_SCREEN_MIN_EDGE,
    NAV_RAIL_WIDTH_MEDIUM,
    NAV_RAIL_WIDTH_EXPANDED,
    buildLayoutSnapshot,
    getLayoutSnapshot,
    getLayoutCssVars,
    applyLayoutToDocument,
    syncDeviceOrientationLock,
    refreshLayoutSnapshot,
    installLayoutListener,
    subscribeLayoutChange,
    rpxToPx,
    resetLayoutStateForTest
  };
}
