// In-memory cache for blocked user IDs per blocker.
// Note: In cloud functions, process memory is ephemeral; this cache only helps within a warm container.

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Map: blockerId -> { ids: string[], expiresAt: number }
const store = new Map();

function now() {
  return Date.now();
}

function getCachedBlockedIds(blockerId) {
  if (!blockerId) return null;
  const rec = store.get(blockerId);
  if (!rec) return null;
  if (rec.expiresAt && rec.expiresAt > now()) {
    return Array.isArray(rec.ids) ? rec.ids.slice() : [];
  }
  store.delete(blockerId);
  return null;
}

function setCachedBlockedIds(blockerId, ids, ttlMs = DEFAULT_TTL_MS) {
  if (!blockerId) return;
  const safeIds = Array.isArray(ids) ? Array.from(new Set(ids.map(String))) : [];
  store.set(blockerId, { ids: safeIds, expiresAt: now() + (ttlMs || DEFAULT_TTL_MS) });
}

function updateCache(blockerId, targetId, isBlocked, ttlMs = DEFAULT_TTL_MS) {
  if (!blockerId || !targetId) return;
  const current = getCachedBlockedIds(blockerId);
  let next = current || [];
  const idx = next.indexOf(String(targetId));
  if (isBlocked) {
    if (idx === -1) next.push(String(targetId));
  } else if (idx !== -1) {
    next.splice(idx, 1);
  }
  setCachedBlockedIds(blockerId, next, ttlMs);
}

function invalidate(blockerId) {
  if (!blockerId) return;
  store.delete(blockerId);
}

module.exports = {
  getCachedBlockedIds,
  setCachedBlockedIds,
  updateCache,
  invalidate
};
