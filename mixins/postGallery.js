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

module.exports = {
    data() {
        return {
            __galleryImageMeta: {}
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
    },
    methods: {
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
                this.__updateSwiperHeight({ key, selector, originalWidth, originalHeight, minRatio, maxRatio });
            }

            if (type === 'single') {
                const selector = dataset.singleSelector || dataset.imageSelector || `#single-image-${key}`;
                this.__updateClampHeight({ key, selector, originalWidth, originalHeight, minRatio });
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
