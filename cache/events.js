import { EVENTS } from '@/utils/events.js';
import cacheManager from './core/manager.js';
import likeStatusCache from './stores/like-status.js';
import { updateCommentLikeCache, persistToStorage } from '@/utils/commentLikeStatusSync.js';
import { invalidateHomePosts } from '@/api-cache/home-posts.js';
import { invalidatePostList } from '@/api-cache/post-list.js';
import { clearDiscoverCache } from '@/api-cache/discover.js';
import { invalidateUserInfo, invalidateUserPosts } from '@/api-cache/user-profile.js';
import { syncPostDetailCommentCount } from '@/api-cache/post.js';
import { updateUnreadCache } from '@/api-cache/unread.js';

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
      const uid = payload.userId || payload.userID || payload.uid;
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
      const { commentId, likes, liked } = payload;
      if (!commentId) return;

      try {
        updateCommentLikeCache(commentId, likes, liked);
        persistToStorage(commentId, likes, liked);
      } catch (_) {}
    });

    uni.$on(EVENTS.COMMENT_COUNT_CHANGED, (payload = {}) => {
      const { postId, commentCount } = payload;
      if (!postId || typeof commentCount !== 'number') return;

      try {
        const nsStats = cacheManager.getStats?.() || {};
        const targets = Object.keys(nsStats).filter((n) => (
          n === 'posts:list' || n.startsWith('posts:') || n.startsWith('me:posts') || n.startsWith('userPosts:')
        ));

        syncPostDetailCommentCount(postId, commentCount);

        targets.forEach((nsName) => {
          try {
            const ns = cacheManager.namespace(nsName);
            ns.keys?.().forEach((key) => {
              ns.update?.(key, (list) => {
                if (!Array.isArray(list)) return list;
                list.forEach((p) => {
                  if (p && (p._id === postId || p.id === postId)) {
                    p.commentCount = commentCount;
                  }
                });
                return list;
              });
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
          updateUnreadCache((prev) => Math.max(0, (prev || 0) + payload.delta));
        }
      } catch (_) {}
    });

    uni.$on(EVENTS.POST_VISIBILITY_CHANGED, (payload = {}) => {
      const { postId, isHidden } = payload;
      if (!postId) return;

      try {
        const nsStats = cacheManager.getStats?.() || {};
        const targets = Object.keys(nsStats).filter((n) => (
          n === 'posts:list' || n.startsWith('posts:') || n.startsWith('userPosts:')
        ));

        if (isHidden) {
          targets.forEach((nsName) => {
            try {
              const ns = cacheManager.namespace(nsName);
              ns.keys?.().forEach((key) => {
                ns.update?.(key, (list) => {
                  if (!Array.isArray(list)) return list;
                  return list.filter((p) => !(p && (p._id === postId || p.id === postId)));
                });
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
  } catch (e) {
    console.warn('[cache/events] init failed:', e);
  }
}

export default { setupCacheEventBridges };
