/**
 * 作品集相关 API 缓存层
 */
import cacheManager from '@/cache/core/manager';
import { getOpenid } from '@/utils/app-state.js';
import {
  callCloudAndUnwrap,
  callCloudAndGetResult,
  isSuccessResult
} from './_shared/cloud-wrapper.js';

const ns = cacheManager.namespace('portfolio', { persistent: true, maxItems: 32 });
const PORTFOLIO_ORDER_STORAGE_PREFIX = 'portfolio_folder_order:';

function hasValidSortOrder(folder) {
  return folder && typeof folder.sortOrder === 'number' && Number.isFinite(folder.sortOrder);
}

function getFolderTimestamp(folder) {
  if (!folder || !folder.createTime) return 0;
  const ts = new Date(folder.createTime).getTime();
  return Number.isFinite(ts) ? ts : 0;
}

function sortPortfolioFolders(folders = []) {
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

function resolvePortfolioOrderUserKey(options = {}) {
  if (options && options.openid) return String(options.openid);
  if (typeof getOpenid === 'function') {
    try {
      const id = getOpenid();
      if (id) return String(id);
    } catch (_) {}
  }
  try {
    if (typeof uni !== 'undefined' && typeof uni.getStorageSync === 'function') {
      const uid = uni.getStorageSync('userOpenId') || uni.getStorageSync('openid');
      if (uid) return String(uid);
    }
  } catch (_) {}
  return 'default';
}

function readStoredPortfolioOrder(userKey) {
  try {
    if (typeof uni !== 'undefined' && typeof uni.getStorageSync === 'function') {
      const raw = uni.getStorageSync(`${PORTFOLIO_ORDER_STORAGE_PREFIX}${userKey}`);
      if (raw && typeof raw === 'object' && Array.isArray(raw.folderIds)) {
        return raw;
      }
    }
  } catch (_) {}
  return null;
}

function writeStoredPortfolioOrder(userKey, record) {
  try {
    if (typeof uni !== 'undefined' && typeof uni.setStorageSync === 'function') {
      uni.setStorageSync(`${PORTFOLIO_ORDER_STORAGE_PREFIX}${userKey}`, record);
    }
  } catch (_) {}
}

function applyPortfolioOrderIds(folders = [], folderIds = []) {
  if (!Array.isArray(folders) || folders.length <= 1 || !Array.isArray(folderIds) || folderIds.length === 0) {
    return sortPortfolioFolders(folders);
  }
  const indexMap = new Map();
  folderIds.forEach((id, idx) => {
    if (id && !indexMap.has(id)) indexMap.set(id, idx);
  });
  if (indexMap.size === 0) return sortPortfolioFolders(folders);
  return folders.slice().sort((a, b) => {
    const aKnown = a && indexMap.has(a._id);
    const bKnown = b && indexMap.has(b._id);
    if (aKnown && bKnown) return indexMap.get(a._id) - indexMap.get(b._id);
    if (!aKnown && bKnown) return -1;
    if (aKnown && !bKnown) return 1;
    return getFolderTimestamp(b) - getFolderTimestamp(a);
  });
}

function resolveOrderedPortfolioFolders(folders = [], options = {}) {
  const userKey = resolvePortfolioOrderUserKey(options);
  const stored = readStoredPortfolioOrder(userKey);
  const serverHasSortOrder = Array.isArray(folders) && folders.some(hasValidSortOrder);

  if (stored && stored.synced === false && Array.isArray(stored.folderIds) && stored.folderIds.length > 0) {
    return applyPortfolioOrderIds(folders, stored.folderIds);
  }
  if (serverHasSortOrder) {
    const sorted = sortPortfolioFolders(folders);
    writeStoredPortfolioOrder(userKey, {
      folderIds: sorted.map(f => f && f._id).filter(Boolean),
      synced: true,
      updatedAt: Date.now()
    });
    return sorted;
  }
  if (stored && Array.isArray(stored.folderIds) && stored.folderIds.length > 0) {
    return applyPortfolioOrderIds(folders, stored.folderIds);
  }
  return sortPortfolioFolders(folders);
}

function normalizePortfolioFolder(folder = {}) {
  const count = Number(
    folder.itemCount !== undefined && folder.itemCount !== null
      ? folder.itemCount
      : folder.postCount
  ) || 0;

  return {
    ...folder,
    itemCount: count,
    postCount: count
  };
}

function extractFoldersFromResult(result = {}) {
  if (Array.isArray(result.folders)) return result.folders.map(normalizePortfolioFolder);
  if (Array.isArray(result.data)) return result.data.map(normalizePortfolioFolder);
  if (Array.isArray(result)) return result.map(normalizePortfolioFolder);
  return [];
}

/**
 * 获取作品集文件夹列表
 */
async function getPortfolioFolders({ forceRefresh = false, context, onBackgroundUpdate } = {}) {
  const fetchFolders = async () => {
    const result = await callCloudAndGetResult(
      'getPortfolioFolders',
      {},
      { pageTag: 'portfolio', context, requireAuth: true }
    );

    if (isSuccessResult(result) || Array.isArray(result.folders) || Array.isArray(result.data) || Array.isArray(result)) {
      return resolveOrderedPortfolioFolders(extractFoldersFromResult(result), { context });
    }
    throw new Error(result.error || result.message || '获取作品集失败');
  };

  if (forceRefresh) {
    invalidatePortfolioCache();
  }

  if (!ns || typeof ns.getOrFetch !== 'function') {
    return fetchFolders();
  }

  return ns.getOrFetch(
    'folders',
    fetchFolders,
    {
      ttlMs: 5 * 60 * 1000,
      swrMs: 60 * 1000,
      onBackgroundUpdate: typeof onBackgroundUpdate === 'function'
        ? (newFolders) => onBackgroundUpdate(resolveOrderedPortfolioFolders(newFolders, { context }))
        : undefined
    }
  ).then(folders => resolveOrderedPortfolioFolders(folders, { context }));
}

function createPortfolioFolder(folderName, coverUrl, options = {}) {
  if (!folderName || !folderName.trim()) {
    return Promise.reject(new Error('文件夹名称不能为空'));
  }
  if (folderName.trim().length > 50) {
    return Promise.reject(new Error('文件夹名称不能超过50字'));
  }

  return callCloudAndUnwrap(
    'createPortfolioFolder',
    {
      folderName: folderName.trim(),
      coverUrl: coverUrl || ''
    },
    Object.assign({
      pageTag: 'portfolio',
      requireAuth: true
    }, options),
    '创建作品集失败'
  );
}

function updatePortfolioFolder(folderId, name, coverUrl, options = {}) {
  if (!folderId) {
    return Promise.reject(new Error('文件夹ID不能为空'));
  }
  if (!name || !name.trim()) {
    return Promise.reject(new Error('文件夹名称不能为空'));
  }
  if (name.trim().length > 50) {
    return Promise.reject(new Error('文件夹名称不能超过50字'));
  }

  return callCloudAndUnwrap(
    'updatePortfolioFolder',
    {
      folderId,
      name: name.trim(),
      coverUrl: coverUrl || ''
    },
    Object.assign({
      pageTag: 'portfolio',
      requireAuth: true
    }, options),
    '更新作品集失败'
  );
}

function deletePortfolio(portfolioId, options = {}) {
  if (!portfolioId) {
    return Promise.reject(new Error('作品集ID不能为空'));
  }

  return callCloudAndUnwrap(
    'deletePortfolio',
    { portfolioId },
    Object.assign({
      pageTag: 'portfolio',
      requireAuth: true
    }, options),
    '删除作品集失败'
  );
}

function uploadFile(cloudPath, fileContent, options = {}) {
  if (!cloudPath) {
    return Promise.reject(new Error('文件路径不能为空'));
  }
  if (!fileContent) {
    return Promise.reject(new Error('文件内容不能为空'));
  }

  return callCloudAndUnwrap(
    'upload',
    { fileContent, cloudPath },
    Object.assign({
      pageTag: 'portfolio',
      requireAuth: true
    }, options),
    '上传失败'
  );
}

function getPortfolioDetail(portfolioId, options = {}) {
  if (!portfolioId) {
    return Promise.reject(new Error('作品集ID不能为空'));
  }

  return callCloudAndUnwrap(
    'getPortfolioDetail',
    { portfolioId },
    Object.assign({
      pageTag: 'portfolio',
      requireAuth: true
    }, options),
    '获取作品集详情失败'
  );
}

function updatePortfolioPostOrder(portfolioId, postOrder, options = {}) {
  if (!portfolioId) {
    return Promise.reject(new Error('作品集ID不能为空'));
  }
  if (!Array.isArray(postOrder)) {
    return Promise.reject(new Error('帖子顺序必须是数组'));
  }

  return callCloudAndUnwrap(
    'updatePortfolioPostOrder',
    { portfolioId, postOrder },
    Object.assign({
      pageTag: 'portfolio',
      requireAuth: true
    }, options),
    '更新排序失败'
  );
}

async function updatePortfolioFolderOrder(folderIds = [], options = {}) {
  const cleanIds = Array.isArray(folderIds)
    ? folderIds.map(id => String(id || '').trim()).filter(Boolean)
    : [];
  if (cleanIds.length === 0) return { success: false };

  const userKey = resolvePortfolioOrderUserKey(options);
  const updatedAt = Date.now();
  writeStoredPortfolioOrder(userKey, {
    folderIds: cleanIds,
    synced: false,
    updatedAt
  });

  const inputFolders = Array.isArray(options.folders)
    ? options.folders.map((folder, index) => Object.assign({}, normalizePortfolioFolder(folder || {}), { sortOrder: index }))
    : null;

  if (inputFolders && ns && typeof ns.set === 'function') {
    ns.set('folders', inputFolders, { ttlMs: 5 * 60 * 1000, swrMs: 60 * 1000 });
  } else {
    invalidatePortfolioCache();
  }

  try {
    if (typeof uni !== 'undefined' && typeof uni.$emit === 'function') {
      uni.$emit('portfolio-updated', {
        type: 'reorder',
        source: options.source || 'portfolio:reorder',
        folderIds: cleanIds,
        folders: inputFolders || undefined,
        timestamp: updatedAt
      });
    }
  } catch (error) {
    console.warn('[portfolio] emit portfolio-updated reorder failed', error);
  }

  try {
    const result = await callCloudAndGetResult(
      'updatePortfolioFolder',
      {
        action: 'updateOrder',
        folderIds: cleanIds
      },
      {
        pageTag: 'portfolio',
        context: options.context,
        requireAuth: true
      }
    );
    if (isSuccessResult(result) && result.updatedOrder) {
      const latest = readStoredPortfolioOrder(userKey);
      if (!latest || latest.updatedAt <= updatedAt) {
        writeStoredPortfolioOrder(userKey, {
          folderIds: cleanIds,
          synced: true,
          updatedAt
        });
      }
      return { success: true, synced: true };
    }
  } catch (error) {
    console.warn('[portfolio] cloud order sync skipped or failed, keeping local order:', error);
  }

  return { success: true, synced: false };
}

function invalidatePortfolioCache() {
  if (ns && typeof ns.delete === 'function') {
    ns.delete('folders');
  }
}

function notifyPortfolioUpdated(payload = {}) {
  invalidatePortfolioCache();
  try {
    uni.$emit('portfolio-updated', payload);
  } catch (error) {
    console.warn('[portfolio] emit portfolio-updated failed', error);
  }
}

const portfolioApi = {
  getPortfolioFolders,
  createPortfolioFolder,
  updatePortfolioFolder,
  updatePortfolioFolderOrder,
  deletePortfolio,
  uploadFile,
  getPortfolioDetail,
  updatePortfolioPostOrder,
  invalidatePortfolioCache,
  notifyPortfolioUpdated,
  normalizePortfolioFolder,
  sortPortfolioFolders
};

export {
  getPortfolioFolders,
  createPortfolioFolder,
  updatePortfolioFolder,
  updatePortfolioFolderOrder,
  deletePortfolio,
  uploadFile,
  getPortfolioDetail,
  updatePortfolioPostOrder,
  invalidatePortfolioCache,
  notifyPortfolioUpdated,
  normalizePortfolioFolder,
  sortPortfolioFolders
};

export default portfolioApi;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = portfolioApi;
  module.exports.default = portfolioApi;
}
