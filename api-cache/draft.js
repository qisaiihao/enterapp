/**
 * 草稿相关API缓存层
 */
const { cloudCall } = require('../utils/cloudCall.js');

/**
 * 获取我的草稿列表
 * @param {Object} options - 查询选项
 * @param {number} options.page - 页码
 * @param {number} options.pageSize - 每页数量
 * @param {Object} options.context - 页面上下文
 * @returns {Promise} 草稿列表
 */
async function getMyDrafts({ page = 0, pageSize = 20, context } = {}) {
  return cloudCall('getMyProfileData', {
    action: 'getDrafts',
    page: page,
    pageSize: pageSize
  }, Object.assign({
    pageTag: 'draft-box',
    requireAuth: true,
    ...options
  }));
}

/**
 * 保存草稿
 * @param {Object} draftData - 草稿数据
 * @param {Object} options - 额外选项
 * @returns {Promise} 保存结果
 */
function saveDraft(draftData, options = {}) {
  if (!draftData) {
    return Promise.reject(new Error('草稿数据不能为空'));
  }

  return cloudCall('getMyProfileData', {
    action: 'saveDraft',
    draftData: draftData
  }, Object.assign({
    pageTag: 'draft-box',
    requireAuth: true,
    ...options
  }));
}

/**
 * 删除草稿
 * @param {string} draftId - 草稿ID
 * @param {Object} options - 额外选项
 * @returns {Promise} 删除结果
 */
function deleteDraft(draftId, options = {}) {
  if (!draftId) {
    return Promise.reject(new Error('草稿ID不能为空'));
  }

  return cloudCall('getMyProfileData', {
    action: 'deleteDraft',
    draftId: draftId
  }, Object.assign({
    pageTag: 'draft-box',
    requireAuth: true,
    ...options
  }));
}

/**
 * 清空所有草稿
 * @param {Object} options - 额外选项
 * @returns {Promise} 清空结果
 */
function clearAllDrafts(options = {}) {
  return cloudCall('getMyProfileData', {
    action: 'clearAllDrafts'
  }, Object.assign({
    pageTag: 'draft-box',
    requireAuth: true,
    ...options
  }));
}

module.exports = {
  getMyDrafts,
  saveDraft,
  deleteDraft,
  clearAllDrafts
};