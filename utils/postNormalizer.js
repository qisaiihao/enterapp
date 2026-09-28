import { formatRelativeTime } from './time.js';
import { resolvePostAuthorAvatar } from './defaultAvatar.js';

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
        publishMode: post.publishMode || (post.isDiscussion ? 'discussion' : (post.isPoem || post.isSeries ? 'poem' : 'normal')),
        isPoem: post.schemaVersion === 2 ? post.publishMode === 'poem' : (post.isPoem === true || post.publishMode === 'poem'),
        isDiscussion: post.schemaVersion === 2 ? post.publishMode === 'discussion' : (post.isDiscussion === true || post.publishMode === 'discussion'),
        isActivityPost: post.isActivityPost === true || Boolean(post.activityId),
        tags: toArray(post.tags),
        sentenceGroups: toArray(post.sentenceGroups).length ? post.sentenceGroups : (post.schemaVersion === 2 ? [] : toArray(post.discussionSentences)),
        highlightLines: toArray(post.highlightLines).length ? post.highlightLines : (post.schemaVersion === 2 ? [] : toArray(post.highlightSentence)),
        highlightSentence: toArray(post.highlightLines)[0] || (post.schemaVersion === 2 ? '' : post.highlightSentence) || '',
        seriesBlocks: toArray(post.seriesBlocks),
        seriesBlockCount: post.seriesBlockCount || toArray(post.seriesBlocks).length,
        imageUrls,
        originalImageUrls,
        authorName: post.authorName || post.authorNameSnapshot || DEFAULT_AUTHOR_NAME,
        authorAvatar: resolvePostAuthorAvatar(post)
    };
    // 缓存中可能仍有旧接口的作者快照，匿名帖不能显示这些身份字段。
    normalized.isAnonymous = post.isAnonymous === true || post.isAnonymous === 'true' || post._openid === '123456';
    delete normalized.realAuthorOpenid;
    if (normalized.isAnonymous) {
        normalized._openid = '123456';
        normalized.authorName = post.anonymousAuthorName || '匿名用户';
        normalized.authorNameSnapshot = normalized.authorName;
        if (normalized.author) normalized.author = normalized.authorName;
        normalized.authorSignature = '';
        normalized.authorAvatar = resolvePostAuthorAvatar(normalized);
        normalized.authorAvatarSnapshot = normalized.authorAvatar;
    }

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

export {
    normalizePost,
    normalizePostList
};

export default {
    normalizePost,
    normalizePostList
};
