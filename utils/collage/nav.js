// 拼贴诗页面顶部导航的安全区适配。
// App 的 env(safe-area-inset-top) 可能为 0，使用系统返回的高度替换它，避免重复相加。
// 微信小程序另外避让右上角原生胶囊；H5 保留页面原有的 env() 布局。
import { getMenuButtonBoundingClientRectCompat, getWindowInfoCompat } from '@/utils/system-info.js';

const NAV_TOP_GAP = 4;
const DEFAULT_CAPSULE_AVOID_RIGHT = 100;
const DEFAULT_STATUS_BAR_HEIGHT = 24;

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function getCollageNavStyle() {
  // #ifdef APP-PLUS
  const appWindowInfo = getWindowInfoCompat() || {};
  const topInsets = [appWindowInfo.safeAreaInsets?.top, appWindowInfo.statusBarHeight]
    .filter(value => value != null && value !== '')
    .map(Number)
    .filter(value => Number.isFinite(value) && value >= 0);
  const safeTop = topInsets.length ? Math.max(...topInsets) : DEFAULT_STATUS_BAR_HEIGHT;
  return { '--collage-safe-top': `${safeTop}px` };
  // #endif

  // #ifdef MP-WEIXIN
  const windowInfo = getWindowInfoCompat() || {};
  const safeAreaInsets = windowInfo.safeAreaInsets || {};
  const statusBarHeight = toNumber(safeAreaInsets.top || windowInfo.statusBarHeight) || DEFAULT_STATUS_BAR_HEIGHT;
  const windowWidth = toNumber(windowInfo.windowWidth || windowInfo.screenWidth);
  const menuRect = getMenuButtonBoundingClientRectCompat() || {};
  const menuLeft = toNumber(menuRect.left);
  const capsuleAvoidRight = windowWidth > 0 && menuLeft > 0
    ? Math.max(DEFAULT_CAPSULE_AVOID_RIGHT, windowWidth - menuLeft + 8)
    : DEFAULT_CAPSULE_AVOID_RIGHT;
  return {
    '--collage-nav-top': `${statusBarHeight + NAV_TOP_GAP}px`,
    '--collage-capsule-right': `${capsuleAvoidRight}px`
  };
  // #endif

  // #ifndef APP-PLUS
  // #ifndef MP-WEIXIN
  return null;
  // #endif
  // #endif
}

export default getCollageNavStyle;
