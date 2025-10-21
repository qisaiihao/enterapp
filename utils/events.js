export const EVENTS = {
  AVATAR_UPDATED: 'avatar-updated',
  POST_CREATED: 'post-created',
  FAVORITE_CHANGED: 'favorite-changed', // { userId, postId?, favored }
  LIKE_CHANGED: 'like-changed', // { postId, votes, isLiked, pageTag? }
  COMMENT_LIKE_CHANGED: 'comment-like-changed', // { postId, commentId, likes, liked }
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

export function emitLikeChanged({ postId, votes, isLiked, pageTag }) {
  try {
    if (postId && typeof uni !== 'undefined' && uni.$emit) {
      uni.$emit(EVENTS.LIKE_CHANGED, { postId, votes, isLiked: !!isLiked, pageTag });
    }
  } catch (_) {}
}

export function emitCommentLikeChanged({ postId, commentId, likes, liked }) {
  try {
    if (commentId && typeof uni !== 'undefined' && uni.$emit) {
      uni.$emit(EVENTS.COMMENT_LIKE_CHANGED, { postId, commentId, likes, liked: !!liked });
    }
  } catch (_) {}
}

export default {
  EVENTS,
  emitAvatarUpdated,
  emitPostCreated,
  emitFavoriteChanged,
  emitLikeChanged,
  emitCommentLikeChanged,
};
