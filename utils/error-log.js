function safeRead(getter, fallback = '') {
  try {
    const value = getter();
    return value === undefined || value === null ? fallback : value;
  } catch (_) {
    return fallback;
  }
}

function serializeValue(value) {
  try {
    return JSON.stringify(value);
  } catch (_) {
    return safeRead(() => String(value), '[unserializable value]');
  }
}

function normalizeStack(stack) {
  if (typeof stack !== 'string' || !stack.trim()) {
    return '';
  }
  return stack
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 6)
    .join(' <- ');
}

function formatErrorForLog(error) {
  try {
    if (error === undefined) return 'undefined';
    if (error === null) return 'null';
    if (typeof error === 'string') return error;
    if (typeof error === 'number' || typeof error === 'boolean' || typeof error === 'bigint') {
      return String(error);
    }

    const code = safeRead(() => error.code || error.errCode || error.statusCode, '');
    const name = safeRead(() => error.name, '');
    const message = safeRead(() => error.message || error.msg || error.errMsg, '');
    const stack = normalizeStack(safeRead(() => error.stack, ''));
    const parts = [];

    if (name || message) {
      parts.push([name, message].filter(Boolean).join(': '));
    }
    if (code) {
      parts.push(`code=${code}`);
    }

    if (!parts.length && typeof error === 'object') {
      const serialized = serializeValue(error);
      if (serialized && serialized !== '{}') {
        parts.push(serialized);
      }
    }

    if (stack && !parts.includes(stack)) {
      parts.push(stack);
    }

    return parts.join(' | ') || serializeValue(error);
  } catch (_) {
    return '[unserializable error]';
  }
}

export {
  formatErrorForLog
};

export default {
  formatErrorForLog
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    formatErrorForLog
  };
  module.exports.default = module.exports;
}
