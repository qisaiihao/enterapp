export const BUILTIN_HUIWEN_FONT_FAMILY = '汇文明朝';
export const BUILTIN_HUIWEN_FONT_RUNTIME_FAMILY = 'Huiwen-mincho';
export const BUILTIN_HUIWEN_FONT_READY_KEY = '__builtin_font_huiwen_ready__';

export function markBuiltinHuiwenFontPending() {
  try {
    if (typeof uni !== 'undefined' && uni.setStorageSync) {
      uni.setStorageSync(BUILTIN_HUIWEN_FONT_READY_KEY, false);
    }
  } catch (error) {}
}

export function markBuiltinHuiwenFontReady(extra = {}) {
  try {
    if (typeof uni !== 'undefined' && uni.setStorageSync) {
      uni.setStorageSync(BUILTIN_HUIWEN_FONT_READY_KEY, true);
    }
  } catch (error) {}

  try {
    if (typeof uni !== 'undefined' && uni.$emit) {
      uni.$emit('font-loaded', Object.assign({
        fontFamily: BUILTIN_HUIWEN_FONT_FAMILY
      }, extra || {}));
    }
  } catch (error) {}
}

export function isBuiltinHuiwenFontReady() {
  try {
    return !!(
      typeof uni !== 'undefined'
      && uni.getStorageSync
      && uni.getStorageSync(BUILTIN_HUIWEN_FONT_READY_KEY)
    );
  } catch (error) {
    return false;
  }
}

export function replayBuiltinHuiwenFontReady(context, handlerName = 'onBuiltinFontLoaded', logPrefix = '[builtin-font]') {
  if (!context || !isBuiltinHuiwenFontReady()) return false;

  const handler = context[handlerName];
  if (typeof handler !== 'function') return false;

  const invoke = () => {
    try {
      handler.call(context, {
        fontFamily: BUILTIN_HUIWEN_FONT_FAMILY,
        replay: true
      });
    } catch (error) {
      console.warn(`${logPrefix} replay font-ready failed`, error);
    }
  };

  try {
    if (typeof context.$nextTick === 'function') {
      context.$nextTick(invoke);
    } else {
      setTimeout(invoke, 0);
    }
    return true;
  } catch (error) {
    console.warn(`${logPrefix} schedule font-ready replay failed`, error);
    return false;
  }
}
