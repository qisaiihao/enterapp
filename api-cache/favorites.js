/**
 * 收藏内容相关API缓存层
 */
import { cloudCall } from '../utils/cloudCall.js';

/**
 * 获取我的收藏内容
 * @param {Object} options - 查询选项
 * @param {number} options.page - 页码，从0开始
 * @param {number} options.pageSize - 每页数量
 * @param {string} options.contentType - 内容类型 (all, posts, etc.)
 * @param {Object} options.context - 页面上下文
 * @returns {Promise} 收藏内容列表
 */
async function getMyFavorites({
  page = 0,
  pageSize = 20,
  contentType = 'all',
  context,
  ...options
} = {}) {
  return cloudCall('getMyProfileData', {
    action: 'getFavorites',
    page: page,
    pageSize: pageSize,
    contentType: contentType
  }, Object.assign({
    pageTag: 'favorite-content',
    requireAuth: true,
    ...options
  }));
}

/**
 * 添加收藏
 * @param {string} postId - 帖子ID
 * @param {string} postType - 帖子类型 (post, poem, discussion)
 * @param {Object} options - 额外选项
 * @returns {Promise} 添加收藏结果
 */
function addToFavorites(postId, postType = 'post', ...options) {
  if (!postId) {
    return Promise.reject(new Error('帖子ID不能为空'));
  }

  return cloudCall('getMyProfileData', {
    action: 'addToFavorites',
    postId: postId,
    postType: postType
  }, Object.assign({
    pageTag: 'favorite-content',
    requireAuth: true,
    ...options
  }));
}

/**
 * 移除收藏
 * @param {string} postId - 帖子ID
 * @param {Object} options - 额外选项
 * @returns {Promise} 移除收藏结果
 */
function removeFromFavorites(postId, ...options) {
  if (!postId) {
    return Promise.reject(new Error('帖子ID不能为空'));
  }

  return cloudCall('getMyProfileData', {
    action: 'removeFromFavorites',
    postId: postId
  }, Object.assign({
    pageTag: 'favorite-content',
    requireAuth: true,
    ...options
  }));
}

/**
 * 批量添加收藏
 * @param {Array} postIds - 帖子ID数组
 * @param {Object} options - 额外选项
 * @returns {Promise} 批量添加收藏结果
 */
function batchAddToFavorites(postIds, ...options) {
  if (!Array.isArray(postIds) || postIds.length === 0) {
    return Promise.reject(new Error('帖子ID数组不能为空'));
  }

  return cloudCall('getMyProfileData', {
    action: 'batchAddToFavorites',
    postIds: postIds
  }, Object.assign({
    pageTag: 'favorite-content',
    requireAuth: true,
    ...options
  }));
}

/**
 * 批量移除收藏
 * @param {Array} postIds - 帖子ID数组
 * @param {Object} options - 额外选项
 * @returns {Promise} 批量移除收藏结果
 */
function batchRemoveFromFavorites(postIds, ...options) {
  if (!Array.isArray(postIds) || postIds.length === 0) {
    return Promise.reject(new Error('帖子ID数组不能为空'));
  }

  return cloudCall('getMyProfileData', {
    action: 'batchRemoveFromFavorites',
    postIds: postIds
  }, Object.assign({
    pageTag: 'favorite-content',
    requireAuth: true,
    ...options
  }));
}

/**
 * 获取收藏统计信息
 * @param {Object} options - 额外选项
 * @returns {Promise} 统计信息
 */
function getFavoriteStats(...options) {
  return cloudCall('getMyProfileData', {
    action: 'getFavoriteStats'
  }, Object.assign({
    pageTag: 'favorite-content',
    requireAuth: true,
    ...options
  }));
}

/**
 * 检查帖子是否已收藏
 * @param {string} postId - 帖子ID
 * @param {Object} options - 额外选项
 * @returns {Promise} 检查结果
 */
function checkIsFavorited(postId, ...options) {
  if (!postId) {
    return Promise.reject(new Error('帖子ID不能为空'));
  }

  return cloudCall('getMyProfileData', {
    action: 'checkIsFavorited',
    postId: postId
  }, Object.assign({
    pageTag: 'favorite-content',
    requireAuth: true,
    ...options
  }));
}

/**
 * 导出收藏列表
 * @param {Object} exportOptions - 导出选项
 * @param {string} exportOptions.format - 导出格式 (json, csv)
 * @param {Array} exportOptions.postIds - 指定导出的帖子ID列表（可选）
 * @param {Object} options - 额外选项
 * @returns {Promise} 导出结果
 */
function exportFavorites(exportOptions = {}, ...options) {
  const params = {
    action: 'exportFavorites',
    format: exportOptions.format || 'json',
    postIds: exportOptions.postIds || []
  };

  return cloudCall('getMyProfileData', params, Object.assign({
    pageTag: 'favorite-content',
    requireAuth: true,
    ...options
  }));
}

/**
 * 同步收藏状态
 * @param {string} postId - 帖子ID
 * @param {boolean} isFavorited - 是否已收藏
 * @param {Object} options - 额外选项
 * @returns {Promise} 同步结果
 */
function syncFavoriteStatus(postId, isFavorited, ...options) {
  if (!postId) {
    return Promise.reject(new Error('帖子ID不能为空'));
  }

  const action = isFavorited ? 'addToFavorites' : 'removeFromFavorites';

  return cloudCall('getMyProfileData', {
    action: action,
    postId: postId
  }, Object.assign({
    pageTag: 'favorite-content',
    requireAuth: true,
    silent: true, // 静默调用
    ...options
  }));
}

const favoritesApi = {
  getMyFavorites,
  addToFavorites,
  removeFromFavorites,
  batchAddToFavorites,
  batchRemoveFromFavorites,
  getFavoriteStats,
  checkIsFavorited,
  exportFavorites,
  syncFavoriteStatus
};

export {
  getMyFavorites,
  addToFavorites,
  removeFromFavorites,
  batchAddToFavorites,
  batchRemoveFromFavorites,
  getFavoriteStats,
  checkIsFavorited,
  exportFavorites,
  syncFavoriteStatus
};

export default favoritesApi;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = favoritesApi;
  module.exports.default = favoritesApi;
}
