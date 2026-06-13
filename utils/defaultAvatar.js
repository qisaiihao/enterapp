import { getCurrentPlatform } from './platformDetector.js';

const STICKER_AVATAR_LOCAL_BASE_PATH = '/static/sticker/';
const STICKER_AVATAR_CLOUD_BASE_URL = 'https://636c-cloud1-5gb0pbyl400845f5-1378788263.tcb.qcloud.la/sticker/';

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

const STICKER_AVATAR_FILE_NAMES = Object.freeze(
    STICKER_AVATAR_PATHS.map((avatarPath) => avatarPath.slice(STICKER_AVATAR_LOCAL_BASE_PATH.length))
);
const STICKER_AVATAR_FILE_NAME_SET = new Set(STICKER_AVATAR_FILE_NAMES);

const LEGACY_DEFAULT_AVATAR_PATHS = Object.freeze([
    '/static/images/avatar.png',
    '/images/avatar.png',
    '/static/images/icons/avatar.png'
]);

function normalizeAvatarUrl(url) {
    return typeof url === 'string' ? url.trim() : '';
}

function stripUrlQueryAndHash(url) {
    return String(url || '').split(/[?#]/)[0];
}

function getStickerAvatarFileName(url) {
    const cleanUrl = stripUrlQueryAndHash(normalizeAvatarUrl(url));
    if (!cleanUrl) {
        return '';
    }
    const slashIndex = cleanUrl.lastIndexOf('/');
    return slashIndex >= 0 ? cleanUrl.slice(slashIndex + 1) : cleanUrl;
}

function isKnownStickerAvatarFileName(fileName) {
    return STICKER_AVATAR_FILE_NAME_SET.has(fileName);
}

function isLocalStickerAvatar(url) {
    const normalized = stripUrlQueryAndHash(normalizeAvatarUrl(url));
    return (
        normalized.startsWith(STICKER_AVATAR_LOCAL_BASE_PATH) &&
        isKnownStickerAvatarFileName(getStickerAvatarFileName(normalized))
    );
}

function isCloudStickerAvatar(url) {
    const normalized = stripUrlQueryAndHash(normalizeAvatarUrl(url));
    return (
        normalized.startsWith(STICKER_AVATAR_CLOUD_BASE_URL) &&
        isKnownStickerAvatarFileName(getStickerAvatarFileName(normalized))
    );
}

function isStickerAvatar(url) {
    return isLocalStickerAvatar(url) || isCloudStickerAvatar(url);
}

function normalizeStickerAvatarPath(url) {
    const normalized = normalizeAvatarUrl(url);
    if (!normalized) {
        return '';
    }

    const fileName = getStickerAvatarFileName(normalized);
    if (!isKnownStickerAvatarFileName(fileName)) {
        return normalized;
    }

    if (isLocalStickerAvatar(normalized) || isCloudStickerAvatar(normalized)) {
        return `${STICKER_AVATAR_LOCAL_BASE_PATH}${fileName}`;
    }

    return normalized;
}

function shouldUseCloudStickerAvatar() {
    try {
        return getCurrentPlatform() === 'mp-weixin';
    } catch (error) {
        return false;
    }
}

function resolveStickerAvatarSource(url) {
    const normalized = normalizeStickerAvatarPath(url);
    if (!isStickerAvatar(normalized)) {
        return normalized;
    }

    const fileName = getStickerAvatarFileName(normalized);
    if (!isKnownStickerAvatarFileName(fileName)) {
        return normalized;
    }

    if (shouldUseCloudStickerAvatar()) {
        return `${STICKER_AVATAR_CLOUD_BASE_URL}${fileName}`;
    }

    return `${STICKER_AVATAR_LOCAL_BASE_PATH}${fileName}`;
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
    return resolveStickerAvatarSource(STICKER_AVATAR_PATHS[index]);
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
    if (normalized && isStickerAvatar(normalized)) {
        return resolveStickerAvatarSource(normalized);
    }
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
    STICKER_AVATAR_LOCAL_BASE_PATH,
    STICKER_AVATAR_CLOUD_BASE_URL,
    STICKER_AVATAR_FILE_NAMES,
    LEGACY_DEFAULT_AVATAR_PATHS,
    normalizeStickerAvatarPath,
    resolveStickerAvatarSource,
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
    STICKER_AVATAR_LOCAL_BASE_PATH,
    STICKER_AVATAR_CLOUD_BASE_URL,
    STICKER_AVATAR_FILE_NAMES,
    LEGACY_DEFAULT_AVATAR_PATHS,
    normalizeStickerAvatarPath,
    resolveStickerAvatarSource,
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
        STICKER_AVATAR_LOCAL_BASE_PATH,
        STICKER_AVATAR_CLOUD_BASE_URL,
        STICKER_AVATAR_FILE_NAMES,
        LEGACY_DEFAULT_AVATAR_PATHS,
        normalizeStickerAvatarPath,
        resolveStickerAvatarSource,
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
