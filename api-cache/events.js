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

    g.__CACHE_EVENTS_BRIDGED__ = true;
  } catch (_) {}
}

export default { setupCacheEventBridges };

