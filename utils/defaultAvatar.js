const STICKER_AVATAR_PATHS = Object.freeze([
    '/static/sticker/winggrab_raven.png',
    '/static/sticker/rat_enter.png',
    '/static/sticker/handgrab_enter.png',
    '/static/sticker/barrel_rat.png',
    '/static/sticker/raven_stones.png',
    '/static/sticker/poem_writer.png',
    '/static/sticker/street_raven.png',
    '/static/sticker/rat_drunk.png',
    '/static/sticker/raven_enter.png',
    '/static/sticker/poem_wine.png'
]);

const LEGACY_DEFAULT_AVATAR_PATHS = Object.freeze([
    '/static/images/avatar.png',
    '/images/avatar.png',
    '/static/images/icons/avatar.png'
]);

function normalizeAvatarUrl(url) {
    return typeof url === 'string' ? url.trim() : '';
}

function isStickerAvatar(url) {
    const normalized = normalizeAvatarUrl(url);
    return normalized.startsWith('/static/sticker/');
}

function isLegacyDefaultAvatar(url) {
    const normalized = normalizeAvatarUrl(url);
    return !normalized || LEGACY_DEFAULT_AVATAR_PATHS.includes(normalized);
}

function needsDefaultAvatar(url) {
    return isLegacyDefaultAvatar(url);
}

function hashAvatarSeed(seed) {
    const source = String(seed || 'default-avatar');
    let hash = 2166136261;
    for (let index = 0; index < source.length; index += 1) {
        hash ^= source.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return Math.abs(hash >>> 0);
}

function pickStickerAvatar(seed) {
    if (!STICKER_AVATAR_PATHS.length) {
        return '';
    }
    const index = hashAvatarSeed(seed) % STICKER_AVATAR_PATHS.length;
    return STICKER_AVATAR_PATHS[index];
}

function getUserAvatarSeed(user = {}) {
    if (!user || typeof user !== 'object') {
        return 'default-user-avatar';
    }
    return (
        user._openid ||
        user.userId ||
        user.openid ||
        user.realAuthorOpenid ||
        user.poemId ||
        user.nickName ||
        user.authorName ||
        'default-user-avatar'
    );
}

function resolveUserAvatar(avatarUrl, seed) {
    const normalized = normalizeAvatarUrl(avatarUrl);
    if (normalized && !isLegacyDefaultAvatar(normalized)) {
        return normalized;
    }
    return pickStickerAvatar(seed);
}

function resolveUserObjectAvatar(user = {}) {
    return resolveUserAvatar(user && user.avatarUrl, getUserAvatarSeed(user));
}

function resolveAnonymousAvatar(contentId, fallbackSeed = 'anonymous-avatar') {
    return pickStickerAvatar(contentId || fallbackSeed);
}

function resolvePostAuthorAvatar(post = {}) {
    if (post && post.isAnonymous) {
        return resolveAnonymousAvatar(post._id || post.postId || post.id, post._openid || post.realAuthorOpenid);
    }
    return resolveUserAvatar(
        (post && (post.authorAvatar || post.avatarUrl || post.authorAvatarSnapshot)) || '',
        (post && (post._openid || post.realAuthorOpenid || post.authorOpenid || post.poemId || post.authorName)) || ''
    );
}

function resolveCommentAuthorAvatar(comment = {}) {
    if (comment && comment.isAnonymous) {
        return resolveAnonymousAvatar(comment._id || comment.commentId || comment.id, comment._openid || comment.realAuthorOpenid);
    }
    return resolveUserAvatar(
        (comment && (comment.authorAvatar || comment.avatarUrl)) || '',
        (comment && (comment._openid || comment.realAuthorOpenid || comment.authorName)) || ''
    );
}

export {
    STICKER_AVATAR_PATHS,
    LEGACY_DEFAULT_AVATAR_PATHS,
    isStickerAvatar,
    isLegacyDefaultAvatar,
    needsDefaultAvatar,
    hashAvatarSeed,
    pickStickerAvatar,
    getUserAvatarSeed,
    resolveUserAvatar,
    resolveUserObjectAvatar,
    resolveAnonymousAvatar,
    resolvePostAuthorAvatar,
    resolveCommentAuthorAvatar
};

export default {
    STICKER_AVATAR_PATHS,
    LEGACY_DEFAULT_AVATAR_PATHS,
    isStickerAvatar,
    isLegacyDefaultAvatar,
    needsDefaultAvatar,
    hashAvatarSeed,
    pickStickerAvatar,
    getUserAvatarSeed,
    resolveUserAvatar,
    resolveUserObjectAvatar,
    resolveAnonymousAvatar,
    resolvePostAuthorAvatar,
    resolveCommentAuthorAvatar
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        STICKER_AVATAR_PATHS,
        LEGACY_DEFAULT_AVATAR_PATHS,
        isStickerAvatar,
        isLegacyDefaultAvatar,
        needsDefaultAvatar,
        hashAvatarSeed,
        pickStickerAvatar,
        getUserAvatarSeed,
        resolveUserAvatar,
        resolveUserObjectAvatar,
        resolveAnonymousAvatar,
        resolvePostAuthorAvatar,
        resolveCommentAuthorAvatar
    };
}
