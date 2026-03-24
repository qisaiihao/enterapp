/**
 * 作品集相关 API 缓存层
 */
const cacheManager = require('@/_utils/cache-manager');
const {
  callCloudAndUnwrap,
  callCloudAndGetResult,
  isSuccessResult
} = require('./_shared/cloud-wrapper.js');

const ns = cacheManager.namespace('portfolio', { persistent: true, maxItems: 32 });

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
async function getPortfolioFolders({ forceRefresh = false, context } = {}) {
  const fetchFolders = async () => {
    const result = await callCloudAndGetResult(
      'getPortfolioFolders',
      {},
      { pageTag: 'portfolio', context, requireAuth: true }
    );

    if (isSuccessResult(result) || Array.isArray(result.folders) || Array.isArray(result.data) || Array.isArray(result)) {
      return extractFoldersFromResult(result);
    }
    throw new Error(result.error || result.message || '获取作品集失败');
  };

  if (forceRefresh) {
    ns.delete('folders');
  }

  return ns.getOrFetch(
    'folders',
    fetchFolders,
    { ttlMs: 5 * 60 * 1000, swrMs: 60 * 1000 }
  );
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

function invalidatePortfolioCache() {
  ns.delete('folders');
}

function notifyPortfolioUpdated(payload = {}) {
  invalidatePortfolioCache();
  try {
    uni.$emit('portfolio-updated', payload);
  } catch (error) {
    console.warn('[portfolio] emit portfolio-updated failed', error);
  }
}

module.exports = {
  getPortfolioFolders,
  createPortfolioFolder,
  updatePortfolioFolder,
  deletePortfolio,
  uploadFile,
  getPortfolioDetail,
  updatePortfolioPostOrder,
  invalidatePortfolioCache,
  notifyPortfolioUpdated,
  normalizePortfolioFolder
};
