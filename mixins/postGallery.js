import { LAYOUT_CHANGED_EVENT, getLayoutSnapshot } from '@/utils/layout.js';

const DEFAULT_MIN_RATIO = 9 / 16; // 0.5625
const DEFAULT_MAX_RATIO = 16 / 9; // 1.777...

function createQuery(ctx) {
    if (typeof uni === 'undefined' || typeof uni.createSelectorQuery !== 'function') {
        return null;
    }
    return uni.createSelectorQuery().in(ctx);
}

function applySet(ctx, path, value) {
    if (typeof ctx.setData === 'function') {
        ctx.setData({ [path]: value });
        return;
    }
    const normalized = path.replace(/\[(.*?)\]/g, '.$1').replace(/^\./, '');
    const segments = normalized.split('.');
    let current = ctx;
    for (let i = 0; i < segments.length - 1; i += 1) {
        const seg = segments[i];
        if (!current[seg] || typeof current[seg] !== 'object') {
            current[seg] = {};
        }
        current = current[seg];
    }
    current[segments[segments.length - 1]] = value;
}

function getGalleryKey(dataset) {
    if (dataset.galleryKey !== undefined && dataset.galleryKey !== null) {
        return dataset.galleryKey;
    }
    if (dataset.postindex !== undefined && dataset.postindex !== null) {
        return dataset.postindex;
    }
    if (dataset.postIndex !== undefined && dataset.postIndex !== null) {
        return dataset.postIndex;
    }
    if (dataset.index !== undefined && dataset.index !== null) {
        return dataset.index;
    }
    if (dataset.postid !== undefined && dataset.postid !== null) {
        return dataset.postid;
    }
    if (dataset.postId !== undefined && dataset.postId !== null) {
        return dataset.postId;
    }
    return dataset.imgindex !== undefined ? `gallery-${dataset.imgindex}` : 'gallery';
}

function clampRatio(ratio, minRatio, maxRatio) {
    if (ratio > maxRatio) {
        return maxRatio;
    }
    if (ratio < minRatio) {
        return minRatio;
    }
    return ratio;
}

const postGalleryMixin = {
    data() {
        return {
            __galleryImageMeta: {},
            __galleryEntries: {}
        };
    },
    created() {
        if (typeof this.swiperHeights === 'undefined') {
            this.swiperHeights = {};
        }
        if (typeof this.imageClampHeights === 'undefined') {
            this.imageClampHeights = {};
        }
        if (typeof this.imageCache === 'undefined') {
            this.imageCache = {};
        }
        this.__galleryLastWindowWidth = getLayoutSnapshot().windowWidth;
        this.__galleryResizeTimer = null;
        if (typeof uni !== 'undefined' && typeof uni.$on === 'function') {
            this.__galleryLayoutHandler = (snapshot) => {
                const nextWidth = snapshot && Number(snapshot.windowWidth);
                if (!nextWidth || nextWidth === this.__galleryLastWindowWidth) {
                    return;
                }
                this.__galleryLastWindowWidth = nextWidth;
                this.scheduleGalleryRecalculate();
            };
            uni.$on(LAYOUT_CHANGED_EVENT, this.__galleryLayoutHandler);
        }
    },
    beforeUnmount() {
        this.__cleanupGalleryLayoutListener();
    },
    onUnload() {
        this.__cleanupGalleryLayoutListener();
    },
    methods: {
        __cleanupGalleryLayoutListener() {
            if (this.__galleryResizeTimer) {
                clearTimeout(this.__galleryResizeTimer);
                this.__galleryResizeTimer = null;
            }
            if (this.__galleryLayoutHandler && typeof uni !== 'undefined' && typeof uni.$off === 'function') {
                uni.$off(LAYOUT_CHANGED_EVENT, this.__galleryLayoutHandler);
                this.__galleryLayoutHandler = null;
            }
        },

        scheduleGalleryRecalculate() {
            if (this.__galleryResizeTimer) {
                clearTimeout(this.__galleryResizeTimer);
            }
            this.__galleryResizeTimer = setTimeout(() => {
                this.__galleryResizeTimer = null;
                this.recalculateGalleryHeights();
            }, 120);
        },

        recalculateGalleryHeights() {
            const entries = this.__galleryEntries || {};
            Object.keys(entries).forEach((entryKey) => {
                const entry = entries[entryKey];
                if (!entry) return;
                if (entry.type === 'multi') {
                    this.__updateSwiperHeight(entry);
                } else if (entry.type === 'single') {
                    this.__updateClampHeight(entry);
                }
            });
        },

        onImageLoad(e) {
            if (!e || !e.detail || !e.currentTarget) {
                return;
            }
            const dataset = e.currentTarget.dataset || {};
            const { width: originalWidth, height: originalHeight } = e.detail;
            if (!originalWidth || !originalHeight) {
                return;
            }

            const key = getGalleryKey(dataset);
            const imgIndex = typeof dataset.imgindex !== 'undefined' ? dataset.imgindex : dataset.imgIndex || 0;
            const type = dataset.type || dataset.imageType || 'single';

            const cacheKey = `${key}_${imgIndex}`;
            if (this.__galleryImageMeta) {
                this.__galleryImageMeta[cacheKey] = { width: originalWidth, height: originalHeight };
            }
            if (this.imageCache) {
                this.imageCache[cacheKey] = { width: originalWidth, height: originalHeight };
            }

            const minRatio = Number(this.galleryMinImageRatio) || DEFAULT_MIN_RATIO;
            const maxRatio = Number(this.galleryMaxImageRatio) || DEFAULT_MAX_RATIO;

            if (type === 'multi' && Number(imgIndex) === 0) {
                const selector = dataset.swiperSelector || dataset.gallerySelector || `#swiper-${key}`;
                const entry = { type: 'multi', key, selector, originalWidth, originalHeight, minRatio, maxRatio };
                if (this.__galleryEntries) {
                    this.__galleryEntries[`multi:${key}`] = entry;
                }
                this.__updateSwiperHeight(entry);
            }

            if (type === 'single') {
                const selector = dataset.singleSelector || dataset.imageSelector || `#single-image-${key}`;
                const entry = { type: 'single', key, selector, originalWidth, originalHeight, minRatio };
                if (this.__galleryEntries) {
                    this.__galleryEntries[`single:${key}`] = entry;
                }
                this.__updateClampHeight(entry);
            }
        },

        __updateSwiperHeight({ key, selector, originalWidth, originalHeight, minRatio, maxRatio }) {
            if (!selector) {
                return;
            }
            const query = createQuery(this);
            if (!query) {
                return;
            }
            query
                .select(selector)
                .boundingClientRect((rect) => {
                    if (!rect || !rect.width) {
                        return;
                    }
                    const actualRatio = originalWidth / originalHeight;
                    const targetRatio = clampRatio(actualRatio, minRatio, maxRatio);
                    const displayHeight = rect.width / targetRatio;
                    applySet(this, `swiperHeights[${key}]`, displayHeight);
                })
                .exec();
        },

        __updateClampHeight({ key, selector, originalWidth, originalHeight, minRatio }) {
            const actualRatio = originalWidth / originalHeight;
            if (actualRatio >= minRatio) {
                return;
            }
            const query = selector ? createQuery(this) : null;
            if (selector && query) {
                query
                    .select(selector)
                    .boundingClientRect((rect) => {
                        if (!rect || !rect.width) {
                            return;
                        }
                        const displayHeight = rect.width / minRatio;
                        applySet(this, `imageClampHeights.${key}`, displayHeight);
                    })
                    .exec();
                return;
            }
            if (this.galleryFallbackWidth) {
                const displayHeight = this.galleryFallbackWidth / minRatio;
                applySet(this, `imageClampHeights.${key}`, displayHeight);
            }
        }
    }
};

export { postGalleryMixin };
export default postGalleryMixin;
