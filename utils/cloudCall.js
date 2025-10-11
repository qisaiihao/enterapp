const platformDetector = require('./platformDetector.js');
const auth = require('./auth.js');

const DEFAULT_RETRY_DELAY = 300;

function ensureObject(value) {
    if (!value || typeof value !== 'object') {
        return {};
    }
    if (Array.isArray(value)) {
        return value.slice();
    }
    return Object.assign({}, value);
}

function createError(code, message, originalError) {
    const error = originalError instanceof Error ? originalError : new Error(message || code);
    error.code = code;
    if (originalError && originalError !== error) {
        error.originalError = originalError;
    }
    return error;
}

function getTcbInstance(context) {
    if (context && context.$tcb && typeof context.$tcb.callFunction === 'function') {
        return context.$tcb;
    }
    if (typeof getApp === 'function') {
        const app = getApp();
        if (app && app.$tcb && typeof app.$tcb.callFunction === 'function') {
            return app.$tcb;
        }
    }
    if (typeof uni !== 'undefined' && uni.$tcb && typeof uni.$tcb.callFunction === 'function') {
        return uni.$tcb;
    }
    return null;
}

async function invokeCloudFunction(method, payload) {
    if (method === 'tcb') {
        const instance = getTcbInstance(payload.context);
        if (!instance) {
            throw createError('TCB_NOT_AVAILABLE', 'TCB 实例不可用');
        }
        return instance.callFunction(payload.options);
    }

    if (method === 'wx-cloud' && typeof wx !== 'undefined' && wx.cloud && typeof wx.cloud.callFunction === 'function') {
        return wx.cloud.callFunction(payload.options);
    }

    if (typeof uniCloud !== 'undefined' && typeof uniCloud.callFunction === 'function') {
        return uniCloud.callFunction(payload.options);
    }

    throw createError('NO_CLOUD_METHOD', '当前环境不支持云函数调用');
}

async function cloudCall(name, data = {}, options = {}) {
    if (!name || typeof name !== 'string') {
        return Promise.reject(createError('INVALID_NAME', '云函数名称无效'));
    }

    const {
        pageTag = 'global',
        retry = 0,
        retryDelay = DEFAULT_RETRY_DELAY,
        context,
        injectOpenId,
        requireAuth = false
    } = options;
    const shouldInjectOpenId = typeof injectOpenId === 'boolean' ? injectOpenId : !['login', 'getOpenId'].includes(name);

    const payload = ensureObject(data);
    let openid = null;

    if (shouldInjectOpenId) {
        try {
            openid = await auth.getOpenId();
        } catch (error) {
            console.error(`[cloudCall][${pageTag}] 获取 openid 失败`, error);
            throw createError('NO_OPENID', '获取 openid 失败', error);
        }

        if (!openid) {
            if (requireAuth) {
                const error = createError('NO_OPENID', '用户未登录或 openid 缺失');
                if (typeof uni !== 'undefined' && uni.showToast) {
                    uni.showToast({
                        title: '请先登录',
                        icon: 'none'
                    });
                }
                console.warn(`[cloudCall][${pageTag}] openid 缺失，调用 "${name}" 失败`);
                throw error;
            }
            console.warn(`[cloudCall][${pageTag}] openid 缺失，调用 "${name}" 将不注入 openid`);
        } else if (!payload.openid) {
            payload.openid = openid;
        }
    }

    const method = platformDetector.getCloudFunctionMethod();
    const totalAttempts = Math.max(0, parseInt(retry, 10)) + 1;

    for (let attempt = 1; attempt <= totalAttempts; attempt += 1) {
        try {
            console.log(`[cloudCall][${pageTag}] 调用云函数 "${name}"（尝试 ${attempt}/${totalAttempts}）`, payload);
            const result = await invokeCloudFunction(method, {
                context,
                options: {
                    name,
                    data: payload
                }
            });
            console.log(`[cloudCall][${pageTag}] 云函数 "${name}" 调用成功`, result);
            return result;
        } catch (error) {
            const isLastAttempt = attempt === totalAttempts;
            const errorCode = error && error.code ? error.code : error?.errCode;

            console.error(`[cloudCall][${pageTag}] 云函数 "${name}" 调用失败（尝试 ${attempt}/${totalAttempts}）`, error);

            if (errorCode === 'NO_OPENID') {
                throw createError('NO_OPENID', '用户未登录或 openid 缺失', error);
            }

            if (isLastAttempt) {
                const finalError = createError(errorCode || 'CLOUD_CALL_FAILED', '云函数调用失败', error);
                if (typeof uni !== 'undefined' && uni.showToast) {
                    uni.showToast({
                        title: '网络异常，请稍后再试',
                        icon: 'none'
                    });
                }
                throw finalError;
            }

            if (retryDelay > 0) {
                await new Promise((resolve) => setTimeout(resolve, retryDelay));
            }
        }
    }

    throw createError('CLOUD_CALL_FAILED', '云函数调用失败');
}

module.exports = {
    cloudCall
};
