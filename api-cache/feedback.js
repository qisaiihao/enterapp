/**
 * 反馈相关API缓存层
 */
const { cloudCall } = require('../utils/cloudCall.js');

/**
 * 提交反馈
 * @param {Object} feedbackData - 反馈数据
 * @param {string} feedbackData.content - 反馈内容
 * @param {string} feedbackData.type - 反馈类型 (bug, suggestion, other)
 * @param {Array} feedbackData.images - 相关图片
 * @param {Object} feedbackData.contactInfo - 联系信息
 * @param {Object} options - 额外选项
 * @returns {Promise} 提交结果
 */
function submitFeedback(feedbackData, options = {}) {
  if (!feedbackData || !feedbackData.content || !feedbackData.content.trim()) {
    return Promise.reject(new Error('反馈内容不能为空'));
  }

  const params = {
    content: feedbackData.content.trim(),
    type: feedbackData.type || 'other',
    images: feedbackData.images || [],
    contactInfo: feedbackData.contactInfo || {},
    userAgent: feedbackData.userAgent || '',
    timestamp: Date.now()
  };

  return cloudCall('feedbackManager', {
    action: 'submit',
    ...params
  }, Object.assign({
    pageTag: 'feedback',
    requireAuth: false,
    ...options
  }));
}

/**
 * 获取反馈列表（管理员）
 * @param {Object} options - 查询选项
 * @param {number} options.page - 页码
 * @param {number} options.pageSize - 每页数量
 * @param {string} options.status - 状态筛选
 * @param {string} options.type - 类型筛选
 * @param {Object} options.context - 页面上下文
 * @returns {Promise} 反馈列表
 */
async function getFeedbackList({ page = 0, pageSize = 20, status = '', type = '', context, ...options } = {}) {
  const params = {
    action: 'getList',
    page: page,
    pageSize: pageSize
  };

  if (status) params.status = status;
  if (type) params.type = type;

  return cloudCall('feedbackManager', params, Object.assign({
    pageTag: 'feedback-admin',
    requireAuth: true,
    ...options
  }));
}

/**
 * 更新反馈状态（管理员）
 * @param {string} feedbackId - 反馈ID
 * @param {string} status - 新状态
 * @param {string} comment - 处理备注
 * @param {Object} options - 额外选项
 * @returns {Promise} 更新结果
 */
function updateFeedbackStatus(feedbackId, status, comment = '', ...options) {
  if (!feedbackId) {
    return Promise.reject(new Error('反馈ID不能为空'));
  }

  return cloudCall('feedbackManager', {
    action: 'updateStatus',
    feedbackId: feedbackId,
    status: status,
    comment: comment
  }, Object.assign({
    pageTag: 'feedback-admin',
    requireAuth: true,
    ...options
  }));
}

/**
 * 删除反馈（管理员）
 * @param {string} feedbackId - 反馈ID
 * @param {Object} options - 额外选项
 * @returns {Promise} 删除结果
 */
function deleteFeedback(feedbackId, ...options) {
  if (!feedbackId) {
    return Promise.reject(new Error('反馈ID不能为空'));
  }

  return cloudCall('feedbackManager', {
    action: 'delete',
    feedbackId: feedbackId
  }, Object.assign({
    pageTag: 'feedback-admin',
    requireAuth: true,
    ...options
  }));
}

/**
 * 获取反馈详情
 * @param {string} feedbackId - 反馈ID
 * @param {Object} options - 额外选项
 * @returns {Promise} 反馈详情
 */
function getFeedbackDetail(feedbackId, ...options) {
  if (!feedbackId) {
    return Promise.reject(new Error('反馈ID不能为空'));
  }

  return cloudCall('feedbackManager', {
    action: 'getDetail',
    feedbackId: feedbackId
  }, Object.assign({
    pageTag: 'feedback-admin',
    requireAuth: true,
    ...options
  }));
}

module.exports = {
  submitFeedback,
  getFeedbackList,
  updateFeedbackStatus,
  deleteFeedback,
  getFeedbackDetail
};