import cacheManager from './core/manager.js';
import { getOpenid } from '@/utils/app-state.js';

// 内存令牌随账号缓存一起清理，阻止 A -> B -> A 后的旧请求写回页面。
const state = cacheManager.namespace('favorites:state');
function token(key) {
  let value = state.get(key);
  if (!value) { value = {}; state.set(key, value); }
  return value;
}

export function captureFavoriteSession() {
  const userId = getOpenid() || '';
  const session = token(`session:${userId}`);
  return { userId, isCurrent: () => (getOpenid() || '') === userId && state.get(`session:${userId}`) === session };
}

export function captureFavoriteRead(userId = getOpenid() || '', scope = 'items') {
  const session = captureFavoriteSession();
  const key = `revision:${scope}:${userId}`;
  const revision = token(key);
  return () => session.isCurrent() && state.get(key) === revision;
}

export function staleFavoriteError() {
  const error = new Error('收藏数据已变化');
  error.code = 'FAVORITE_STALE';
  return error;
}

export function invalidateFavoriteCaches({ userId, postId, kind } = {}) {
  if (!userId) return;
  state.set(`revision:folders:${userId}`, {});
  if (kind === 'folder-created' || kind === 'folder-updated') return;
  state.set(`revision:items:${userId}`, {});
  // 分页删除会移动后续页边界，因此该用户全部收藏页都失效。
  cacheManager.namespace(`userFavorites:${userId}`, { persistent: true }).clear();
  const mine = cacheManager.namespace('me:favorites', { persistent: true });
  mine.keys().forEach(key => {
    if (key.startsWith(`user:${userId}:`) || key.startsWith('page:')) mine.delete(key);
  });
  if (userId !== getOpenid()) return;

  // 列表目前没有收藏状态查询。只失效实际带收藏状态的记录，不重拉整个首页。
  Object.keys(cacheManager.getStats()).filter(name => name.startsWith('posts:')).forEach(name => {
    const ns = cacheManager.namespace(name);
    ns.keys().forEach(key => {
      const value = ns.get(key);
      const rows = Array.isArray(value) ? value : [value && value.post];
      if (rows.some(post => post && (!postId || post._id === postId) && 'isFavorited' in post)) ns.delete(key);
      if (name === 'posts:detail') {
        let id = key;
        try { id = JSON.parse(key)[0]; } catch (_) {}
        if (!postId || id === postId) ns.delete(key);
      }
    });
  });
}
