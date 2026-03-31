/**
 * 草稿相关API缓存层
 */
import { cloudCall } from '../utils/cloudCall.js';

/**
 * 获取我的草稿列表
 * @param {Object} params - 查询选项
 * @returns {Promise} 草稿列表
 */
async function getMyDrafts(params = {}) {
  // 将解构移入函数体内，解决 ReferenceError 问题
  const { 
    page = 0, 
    pageSize = 20, 
    context, 
    ...options 
  } = params;

  return cloudCall('getMyProfileData', {
    action: 'getDrafts',
    page: page,
    pageSize: pageSize
  }, Object.assign({
    pageTag: 'draft-box',
    requireAuth: true
  }, options));
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

const draftApi = {
  getMyDrafts,
  saveDraft,
  deleteDraft,
  clearAllDrafts
};

export {
  getMyDrafts,
  saveDraft,
  deleteDraft,
  clearAllDrafts
};

export default draftApi;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = draftApi;
  module.exports.default = draftApi;
}
