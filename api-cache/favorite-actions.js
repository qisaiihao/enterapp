import { callCloudAndUnwrap } from './_shared/cloud-wrapper.js';
import { captureFavoriteSession, captureFavoriteRead, staleFavoriteError } from '@/cache/favorites.js';
import { emitFavoriteChanged } from '@/utils/events.js';

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

export async function getFavoriteFolders(context) {
  const current = captureFavoriteRead(undefined, 'folders');
  const result = await callCloudAndUnwrap('getMyProfileData', { action: 'getFavoriteFolders' },
    { context, pageTag: 'favorites:folders', requireAuth: true }, '加载收藏夹失败');
  if (!current()) throw staleFavoriteError();
  return result.folders || [];
}
