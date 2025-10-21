import { EVENTS } from '@/utils/events.js';
import { invalidateHomePosts, } from '@/api-cache/home-posts.js';
import { clearDiscoverCache } from '@/api-cache/discover.js';
import { invalidateUserInfo, invalidateUserPosts } from '@/api-cache/user-profile.js';

export function setupCacheEventBridges() {
  try {
    const g = (typeof globalThis !== 'undefined') ? globalThis : window;
    if (g.__CACHE_EVENTS_BRIDGED__) return;
    if (!uni || typeof uni.$on !== 'function') return;

    // 新帖发布：刷新首页与发现页相关缓存
    uni.$on(EVENTS.POST_CREATED, (payload = {}) => {
      try { invalidateHomePosts({}); } catch (_) {}
      try { clearDiscoverCache(); } catch (_) {}
    });

    // 头像更新：失效对应用户资料与TA的个人主页分页
    uni.$on(EVENTS.AVATAR_UPDATED, (payload = {}) => {
      const uid = payload && (payload.userId || payload.userID || payload.uid);
      if (!uid) return;
      try { invalidateUserInfo(uid); } catch (_) {}
      try { invalidateUserPosts(uid); } catch (_) {}
    });

    // 收藏变更：当前阶段按用户要求暂不做整页失效
    // uni.$on(EVENTS.FAVORITE_CHANGED, () => { /* no-op */ });

    // 点赞变更：更新专用缓存并同步到相关命名空间列表缓存
    uni.$on(EVENTS.LIKE_CHANGED, (payload = {}) => {
      try {
        const postId = payload.postId;
        const votes = payload.votes;
        const isLiked = payload.isLiked;
        if (!postId) return;
        // 更新 like:status 专用缓存，随后批量同步到列表缓存
        try { const { updateLikeStatus, syncLikeStatusForPosts } = require('@/utils/likeStatusSync.js');
          updateLikeStatus(postId, votes, isLiked);
          syncLikeStatusForPosts([postId]);
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

    g.__CACHE_EVENTS_BRIDGED__ = true;
  } catch (_) {}
}

export default { setupCacheEventBridges };
