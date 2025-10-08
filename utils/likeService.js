// 点赞服务：封装 vote 云函数调用，统一缓存同步与错误提示。
const { cloudCall } = require('./cloudCall.js');
const likeIcon = require('./likeIcon.js');

let dataCache = null;
try {
    // dataCache 可能不存在于某些端，保持容错
    dataCache = require('./dataCache.js');
} catch (error) {
    console.warn('[likeService] dataCache 不可用，跳过缓存同步');
}

const DEFAULT_ERROR_MESSAGE = '操作失败，请稍后重试';

function toNumber(value, fallback = 0) {
    const num = Number(value);
    if (Number.isFinite(num)) {
        return num;
    }
    return fallback;
}

function resolveLikeIcon(resolver, votes, isLiked) {
    if (typeof resolver === 'function') {
        try {
            return resolver(votes, isLiked);
        } catch (error) {
            console.warn('[likeService] likeIcon resolver 执行失败', error);
        }
    }
    return likeIcon.getLikeIcon(votes, isLiked);
}

function createRollbackPayload({ votes, isLiked, icon }) {
    return {
        votes,
        isLiked,
        likeIcon: icon
    };
}

function showToast(message) {
    if (typeof uni === 'undefined' || typeof uni.showToast !== 'function') {
        return;
    }
    try {
        uni.showToast({
            title: message || DEFAULT_ERROR_MESSAGE,
            icon: 'none'
        });
    } catch (error) {
        console.warn('[likeService] showToast 调用失败', error);
    }
}

function normalizeOptions(options = {}) {
    const {
        pageTag = 'like-service',
        context = null,
        currentVotes = 0,
        currentIsLiked = false,
        likeIconResolver = likeIcon.getLikeIcon,
        requireAuth = true,
        retry = 0,
        updateCache = true,
        showErrorToast = true,
        cloudOptions = {}
    } = options;

    return {
        pageTag,
        context,
        currentVotes: toNumber(currentVotes, 0),
        currentIsLiked: Boolean(currentIsLiked),
        likeIconResolver,
        requireAuth,
        retry,
        updateCache,
        showErrorToast,
        cloudOptions
    };
}

async function togglePostLike(postId, options = {}) {
    if (!postId) {
        return Promise.reject(new Error('[likeService] postId 不能为空'));
    }

    const {
        pageTag,
        context,
        currentVotes,
        currentIsLiked,
        likeIconResolver,
        requireAuth,
        retry,
        updateCache,
        showErrorToast,
        cloudOptions
    } = normalizeOptions(options);

    const optimisticVotes = toNumber(currentVotes, 0);
    const optimisticIsLiked = Boolean(currentIsLiked);
    const optimisticIcon = resolveLikeIcon(likeIconResolver, optimisticVotes, optimisticIsLiked);

    const rollback = createRollbackPayload({
        votes: optimisticVotes,
        isLiked: optimisticIsLiked,
        icon: optimisticIcon
    });

    let response;
    try {
        response = await cloudCall(
            'vote',
            { postId },
            Object.assign(
                {
                    pageTag: `likeService:${pageTag}`,
                    context,
                    requireAuth,
                    retry
                },
                cloudOptions
            )
        );
    } catch (error) {
        console.error('[likeService] 调用云函数失败', error);
        if (showErrorToast) {
            showToast(error && error.message);
        }
        return {
            success: false,
            error,
            rollback
        };
    }

    const result = response && response.result ? response.result : response;
    const isSuccess = result && result.success === true;

    if (!isSuccess) {
        const errorMessage = result && result.message ? result.message : DEFAULT_ERROR_MESSAGE;
        console.warn('[likeService] 云函数返回失败结果', result);
        if (showErrorToast) {
            showToast(errorMessage);
        }
        return {
            success: false,
            error: result,
            rollback
        };
    }

    const finalVotes = toNumber(result.votes, optimisticVotes);
    const finalIsLiked = Boolean(result.isLiked);
    const finalIcon = resolveLikeIcon(likeIconResolver, finalVotes, finalIsLiked);

    if (updateCache && dataCache && typeof dataCache.updatePostLikeInCache === 'function') {
        try {
            dataCache.updatePostLikeInCache(postId, finalVotes, finalIsLiked, finalIcon);
        } catch (cacheError) {
            console.warn('[likeService] 同步缓存失败', cacheError);
        }
    }

    return {
        success: true,
        votes: finalVotes,
        isLiked: finalIsLiked,
        likeIcon: finalIcon,
        response: result
    };
}

module.exports = {
    togglePostLike
};
