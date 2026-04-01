import { cloudCall } from '../../utils/cloudCall.js';

function getResult(res) {
  if (res && typeof res === 'object') {
    if (res.result && typeof res.result === 'object') {
      return res.result;
    }
    return res;
  }
  return {};
}

function isSuccessResult(result) {
  return !!result && (result.success === true || result.code === 0);
}

function extractErrorMessage(value) {
  if (!value) {
    return '';
  }
  if (value instanceof Error) {
    return value.message || String(value);
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'object') {
    if (typeof value.message === 'string' && value.message) {
      return value.message;
    }
    if (typeof value.msg === 'string' && value.msg) {
      return value.msg;
    }
    if (typeof value.errMsg === 'string' && value.errMsg) {
      return value.errMsg;
    }
    try {
      return JSON.stringify(value);
    } catch (_) {
      return String(value);
    }
  }
  return String(value);
}

function unwrapResult(res, fallbackMessage = '操作失败') {
  const result = getResult(res);
  if (!isSuccessResult(result)) {
    const message =
      extractErrorMessage(result.error) ||
      extractErrorMessage(result.message) ||
      extractErrorMessage(result.msg) ||
      extractErrorMessage(result.errMsg) ||
      fallbackMessage;
    const error = new Error(message);
    error.result = result;
    throw error;
  }
  return result;
}

async function callCloudAndUnwrap(name, payload = {}, options = {}, fallbackMessage) {
  const res = await cloudCall(name, payload, options);
  return unwrapResult(res, fallbackMessage);
}

async function callCloudAndGetResult(name, payload = {}, options = {}) {
  const res = await cloudCall(name, payload, options);
  return getResult(res);
}

async function callActionAndUnwrap({
  functionName,
  action,
  payload = {},
  pageTag,
  context,
  requireAuth = true,
  fallbackMessage = '操作失败'
} = {}) {
  return callCloudAndUnwrap(
    functionName,
    {
      action,
      ...payload
    },
    {
      pageTag: pageTag || `${functionName}:${action}`,
      context,
      requireAuth
    },
    fallbackMessage
  );
}

function createActionCaller({
  functionName,
  pageTagPrefix,
  requireAuth = true,
  defaultFallbackMessage = '操作失败'
} = {}) {
  return async function callAction(action, payload = {}, options = {}) {
    const {
      pageTag,
      context,
      fallbackMessage = defaultFallbackMessage,
      requireAuth: required = requireAuth
    } = options;
    return callActionAndUnwrap({
      functionName,
      action,
      payload,
      pageTag: pageTag || `${pageTagPrefix || functionName}:${action}`,
      context,
      requireAuth: required,
      fallbackMessage
    });
  };
}

const cloudWrapper = {
  getResult,
  isSuccessResult,
  unwrapResult,
  callCloudAndGetResult,
  callCloudAndUnwrap,
  callActionAndUnwrap,
  createActionCaller
};

export {
  getResult,
  isSuccessResult,
  unwrapResult,
  callCloudAndGetResult,
  callCloudAndUnwrap,
  callActionAndUnwrap,
  createActionCaller
};

export default cloudWrapper;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = cloudWrapper;
  module.exports.default = cloudWrapper;
}
