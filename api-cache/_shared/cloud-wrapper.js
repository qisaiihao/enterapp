import { cloudCall } from '../../utils/cloudCall.js';

function getResult(res) {
  return (res && res.result) || {};
}

function isSuccessResult(result) {
  return !!result && (result.success === true || result.code === 0);
}

function unwrapResult(res, fallbackMessage = '操作失败') {
  const result = getResult(res);
  if (!isSuccessResult(result)) {
    throw new Error(result.error || result.message || result.msg || fallbackMessage);
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
