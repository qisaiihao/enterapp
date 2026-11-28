import { callCloudAndUnwrap } from './_shared/cloud-wrapper.js';
import { captureFavoriteSession, captureFavoriteRead, staleFavoriteError } from '@/cache/favorites.js';
import { emitFavoriteChanged } from '@/utils/events.js';

const FAVORITE_ORDER_STORAGE_PREFIX = 'favorite_folder_order:';

function hasValidSortOrder(folder) {
  return folder && typeof folder.sortOrder === 'number' && Number.isFinite(folder.sortOrder);
}

function getFolderTimestamp(folder) {
  if (!folder || !folder.createTime) return 0;
  const ts = new Date(folder.createTime).getTime();
  return Number.isFinite(ts) ? ts : 0;
}

function sortFavoriteFolders(folders = []) {
  return (Array.isArray(folders) ? folders : []).slice().sort((a, b) => {
    const aHas = hasValidSortOrder(a);
    const bHas = hasValidSortOrder(b);
    if (aHas && bHas) {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return getFolderTimestamp(b) - getFolderTimestamp(a);
    }
    if (!aHas && bHas) return -1;
    if (aHas && !bHas) return 1;
    return getFolderTimestamp(b) - getFolderTimestamp(a);
  });
}

function readStoredFavoriteOrder(userId) {
  if (!userId) return null;
  try {
    if (typeof uni !== 'undefined' && typeof uni.getStorageSync === 'function') {
      const raw = uni.getStorageSync(`${FAVORITE_ORDER_STORAGE_PREFIX}${userId}`);
      if (raw && typeof raw === 'object' && Array.isArray(raw.folderIds)) {
        return raw;
      }
    }
  } catch (_) {}
  return null;
}

function writeStoredFavoriteOrder(userId, record) {
  if (!userId) return;
  try {
    if (typeof uni !== 'undefined' && typeof uni.setStorageSync === 'function') {
      uni.setStorageSync(`${FAVORITE_ORDER_STORAGE_PREFIX}${userId}`, record);
    }
  } catch (_) {}
}

function applyFavoriteOrderIds(folders = [], folderIds = []) {
  if (!Array.isArray(folders) || folders.length <= 1 || !Array.isArray(folderIds) || folderIds.length === 0) {
    return sortFavoriteFolders(folders);
  }
  const indexMap = new Map();
  folderIds.forEach((id, idx) => {
    if (id && !indexMap.has(id)) indexMap.set(id, idx);
  });
  if (indexMap.size === 0) return sortFavoriteFolders(folders);
  return folders.slice().sort((a, b) => {
    const aKnown = a && indexMap.has(a._id);
    const bKnown = b && indexMap.has(b._id);
    if (aKnown && bKnown) return indexMap.get(a._id) - indexMap.get(b._id);
    if (!aKnown && bKnown) return -1;
    if (aKnown && !bKnown) return 1;
    return getFolderTimestamp(b) - getFolderTimestamp(a);
  });
}

function resolveOrderedFavoriteFolders(folders = [], userId = '') {
  const stored = readStoredFavoriteOrder(userId);
  const serverHasSortOrder = Array.isArray(folders) && folders.some(hasValidSortOrder);

  if (stored && stored.synced === false && Array.isArray(stored.folderIds) && stored.folderIds.length > 0) {
    return applyFavoriteOrderIds(folders, stored.folderIds);
  }
  if (serverHasSortOrder) {
    const sorted = sortFavoriteFolders(folders);
    writeStoredFavoriteOrder(userId, {
      folderIds: sorted.map(f => f && f._id).filter(Boolean),
      synced: true,
      updatedAt: Date.now()
    });
    return sorted;
  }
  if (stored && Array.isArray(stored.folderIds) && stored.folderIds.length > 0) {
    return applyFavoriteOrderIds(folders, stored.folderIds);
  }
  return sortFavoriteFolders(folders);
}

async function mutate(name, data, change, context) {
  const session = captureFavoriteSession();
  if (!session.userId) throw new Error('请先登录');
  const result = await callCloudAndUnwrap(name, { ...data, openid: session.userId }, {
    context, pageTag: 'favorites:write', requireAuth: true
  }, '收藏操作失败');
  if (!session.isCurrent()) throw staleFavoriteError();
  emitFavoriteChanged({ ...change, userId: session.userId, favoriteId: change.favoriteId || result.favoriteId });
  return result;
}

export function addFavorite(postId, folderId, context) {
  return mutate('getMyProfileData', { action: 'addToFavorite', postId, folderId },
    { kind: 'added', postId, folderId, favored: true }, context);
}

export function removeFavoriteRecord(favoriteId, context, { postId, folderId } = {}) {
  // 同帖可存在于多个收藏夹。删除单条记录不能推断 favored=false。
  return mutate('getMyProfileData', { action: 'removeFromFavorite', favoriteId },
    { kind: 'removed', favoriteId, postId, folderId }, context);
}

export function deleteFavoriteFolder(folderId, context) {
  return mutate('deleteFavoriteFolder', { folderId }, { kind: 'folder-deleted', folderId }, context);
}

export function createFavoriteFolder(folderName, coverUrl, context) {
  return mutate('createFavoriteFolder', { folderName, coverUrl }, { kind: 'folder-created' }, context);
}

export function updateFavoriteFolder(folderId, name, coverUrl, context) {
  return mutate('updateFavoriteFolder', { folderId, name, coverUrl },
    { kind: 'folder-updated', folderId }, context);
}

export async function updateFavoriteFolderOrder(folderIds, context, extra = {}) {
  const session = captureFavoriteSession();
  if (!session.userId) throw new Error('请先登录');
  const cleanIds = Array.isArray(folderIds)
    ? folderIds.map(id => String(id || '').trim()).filter(Boolean)
    : [];
  if (cleanIds.length === 0) return { success: false };

  const updatedAt = Date.now();
  writeStoredFavoriteOrder(session.userId, {
    folderIds: cleanIds,
    synced: false,
    updatedAt
  });

  emitFavoriteChanged({
    kind: 'folder-reordered',
    source: extra.source || 'favorite-folders:reorder',
    userId: session.userId,
    folderIds: cleanIds
  });

  try {
    const result = await callCloudAndUnwrap(
      'getMyProfileData',
      { action: 'updateFavoriteFolderOrder', folderIds: cleanIds, openid: session.userId },
      { context, pageTag: 'favorites:write', requireAuth: true },
      '收藏夹排序失败'
    );
    if (!session.isCurrent()) throw staleFavoriteError();
    if (result && result.updatedOrder) {
      const latest = readStoredFavoriteOrder(session.userId);
      if (!latest || latest.updatedAt <= updatedAt) {
        writeStoredFavoriteOrder(session.userId, {
          folderIds: cleanIds,
          synced: true,
          updatedAt
        });
      }
      return { success: true, synced: true };
    }
  } catch (error) {
    if (error && error.code === 'FAVORITE_STALE') throw error;
    console.warn('[favorite-actions] cloud order sync skipped or failed, keeping local order:', error);
  }

  return { success: true, synced: false };
}

export async function getFavoriteFolders(context) {
  const session = captureFavoriteSession();
  const current = captureFavoriteRead(undefined, 'folders');
  const result = await callCloudAndUnwrap('getMyProfileData', { action: 'getFavoriteFolders' },
    { context, pageTag: 'favorites:folders', requireAuth: true }, '加载收藏夹失败');
  if (!current()) throw staleFavoriteError();
  return resolveOrderedFavoriteFolders(result.folders || [], session.userId);
}
