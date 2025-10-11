const { formatRelativeTime } = require('./time.js');

const DEFAULT_AUTHOR_NAME = '匿名用户';
const DEFAULT_AVATAR = '';
const DEFAULT_IMAGE_STYLE = 'height: 0; padding-bottom: 75%;';
const TIME_KEYS = ['createTime', 'postCreateTime', 'publishTime', 'createdAt', 'updateTime'];

const toArray = (value) => {
    if (!value) {
        return [];
    }
    if (Array.isArray(value)) {
        return value.filter(Boolean);
    }
    return [value].filter(Boolean);
};

const resolveTime = (post) => {
    for (const key of TIME_KEYS) {
        if (post[key]) {
            return { key, value: post[key] };
        }
    }
    return null;
};

const normalizePost = (post = {}, options = {}) => {
    const { withTime = true } = options;
    const imageUrls = toArray(post.imageUrls);
    if (imageUrls.length === 0) {
        imageUrls.push(...toArray(post.imageUrl));
    }

    const originalImageUrls = toArray(post.originalImageUrls);
    if (originalImageUrls.length === 0) {
        originalImageUrls.push(...toArray(post.originalImageUrl));
    }
    if (originalImageUrls.length === 0 && imageUrls.length > 0) {
        originalImageUrls.push(...imageUrls);
    }

    const normalized = {
        ...post,
        imageUrls,
        originalImageUrls,
        authorName: post.authorName || DEFAULT_AUTHOR_NAME,
        authorAvatar: typeof post.authorAvatar === 'string' ? post.authorAvatar : DEFAULT_AVATAR
    };

    if (!normalized.imageStyle && imageUrls.length > 0) {
        normalized.imageStyle = DEFAULT_IMAGE_STYLE;
    }

    if (withTime) {
        if (post.formattedCreateTime) {
            normalized.formattedCreateTime = post.formattedCreateTime;
        } else {
            const timeInfo = resolveTime(post);
            if (timeInfo) {
                normalized.formattedCreateTime = formatRelativeTime(timeInfo.value);
            }
        }
    }

    return normalized;
};

const normalizePostList = (posts, options = {}) => {
    if (!Array.isArray(posts)) {
        return [];
    }
    return posts.map((post) => normalizePost(post, options));
};

module.exports = {
    normalizePost,
    normalizePostList
};
