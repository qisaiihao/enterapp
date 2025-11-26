import { EVENTS } from '@/utils/events.js';
import { invalidateHomePosts } from '@/api-cache/home-posts.js';
import { invalidatePostList } from '@/api-cache/post-list.js';
import { clearDiscoverCache } from '@/api-cache/discover.js';
import { invalidateUserInfo, invalidateUserPosts } from '@/api-cache/user-profile.js';

export function setupCacheEventBridges() {
  try {
    const g = (typeof globalThis !== 'undefined') ? globalThis : window;
    if (g.__CACHE_EVENTS_BRIDGED__) return;
    if (!uni || typeof uni.$on !== 'function') return;

    // 新帖发布：刷新首页与发现页相关缓存
    // 由于所有页面都使用 posts:list 命名空间，失效首页缓存会清除所有相关缓存
    uni.$on(EVENTS.POST_CREATED, (payload = {}) => {
      try { 
        // 失效所有首页缓存（包括所有筛选条件）
        invalidateHomePosts({}); 
        // 失效所有帖子列表缓存（跨页面共享的缓存）
        invalidatePostList({});
      } catch (_) {}
      try { clearDiscoverCache(); } catch (_) {}
    });

    // 头像更新：失效对应用户资料与TA的个人主页分页，同时失效公共列表缓存
    uni.$on(EVENTS.AVATAR_UPDATED, (payload = {}) => {
      const uid = payload && (payload.userId || payload.userID || payload.uid);
      if (!uid) return;
      try { invalidateUserInfo(uid); } catch (_) {}
      try { invalidateUserPosts(uid); } catch (_) {}
      // 失效公共列表缓存，确保下次查询列表时能看到更新后的头像昵称
      // 由于所有页面都使用 posts:list 命名空间，失效首页缓存会清除所有相关缓存
      try { 
        invalidateHomePosts({}); 
        // 失效所有帖子列表缓存（跨页面共享的缓存）
        invalidatePostList({});
      } catch (_) {}
      try { clearDiscoverCache(); } catch (_) {}
      // 失效所有标签页缓存（标签页也使用 posts:list 命名空间，但为了兼容性保留此逻辑）
      try {
        const { invalidateTagPosts } = require('@/api-cache/tag-posts.js');
        // 由于标签页也使用 posts:list 命名空间，上面的 invalidatePostList 已经失效了
        // 这里保留代码以防未来有独立的标签命名空间
      } catch (_) {}
    });

    // 收藏变更：当前阶段按用户要求暂不做整页失效
    // uni.$on(EVENTS.FAVORITE_CHANGED, () => { /* no-op */ });

    // 点赞变更：更新 like:status 专用缓存并同步到列表缓存
    uni.$on(EVENTS.LIKE_CHANGED, (payload = {}) => {
      try {
        const postId = payload.postId;
        const votes = payload.votes;
        const isLiked = payload.isLiked;
        if (!postId) return;
        // 使用统一的点赞状态缓存
        try { 
          const likeStatusCache = require('@/cache/stores/like-status');
          likeStatusCache.updateLikeStatus(postId, votes, isLiked);
          likeStatusCache.syncToListCaches([postId]);
        } catch (_) {}
      } catch (_) {}
    });

    // 评论点赞变更：仅维护专用缓存，页面自行监听精确更新
    uni.$on(EVENTS.COMMENT_LIKE_CHANGED, (payload = {}) => {
      try {
        const { commentId, likes, liked } = payload || {};
        if (!commentId) return;
        try { const { updateCommentLikeCache, persistToStorage } = require('@/utils/commentLikeStatusSync.js');
          updateCommentLikeCache(commentId, likes, liked);
          persistToStorage(commentId, likes, liked);
        } catch (_) {}
      } catch (_) {}
    });

    // 评论数变更：更新各列表缓存中对应 post 的 commentCount
    uni.$on(EVENTS.COMMENT_COUNT_CHANGED, (payload = {}) => {
      try {
        const postId = payload && payload.postId;
        const commentCount = (payload && typeof payload.commentCount === 'number') ? payload.commentCount : undefined;
        if (!postId || typeof commentCount !== 'number') return;
        try {
          const cacheManager = require('@/_utils/cache-manager');
          const nsStats = cacheManager.getStats ? cacheManager.getStats() : {};
          const nsNames = Object.keys(nsStats);
          // 由于所有帖子列表都使用 posts:list 命名空间，只需要更新这个命名空间即可
          // 但为了兼容性，仍然遍历所有可能的命名空间
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
                    let changed = false;
                    for (let i = 0; i < list.length; i += 1) {
                      const p = list[i];
                      if (p && (p._id === postId || p.id === postId)) {
                        p.commentCount = commentCount;
                        changed = true;
                      }
                    }
                    return changed ? list : list;
                  });
                } catch (_) {}
              });
            } catch (_) {}
          });
        } catch (_) {}
      } catch (_) {}
    });

    // 未读消息数变化：同步到 unread 缓存，驱动组件即时更新
    uni.$on(EVENTS.UNREAD_CHANGED, (payload = {}) => {
      try {
        const { updateUnreadCache } = require('@/api-cache/unread.js');
        if (typeof payload.count === 'number') {
          updateUnreadCache(payload.count);
        } else if (typeof payload.delta === 'number') {
          updateUnreadCache((prev) => Math.max(0, (prev || 0) + (payload.delta || 0)));
        }
      } catch (_) {}
    });
    // 帖子可见性变化：隐藏时从公共列表的缓存中移除，取消隐藏时清理公共缓存
    uni.$on(EVENTS.POST_VISIBILITY_CHANGED, (payload = {}) => {
      try {
        const postId = payload && payload.postId;
        const isHidden = !!(payload && payload.isHidden);
        if (!postId) return;
        const cacheManager = require('@/_utils/cache-manager');
        const nsStats = cacheManager.getStats ? cacheManager.getStats() : {};
        const nsNames = Object.keys(nsStats);
        // 由于所有帖子列表都使用 posts:list 命名空间，只需要更新这个命名空间即可
        // 但为了兼容性，仍然遍历所有可能的命名空间
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
          // 取消隐藏时，失效所有相关缓存，确保帖子重新出现在列表中
          try { 
            invalidateHomePosts({}); 
            invalidatePostList({});
          } catch (_) {}
          try { clearDiscoverCache(); } catch (_) {}
        }
      } catch (_) {}
    });

    g.__CACHE_EVENTS_BRIDGED__ = true;
  } catch (_) {}
}

export default { setupCacheEventBridges };


