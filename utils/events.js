export const EVENTS = {
  AVATAR_UPDATED: 'avatar-updated',
  POST_CREATED: 'post-created',
  FAVORITE_CHANGED: 'favorite-changed', // { userId, postId?, favored }
  LIKE_CHANGED: 'like-changed', // { postId, votes, isLiked, pageTag? }
  COMMENT_LIKE_CHANGED: 'comment-like-changed', // { postId, commentId, likes, liked }
  COMMENT_COUNT_CHANGED: 'comment-count-changed', // { postId, commentCount }
  // 消息未读数变化（统一驱动各处小红点即时更新）
  UNREAD_CHANGED: 'unread-changed', // { count?, delta? }
  POST_VISIBILITY_CHANGED: 'post-visibility-changed', // { postId, isHidden }
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

export function emitCommentCountChanged({ postId, commentCount }) {
  try {
    if (postId && typeof uni !== 'undefined' && uni.$emit) {
      const count = typeof commentCount === 'number' ? commentCount : 0;
      uni.$emit(EVENTS.COMMENT_COUNT_CHANGED, { postId, commentCount: count });
    }
  } catch (_) {}
}

// 未读消息数变化：允许直接传绝对值或增量
export function emitUnreadChanged({ count, delta } = {}) {
  try {
    if (typeof uni !== 'undefined' && uni.$emit) {
      const payload = {};
      if (typeof count === 'number') payload.count = count;
      if (typeof delta === 'number') payload.delta = delta;
      if ('count' in payload || 'delta' in payload) {
        uni.$emit(EVENTS.UNREAD_CHANGED, payload);
      }
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
  emitCommentCountChanged,
  emitUnreadChanged,
  emitPostVisibilityChanged,
};



export function emitPostVisibilityChanged({ postId, isHidden }) {
  try {
    if (postId && typeof uni !== 'undefined' && uni.$emit) {
      uni.$emit(EVENTS.POST_VISIBILITY_CHANGED, { postId, isHidden: !!isHidden });
    }
  } catch (_) {}
}

