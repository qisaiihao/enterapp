// 拼贴诗页面顶部导航的小程序适配。
// 微信小程序右上角是原生胶囊按钮，状态栏高度也不能只依赖 env()，
// 这里统一读取状态栏和胶囊位置，页面通过 CSS 变量避让；
// 其他端返回 null，页面保持原有布局。
import { getMenuButtonBoundingClientRectCompat, getWindowInfoCompat } from '@/utils/system-info.js';

const NAV_TOP_GAP = 4;
const DEFAULT_CAPSULE_AVOID_RIGHT = 100;
const DEFAULT_STATUS_BAR_HEIGHT = 24;

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function getCollageNavStyle() {
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

  // #ifndef MP-WEIXIN
  return null;
  // #endif
}

export default getCollageNavStyle;
