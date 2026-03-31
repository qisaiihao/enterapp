import cacheManager from '../core/manager.js';
import likeIcon from '@/utils/likeIcon.js';

const NS_LIKE = cacheManager.namespace('like:status', { persistent: true, maxItems: 2000 });
const LIKE_TTL_MS = 10 * 60 * 1000;

function getLikeIconModule() {
  return likeIcon && typeof likeIcon.getLikeIcon === 'function'
    ? likeIcon
    : { getLikeIcon: () => '/static/images/icons/like.png' };
}

function getLikeStatus(postId) {
  if (!postId) return null;

  const cached = NS_LIKE.get(postId);
  if (!cached) return null;

  return {
    votes: cached.votes,
    isVoted: cached.isVoted,
    likeIcon: getLikeIconModule().getLikeIcon(cached.votes, cached.isVoted)
  };
}

function updateLikeStatus(postId, votes, isVoted) {
  if (!postId) return;

  NS_LIKE.set(
    postId,
    {
      votes,
      isVoted,
      updatedAt: Date.now()
    },
    { ttlMs: LIKE_TTL_MS }
  );
}

function getBatchLikeStatus(postIds) {
  if (!Array.isArray(postIds) || postIds.length === 0) return {};

  const result = {};
  postIds.forEach((postId) => {
    const status = getLikeStatus(postId);
    if (status) {
      result[postId] = status;
    }
  });
  return result;
}

function batchUpdateLikeStatus(statusMap) {
  if (!statusMap || typeof statusMap !== 'object') return;

  Object.entries(statusMap).forEach(([postId, status]) => {
    if (status && typeof status.votes === 'number') {
      updateLikeStatus(postId, status.votes, !!status.isVoted);
    }
  });
}

function clearLikeStatus(postId) {
  if (!postId) return;
  NS_LIKE.delete(postId);
}

function clearAllLikeStatus() {
  NS_LIKE.clear();
}

function syncToListCaches(postIds = []) {
  if (!Array.isArray(postIds) || postIds.length === 0) {
    return { updated: 0, errors: [] };
  }

  const result = { updated: 0, errors: [] };

  try {
    const nsStats = cacheManager.getStats?.() || {};
    const nsNames = Object.keys(nsStats);
    const targets = nsNames.filter((name) => (
      name === 'posts:list' ||
      name === 'posts:home' ||
      name === 'posts:discover' ||
      name.startsWith('posts:tag:') ||
      name.startsWith('posts:') ||
      name.startsWith('me:posts') ||
      name.startsWith('userPosts:') ||
      name === 'myLikes'
    ));

    targets.forEach((nsName) => {
      try {
        const ns = cacheManager.namespace(nsName);
        const keys = ns.keys?.() || [];

        keys.forEach((key) => {
          try {
            ns.update(key, (list) => {
              if (!Array.isArray(list)) return list;

              list.forEach((post) => {
                const postId = post?._id || post?.id;
                if (postId && postIds.includes(postId)) {
                  const status = getLikeStatus(postId);
                  if (status) {
                    post.votes = status.votes;
                    post.isVoted = status.isVoted;
                    post.likeIcon = status.likeIcon;
                    result.updated += 1;
                  }
                }
              });

              return list;
            });
          } catch (_) {
            result.errors.push(`update ${nsName}:${key} failed`);
          }
        });
      } catch (_) {
        result.errors.push(`namespace ${nsName} failed`);
      }
    });
  } catch (error) {
    result.errors.push(`sync failed: ${error.message}`);
  }

  return result;
}

function preloadFromPosts(posts) {
  if (!Array.isArray(posts) || posts.length === 0) return;

  posts.forEach((post) => {
    const postId = post?._id || post?.id;
    if (postId && typeof post.votes === 'number' && !NS_LIKE.get(postId)) {
      NS_LIKE.set(
        postId,
        {
          votes: post.votes,
          isVoted: !!post.isVoted,
          updatedAt: Date.now()
        },
        { ttlMs: LIKE_TTL_MS }
      );
    }
  });
}

function getStats() {
  return {
    size: NS_LIKE.keys().length,
    keys: NS_LIKE.keys()
  };
}

const likeStatusCache = {
  getLikeStatus,
  updateLikeStatus,
  getBatchLikeStatus,
  batchUpdateLikeStatus,
  clearLikeStatus,
  clearAllLikeStatus,
  syncToListCaches,
  preloadFromPosts,
  getStats,
  LIKE_TTL_MS
};

export {
  getLikeStatus,
  updateLikeStatus,
  getBatchLikeStatus,
  batchUpdateLikeStatus,
  clearLikeStatus,
  clearAllLikeStatus,
  syncToListCaches,
  preloadFromPosts,
  getStats,
  LIKE_TTL_MS
};

export default likeStatusCache;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = likeStatusCache;
  module.exports.default = likeStatusCache;
}
