import { getCloudFunctionMethod } from './platformDetector.js';
import auth from './auth.js';
import { formatErrorForLog } from './error-log.js';

const platformDetector = {
    getCloudFunctionMethod
};

const DEFAULT_RETRY_DELAY = 300;

function getCachedAppInstance() {
    if (typeof uni === 'undefined') {
        return null;
    }
    return uni.$appInstance || null;
}

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
    const app = getCachedAppInstance();
    if (app && app.$tcb && typeof app.$tcb.callFunction === 'function') {
        return app.$tcb;
    }
    if (typeof uni !== 'undefined' && uni.$tcb && typeof uni.$tcb.callFunction === 'function') {
        return uni.$tcb;
    }
    return null;
}

function getTcbAuthEnsurer(context) {
    if (context && typeof context.$ensureTcbAuthenticated === 'function') {
        return context.$ensureTcbAuthenticated;
    }
    const app = getCachedAppInstance();
    if (app && typeof app.$ensureTcbAuthenticated === 'function') {
        return app.$ensureTcbAuthenticated;
    }
    if (typeof uni !== 'undefined' && typeof uni.$ensureTcbAuthenticated === 'function') {
        return uni.$ensureTcbAuthenticated;
    }
    return null;
}

async function ensureTcbCallReady(instance, context) {
    if (!instance || instance.__skipAuth || typeof instance.auth !== 'function') {
        return instance;
    }

    const authEnsurer = getTcbAuthEnsurer(context);
    if (typeof authEnsurer === 'function') {
        await authEnsurer(instance);
        return instance;
    }

    const authClient = instance.auth();
    if (!authClient || authClient.currentUser || typeof authClient.signInAnonymously !== 'function') {
        return instance;
    }

    await authClient.signInAnonymously();
    return instance;
}

async function invokeCloudFunction(method, payload) {
    console.log(`[invokeCloudFunction] method: ${method}`);

    if (method === 'tcb') {
        const instance = getTcbInstance(payload.context);
        console.log('[invokeCloudFunction] TCB instance:', instance ? 'available' : 'missing');
        if (!instance) {
            throw createError('TCB_NOT_AVAILABLE', 'TCB instance unavailable');
        }
        try {
            await ensureTcbCallReady(instance, payload.context);
        } catch (error) {
            throw createError('TCB_AUTH_FAILED', 'TCB auth unavailable', error);
        }
        return instance.callFunction(payload.options, undefined, payload.customReqOpts);
    }

    if (method === 'wx-cloud') {
        console.log('[invokeCloudFunction] using wx.cloud');
        if (typeof wx === 'undefined' || !wx.cloud) {
            throw createError('WX_CLOUD_NOT_AVAILABLE', 'wx.cloud unavailable');
        }

        console.log('[invokeCloudFunction] wx.cloud function:', payload.options.name);
        return wx.cloud.callFunction(payload.options);
    }

    if (typeof uniCloud !== 'undefined' && typeof uniCloud.callFunction === 'function') {
        return uniCloud.callFunction(payload.options);
    }

    throw createError('NO_CLOUD_METHOD', 'No supported cloud function method');
}

export async function cloudCall(name, data = {}, options = {}) {
    if (!name || typeof name !== 'string') {
        return Promise.reject(createError('INVALID_NAME', 'Invalid cloud function name'));
    }

    const {
        pageTag = 'global',
        retry = 0,
        retryDelay = DEFAULT_RETRY_DELAY,
        context,
        injectOpenId,
        requireAuth = false,
        timeoutMs,
        silent = false
    } = options;
    const shouldInjectOpenId = typeof injectOpenId === 'boolean' ? injectOpenId : !['login', 'getOpenId', 'github-auth'].includes(name);

    const payload = ensureObject(data);
    let openid = null;

    if (shouldInjectOpenId) {
        try {
            openid = await auth.getOpenId();
        } catch (error) {
            console.error(`[cloudCall][${pageTag}] failed to get openid: ${formatErrorForLog(error)}`);
            throw createError('NO_OPENID', '\u83B7\u53D6 openid \u5931\u8D25', error);
        }

        if (!openid) {
            if (requireAuth) {
                const error = createError('NO_OPENID', '\u7528\u6237\u672A\u767B\u5F55\u6216 openid \u7F3A\u5931');

                if (typeof uni !== 'undefined') {
                    try {
                        const authHelper = await import('./authHelper.js');
                        await authHelper.requireLogin({
                            content: '\u6B64\u64CD\u4F5C\u9700\u8981\u767B\u5F55\uFF0C\u8BF7\u5148\u767B\u5F55'
                        });
                    } catch (importError) {
                        if (uni.showToast) {
                            uni.showToast({
                                title: '\u8BF7\u5148\u767B\u5F55',
                                icon: 'none'
                            });
                        }
                    }
                }

                console.warn(`[cloudCall][${pageTag}] openid missing, "${name}" requires auth`);
                throw error;
            }
            console.warn(`[cloudCall][${pageTag}] openid missing, "${name}" will run without injection`);
        } else if (!payload.openid) {
            payload.openid = openid;
        }
    }

    const method = platformDetector.getCloudFunctionMethod();
    console.log(`[cloudCall] method=${method}, name=${name}`);
    const totalAttempts = Math.max(0, parseInt(retry, 10)) + 1;

    for (let attempt = 1; attempt <= totalAttempts; attempt += 1) {
        try {
            console.log(`[cloudCall][${pageTag}] calling "${name}" (${attempt}/${totalAttempts})`, payload);
            const result = await invokeCloudFunction(method, {
                context,
                options: {
                    name,
                    data: payload
                },
                customReqOpts: typeof timeoutMs === 'number' && timeoutMs > 0 ? { timeout: timeoutMs } : undefined
            });
            console.log(`[cloudCall][${pageTag}] "${name}" succeeded`, result);
            return result;
        } catch (error) {
            const isLastAttempt = attempt === totalAttempts;
            const errorCode = error && error.code ? error.code : error?.errCode;

            if (!silent) {
                console.error(`[cloudCall][${pageTag}] "${name}" failed (${attempt}/${totalAttempts}): ${formatErrorForLog(error)}`);
            }

            if (errorCode === 'NO_OPENID') {
                throw createError('NO_OPENID', '\u7528\u6237\u672A\u767B\u5F55\u6216 openid \u7F3A\u5931', error);
            }

            if (isLastAttempt) {
                const finalError = createError(errorCode || 'CLOUD_CALL_FAILED', '\u4E91\u51FD\u6570\u8C03\u7528\u5931\u8D25', error);
                if (!silent && typeof uni !== 'undefined' && uni.showToast) {
                    uni.showToast({
                        title: '\u7F51\u7EDC\u5F02\u5E38\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5',
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

    throw createError('CLOUD_CALL_FAILED', '\u4E91\u51FD\u6570\u8C03\u7528\u5931\u8D25');
}

export default {
    cloudCall
};
