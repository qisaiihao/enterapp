// 分页加载 mixin：统一管理页码、加载状态，并接管下拉刷新与触底触发。
// 使用场景：在页面的 created/onLoad 中调用 initPagination(loader) 并在 loader 中返回 { list, hasMore }。

const DEFAULT_STATE = {
    page: 0,
    hasMore: true,
    isLoading: false,
    isLoadingMore: false
};

const STATE_KEYS = Object.keys(DEFAULT_STATE);

function ensureState(ctx) {
    if (!ctx.__paginationState) {
        ctx.__paginationState = { ...DEFAULT_STATE };
    }
    if (typeof ctx.pagination !== 'object' || ctx.pagination === null) {
        ctx.pagination = { ...DEFAULT_STATE };
    } else {
        ctx.pagination = { ...DEFAULT_STATE, ...ctx.pagination };
    }
    STATE_KEYS.forEach((key) => {
        if (typeof ctx[key] === 'undefined') {
            ctx[key] = DEFAULT_STATE[key];
        }
    });
    return ctx.__paginationState;
}

function applyData(ctx, patch) {
    if (!patch || typeof patch !== 'object') {
        return;
    }
    const update = {};
    STATE_KEYS.forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(patch, key)) {
            update[key] = patch[key];
            if (ctx.pagination && typeof ctx.pagination === 'object') {
                ctx.pagination[key] = patch[key];
            }
            ctx[key] = patch[key];
        }
    });
    if (typeof ctx.setData === 'function') {
        const dataUpdate = {};
        Object.keys(update).forEach((key) => {
            dataUpdate[key] = update[key];
            dataUpdate[`pagination.${key}`] = update[key];
        });
        ctx.setData(dataUpdate);
        return;
    }
    Object.assign(ctx, update);
}

function mergeState(ctx, patch) {
    const state = ensureState(ctx);
    Object.assign(state, patch);
    applyData(ctx, patch);
}

function computeHasMore(ctx, result, { pageSize, isRefresh, fallback }) {
    if (result && typeof result.hasMore === 'boolean') {
        return result.hasMore;
    }
    const config = ctx.__paginationConfig || {};
    if (typeof config.computeHasMore === 'function') {
        try {
            const computed = config.computeHasMore.call(ctx, result, {
                page: ctx.__paginationState.page,
                pageSize,
                isRefresh
            });
            if (typeof computed === 'boolean') {
                return computed;
            }
        } catch (error) {
            console.warn('[pagination] computeHasMore 执行失败', error);
        }
    }
    if (result && Array.isArray(result.list)) {
        if (typeof pageSize === 'number') {
            return result.list.length >= pageSize;
        }
        return result.list.length > 0;
    }
    if (result && Array.isArray(result.items)) {
        if (typeof pageSize === 'number') {
            return result.items.length >= pageSize;
        }
        return result.items.length > 0;
    }
    return typeof fallback === 'boolean' ? fallback : true;
}

async function runLoader(ctx, { isRefresh, extra = {}, fromPullDown = false } = {}) {
    const config = ctx.__paginationConfig;
    if (!config || typeof config.loader !== 'function') {
        console.warn('[pagination] 尚未通过 initPagination 注册加载函数');
        return null;
    }

    ensureState(ctx);
    const state = ctx.__paginationState;
    if (!isRefresh && state.hasMore === false) {
        return null;
    }
    if (state.isLoading || state.isLoadingMore) {
        return null;
    }

    const currentPage = isRefresh ? 0 : state.page;
    const isFirstPage = currentPage === 0;
    mergeState(ctx, {
        isLoading: isFirstPage,
        isLoadingMore: !isFirstPage
    });

    const loaderArgs = {
        page: currentPage,
        pageSize: config.pageSize,
        isRefresh,
        isFirstPage,
        extra
    };

    let result;
    try {
        if (typeof config.beforeLoad === 'function') {
            config.beforeLoad.call(ctx, loaderArgs);
        }

        result = await config.loader.call(ctx, loaderArgs);

        const nextPage = currentPage + 1;
        const nextHasMore = computeHasMore(ctx, result, {
            pageSize: config.pageSize,
            isRefresh,
            fallback: isRefresh ? true : state.hasMore
        });

        mergeState(ctx, {
            page: nextPage,
            hasMore: nextHasMore
        });

        if (typeof config.afterLoad === 'function') {
            config.afterLoad.call(ctx, result, loaderArgs);
        }
    } catch (error) {
        if (typeof config.onError === 'function') {
            config.onError.call(ctx, error, loaderArgs);
        } else {
            console.error('[pagination] 加载数据失败', error);
        }
        throw error;
    } finally {
        mergeState(ctx, {
            isLoading: false,
            isLoadingMore: false
        });
        if (isRefresh && (config.autoStopPullDown !== false) && fromPullDown && typeof uni !== 'undefined' && typeof uni.stopPullDownRefresh === 'function') {
            try {
                uni.stopPullDownRefresh();
            } catch (error) {
                console.warn('[pagination] stopPullDownRefresh 调用失败', error);
            }
        }
    }

    return result;
}

module.exports = {
    data() {
        return {
            pagination: { ...DEFAULT_STATE },
            ...DEFAULT_STATE
        };
    },
    created() {
        ensureState(this);
    },
    onReachBottom() {
        if (!this.__paginationConfig) {
            return;
        }
        this.loadNext().catch(() => {
            /* 错误已在 runLoader 中处理 */
        });
    },
    onPullDownRefresh() {
        if (!this.__paginationConfig) {
            return;
        }
        this.refresh({ fromPullDown: true }).catch(() => {
            /* 错误已在 runLoader 中处理 */
        });
    },
    methods: {
        initPagination(loader, options = {}) {
            if (typeof loader !== 'function') {
                throw new TypeError('[pagination] initPagination 需要传入函数类型的 loader');
            }
            const {
                pageSize = 10,
                immediate = true,
                autoStopPullDown = true,
                computeHasMore: computeFn,
                beforeLoad,
                afterLoad,
                onError
            } = options;

            this.__paginationConfig = {
                loader,
                pageSize,
                immediate,
                autoStopPullDown,
                computeHasMore: computeFn,
                beforeLoad,
                afterLoad,
                onError
            };

            mergeState(this, { ...DEFAULT_STATE });

            if (immediate) {
                return this.refresh({ fromPullDown: false });
            }
            return Promise.resolve();
        },

        refresh(options = {}) {
            ensureState(this);
            mergeState(this, {
                page: 0,
                hasMore: true
            });
            return runLoader(this, { isRefresh: true, ...options });
        },

        loadNext(options = {}) {
            return runLoader(this, { isRefresh: false, ...options });
        },

        getPaginationState() {
            ensureState(this);
            return { ...this.__paginationState };
        }
    }
};
