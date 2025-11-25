/**
 * 作品集相关API缓存层
 */
const cacheManager = require('@/_utils/cache-manager');
const { cloudCall } = require('../utils/cloudCall.js');

// 使用独立的 portfolio 命名空间
const ns = cacheManager.namespace('portfolio', { persistent: true, maxItems: 32 });

/**
 * 获取作品集文件夹列表
 * @param {Object} options - 选项
 * @param {boolean} options.forceRefresh - 是否强制刷新
 * @param {Object} options.context - 页面上下文
 * @returns {Promise} 作品集列表
 */
async function getPortfolioFolders({ forceRefresh = false, context } = {}) {
  const cacheKey = 'folders';

  // 如果强制刷新，使用时间戳作为缓存键的一部分来绕过缓存
  const finalCacheKey = forceRefresh ? `${cacheKey}:ts:${Date.now()}` : cacheKey;

  console.log('🔍 [portfolio] 请求作品集列表 - key:', finalCacheKey, 'forceRefresh:', forceRefresh);

  // 强制刷新时，跳过缓存直接调用云函数
  if (forceRefresh) {
    console.log('🔍 [portfolio] 强制刷新，跳过缓存直接调用云函数');
    const res = await cloudCall(
      'getPortfolioFolders',
      {},
      { pageTag: 'portfolio', context, requireAuth: true }
    );
    console.log('🔍 [portfolio] 云函数返回 - success:', res?.result?.success, 'folders数量:', res?.result?.folders?.length);
    if (res && res.result && res.result.success) {
      return res.result.folders || [];
    }
    return [];
  }

  // 使用缓存
  return ns.getOrFetch(
    finalCacheKey,
    async () => {
      console.log('🔍 [portfolio] 缓存未命中，调用云函数');
      const res = await cloudCall(
        'getPortfolioFolders',
        {},
        { pageTag: 'portfolio', context, requireAuth: true }
      );
      console.log('🔍 [portfolio] 云函数返回 - success:', res?.result?.success, 'folders数量:', res?.result?.folders?.length);
      if (res && res.result && res.result.success) {
        return res.result.folders || [];
      }
      return [];
    },
    { ttlMs: 5 * 60 * 1000, swrMs: 60 * 1000 } // 5分钟TTL，1分钟SWR
  );
}

/**
 * 创建作品集文件夹
 * @param {string} folderName - 文件夹名称
 * @param {string} coverUrl - 封面图片URL
 * @param {Object} options - 额外选项
 * @returns {Promise} 创建结果
 */
function createPortfolioFolder(folderName, coverUrl, options = {}) {
  if (!folderName || !folderName.trim()) {
    return Promise.reject(new Error('文件夹名称不能为空'));
  }

  if (folderName.trim().length > 50) {
    return Promise.reject(new Error('文件夹名称不能超过50字'));
  }

  return cloudCall('createPortfolioFolder', {
    folderName: folderName.trim(),
    coverUrl: coverUrl || ''
  }, Object.assign({
    pageTag: 'portfolio',
    requireAuth: true,
    ...options
  }));
}

/**
 * 更新作品集文件夹
 * @param {string} folderId - 文件夹ID
 * @param {string} name - 新名称
 * @param {string} coverUrl - 封面图片URL
 * @param {Object} options - 额外选项
 * @returns {Promise} 更新结果
 */
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

  return cloudCall('updatePortfolioFolder', {
    folderId: folderId,
    name: name.trim(),
    coverUrl: coverUrl || ''
  }, Object.assign({
    pageTag: 'portfolio',
    requireAuth: true,
    ...options
  }));
}

/**
 * 删除作品集
 * @param {string} portfolioId - 作品集ID
 * @param {Object} options - 额外选项
 * @returns {Promise} 删除结果
 */
function deletePortfolio(portfolioId, options = {}) {
  if (!portfolioId) {
    return Promise.reject(new Error('作品集ID不能为空'));
  }

  return cloudCall('deletePortfolio', {
    portfolioId: portfolioId
  }, Object.assign({
    pageTag: 'portfolio',
    requireAuth: true,
    ...options
  }));
}

/**
 * 上传文件到云存储
 * @param {string} cloudPath - 云端路径
 * @param {string} fileContent - 文件内容（base64）
 * @param {Object} options - 额外选项
 * @returns {Promise} 上传结果
 */
function uploadFile(cloudPath, fileContent, options = {}) {
  if (!cloudPath) {
    return Promise.reject(new Error('文件路径不能为空'));
  }

  if (!fileContent) {
    return Promise.reject(new Error('文件内容不能为空'));
  }

  return cloudCall('upload', {
    fileContent: fileContent,
    cloudPath: cloudPath
  }, Object.assign({
    pageTag: 'portfolio',
    requireAuth: true,
    ...options
  }));
}

/**
 * 获取作品集详情
 * @param {string} portfolioId - 作品集ID
 * @param {Object} options - 额外选项
 * @returns {Promise} 作品集详情
 */
function getPortfolioDetail(portfolioId, options = {}) {
  if (!portfolioId) {
    return Promise.reject(new Error('作品集ID不能为空'));
  }

  return cloudCall('getPortfolioDetail', {
    portfolioId: portfolioId
  }, Object.assign({
    pageTag: 'portfolio',
    requireAuth: true,
    ...options
  }));
}

/**
 * 更新作品集帖子顺序
 * @param {string} portfolioId - 作品集ID
 * @param {Array} postOrder - 帖子ID顺序数组
 * @param {Object} options - 额外选项
 * @returns {Promise} 更新结果
 */
function updatePortfolioPostOrder(portfolioId, postOrder, options = {}) {
  if (!portfolioId) {
    return Promise.reject(new Error('作品集ID不能为空'));
  }

  if (!Array.isArray(postOrder)) {
    return Promise.reject(new Error('帖子顺序必须是数组'));
  }

  return cloudCall('updatePortfolioPostOrder', {
    portfolioId: portfolioId,
    postOrder: postOrder
  }, Object.assign({
    pageTag: 'portfolio',
    requireAuth: true,
    ...options
  }));
}

/**
 * 清除作品集缓存
 * @param {Object} options - 清除选项
 */
function invalidatePortfolioCache(options = {}) {
  ns.delete('folders');
  console.log('🔍 [portfolio] 清除缓存');
}

module.exports = {
  getPortfolioFolders,
  createPortfolioFolder,
  updatePortfolioFolder,
  deletePortfolio,
  uploadFile,
  getPortfolioDetail,
  updatePortfolioPostOrder,
  invalidatePortfolioCache
};