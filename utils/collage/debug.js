// 拼贴诗调试日志。
// 生产构建会在入口静默 console，本模块在 main.js 最早加载时保存原生方法，
// 因此微信小程序 / App / H5 的构建包都能在控制台看到日志；
// 微信小程序同时写入实时日志，便于真机在没有控制台时排查。
// 级别可通过 uni.setStorageSync('collage_debug_level', 'off'|'error'|'warn'|'info'|'debug') 调整。
const LEVELS = { off: 0, error: 1, warn: 2, info: 3, debug: 4 };
const DEFAULT_LEVEL = 'debug';
const STORAGE_KEY = 'collage_debug_level';
const PREFIX = '[拼贴诗]';

const nativeConsole = {
  debug: typeof console !== 'undefined' && console.debug ? console.debug : undefined,
  log: typeof console !== 'undefined' && console.log ? console.log : undefined,
  warn: typeof console !== 'undefined' && console.warn ? console.warn : undefined,
  error: typeof console !== 'undefined' && console.error ? console.error : undefined
};

let currentLevel;
let realtimeManager;

function readLevel() {
  if (currentLevel !== undefined) return currentLevel;
  let saved = '';
  try {
    if (typeof uni !== 'undefined' && typeof uni.getStorageSync === 'function') saved = uni.getStorageSync(STORAGE_KEY);
  } catch (_) {
    saved = '';
  }
  currentLevel = LEVELS[saved] !== undefined ? saved : DEFAULT_LEVEL;
  return currentLevel;
}

export function setCollageDebugLevel(value) {
  currentLevel = LEVELS[value] !== undefined ? value : DEFAULT_LEVEL;
  try {
    if (typeof uni !== 'undefined' && typeof uni.setStorageSync === 'function') uni.setStorageSync(STORAGE_KEY, currentLevel);
  } catch (_) {}
  return currentLevel;
}

export function getCollageDebugLevel() {
  return readLevel();
}

function getRealtimeManager() {
  if (realtimeManager === undefined) {
    realtimeManager = null;
    try {
      if (typeof wx !== 'undefined' && typeof wx.getRealtimeLogManager === 'function') {
        realtimeManager = wx.getRealtimeLogManager();
        if (realtimeManager && typeof realtimeManager.addFilterMsg === 'function') realtimeManager.addFilterMsg('collage');
      }
    } catch (_) {
      realtimeManager = null;
    }
  }
  return realtimeManager;
}

function describe(value) {
  if (value === undefined) return '';
  if (value === null) return 'null';
  if (typeof value === 'string') return value.length > 600 ? `${value.slice(0, 600)}…` : value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Error) return value.stack || value.message || String(value);
  if (value && typeof value.errMsg === 'string') {
    return value.message ? `${value.message} (${value.errMsg})` : value.errMsg;
  }
  try {
    const text = JSON.stringify(value, (key, item) => {
      if (item instanceof Error) return item.stack || item.message || String(item);
      if (typeof item === 'string' && item.length > 200) return `${item.slice(0, 200)}…`;
      return item;
    });
    if (!text) return String(value);
    return text.length > 600 ? `${text.slice(0, 600)}…` : text;
  } catch (_) {
    return String(value);
  }
}

function write(levelName, scope, message, data) {
  const rank = LEVELS[levelName];
  if (rank === undefined || rank > LEVELS[readLevel()]) return;
  const text = `${PREFIX}[${scope}] ${message}`;
  const sink = levelName === 'debug' ? nativeConsole.debug : levelName === 'warn' ? nativeConsole.warn : levelName === 'error' ? nativeConsole.error : nativeConsole.log;
  if (sink) {
    try {
      if (data === undefined) sink(text);
      else sink(text, data);
    } catch (_) {}
  }
  if (levelName === 'debug') return;
  const manager = getRealtimeManager();
  if (!manager) return;
  const detail = data === undefined ? '' : ` ${describe(data)}`;
  try {
    if (levelName === 'error') manager.error(`${text}${detail}`);
    else if (levelName === 'warn') manager.warn(`${text}${detail}`);
    else manager.info(`${text}${detail}`);
  } catch (_) {}
}

export function createCollageLogger(scope) {
  return {
    debug: (message, data) => write('debug', scope, message, data),
    info: (message, data) => write('info', scope, message, data),
    warn: (message, data) => write('warn', scope, message, data),
    error: (message, data) => write('error', scope, message, data)
  };
}

export default createCollageLogger;
