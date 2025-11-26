const cacheManager = require('../_utils/cache-manager');

function ns() {
  return cacheManager.namespace('comment:like:status', { persistent: true, maxItems: 2000 });
}

function updateCommentLikeCache(commentId, likes, liked) {
  if (!commentId) return;
  try {
    ns().set(String(commentId), { likes: Number(likes) || 0, liked: !!liked, ts: Date.now() }, { ttlMs: 10 * 60 * 1000 });
  } catch (_) {}
}

function getLatestCommentLike(commentId) {
  if (!commentId) return null;
  try {
    const v = ns().get(String(commentId));
    if (v && v.ts && Date.now() - v.ts < 10 * 60 * 1000) return { likes: Number(v.likes) || 0, liked: !!v.liked };
  } catch (_) {}
  try {
    const k = `comment_like_status_${commentId}`;
    const raw = uni.getStorageSync(k);
    if (raw) {
      const obj = JSON.parse(raw);
      if (obj && obj.ts && Date.now() - obj.ts < 10 * 60 * 1000) return { likes: Number(obj.likes) || 0, liked: !!obj.liked };
    }
  } catch (_) {}
  return null;
}

function persistToStorage(commentId, likes, liked) {
  try {
    const k = `comment_like_status_${commentId}`;
    uni.setStorageSync(k, JSON.stringify({ likes: Number(likes) || 0, liked: !!liked, ts: Date.now() }));
  } catch (_) {}
}

module.exports = {
  updateCommentLikeCache,
  getLatestCommentLike,
  persistToStorage,
};

