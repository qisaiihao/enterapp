/**
 * 缓存事件桥
 * 监听全局事件并触发相应的缓存失效
 */

import { EVENTS } from '@/utils/events.js';

// 延迟加载 API 缓存模块，避免循环依赖
function requireApiCache(name) {
  try {
    return require(`@/api-cache/${name}.js`);
  } catch (e) {
    console.warn(`[cache/events] 无法加载 api-cache/${name}:`, e);
    return null;
  }
}

export function setupCacheEventBridges() {
  try {
    const g = (typeof globalThis !== 'undefined') ? globalThis : window;
    if (g.__CACHE_EVENTS_BRIDGED__) return;
    if (!uni || typeof uni.$on !== 'function') return;

    // POST_CREATED: 新帖发布
    uni.$on(EVENTS.POST_CREATED, () => {
      try {
        const homePosts = requireApiCache('home-posts');
        const postList = requireApiCache('post-list');
        const discover = requireApiCache('discover');

        homePosts?.invalidateHomePosts?.({});
        postList?.invalidatePostList?.({});
        discover?.clearDiscoverCache?.();
      } catch (_) {}
    });

    // AVATAR_UPDATED: 头像更新
    uni.$on(EVENTS.AVATAR_UPDATED, (payload = {}) => {
      const uid = payload.userId || payload.userID || payload.uid;
      if (!uid) return;

      try {
        const userProfile = requireApiCache('user-profile');
        const homePosts = requireApiCache('home-posts');
        const postList = requireApiCache('post-list');
        const discover = requireApiCache('discover');

        userProfile?.invalidateUserInfo?.(uid);
        userProfile?.invalidateUserPosts?.(uid);
        homePosts?.invalidateHomePosts?.({});
        postList?.invalidatePostList?.({});
        discover?.clearDiscoverCache?.();
      } catch (_) {}
    });

    // LIKE_CHANGED: 点赞变更
    uni.$on(EVENTS.LIKE_CHANGED, (payload = {}) => {
      const { postId, votes, isLiked } = payload;
      if (!postId) return;

      try {
        const likeStatusCache = require('./stores/like-status');
        likeStatusCache.updateLikeStatus(postId, votes, isLiked);
        likeStatusCache.syncToListCaches([postId]);
      } catch (_) {}
    });

    // COMMENT_LIKE_CHANGED: 评论点赞变更
    uni.$on(EVENTS.COMMENT_LIKE_CHANGED, (payload = {}) => {
      const { commentId, likes, liked } = payload;
      if (!commentId) return;

      try {
        const commentLikeSync = require('@/utils/commentLikeStatusSync.js');
        commentLikeSync.updateCommentLikeCache?.(commentId, likes, liked);
        commentLikeSync.persistToStorage?.(commentId, likes, liked);
      } catch (_) {}
    });

    // COMMENT_COUNT_CHANGED: 评论数变更
    uni.$on(EVENTS.COMMENT_COUNT_CHANGED, (payload = {}) => {
      const { postId, commentCount } = payload;
      if (!postId || typeof commentCount !== 'number') return;

      try {
        const postApi = requireApiCache('post');
        const cacheManager = require('./core/manager');
        const nsStats = cacheManager.getStats?.() || {};
        const targets = Object.keys(nsStats).filter((n) => (
          n === 'posts:list' || n.startsWith('posts:') || n.startsWith('me:posts') || n.startsWith('userPosts:')
        ));

        postApi?.syncPostDetailCommentCount?.(postId, commentCount);

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

    // UNREAD_CHANGED: 未读消息数变化
    uni.$on(EVENTS.UNREAD_CHANGED, (payload = {}) => {
      try {
        const unread = requireApiCache('unread');
        if (typeof payload.count === 'number') {
          unread?.updateUnreadCache?.(payload.count);
        } else if (typeof payload.delta === 'number') {
          unread?.updateUnreadCache?.((prev) => Math.max(0, (prev || 0) + payload.delta));
        }
      } catch (_) {}
    });

    // POST_VISIBILITY_CHANGED: 帖子可见性变化
    uni.$on(EVENTS.POST_VISIBILITY_CHANGED, (payload = {}) => {
      const { postId, isHidden } = payload;
      if (!postId) return;

      try {
        const cacheManager = require('./core/manager');
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
          const homePosts = requireApiCache('home-posts');
          const postList = requireApiCache('post-list');
          const discover = requireApiCache('discover');

          homePosts?.invalidateHomePosts?.({});
          postList?.invalidatePostList?.({});
          discover?.clearDiscoverCache?.();
        }
      } catch (_) {}
    });

    g.__CACHE_EVENTS_BRIDGED__ = true;
    console.log('✅ [cache/events] 缓存事件桥已初始化');
  } catch (e) {
    console.warn('[cache/events] 初始化失败:', e);
  }
}

export default { setupCacheEventBridges };
