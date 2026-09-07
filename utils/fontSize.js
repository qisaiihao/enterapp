/**
 * 阅读字号设置
 * 通过 CSS 变量 --app-read-font-scale 控制诗歌正文等阅读文本的字号倍率。
 * 多端生效方式：
 *  - 页面根节点统一绑定 readFontVars（由 main.js 全局 mixin 提供），
 *  - App.vue 全局样式中正文用 calc(基准rpx * var(--app-read-font-scale, 1)) 缩放，
 *  - H5 端额外写入 documentElement 以保证覆盖。
 */

const STORAGE_KEY = 'poementerReadFontSize';
const READ_FONT_SIZE_CHANGED_EVENT = 'read-font-size:changed';

const READ_FONT_LEVELS = Object.freeze({
  standard: { label: '标准', scale: 1 },
  large: { label: '大', scale: 1.2 },
  xlarge: { label: '特大', scale: 1.4 }
});

const READ_FONT_LEVEL_NAMES = Object.keys(READ_FONT_LEVELS);

function normalizeLevel(level) {
  return READ_FONT_LEVELS[level] ? level : 'standard';
}

function readStorage(key) {
  if (typeof uni !== 'undefined' && typeof uni.getStorageSync === 'function') {
    try {
      const value = uni.getStorageSync(key);
      if (value) return value;
    } catch (_) {}
  }
  if (typeof localStorage !== 'undefined') {
    try {
      return localStorage.getItem(key);
    } catch (_) {}
  }
  return null;
}

function writeStorage(key, value) {
  if (typeof uni !== 'undefined' && typeof uni.setStorageSync === 'function') {
    try {
      uni.setStorageSync(key, value);
    } catch (_) {}
  }
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(key, value);
    } catch (_) {}
  }
}

function getReadFontSizeLevel() {
  return normalizeLevel(readStorage(STORAGE_KEY));
}

function getReadFontScale(level = getReadFontSizeLevel()) {
  return READ_FONT_LEVELS[normalizeLevel(level)].scale;
}

function getReadFontVars(level = getReadFontSizeLevel()) {
  const scale = getReadFontScale(level);
  const rpx = (base) => `${Math.round(base * scale)}rpx`;
  return {
    '--app-read-post-size': rpx(28),
    '--app-read-post-line': rpx(38),
    '--app-read-copy-size': rpx(26),
    '--app-read-copy-line': rpx(44),
    '--app-read-sentence-size': rpx(28),
    '--app-read-sentence-line': rpx(40),
    '--app-read-timeline-size': rpx(28),
    '--app-read-timeline-line': rpx(38)
  };
}

function applyReadFontSize(level = getReadFontSizeLevel()) {
  const vars = getReadFontVars(level);
  try {
    if (typeof document !== 'undefined' && document.documentElement) {
      Object.keys(vars).forEach((name) => {
        document.documentElement.style.setProperty(name, vars[name]);
      });
    }
  } catch (_) {}
  return level;
}

function setReadFontSize(level) {
  const nextLevel = normalizeLevel(level);
  writeStorage(STORAGE_KEY, nextLevel);
  applyReadFontSize(nextLevel);
  try {
    if (typeof uni !== 'undefined' && typeof uni.$emit === 'function') {
      uni.$emit(READ_FONT_SIZE_CHANGED_EVENT, {
        level: nextLevel,
        scale: READ_FONT_LEVELS[nextLevel].scale
      });
    }
  } catch (_) {}
  return nextLevel;
}

const fontSizeUtils = {
  READ_FONT_SIZE_CHANGED_EVENT,
  READ_FONT_LEVELS,
  READ_FONT_LEVEL_NAMES,
  getReadFontSizeLevel,
  getReadFontScale,
  getReadFontVars,
  applyReadFontSize,
  setReadFontSize
};

export {
  READ_FONT_SIZE_CHANGED_EVENT,
  READ_FONT_LEVELS,
  READ_FONT_LEVEL_NAMES,
  getReadFontSizeLevel,
  getReadFontScale,
  getReadFontVars,
  applyReadFontSize,
  setReadFontSize
};

export default fontSizeUtils;