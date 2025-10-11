export const EVENTS = {
  AVATAR_UPDATED: 'avatar-updated',
  POST_CREATED: 'post-created',
  FAVORITE_CHANGED: 'favorite-changed', // { userId, postId?, favored }
};

export function emitAvatarUpdated(userId) {
  try { if (userId && uni && uni.$emit) uni.$emit(EVENTS.AVATAR_UPDATED, { userId }); } catch (_) {}
}

export function emitPostCreated(userId) {
  try { if (userId && uni && uni.$emit) uni.$emit(EVENTS.POST_CREATED, { userId }); } catch (_) {}
}

export function emitFavoriteChanged({ userId, postId, favored }) {
  try { if (userId && uni && uni.$emit) uni.$emit(EVENTS.FAVORITE_CHANGED, { userId, postId, favored: !!favored }); } catch (_) {}
}

export default {
  EVENTS,
  emitAvatarUpdated,
  emitPostCreated,
  emitFavoriteChanged,
};

