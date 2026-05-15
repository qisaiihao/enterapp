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

function getUserDefaultAvatar(openid) {
  return pickStickerAvatar(openid || 'default-user-avatar');
}

async function ensureUserDefaultAvatar({ db, openid, user }) {
  if (!db || !openid) {
    return normalizeAvatarUrl(user && user.avatarUrl);
  }
  const currentAvatarUrl = normalizeAvatarUrl(user && user.avatarUrl);
  if (!needsDefaultAvatar(currentAvatarUrl)) {
    return currentAvatarUrl;
  }

  const assignedAvatarUrl = getUserDefaultAvatar(openid);
  try {
    await db.collection('users').where({ _openid: openid }).update({
      data: {
        avatarUrl: assignedAvatarUrl
      }
    });
  } catch (error) {
    console.error('[default-avatar] persist user avatar failed', { openid, error });
  }

  if (user && typeof user === 'object') {
    user.avatarUrl = assignedAvatarUrl;
  }
  return assignedAvatarUrl;
}

module.exports = {
  STICKER_AVATAR_PATHS,
  LEGACY_DEFAULT_AVATAR_PATHS,
  isLegacyDefaultAvatar,
  needsDefaultAvatar,
  hashAvatarSeed,
  pickStickerAvatar,
  getUserDefaultAvatar,
  ensureUserDefaultAvatar
};
