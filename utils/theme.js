const STORAGE_KEY = 'poementerThemeMode';
const THEME_CHANGED_EVENT = 'theme:changed';
const LIGHT_MODE = 'light';
const DARK_MODE = 'dark';

const DARK_THEME_VARS = Object.freeze({
  '--app-page-bg': '#0f1115',
  '--app-surface-bg': '#171a20',
  '--app-elevated-bg': 'rgba(24, 28, 36, 0.96)',
  '--app-primary-text': '#f4f1ea',
  '--app-secondary-text': '#c9ced8',
  '--app-muted-text': '#8e96a3',
  '--app-border-color': 'rgba(255,255,255,0.12)',
  '--app-accent-color': '#c9ad73',
  '--app-icon-filter': 'brightness(0) invert(1)',
  '--app-filter-icon-filter': 'brightness(0) invert(1)',
  '--app-subtle-surface-bg': 'rgba(255, 255, 255, 0.08)',
  '--app-surface-divider': 'rgba(255, 255, 255, 0.12)',
  '--app-surface-shadow': '0 10rpx 30rpx rgba(0, 0, 0, 0.28)',
  '--app-surface-border-line': '1rpx solid rgba(255,255,255,0.12)',
  '--app-skeleton-shimmer-bg': 'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.16) 50%, rgba(255,255,255,0) 100%)',
  '--app-surface-title-color': '#f4f1ea',
  '--app-surface-text-color': '#d9dde6',
  '--app-surface-meta-color': '#9ea6b2',
  '--app-surface-accent-color': '#c9ad73',
  '--app-fixed-bar-bg': 'rgba(15, 17, 21, 0.96)',
  '--app-fixed-bar-shadow': '0 10rpx 30rpx rgba(0, 0, 0, 0.28)',
  '--app-tab-text-color': '#9ea6b2',
  '--app-tab-active-text-color': '#f4f1ea',
  '--app-tab-icon-wrap-bg': 'rgba(255, 255, 255, 0.07)',
  '--app-tab-icon-inner-bg': 'rgba(255, 255, 255, 0.06)',
  '--app-tab-icon-border-color': 'rgba(255, 255, 255, 0.10)',
  '--app-tab-icon-active-border-color': 'rgba(255, 255, 255, 0.34)',
  '--app-tab-icon-wrap-shadow': '0 10rpx 24rpx rgba(0, 0, 0, 0.30)',
  '--app-tab-icon-active-shadow': '0 10rpx 22rpx rgba(0, 0, 0, 0.28)',
  '--app-tabbar-icon-filter': 'none',
  '--app-tabbar-icon-active-filter': 'none',
  '--app-tabbar-icon-opacity': '0.82',
  '--app-tabbar-icon-active-opacity': '0.98',
  '--app-activity-entry-icon-filter': 'grayscale(1) invert(1) brightness(0.78) contrast(1.08)',
  '--app-activity-entry-icon-opacity': '0.78',
  '--app-activity-entry-text-color': '#c9ced8',
  '--app-add-action-icon-filter': 'brightness(0) invert(1)',
  '--app-add-action-icon-opacity': '0.92',
  '--app-post-wrapper-bg': '#171a20',
  '--app-post-original-bg': '#171a20',
  '--app-post-section-bg': '#171a20',
  '--app-post-wrapper-shadow': '0 8rpx 24rpx rgba(0, 0, 0, 0.26)',
  '--app-post-wrapper-radius': '0',
  '--app-post-wrapper-border': 'none',
  '--app-post-wrapper-divider': '1rpx solid rgba(255,255,255,0.10)',
  '--app-post-author-color': '#f4f1ea',
  '--app-post-title-color': '#f4f1ea',
  '--app-post-content-color': '#d9dde6',
  '--app-post-time-color': '#9ea6b2',
  '--app-post-discussion-color': '#e6d6ad',
  '--app-post-meta-color': '#9ea6b2',
  '--app-post-action-color': '#c9ced8',
  '--app-post-action-icon-filter': 'brightness(0) invert(1) opacity(0.86)',
  '--app-post-action-icon-opacity': '1',
  '--app-post-poem-author-color': '#f4f1ea',
  '--app-post-menu-dot-color': '#c9ced8',
  '--app-post-original-accent-color': '#c9ad73',
  '--app-post-discussion-quote-bg': 'rgba(255,255,255,0.08)',
  '--profile-poemid-color': '#9ea6b2',
  '--profile-meta-color': '#c9ced8',
  '--profile-name-color': '#f4f1ea',
  '--profile-bio-color': '#d9dde6',
  '--profile-button-bg': 'rgba(255,255,255,0.10)',
  '--profile-button-active-bg': 'rgba(255,255,255,0.16)',
  '--profile-button-border': '1.5rpx solid rgba(255,255,255,0.16)',
  '--profile-button-shadow': '0 8rpx 20rpx rgba(0, 0, 0, 0.22)',
  '--profile-button-text-color': '#f4f1ea',
  '--profile-icon-button-bg': 'rgba(255,255,255,0.10)',
  '--profile-icon-button-active-bg': 'rgba(255,255,255,0.16)',
  '--profile-icon-button-border': '1.5rpx solid rgba(255,255,255,0.16)',
  '--profile-icon-button-shadow': '0 8rpx 20rpx rgba(0, 0, 0, 0.20)',
  '--profile-upload-icon-opacity': '1',
  '--profile-upload-icon-filter': 'brightness(0) invert(1)',
  '--profile-menu-icon-opacity': '0.94',
  '--profile-menu-icon-filter': 'brightness(0) invert(1)',
  '--profile-tab-nav-bg': 'rgba(255,255,255,0.04)',
  '--profile-tab-nav-border': 'rgba(255,255,255,0.08)',
  '--profile-tab-nav-shadow': 'none',
  '--profile-tab-item-bg': 'transparent',
  '--profile-tab-item-active-bg': 'rgba(255,255,255,0.08)',
  '--profile-tab-indicator-color': '#ffffff',
  '--profile-tab-icon-filter': 'grayscale(1) invert(1) brightness(0.82) contrast(1.12)',
  '--profile-tab-icon-opacity': '0.92',
  '--profile-tab-icon-active-filter': 'grayscale(1) invert(1) brightness(1.02) contrast(1.16)',
  '--profile-tab-icon-active-opacity': '1',
  '--profile-empty-surface-bg': 'rgba(24, 28, 36, 0.92)',
  '--profile-empty-surface-border': '1rpx solid rgba(255,255,255,0.12)',
  '--profile-empty-surface-shadow': '0 8rpx 24rpx rgba(0, 0, 0, 0.24)',
  '--profile-empty-text-color': '#9ea6b2',
  '--profile-loading-footer-color': '#9ea6b2'
});

const LIGHT_THEME_VARS = Object.freeze({
  '--app-page-bg': '#ffffff',
  '--app-surface-bg': '#ffffff',
  '--app-elevated-bg': 'rgba(255, 255, 255, 0.96)',
  '--app-primary-text': '#111111',
  '--app-secondary-text': '#333333',
  '--app-muted-text': '#999999',
  '--app-border-color': 'rgba(0,0,0,0.08)',
  '--app-accent-color': '#809076',
  '--app-icon-filter': 'drop-shadow(0 2rpx 4rpx rgba(0, 0, 0, 0.1))',
  '--app-filter-icon-filter': 'none',
  '--app-fixed-bar-bg': '#ffffff',
  '--app-fixed-bar-shadow': 'none',
  '--app-tab-text-color': '#999999',
  '--app-tab-active-text-color': '#000000',
  '--app-tab-icon-wrap-bg': '#f8f8f8',
  '--app-tab-icon-inner-bg': '#ffffff',
  '--app-tab-icon-border-color': 'transparent',
  '--app-tab-icon-active-border-color': 'transparent',
  '--app-tab-icon-wrap-shadow': '0 18rpx 32rpx rgba(0, 0, 0, 0.16)',
  '--app-tab-icon-active-shadow': '0 6rpx 12rpx rgba(0, 0, 0, 0.08)',
  '--app-tabbar-icon-filter': 'none',
  '--app-tabbar-icon-active-filter': 'none',
  '--app-tabbar-icon-opacity': '1',
  '--app-tabbar-icon-active-opacity': '1',
  '--app-activity-entry-icon-filter': 'none',
  '--app-activity-entry-icon-opacity': '1',
  '--app-activity-entry-text-color': '#9b9b9b',
  '--app-add-action-icon-filter': 'none',
  '--app-add-action-icon-opacity': '1',
  '--app-post-action-color': '#999999',
  '--app-post-action-icon-filter': 'none',
  '--app-post-action-icon-opacity': '1',
  '--app-post-original-bg': 'linear-gradient(90deg, rgba(235, 200, 141, 0.05) 0%, rgba(255, 255, 255, 0) 100%)'
});

const ALL_THEME_VAR_NAMES = Array.from(new Set([
  ...Object.keys(LIGHT_THEME_VARS),
  ...Object.keys(DARK_THEME_VARS)
]));

function normalizeThemeMode(mode) {
  return mode === DARK_MODE ? DARK_MODE : LIGHT_MODE;
}

function readStorage(key) {
  if (typeof uni !== 'undefined' && typeof uni.getStorageSync === 'function') {
    try {
      const value = uni.getStorageSync(key);
      if (value) return value;
    } catch (error) {}
  }

  if (typeof localStorage !== 'undefined') {
    try {
      return localStorage.getItem(key);
    } catch (error) {}
  }

  return null;
}

function writeStorage(key, value) {
  if (typeof uni !== 'undefined' && typeof uni.setStorageSync === 'function') {
    try {
      uni.setStorageSync(key, value);
    } catch (error) {}
  }

  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(key, value);
    } catch (error) {}
  }
}

function getThemeTargets() {
  if (typeof document === 'undefined') {
    return [];
  }
  return [
    document.documentElement,
    document.body,
    document.getElementById('app')
  ].filter(Boolean);
}

export function getThemeVars(mode = getThemeMode()) {
  return normalizeThemeMode(mode) === DARK_MODE ? DARK_THEME_VARS : LIGHT_THEME_VARS;
}

export function getThemeMode() {
  return normalizeThemeMode(readStorage(STORAGE_KEY));
}

export function isDarkMode(mode = getThemeMode()) {
  return normalizeThemeMode(mode) === DARK_MODE;
}

export function applyThemeMode(mode = getThemeMode()) {
  const nextMode = normalizeThemeMode(mode);
  const vars = getThemeVars(nextMode);
  const targets = getThemeTargets();

  targets.forEach((target) => {
    target.setAttribute('data-app-theme', nextMode);
    target.style.colorScheme = nextMode === DARK_MODE ? 'dark' : 'light';
    ALL_THEME_VAR_NAMES.forEach((name) => {
      if (Object.prototype.hasOwnProperty.call(vars, name)) {
        target.style.setProperty(name, vars[name]);
      } else {
        target.style.removeProperty(name);
      }
    });
  });

  return nextMode;
}

export function setThemeMode(mode) {
  const nextMode = normalizeThemeMode(mode);
  writeStorage(STORAGE_KEY, nextMode);
  applyThemeMode(nextMode);

  try {
    if (typeof uni !== 'undefined' && typeof uni.$emit === 'function') {
      uni.$emit(THEME_CHANGED_EVENT, { mode: nextMode, isDark: nextMode === DARK_MODE });
    }
  } catch (error) {}

  return nextMode;
}

export function toggleThemeMode() {
  return setThemeMode(isDarkMode() ? LIGHT_MODE : DARK_MODE);
}

export {
  DARK_MODE,
  LIGHT_MODE,
  STORAGE_KEY as THEME_STORAGE_KEY,
  THEME_CHANGED_EVENT
};
