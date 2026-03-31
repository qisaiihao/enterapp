import { EVENTS } from '@/utils/events.js';
import { invalidateHomePosts } from '@/api-cache/home-posts.js';
import { invalidatePostList } from '@/api-cache/post-list.js';
import { clearDiscoverCache } from '@/api-cache/discover.js';
import { invalidateUserInfo, invalidateUserPosts } from '@/api-cache/user-profile.js';
import { updateUnreadCache } from '@/api-cache/unread.js';
import cacheManager from '@/cache/core/manager.js';
import likeStatusCache from '@/cache/stores/like-status.js';
import { updateCommentLikeCache, persistToStorage } from '@/utils/commentLikeStatusSync.js';

export function setupCacheEventBridges() {
  try {
    const g = typeof globalThis !== 'undefined' ? globalThis : window;
    if (g.__CACHE_EVENTS_BRIDGED__) return;
    if (typeof uni === 'undefined' || typeof uni.$on !== 'function') return;

    uni.$on(EVENTS.POST_CREATED, () => {
      try {
        invalidateHomePosts({});
        invalidatePostList({});
        clearDiscoverCache();
      } catch (_) {}
    });

    uni.$on(EVENTS.AVATAR_UPDATED, (payload = {}) => {
      const uid = payload && (payload.userId || payload.userID || payload.uid);
      if (!uid) return;

      try {
        invalidateUserInfo(uid);
        invalidateUserPosts(uid);
        invalidateHomePosts({});
        invalidatePostList({});
        clearDiscoverCache();
      } catch (_) {}
    });

    uni.$on(EVENTS.LIKE_CHANGED, (payload = {}) => {
      const { postId, votes, isLiked } = payload;
      if (!postId) return;

      try {
        likeStatusCache.updateLikeStatus(postId, votes, isLiked);
        likeStatusCache.syncToListCaches([postId]);
      } catch (_) {}
    });

    uni.$on(EVENTS.COMMENT_LIKE_CHANGED, (payload = {}) => {
      const { commentId, likes, liked } = payload || {};
      if (!commentId) return;

      try {
        updateCommentLikeCache(commentId, likes, liked);
        persistToStorage(commentId, likes, liked);
      } catch (_) {}
    });

    uni.$on(EVENTS.COMMENT_COUNT_CHANGED, (payload = {}) => {
      try {
        const postId = payload && payload.postId;
        const commentCount = payload && typeof payload.commentCount === 'number' ? payload.commentCount : undefined;
        if (!postId || typeof commentCount !== 'number') return;

        const nsStats = cacheManager.getStats ? cacheManager.getStats() : {};
        const nsNames = Object.keys(nsStats);
        const targets = nsNames.filter((n) => (
          n === 'posts:list' || n === 'posts:home' || n === 'posts:discover' || n.startsWith('posts:tag:') || n.startsWith('posts:') || n.startsWith('me:posts') || n.startsWith('userPosts:')
        ));

        targets.forEach((nsName) => {
          try {
            const ns = cacheManager.namespace(nsName);
            const keys = (ns.keys && ns.keys()) || [];
            keys.forEach((key) => {
              try {
                ns.update(key, (list) => {
                  if (!Array.isArray(list)) return list;
                  for (let i = 0; i < list.length; i += 1) {
                    const p = list[i];
                    if (p && (p._id === postId || p.id === postId)) {
                      p.commentCount = commentCount;
                    }
                  }
                  return list;
                });
              } catch (_) {}
            });
          } catch (_) {}
        });
      } catch (_) {}
    });

    uni.$on(EVENTS.UNREAD_CHANGED, (payload = {}) => {
      try {
        if (typeof payload.count === 'number') {
          updateUnreadCache(payload.count);
        } else if (typeof payload.delta === 'number') {
          updateUnreadCache((prev) => Math.max(0, (prev || 0) + (payload.delta || 0)));
        }
      } catch (_) {}
    });

    uni.$on(EVENTS.POST_VISIBILITY_CHANGED, (payload = {}) => {
      try {
        const postId = payload && payload.postId;
        const isHidden = !!(payload && payload.isHidden);
        if (!postId) return;

        const nsStats = cacheManager.getStats ? cacheManager.getStats() : {};
        const nsNames = Object.keys(nsStats);
        const targets = nsNames.filter((n) => (
          n === 'posts:list' || n === 'posts:home' || n === 'posts:discover' || n.startsWith('posts:tag:') || n.startsWith('posts:') || n.startsWith('userPosts:')
        ));

        if (isHidden) {
          targets.forEach((nsName) => {
            try {
              const ns = cacheManager.namespace(nsName);
              const keys = (ns.keys && ns.keys()) || [];
              keys.forEach((key) => {
                try {
                  ns.update(key, (list) => {
                    if (!Array.isArray(list)) return list;
                    return list.filter((p) => !(p && (p._id === postId || p.id === postId)));
                  });
                } catch (_) {}
              });
            } catch (_) {}
          });
        } else {
          invalidateHomePosts({});
          invalidatePostList({});
          clearDiscoverCache();
        }
      } catch (_) {}
    });

    g.__CACHE_EVENTS_BRIDGED__ = true;
  } catch (_) {}
}

export default { setupCacheEventBridges };
